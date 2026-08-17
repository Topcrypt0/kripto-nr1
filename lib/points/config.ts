// KRIPTO POINTS — the single source of truth for the whole reward program.
//
// Shared by the server (award engine) and the client (dashboard, docs), so the
// numbers a user sees are literally the numbers the engine applies. Nothing in
// here touches Node APIs — it is safe to import from a client component.

import { LIFI_FEE } from "@/lib/monetize";

export type PointsSource = "swap" | "bridge" | "perps" | "lottery" | "earn";

export const POINT_SOURCES = [
  "swap",
  "bridge",
  "perps",
  "lottery",
  "earn",
] as const;

/**
 * Season key. Every storage key is namespaced with it, so starting season 2 is
 * a one-line env change that archives (rather than deletes) season 1.
 */
export const SEASON =
  process.env.NEXT_PUBLIC_POINTS_SEASON?.trim() || "s1";

export type SourceRule = {
  label: string;
  emoji: string;
  href: string;
  /** Points per $1 of verified volume, below the soft cap. */
  rate: number;
  /**
   * Volume (USD) per single action that earns the full rate. Everything above
   * it earns `rate * OVERFLOW_RATE` — whales still climb, but a single
   * mega-transaction can't own the leaderboard.
   */
  softCapUsd: number;
  /** Hard ceiling of points a single action can ever be worth. */
  maxPerAction: number;
  /** One-time bonus the first time a user ever does this action. */
  firstBonus: number;
  /** Shown in the "how to earn" table. */
  blurb: string;
};

/** Multiplier applied to the volume above a source's soft cap. */
export const OVERFLOW_RATE = 0.25;

export const SOURCES: Record<PointsSource, SourceRule> = {
  swap: {
    label: "Swap",
    emoji: "🔁",
    href: "/swap",
    rate: 10,
    softCapUsd: 5_000,
    maxPerAction: 60_000,
    firstBonus: 250,
    blurb: "Same-chain swaps routed through the aggregator.",
  },
  bridge: {
    label: "Bridge",
    emoji: "🌉",
    href: "/swap",
    rate: 15,
    softCapUsd: 5_000,
    maxPerAction: 90_000,
    firstBonus: 400,
    blurb: "Cross-chain transfers — 1.5× the swap rate.",
  },
  perps: {
    label: "Perps",
    emoji: "📈",
    href: "/perps",
    rate: 5,
    softCapUsd: 25_000,
    maxPerAction: 150_000,
    firstBonus: 500,
    blurb: "Every Hyperliquid fill, scored on filled notional.",
  },
  lottery: {
    label: "Rocket launch",
    emoji: "🚀",
    href: "/lottery",
    rate: 200,
    softCapUsd: 50,
    maxPerAction: 1_500,
    firstBonus: 300,
    blurb: "Each launch — free launches count too.",
  },
  earn: {
    label: "Earn deposit",
    emoji: "🏦",
    href: "/earn",
    rate: 8,
    softCapUsd: 25_000,
    maxPerAction: 60_000,
    firstBonus: 250,
    blurb: "Stablecoins supplied to the Morpho / Aave vaults.",
  },
};

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------

/**
 * Referral bonuses are *minted on top* — an invitee never loses points to the
 * person who invited them. Two levels, so inviting recruiters pays off.
 */
export const REFERRAL_L1 = 0.1; // 10% to the direct inviter
export const REFERRAL_L2 = 0.03; // 3% to the inviter's inviter

/** One-time bonus for both sides once an invitee earns their first points. */
export const REFERRAL_ACTIVATION_BONUS = 500;

// ---------------------------------------------------------------------------
// Daily streak
// ---------------------------------------------------------------------------

/** Extra multiplier per consecutive active day, capped by STREAK_MAX. */
export const STREAK_STEP = 0.05;
export const STREAK_MAX = 1.5;

export function streakMultiplier(streakDays: number): number {
  return Math.min(1 + STREAK_STEP * Math.max(0, streakDays - 1), STREAK_MAX);
}

