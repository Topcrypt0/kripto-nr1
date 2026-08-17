import { NextResponse } from "next/server";
import { getLeaderboard, getProfile, isAddress, norm } from "@/lib/points/engine";
import { isDurable } from "@/lib/points/store";
import { SEASON, tierFor } from "@/lib/points/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Season leaderboard. When `address` is passed, the caller's own row is
 * appended (with its true rank) even if they are nowhere near the top.
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const limit = Number(params.get("limit") ?? 100);
  const address = params.get("address");

  const rows = await getLeaderboard(Number.isFinite(limit) ? limit : 100);
  const entries = rows.map((r, i) => ({
    rank: i + 1,
    address: r.address,
    points: Math.round(r.points),
    tier: tierFor(r.points).name,
  }));

  let me = null;
  if (isAddress(address)) {
    const self = norm(address);
    const inTop = entries.find((e) => e.address === self);
    if (inTop) {
      me = inTop;
    } else {
      const p = await getProfile(self);
      if (p.total > 0 || p.rank) {
        me = {
          rank: p.rank ?? 0,
          address: self,
          points: p.total,
          tier: p.tier.name,
        };
      }
    }
  }

  return NextResponse.json({
    season: SEASON,
    durable: isDurable(),
    players: entries.length,
    entries,
    me,
  });
}
