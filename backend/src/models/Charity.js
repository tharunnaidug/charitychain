import mongoose from "mongoose";
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  organizationName: { type: String, required: true, maxlength: 140 },
  mission: { type: String, required: true, maxlength: 1600 },
  registrationNumber: { type: String, default: "" },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  reviewerNote: { type: String, default: "" }
}, { timestamps: true });
export default mongoose.model("Charity", schema);
