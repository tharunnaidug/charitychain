import { ethers } from "ethers";
import abiFile from "../config/CharityEscrow.json" with { type: "json" };
import deployment from "../config/deployment.json" with { type: "json" };
import { fail } from "../middleware/auth.js";

export const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
export const chain = new ethers.Contract(deployment.address, abiFile.abi, provider);
// Commitment binds the approved campaign description, fundraiser and deadline.
// Delimit fields with U+001F so a value cannot merge into an adjacent field.
export const referenceHash = campaign => ethers.id([
  "CharityChain/v1", String(campaign._id), campaign.title, campaign.category,
  campaign.summary, campaign.story, String(campaign.goalWei),
  String(Math.floor(new Date(campaign.deadline).getTime() / 1000)),
  campaign.charity.user.walletAddress.toLowerCase()
].join("\u001f"));
export const normalAddress = value => ethers.getAddress(value).toLowerCase();
export async function validTransaction(hash, expectedSender) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash || "")) throw fail(400, "Invalid transaction hash");
  const code = await provider.getCode(deployment.address);
  if (code === "0x") throw fail(503, "Contract is missing from the running local blockchain; re-deploy and restart backend and frontend");
  const receipt = await provider.getTransactionReceipt(hash);
  if (!receipt || receipt.status !== 1 || !receipt.to || normalAddress(receipt.to) !== normalAddress(deployment.address))
    throw fail(400, "Transaction is missing, failed or targets another contract");
  if (expectedSender && normalAddress(receipt.from) !== normalAddress(expectedSender))
    throw fail(400, "Transaction sender does not match linked wallet");
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== Number(deployment.chainId)) throw fail(400, "Wrong blockchain network");
  return receipt;
}
export function hasEvent(receipt, name, predicate) {
  return receipt.logs.some(log => {
    try {
      if (normalAddress(log.address) !== normalAddress(deployment.address)) return false;
      const event = chain.interface.parseLog(log);
      return event?.name === name && predicate(event.args);
    } catch { return false; }
  });
}
export const billStatuses = ["pending", "approved", "rejected", "paid"];
