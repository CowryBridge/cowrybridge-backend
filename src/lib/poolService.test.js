import { test } from "node:test";
import assert from "node:assert/strict";
import { listPools, getPool } from "./poolService.js";

test("listPools returns an array", async () => {
  const pools = await listPools();
  assert.ok(Array.isArray(pools));
  assert.ok(pools.length > 0);
});

test("getPool returns null for unknown id", async () => {
  const pool = await getPool("does-not-exist");
  assert.equal(pool, null);
});

test("getPool returns the matching pool", async () => {
  const pools = await listPools();
  const pool = await getPool(pools[0].id);
  assert.equal(pool.id, pools[0].id);
});
