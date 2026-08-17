import { NextResponse } from "next/server";
import { getProfile, isAddress } from "@/lib/points/engine";
import {
  RocketError,
  clearStuckLock,
  getRocketState,
  launchRound,
  revealRound,
} from "@/lib/points/rocket";
import { isDurable } from "@/lib/points/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Current state of the points rocket for one wallet. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  return NextResponse.json({
    durable: isDurable(),
    ...(await getRocketState(address)),
  });
}

type Body = { address?: string; action?: string; bet?: number; roundId?: string };

/**
 * `launch` commits a round (points leave the balance immediately), `reveal`
 * settles it against the target block's hash, `unstick` clears a lock left by
 * a crashed commit.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, action, bet, roundId } = body;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    if (action === "launch") {
      const round = await launchRound(address, Number(bet));
      return NextResponse.json({
        ok: true,
        round,
        state: await getRocketState(address),
      });
    }

    if (action === "reveal") {
      if (typeof roundId !== "string" || !roundId) {
        return NextResponse.json({ error: "Missing roundId" }, { status: 400 });
      }
      const round = await revealRound(address, roundId);
      return NextResponse.json({
        ok: true,
        round,
        state: await getRocketState(address),
        profile: await getProfile(address),
      });
    }

    if (action === "unstick") {
      await clearStuckLock(address);
      return NextResponse.json({ ok: true, state: await getRocketState(address) });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    if (e instanceof RocketError) {
      // 202 = not yet (keep polling), 422 = this will never work as asked.
      return NextResponse.json(
        { error: e.message, retryable: e.retryable },
        { status: e.retryable ? 202 : 422 },
      );
    }
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
