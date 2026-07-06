import type { Metadata } from "next";
import { SwapWidget } from "@/components/SwapWidget";
import { SwapWalletNotice } from "@/components/SwapWalletNotice";

export const metadata: Metadata = {
  title: "Swap & Bridge — KRIPTO NR.1 🚀",
  description:
    "Swap and bridge across 30+ chains at the best rate. Aggregated routes from every major DEX and bridge.",
};

export default function SwapPage() {
  return (
    <main className="pPageNarrow">
      <div className="pPageHead">
        <h1 className="pPageTitle">
          Swap <span className="accent">&amp;</span> Bridge
        </h1>
        <span className="pFeeBadge">BEST ROUTE · 30+ CHAINS</span>
      </div>
      <SwapWalletNotice />
      <div className="swapWrap">
        <SwapWidget />
      </div>
    </main>
  );
}
