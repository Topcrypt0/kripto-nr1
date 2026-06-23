"use client";

import { useEffect, useState } from "react";
import { DEST_META } from "@/lib/destinations";

type Phase = "idle" | "launching" | "result";

type Geo = {
  className: string;
  top: string; // distance from top of scene
  targetY: number; // px the rocket travels up (negative)
};

// Visual placement per multiplier. Names/durations come from DEST_META so the
// scene, the sounds and the history stay perfectly in sync.
const GEO: Record<number, Geo> = {
  2: { className: "mars", top: "46%", targetY: -150 },
  3: { className: "jupiter", top: "33%", targetY: -210 },
  5: { className: "saturn", top: "19%", targetY: -270 },
  10: { className: "neptune", top: "6%", targetY: -330 },
};

const CRASH = { top: "40%", targetY: -185 };

export function Rocket({
  phase,
  multiplier,
}: {
  phase: Phase;
  multiplier: number | null;
}) {
  const [runKey, setRunKey] = useState(0);
  useEffect(() => {
    if (phase === "launching") setRunKey((k) => k + 1);
  }, [phase]);

  const won = phase === "result" && (multiplier ?? 0) > 0;
  const crashed = phase === "result" && multiplier === 0;
  const geo = won ? GEO[multiplier as number] : CRASH;
  const durMs = (won ? DEST_META[multiplier as number] : DEST_META[0]).durMs;

  const sceneStyle = {
    ["--target-y" as string]: `${geo.targetY}px`,
    ["--dur" as string]: `${durMs / 1000}s`,
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
      <div className={`starLayer s1 ${phase === "result" ? "warp" : ""}`} aria-hidden />
      <div className={`starLayer s2 ${phase === "result" ? "warp" : ""}`} aria-hidden />
      <div className="nebula" aria-hidden />

      {Object.entries(GEO).map(([mult, p]) => {
        const isTarget = won && Number(mult) === multiplier;
        return (
          <div
            key={p.className}
            className={`planet ${p.className} ${isTarget ? "target" : "dim"}`}
            style={{ top: p.top }}
          >
            <PlanetSvg kind={p.className} />
            {isTarget && (
              <span className="planetLabel">
                {DEST_META[Number(mult)].name} · X{mult}
              </span>
            )}
          </div>
        );
      })}

      {phase !== "idle" && (
        <div
          className={`asteroid ${crashed ? "hit" : ""}`}
          style={{ top: CRASH.top }}
        >
          ☄️
        </div>
      )}

      <div key={runKey} className={rocketCls}>
        <RocketSvg />
        {(phase === "launching" || won) && <span className="thrust" />}
      </div>

      {crashed && <div className="boom" style={{ top: CRASH.top }}>💥</div>}

      <div className="earth" aria-hidden>
        <EarthSvg />
      </div>
      <div className="pad" aria-hidden />
      <div className="elon">
        <div className="bubble">{elonSays}</div>
        <div className="elonBody">🧑‍🚀</div>
        <div className="elonName">ELON</div>
      </div>

      {phase === "result" && multiplier !== null && (
        <div className={`multiBadge ${crashed ? "bad" : "good"}`}>
          X{multiplier}
        </div>
      )}
    </div>
  );
}

function PlanetSvg({ kind }: { kind: string }) {
  if (kind === "neptune") {
    return (
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id="nepG" cx="0.36" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#bcd6ff" />
            <stop offset="0.55" stopColor="#3050cf" />
            <stop offset="1" stopColor="#0d164f" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#nepG)" />
        <ellipse cx="46" cy="64" rx="40" ry="7" fill="#16235f" opacity="0.4" />
        <ellipse cx="52" cy="40" rx="30" ry="4" fill="#dcebff" opacity="0.18" />
        <circle cx="60" cy="44" r="5" fill="#1a2a7a" opacity="0.4" />
      </svg>
    );
  }
  if (kind === "saturn") {
    return (
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id="satG" cx="0.36" cy="0.3" r="0.85">
            <stop offset="0" stopColor="#fce6ad" />
            <stop offset="0.6" stopColor="#c2922f" />
            <stop offset="1" stopColor="#5f4517" />
          </radialGradient>
          <linearGradient id="satRing" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#d9c084" stopOpacity="0.15" />
            <stop offset="0.5" stopColor="#f3e0a8" />
            <stop offset="1" stopColor="#d9c084" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <ellipse cx="50" cy="54" rx="72" ry="18" fill="none" stroke="url(#satRing)" strokeWidth="7" />
        <circle cx="50" cy="50" r="40" fill="url(#satG)" />
        <ellipse cx="50" cy="44" rx="36" ry="7" fill="#7a5a1e" opacity="0.3" />
        <path d="M-22 54 A72 18 0 0 0 122 54" fill="none" stroke="url(#satRing)" strokeWidth="7" />
      </svg>
    );
  }
  if (kind === "jupiter") {
    return (
      <svg viewBox="0 0 100 100">
        <defs>
          <radialGradient id="jupG" cx="0.36" cy="0.3" r="0.9">
            <stop offset="0" stopColor="#f6dcb6" />
            <stop offset="0.6" stopColor="#b07a42" />
            <stop offset="1" stopColor="#5e3e20" />
          </radialGradient>
          <clipPath id="jupClip"><circle cx="50" cy="50" r="48" /></clipPath>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#jupG)" />
        <g clipPath="url(#jupClip)" opacity="0.5">
          <rect x="2" y="28" width="96" height="7" fill="#9c6a38" />
          <rect x="2" y="44" width="96" height="10" fill="#caa06a" />
          <rect x="2" y="62" width="96" height="7" fill="#8c5e30" />
          <ellipse cx="64" cy="58" rx="9" ry="5" fill="#d8633a" />
        </g>
      </svg>
    );
  }
  // mars
  return (
    <svg viewBox="0 0 100 100">
      <defs>
        <radialGradient id="marsG" cx="0.36" cy="0.3" r="0.9">
          <stop offset="0" stopColor="#ffae84" />
          <stop offset="0.6" stopColor="#c4470f" />
          <stop offset="1" stopColor="#5e2105" />
        </radialGradient>
        <clipPath id="marsClip"><circle cx="50" cy="50" r="48" /></clipPath>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#marsG)" />
      <g clipPath="url(#marsClip)" opacity="0.5">
        <circle cx="38" cy="42" r="9" fill="#7e2c08" />
        <circle cx="62" cy="60" r="7" fill="#8e3409" />
        <ellipse cx="50" cy="18" rx="14" ry="7" fill="#f2d9c0" />
      </g>
    </svg>
  );
}

