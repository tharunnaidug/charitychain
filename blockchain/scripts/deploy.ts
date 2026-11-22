import { network, artifacts } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const { ethers, networkName } = await network.create();
const contract = await ethers.deployContract("CharityEscrow");
await contract.waitForDeployment();
const address = await contract.getAddress();
const code = await ethers.provider.getCode(address);
if (code === "0x") throw new Error("Deployment has no runtime code. Check Hardhat terminal.");
const verifiedAdmin = await contract.admin();
const verifiedVerifier = await contract.verifier();
const verifiedCount = await contract.campaignCount();
if (verifiedCount !== 0n) throw new Error("Unexpected nonempty campaign counter after deployment");
const [deployer] = await ethers.getSigners();
const artifact = await artifacts.readArtifact("CharityEscrow");
const chainId = Number((await ethers.provider.getNetwork()).chainId);

// The frontend and backend receive the SAME ABI/address, preventing mismatches.
for (const folder of ["../frontend/src/contracts", "../backend/src/config"]) {
  const destination = resolve(process.cwd(), folder);
  mkdirSync(destination, { recursive: true });
  writeFileSync(resolve(destination, "CharityEscrow.json"), JSON.stringify({ abi: artifact.abi }, null, 2));
  writeFileSync(resolve(destination, "deployment.json"), JSON.stringify({ address, chainId }, null, 2));
}
console.log(`Deployed on ${networkName} (${chainId})`);
console.log(`Contract: ${address}`);
console.log(`Deployer: ${deployer.address}`);
console.log(`Verified admin: ${verifiedAdmin}; verifier: ${verifiedVerifier}`);
console.log(`Chain campaign count: ${verifiedCount}`);
console.log("ABI and deployment files copied to frontend and backend.");
