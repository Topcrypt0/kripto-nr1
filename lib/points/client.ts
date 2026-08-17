"use client";

// Client side of the points program: a resilient "track this action" call, the
// react-query hooks the dashboard uses, and the referral link helper.

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getReferrer } from "@/lib/referral";
import type { PointsSource, Tier } from "./config";

export type TrackInput = {
  source: PointsSource | "lifi";
  txHash?: string;
  fromChain?: number;
  toChain?: number;
};

export type TrackResult = {
  ok: true;
  durable: boolean;
  awarded: number;
  referralAwarded: number;
  duplicates: number;
  volumeUsd: number;
  streak: number;
  multiplier: number;
  total: number;
  details: string[];
  profile: PointsProfile;
};

export type SourceBreakdown = {
  source: PointsSource;
  label: string;
  emoji: string;
  href: string;
  points: number;
  volumeUsd: number;
  actions: number;
};

export type GroupStatus = {
  active: boolean;
  until: number | null;
  daysLeft: number;
  periods: number;
  pricePerPeriod: number;
  periodDays: number;
  maxPeriods: number;
  balance: number;
  affordable: number;
};

export type PointsProfile = {
  address: string;
  /** Spendable balance. */
  total: number;
  /** Lifetime produced — the rank and tier are based on this. */
  earned: number;
  spent: number;
  group: GroupStatus;
  base: number;
  referral: number;
  bonus: number;
  gamble: number;
  converted: number;
  rocket: { rounds: number; staked: number; won: number; best: number };
  volumeUsd: number;
  actions: number;
  rank: number | null;
  players: number;
  streak: number;
  multiplier: number;
  tier: Tier;
  next: Tier | null;
  progress: number;
  referrer: string | null;
  invitees: number;
  breakdown: SourceBreakdown[];
  isNew: boolean;
};

export type LeaderEntry = {
  rank: number;
  address: string;
  points: number;
  tier: string;
};

// The custom event the toast listens to — keeps the award UI decoupled from
// every call site that reports an action.
export const POINTS_EVENT = "kr1:points";

const QUEUE_KEY = "kr1_points_queue";
// LI.FI needs a moment to index a route, and a Base receipt needs a block or
// two: back off instead of giving up on the first "not yet".
const RETRY_DELAYS = [6_000, 18_000, 45_000, 120_000];

type QueueItem = TrackInput & { address: string; attempt: number; at: number };

function readQueue(): QueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueueItem[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-25)));
  } catch {
    /* quota — dropping the queue only costs a retry */
  }
}

function queueKey(i: TrackInput & { address: string }) {
  return `${i.address}:${i.source}:${i.txHash ?? ""}`;
}

function enqueue(item: QueueItem) {
  const items = readQueue().filter((q) => queueKey(q) !== queueKey(item));
  writeQueue([...items, item]);
}

function dequeue(item: TrackInput & { address: string }) {
  writeQueue(readQueue().filter((q) => queueKey(q) !== queueKey(item)));
}

async function post(address: string, input: TrackInput) {
  const res = await fetch("/api/points/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, ref: getReferrer() ?? undefined, ...input }),
  });
  const json = (await res.json().catch(() => ({}))) as Partial<TrackResult> & {
    error?: string;
    retryable?: boolean;
  };
  return { status: res.status, json };
}

/**
 * Report a verified-on-the-server action. Resolves with the award (or null if
 * it could not be confirmed yet); retries in the background and survives a
 * reload through a small localStorage queue, so points are never lost just
 * because an indexer was slow.
 */
export async function trackAction(
  address: string,
  input: TrackInput,
  attempt = 0,
): Promise<TrackResult | null> {
  if (typeof window === "undefined" || !address) return null;
  const item: QueueItem = { ...input, address, attempt, at: Date.now() };
  enqueue(item);

  const { status, json } = await post(address, input).catch(() => ({
    status: 0,
    json: {} as Partial<TrackResult> & { error?: string },
  }));

  const retryable = status === 202 || status === 0 || status >= 500;
  if (retryable && attempt < RETRY_DELAYS.length) {
    setTimeout(
      () => void trackAction(address, input, attempt + 1),
      RETRY_DELAYS[attempt],
    );
    return null;
  }

  dequeue(item);
  if (status !== 200 || !json.ok) return null;

  const result = json as TrackResult;
  if (result.awarded > 0 || result.referralAwarded > 0) {
    window.dispatchEvent(new CustomEvent(POINTS_EVENT, { detail: result }));
  }
  return result;
}

/**
 * Re-fires anything still queued from a previous session. Called once from the
 * global tracker when a wallet is connected.
 */
