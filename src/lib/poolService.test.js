import { test } from "node:test";
import assert from "node:assert/strict";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  listPools,
  getPool,
  getPoolHistory,
  buildCreatePoolTx,
  buildContributeTx,
} from "./poolService.js";

const CONTRACT_ID = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 7));
const BENEFICIARY = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1));
const TOKEN = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 2));
const CONTRIBUTOR = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));

function poolScVal({ target = 1000n, current = 400n, released = false } = {}) {
  return StellarSdk.nativeToScVal(
    {
      beneficiary: StellarSdk.Address.fromString(BENEFICIARY),
      token: StellarSdk.Address.fromString(TOKEN),
      target_amount: target,
      current_amount: current,
      released,
    },
    { type: "instance" },
  );
}

function mockSuccessfulGetPool(t, scVal) {
  t.mock.method(StellarSdk.rpc.Server.prototype, "simulateTransaction", async () => ({
    result: { retval: scVal },
    latestLedger: 12345,
  }));
}

// Builds a mock Soroban event shaped like what server.getEvents() returns:
// topic is an array of raw (undecoded) xdr.ScVal, value is a single raw
// xdr.ScVal — matching what cowrybridge-contracts/src/events.rs actually
// publishes: topic = (symbol,), data = (Address, i128).
function mockEvent({ topicSym, address, amount, ledger }) {
  return {
    topic: [StellarSdk.nativeToScVal(topicSym, { type: "symbol" })],
    // A Rust (Address, i128) tuple, as env.events().publish() sends it, is
    // an ScVec of its two elements — build it the same way rather than via
    // nativeToScVal(array), which requires a homogeneous array type.
    value: StellarSdk.xdr.ScVal.scvVec([
      StellarSdk.Address.fromString(address).toScVal(),
      StellarSdk.nativeToScVal(amount, { type: "i128" }),
    ]),
    ledger,
    ledgerClosedAt: `2026-08-07T00:0${ledger % 10}:00Z`,
    txHash: `tx-${ledger}`,
  };
}

test("listPools returns an empty array when CONTRACT_ID is not configured", async () => {
  delete process.env.CONTRACT_ID;
  assert.deepEqual(await listPools(), []);
});

test("listPools returns the single pool the contract holds", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  mockSuccessfulGetPool(t, poolScVal());

  const pools = await listPools();
  assert.equal(pools.length, 1);
  assert.equal(pools[0].id, CONTRACT_ID);
  assert.equal(pools[0].beneficiary, BENEFICIARY);
  assert.equal(pools[0].token, TOKEN);
  assert.equal(pools[0].targetAmount, 1000);
  assert.equal(pools[0].currentAmount, 400);
  assert.equal(pools[0].released, false);
});

test("getPool returns null when the id doesn't match the configured contract", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  mockSuccessfulGetPool(t, poolScVal());

  assert.equal(await getPool("does-not-exist"), null);
});

test("getPool returns null when the contract reports no pool yet", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  t.mock.method(StellarSdk.rpc.Server.prototype, "simulateTransaction", async () => ({
    error: "HostError: Error(Contract, #1)",
  }));

  assert.equal(await getPool(CONTRACT_ID), null);
});

test("getPool returns the matching pool", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  mockSuccessfulGetPool(t, poolScVal({ current: 1000n, released: true }));

  const pool = await getPool(CONTRACT_ID);
  assert.equal(pool.id, CONTRACT_ID);
  assert.equal(pool.currentAmount, 1000);
  assert.equal(pool.released, true);
});

test("buildCreatePoolTx builds an unsigned create_pool call for the beneficiary to sign", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  t.mock.method(StellarSdk.rpc.Server.prototype, "getAccount", async (id) => {
    assert.equal(id, BENEFICIARY);
    return new StellarSdk.Account(id, "100");
  });
  const prepare = t.mock.method(
    StellarSdk.rpc.Server.prototype,
    "prepareTransaction",
    async (tx) => tx,
  );

  const xdr = await buildCreatePoolTx({ beneficiary: BENEFICIARY, targetAmount: 1000, token: TOKEN });

  assert.equal(typeof xdr, "string");
  assert.equal(prepare.mock.callCount(), 1);

  const builtTx = prepare.mock.calls[0].arguments[0];
  const op = builtTx.operations[0];
  assert.equal(op.type, "invokeHostFunction");
  const invoke = op.func.invokeContract();
  assert.equal(invoke.functionName().toString(), "create_pool");
  assert.equal(invoke.contractAddress().contractId().toString("hex"), StellarSdk.StrKey.decodeContract(CONTRACT_ID).toString("hex"));

  // Rebuilding from the returned XDR should round-trip.
  const rebuilt = StellarSdk.TransactionBuilder.fromXDR(xdr, StellarSdk.Networks.TESTNET);
  assert.equal(rebuilt.operations[0].func.invokeContract().functionName().toString(), "create_pool");
});

test("buildContributeTx builds an unsigned contribute call for the contributor to sign", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  t.mock.method(StellarSdk.rpc.Server.prototype, "getAccount", async (id) => {
    assert.equal(id, CONTRIBUTOR);
    return new StellarSdk.Account(id, "200");
  });
  const prepare = t.mock.method(
    StellarSdk.rpc.Server.prototype,
    "prepareTransaction",
    async (tx) => tx,
  );

  const xdr = await buildContributeTx({ from: CONTRIBUTOR, amount: 250 });

  assert.equal(typeof xdr, "string");
  const builtTx = prepare.mock.calls[0].arguments[0];
  const invoke = builtTx.operations[0].func.invokeContract();
  assert.equal(invoke.functionName().toString(), "contribute");
});

test("getPoolHistory returns an empty array for an unconfigured or mismatched id", async () => {
  process.env.CONTRACT_ID = CONTRACT_ID;
  assert.deepEqual(await getPoolHistory("does-not-exist"), []);

  delete process.env.CONTRACT_ID;
  assert.deepEqual(await getPoolHistory(CONTRACT_ID), []);
});

test("getPoolHistory maps created/contributed/released events, newest first", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;

  t.mock.method(StellarSdk.rpc.Server.prototype, "getLatestLedger", async () => ({
    sequence: 500,
  }));

  const events = [
    mockEvent({ topicSym: "created", address: BENEFICIARY, amount: 1000n, ledger: 100 }),
    mockEvent({ topicSym: "contrib", address: CONTRIBUTOR, amount: 400n, ledger: 101 }),
    mockEvent({ topicSym: "released", address: BENEFICIARY, amount: 400n, ledger: 102 }),
  ];

  const getEvents = t.mock.method(StellarSdk.rpc.Server.prototype, "getEvents", async (params) => {
    assert.equal(params.startLedger, 500 - 17280 > 0 ? 500 - 17280 : 1);
    assert.equal(params.filters[0].contractIds[0], CONTRACT_ID);
    return { events };
  });

  const history = await getPoolHistory(CONTRACT_ID, { limit: 20 });

  assert.equal(getEvents.mock.callCount(), 1);
  assert.equal(history.length, 3);

  // Newest first: the ledger-102 "released" event comes before the
  // ledger-100 "created" event.
  assert.equal(history[0].type, "released");
  assert.equal(history[0].address, BENEFICIARY);
  assert.equal(history[0].amount, 400);
  assert.equal(history[0].ledger, 102);

  assert.equal(history[1].type, "contributed");
  assert.equal(history[1].address, CONTRIBUTOR);
  assert.equal(history[1].amount, 400);

  assert.equal(history[2].type, "created");
  assert.equal(history[2].amount, 1000);
});
