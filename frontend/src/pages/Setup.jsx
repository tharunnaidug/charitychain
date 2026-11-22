import React from "react";
import { Link } from "react-router-dom";
import { Terminal, Wallet, Blocks, Info, ArrowRight } from "lucide-react";
export default function Setup() {
  return <div className="container page-pad"><div className="page-intro"><div className="eyebrow">ZERO-COST LOCAL DEVELOPMENT</div><h1>Start your own local charity blockchain.</h1><p>Everything works with free software and simulated ETH. Follow the complete README in the downloaded project folder.</p></div>
    <div className="setup-steps"><div className="panel"><div className="setup-number">1</div><h2>Install free tools</h2><p>Node.js 22.13+, VS Code, MetaMask extension and MongoDB Community Server. All are free.</p></div>
    <div className="panel"><div className="setup-number">2</div><h2>Run Hardhat</h2><pre>{`cd blockchain\nnpm install\nnpm run test\nnpm run node`}</pre><p>Keep this terminal open for the local blockchain.</p></div>
    <div className="panel"><div className="setup-number">3</div><h2>Deploy the contract</h2><pre>{`cd blockchain\nnpm run deploy`}</pre><p>This copies the real contract address and ABI into the website and backend automatically.</p></div>
    <div className="panel"><div className="setup-number">4</div><h2>Start API and website</h2><pre>{`cd backend\ncopy .env.example .env\nnpm install\nnpm run seed:demo\nnpm run dev`}</pre><pre>{`cd frontend\nnpm install\nnpm run dev`}</pre></div>
    <div className="panel"><div className="setup-number">5</div><h2>Connect demo MetaMask accounts</h2><p>Add a custom network: <code>http://127.0.0.1:8545</code> / chain ID <code>31337</code>. Import only the private keys printed by your local Hardhat node; never use them for real funds.</p></div></div>
    <div className="admin-guidance"><Info size={19}/><p>For the complete setup order, demo accounts, troubleshooting and testing checklist, read <strong>READ_ME_FIRST.md</strong> and <strong>PROJECT_CHECKLIST.md</strong> included in the ZIP file.</p></div>
    <Link className="btn btn-primary" to="/campaigns">View campaigns <ArrowRight size={17}/></Link>
  </div>;
}
