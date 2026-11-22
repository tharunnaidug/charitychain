/**
 * Local-only demo accounts. Creates records if missing. Never resets wallets or passwords
 * for existing users. Uses public Hardhat default addresses, NOT private keys.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ethers } from "ethers";
import User from "../models/User.js";
import Charity from "../models/Charity.js";
import Campaign from "../models/Campaign.js";

if (process.env.NODE_ENV === "production") {
  throw new Error("Demo seed is disabled in production");
}
await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/charitychain");
const password = "12345678";
const accounts = [
  ["Demo Admin", "demo-admin@charitychain.local", "admin", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"],
  ["BMSCE", "bmsce@charitychain.local", "charity", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"],
  ["Suhas", "suhasegowda@gmail.com", "donor", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"],
  ["Demo Donor B", "demo-donor-b@charitychain.local", "donor", "0x90F79bf6EB2c4f870365E785982E1f101E93b906"]
];
try {
  for (const [name, email, role, address] of accounts) {
    let u = await User.findOne({ email });
    if (!u) {
      u = await User.create({ name, email, role,
        passwordHash: await bcrypt.hash(password, 12), walletAddress: ethers.getAddress(address) });
      console.log("Created", email);
    } else {
      console.log("Already exists (unchanged):", email);
    }
  }
  const fundraiser = await User.findOne({ email: "bmsce@charitychain.local" });
  let charity = await Charity.findOne({ user: fundraiser.id });
  if (!charity) {
    charity = await Charity.create({ user: fundraiser.id, organizationName: "Demo Education Foundation",
      mission: "Demonstrate transparent test ETH fundraising for educational materials.", status: "approved",
      registrationNumber: "DEMO-ONLY" });
  }
  let pending = await Campaign.findOne({ charity: charity.id, status: "pending" });
  if (!pending) {
    pending = await Campaign.create({ charity: charity.id, title: "Demo Books for Students",
      category: "Education", summary: "Buy school books with verified donations and invoice approvals.",
      story: "This fictional campaign demonstrates transparent donation escrow, bill verification, conditional release and pro-rata donor refunds using free test ETH on the Hardhat local blockchain.",
      goalWei: ethers.parseEther("10").toString(),
      deadline: new Date((Math.floor(Date.now()/1000) + 30 * 86400) * 1000),
      status: "pending" });
    console.log("Created demo campaign proposal:", pending.title);
  }
  console.log("\nLOCAL DEMO LOGINS (never use for real funds):");
  for (const [_, email, role, address] of accounts) console.log(role.padEnd(8), email, "wallet:", address);
  console.log("Password for newly created accounts:", password);
  console.log("Admin approves the pending demo campaign via /admin using Hardhat Account #0.");
} finally { await mongoose.disconnect(); }
