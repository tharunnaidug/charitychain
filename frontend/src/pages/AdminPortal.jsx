import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Building2, HandCoins, FileCheck2, Wallet, CheckCircle2, XCircle, ExternalLink, ArrowUpRight, Ban, Link2 } from "lucide-react";
import { api, openEvidence } from "../lib/api";
import { writeContract, eventFromReceipt, referenceHash, eth, shorten } from "../lib/chain";
import { useAuth } from "../lib/useAuth";
import { useWallet } from "../lib/useWallet";
import { Empty, Notice, Spinner, Stat, Status } from "../components/Common";
import { prettyDate } from "../components/format";
export default function AdminPortal() {
  const { user } = useAuth(), { address, matching, link, connect } = useWallet();
  const [charities, setCharities] = useState([]), [campaigns, setCampaigns] = useState([]), [bills, setBills] = useState([]);
  const [tab, setTab] = useState("charities"), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [checks, setChecks] = useState({});
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  async function refresh() {
    const [c, p, b] = await Promise.all([api("/admin/charities"), api("/admin/campaigns"), api("/admin/bills")]);
    setCharities(c.charities); setCampaigns(p.campaigns); setBills(b.bills);
  }
  useEffect(()=>{refresh().catch(e=>setError(e.message)).finally(()=>setLoading(false));},[]);
  async function run(fn, done="Action completed") {
    setBusy(true); setError(""); setSuccess("");
    try { await fn(); await refresh(); setSuccess(done); }
    catch (e) { setError(e.shortMessage || e.reason || e.message); }
    finally { setBusy(false); }
  }
  async function authorizedContract(role) {
    const cc = await writeContract();
    const selected = await cc.runner.getAddress();
    const required = role === "admin" ? await cc.admin() : await cc.verifier();
    if (selected.toLowerCase() !== required.toLowerCase()) {
      throw new Error(`Wrong ${role} wallet. Selected ${selected}; required ${required}. Change MetaMask account and refresh.`);
    }
    return cc;
  }
  async function publish(c) {
    const cc = await authorizedContract("admin");
    const tx = await cc.createCampaign(c.charity.user.walletAddress, referenceHash(c), BigInt(c.goalWei), BigInt(Math.floor(new Date(c.deadline).getTime()/1000)));
    const receipt = await tx.wait();
    const args = eventFromReceipt(cc, receipt, "CampaignCreated");
    await api(`/admin/campaigns/${c._id}/publish`, { method: "POST", body: { chainCampaignId: args.campaignId.toString(), txHash: receipt.hash } });
  }
  async function review(b, approve) {
    const selectedChecks = checks[b._id] || {};
    if (approve && !["authenticity", "purpose", "amount", "duplicate"].every(k => selectedChecks[k]))
      throw new Error("Complete all bill verification checks before approving");
    const cc = await authorizedContract("verifier");
    const receipt = await (await cc.verifyBill(b.campaign.chainCampaignId, b.chainBillId, approve)).wait();
    await api(`/admin/bills/${b._id}/review`, {
      method: "POST", body: { approve, checks: selectedChecks, txHash: receipt.hash }
    });
  }
  function toggleCheck(id, key) {setChecks(prev => ({...prev,[id]:{...prev[id],[key]:!prev[id]?.[key]}}));}
  async function cancelCampaign(c) {
    const cc = await authorizedContract("admin");
    await (await cc.cancelCampaign(c.chainCampaignId)).wait();
  }
  return <div className="container page-pad"><div className="page-intro dashboard-intro"><div className="eyebrow">PLATFORM ADMINISTRATION</div><h1>Trust starts with verification.</h1><p>Review charity applications, approve campaigns and validate real evidence before releasing escrowed funds.</p></div>
    <Notice text={error} type="error"/><Notice text={success} type="success"/>
    {!matching && <div className="connect-panel"><Wallet size={26}/><div><h3>Connect the contract administrator account</h3><p>Use the first Hardhat account in MetaMask (the account that deployed the smart contract).</p></div><button className="btn btn-primary" disabled={busy} onClick={()=>run(address && !user?.walletAddress ? link : connect, "Wallet connection checked.")}>{address && !user?.walletAddress ? "Sign & link" : "Check wallet"}</button></div>}
    <div className="stats-grid"><Stat title="Registered charities" value={charities.length} sub={`${charities.filter(c=>c.status==="pending").length} awaiting review`} icon={Building2}/><Stat title="Campaign proposals" value={campaigns.length} sub={`${campaigns.filter(c=>c.status==="pending").length} waiting to publish`} icon={HandCoins}/><Stat title="Submitted bills" value={bills.length} sub={`${bills.filter(b=>b.status==="pending").length} require verification`} icon={FileCheck2}/></div>
    <div className="panel"><div className="tabs" role="tablist">{[["charities","Charities"],["campaigns","Campaigns"],["bills","Bill verification"]].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id ? "active" : ""} onClick={()=>setTab(id)}>{label}{id==="bills" && bills.filter(b=>b.status==="pending").length>0 && <span className="tab-count">{bills.filter(b=>b.status==="pending").length}</span>}</button>)}</div>
      {loading ? <Spinner/> : tab==="charities" ? charities.length ? <div className="admin-stack">{charities.map(c=><div key={c._id} className="review-item"><div className="review-icon"><Building2 size={22}/></div><div className="review-content"><h3>{c.organizationName}</h3><p>{c.mission}</p><small>Applicant: {c.user?.name} · {c.user?.email}</small><small>Wallet: <span className="mono">{shorten(c.user?.walletAddress, 13)}</span> · Registration: {c.registrationNumber||"Demo / not provided"}</small></div><div className="review-actions"><Status value={c.status}/>{c.status==="pending" && <><button className="btn btn-sm btn-success" disabled={busy} onClick={()=>run(()=>api(`/admin/charities/${c._id}`,{method:"PATCH",body:{status:"approved"}}),"Charity approved")}> <CheckCircle2 size={15}/> Approve</button><button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={()=>run(()=>api(`/admin/charities/${c._id}`,{method:"PATCH",body:{status:"rejected"}}),"Application rejected")}><XCircle size={15}/> Reject</button></>}</div></div>)}</div> : <Empty title="No charity applications" body="Applications submitted by fundraisers appear here."/> : tab==="campaigns" ? campaigns.length ? <div className="admin-stack">{campaigns.map(c=><div key={c._id} className="review-item"><div className="review-icon"><HandCoins size={22}/></div><div className="review-content"><h3>{c.title}</h3><p>{c.summary}</p><small>{c.charity?.organizationName} · Goal {eth(c.goalWei)} ETH · Deadline {prettyDate(c.deadline)}</small><small className="mono">Charity wallet: {shorten(c.charity?.user?.walletAddress, 12)}</small>{c.status === "published" && <Link className="inline-link" to={`/campaigns/${c._id}`}>View campaign details and donors <ArrowUpRight size={15}/></Link>}</div><div className="review-actions"><Status value={c.status}/>{c.status==="pending" && <><button className="btn btn-sm btn-success" disabled={busy || !matching} onClick={()=>run(()=>publish(c),"Campaign deployed and published on blockchain")}><CheckCircle2 size={15}/> Approve & publish</button><button className="btn btn-sm btn-danger-outline" disabled={busy} onClick={()=>run(()=>api(`/admin/campaigns/${c._id}/reject`,{method:"PATCH",body:{}}),"Campaign rejected")}><XCircle size={15}/> Reject</button></>}{c.status==="published" && <button className="btn btn-sm btn-danger-outline" disabled={busy || !matching} title="Allows immediate unused-fund refunds" onClick={()=>{if(confirm("Cancel this campaign and immediately open refunds?"))run(()=>cancelCampaign(c),"Campaign cancelled on-chain. Refunds are now eligible.");}}><Ban size={15}/> Cancel on-chain</button>}</div></div>)}</div> : <Empty title="No campaigns" body="Reviewed campaign proposals will appear here."/> : bills.length ? <div className="admin-stack">{bills.map(b=><div key={b._id} className="review-item"><div className="review-icon"><FileCheck2 size={22}/></div><div className="review-content"><h3>{b.purpose}</h3><p>{b.campaign?.title} · {b.campaign?.charity?.organizationName}</p><small>Requested: <strong>{eth(b.amountWei)} ETH</strong> · SHA-256: <span className="mono">{shorten(b.documentHash, 12)}</span></small>
          {b.status === "pending" && <div className="verification-checklist"><div className="checklist-title">Required verification checks</div>{[
            ["authenticity", "Bill is genuine and readable"],
            ["purpose", "Expense matches campaign purpose"],
            ["amount", "Amount and details match request"],
            ["duplicate", "No duplicate or reused invoice"]
          ].map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(checks[b._id]?.[key])} onChange={()=>toggleCheck(b._id,key)}/>{label}</label>)}</div>}
          <button className="table-link" onClick={()=>run(()=>openEvidence(b._id, b.documentHash),"Evidence opened in a new tab")}>Open original bill <ExternalLink size={14}/></button></div><div className="review-actions"><Status value={b.status}/>{b.status==="pending" && <><button className="btn btn-sm btn-success" disabled={busy || !matching || !["authenticity", "purpose", "amount", "duplicate"].every(k => checks[b._id]?.[k])} onClick={()=>run(()=>review(b,true),"Bill verified on-chain. Fundraiser can now withdraw.")}><CheckCircle2 size={15}/> Verify bill</button><button className="btn btn-sm btn-danger-outline" disabled={busy || !matching} onClick={()=>run(()=>review(b,false),"Bill rejected on-chain")}><XCircle size={15}/> Reject</button></>}</div></div>)}</div> : <Empty title="No submitted bills" body="Bills will appear after fundraisers record them on-chain."/>}
    </div>
    <div className="admin-guidance"><ShieldCheck size={20}/><p><strong>Verifier responsibility:</strong> Check that evidence is genuine, relevant to the campaign, not reused, and matches the requested amount. A file hash proves a document is unchanged; it does not prove the contents are truthful.</p></div>
  </div>;
}
