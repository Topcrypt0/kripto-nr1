"use client";

// Mounted once in the root layout. Two jobs:
//   1. bind the captured `?ref=` inviter as soon as a wallet is known;
//   2. show a toast whenever points land, from whichever tab earned them.

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { getReferrer } from "@/lib/referral";
import { POINTS_EVENT, flushQueue, type TrackResult } from "@/lib/points/client";
import { formatPoints } from "@/lib/points/config";

export function PointsTracker() {
  const { address } = useAccount();
  const qc = useQueryClient();
  const [toast, setToast] = useState<TrackResult | null>(null);

  // Bind the inviter once per wallet, then retry anything the last session
  // could not confirm (a swap whose route was still indexing, say).
  useEffect(() => {
    if (!address) return;
    const ref = getReferrer();
    if (ref && ref.toLowerCase() !== address.toLowerCase()) {
      void fetch("/api/points/referral", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ref }),
      }).catch(() => undefined);
    }
    flushQueue(address);
  }, [address]);

  useEffect(() => {
    const onPoints = (e: Event) => {
      setToast((e as CustomEvent<TrackResult>).detail);
      void qc.invalidateQueries({ queryKey: ["points"] });
    };
    window.addEventListener(POINTS_EVENT, onPoints);
    return () => window.removeEventListener(POINTS_EVENT, onPoints);
  }, [qc]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 7_000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className="ptToast" role="status" onClick={() => setToast(null)}>
      <div className="ptToastHead">
        <span className="ptToastBig">+{formatPoints(toast.awarded)}</span>
        <span className="ptToastUnit">points</span>
      </div>
      {toast.multiplier > 1 && (
        <div className="ptToastLine">
          🔥 {toast.streak}-day streak · ×{toast.multiplier.toFixed(2)}
        </div>
      )}
      {toast.referralAwarded > 0 && (
        <div className="ptToastLine">
          👥 +{formatPoints(toast.referralAwarded)} to your inviter
        </div>
      )}
      {toast.details.slice(0, 2).map((d) => (
        <div className="ptToastLine" key={d}>
          {d}
        </div>
      ))}
      <a className="ptToastLink" href="/points">
        View dashboard →
      </a>
    </div>
  );
}
