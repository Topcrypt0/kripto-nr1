"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import type { WidgetConfig } from "@lifi/widget";
import { ChainType, createConfig, getChains } from "@lifi/sdk";
import {
  convertExtendedChain,
  syncWagmiConfig,
} from "@lifi/wallet-management";
import type { Chain } from "viem";
import { config as wagmiConfig, connectors } from "@/lib/wagmi";
import { LIFI_FEE, LIFI_INTEGRATOR } from "@/lib/monetize";

// The LI.FI widget touches window at module scope — client-only import.
const LiFiWidget = dynamic(
  () => import("@lifi/widget").then((m) => m.LiFiWidget),
  {
    ssr: false,
    loading: () => <div className="pLoading">Loading swap…</div>,
  },
);

// Every quote requested through the widget carries our integrator id + fee.
// Fees accumulate in LI.FI's FeeCollector contract per chain and are claimed
// at https://portal.li.fi under the same integrator string.
//
// Wallet handling: the widget (v3) detects the app's WagmiProvider above it
// and switches to external wallet management automatically, so the NavBar
// connection (Base Account / injected / Farcaster mini-app) is reused.
const config: Partial<WidgetConfig> = {
  integrator: LIFI_INTEGRATOR,
  feeConfig: {
    name: "KRIPTO NR.1",
    fee: LIFI_FEE,
  },
  appearance: "dark",
  // Default slippage tolerance (1.5%). LI.FI's 0.5% default is too tight for
  // thin/new routes (e.g. Robinhood Chain), causing "slippage conditions not
  // met" at execution. Users can still tune this in the widget settings.
  slippage: 0.015,
  // Sync form state with URL params so other pages can deep-link prefilled
  // swaps (e.g. /swap?toChain=42161&toToken=0x… from the perps funding flow).
  buildUrl: true,
  theme: {
    palette: {
      primary: { main: "#e8442b" },
      secondary: { main: "#f5b50a" },
      background: {
        default: "#0a0f26",
        paper: "#101736",
      },
    },
    shape: {
      borderRadius: 16,
      borderRadiusSecondary: 12,
    },
    typography: {
      fontFamily: '"Space Grotesk", system-ui, sans-serif',
    },
    container: {
      border: "1px solid rgba(255,255,255,.09)",
      borderRadius: "24px",
      boxShadow: "0 22px 60px rgba(0,0,0,.55)",
    },
  },
};

/**
 * Merge LI.FI's full chain list into the app's wagmi config so the widget can
 * switch the wallet to ANY chain LI.FI supports — including new ones not
 * hardcoded in lib/wagmi.ts (e.g. Robinhood Chain). Runs only on the swap
 * page (the only place it matters). Static chains stay first; extras are
 * appended with the RPC LI.FI reports. Fails quietly if LI.FI is unreachable.
 */
function useSyncLifiChains() {
  useEffect(() => {
    let cancelled = false;
    createConfig({ integrator: LIFI_INTEGRATOR });
    getChains({ chainTypes: [ChainType.EVM] })
      .then((lifiChains) => {
        if (cancelled || !lifiChains?.length) return;
        const ownIds = new Set<number>(wagmiConfig.chains.map((c) => c.id));
        const extra = lifiChains
          .filter((c) => !ownIds.has(c.id))
          .map(convertExtendedChain);
        if (!extra.length) return;
        const merged = [...wagmiConfig.chains, ...extra] as [Chain, ...Chain[]];
        syncWagmiConfig(wagmiConfig, connectors, merged);
      })
      .catch(() => {
        /* LI.FI unreachable — static chains still work */
      });
    return () => {
      cancelled = true;
    };
  }, []);
}

export function SwapWidget() {
  useSyncLifiChains();
  return <LiFiWidget integrator={LIFI_INTEGRATOR} config={config} />;
}