function EarthSvg() {
  return (
    <svg viewBox="0 0 200 200">
      <defs>
        <radialGradient id="earthG" cx="0.36" cy="0.26" r="0.95">
          <stop offset="0" stopColor="#a7e0ff" />
          <stop offset="0.4" stopColor="#2f86d6" />
          <stop offset="1" stopColor="#0a2b66" />
        </radialGradient>
        <clipPath id="earthClip"><circle cx="100" cy="100" r="96" /></clipPath>
      </defs>
      <circle cx="100" cy="100" r="96" fill="url(#earthG)" />
      <g clipPath="url(#earthClip)">
        <path d="M40 60 q34 -8 60 8 q22 16 4 38 q-28 18 -60 4 q-26 -14 -4 -50 Z" fill="#1f7a4d" />
        <path d="M120 56 q44 -2 70 24 q16 22 -14 36 q-40 12 -66 -14 q-18 -24 10 -46 Z" fill="#23824f" />
        <path d="M70 128 q34 0 48 24 q4 20 -28 26 q-40 2 -50 -24 q-2 -22 30 -26 Z" fill="#1d6f45" />
        <g fill="#ffffff" opacity="0.65">
          <ellipse cx="70" cy="78" rx="30" ry="8" />
          <ellipse cx="132" cy="124" rx="34" ry="9" />
          <ellipse cx="66" cy="140" rx="24" ry="7" />
        </g>
        <path d="M120 4 A96 96 0 0 1 130 200 L210 200 L210 4 Z" fill="#020b22" opacity="0.5" />
      </g>
    </svg>
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
        <linearGradient id="rkHull" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffd0c8" />
          <stop offset="0.28" stopColor="#ff6b5e" />
          <stop offset="0.6" stopColor="#d81d14" />
          <stop offset="1" stopColor="#7d0d07" />
        </linearGradient>
        <radialGradient id="rkWin" cx="0.35" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#eaf4ff" />
          <stop offset="1" stopColor="#3f6fb0" />
        </radialGradient>
      </defs>
      {/* nose + body */}
      <path d="M28 4 C41 21 45 38 45 55 L11 55 C11 38 15 21 28 4 Z" fill="url(#rkHull)" />
      <rect x="11" y="55" width="34" height="46" rx="7" fill="url(#rkHull)" />
      {/* shadow side */}
      <path d="M28 4 C34 14 36 26 36 55 L45 55 C45 38 41 21 28 4 Z" fill="#7d0d07" opacity="0.4" />
      {/* highlight stripe */}
      <rect x="15" y="58" width="3" height="40" rx="1.5" fill="#ffd9d2" opacity="0.7" />
      {/* panel lines */}
      <line x1="11" y1="70" x2="45" y2="70" stroke="#7d0d07" strokeWidth="1" opacity="0.4" />
      <line x1="11" y1="86" x2="45" y2="86" stroke="#7d0d07" strokeWidth="1" opacity="0.4" />
      {/* window */}
      <circle cx="28" cy="43" r="9" fill="url(#rkWin)" stroke="#eef4ff" strokeWidth="2" />
      <circle cx="25" cy="40" r="2.5" fill="#ffffff" opacity="0.85" />
      {/* fins */}
      <path d="M11 80 L1 104 L11 95 Z" fill="#8d0f08" />
      <path d="M45 80 L55 104 L45 95 Z" fill="#a3140b" />
      {/* nozzle */}
      <rect x="18" y="100" width="20" height="9" rx="2" fill="#cfcfcf" />
      <rect x="18" y="100" width="20" height="3" rx="1.5" fill="#f3f3f3" />
    </svg>
  );
}
