import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const dirs = ["backend/src", "blockchain/scripts", "frontend/src/lib"];
let bad = 0, count = 0;
function walk(directory) {
  for (const entry of readdirSync(join(root, directory), {withFileTypes: true})) {
    const p = join(directory, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!/\.(js|mjs)$/.test(p)) continue;
    const result=spawnSync(process.execPath,["--check",join(root,p)],{encoding:"utf8"});
    count++;
    if(result.status !== 0) {bad++; console.error(`FAIL ${p}\n${result.stderr}`);} 
  }
}
dirs.forEach(walk);
console.log(`Checked ${count} JavaScript files: ${bad ? `${bad} failed` : 'all parse correctly'}`);
process.exitCode = bad ? 1 : 0;
