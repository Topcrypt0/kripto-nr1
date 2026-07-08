// Privy fiat on-ramp ("Buy Crypto"). The App ID is a PUBLIC value (it ships in
// the frontend), so a baked default is fine; override with NEXT_PUBLIC_PRIVY_APP_ID.
export const PRIVY_APP_ID =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "cmrb13mt600os0clcdlcji8vv";

// Base chain, CAIP-2 form expected by Privy's onramp.
export const BASE_CAIP2 = "eip155:8453" as const;

// Onramp environment must match the Privy app state:
//  - "production" when the Privy app is upgraded to Production (real money)
//  - "sandbox"    while the app is in Development (test cards, fake money)
// A Development app returns "Unable to get quotes" if asked for production.
export const PRIVY_ONRAMP_ENV = (
  process.env.NEXT_PUBLIC_PRIVY_ONRAMP_ENV === "sandbox"
    ? "sandbox"
    : "production"
) as "sandbox" | "production";

// Assets a user can buy with a card, delivered straight to their wallet on Base.
export const ONRAMP_ASSETS = {
  usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Native ETH is represented by the zero address for onramp destinations.
  eth: "0x0000000000000000000000000000000000000000",
} as const;
