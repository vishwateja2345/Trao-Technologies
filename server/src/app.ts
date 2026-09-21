import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { kitsRouter } from "./routes/kits.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "512kb" }));
  app.use(cookieParser());

  // Auth endpoints get a tighter rate limit than the rest of the API —
  // they're the most attractive target for credential stuffing.
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
  app.use("/api/auth", authLimiter, authRouter);

  const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
  app.use("/api/kits", apiLimiter, kitsRouter);

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
