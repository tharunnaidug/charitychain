import { Router } from "express";
import Charity from "../models/Charity.js";
import { asyncRoute, fail, requireAuth, roles } from "../middleware/auth.js";
const router = Router();
router.get("/mine", requireAuth, roles("charity"), asyncRoute(async (req, res) => {
  res.json({ charity: await Charity.findOne({ user: req.user.id }) });
}));
router.post("/apply", requireAuth, roles("charity"), asyncRoute(async (req, res) => {
  if (!req.user.walletAddress) throw fail(400, "Verify your MetaMask wallet before applying");
  const { organizationName, mission, registrationNumber } = req.body;
  if (typeof organizationName !== "string" || organizationName.trim().length < 3 || organizationName.length > 140 ||
      typeof mission !== "string" || mission.trim().length < 15 || mission.length > 1600)
    throw fail(400, "Organization name and mission are required");
  if (await Charity.exists({ user: req.user.id })) throw fail(409, "Application already exists");
  const charity = await Charity.create({ user: req.user.id, organizationName: organizationName.trim(),
    mission: mission.trim(), registrationNumber: String(registrationNumber || "").slice(0, 100) });
  res.status(201).json({ charity });
}));
export default router;
