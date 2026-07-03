import { http, cookieStorage, createConfig, createStorage } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
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
// cookieStorage keeps the session through SSR in the in-app browser.
export const config = createConfig({
  // The active chain goes first: wagmi uses the first chain as the default for
  // reads when no wallet is connected (otherwise a logged-out visitor would
  // query the wrong network and see no bankroll/promo data).
  chains: useTestnet ? [baseSepolia, base] : [base, baseSepolia],
  connectors: [
    farcasterMiniApp(),
    baseAccount({ appName: "KRIPTO NR.1" }),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    // Optional: set NEXT_PUBLIC_RPC_URL to a dedicated Base RPC for reliability
    // (the public endpoint rate-limits and can drop logs). Falls back to default.
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
