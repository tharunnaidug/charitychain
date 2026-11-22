import "dotenv/config";
import mongoose from "mongoose";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("Set JWT_SECRET (at least 32 characters) in backend/.env");
  process.exit(1);
}
try {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/charitychain");
  const { default: app } = await import("./app.js");
  const port = Number(process.env.PORT || 5000);
  app.listen(port, "127.0.0.1", () => console.log(`CharityChain API: http://127.0.0.1:${port}`));
} catch (error) {
  console.error("Could not start API. Is MongoDB Community Server running?", error.message);
  process.exit(1);
}
