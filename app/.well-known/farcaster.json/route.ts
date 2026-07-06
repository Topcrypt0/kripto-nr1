import { NextResponse } from "next/server";
import { APP_NAME, SPLASH_BG, appUrl } from "@/lib/miniapp";

// Always render at request time so the URL + signature env vars are picked up
// per-deployment rather than baked in at build.
export const dynamic = "force-dynamic";

/**
 * Base Mini App manifest, served at https://<domain>/.well-known/farcaster.json
 *
 * The `accountAssociation` proves this domain belongs to you. Generate it once
 * with the Base manifest tool (https://base.dev → your app → Manifest, or the
 * Farcaster Mini App manifest tool) for your PRODUCTION domain, then set
 * FARCASTER_HEADER / FARCASTER_PAYLOAD / FARCASTER_SIGNATURE in Vercel. Until
 * those are set the manifest still serves (so previews render), but Base won't
 * mark the app as verified/published.
 */
export function GET() {
  const url = appUrl();

  const miniapp = {
    version: "1",
    name: APP_NAME,
    subtitle: "Rocket Lottery on Base",
    description:
      "Launch the rocket and win up to X10. Provably-fair on-chain crash game on Base. Bet from 0.0001 ETH.",
    iconUrl: `${url}/hero.png`,
    homeUrl: `${url}/lottery`,
    imageUrl: `${url}/hero.png`,
    heroImageUrl: `${url}/hero.png`,
    splashImageUrl: `${url}/hero.png`,
    splashBackgroundColor: SPLASH_BG,
    primaryCategory: "games",
    tags: ["game", "crypto", "base", "rocket", "lottery"],
    buttonTitle: "🚀 Launch rocket",
  };

  const manifest: Record<string, unknown> = {
    // `frame` (legacy) and `miniapp` (current) carry the same payload so both
    // older and newer Base/Farcaster clients can read it.
    frame: miniapp,
    miniapp,
  };

  const { FARCASTER_HEADER, FARCASTER_PAYLOAD, FARCASTER_SIGNATURE } =
    process.env;
  if (FARCASTER_HEADER && FARCASTER_PAYLOAD && FARCASTER_SIGNATURE) {
    manifest.accountAssociation = {
      header: FARCASTER_HEADER,
      payload: FARCASTER_PAYLOAD,
      signature: FARCASTER_SIGNATURE,
    };
  }

  // Optional: register your Base Build wallet so the app shows in your portfolio.
  if (process.env.BASE_BUILDER_ADDRESS) {
    manifest.baseBuilder = {
      allowedAddresses: [process.env.BASE_BUILDER_ADDRESS],
    };
  }

  return NextResponse.json(manifest);
}
