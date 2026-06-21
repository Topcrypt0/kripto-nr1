"use client";

type Phase = "idle" | "launching" | "result";

export function Rocket({
  phase,
  multiplier,
}: {
  phase: Phase;
  multiplier: number | null;
}) {
  const failed = phase === "result" && multiplier === 0;
  const won = phase === "result" && (multiplier ?? 0) > 0;

  // Higher multiplier => rocket flies higher on a win.
  const flyHeight = won ? Math.min(40 + (multiplier ?? 0) * 22, 280) : 0;

  const cls = [
    "rocket",
    phase === "launching" ? "isLaunching" : "",
    won ? "isWin" : "",
    failed ? "isFail" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rocketScene">
      <div className="stars" aria-hidden />
      <div
        className={cls}
        style={won ? { transform: `translateY(-${flyHeight}px)` } : undefined}
      >
        <div className="rocketBody">🚀</div>
        {phase === "launching" || won ? <div className="flame" /> : null}
      </div>

      {phase === "result" && multiplier !== null && (
        <div className={`multiBadge ${failed ? "bad" : "good"}`}>
          X{multiplier}
        </div>
      )}
    </div>
  );
}