// ---------------------------------------------------------------------------
// Private group — a 30-day subscription priced off real platform fees
// ---------------------------------------------------------------------------
//
// The group costs the operator at least $20/month to run, so a month of access
// must be worth at least that much in fees actually paid to the platform. The
// floor is DERIVED rather than invented — how much swap volume pays $20 of
// interface fees, at the swap points rate — and then rounded UP to a clean
// 100k, which is both the headline price and a comfortable margin over cost:
//
//   floor:  $20 / 0.30% fee = $6,667 volume × 10 pts/$1 = ~66,667 points
//   price:  rounded up to   = 100,000 points
//           ( = $10,000 of swap volume = $30 of platform fees )
//
// Rounding UP rather than to-nearest matters: raise NEXT_PUBLIC_LIFI_FEE or
// GROUP_MONTH_USD later and the price steps to the next 100k instead of quietly
// dropping below what the group costs to run.

/** What one period of the group costs the operator, in USD of platform fees. */
export const GROUP_MONTH_USD = 20;

/** Days of access one redemption buys. */
export const GROUP_PERIOD_DAYS = 30;

/** Price step — keeps the headline number readable. */
const GROUP_PRICE_STEP = 100_000;

/** Points that would exactly cover GROUP_MONTH_USD of fees, before rounding. */
const groupFloorPoints =
  LIFI_FEE > 0 ? (GROUP_MONTH_USD / LIFI_FEE) * SOURCES.swap.rate : 0;

/** Points for one 30-day period. */
export const GROUP_MONTH_POINTS = Math.max(
  GROUP_PRICE_STEP,
  Math.ceil(groupFloorPoints / GROUP_PRICE_STEP) * GROUP_PRICE_STEP,
);

/**
 * Swap volume the final price actually corresponds to. Derived from the ROUNDED
 * price, not the floor, so every number the dashboard shows is true of what the
 * user really pays.
 */
export const GROUP_MONTH_VOLUME_USD =
  GROUP_MONTH_POINTS / SOURCES.swap.rate;

/** Platform fees that volume generates — what the period is worth to the house. */
export const GROUP_MONTH_FEES_USD = GROUP_MONTH_VOLUME_USD * LIFI_FEE;

/** How far ahead access can be prepaid in one go. */
export const GROUP_MAX_MONTHS = 12;

export const GROUP_PERIOD_MS = GROUP_PERIOD_DAYS * 86_400_000;

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

export type Tier = {
  name: string;
  emoji: string;
  min: number;
  color: string;
  perks: string[];
};

export const TIERS: Tier[] = [
  {
    name: "Cadet",
    emoji: "🪐",
    min: 0,
    color: "#8b97c7",
    perks: ["Points tracking & leaderboard", "Referral link"],
  },
  {
    name: "Pilot",
    emoji: "🛰️",
    min: 1_000,
    color: "#5b8cff",
    perks: ["Early feature drops", "Points rocket unlocked"],
  },
  {
    name: "Captain",
    emoji: "🚀",
    min: 10_000,
    color: "#2fe08a",
    perks: [
      "Weekly token reward-pool share",
      "Alpha channel",
      "Priority support",
    ],
  },
  {
    name: "Commander",
    emoji: "⚡",
    min: 50_000,
    color: "#f5b50a",
    perks: [
      "Boosted reward-pool weight",
      "Swap fee rebate",
      "Leaderboard badge",
    ],
  },
  {
    name: "Astronaut",
    emoji: "👨‍🚀",
    min: 200_000,
    color: "#ff6a52",
    perks: [
      "Max reward-pool weight",
      "Guaranteed allocation whitelist",
      "Direct line to the team",
    ],
  },
  {
    name: "Legend",
    emoji: "👑",
    min: 1_000_000,
    color: "#ffd98a",
    perks: [
      "Everything above",
      "Permanent OG role",
      "Revenue-share invite",
    ],
  },
];

export function tierFor(points: number): Tier {
  let current = TIERS[0];
  for (const t of TIERS) if (points >= t.min) current = t;
  return current;
}

export function nextTier(points: number): Tier | null {
  return TIERS.find((t) => t.min > points) ?? null;
}

// ---------------------------------------------------------------------------
// Reward catalogue — what points are actually *for*.
// ---------------------------------------------------------------------------

export type Reward = {
  emoji: string;
  title: string;
  desc: string;
  /** Points needed, or null when it is a tier-gated perk rather than a spend. */
  cost: number | null;
  kind: "access" | "pool" | "perk" | "subscription";
  /** Subscriptions are redeemed per period rather than bought once. */
  perPeriod?: string;
};

