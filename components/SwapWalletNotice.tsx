"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

// Chains the Base Account (Coinbase) smart wallet can actually operate on.
// Swaps FROM any other chain fail at the wallet level ("Chain not
// configured") no matter what the site supports — warn upfront.
const BASE_ACCOUNT_CHAINS = new Set([
  1, // Ethereum
  8453, // Base
  10, // Optimism
  42161, // Arbitrum
  137, // Polygon
  56, // BNB
  43114, // Avalanche
  7777777, // Zora
  84532, // Base Sepolia
]);

const SMART_WALLET_IDS = ["baseAccount", "coinbaseWalletSDK", "farcaster"];

export function SwapWalletNotice() {
  const { isConnected, connector, chainId } = useAccount();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isConnected || !connector) return null;
  if (!SMART_WALLET_IDS.includes(connector.id)) return null;

  return (
    <div className="swapNotice">
      ⚠️ You are connected with a smart wallet (Base Account). It supports
      only major networks
      {chainId && !BASE_ACCOUNT_CHAINS.has(chainId) ? " — not this one" : ""}
      : Base, Ethereum, Optimism, Arbitrum, Polygon, BNB, Avalanche. Swaps
      from other chains (e.g. Gnosis) will fail with &quot;Chain not
      configured&quot; — connect MetaMask / Rabby for those.
    </div>
  );
}
