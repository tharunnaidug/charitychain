import mongoose from "mongoose";
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["donor", "charity", "admin"], required: true },
  walletAddress: { type: String, default: null },
  walletChallenge: {
    address: String,
    message: String,
    expiresAt: Date
  }
}, { timestamps: true });
schema.set("toJSON", { transform: (_doc, result) => {
  delete result.passwordHash;
  delete result.walletChallenge;
  delete result.__v;
  return result;
}});
export default mongoose.model("User", schema);
