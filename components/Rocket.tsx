"use client";

import { useEffect, useState } from "react";

type Phase = "idle" | "launching" | "result";

type Dest = {
  name: string;
  className: string;
  top: string; // distance from top of scene
  targetY: number; // px the rocket travels up (negative)
  dur: number; // flight seconds
};

// The bigger the multiplier, the farther / bigger the planet.
const DESTINATIONS: Record<number, Dest> = {
  2: { name: "Mars", className: "mars", top: "46%", targetY: -150, dur: 2.0 },
  3: { name: "Jupiter", className: "jupiter", top: "33%", targetY: -210, dur: 2.5 },
  5: { name: "Saturn", className: "saturn", top: "19%", targetY: -270, dur: 3.0 },
  10: { name: "Neptune", className: "neptune", top: "6%", targetY: -330, dur: 3.6 },
};

const CRASH = { top: "40%", targetY: -185, dur: 1.7 };

export function Rocket({
  phase,
  multiplier,
}: {
  phase: Phase;
  multiplier: number | null;
}) {
  // Bump a key every time a new launch starts so animations replay.
  const [runKey, setRunKey] = useState(0);
  useEffect(() => {
    if (phase === "launching") setRunKey((k) => k + 1);
  }, [phase]);

  const won = phase === "result" && (multiplier ?? 0) > 0;
  const crashed = phase === "result" && multiplier === 0;
  const dest = won ? DESTINATIONS[multiplier as number] : null;

  const flight = won ? dest! : CRASH;

  const sceneStyle = {
    ["--target-y" as string]: `${flight.targetY}px`,
    ["--dur" as string]: `${flight.dur}s`,
  } as React.CSSProperties;

  const rocketCls = [
    "rocket3d",
    phase === "launching" ? "rumbling" : "",
    won ? "ascending" : "",
    crashed ? "crashing" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const elonSays =
    phase === "launching"
      ? "3… 2… 1… 🚀"
      : won
        ? "To the moon! 🌕"
        : crashed
          ? "Kaboom! 💥"
          : "Ready? 🚀";

  return (
    <div className="scene3d" style={sceneStyle}>
      {/* parallax star layers */}
      <div className={`starLayer s1 ${phase === "result" ? "warp" : ""}`} aria-hidden />
      <div className={`starLayer s2 ${phase === "result" ? "warp" : ""}`} aria-hidden />
      <div className="nebula" aria-hidden />

      {/* planets — the destination one glows */}
      {Object.entries(DESTINATIONS).map(([mult, p]) => {
        const isTarget = won && Number(mult) === multiplier;
        return (
          <div
            key={p.name}
            className={`planet ${p.className} ${isTarget ? "target" : "dim"}`}
            style={{ top: p.top }}
          >
            <span className="ring" />
            {isTarget && (
              <span className="planetLabel">
                {p.name} · X{mult}
              </span>
            )}
          </div>
        );
      })}

      {/* asteroid on the crash path */}
      {(phase !== "idle") && (
        <div
          className={`asteroid ${crashed ? "hit" : ""}`}
          style={{ top: CRASH.top }}
        >
          ☄️
        </div>
      )}

      {/* the rocket */}
      <div key={runKey} className={rocketCls}>
        <RocketSvg />
        {(phase === "launching" || won) && <span className="thrust" />}
      </div>

      {/* explosion when crashing */}
      {crashed && <div className="boom" style={{ top: CRASH.top }}>💥</div>}

      {/* Earth + launch pad + Elon */}
      <div className="earth" aria-hidden />
      <div className="pad" aria-hidden />
      <div className="elon">
        <div className="bubble">{elonSays}</div>
        <div className="elonBody">🧑‍🚀</div>
        <div className="elonName">ELON</div>
      </div>

      {/* result multiplier badge */}
      {phase === "result" && multiplier !== null && (
        <div className={`multiBadge ${crashed ? "bad" : "good"}`}>
          X{multiplier}
        </div>
      )}
    </div>
  );
}

function RocketSvg() {
  return (
    <svg
      className="rocketSvg"
      width="56"
      height="120"
      viewBox="0 0 56 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff7a6e" />
          <stop offset="0.5" stopColor="#e2231a" />
          <stop offset="1" stopColor="#9e120c" />
        </linearGradient>
        <radialGradient id="win" cx="0.35" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#cfe8ff" />
          <stop offset="1" stopColor="#4a83c4" />
        </radialGradient>
      </defs>
      {/* nose */}
      <path d="M28 2 C40 18 44 34 44 50 L12 50 C12 34 16 18 28 2 Z" fill="url(#body)" />
      {/* body */}
      <rect x="12" y="50" width="32" height="44" rx="6" fill="url(#body)" />
      {/* window */}
      <circle cx="28" cy="40" r="9" fill="url(#win)" stroke="#d9d9d9" strokeWidth="2.5" />
      {/* fins */}
      <path d="M12 78 L2 102 L12 94 Z" fill="#b51009" />
      <path d="M44 78 L54 102 L44 94 Z" fill="#b51009" />
      {/* nozzle */}
      <rect x="20" y="94" width="16" height="10" rx="2" fill="#c9c9c9" />
    </svg>
  );
}
