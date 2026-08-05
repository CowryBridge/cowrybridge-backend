import { Router } from "express";

const router = Router();

// TODO: replace with real Soroban contract reads via stellar-sdk once
// cowrybridge-contracts is deployed to testnet.
const mockPools = [
  {
    id: "pool_demo",
    beneficiary: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    targetAmount: 1000,
    currentAmount: 250,
    released: false,
  },
];

router.get("/", (_req, res) => {
  res.json(mockPools);
});

router.get("/:id", (req, res) => {
  const pool = mockPools.find((p) => p.id === req.params.id);
  if (!pool) return res.status(404).json({ error: "pool not found" });
  res.json(pool);
});

export default router;
