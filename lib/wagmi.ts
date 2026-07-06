import { createClient } from "viem";
import { fallback, http, cookieStorage, createConfig, createStorage } from "wagmi";
import {
  abstract,
  arbitrum,
  aurora,
  avalanche,
  base,
  baseSepolia,
  berachain,
  blast,
  bsc,
  celo,
  cronos,
  fantom,
  fraxtal,
  gnosis,
  hyperEvm,
  ink,
  linea,
  mainnet,
  mantle,
  metis,
  mode,
  moonbeam,
  moonriver,
  opBNB,
  optimism,
  polygon,
  polygonZkEvm,
  scroll,
  sei,
  soneium,
  sonic,
  taiko,
  unichain,
  worldchain,
  zksync,
} from "wagmi/chains";

// Every EVM chain the swap/bridge aggregator can execute from. Statically
// registered so wallet chain-switching ("Chain not configured" otherwise)
// works deterministically — no runtime chain-list fetch to race against.
const AGGREGATOR_CHAINS = [
  mainnet,
  arbitrum,
  optimism,
  polygon,
  bsc,
  avalanche,
  gnosis,
  fantom,
  aurora,
  celo,
  cronos,
  linea,
  mantle,
  metis,
  mode,
  moonbeam,
  moonriver,
  opBNB,
  polygonZkEvm,
  scroll,
  sei,
  sonic,
  zksync,
  blast,
  fraxtal,
  taiko,
  unichain,
  worldchain,
  ink,
  soneium,
  abstract,
  berachain,
  hyperEvm,
] as const;
import { baseAccount, injected } from "wagmi/connectors";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { Attribution } from "ox/erc8021";

// Defaults to Base mainnet (the live config). Set NEXT_PUBLIC_CHAIN=baseSepolia
// to use the testnet instead.
const useTestnet = process.env.NEXT_PUBLIC_CHAIN === "baseSepolia";
export const activeChain = useTestnet ? baseSepolia : base;

// Builder Code attribution (ERC-8021). Appended to every transaction so the app
// shows up with real metrics in the Base builder dashboard. Exported and passed
// to each writeContract call (works regardless of wagmi version specifics).
const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE ?? "bc_2x5t0m9v";
export let DATA_SUFFIX: `0x${string}` | undefined;
try {
  if (BUILDER_CODE) {
    DATA_SUFFIX = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
  }
} catch {
  DATA_SUFFIX = undefined;
}

// Base App = Farcaster-style Mini App host. The Mini App connector auto-connects
// to the host wallet when we run inside Base App / a Farcaster client; outside of
// one it stays dormant and the Base Account + injected connectors take over.
// Exported separately: syncWagmiConfig (app/providers.tsx) REPLACES the
// config's connectors, so it must be handed the same list to keep them.
export const connectors = [
  farcasterMiniApp(),
  baseAccount({ appName: "KRIPTO NR.1" }),
  injected(),
];

// cookieStorage keeps the session through SSR in the in-app browser.
export const config = createConfig({
  // The active chain goes first: wagmi uses the first chain as the default for
  // reads when no wallet is connected (otherwise a logged-out visitor would
  // query the wrong network and see no bankroll/promo data).
  // Base first (lottery default), then baseSepolia (testnet), then every
  // aggregator chain (Arbitrum among them powers the Hyperliquid deposits).
  chains: useTestnet
    ? [baseSepolia, base, ...AGGREGATOR_CHAINS]
    : [base, baseSepolia, ...AGGREGATOR_CHAINS],
  connectors,
  // A client FACTORY instead of a static `transports` map: the swap/bridge
  // aggregator syncs the full LI.FI chain list into this config at runtime
  // (see app/providers.tsx), and every synced chain must be able to get a
  // client. Known chains keep their tuned transports; anything else falls
  // back to the chain's default public RPC.
  client({ chain }) {
    // Reliability (Base): the default public endpoint rate-limits browser
    // traffic, which stalls the lottery reveal step mid-game. Try the
    // dedicated RPC first (set NEXT_PUBLIC_RPC_URL), then rotate fallbacks.
    const transport =
      chain.id === base.id
        ? fallback(
            [
              ...(process.env.NEXT_PUBLIC_RPC_URL
                ? [http(process.env.NEXT_PUBLIC_RPC_URL)]
                : []),
              http("https://base-rpc.publicnode.com"),
              http("https://base.llamarpc.com"),
              http(), // chain default (mainnet.base.org)
            ],
            { rank: false },
          )
        : chain.id === arbitrum.id
          ? http("https://arb1.arbitrum.io/rpc")
          : http(); // chain default RPC (incl. LI.FI-synced chains)
    return createClient({ chain, transport, batch: { multicall: true } });
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
