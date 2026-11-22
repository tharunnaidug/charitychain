import React, { useEffect, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { api } from "../lib/api";
import { DEPLOYED, readContract } from "../lib/chain";
import { CampaignCard, Empty, Notice, SectionTitle, Spinner } from "../components/Common";
export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]), [stats, setStats] = useState({});
  const [q, setQ] = useState(""), [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    api("/campaigns").then(async r => {
      setCampaigns(r.campaigns);
      if (DEPLOYED) {
        try { const cc = readContract(); const entries = await Promise.all(r.campaigns.map(async c => {
          try { return [c._id, await cc.getCampaign(c.chainCampaignId)]; }
          catch { return [c._id, null]; }
        }));
        setStats(Object.fromEntries(entries.filter(([_, value]) => value !== null)));
        if (entries.some(([_, value]) => value === null)) {
          setError("Some MongoDB campaigns belong to an older Hardhat run. Use a newly published campaign or reconcile demo data.");
        } }
        catch { setError("Blockchain is unavailable. Start the Hardhat node to see live balances."); }
      }
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  const filtered = campaigns.filter(c => (category === "All" || c.category === category) && (c.title + " " + c.summary + " " + c.charity?.organizationName).toLowerCase().includes(q.toLowerCase()));
  return <div className="container page-pad"><div className="page-intro"><div className="eyebrow">DISCOVER OPPORTUNITIES</div><h1>Find a cause to believe in.</h1><p>Every campaign has a transparent donation history and funds controlled by smart-contract rules.</p></div>
    <div className="filter-bar"><label className="search-field"><Search size={19}/><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search charities and causes..."/></label>
    <label className="category-select"><SlidersHorizontal size={18}/><select value={category} onChange={e => setCategory(e.target.value)}>{["All","Education","Healthcare","Food","Environment","Community","Other"].map(x => <option key={x}>{x}</option>)}</select></label></div>
    <Notice text={error} type="error"/>
    {loading ? <Spinner/> : filtered.length ? <><div className="results-caption">Showing {filtered.length} verified campaign{filtered.length !== 1 ? "s" : ""}</div><div className="campaign-grid">{filtered.map(c => <CampaignCard key={c._id} campaign={c} chainData={stats[c._id]} />)}</div></> : <Empty title="No matching campaigns" body="Try another category, or ask an organization to submit a campaign."/>}
  </div>;
}
