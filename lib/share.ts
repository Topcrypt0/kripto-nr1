import { appUrl } from "@/lib/miniapp";

export type CardParams = {
  win: boolean;
  big: string; // hero text, e.g. "X10" or "+42%"
  pct: string; // signed percent label, e.g. "+900%" / "-100%"
  sub: string; // one-line subtitle
};

/** Absolute URL of the dynamically-rendered PnL card PNG. */
export function cardUrl(p: CardParams): string {
  const q = new URLSearchParams({
    win: p.win ? "1" : "0",
    big: p.big,
    pct: p.pct,
    sub: p.sub,
  });
  return `${appUrl()}/api/card?${q.toString()}`;
}

export type ShareOutcome = "cast" | "web" | "copied" | "failed";

/**
 * Share a card. Prefers a Farcaster/Base App cast (so the image embeds in-feed),
 * falls back to the native Web Share sheet, then to copying the link.
 */
export async function shareCard(
  url: string,
  text: string,
): Promise<ShareOutcome> {
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const inMini = await sdk.isInMiniApp().catch(() => false);
    if (inMini) {
      await sdk.actions.composeCast({ text, embeds: [url] });
      return "cast";
    }
  } catch {
    /* not in a mini app host */
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: "KRIPTO NR.1", text, url });
      return "web";
    } catch {
      /* user cancelled or unsupported — fall through */
    }
  }

  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
