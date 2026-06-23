import { http, cookieStorage, createConfig, createStorage } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { baseAccount, injected } from "wagmi/connectors";
import { Attribution } from "ox/erc8021";

// Pick the active chain from env. Defaults to Base Sepolia (testnet).
const useMainnet = process.env.NEXT_PUBLIC_CHAIN === "base";
export const activeChain = useMainnet ? base : baseSepolia;

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

// Base App (post-April 2026) = standard web app + wallet. Use the native Base
// Account connector plus injected wallets; cookieStorage for SSR in the in-app
// browser.
export const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    baseAccount({ appName: "KRIPTO NR.1" }),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
