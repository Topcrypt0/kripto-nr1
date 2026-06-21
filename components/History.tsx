"use client";

import { formatEther } from "viem";
import { destMeta } from "@/lib/destinations";

export type HistoryItem = {
  txHash: string;
  player: string;
  multiplier: number;
  payoutWei: string;
};

export function History({
  items,
  you,
}: {
  items: HistoryItem[];
  you?: string;
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
          const payout = Number(formatEther(BigInt(it.payoutWei)));
          return (
            <li key={it.txHash}>
              <span className="hAddr">
                {isYou ? "You" : `${it.player.slice(0, 6)}…${it.player.slice(-4)}`}
              </span>
              <span className="hDest">
                {win ? `${m.emoji} ${m.name}` : "💥 crashed"}
              </span>
              <span className={`hMult ${win ? "w" : "l"}`}>
                {win ? `+${payout.toFixed(4)}` : "X0"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
