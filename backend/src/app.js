import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { optionalAuth } from "./middleware/auth.js";
import auth from "./routes/auth.js";
import charities from "./routes/charities.js";
import campaigns from "./routes/campaigns.js";
import bills from "./routes/bills.js";
import admin from "./routes/admin.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
// Vite deliberately binds to 127.0.0.1. Browsers treat localhost and 127.0.0.1
// as DIFFERENT origins, so allow both local spellings for the student demo.
const localOrigins = (process.env.CORS_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173")
  .split(",").map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => {
  if (!origin || localOrigins.includes(origin)) return callback(null, true);
  return callback(Object.assign(new Error(`CORS blocked origin ${origin}`), { status: 403 }));
}}));
app.use(express.json({ limit: "100kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 150, standardHeaders: "draft-7", legacyHeaders: false }));
app.use(optionalAuth);
app.get("/api/health", (_req, res) => res.json({ status: "ok", system: "CharityChain" }));
app.use("/api/auth", auth);
app.use("/api/charities", charities);
app.use("/api/campaigns", campaigns);
app.use("/api/bills", bills);
app.use("/api/admin", admin);
app.use((_req, _res, next) => next(Object.assign(new Error("Endpoint not found"), { status: 404 })));
app.use((err, _req, res, _next) => {
  if (err.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "File must be 5MB or smaller" });
  if (err.code === 11000) return res.status(409).json({ error: "Duplicate record" });
  if (err.name === "CastError") return res.status(400).json({ error: "Invalid identifier" });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? "Server error; check backend terminal" : err.message });
});
export default app;
