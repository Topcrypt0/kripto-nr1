import type { Metadata } from "next";
import { Providers } from "./providers";
import { MiniAppReady } from "@/components/MiniAppReady";
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
    "Launch the rocket KRIPTO NR.1 on Base. Bet from 0.0001 to 0.1 ETH and win up to X10. Open source.",
  openGraph: {
    title: "KRIPTO NR.1 🚀",
    description: "Rocket Lottery on Base — win up to X10.",
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
        <Providers>{children}</Providers>
        <MiniAppReady />
      </body>
    </html>
  );
}
