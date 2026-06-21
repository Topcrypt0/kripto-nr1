import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "KRIPTO NR.1 🚀",
  description:
    "Launch the rocket KRIPTO NR.1 on Base. Bet from 0.0001 to 0.1 ETH and win up to X10. Open source.",
  // Base Developers Portal domain verification.
  other: {
    "base:app_id": "69f0c842bf0a75fdec18c28b",
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
      </body>
    </html>
  );
}
