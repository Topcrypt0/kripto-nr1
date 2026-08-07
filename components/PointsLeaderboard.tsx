"use client";

import { useAccount } from "wagmi";
import { useLeaderboard } from "@/lib/points/client";
import { TIERS, formatPoints } from "@/lib/points/config";

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const MEDALS = ["🥇", "🥈", "🥉"];

const tierColor = (name: string) =>
  TIERS.find((t) => t.name === name)?.color ?? "#8b97c7";

export function PointsLeaderboard({ limit = 100 }: { limit?: number }) {
  const { address } = useAccount();
  const { data, isLoading } = useLeaderboard(address, limit);

  const entries = data?.entries ?? [];
  const me = data?.me ?? null;
  const meInTop = me ? entries.some((e) => e.address === me.address) : false;

  return (
    <section className="ptPanel">
      <div className="ptPanelHead">
        <h2 className="ptPanelTitle">🏆 Leaderboard</h2>
        <span className="ptPanelNote">
          Season {data?.season ?? "s1"} · top {limit}
        </span>
      </div>

      {isLoading && <div className="ptEmpty">Loading…</div>}

      {!isLoading && entries.length === 0 && (
        <div className="ptEmpty">
          No one on the board yet — the first swap, bridge or launch takes the
          crown. 👑
        </div>
      )}

      {entries.length > 0 && (
        <div className="ptTable">
          <div className="ptRow ptRowHead">
            <span>#</span>
            <span>Wallet</span>
            <span>Tier</span>
            <span className="ptRight">Points</span>
          </div>
          {entries.map((e) => (
            <div
              key={e.address}
              className={`ptRow${e.address === me?.address ? " ptRowMe" : ""}`}
            >
              <span className="ptRank">{MEDALS[e.rank - 1] ?? e.rank}</span>
              <span className="ptMono">{short(e.address)}</span>
              <span style={{ color: tierColor(e.tier) }}>{e.tier}</span>
              <span className="ptRight ptStrong">{formatPoints(e.points)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Your own row, pinned below the cut when you are not in the top N. */}
      {me && !meInTop && (
        <div className="ptTable ptTableMe">
          <div className="ptRow ptRowMe">
            <span className="ptRank">{me.rank || "—"}</span>
            <span className="ptMono">{short(me.address)} (you)</span>
            <span style={{ color: tierColor(me.tier) }}>{me.tier}</span>
            <span className="ptRight ptStrong">{formatPoints(me.points)}</span>
          </div>
        </div>
      )}
    </section>
  );
}
