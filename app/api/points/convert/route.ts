import { NextResponse } from "next/server";
import {
  ConvertError,
  requestConversion,
  settleConversion,
} from "@/lib/points/convert";
import { getProfile, isAddress } from "@/lib/points/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Where a pending "take the win in points" request stands. */
export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    return NextResponse.json(await settleConversion(address));
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * `request` registers the choice to take points instead of ETH; `settle`
 * releases them once the contract's claim window has closed unclaimed. The UI
 * polls `settle` — it is idempotent and credits at most once.
 */
export async function POST(req: Request) {
  let body: { address?: string; action?: string };
  try {
    body = (await req.json()) as { address?: string; action?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { address, action } = body;
  if (!isAddress(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const status =
      action === "settle"
        ? await settleConversion(address)
        : await requestConversion(address);
    return NextResponse.json({
      ok: true,
      ...status,
      profile: await getProfile(address),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

function errorResponse(e: unknown) {
  if (e instanceof ConvertError) {
    return NextResponse.json(
      { error: e.message, retryable: e.retryable },
      { status: e.retryable ? 202 : 422 },
    );
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status: 500 });
}