export function flushQueue(address: string) {
  const all = readQueue();
  const self = address.toLowerCase();
  const mine = all.filter((q) => q.address.toLowerCase() === self);
  if (mine.length === 0) return;
  // Clear first: trackAction re-enqueues each item itself, so anything that
  // still fails stays queued while successes drop out.
  writeQueue(all.filter((q) => q.address.toLowerCase() !== self));
  for (const item of mine) {
    void trackAction(address, {
      source: item.source,
      txHash: item.txHash,
      fromChain: item.fromChain,
      toChain: item.toChain,
    });
  }
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function usePointsProfile(address?: string) {
  return useQuery({
    queryKey: ["points", "me", address?.toLowerCase()],
    enabled: Boolean(address),
    refetchInterval: 60_000,
    queryFn: async () => {
      const res = await fetch(`/api/points/me?address=${address}`);
      if (!res.ok) throw new Error("Could not load points");
      return (await res.json()) as {
        season: string;
        durable: boolean;
        profile: PointsProfile;
      };
    },
  });
}

export function useLeaderboard(address?: string, limit = 100) {
  return useQuery({
    queryKey: ["points", "leaderboard", limit, address?.toLowerCase()],
    refetchInterval: 60_000,
    queryFn: async () => {
      const q = new URLSearchParams({ limit: String(limit) });
      if (address) q.set("address", address);
      const res = await fetch(`/api/points/leaderboard?${q}`);
      if (!res.ok) throw new Error("Could not load leaderboard");
      return (await res.json()) as {
        season: string;
        durable: boolean;
        entries: LeaderEntry[];
        me: LeaderEntry | null;
      };
    },
  });
}

/**
 * `const track = useTrackPoints()` → `track({ source: "lottery", txHash })`.
 * No-ops when no wallet is connected, so call sites stay free of guards.
 */
export function useTrackPoints() {
  const { address } = useAccount();
  const qc = useQueryClient();

  return useCallback(
    async (input: TrackInput) => {
      if (!address) return null;
      const result = await trackAction(address, input);
      if (result) {
        void qc.invalidateQueries({ queryKey: ["points"] });
      }
      return result;
    },
    [address, qc],
  );
}

// ---------------------------------------------------------------------------
// Points rocket
// ---------------------------------------------------------------------------

export type RocketRound = {
  id: string;
  address: string;
  bet: number;
  targetBlock: number;
  createdAt: number;
  status: "pending" | "settled";
  blockHash?: string;
  roll?: number;
  multiplier?: number;
  payout?: number;
  settledAt?: number;
};

export type RocketState = {
  durable?: boolean;
  pending: RocketRound | null;
  history: RocketRound[];
  balance: number;
  pool: { balance: number; reserved: number; available: number; open: boolean };
  limits: { min: number; max: number; maxAffordable: number };
};

export type ConvertStatus = {
  state: "none" | "pending" | "credited" | "voided";
  points?: number;
  payoutEth?: string;
  multiplier?: number;
  settleAfter?: number;
  currentBlock?: number;
  secondsLeft?: number;
  balance?: number;
  message?: string;
  error?: string;
};

async function rocketPost(body: Record<string, unknown>) {
  const res = await fetch("/api/points/rocket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    round?: RocketRound;
    state?: RocketState;
    error?: string;
    retryable?: boolean;
  };
  return { status: res.status, ...json };
}

export function useRocketState(address?: string) {
  return useQuery({
    queryKey: ["points", "rocket", address?.toLowerCase()],
    enabled: Boolean(address),
    queryFn: async () => {
      const res = await fetch(`/api/points/rocket?address=${address}`);
      if (!res.ok) throw new Error("Could not load the points rocket");
      return (await res.json()) as RocketState;
    },
  });
}

/** Commit a round — the stake leaves the balance right away. */
export async function launchPointsRound(address: string, bet: number) {
  return rocketPost({ address, action: "launch", bet });
}

/**
 * Reveal a committed round. The target block needs a few seconds to be mined,
 * so a 202 ("not yet") is retried rather than surfaced as a failure.
 */
export async function revealPointsRound(
  address: string,
  roundId: string,
  attempts = 12,
): Promise<{ round?: RocketRound; state?: RocketState; error?: string }> {
  for (let i = 0; i < attempts; i++) {
    const res = await rocketPost({ address, action: "reveal", roundId });
    if (res.status === 200 && res.round) return res;
    if (res.status !== 202 && res.status < 500) {
      return { error: res.error ?? "Reveal failed" };
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return { error: "The reveal block is taking unusually long — try again." };
}

async function convertPost(address: string, action: "request" | "settle") {
  const res = await fetch("/api/points/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, action }),
  });
  return (await res.json().catch(() => ({}))) as ConvertStatus;
}

/** Ask to take a pending ETH win as points instead. */
export const requestPointsPayout = (address: string) =>
  convertPost(address, "request");

/** Poll until the claim window closes and the points are released (or voided). */
export const settlePointsPayout = (address: string) =>
  convertPost(address, "settle");

// ---------------------------------------------------------------------------
// Private group subscription
// ---------------------------------------------------------------------------

/** Burn points for `periods` × 30 days of private-group access. */
export async function redeemGroupAccess(address: string, periods = 1) {
  const res = await fetch("/api/points/group", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, periods }),
  });
  return (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    spent?: number;
    status?: GroupStatus;
    error?: string;
  };
}

/** The user's own invite URL — every tab's share flow already uses `?ref=`. */
export function referralLink(address?: string): string {
  if (typeof window === "undefined" || !address) return "";
  return `${window.location.origin}/?ref=${address}`;
}
