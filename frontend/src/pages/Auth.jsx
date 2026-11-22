import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, ArrowRight, LockKeyhole, Mail, UserRound, Building2, Heart } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { Notice } from "../components/Common";
export default function Auth({ register = false }) {
  const { login, register: createUser } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "donor" });
  const [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const navigate = useNavigate(), location = useLocation();
  const change = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const u = register ? await createUser(form.name, form.email, form.password, form.role) : await login(form.email, form.password);
      navigate(location.state?.from || (u.role === "admin" ? "/admin" : u.role === "charity" ? "/charity" : "/dashboard"));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-aside"><div className="auth-aside-inner"><ShieldCheck size={36}/><h2>When giving is transparent, everyone wins.</h2><p>Verified charity campaigns. Smart contract protection. Real transaction evidence.</p><div className="auth-proof"><LockKeyhole size={21}/><span>Your money follows the rules, not promises.</span></div></div></div>
    <div className="auth-form-side"><div className="auth-panel"><div className="eyebrow">WELCOME TO CHARITYCHAIN</div><h1>{register ? "Join a better way to give." : "Welcome back."}</h1><p>{register ? "Create a free account to support or manage a verified cause." : "Log in to continue your transparent giving journey."}</p>
      <Notice text={error} type="error"/><form onSubmit={submit} className="form-stack">
        {register && <><div className="role-picker"><label className={form.role === "donor" ? "selected" : ""}><input type="radio" name="role" value="donor" checked={form.role === "donor"} onChange={change}/><Heart size={21}/><strong>I'm a donor</strong></label><label className={form.role === "charity" ? "selected" : ""}><input type="radio" name="role" value="charity" checked={form.role === "charity"} onChange={change}/><Building2 size={21}/><strong>I'm a charity</strong></label></div><label>Full name<input required minLength={2} maxLength={100} name="name" value={form.name} onChange={change} placeholder="Your full name" /></label></>}
        <label>Email address<input required type="email" name="email" value={form.email} onChange={change} placeholder="you@example.com" autoComplete="email" /></label>
        <label>Password<input required type="password" minLength={register ? 8 : undefined} name="password" value={form.password} onChange={change} placeholder="Enter password" autoComplete={register ? "new-password" : "current-password"}/></label>
        <button className="btn btn-primary full" disabled={busy}>{busy ? "Please wait..." : register ? "Create account" : "Log in"}<ArrowRight size={17}/></button>
      </form><div className="auth-alt">{register ? "Already have an account?" : "New to CharityChain?"} <Link to={register ? "/login" : "/register"}>{register ? "Log in" : "Create an account"}</Link></div><p className="auth-warning">Local test project only. Never enter real-money wallet recovery phrases.</p>
    </div></div>
  </div>;
}
