// Shared Base Mini App config: the canonical app URL + manifest metadata.
// Used by app/layout.tsx (embed meta) and the /.well-known/farcaster.json route.

/** Absolute, protocol-prefixed origin for this deployment, no trailing slash. */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  // In the browser, the live origin is always correct — so share links work
  // even when NEXT_PUBLIC_URL isn't set (VERCEL_PROJECT_PRODUCTION_URL is not
  // exposed client-side).
  if (typeof window !== "undefined") return window.location.origin;
  // Server-side: stable production domain Vercel injects into every environment.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const APP_NAME = "KRIPTO NR.1";
export const SPLASH_BG = "#04060f";

/** The Mini App embed object shared by the `fc:miniapp` / `fc:frame` meta tags. */
export function embed(url = appUrl()) {
  return {
    version: "1",
    imageUrl: `${url}/hero.png`,
    button: {
      title: "🚀 Launch rocket",
      action: {
        type: "launch_miniapp",
        // Mini App users land straight in the rocket game; the full DEX
        // platform (swap/perps/predict) lives at the root for web visitors.
        url: `${url}/lottery`,
        name: APP_NAME,
        splashImageUrl: `${url}/hero.png`,
        splashBackgroundColor: SPLASH_BG,
      },
    },
  };
}
