import type { Metadata } from "next";
import { PerpsTerminal } from "@/components/PerpsTerminal";
import { HL_BUILDER_FEE_PCT } from "@/lib/monetize";

export const metadata: Metadata = {
  title: "Perps — KRIPTO NR.1 🚀",
  description:
    "Trade perpetual futures on Hyperliquid with up to 50× leverage — non-custodial, CEX-grade speed.",
};

export default function PerpsPage() {
  return (
    <main className="pPage">
      <div className="pPageHead">
        <h1 className="pPageTitle">
          Perps <span className="pPageSub">· powered by Hyperliquid</span>
        </h1>
        <span className="pFeeBadge">BUILDER FEE {HL_BUILDER_FEE_PCT}</span>
      </div>
      <PerpsTerminal />
    </main>
  );
}
