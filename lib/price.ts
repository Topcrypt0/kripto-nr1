"use client";

// Live ETH/USD for showing $ next to ETH amounts. Coinbase spot API (public,
// no key), refreshed every minute, with a static fallback so the UI never
// shows nothing.

import { useEffect, useState } from "react";
import { formatEther } from "viem";

const FALLBACK_ETH_USD = 1600;
let cached = FALLBACK_ETH_USD;

async function fetchEthUsd(): Promise<number> {
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
    cache: "no-store",
  });
  const json = (await res.json()) as { data?: { amount?: string } };
  const n = Number(json.data?.amount);
  if (!Number.isFinite(n) || n <= 0) throw new Error("bad price");
  return n;
}

/** Current ETH price in USD, auto-refreshing. */
export function useEthUsd(): number {
  const [price, setPrice] = useState(cached);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const p = await fetchEthUsd();
        cached = p;
        if (alive) setPrice(p);
      } catch {
        /* keep the last known price */
      }
    };
    void tick();
    const id = setInterval(tick, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return price;
}

/** "$16.20" for a wei amount at the given ETH price. */
export function usdFromWei(wei: bigint, ethUsd: number): string {
  return usdFromEth(Number(formatEther(wei)), ethUsd);
}

/** "$16.20" (or "$0.16") for an ETH amount at the given ETH price. */
export function usdFromEth(eth: number, ethUsd: number): string {
  const v = eth * ethUsd;
  if (!Number.isFinite(v)) return "";
  const digits = v >= 100 ? 0 : 2;
  return `$${v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}
