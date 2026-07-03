"use client";

import { formatEther } from "viem";
import { destMeta } from "@/lib/destinations";
import { usdFromWei } from "@/lib/price";

export type HistoryItem = {
  txHash: string;
  player: string;
  multiplier: number;
  payoutWei: string;
};

export function History({
  items,
  you,
  ethUsd,
}: {
  items: HistoryItem[];
  you?: string;
  ethUsd: number;
}) {
  if (!items.length) return null;

  return (
    <div className="history">
      <div className="historyHead">⭐ Recent launches</div>
      <ul>
        {items.map((it) => {
          const m = destMeta(it.multiplier);
          const win = it.multiplier > 0;
          const isYou = you && it.player.toLowerCase() === you.toLowerCase();
          const payoutWei = BigInt(it.payoutWei);
          const payout = Number(formatEther(payoutWei));
          return (
            <li key={it.txHash}>
              <span className="hAddr">
                {isYou ? "You" : `${it.player.slice(0, 6)}…${it.player.slice(-4)}`}
              </span>
              <span className="hDest">
                {win ? `${m.emoji} ${m.name}` : "💥 crashed"}
              </span>
              <span className={`hMult ${win ? "w" : "l"}`}>
                {win
                  ? `+${payout.toFixed(4)} (${usdFromWei(payoutWei, ethUsd)})`
                  : "X0"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
