import { NextResponse } from "next/server";
import { RocketError, fundPool } from "@/lib/points/rocket";
import { getStore, isDurable } from "@/lib/points/store";
import { ROCKET_MAX_MULTIPLIER } from "@/lib/points/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public pool health — the numbers the rocket UI shows above the bet box. */
export async function GET() {
  const pool = await getStore().getPool();
  const available = pool.balance - pool.reserved;
  return NextResponse.json({
    durable: isDurable(),
    pool: {
      ...pool,
      available,
      // Biggest bet the pool could still cover at X10.
      maxBet: Math.max(0, Math.floor(available / (ROCKET_MAX_MULTIPLIER - 1))),
    },
  });
}

/**
 * Top up the house pool. Guarded by POINTS_ADMIN_TOKEN — without that env var
 * set the route refuses outright rather than defaulting to open.
 *
 *   curl -X POST https://<your-app>/api/points/pool \
 *     -H "authorization: Bearer $POINTS_ADMIN_TOKEN" \
 *     -H "content-type: application/json" \
 *     -d '{"amount": 5000000}'
 *
 * A negative amount withdraws unreserved points from the pool.
 */
export async function POST(req: Request) {
  const secret = process.env.POINTS_ADMIN_TOKEN;
  if (!secret) {
    return NextResponse.json(
      { error: "POINTS_ADMIN_TOKEN is not configured" },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { amount?: number };
  try {
    body = (await req.json()) as { amount?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const amount = Number(body.amount);
    const pool = await getStore().getPool();
    if (amount < 0 && pool.balance - pool.reserved + amount < 0) {
      return NextResponse.json(
        { error: "Cannot withdraw reserved points" },
        { status: 422 },
      );
    }
    const updated = await fundPool(amount);
    return NextResponse.json({
      ok: true,
      pool: { ...updated, available: updated.balance - updated.reserved },
    });
  } catch (e) {
    if (e instanceof RocketError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
