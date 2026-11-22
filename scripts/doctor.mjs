/** No npm dependencies required. Run from root: npm run doctor */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { connect } from "node:net";
const root = process.cwd();
const state={issues:0};
const ok = (name,message) => console.log(`  OK    ${name}: ${message}`);
const warn = (name,message) => { state.issues++; console.log(`  CHECK ${name}: ${message}`); };
const file = relative => resolve(root,relative);
async function rpc(method, params=[]) {
  const response = await fetch("http://127.0.0.1:8545", {method:"POST",headers:{"content-type":"application/json"}, body:JSON.stringify({jsonrpc:"2.0",id:1,method,params}),signal:AbortSignal.timeout(2000)});
  const data = await response.json();
  if(data.error) throw new Error(data.error.message);
  return data.result;
}
async function portOpen(port) {
  return new Promise(resolve=>{
    const socket=connect({host:"127.0.0.1",port});
    socket.setTimeout(1200);
    socket.once("connect",()=>{socket.destroy(); resolve(true)});
    socket.once("error",()=>resolve(false));
    socket.once("timeout",()=>{socket.destroy();resolve(false)});
  });
}
console.log("\nCharityChain local setup doctor\n");
const major = Number(process.versions.node.split(".")[0]);
major >= 22 ? ok("Node.js",process.version) : warn("Node.js",`${process.version}; install Node 22.13+ or 24 LTS`);
for(const sub of ["blockchain","backend","frontend"]) {
  existsSync(file(`${sub}/node_modules`)) ? ok(`${sub} dependencies`,"installed") : warn(`${sub} dependencies`,`missing: cd ${sub} && npm install`);
}
const envpath=file("backend/.env");
if(existsSync(envpath)){
  const body=readFileSync(envpath,"utf8");
  if(/JWT_SECRET=(?!replace_with)[^\r\n]{32,}/.test(body)) ok("backend .env","JWT secret configured");
  else warn("backend .env","set a unique JWT_SECRET with 32+ characters");
} else warn("backend .env","missing: cd backend; Copy-Item .env.example .env");
if(await portOpen(27017))ok("MongoDB","port 27017 is accepting connections");
else warn("MongoDB","not listening on 127.0.0.1:27017; start MongoDB Server service");
const deployPath=file("frontend/src/contracts/deployment.json");
const abiPath=file("frontend/src/contracts/CharityEscrow.json");
const deploy=JSON.parse(readFileSync(deployPath,"utf8"));
const abi=JSON.parse(readFileSync(abiPath,"utf8"));
const zero="0x0000000000000000000000000000000000000000";
const deployed=deploy.address !== zero && Array.isArray(abi.abi) && abi.abi.length > 0;
if(!deployed)warn("Deployment artifacts","placeholder ABI/address: start node, then cd blockchain && npm run deploy");
else ok("Deployment artifacts",deploy.address);
try{
  const id=Number(BigInt(await rpc("eth_chainId")));
  if(id===31337)ok("Hardhat RPC",`running on chain ${id}`);
  else warn("Hardhat RPC",`wrong chain ${id}, expected 31337`);
  if(deployed) {
    const code=await rpc("eth_getCode",[deploy.address,"latest"]);
    code && code!=="0x" ? ok("Contract on chain","bytecode found") : warn("Contract on chain","no code at saved address; run npm run deploy again");
  }
} catch(e){warn("Hardhat RPC",`not ready at 127.0.0.1:8545 (${e.message}); run cd blockchain && npm run node`);}
for(const [name,url] of [["Backend API","http://127.0.0.1:5000/api/health"],["Frontend","http://127.0.0.1:5173"]]){
  try{const response=await fetch(url,{signal:AbortSignal.timeout(1500)});
    response.ok ? ok(name,`reachable (${response.status})`) : warn(name,`HTTP ${response.status}`);
  } catch { warn(name,`not running; see READ_ME_FIRST.md`); }
}
console.log(`\n${state.issues ? `${state.issues} setup items to check (normal during first install)` : "All checks passed"}.\n`);
process.exitCode=state.issues ? 1 : 0;
