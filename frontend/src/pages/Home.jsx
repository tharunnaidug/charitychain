import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Blocks, FileCheck2, ShieldCheck, Clock3, RotateCcw, Landmark, LockKeyhole, Check, CircleDollarSign, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import { DEPLOYED, readContract } from "../lib/chain";
import { CampaignCard, SectionTitle } from "../components/Common";
export default function Home() {
  const [campaigns, setCampaigns] = useState([]);
  const [stats, setStats] = useState({});
  useEffect(() => {
    api("/campaigns").then(async ({campaigns}) => {
      setCampaigns(campaigns.slice(0, 3));
      if (!DEPLOYED) return;
      try { const cc = readContract(); const rows = await Promise.all(campaigns.slice(0, 3).map(async c => { try { return [c._id, await cc.getCampaign(c.chainCampaignId)]; } catch { return [c._id, null]; } })); setStats(Object.fromEntries(rows.filter(([, value]) => value !== null))); }
      catch { /* node not running */ }
    }).catch(() => {});
  }, []);
  return <>
    <section className="hero"><div className="container hero-grid"><div className="hero-copy">
      <div className="hero-label"><span className="pulse-dot"/> The future of accountable giving <Sparkles size={14}/></div>
      <h1>Every donation.<br/>Every expense.<br/><em>Fully accountable.</em></h1>
      <p>Support verified causes. Watch funds stay secure until bills are approved. Know exactly what happens to every test ETH you give.</p>
      <div className="hero-actions"><Link to="/campaigns" className="btn btn-primary">Explore campaigns <ArrowRight size={18}/></Link><Link to="/ledger" className="btn btn-outline-light">Explore public ledger <ArrowUpRight size={17}/></Link></div>
      <div className="hero-notes"><span><ShieldCheck size={16}/> Verified bills</span><span><LockKeyhole size={16}/> Smart contract escrow</span><span><RotateCcw size={16}/> Donor refunds</span></div>
    </div><div className="hero-graphic" aria-label="Illustrative fund protection process">
      <div className="hero-glow"/>
      <div className="floating-tag tag-left"><div className="floating-icon"><LockKeyhole size={19}/></div><div><strong>Funds secured</strong><span>On-chain escrow</span></div></div>
      <div className="hero-dashboard"><div className="visual-top"><span className="visual-dots"><i/><i/><i/></span><span>TRANSPARENT FUND FLOW</span><Blocks size={17}/></div>
        <div className="visual-core"><div className="core-symbol"><Landmark size={43}/></div><div className="core-label">DONATION ESCROW</div><strong>Funds protected<br/>by smart contract</strong></div>
        <div className="visual-flow"><span>DONOR</span><div className="dashed-line"/><span>VERIFIED BILL</span><div className="dashed-line"/><span>FUNDRAISER</span></div>
        <div className="visual-footer"><span><span className="green-dot"/> Contract active</span><span className="mono">LOCALNET · 31337</span></div>
      </div>
      <div className="floating-tag tag-right"><div className="floating-icon green"><FileCheck2 size={19}/></div><div><strong>Bill approved</strong><span>Release authorized</span></div></div>
    </div></div></section>
    <section className="trust-strip"><div className="container trust-inner"><span><ShieldCheck size={21}/> Verifiable transactions</span><span><FileCheck2 size={21}/> Evidence-first payouts</span><span><Clock3 size={21}/> Time-bound campaigns</span><span><RotateCcw size={21}/> Proportional refunds</span></div></section>
    <section className="section-pad container"><SectionTitle eyebrow="HOW CHARITYCHAIN WORKS" title="Trust is built into the process." subtitle="Donations don't go straight into a fundraiser's pocket. They're governed by rules everyone can verify." />
      <div className="feature-grid">
        <div className="feature"><div className="feature-icon violet"><CircleDollarSign/></div><span className="feature-num">01</span><h3>Donate to a cause</h3><p>Browse approved campaigns and donate test ETH from MetaMask. Your contribution is secured in a smart contract.</p></div>
        <div className="feature"><div className="feature-icon blue"><FileCheck2/></div><span className="feature-num">02</span><h3>Verify before release</h3><p>The fundraiser uploads a bill. An independent verifier checks it. Only approved bills unlock the matching funds.</p></div>
        <div className="feature"><div className="feature-icon mint"><RotateCcw/></div><span className="feature-num">03</span><h3>Get unused funds back</h3><p>If the campaign expires with an unused balance, donors can claim their proportional refunds directly on-chain.</p></div>
      </div>
    </section>
    <section className="section-pad section-muted"><div className="container"><SectionTitle eyebrow="MAKE AN IMPACT" title="Causes worth supporting" subtitle="Browse campaigns approved by the platform administrator." action={<Link to="/campaigns" className="inline-link">All campaigns <ArrowUpRight size={17}/></Link>} />
      {campaigns.length ? <div className="campaign-grid">{campaigns.map(c => <CampaignCard key={c._id} campaign={c} chainData={stats[c._id]} />)}</div> : <div className="coming-campaigns"><span className="coming-icon"><Blocks size={35}/></span><h3>Your first campaign will appear here</h3><p>Log in as a charity, submit a campaign and have the administrator publish it on-chain.</p><Link to="/register" className="btn btn-outline">Start a fundraiser <ArrowRight size={17}/></Link></div>}
    </div></section>
    <section className="container cta-section"><div className="cta"><div><div className="eyebrow">TRANSPARENCY BY DESIGN</div><h2>Because impact deserves proof.</h2><p>Don't just donate. See where the money goes, who approved the expense, and what's left to return.</p></div><Link className="btn btn-white" to="/ledger">View public ledger <ArrowRight size={17}/></Link></div></section>
  </>;
}
