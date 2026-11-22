import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export const fail = (status, message) => Object.assign(new Error(message), { status });

export const optionalAuth = asyncRoute(async (req, _res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.sub);
    } catch { /* Public pages must still work with an expired token. */ }
  }
  next();
});
export const requireAuth = (req, _res, next) => req.user ? next() : next(fail(401, "Please log in"));
export const roles = (...allowed) => (req, _res, next) => allowed.includes(req.user?.role)
  ? next() : next(fail(403, "Not authorized"));
