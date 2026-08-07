"use client";

// Bridges LI.FI widget execution events into the points engine. Rendered as a
// sibling of <LiFiWidget /> (the widget's event emitter is a module singleton,
// so it does not need to be inside the widget tree).
//
// Only the tx hash and the two chain ids are forwarded — the server re-reads
// the route from LI.FI's status API and decides swap vs bridge and the volume.

import { useEffect } from "react";
import { useWidgetEvents, WidgetEvent } from "@lifi/widget";
import type { Route, RouteExtended } from "@lifi/sdk";
import { useTrackPoints } from "@/lib/points/client";

/**
 * First on-chain tx of the route — the hash LI.FI's status API is keyed by.
 * The event is typed as `Route`, but a completed one always carries the
 * execution details of `RouteExtended`.
 */
function sourceTxHash(route: Route): string | undefined {
  for (const step of (route as RouteExtended).steps ?? []) {
    const tx = (step.execution?.process ?? []).find((p) => p.txHash);
    if (tx?.txHash) return tx.txHash;
  }
  return undefined;
}

export function SwapPointsEvents() {
  const widgetEvents = useWidgetEvents();
  const track = useTrackPoints();

  useEffect(() => {
    const onCompleted = (route: Route) => {
      const txHash = sourceTxHash(route);
      if (!txHash) return;
      void track({
        source: route.fromChainId === route.toChainId ? "swap" : "bridge",
        txHash,
        fromChain: route.fromChainId,
        toChain: route.toChainId,
      });
    };

    widgetEvents.on(WidgetEvent.RouteExecutionCompleted, onCompleted);
    return () => {
      widgetEvents.off(WidgetEvent.RouteExecutionCompleted, onCompleted);
    };
  }, [widgetEvents, track]);

  return null;
}
