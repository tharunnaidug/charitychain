import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  console.error("Set ADMIN_EMAIL and a strong ADMIN_PASSWORD (12+ characters) in .env");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/charitychain");
const existing = await User.findOne({ email });
if (existing && existing.role !== "admin") throw new Error("Email belongs to a non-admin user");
if (existing) console.log("Admin already exists; password was not changed.");
else {
  await User.create({ name: "Project Administrator", email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
  console.log("Local development admin created:", email);
}
await mongoose.disconnect();
