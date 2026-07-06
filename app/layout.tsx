import type { Metadata } from "next";
import { Providers } from "./providers";
import { MiniAppReady } from "@/components/MiniAppReady";
import { NavBar } from "@/components/NavBar";
import { appUrl, embed } from "@/lib/miniapp";
import "./globals.css";

const url = appUrl();
const frameEmbed = JSON.stringify(embed(url));
// Legacy `fc:frame` clients expect launch_frame instead of launch_miniapp.
const legacyEmbed = JSON.stringify({
  ...embed(url),
  button: {
    ...embed(url).button,
    action: { ...embed(url).button.action, type: "launch_frame" },
  },
});

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: "KRIPTO NR.1 🚀",
  description:
    "KRIPTO NR.1 — DEX platform: swap & bridge across 30+ chains, trade perps on Hyperliquid, prediction markets, and the rocket lottery on Base.",
  openGraph: {
    title: "KRIPTO NR.1 🚀",
    description:
      "Swap · Bridge · Perps · Predictions · Rocket Lottery — all in one.",
    images: ["/hero.png"],
  },
  other: {
    // Base Developers Portal domain verification.
    "base:app_id": "69f0c842bf0a75fdec18c28b",
    // Base Mini App / Farcaster embed — makes the URL render as a launchable card.
    "fc:miniapp": frameEmbed,
    "fc:frame": legacyEmbed,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <NavBar />
          {children}
        </Providers>
        <MiniAppReady />
      </body>
    </html>
  );
}
