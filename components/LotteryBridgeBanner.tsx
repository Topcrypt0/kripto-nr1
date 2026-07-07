"use client";

import { useAccount, useBalance } from "wagmi";
import { base } from "wagmi/chains";

// Enough for the minimum 0.0001 ETH bet plus gas headroom.
const MIN_PLAYABLE_WEI = 300_000_000_000_000n; // 0.0003 ETH

/**
 * Shown on the lottery when the connected wallet can't afford a launch on
 * Base — one click opens the aggregator prefilled to "anything → ETH on
 * Base" (bridging from any chain, with the platform swap fee attached).
 */
export function LotteryBridgeBanner() {
  const { address, isConnected } = useAccount();
  const { data } = useBalance({
    address,
    chainId: base.id,
    query: { enabled: Boolean(address), refetchInterval: 30_000 },
  });

  if (!isConnected || !data || data.value >= MIN_PLAYABLE_WEI) return null;

  return (
    <a className="lotBridge" href="/swap?toChain=8453">
      <span className="lotBridgeTitle">⛽ Not enough ETH on Base?</span>
      <span className="lotBridgeDesc">
        Bridge from any coin on any chain in one click →
      </span>
    </a>
  );
}
