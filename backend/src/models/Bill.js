import mongoose from "mongoose";
const schema = new mongoose.Schema({
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: "Campaign", required: true },
  charityUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  purpose: { type: String, required: true, maxlength: 350 },
  amountWei: { type: String, required: true },
  documentHash: { type: String, required: true },
  storedFilename: { type: String, required: true },
  originalFilename: { type: String, required: true },
  mimeType: { type: String, required: true },
  chainBillId: { type: String, default: null },
  txHash: { type: String, default: "" },
  status: { type: String, enum: ["draft", "pending", "approved", "rejected", "paid"], default: "draft" },
  review: {
    checkedAuthenticity: Boolean,
    checkedPurpose: Boolean,
    checkedAmount: Boolean,
    checkedDuplicate: Boolean,
    reviewedAt: Date,
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    decision: String,
    transactionHash: String
  }
}, { timestamps: true });
schema.index({ campaign: 1, documentHash: 1 }, { unique: true });
schema.index({ campaign: 1, chainBillId: 1 }, { unique: true, partialFilterExpression: { chainBillId: { $type: "string" } } });
schema.set("toJSON", { transform: (_doc, result) => { delete result.storedFilename; delete result.__v; return result; } });
export default mongoose.model("Bill", schema);
