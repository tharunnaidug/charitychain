import mongoose from "mongoose";
const schema = new mongoose.Schema({
  charity: { type: mongoose.Schema.Types.ObjectId, ref: "Charity", required: true },
  title: { type: String, required: true, maxlength: 120 },
  category: { type: String, enum: ["Education", "Healthcare", "Food", "Environment", "Community", "Other"], required: true },
  summary: { type: String, required: true, maxlength: 230 },
  story: { type: String, required: true, maxlength: 3200 },
  goalWei: { type: String, required: true },
  deadline: { type: Date, required: true },
  status: { type: String, enum: ["pending", "published", "rejected"], default: "pending" },
  chainCampaignId: { type: String, unique: true, sparse: true },
  txHash: { type: String, default: "" },
  reviewerNote: { type: String, default: "" }
}, { timestamps: true });
export default mongoose.model("Campaign", schema);
