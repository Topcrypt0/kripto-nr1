import { NextResponse } from "next/server";
import { MORPHO_VAULT } from "@/lib/defi";

// Server-side proxy for Morpho's public GraphQL API — returns the live net APY
// and TVL for the Gauntlet USDC Prime vault. Cached at the edge for 5 min.
const MORPHO_API = "https://blue-api.morpho.org/graphql";

export const revalidate = 300;

const QUERY = `query ($address: String!, $chainId: Int!) {
  vaultByAddress(address: $address, chainId: $chainId) {
    name
    state { netApy totalAssetsUsd }
  }
}`;

export async function GET() {
  try {
    const res = await fetch(MORPHO_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: QUERY,
        variables: { address: MORPHO_VAULT, chainId: 8453 },
      }),
      next: { revalidate: 300 },
    });
    if (!res.ok) {
      return NextResponse.json({ error: `morpho ${res.status}` }, { status: 502 });
    }
    const json = await res.json();
    const state = json?.data?.vaultByAddress?.state;
    return NextResponse.json(
      {
        netApy: Number(state?.netApy ?? 0),
        tvlUsd: Number(state?.totalAssetsUsd ?? 0),
      },
      { headers: { "cache-control": "public, s-maxage=300" } },
    );
  } catch {
    return NextResponse.json({ error: "morpho unreachable" }, { status: 502 });
  }
}
