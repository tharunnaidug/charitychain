import React, { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { api } from "./api";
import { LOCAL_CHAIN_ID } from "./chain";
import { useAuth } from "./useAuth";
import { WalletContext } from "./wallet-context";

/** The selected address belongs to MetaMask; the linked address belongs to the website user. */
export function WalletProvider({ children }) {
  const { user, setUser } = useAuth();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(null);

  const refreshWallet = useCallback(async () => {
    if (!window.ethereum) { setAddress(""); setChainId(null); return ""; }
    const [accounts, networkHex] = await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" })
    ]);
    const selected = accounts?.[0] ? ethers.getAddress(accounts[0]) : "";
    setAddress(selected);
    setChainId(Number(BigInt(networkHex)));
    return selected;
  }, []);

  useEffect(() => {
    if (!window.ethereum) return;
    const update = () => refreshWallet().catch(console.error);
    update();
    window.ethereum.on?.("accountsChanged", update);
    window.ethereum.on?.("chainChanged", update);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", update);
      window.ethereum.removeListener?.("chainChanged", update);
    };
  }, [refreshWallet]);

  async function connect() {
    if (!window.ethereum) throw new Error("Install MetaMask browser extension first.");
    await window.ethereum.request({ method: "eth_requestAccounts" });
    const selected = await refreshWallet();
    if (!selected) throw new Error("No MetaMask account is authorized for this website.");
    const networkHex = await window.ethereum.request({ method: "eth_chainId" });
    if (Number(BigInt(networkHex)) !== LOCAL_CHAIN_ID) {
      throw new Error(`Switch MetaMask to Localhost 8545 (chain ${LOCAL_CHAIN_ID}).`);
    }
    return selected;
  }

  async function switchAccount() {
    if (!window.ethereum) throw new Error("Install MetaMask first.");
    await window.ethereum.request({
      method: "wallet_requestPermissions",
      params: [{ eth_accounts: {} }]
    });
    return refreshWallet();
  }

  async function link() {
    if (!user) throw new Error("Log in before linking a wallet.");
    const selected = await connect();
    if (user.walletAddress && user.walletAddress.toLowerCase() !== selected.toLowerCase()) {
      throw new Error(`Website user is already linked to ${user.walletAddress}. Switch MetaMask account instead of relinking.`);
    }
    const challenge = await api("/auth/wallet/challenge", {
      method: "POST", body: { address: selected }
    });
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    const signer = await browserProvider.getSigner(selected);
    const signature = await signer.signMessage(challenge.message);
    const verified = await api("/auth/wallet/verify", {
      method: "POST", body: { signature }
    });
    setUser(verified.user);
    return selected;
  }

  const matching = Boolean(
    user?.walletAddress && address &&
    user.walletAddress.toLowerCase() === address.toLowerCase()
  );

  return (
    <WalletContext.Provider value={{
      address, chainId, connect, switchAccount, refreshWallet, link,
      matching, correctChain: chainId === LOCAL_CHAIN_ID
    }}>
      {children}
    </WalletContext.Provider>
  );
}
