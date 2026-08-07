import { NextResponse } from "next/server";
import { getProfile, isAddress } from "@/lib/points/engine";
import { isDurable } from "@/lib/points/store";
import { SEASON } from "@/lib/points/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Everything the points dashboard needs for one wallet, in a single read. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const profile = await getProfile(address);
  return NextResponse.json({ season: SEASON, durable: isDurable(), profile });
}
