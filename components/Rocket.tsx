"use client";

import dynamic from "next/dynamic";
import { DEST_META } from "@/lib/destinations";

type Phase = "idle" | "launching" | "result";

// WebGL only runs in the browser — load the Three.js scene client-side.
const RocketScene = dynamic(() => import("@/components/RocketScene"), {
  ssr: false,
  loading: () => <div className="sceneLoading">Booting launch systems…</div>,
});

/**
 * Hybrid launch stage:
 *   idle   -> glossy hero key-art (hero.png) sits on the pad
 *   else   -> real-time Three.js 3D flight (RocketScene) over a space backdrop
 * The handoff design chrome (destination chip, result badge, ELON pilot) is
 * layered on top in both cases.
 */
export function Rocket({
  phase,
  multiplier,
}: {
  phase: Phase;
  multiplier: number | null;
}) {
  const isIdle = phase === "idle";
  const won = phase === "result" && (multiplier ?? 0) > 0;
  const crashed = phase === "result" && multiplier === 0;
  const showBadge = phase === "result" && multiplier !== null;
  const dest = won ? DEST_META[multiplier as number] : null;

  const pilotSays =
    phase === "launching"
      ? "3… 2… 1… 🚀"
      : won
        ? `To ${dest?.name ?? "orbit"}! 🌕`
        : crashed
          ? "Kaboom! 💥"
          : "Ready? 🚀";

  return (
    <div className="scene3d" data-stage={isIdle ? "idle" : "flight"}>
      {/* glossy hero key-art (idle) */}
      <div className="heroLayer">
        <img src="/hero.png" alt="" className="heroImg" />
        <div className="heroGrad" />
        <div className="statusTag">● SYSTEMS NOMINAL</div>
        <div className="tapHint">★ Tap launch to fly</div>
      </div>

      {/* real-time 3D flight scene */}
      <div className="webglLayer">
        {!isIdle && <RocketScene phase={phase} multiplier={multiplier} />}
      </div>

      {/* design chrome */}
      <div className="sceneOverlay" aria-hidden>
        {won && dest && (
          <div className="destChip">
            <span>{dest.emoji}</span> {dest.name} · X{multiplier}
          </div>
        )}

        {showBadge && (
          <div className={`multiBadge ${crashed ? "bad" : "good"}`}>
            {crashed ? "X0" : `X${multiplier}`}
          </div>
        )}

        {!isIdle && (
          <div className="pilot">
            <div className="bubble">{pilotSays}</div>
            <div className="pilotRow">
              <div className="pilotBody">🧑‍🚀</div>
              <div className="pilotName">ELON</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
