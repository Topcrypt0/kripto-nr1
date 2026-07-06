"use client";

import dynamic from "next/dynamic";
import type { WidgetConfig } from "@lifi/widget";
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

export function SwapWidget() {
  return <LiFiWidget integrator={LIFI_INTEGRATOR} config={config} />;
}
