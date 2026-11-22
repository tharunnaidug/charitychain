import { Router } from "express";
import multer from "multer";
import { randomUUID, createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ethers } from "ethers";
import Bill from "../models/Bill.js";
import Campaign from "../models/Campaign.js";
import Charity from "../models/Charity.js";
import { chain, billStatuses, validTransaction, hasEvent, normalAddress } from "../services/chain.js";
import { asyncRoute, fail, requireAuth, roles } from "../middleware/auth.js";

const router = Router();
const uploadRoot = resolve("src/uploads");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mimetype))
      return done(fail(400, "Only PDF, JPG and PNG files are supported"));
    done(null, true);
  }
});
const actualFileType = (bytes) => {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return { ext: ".pdf", mime: "application/pdf" };
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext: ".png", mime: "image/png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: ".jpg", mime: "image/jpeg" };
  throw fail(400, "File contents do not match a supported format");
};
const refreshStatus = async bill => {
  if (bill.chainBillId == null) return bill;
  const campaign = await Campaign.findById(bill.campaign);
  if (!campaign?.chainCampaignId) return bill;
  const onchain = await chain.getBill(campaign.chainCampaignId, bill.chainBillId);
  bill.status = billStatuses[Number(onchain.status)];
  await bill.save();
  return bill;
};

router.get("/", asyncRoute(async (req, res) => {
  if (!req.query.campaignId) throw fail(400, "campaignId is required");
  const campaign = await Campaign.findById(req.query.campaignId);
  if (!campaign) throw fail(404, "Campaign not found");
  const myCharity = req.user?.role === "charity" ? await Charity.findOne({ user: req.user.id }) : null;
  const own = req.user?.role === "admin" || (myCharity && String(campaign.charity) === String(myCharity.id));
  const bills = await Bill.find({ campaign: campaign.id, ...(own ? {} : { chainBillId: { $ne: null } }) }).sort({ createdAt: -1 });
  // Public bill status is refreshed from the blockchain, not the browser's claim.
  await Promise.all(bills.filter(b => b.chainBillId != null).map(refreshStatus));
  res.json({ bills });
}));

router.post("/", requireAuth, roles("charity"), upload.single("file"), asyncRoute(async (req, res) => {
  const campaign = await Campaign.findById(req.body.campaignId).populate("charity");
  if (!campaign || campaign.status !== "published") throw fail(404, "Published campaign not found");
  if (String(campaign.charity.user) !== String(req.user.id)) throw fail(403, "Not your campaign");
  if (!req.file) throw fail(400, "Upload an invoice or receipt");
  const { ext, mime } = actualFileType(req.file.buffer);
  if (req.file.mimetype !== mime) throw fail(400, "File type mismatch");
  const purpose = String(req.body.purpose || "").trim();
  if (purpose.length < 8 || purpose.length > 350) throw fail(400, "Describe the expense purpose");
  let amount;
  try { amount = ethers.parseEther(String(req.body.amountEth)); } catch { throw fail(400, "Invalid ETH amount"); }
  if (amount <= 0n) throw fail(400, "Bill amount must be positive");
  const documentHash = "0x" + createHash("sha256").update(req.file.buffer).digest("hex");
  if (await Bill.exists({ campaign: campaign.id, documentHash })) throw fail(409, "That bill was already uploaded for this campaign");
  await mkdir(uploadRoot, { recursive: true });
  const storedFilename = randomUUID() + ext;
  await writeFile(join(uploadRoot, storedFilename), req.file.buffer, { flag: "wx" });
  const bill = await Bill.create({ campaign: campaign.id, charityUser: req.user.id,
    purpose, amountWei: amount.toString(), documentHash, originalFilename: req.file.originalname.slice(0, 160),
    storedFilename, mimeType: mime });
  res.status(201).json({ bill });
}));

router.post("/:id/link", requireAuth, roles("charity"), asyncRoute(async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill || String(bill.charityUser) !== String(req.user.id)) throw fail(404, "Bill not found");
  if (bill.chainBillId != null) throw fail(409, "Bill already on chain");
  const campaign = await Campaign.findById(bill.campaign);
  if (!campaign?.chainCampaignId) throw fail(400, "Campaign not deployed");
  if (!/^[1-9]\d*$/.test(String(req.body.chainBillId || ""))) throw fail(400, "Invalid blockchain bill ID");
  const billId = BigInt(req.body.chainBillId);
  if (billId <= 0n) throw fail(400, "Invalid bill ID");
  const receipt = await validTransaction(req.body.txHash, req.user.walletAddress);
  const record = await chain.getBill(campaign.chainCampaignId, billId);
  if (record.documentHash !== bill.documentHash || record.amount !== BigInt(bill.amountWei) ||
      normalAddress(record.submittedBy) !== normalAddress(req.user.walletAddress) ||
      !hasEvent(receipt, "BillSubmitted", args => args.campaignId === BigInt(campaign.chainCampaignId) && args.billId === billId && args.documentHash === bill.documentHash))
    throw fail(400, "On-chain invoice does not match uploaded evidence");
  bill.chainBillId = billId.toString();
  bill.txHash = receipt.hash;
  bill.status = "pending";
  await bill.save();
  res.json({ bill });
}));

router.post("/:id/sync", requireAuth, asyncRoute(async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill) throw fail(404, "Bill not found");
  const campaign = await Campaign.findById(bill.campaign).populate("charity");
  const canSync = req.user.role === "admin" || String(campaign.charity.user) === String(req.user.id);
  if (!canSync) throw fail(403, "Not allowed");
  await refreshStatus(bill);
  res.json({ bill });
}));

router.get("/:id/file", asyncRoute(async (req, res) => {
  const bill = await Bill.findById(req.params.id);
  if (!bill) throw fail(404, "Bill not found");
  const campaign = await Campaign.findById(bill.campaign).populate("charity");
  const owner = req.user?.role === "admin" || (req.user && String(campaign.charity.user) === String(req.user.id));
  if (!owner) {
    if (bill.chainBillId == null) throw fail(403, "Evidence is not public yet");
    await refreshStatus(bill);
    if (!["approved", "paid"].includes(bill.status)) throw fail(403, "Evidence is only public after approval");
  }
  const file = await readFile(join(uploadRoot, bill.storedFilename));
  res.set("Content-Type", bill.mimeType);
  res.set("Content-Disposition", `inline; filename="evidence${bill.mimeType === "application/pdf" ? ".pdf" : bill.mimeType === "image/png" ? ".png" : ".jpg"}"`);
  res.set("X-Content-Type-Options", "nosniff");
  res.send(file);
}));
export default router;
