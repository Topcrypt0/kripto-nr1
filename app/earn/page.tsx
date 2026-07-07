import type { Metadata } from "next";
import { EarnVault } from "@/components/EarnVault";

export const metadata: Metadata = {
  title: "Earn — KRIPTO NR.1 🚀",
  description:
    "Earn passive APY on your stablecoins — curated Morpho vaults and Aave lending on Base. Non-custodial, withdraw anytime.",
};

export default function EarnPage() {
  return (
    <main className="pPage">
      <div className="pPageHead">
        <h1 className="pPageTitle">
          Earn <span className="pPageSub">· DeFi yield on stablecoins</span>
        </h1>
        <span className="pFeeBadge">NON-CUSTODIAL · BASE</span>
      </div>

      <p className="earnIntro">
        Deposit <b>USDC</b> and earn passive yield. Funds go straight into the
        protocol&apos;s audited contracts on Base — KRIPTO NR.1 never holds
        them, and you can withdraw anytime. APYs are live and variable.
      </p>

      <div className="earnGrid">
        <EarnVault
          protocol="morpho"
          emoji="🦋"
          title="Gauntlet USDC Prime"
          sub="Morpho vault · curated by Gauntlet"
        />
        <EarnVault
          protocol="aave"
          emoji="👻"
          title="Aave v3 USDC"
          sub="Blue-chip lending market"
        />
      </div>

      <p className="earnDisc">
        DeFi involves risk, including smart-contract risk and variable rates.
        Yields are not guaranteed. Not financial advice — evaluate each protocol
        yourself. See <a href="/docs">docs</a>.
      </p>
    </main>
  );
}
