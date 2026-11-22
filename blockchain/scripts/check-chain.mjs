import { ethers } from "ethers";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const file = JSON.parse(await readFile(resolve("../frontend/src/contracts/deployment.json"), "utf8"));
const artifact = JSON.parse(await readFile(resolve("../frontend/src/contracts/CharityEscrow.json"), "utf8"));
const rpc = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
try {
  const network = await rpc.getNetwork();
  console.log("Network chain ID:", network.chainId.toString());
  console.log("Saved chain ID:", file.chainId);
  console.log("Contract:", file.address);
  const code = await rpc.getCode(file.address);
  console.log("Contract exists:", code !== "0x");
  if (network.chainId !== BigInt(file.chainId)) throw new Error("MetaMask or RPC uses the wrong network");
  if (code === "0x") throw new Error("Contract not deployed: run npm run deploy after starting Hardhat");
  const contract = new ethers.Contract(file.address, artifact.abi, rpc);
  console.log("Admin wallet:", await contract.admin());
  console.log("Bill verifier:", await contract.verifier());
  const count = await contract.campaignCount();
  console.log("On-chain campaign count:", count.toString());
  for (let id = 1n; id <= count; id++) {
    const c = await contract.getCampaign(id);
    console.log(`Campaign #${id}: fundraiser=${c.fundraiser}, escrow=${ethers.formatEther(c.escrowBalance)} test ETH`);
  }
  console.log("OK: Hardhat is reachable and current deployment is readable.");
} catch (err) {
  console.error("BLOCKCHAIN CHECK FAILED:", err.shortMessage || err.reason || err.message);
  process.exitCode = 1;
} finally { rpc.destroy(); }
