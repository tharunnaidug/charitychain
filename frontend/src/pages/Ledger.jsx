import React, { useEffect, useState } from "react";
import { Blocks, ShieldCheck, Search, ArrowUpRight, Copy, Download } from "lucide-react";
import { DEPLOYED, readContract, eth, shorten } from "../lib/chain";
import { Notice, Spinner, Empty, Status, Tag } from "../components/Common";
const events = [
  { name: "DonationReceived", label: "Donation" },
  { name: "BillSubmitted", label: "Bill submitted" },
  { name: "BillReviewed", label: "Bill reviewed" },
  { name: "FundsWithdrawn", label: "Verified withdrawal" },
  { name: "RefundClaimed", label: "Donor refund" },
  { name: "CampaignCancelled", label: "Campaign cancelled" }
];
export default function Ledger() {
  const [rows, setRows] = useState([]), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  async function load() {
    setLoading(true); setError("");
    try {
      if (!DEPLOYED) throw new Error("Deploy the contract and start the Hardhat node first.");
      const cc = readContract();
      const logs = await Promise.all(events.map(async e => {
        const entries = await cc.queryFilter(cc.filters[e.name](), 0, "latest");
        return entries.map(x => ({ type: e.name, label: e.label, hash: x.transactionHash, block: x.blockNumber,
          campaignId: x.args.campaignId?.toString() || "—", amount: x.args.amount ?? null,
          actor: x.args.donor || x.args.fundraiser || "", billId: x.args.billId?.toString() || "" }));
      }));
      setRows(logs.flat().sort((a,b)=>b.block-a.block).slice(0,150));
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => {load();}, []);
  const filtered=rows.filter(e=>filter==="All"||e.label===filter);
  function downloadReport() {
    const cell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["Event", "Campaign ID", "Amount (ETH)", "Wallet", "Bill ID", "Transaction Hash", "Block"];
    const data = filtered.map(r => [r.label, r.campaignId, r.amount == null ? "" : eth(r.amount), r.actor, r.billId, r.hash, r.block]);
    const csv = [header, ...data].map(row => row.map(cell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href=url; a.download="charitychain-ledger.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return <div className="container page-pad"><div className="page-intro"><div className="eyebrow">PUBLIC BLOCKCHAIN EXPLORER</div><h1>Proof, not promises.</h1><p>A transparent audit trail of every donation, bill decision, approved withdrawal, and claimed refund. These records come directly from contract events.</p></div>
    <div className="ledger-banner"><div className="ledger-led"><Blocks size={32}/></div><div><h3>Immutable transaction log</h3><p>Events are verifiable locally while the Hardhat network is running. Restarting the ephemeral node resets this demo ledger.</p></div><Tag tone="green"><span className="green-dot"/> Local chain 31337</Tag></div>
    <Notice text={error} type="error"/>
    <div className="panel"><div className="panel-head"><div><h2>On-chain activity</h2><p>{rows.length} most recent recorded actions</p></div><div className="table-actions"><select className="plain-select" value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{events.map(e=><option key={e.name}>{e.label}</option>)}</select><button className="btn btn-sm btn-outline" disabled={!filtered.length} onClick={downloadReport}><Download size={15}/> Export CSV</button><button className="btn btn-sm btn-outline" onClick={load}>Refresh</button></div></div>
      {loading ? <Spinner/> : filtered.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Event</th><th>Campaign</th><th>Amount</th><th>Wallet / bill</th><th>Transaction</th><th>Block</th></tr></thead><tbody>{filtered.map((e,i)=><tr key={`${e.hash}-${e.type}-${i}`}><td><span className="event-label">{e.label}</span></td><td>#{e.campaignId}</td><td>{e.amount != null ? `${eth(e.amount)} ETH` : "—"}</td><td className="mono">{e.billId ? `Bill #${e.billId}` : shorten(e.actor, 8)}</td><td><button className="table-link mono" title="Copy transaction hash" onClick={()=>navigator.clipboard.writeText(e.hash)}>{shorten(e.hash, 10)} <Copy size={13}/></button></td><td className="mono">{e.block}</td></tr>)}</tbody></table></div> : <Empty title="No blockchain activity yet" body="Make a donation or approve a bill to populate this ledger."/>}
    </div><div className="admin-guidance"><ShieldCheck size={20}/><p>On-chain records prove payments, approvals and timing. They cannot independently prove that off-chain goods were delivered or that an invoice was genuine. The administrator performs those checks before approving withdrawal.</p></div>
  </div>;
}
