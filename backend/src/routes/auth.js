import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { ethers } from "ethers";
import User from "../models/User.js";
import Charity from "../models/Charity.js";
import { asyncRoute, fail, requireAuth } from "../middleware/auth.js";

const router = Router();
const sign = user => jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "12h" });

router.post("/register", asyncRoute(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 100 ||
      typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      typeof password !== "string" || password.length < 8 || password.length > 120 ||
      !["donor", "charity"].includes(role)) throw fail(400, "Invalid registration details");
  if (await User.exists({ email: email.toLowerCase().trim() })) throw fail(409, "Email already registered");
  const user = await User.create({ name: name.trim(), email: email.toLowerCase().trim(),
    passwordHash: await bcrypt.hash(password, 12), role });
  res.status(201).json({ token: sign(user), user });
}));

router.post("/login", asyncRoute(async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || "").toLowerCase().trim() }).select("+passwordHash");
  if (!user || !await bcrypt.compare(String(req.body.password || ""), user.passwordHash))
    throw fail(401, "Invalid email or password");
  res.json({ token: sign(user), user });
}));
router.get("/me", requireAuth, asyncRoute(async (req, res) => res.json({ user: req.user })));

router.post("/wallet/challenge", requireAuth, asyncRoute(async (req, res) => {
  let address;
  try { address = ethers.getAddress(req.body.address); } catch { throw fail(400, "Invalid wallet address"); }
  const applied = await Charity.findOne({ user: req.user.id, status: "approved" });
  if (applied && req.user.walletAddress && req.user.walletAddress.toLowerCase() !== address.toLowerCase())
    throw fail(403, "Approved charity wallet cannot be changed");
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const message = `CharityChain local wallet link\nUser: ${req.user.id}\nWallet: ${address}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}\nOnly sign this message on your local demo website.`;
  req.user.walletChallenge = { address, message, expiresAt };
  await req.user.save();
  res.json({ message });
}));
router.post("/wallet/verify", requireAuth, asyncRoute(async (req, res) => {
  const challenge = req.user.walletChallenge;
  if (!challenge?.message || !challenge.expiresAt || challenge.expiresAt < new Date())
    throw fail(400, "Request a fresh wallet challenge");
  let recovered;
  try { recovered = ethers.verifyMessage(challenge.message, req.body.signature); }
  catch { throw fail(400, "Invalid signature"); }
  if (recovered.toLowerCase() !== challenge.address.toLowerCase()) throw fail(403, "Wallet signature mismatch");
  req.user.walletAddress = ethers.getAddress(recovered);
  req.user.walletChallenge = undefined;
  await req.user.save();
  res.json({ user: req.user });
}));
export default router;
