import { Router } from "express";
import { StrKey } from "@stellar/stellar-sdk";
import { config } from "../config.js";
import {
  listPools,
  getPool,
  getPoolHistory,
  buildCreatePoolTx,
  buildContributeTx,
} from "../lib/poolService.js";

const router = Router();

function isPositiveIntegerAmount(value) {
  return Number.isInteger(value) && value > 0;
}

router.get("/", async (_req, res, next) => {
  try {
    res.json(await listPools());
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const pool = await getPool(req.params.id);
    if (!pool) return res.status(404).json({ error: "pool not found" });
    res.json(pool);
  } catch (err) {
    next(err);
  }
});

// Recent create/contribute/release activity for the pool, newest first.
router.get("/:id/history", async (req, res, next) => {
  try {
    if (!config.contractId || req.params.id !== config.contractId) {
      return res.status(404).json({ error: "pool not found" });
    }
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    res.json(await getPoolHistory(req.params.id, { limit }));
  } catch (err) {
    next(err);
  }
});

// Builds an unsigned create_pool transaction for the frontend to sign with
// the beneficiary's wallet (e.g. via Freighter) and submit itself. The
// backend never holds or sees a private key.
router.post("/", async (req, res, next) => {
  try {
    const { beneficiary, targetAmount, token } = req.body ?? {};

    if (!StrKey.isValidEd25519PublicKey(beneficiary)) {
      return res
        .status(400)
        .json({ error: "beneficiary must be a valid Stellar account address" });
    }
    if (!isPositiveIntegerAmount(targetAmount)) {
      return res.status(400).json({ error: "targetAmount must be a positive integer" });
    }
    if (!StrKey.isValidContract(token)) {
      return res.status(400).json({ error: "token must be a valid token contract address" });
    }
    if (!config.contractId) {
      return res.status(503).json({ error: "CONTRACT_ID is not configured" });
    }

    const xdr = await buildCreatePoolTx({ beneficiary, targetAmount, token });
    res.json({ xdr, networkPassphrase: config.networkPassphrase });
  } catch (err) {
    next(err);
  }
});

// Builds an unsigned contribute transaction for the frontend to sign with
// the contributor's wallet and submit itself.
router.post("/:id/contribute", async (req, res, next) => {
  try {
    if (!config.contractId || req.params.id !== config.contractId) {
      return res.status(404).json({ error: "pool not found" });
    }

    const { from, amount } = req.body ?? {};

    if (!StrKey.isValidEd25519PublicKey(from)) {
      return res.status(400).json({ error: "from must be a valid Stellar account address" });
    }
    if (!isPositiveIntegerAmount(amount)) {
      return res.status(400).json({ error: "amount must be a positive integer" });
    }

    const xdr = await buildContributeTx({ from, amount });
    res.json({ xdr, networkPassphrase: config.networkPassphrase });
  } catch (err) {
    next(err);
  }
});

export default router;
