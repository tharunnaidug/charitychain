import React, { useEffect, useState } from "react";
import { AuthContext } from "./auth-context";
import { api, getToken, setToken } from "./api";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  useEffect(() => {
    if (!getToken()) return;
    api("/auth/me").then(r => setUser(r.user)).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);
  async function login(email, password) {
    const r = await api("/auth/login", { method: "POST", body: { email, password } });
    setToken(r.token); setUser(r.user); return r.user;
  }
  async function register(name, email, password, role) {
    const r = await api("/auth/register", { method: "POST", body: { name, email, password, role } });
    setToken(r.token); setUser(r.user); return r.user;
  }
  function logout() { setToken(null); setUser(null); }
  return <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>{children}</AuthContext.Provider>;
}

