"use client";

import { ChainType, getChains } from "@lifi/sdk";
import {
  convertExtendedChain,
  syncWagmiConfig,
} from "@lifi/wallet-management";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Chain } from "viem";
import { WagmiProvider } from "wagmi";
import { config, connectors } from "@/lib/wagmi";

/**
 * Merge the full LI.FI chain list into the wagmi config at runtime so the
 * swap/bridge widget can switch the wallet to ANY supported chain ("Chain
 * not configured" otherwise). Our statically configured chains (Base for
 * the lottery, Arbitrum for Hyperliquid deposits) always stay first — the
 * client factory in lib/wagmi.ts keeps their tuned RPC transports.
 */
function useSyncLifiChains() {
  useEffect(() => {
    let cancelled = false;
    getChains({ chainTypes: [ChainType.EVM] })
      .then((lifiChains) => {
        if (cancelled || !lifiChains?.length) return;
        const ownIds = new Set<number>(config.chains.map((c) => c.id));
        const merged = [
          ...config.chains,
          ...lifiChains
            .filter((c) => !ownIds.has(c.id))
            .map(convertExtendedChain),
        ] as [Chain, ...Chain[]];
        syncWagmiConfig(config, connectors, merged);
      })
      .catch(() => {
        // LI.FI unreachable — the statically configured chains still work.
      });
    return () => {
      cancelled = true;
    };
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useSyncLifiChains();

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
