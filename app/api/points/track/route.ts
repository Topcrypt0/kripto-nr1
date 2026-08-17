import { NextResponse } from "next/server";
import { award, bindReferrer, getProfile, isAddress, setHlCursor } from "@/lib/points/engine";
import { isDurable } from "@/lib/points/store";
import {
  VerifyError,
  verifyEarn,
  verifyLifi,
  verifyLottery,
  verifyPerps,
  type VerifiedAction,
} from "@/lib/points/verify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  address?: string;
  /** "swap" and "bridge" both go through LI.FI — the API decides which it was. */
  source?: string;
  txHash?: string;
  fromChain?: number;
  toChain?: number;
  /** Inviter address captured from `?ref=` on the client. */
  ref?: string;
};

const isTxHash = (s: unknown): s is string =>
  typeof s === "string" && /^0x[a-fA-F0-9]{64}$/.test(s);

/**
 * Records a points-earning action. The body is a *claim*, never a score: the
 * server re-verifies every action against its own source of truth before a
 * single point is minted, and every action is idempotent by design.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, source, txHash, fromChain, toChain, ref } = body;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  // Bind the inviter before awarding so the very first action already pays the
  // referral tree.
  if (isAddress(ref)) {
    await bindReferrer(address, ref).catch(() => undefined);
  }

  try {
    let actions: VerifiedAction[] = [];
    let cursor: number | undefined;

    switch (source) {
      case "swap":
      case "bridge":
      case "lifi": {
        if (!isTxHash(txHash)) {
          return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
        }
        actions = [await verifyLifi(address, txHash, fromChain, toChain)];
        break;
      }
      case "lottery": {
        if (!isTxHash(txHash)) {
          return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
        }
        actions = [await verifyLottery(address, txHash)];
        break;
      }
      case "earn": {
        if (!isTxHash(txHash)) {
          return NextResponse.json({ error: "Missing txHash" }, { status: 400 });
        }
        actions = [await verifyEarn(address, txHash)];
        break;
      }
      case "perps": {
        // No tx hash: the wallet's fill history *is* the proof. We replay from
        // the stored cursor so a sync is cheap and never counts a fill twice.
        const profile = await getProfile(address);
        const res = await verifyPerps(address, profile.hlCursor);
        actions = res.actions;
        cursor = res.cursor;
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown source" }, { status: 400 });
    }

    const result = await award(address, actions);
    if (cursor) await setHlCursor(address, cursor);

    return NextResponse.json({
      ok: true,
      durable: isDurable(),
      ...result,
      profile: await getProfile(address),
    });
  } catch (e) {
    if (e instanceof VerifyError) {
      // 202 = "come back in a moment" (still settling), 422 = never valid.
      return NextResponse.json(
        { error: e.message, retryable: e.retryable },
        { status: e.retryable ? 202 : 422 },
      );
    }
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
