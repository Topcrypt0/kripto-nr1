"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/lib/privy";

/**
 * Provides Privy strictly for the fiat on-ramp ("Buy Crypto"). It runs
 * ALONGSIDE the app's own wagmi config (they are independent React contexts —
 * we deliberately do NOT use @privy-io/wagmi so the Base Account / injected /
 * Farcaster connectors keep working untouched). Login methods are limited to
 * email so the onramp modal can attach a lightweight session without pulling
 * in a competing wallet UI. Gated on the app id so the app still builds/runs
 * if it is ever unset.
 */
export function PrivyOnrampProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!PRIVY_APP_ID) return <>{children}</>;

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#e8442b",
          logo: "/logo.svg",
        },
        loginMethods: ["email"],
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
