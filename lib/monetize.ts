// Central place for every revenue knob on the platform. All values are
// PUBLIC (they end up in signed transactions / API calls anyway).

/**
 * LI.FI integrator id. Register the same string at https://portal.li.fi to
 * claim collected fees. Fees accrue in LI.FI's FeeCollector contracts per
 * chain and are withdrawn from the portal.
 */
export const LIFI_INTEGRATOR =
  process.env.NEXT_PUBLIC_LIFI_INTEGRATOR ?? "kripto-nr1";

/**
 * Platform fee taken on every swap/bridge, as a fraction of the send amount.
 * 0.003 = 0.30%. LI.FI caps integrator fees at 10%.
 */
export const LIFI_FEE = Number(process.env.NEXT_PUBLIC_LIFI_FEE ?? "0.003");

/**
 * Hyperliquid builder-code revenue. `HL_BUILDER` is the wallet that receives
 * builder fees (your wallet). `HL_BUILDER_FEE` is in tenths of a basis point
 * (e.g. 25 = 2.5bps = 0.025% of notional per fill; HL caps perp builder fees
 * at 0.1% = 100). Users approve the fee once via `approveBuilderFee`, after
 * that every order routed from this UI pays it automatically.
 */
export const HL_BUILDER = (process.env.NEXT_PUBLIC_HL_BUILDER ?? "") as
  | `0x${string}`
  | "";
export const HL_BUILDER_FEE = Number(
  process.env.NEXT_PUBLIC_HL_BUILDER_FEE ?? "25",
);
/** Human readable, e.g. "0.025%" */
export const HL_BUILDER_FEE_PCT = `${(HL_BUILDER_FEE / 1000).toFixed(3)}%`;

/**
 * Polymarket: markets are browsed natively in the app; the trade action deep
 * links to Polymarket. Apply for the Polymarket builder/partner program to
 * attach order attribution + revenue share, then set your code here.
 */
export const POLYMARKET_REF = process.env.NEXT_PUBLIC_POLYMARKET_REF ?? "";

export function polymarketEventUrl(slug: string): string {
  const base = `https://polymarket.com/event/${slug}`;
  return POLYMARKET_REF ? `${base}?via=${POLYMARKET_REF}` : base;
}
