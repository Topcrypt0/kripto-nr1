import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";

// Pick the active chain from env. Defaults to Base Sepolia (testnet).
const useMainnet = process.env.NEXT_PUBLIC_CHAIN === "base";
export const activeChain = useMainnet ? base : baseSepolia;

export const config = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    coinbaseWallet({ appName: "KRIPTO NR.1", preference: "all" }),
    injected(),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
