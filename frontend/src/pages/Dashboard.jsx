import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Wallet, HandCoins, Clock3, ArrowUpRight, ArrowRight, Link2, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { DEPLOYED, readContract, eth, shorten, refundOpen } from "../lib/chain";
import { useAuth } from "../lib/useAuth";
import { useWallet } from "../lib/useWallet";
import { Empty, Notice, Spinner, Stat, Status } from "../components/Common";
export default function Dashboard() {
  const { user } = useAuth(), { address, matching, connect, link } = useWallet();
  const [chainNow, setChainNow] = useState(Math.floor(Date.now()/1000));
  const [records, setRecords] = useState([]), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  async function refresh() {
    if (!address || !DEPLOYED) { setBusy(false); return; }
    setBusy(true);
    try {
      const { campaigns } = await api("/campaigns");
      const cc = readContract();
      const block = await cc.runner.provider.getBlock("latest");
      setChainNow(Number(block.timestamp));
      const results = await Promise.all(campaigns.map(async campaign => {
        try {
        const [contribution, chain, claimed, quote] = await Promise.all([
          cc.donations(campaign.chainCampaignId, address), cc.getCampaign(campaign.chainCampaignId),
          cc.refundClaimed(campaign.chainCampaignId, address), cc.getRefundQuote(campaign.chainCampaignId, address)
        ]);
        return { campaign, contribution, chain, claimed, quote };
        } catch { return null; } // Skip stale campaigns from a previous Hardhat reset.
      }));
      setRecords(results.filter(r => r && r.contribution > 0n));
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  useEffect(() => { refresh(); }, [address]);
  async function handle(fn) { setActionBusy(true); setError(""); try { await fn(); await refresh(); } catch (e) { setError(e.message); } finally { setActionBusy(false); } }
  const total = records.reduce((a,b) => a + b.contribution, 0n);
  const available = records.reduce((a,b) => a + (refundOpen(b.chain,chainNow) && !b.claimed ? b.quote : 0n), 0n);
  return <div className="container page-pad"><div className="page-intro dashboard-intro"><div className="eyebrow">DONOR PORTAL</div><h1>Welcome back, {user?.name?.split(" ")[0]}.</h1><p>Your generosity, tracked from donation to final expense.</p></div>
    <Notice text={error} type="error"/>
    {!address && <div className="connect-panel"><Wallet size={31}/><div><h3>Connect your wallet to see your donations</h3><p>Choose the Hardhat donor account in MetaMask to read its on-chain donation history.</p></div><button className="btn btn-primary" onClick={() => handle(connect)}>Connect MetaMask <ArrowRight size={17}/></button></div>}
    {address && !matching && !user?.walletAddress && <div className="connect-panel"><Link2 size={28}/><div><h3>Link this wallet to your profile</h3><p>A free message signature proves this address belongs to you.</p></div><button className="btn btn-outline" onClick={() => handle(link)}>Sign & link</button></div>}
    <div className="stats-grid"><Stat title="Total donated" value={`${eth(total)} ETH`} sub="Confirmed on blockchain" icon={HandCoins}/><Stat title="Campaigns supported" value={records.length} sub="Your verified causes" icon={Wallet}/><Stat title="Refunds claimable" value={`${eth(available)} ETH`} sub="Unused funds after deadline" icon={RotateCcw}/></div>
    <div className="panel"><div className="panel-head"><div><h2>Your donation history</h2><p>All balances are read directly from the local blockchain.</p></div><Link to="/campaigns" className="inline-link">Support another cause <ArrowUpRight size={16}/></Link></div>
      {busy ? <Spinner/> : !address ? <Empty title="Connect your wallet" body="Your donations appear here after MetaMask is connected."/> : records.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Campaign</th><th>Your donation</th><th>Refund status</th><th>Details</th></tr></thead><tbody>{records.map(r => <tr key={r.campaign._id}><td><strong>{r.campaign.title}</strong><small>{r.campaign.charity?.organizationName}</small></td><td>{eth(r.contribution)} ETH</td><td>{r.claimed ? <Status value="paid"/> : refundOpen(r.chain,chainNow) ? <span className="green-text">{eth(r.quote)} ETH available</span> : <span className="muted">Locked until deadline</span>}</td><td><Link className="table-link" to={`/campaigns/${r.campaign._id}`}>View <ArrowUpRight size={15}/></Link></td></tr>)}</tbody></table></div> : <Empty title="No donations yet" body="When you donate with this wallet, your contributions will be displayed here." action={<Link className="btn btn-outline" to="/campaigns">Browse campaigns <ArrowRight size={17}/></Link>}/>}
    </div>
  </div>;
}
