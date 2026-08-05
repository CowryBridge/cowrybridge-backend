import { test } from "node:test";
import assert from "node:assert/strict";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  listPools,
  getPool,
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
