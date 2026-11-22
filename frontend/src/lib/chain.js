import { ethers } from "ethers";
import deployment from "../contracts/deployment.json";
import artifact from "../contracts/CharityEscrow.json";

export const DEPLOYED = deployment.address !== ethers.ZeroAddress && artifact.abi.length > 0;
export const LOCAL_CHAIN_ID = deployment.chainId;
const rpc = import.meta.env.VITE_RPC_URL || "http://127.0.0.1:8545";
export const shorten = (s, n = 6) => s ? `${String(s).slice(0, n)}…${String(s).slice(-4)}` : "—";
export const eth = wei => {
  if (wei == null) return "0";
  try { return Number(ethers.formatEther(wei)).toLocaleString("en-US", { maximumFractionDigits: 5 }); }
  catch { return "0"; }
};
export const referenceHash = campaign => ethers.id([
  "CharityChain/v1", String(campaign._id), campaign.title, campaign.category,
  campaign.summary, campaign.story, String(campaign.goalWei),
  String(Math.floor(new Date(campaign.deadline).getTime() / 1000)),
  campaign.charity.user.walletAddress.toLowerCase()
].join("\u001f"));
export const readContract = () => {
  if (!DEPLOYED) throw new Error("Deploy the smart contract first (see README).");
  return new ethers.Contract(deployment.address, artifact.abi, new ethers.JsonRpcProvider(rpc));
};
export async function writeContract() {
  if (!window.ethereum) throw new Error("Install MetaMask to sign transactions.");
  if (!DEPLOYED) throw new Error("Deploy the smart contract first (see README).");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== LOCAL_CHAIN_ID) throw new Error(`Choose Hardhat Localhost (chain ${LOCAL_CHAIN_ID}) in MetaMask.`);
  const code = await provider.getCode(deployment.address);
  if (code === "0x") throw new Error("The saved contract address is not deployed on this Hardhat node. Keep the node running and run 'npm run deploy' again in blockchain/; then refresh the website.");
  const signer = await provider.getSigner();
  return new ethers.Contract(deployment.address, artifact.abi, signer);
}
export function eventFromReceipt(contract, receipt, eventName) {
  for (const log of receipt.logs) {
    try { const parsed = contract.interface.parseLog(log); if (parsed?.name === eventName) return parsed.args; }
    catch { /* ignore non-contract events */ }
  }
  throw new Error(`No ${eventName} event in confirmed transaction`);
}
// Pass latest BLOCK timestamp when possible, so Hardhat time-travel demos work.
export const isOpen = (c, now = Math.floor(Date.now()/1000)) => Boolean(c && !c.cancelled && now < Number(c.deadline));
export const refundOpen = (c, now = Math.floor(Date.now()/1000)) => Boolean(c && (c.cancelled || now >= Number(c.deadline)));
