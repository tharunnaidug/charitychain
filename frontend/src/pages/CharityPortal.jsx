import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, PlusCircle, FileUp, Wallet, Check, ArrowUpRight, FileCheck2, HandCoins, Link2, Clock, RefreshCcw } from "lucide-react";
import { api, openEvidence } from "../lib/api";
import { readContract, writeContract, eventFromReceipt, eth, shorten, isOpen } from "../lib/chain";
import { useAuth } from "../lib/useAuth";
import { useWallet } from "../lib/useWallet";
import { Empty, Notice, Spinner, Status } from "../components/Common";
import { prettyDate } from "../components/format";
const emptyCampaign = { title: "", category: "Education", summary: "", story: "", goalEth: "5", durationDays: 30 };
const emptyBill = { purpose: "", amountEth: "0.2", file: null };
export default function CharityPortal() {
  const { user } = useAuth(), { address, matching, link, connect } = useWallet();
  const [charity, setCharity] = useState(null), [campaigns, setCampaigns] = useState([]), [selected, setSelected] = useState("");
  const [bills, setBills] = useState([]), [form, setForm] = useState({ organizationName: "", mission: "", registrationNumber: "" });
  const [campaignForm, setCampaignForm] = useState(emptyCampaign), [billForm, setBillForm] = useState(emptyBill);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [success, setSuccess] = useState("");
  const current = campaigns.find(c => c._id === selected);
  async function refresh() {
    const [organization, list] = await Promise.all([api("/charities/mine"), api("/campaigns/mine")]);
    setCharity(organization.charity); setCampaigns(list.campaigns);
    if (!selected && list.campaigns.length) setSelected(list.campaigns[0]._id);
  }
  async function refreshBills(campaignId) {
    if (!campaignId) { setBills([]); return; }
    const result = await api(`/bills?campaignId=${campaignId}`);
    setBills(result.bills);
  }
  useEffect(() => { refresh().catch(e => setError(e.message)).finally(() => setLoading(false)); }, []);
  useEffect(() => { refreshBills(selected).catch(e => setError(e.message)); }, [selected]);
  async function run(fn, message = "Completed successfully") {
    setBusy(true); setError(""); setSuccess("");
    try { await fn(); await refresh(); await refreshBills(selected); setSuccess(message); }
    catch (e) { setError(e.shortMessage || e.reason || e.message); }
    finally { setBusy(false); }
  }
  async function sendApplication(e) { e.preventDefault(); await run(() => api("/charities/apply", { method: "POST", body: form }), "Application submitted for administrator review."); }
  async function createCampaign(e) { e.preventDefault(); await run(async () => {
    const r = await api("/campaigns", { method: "POST", body: campaignForm });
    setSelected(r.campaign._id); setCampaignForm(emptyCampaign);
  }, "Campaign submitted. The admin must approve and deploy it on-chain."); }
  async function postOnChain(bill) {
    const cc = await writeContract();
    const tx = await cc.submitBill(current.chainCampaignId, bill.documentHash, BigInt(bill.amountWei));
    const receipt = await tx.wait();
    const args = eventFromReceipt(cc, receipt, "BillSubmitted");
    await api(`/bills/${bill._id}/link`, { method: "POST", body: { chainBillId: args.billId.toString(), txHash: receipt.hash } });
  }
  async function uploadBill(e) { e.preventDefault(); await run(async () => {
    if (!billForm.file) throw new Error("Select a bill file first");
    const formData = new FormData();
    formData.append("campaignId", current._id); formData.append("purpose", billForm.purpose);
    formData.append("amountEth", billForm.amountEth); formData.append("file", billForm.file);
    const { bill } = await api("/bills", { method: "POST", body: formData });
    await postOnChain(bill);
    setBillForm(emptyBill);
    const fileInput = document.getElementById("bill-file"); if (fileInput) fileInput.value = "";
  }, "Bill uploaded and recorded on the blockchain. Await admin verification."); }
  async function withdraw(bill) { await run(async () => {
    const cc = await writeContract();
    await (await cc.withdrawApprovedBill(current.chainCampaignId, bill.chainBillId)).wait();
    await api(`/bills/${bill._id}/sync`, { method: "POST" });
  }, "Verified funds withdrawn and recorded on-chain."); }
  if (loading) return <div className="container page-pad"><Spinner/></div>;
  return <div className="container page-pad"><div className="page-intro dashboard-intro"><div className="eyebrow">FUNDRAISER PORTAL</div><h1>Make an impact. Show the proof.</h1><p>Manage your charity's campaigns, submit expense evidence, and unlock only verified funds.</p></div>
    <Notice text={error} type="error"/><Notice text={success} type="success"/>
    {!matching && <div className="connect-panel"><Wallet size={27}/><div><h3>Verify your charity's wallet</h3><p>{address ? `Connected: ${shorten(address, 10)}. Link it with a free signature.` : "Connect the fundraiser Hardhat account in MetaMask."}</p></div><button className="btn btn-primary" onClick={() => run(address && !user?.walletAddress ? link : connect, "Wallet connection checked. Select the wallet linked to this charity.")}>{address && !user?.walletAddress ? "Sign & link wallet" : "Check wallet"}</button></div>}
    {!charity ? <div className="panel narrow-panel"><h2><Building2 size={22}/> Register your organization</h2><p>Submit your details for admin approval. Your verified MetaMask address will receive approved withdrawals.</p><form className="form-stack" onSubmit={sendApplication}><label>Organization name<input required minLength={3} maxLength={140} value={form.organizationName} onChange={e => setForm({...form,organizationName:e.target.value})}/></label><label>Mission and purpose<textarea required minLength={15} rows={4} maxLength={1600} value={form.mission} onChange={e => setForm({...form,mission:e.target.value})}/></label><label>Registration number (optional for local demo)<input value={form.registrationNumber} onChange={e => setForm({...form,registrationNumber:e.target.value})}/></label><button disabled={busy || !matching} className="btn btn-primary">Submit for verification <ArrowUpRight size={17}/></button></form></div> : <>
      <div className="org-banner"><div className="org-avatar"><Building2 size={29}/></div><div className="org-content"><div className="eyebrow">YOUR ORGANIZATION</div><h2>{charity.organizationName}</h2><p>{charity.mission}</p><span className="mono">Wallet: {shorten(user.walletAddress, 12)}</span></div><Status value={charity.status}/></div>
      {charity.status === "pending" ? <div className="panel"><Empty title="Verification in progress" body="The platform administrator must approve your organization before campaigns can be created."/></div> : charity.status === "rejected" ? <Notice type="error" text={`Application rejected. ${charity.reviewerNote || "Contact the administrator."}`}/> : <>
        <div className="portal-columns"><div className="panel"><h2><PlusCircle size={20}/> Create a fundraising campaign</h2><p>Campaigns must be approved and deployed by the administrator.</p><form className="form-stack" onSubmit={createCampaign}>
          <label>Campaign title<input required minLength={5} maxLength={120} value={campaignForm.title} onChange={e=>setCampaignForm({...campaignForm,title:e.target.value})} placeholder="Books for every classroom"/></label>
          <label>Category<select value={campaignForm.category} onChange={e=>setCampaignForm({...campaignForm,category:e.target.value})}>{["Education","Healthcare","Food","Environment","Community","Other"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Short summary<input required minLength={12} maxLength={230} value={campaignForm.summary} onChange={e=>setCampaignForm({...campaignForm,summary:e.target.value})}/></label>
          <label>Detailed story<textarea required minLength={30} maxLength={3200} rows={4} value={campaignForm.story} onChange={e=>setCampaignForm({...campaignForm,story:e.target.value})}/></label>
          <div className="input-row"><label>Goal (test ETH)<input type="number" step="0.01" min="0.01" required value={campaignForm.goalEth} onChange={e=>setCampaignForm({...campaignForm,goalEth:e.target.value})}/></label><label>Deadline (days)<input type="number" min={1} max={365} required value={campaignForm.durationDays} onChange={e=>setCampaignForm({...campaignForm,durationDays:Number(e.target.value)})}/></label></div>
          <button className="btn btn-primary" disabled={busy}>Submit campaign <ArrowUpRight size={17}/></button>
        </form></div>
        <div className="panel"><h2><HandCoins size={21}/> Your campaigns</h2><p>Click a campaign to manage its invoices and payouts.</p>{campaigns.length ? <div className="portal-campaign-list">{campaigns.map(c=><button key={c._id} className={`portal-campaign ${selected === c._id ? "selected" : ""}`} onClick={()=>setSelected(c._id)}><div><strong>{c.title}</strong><small>Goal {eth(c.goalWei)} ETH · Due {prettyDate(c.deadline)}</small></div><Status value={c.status}/></button>)}</div> : <Empty title="No campaigns" body="Your submitted campaigns will appear here."/>}</div></div>
        {current && <div className="panel">
          <div className="panel-head">
            <div><h2>Campaign information</h2><p>Review the complete details of your selected campaign.</p></div>
            <Status value={current.status}/>
          </div>
          <h3>{current.title}</h3>
          <p><strong>Category:</strong> {current.category}</p>
          <p><strong>Summary:</strong> {current.summary}</p>
          <p><strong>Full story:</strong> {current.story}</p>
          <p><strong>Funding goal:</strong> {eth(current.goalWei)} ETH</p>
          <p><strong>Deadline:</strong> {prettyDate(current.deadline)}</p>
          {current.status === "published" && <Link className="btn btn-outline" to={`/campaigns/${current._id}`}>View full campaign, donors and transactions <ArrowUpRight size={17}/></Link>}
        </div>}
        {current && <div className="panel"><div className="panel-head"><div><h2><FileCheck2 size={22}/> Bill submission & fund release</h2><p>For: <strong>{current.title}</strong>. Each uploaded bill must be approved by an independent on-chain verifier.</p></div><Status value={current.status}/></div>
          {current.status !== "published" ? <div className="notice">This campaign is awaiting admin review. Invoices can be submitted after on-chain publication.</div> : <div className="portal-columns"><form className="form-stack" onSubmit={uploadBill}>
            <label>Expense purpose<input required minLength={8} maxLength={350} placeholder="Purchase of textbooks for students" value={billForm.purpose} onChange={e=>setBillForm({...billForm,purpose:e.target.value})}/></label>
            <label>Invoice amount (test ETH)<input required type="number" step="0.00001" min="0.00001" value={billForm.amountEth} onChange={e=>setBillForm({...billForm,amountEth:e.target.value})}/></label>
            <label>Bill or receipt (PDF, JPG, PNG, max 5 MB)<input id="bill-file" type="file" required accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setBillForm({...billForm,file:e.target.files?.[0] || null})}/></label>
            <button className="btn btn-primary" disabled={busy || !matching}><FileUp size={17}/> Upload & submit to blockchain</button>
            <small className="muted">Only use fictional or redacted evidence for the public demo. SHA-256 of the file is recorded on chain.</small>
          </form><div className="instruction-card"><h3>How withdrawal approval works</h3><div><span>1</span> Submit a bill with an amount.</div><div><span>2</span> Admin reviews authenticity and purpose.</div><div><span>3</span> Smart contract reserves approved ETH.</div><div><span>4</span> You withdraw once, before the deadline.</div><div className="instruction-note"><Clock size={17}/> Unused money remains refundable after expiry.</div></div></div>}
          <div className="portal-bills"><h3>Submitted bills</h3>{bills.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Expense</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>{bills.map(b=><tr key={b._id}><td><strong>{b.purpose}</strong><small>{shorten(b.documentHash, 12)}</small></td><td>{eth(b.amountWei)} ETH</td><td><Status value={b.status}/></td><td><div className="table-actions"><button className="table-link" onClick={()=>run(()=>openEvidence(b._id, b.documentHash),"Evidence opened")}>Evidence</button>{b.status === "draft" && <button disabled={busy || !matching || current.status !== "published"} className="table-link" onClick={()=>run(()=>postOnChain(b),"Bill submitted on-chain")}>Retry submission</button>}{b.status === "approved" && <button disabled={busy || !matching} className="btn btn-sm btn-primary" onClick={()=>withdraw(b)}>Withdraw</button>}{b.chainBillId != null && <button className="small-icon" title="Refresh blockchain status" onClick={()=>run(()=>api(`/bills/${b._id}/sync`,{method:"POST"}),"Bill status refreshed")}><RefreshCcw size={15}/></button>}</div></td></tr>)}</tbody></table></div> : <Empty title="No bill uploads yet" body="Your uploaded receipts and payment status will appear here."/>}</div>
        </div>}
      </>}
    </>}
  </div>;
}
