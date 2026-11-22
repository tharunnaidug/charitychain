import React, { useState } from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import { Blocks, ArrowUpRight, Wallet, Menu, X, LogOut, UserRound, ShieldCheck, Link2, Github, ArrowLeftRight, RefreshCw } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useWallet } from "../lib/useWallet";
import { shorten, DEPLOYED } from "../lib/chain";
import { Notice } from "./Common";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { address, chainId, matching, correctChain, connect, switchAccount, refreshWallet, link } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function run(action) {
    try { setError(""); await action(); }
    catch (err) { setError(err.message); }
  }
  function exit() { logout(); setMenuOpen(false); navigate("/"); }
  const dashboard = user?.role === "admin" ? "/admin" : user?.role === "charity" ? "/charity" : "/dashboard";
  const links = [
    ["/", "Home"], ["/campaigns", "Explore"], ["/ledger", "Public ledger"],
    ...(user ? [[dashboard, "My dashboard"]] : [])
  ];
  return <div className="app-shell">
    <header className="site-header"><div className="container nav-wrap">
      <Link className="brand" to="/"><span className="brand-emblem"><Blocks size={23}/></span><span>charity<span className="brand-accent">chain</span><small>GIVE WITH PROOF</small></span></Link>
      <nav className={`nav-links ${menuOpen ? "nav-open" : ""}`}>
        {links.map(([url, label]) => <NavLink onClick={() => setMenuOpen(false)} key={url} to={url} end={url === "/"} className={({isActive}) => isActive ? "active" : ""}>{label}</NavLink>)}
      </nav>
      <div className="nav-actions">
        {user ? <div className="profile-pill"><UserRound size={15}/><span>{user.name.split(" ")[0]}</span></div> : <Link className="text-btn signin" to="/login">Log in</Link>}
        <button className={`wallet-btn ${address ? "wallet-linked" : ""}`} onClick={() => run(connect)}><Wallet size={16}/>{address ? shorten(address, 5) : "Connect wallet"}</button>
        {address && <><button type="button" className="small-icon" title="Choose another MetaMask account" aria-label="Switch MetaMask account" onClick={() => run(switchAccount)}><ArrowLeftRight size={17}/></button><button type="button" className="small-icon" title="Refresh MetaMask address" aria-label="Refresh wallet" onClick={() => run(refreshWallet)}><RefreshCw size={17}/></button></>}
        {user && address && !user.walletAddress && <button title="Sign a message to securely link this wallet to your account" onClick={() => run(link)} className="small-icon" aria-label="Link wallet"><Link2 size={17}/></button>}
        {user && <button onClick={exit} className="small-icon logout-btn" title="Log out"><LogOut size={16}/></button>}
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X/> : <Menu/>}</button>
      </div>
    </div></header>
    {error && <div className="container shell-notice"><Notice text={error} type="error"/></div>}
    {user && <div className="container session-info" aria-label="Current demo session">
      <span>Website user: <strong>{user.name} ({user.role})</strong></span>
      <span>Selected MetaMask: <strong>{shorten(address, 10)}</strong></span>
      <span>Linked user wallet: <strong>{shorten(user.walletAddress, 10)}</strong></span>
      <span>Chain: <strong>{chainId ?? "Not connected"}</strong></span>
    </div>}
    {!DEPLOYED && <div className="setup-banner"><div className="container"><ShieldCheck size={17}/> Local demo setup: deploy the smart contract first to activate on-chain features. <Link to="/setup">See setup steps <ArrowUpRight size={14}/></Link></div></div>}
    {user && address && !matching && <div className="setup-banner warn"><div className="container">Logged in as {user.name} ({user.role}), but selected wallet {shorten(address)} is not linked to this user. Switch MetaMask to the wallet linked to this user. Never relink an approved charity merely to clear this warning.</div></div>}
    {address && !correctChain && <div className="setup-banner warn"><div className="container">MetaMask is connected to a different network. Select Localhost 8545 (chain 31337).</div></div>}
    <main>{children}</main>
    <footer className="footer"><div className="container footer-inner">
      <div><Link className="brand footer-brand" to="/"><span className="brand-emblem"><Blocks size={20}/></span><span>charity<span className="brand-accent">chain</span></span></Link><p>Giving you can verify. Free local blockchain demo.</p></div>
      <div className="footer-links"><Link to="/campaigns">Discover</Link><Link to="/ledger">Public ledger</Link><Link to="/setup">Setup guide</Link></div>
      <span className="footer-credit">Built for transparency · Test ETH only · No real funds</span>
    </div></footer>
  </div>;
}
