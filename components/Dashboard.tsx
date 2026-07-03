"use client";

import { formatEther } from "viem";
import type { Stats } from "@/lib/stats";
import { usdFromWei } from "@/lib/price";

function fmt(wei: bigint, digits = 4) {
  return Number(formatEther(wei < 0n ? -wei : wei)).toFixed(digits);
}

export function Dashboard({
  stats,
  onShare,
  sharing,
  ethUsd,
}: {
  stats: Stats;
  onShare: () => void;
  sharing?: boolean;
  ethUsd: number;
}) {
  if (stats.count === 0 && stats.refunds === 0) return null;

  const up = stats.pnl >= 0n;
  const pnlSign = up ? "+" : "−";
  const pctSign = stats.pnlPct >= 0 ? "+" : "−";
  const abs = (wei: bigint) => (wei < 0n ? -wei : wei);

  return (
    <div className="dash">
      <div className="dashHead">
        <span>📊 Your stats</span>
        <button className="shareMini" onClick={onShare} disabled={sharing}>
          {sharing ? "…" : "↗ Share"}
        </button>
      </div>

      {/* headline PnL */}
      <div className={`pnlBig ${up ? "up" : "down"}`}>
        <span className="pnlEth">
          {pnlSign}
          {fmt(stats.pnl)} ETH ({pnlSign}
          {usdFromWei(abs(stats.pnl), ethUsd)})
        </span>
        <span className="pnlPct">
          {pctSign}
          {Math.abs(stats.pnlPct).toFixed(1)}%
        </span>
      </div>

      <div className="dashGrid">
        <Tile label="Launches" value={String(stats.count + stats.refunds)} />
        <Tile label="Wins" value={String(stats.wins)} tone="up" />
        <Tile label="Losses" value={String(stats.losses)} tone="down" />
        <Tile label="Win rate" value={`${stats.winRate.toFixed(0)}%`} />
        <Tile
          label="Wagered"
          value={`${fmt(stats.wagered)} Ξ · ${usdFromWei(stats.wagered, ethUsd)}`}
        />
        <Tile
          label="Best hit"
          value={stats.best > 0 ? `X${stats.best}` : "—"}
          tone={stats.best > 0 ? "up" : undefined}
        />
      </div>

      {stats.refunds > 0 && (
        <div className="dashNote">↩️ {stats.refunds} refunded (revealed too late)</div>
      )}
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="tile">
      <div className="tileLabel">{label}</div>
      <div className={`tileValue ${tone ?? ""}`}>{value}</div>
    </div>
  );
}
