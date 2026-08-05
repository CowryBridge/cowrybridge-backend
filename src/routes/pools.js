import { Router } from "express";
import { listPools, getPool } from "../lib/poolService.js";

const router = Router();

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

export default router;
