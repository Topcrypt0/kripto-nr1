import { NextResponse } from "next/server";
import { bindReferrer, getProfile, isAddress } from "@/lib/points/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Binds the inviter captured from `?ref=` to a wallet. Called once when a
 * wallet connects — the link is permanent, so a later visit carrying someone
 * else's code cannot re-parent an existing user.
 */
export async function POST(req: Request) {
  let body: { address?: string; ref?: string };
  try {
    body = (await req.json()) as { address?: string; ref?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, ref } = body;
  if (!isAddress(address) || !isAddress(ref)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const result = await bindReferrer(address, ref);
  return NextResponse.json({ ...result, profile: await getProfile(address) });
}
