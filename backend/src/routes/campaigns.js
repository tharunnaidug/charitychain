import { Router } from "express";
import { ethers } from "ethers";
import Campaign from "../models/Campaign.js";
import Charity from "../models/Charity.js";
import { asyncRoute, fail, requireAuth, roles } from "../middleware/auth.js";
const router = Router();
const enrich = q => q.populate({ path: "charity", populate: { path: "user", select: "name walletAddress" } });
router.get("/", asyncRoute(async (_req, res) => {
  res.json({ campaigns: await enrich(Campaign.find({ status: "published" }).sort({ createdAt: -1 })) });
}));
router.get("/mine", requireAuth, roles("charity"), asyncRoute(async (req, res) => {
  const charity = await Charity.findOne({ user: req.user.id });
  res.json({ campaigns: charity ? await enrich(Campaign.find({ charity: charity.id }).sort({ createdAt: -1 })) : [] });
}));
router.get("/:id", asyncRoute(async (req, res) => {
  const campaign = await enrich(Campaign.findById(req.params.id));
  if (!campaign || campaign.status !== "published") throw fail(404, "Campaign not found");
  res.json({ campaign });
}));
router.post("/", requireAuth, roles("charity"), asyncRoute(async (req, res) => {
  const charity = await Charity.findOne({ user: req.user.id, status: "approved" });
  if (!charity) throw fail(403, "Charity must be approved first");
  const { title, category, summary, story, goalEth, durationDays } = req.body;
  if (typeof title !== "string" || title.trim().length < 5 || title.length > 120 ||
      typeof summary !== "string" || summary.trim().length < 12 || summary.length > 230 ||
      typeof story !== "string" || story.trim().length < 30 || story.length > 3200 ||
      !["Education", "Healthcare", "Food", "Environment", "Community", "Other"].includes(category))
    throw fail(400, "Complete all campaign information");
  let goalWei;
  try { goalWei = ethers.parseEther(String(goalEth)); } catch { throw fail(400, "Enter a valid ETH goal"); }
  const days = Number(durationDays);
  if (goalWei <= 0n || goalWei > ethers.parseEther("10000") || !Number.isInteger(days) || days < 1 || days > 365)
    throw fail(400, "Goal or duration out of range");
  // Stored at exact second precision for on-chain equality.
  const deadline = new Date((Math.floor(Date.now()/1000) + days * 86400) * 1000);
  const campaign = await Campaign.create({ charity: charity.id, title: title.trim(), category, summary: summary.trim(),
    story: story.trim(), goalWei: goalWei.toString(), deadline });
  res.status(201).json({ campaign });
}));
export default router;
