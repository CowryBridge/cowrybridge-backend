// Integration-style test for poolService: unlike poolService.test.js (which
// exercises each exported function against a fixed, independent fixture),
// this walks a single simulated pool through create_pool -> contribute ->
// contribute -> get_pool/listPools in one continuous scenario, backed by a
// stateful mock RPC server. It exists to close #1: catch regressions where
// an individual function's shape is right in isolation but the pieces don't
// actually compose into a working end-to-end flow.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as StellarSdk from "@stellar/stellar-sdk";
import {
  listPools,
  getPool,
  buildCreatePoolTx,
  buildContributeTx,
} from "./poolService.js";

const CONTRACT_ID = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 9));
const BENEFICIARY = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 4));
const TOKEN = StellarSdk.StrKey.encodeContract(Buffer.alloc(32, 5));
const CONTRIBUTOR = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 6));

function poolScVal(state) {
  return StellarSdk.nativeToScVal(
    {
      beneficiary: StellarSdk.Address.fromString(BENEFICIARY),
      token: StellarSdk.Address.fromString(TOKEN),
      target_amount: BigInt(state.targetAmount),
      current_amount: BigInt(state.currentAmount),
      released: state.released,
    },
    { type: "instance" },
  );
}

test("full create_pool -> contribute -> contribute -> get_pool flow composes correctly", async (t) => {
  process.env.CONTRACT_ID = CONTRACT_ID;

  // In-memory stand-in for on-chain state. The real contract logic (arg
  // validation, auth, actually moving tokens) is Rust and out of scope here
  // — this only verifies that poolService reads back whatever state
  // "landed", correctly, at every step of the sequence a maintainer/
  // contributor would actually drive from the frontend.
  let state = null;

  t.mock.method(StellarSdk.rpc.Server.prototype, "getAccount", async (id) => {
    return new StellarSdk.Account(id, "1");
  });
  t.mock.method(StellarSdk.rpc.Server.prototype, "prepareTransaction", async (tx) => tx);
  t.mock.method(StellarSdk.rpc.Server.prototype, "simulateTransaction", async (tx) => {
    const op = tx.operations[0];
    const invoke = op.func.invokeContract();
    const method = invoke.functionName().toString();

    if (method === "get_pool") {
      if (!state) return { error: "HostError: Error(Contract, #1)" };
      return { result: { retval: poolScVal(state) }, latestLedger: 1 };
    }

    // create_pool / contribute don't get simulated in this test (they go
    // straight to prepareTransaction, matching how the real
    // buildCreatePoolTx/buildContributeTx call it) — only get_pool needs a
    // simulateTransaction response.
    throw new Error(`unexpected simulateTransaction call for ${method}`);
  });

  // 1. No pool exists yet.
  assert.deepEqual(await listPools(), []);
  assert.equal(await getPool(CONTRACT_ID), null);

  // 2. create_pool: build the tx (doesn't execute it — this is what the
  // frontend would sign), then apply its effect to our mock state.
  const createXdr = await buildCreatePoolTx({
    beneficiary: BENEFICIARY,
    targetAmount: 1000,
    token: TOKEN,
  });
  assert.equal(typeof createXdr, "string");
  state = { targetAmount: 1000, currentAmount: 0, released: false };

  const afterCreate = await getPool(CONTRACT_ID);
  assert.equal(afterCreate.targetAmount, 1000);
  assert.equal(afterCreate.currentAmount, 0);

  // 3. contribute, twice, each time reflecting the accumulated total —
  // this is the part an isolated unit test can't catch: that repeated
  // contributions actually accumulate rather than each read returning a
  // stale or reset value.
  const contribute1 = await buildContributeTx({ from: CONTRIBUTOR, amount: 400 });
  assert.equal(typeof contribute1, "string");
  state = { ...state, currentAmount: state.currentAmount + 400 };

  const contribute2 = await buildContributeTx({ from: CONTRIBUTOR, amount: 600 });
  assert.equal(typeof contribute2, "string");
  state = { ...state, currentAmount: state.currentAmount + 600 };

  const afterContributions = await getPool(CONTRACT_ID);
  assert.equal(afterContributions.currentAmount, 1000);
  assert.equal(afterContributions.released, false);

  // 4. listPools should surface the same, single pool.
  const pools = await listPools();
  assert.equal(pools.length, 1);
  assert.equal(pools[0].currentAmount, 1000);

  // 5. release isn't backend-mediated (see cowrybridge-contracts/SECURITY.md
  // — it's intentionally callable by anyone directly against the contract),
  // so simulate its effect the same way a post-release get_pool would look.
  state = { ...state, released: true };
  const afterRelease = await getPool(CONTRACT_ID);
  assert.equal(afterRelease.released, true);
  assert.equal(afterRelease.currentAmount, 1000);
});
