import type { Metadata } from "next";
import { PredictionMarkets } from "@/components/PredictionMarkets";

export const metadata: Metadata = {
  title: "Predictions — KRIPTO NR.1 🚀",
  description:
    "Live prediction markets — politics, crypto, sports. Powered by Polymarket.",
};

export default function PredictPage() {
  return (
    <main className="pPage">
      <div className="pPageHead">
        <h1 className="pPageTitle">
          Predictions <span className="pPageSub">· powered by Polymarket</span>
        </h1>
        <span className="pFeeBadge">LIVE ODDS</span>
      </div>
      <PredictionMarkets />
    </main>
  );
}
