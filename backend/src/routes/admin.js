import { Router } from "express";
import Campaign from "../models/Campaign.js";
import Charity from "../models/Charity.js";
import Bill from "../models/Bill.js";
import { chain, referenceHash, normalAddress, validTransaction, hasEvent, billStatuses } from "../services/chain.js";
import { asyncRoute, fail, requireAuth, roles } from "../middleware/auth.js";
const router = Router();
router.use(requireAuth, roles("admin"));
router.get("/charities", asyncRoute(async (_req, res) => res.json({
  charities: await Charity.find().populate("user", "name email walletAddress").sort({ createdAt: -1 })
})));
router.patch("/charities/:id", asyncRoute(async (req, res) => {
  if (!["approved", "rejected"].includes(req.body.status)) throw fail(400, "Invalid decision");
  const charity = await Charity.findById(req.params.id);
  if (!charity) throw fail(404, "Charity not found");
  if (charity.status !== "pending") throw fail(409, "Already reviewed");
  charity.status = req.body.status;
  charity.reviewerNote = String(req.body.reviewerNote || "").slice(0, 300);
  await charity.save();
  res.json({ charity });
}));
router.get("/campaigns", asyncRoute(async (_req, res) => res.json({
  campaigns: await Campaign.find().populate({ path: "charity", populate: { path: "user", select: "name walletAddress" } }).sort({ createdAt: -1 })
})));
router.post("/campaigns/:id/publish", asyncRoute(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id).populate({ path: "charity", populate: { path: "user" } });
  if (!campaign) throw fail(404, "Campaign not found");
  if (campaign.status !== "pending" || campaign.chainCampaignId) throw fail(409, "Campaign already processed");
  if (campaign.charity.status !== "approved" || !campaign.charity.user.walletAddress) throw fail(400, "Charity is not verified");
  if (!/^[1-9]\d*$/.test(String(req.body.chainCampaignId || ""))) throw fail(400, "Invalid blockchain campaign ID");
  const id = BigInt(req.body.chainCampaignId);
  if (id <= 0n) throw fail(400, "Invalid blockchain campaign ID");
  const receipt = await validTransaction(req.body.txHash, req.user.walletAddress);
  if (normalAddress(receipt.from) !== normalAddress(await chain.admin())) throw fail(403, "Only on-chain admin may publish");
  const onchain = await chain.getCampaign(id);
  const matches = normalAddress(onchain.fundraiser) === normalAddress(campaign.charity.user.walletAddress)
    && onchain.referenceHash === referenceHash(campaign)
    && onchain.goal === BigInt(campaign.goalWei)
    && onchain.deadline === BigInt(Math.floor(campaign.deadline.getTime()/1000));
  if (!matches || !hasEvent(receipt, "CampaignCreated", args => args.campaignId === id && args.referenceHash === referenceHash(campaign)))
    throw fail(400, "On-chain campaign does not match the approved proposal");
  campaign.status = "published";
  campaign.chainCampaignId = id.toString();
  campaign.txHash = receipt.hash;
  await campaign.save();
  res.json({ campaign });
}));
router.patch("/campaigns/:id/reject", asyncRoute(async (req, res) => {
  const campaign = await Campaign.findById(req.params.id);
  if (!campaign) throw fail(404, "Campaign not found");
  if (campaign.status !== "pending") throw fail(409, "Campaign already processed");
  campaign.status = "rejected";
  campaign.reviewerNote = String(req.body.reviewerNote || "").slice(0, 300);
  await campaign.save();
  res.json({ campaign });
}));
router.get("/bills", asyncRoute(async (_req, res) => res.json({
  bills: await Bill.find({ chainBillId: { $ne: null } }).populate({ path: "campaign", populate: { path: "charity", select: "organizationName" } }).sort({ createdAt: -1 })
})));
router.post("/bills/:id/review", asyncRoute(async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill || bill.chainBillId == null) throw fail(404, "Blockchain bill not found");
  if (bill.review?.transactionHash) throw fail(409, "Review already recorded");
  const campaign = await Campaign.findById(bill.campaign);
  const approve = req.body.approve === true;
  const checks = req.body.checks || {};
  if (approve && !["authenticity", "purpose", "amount", "duplicate"].every(k => checks[k] === true))
    throw fail(400, "All bill verification criteria must be checked");
  const receipt = await validTransaction(req.body.txHash, req.user.walletAddress);
  if (normalAddress(receipt.from) !== normalAddress(await chain.verifier()) ||
    !hasEvent(receipt, "BillReviewed", args => args.campaignId === BigInt(campaign.chainCampaignId)
      && args.billId === BigInt(bill.chainBillId) && args.approved === approve))
    throw fail(400, "Verifier transaction does not match bill decision");
  const record = await chain.getBill(campaign.chainCampaignId, bill.chainBillId);
  if (Number(record.status) !== (approve ? 1 : 2)) throw fail(400, "On-chain bill status does not match review");
  bill.status = billStatuses[Number(record.status)];
  bill.review = {
    checkedAuthenticity: checks.authenticity === true,
    checkedPurpose: checks.purpose === true,
    checkedAmount: checks.amount === true,
    checkedDuplicate: checks.duplicate === true,
    decision: approve ? "approved" : "rejected", reviewer: req.user.id,
    reviewedAt: new Date(), transactionHash: receipt.hash
  };
  await bill.save();
  res.json({ bill });
}));
export default router;
