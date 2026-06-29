"use client";

import { useEffect } from "react";

/**
 * Tells the Base App / Farcaster Mini App host that the UI is mounted so it can
 * dismiss the splash screen. No-ops in a normal browser (the SDK import simply
 * resolves and ready() throws, which we swallow).
 */
export function MiniAppReady() {
  useEffect(() => {
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        await sdk.actions.ready();
      } catch {
        /* not running inside a Mini App host — fine */
      }
    })();
  }, []);

  return null;
}
