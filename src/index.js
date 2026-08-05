import "dotenv/config";
import express from "express";
import cors from "cors";
import poolsRouter from "./routes/pools.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "cowrybridge-backend" });
});

app.use("/pools", poolsRouter);

app.listen(PORT, () => {
  console.log(`cowrybridge-backend listening on port ${PORT}`);
});
