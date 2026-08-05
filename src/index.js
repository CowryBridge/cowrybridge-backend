import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import poolsRouter from "./routes/pools.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use("/health", healthRouter);
app.use("/pools", poolsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`cowrybridge-backend listening on port ${config.port}`);
});
