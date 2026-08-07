"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { usePointsProfile } from "@/lib/points/client";
import { formatPoints } from "@/lib/points/config";

/** Compact points chip for the nav bar — the always-visible hook back to /points. */
export function PointsBadge({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { data } = usePointsProfile(address);

  if (!isConnected) return null;
  const p = data?.profile;

  return (
    <Link
      href="/points"
      className={`ptBadge${className ? ` ${className}` : ""}`}
      title={p ? `${p.tier.name} · rank ${p.rank ?? "—"}` : "Your KRIPTO points"}
    >
      <span className="ptBadgeIcon">{p?.tier.emoji ?? "✨"}</span>
      <span className="ptBadgeValue">{formatPoints(p?.total ?? 0)}</span>
      <span className="ptBadgeUnit">pts</span>
    </Link>
  );
}
