import { NextResponse } from "next/server";
import {
  getGroupStatus,
  getProfile,
  isAddress,
  listGroupMembers,
  redeemGroup,
} from "@/lib/points/engine";
import {
  GROUP_MONTH_POINTS,
  GROUP_MONTH_USD,
  GROUP_MONTH_VOLUME_USD,
  GROUP_PERIOD_DAYS,
} from "@/lib/points/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `?address=` — one wallet's subscription status.
 *
 * `?members=1` with the admin bearer token — every wallet with active access,
 * which is the list to admit to the group:
 *
 *   curl "https://<your-app>/api/points/group?members=1" \
 *     -H "authorization: Bearer $POINTS_ADMIN_TOKEN"
 */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;

  if (params.get("members")) {
    const secret = process.env.POINTS_ADMIN_TOKEN;
    if (!secret) {
      return NextResponse.json(
        { error: "POINTS_ADMIN_TOKEN is not configured" },
        { status: 503 },
      );
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const members = await listGroupMembers(Number(params.get("limit") ?? 500));
    return NextResponse.json({
      count: members.length,
      members: members.map((m) => ({
        address: m.address,
        until: new Date(m.until).toISOString(),
        daysLeft: Math.ceil((m.until - Date.now()) / 86_400_000),
      })),
    });
  }

  const address = params.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  return NextResponse.json({
    pricing: {
      points: GROUP_MONTH_POINTS,
      usd: GROUP_MONTH_USD,
      volumeUsd: Math.round(GROUP_MONTH_VOLUME_USD),
      days: GROUP_PERIOD_DAYS,
    },
    status: await getGroupStatus(address),
  });
}

/** Burn points for `periods` × 30 days of access. */
export async function POST(req: Request) {
  let body: { address?: string; periods?: number };
  try {
    body = (await req.json()) as { address?: string; periods?: number };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, periods } = body;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const result = await redeemGroup(address, Number(periods ?? 1));
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: result.status },
      { status: 422 },
    );
  }

  return NextResponse.json({
    ok: true,
    spent: result.spent,
    status: result.status,
    profile: await getProfile(address),
  });
}
