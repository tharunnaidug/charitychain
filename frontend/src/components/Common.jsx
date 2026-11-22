import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, FileCheck2, ShieldCheck, Timer, GraduationCap, HeartPulse, Soup, Leaf, Users, CircleHelp, CheckCircle2, AlertCircle, LoaderCircle } from "lucide-react";
import { eth } from "../lib/chain";
import { categories } from "./categories";
import { prettyDate } from "./format";

export function Notice({ text, type = "info" }) {
  if (!text) return null;
  return <div className={`notice notice-${type}`} role="status">{type === "error" ? <AlertCircle size={17}/> : <CheckCircle2 size={17}/>}<span>{text}</span></div>;
}
export const Spinner = () => <div className="loading"><LoaderCircle className="spin" size={21}/> Loading…</div>;
export function Empty({ title, body, action }) {
  return <div className="empty"><div className="empty-icon"><FileCheck2 size={25}/></div><h3>{title}</h3><p>{body}</p>{action}</div>;
}
export function Tag({ children, tone = "neutral" }) { return <span className={`tag tag-${tone}`}>{children}</span>; }
export function Status({ value }) {
  const tone = ["approved", "paid", "published", "active"].includes(value) ? "green"
    : ["rejected", "cancelled", "expired"].includes(value) ? "red"
    : ["pending", "draft"].includes(value) ? "amber" : "neutral";
  return <Tag tone={tone}>{value || "Unknown"}</Tag>;
}
export function Stat({ title, value, sub, icon: Icon }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span>{Icon && <Icon size={20}/>}</div><strong>{value}</strong>{sub && <small>{sub}</small>}</div>;
}
export function CampaignCard({ campaign, chainData }) {
  const meta = categories[campaign.category] || categories.Other;
  const Icon = meta.icon;
  const donated = chainData?.totalDonated ?? 0n;
  const goal = BigInt(campaign.goalWei || 1);
  const pct = Number(goal ? donated * 100n / goal : 0n);
  return <Link className="campaign-card" to={`/campaigns/${campaign._id}`}>
    <div className={`campaign-cover ${meta.cls}`}><span className="cover-icon"><Icon size={35}/></span><span className="cover-chip">{campaign.category}</span></div>
    <div className="campaign-body"><div className="campaign-author"><ShieldCheck size={15}/> {campaign.charity?.organizationName || "Verified organization"}</div>
      <h3>{campaign.title}</h3><p>{campaign.summary}</p>
      <div className="progress-track"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <div className="card-stats"><span><strong>{eth(donated)} ETH</strong> raised</span><span>{pct}% of {eth(goal)} ETH</span></div>
      <div className="card-bottom"><span><Timer size={14}/> Until {prettyDate(campaign.deadline)}</span><span className="link-arrow">View campaign <ArrowUpRight size={17}/></span></div>
    </div>
  </Link>;
}
export function SectionTitle({ eyebrow, title, subtitle, action }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}