export const REWARDS: Reward[] = [
  {
    emoji: "🔒",
    title: "Private group — 30 days",
    desc: `Invite to the closed KRIPTO NR.1 group: trade ideas, alpha, direct line to the team. Costs about $${Math.round(
      GROUP_MONTH_VOLUME_USD,
    ).toLocaleString("en-US")} of swap volume — the fees that covers pay for the group. Renews per period.`,
    cost: GROUP_MONTH_POINTS,
    kind: "subscription",
    perPeriod: `${GROUP_PERIOD_DAYS} days`,
  },
  {
    emoji: "💰",
    title: "Weekly token reward pool",
    desc: "Every week a token pool is split between holders pro-rata to points earned that week.",
    cost: 10_000,
    kind: "pool",
  },
  {
    emoji: "🎟️",
    title: "Free rocket launches",
    desc: "Redeem points for free launches — win up to 0.01 ETH with zero stake.",
    cost: 2_500,
    kind: "perk",
  },
  {
    emoji: "🏷️",
    title: "Swap fee rebate",
    desc: "Burn points to get the platform swap fee rebated on your next volume tier.",
    cost: 25_000,
    kind: "perk",
  },
  {
    emoji: "🥇",
    title: "Allocation whitelist",
    desc: "Guaranteed spot in the token generation event / partner allocations.",
    cost: 200_000,
    kind: "access",
  },
];
// ---------------------------------------------------------------------------
// Points rocket — gamble points instead of ETH
// ---------------------------------------------------------------------------
//
// The odds are a byte-for-byte mirror of KriptoNr1.sol so the points game is
// the *same* game, just settled against a points pool instead of the bankroll.
// The contract is not touched at all: randomness comes from the hash of a
// future Base block, exactly like `blockhash(targetBlock)` on-chain, and the
// roll is the same keccak256(blockHash, player, bet) % 10000.
//
// Spinning points earns NO volume points — otherwise the loop would print
// points out of thin air. The pool is the only source of new points here.

export const ROCKET_MIN_BET = 100; // points
export const ROCKET_MAX_BET = 25_000; // points
export const ROCKET_MAX_MULTIPLIER = 10;
export const ROCKET_BPS = 10_000;

/** The contract's outcome table, with the odds spelled out for the UI. */
export const ROCKET_TABLE = [
  { multiplier: 0, below: 6_500, chance: 65 },
  { multiplier: 2, below: 8_700, chance: 22 },
  { multiplier: 3, below: 9_500, chance: 8 },
  { multiplier: 5, below: 9_900, chance: 4 },
  { multiplier: 10, below: ROCKET_BPS, chance: 1 },
] as const;

/** Identical to `_multiplierForRoll` in KriptoNr1.sol. */
export function multiplierForRoll(roll: number): number {
  if (roll < 6_500) return 0;
  if (roll < 8_700) return 2;
  if (roll < 9_500) return 3;
  if (roll < 9_900) return 5;
  return 10;
}

// ---------------------------------------------------------------------------
// Claiming an ETH win as points instead
// ---------------------------------------------------------------------------

/**
 * Points per $1 of forfeited ETH payout. A winner who takes points leaves the
 * ETH in the contract (it returns to the bankroll when the claim window
 * closes), so the bonus below costs the house nothing but pool points.
 */
export const CONVERT_RATE = 200;
export const CONVERT_BONUS = 0.25;

/** Points a `payoutUsd` ETH win is worth if taken as points. */
export function convertPoints(payoutUsd: number): number {
  if (!Number.isFinite(payoutUsd) || payoutUsd <= 0) return 0;
  return Math.round(payoutUsd * CONVERT_RATE * (1 + CONVERT_BONUS));
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** Points for one verified action of `source` worth `volumeUsd`. */
export function pointsForVolume(
  source: PointsSource,
  volumeUsd: number,
): number {
  const rule = SOURCES[source];
  if (!Number.isFinite(volumeUsd) || volumeUsd <= 0) return 0;
  const full = Math.min(volumeUsd, rule.softCapUsd);
  const over = Math.max(0, volumeUsd - rule.softCapUsd);
  const raw = full * rule.rate + over * rule.rate * OVERFLOW_RATE;
  return Math.min(Math.round(raw), rule.maxPerAction);
}

export function formatPoints(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
