// Shared server-side Base client. Used to verify receipts (lib/points/verify)
// and to read the block hashes that decide points-rocket rounds
// (lib/points/rocket). Server-only.

import { createPublicClient, fallback, http } from "viem";
import { base, baseSepolia } from "viem/chains";

const useTestnet = process.env.NEXT_PUBLIC_CHAIN === "baseSepolia";

export const pointsChain = useTestnet ? baseSepolia : base;

export const rpc = createPublicClient({
  chain: pointsChain,
  transport: fallback(
    [
      // A dedicated endpoint keeps the rocket responsive; the public ones
      // rate-limit and are only a safety net.
      ...(process.env.POINTS_RPC_URL ? [http(process.env.POINTS_RPC_URL)] : []),
      ...(process.env.NEXT_PUBLIC_RPC_URL
        ? [http(process.env.NEXT_PUBLIC_RPC_URL)]
        : []),
      http("https://base-rpc.publicnode.com"),
      http("https://base.llamarpc.com"),
      http(),
    ],
    { rank: false },
  ),
});
