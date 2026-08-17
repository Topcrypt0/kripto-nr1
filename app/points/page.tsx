import type { Metadata } from "next";
import { PointsDashboard } from "@/components/PointsDashboard";

export const metadata: Metadata = {
  title: "Points — KRIPTO NR.1 🚀",
  description:
    "Earn KRIPTO points on every swap, bridge, perp trade, Earn deposit and rocket launch. Climb the leaderboard, invite friends, unlock private group access and token reward pools.",
};

export default function PointsPage() {
  return (
    <main className="pPage ptPage">
      <div className="pPageHead">
        <h1 className="pPageTitle">
          KRIPTO <span className="accent">Points</span>
        </h1>
        <span className="pFeeBadge">TRADE · EARN · CLIMB</span>
      </div>
      <p className="pPageSub ptIntro">
        Everything you do on the terminal pays. Points accrue by volume across
        swap, bridge, perps, Earn and the rocket — then convert into private
        group access, token reward pools and fee rebates.
      </p>
      <PointsDashboard />
    </main>
  );
}
