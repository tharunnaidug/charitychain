/** Increase Hardhat's local clock to demonstrate 30-day refunds immediately. */
const days = Number(process.argv[2] || 31);
if (!Number.isFinite(days) || days <= 0 || days > 366) throw new Error("Provide 1-366 days");
async function rpc(method, params=[]) {
  const res = await fetch("http://127.0.0.1:8545", {method:"POST", headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
  const response = await res.json();
  if (response.error) throw new Error(response.error.message);
  return response.result;
}
const chain = Number(BigInt(await rpc("eth_chainId")));
if (chain !== 31337) throw new Error("Refusing to modify a non-local network");
await rpc("evm_increaseTime", [Math.floor(days * 86400)]);
await rpc("evm_mine");
console.log(`Advanced local Hardhat clock ${days} days. Eligible donors can now claim refunds.`);
