import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/useAuth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import CharityPortal from "./pages/CharityPortal";
import AdminPortal from "./pages/AdminPortal";
import Ledger from "./pages/Ledger";
import Setup from "./pages/Setup";
import { Spinner } from "./components/Common";
function RoleRoute({ role, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container page-pad"><Spinner/></div>;
  if (!user) return <Navigate to="/login" replace/>;
  if (user.role !== role) return <Navigate to="/" replace/>;
  return children;
}
export default function App() {
  return <Layout><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/campaigns" element={<Campaigns/>}/>
    <Route path="/campaigns/:id" element={<CampaignDetail/>}/>
    <Route path="/ledger" element={<Ledger/>}/>
    <Route path="/setup" element={<Setup/>}/>
    <Route path="/login" element={<Auth/>}/>
    <Route path="/register" element={<Auth register/>}/>
    <Route path="/dashboard" element={<RoleRoute role="donor"><Dashboard/></RoleRoute>}/>
    <Route path="/charity" element={<RoleRoute role="charity"><CharityPortal/></RoleRoute>}/>
    <Route path="/admin" element={<RoleRoute role="admin"><AdminPortal/></RoleRoute>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Layout>;
}
