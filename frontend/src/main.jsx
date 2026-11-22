import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { WalletProvider } from "./lib/wallet";
import App from "./App";
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter><AuthProvider><WalletProvider><App /></WalletProvider></AuthProvider></BrowserRouter>
  </React.StrictMode>
);
