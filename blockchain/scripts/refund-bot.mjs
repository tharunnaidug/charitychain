/**
 * Optional free local keeper: calls processRefundForDonor after each deadline.
 * No private keys are stored: Hardhat's unlocked account #0 pays DEMO gas.
 * It only operates with the local Hardhat node (chain ID 31337).
 * Donors can ALWAYS claim directly when this bot is offline.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ethers } from "ethers";

const root = process.cwd();
const deployment = JSON.parse(readFileSync(resolve(root, "../frontend/src/contracts/deployment.json")));
const artifact = JSON.parse(readFileSync(resolve(root, "../frontend/src/contracts/CharityEscrow.json")));
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scan() {
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== 31337 || Number(deployment.chainId) !== 31337)
    throw new Error("Refund bot is restricted to the local Hardhat demo chain");
  const owner = await provider.getSigner(0);
  const contract = new ethers.Contract(deployment.address, artifact.abi, owner);
  const total = Number(await contract.campaignCount());
  const now = (await provider.getBlock("latest")).timestamp;
  for (let i=1; i<=total; i++) {
    const c = await contract.getCampaign(i);
    if (!c.cancelled && now < Number(c.deadline)) continue;
    if (c.escrowBalance === 0n) continue;
    const logs = await contract.queryFilter(contract.filters.DonationReceived(i), 0, "latest");
    const donors = [...new Set(logs.map(x => x.args.donor.toLowerCase()))];
    for (const donor of donors) {
      if (await contract.refundClaimed(i, donor)) continue;
      try {
        const tx = await contract.processRefundForDonor(i, donor);
        await tx.wait();
        console.log(`Refunded ${donor} from campaign #${i}: ${tx.hash}`);
      } catch (error) {
        console.warn(`Could not refund ${donor} for #${i}: ${error.shortMessage || error.message}`);
      }
    }
  }
}

console.log("Free local refund keeper running (30-second scans). Ctrl+C to stop.");
while (true) {
  try { await scan(); } catch (e) { console.warn("Waiting for Hardhat node and deployment:", e.message); }
  await delay(30000);
}
