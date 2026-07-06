import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for the public Polymarket Gamma API: avoids browser CORS
// issues and lets us cache the hot market list at the edge for a minute.
const GAMMA = "https://gamma-api.polymarket.com/events";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const tag = req.nextUrl.searchParams.get("tag") ?? "";
  const limit = Math.min(
    Number(req.nextUrl.searchParams.get("limit") ?? "40") || 40,
    100,
  );

  const params = new URLSearchParams({
    limit: String(limit),
    active: "true",
    closed: "false",
    archived: "false",
    order: "volume24hr",
    ascending: "false",
  });
  if (tag) params.set("tag_slug", tag);

  try {
    const res = await fetch(`${GAMMA}?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `gamma ${res.status}` },
        { status: 502 },
      );
    }
    const events = await res.json();
    return NextResponse.json(events, {
      headers: { "cache-control": "public, s-maxage=60" },
    });
  } catch {
    return NextResponse.json({ error: "gamma unreachable" }, { status: 502 });
  }
}
