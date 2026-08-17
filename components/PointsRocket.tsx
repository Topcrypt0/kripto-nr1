"use client";

// The rocket, played with points. Same odds, same commit-reveal, no contract
// involved: the round is committed against a Base block that does not exist
// yet, then revealed from that block's hash.

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import {
  launchPointsRound,
  revealPointsRound,
  useRocketState,
  type RocketRound,
} from "@/lib/points/client";
import {
  ROCKET_TABLE,
  formatPoints,
  multiplierForRoll,
} from "@/lib/points/config";
import { Rocket } from "@/components/Rocket";
import { playCrash, playLaunch, playWin, unlockAudio } from "@/lib/sound";

type Phase = "idle" | "flying" | "result";

const PRESETS = [100, 250, 500, 1_000, 5_000];

export function PointsRocket({ muted = false }: { muted?: boolean }) {
  const { address, isConnected } = useAccount();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useRocketState(address);

  const [bet, setBet] = useState("250");
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<RocketRound | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const balance = data?.balance ?? 0;
  const limits = data?.limits;
  const pending = data?.pending ?? null;

  const amount = Math.floor(Number(bet));
  const betValid =
    Number.isFinite(amount) &&
    !!limits &&
    amount >= limits.min &&
    amount <= Math.min(limits.max, limits.maxAffordable);

  const finish = useCallback(
    (settled: RocketRound) => {
      setRound(settled);
      setPhase("result");
      if (!muted) ((settled.multiplier ?? 0) > 0 ? playWin : playCrash)();
      void qc.invalidateQueries({ queryKey: ["points"] });
    },
    [muted, qc],
  );

  // A round committed in a previous session (closed tab, reload) is still
  // owed a reveal — the stake is already spent, so finish it automatically.
  useEffect(() => {
    if (!address || !pending || busy || phase !== "idle") return;
    setBusy(true);
    setPhase("flying");
    void revealPointsRound(address, pending.id).then((res) => {
      setBusy(false);
      if (res.round) finish(res.round);
      else {
        setPhase("idle");
        setError(res.error ?? null);
      }
    });
  }, [address, pending, busy, phase, finish]);

  const launch = useCallback(async () => {
    if (!address || !betValid) return;
    setError(null);
    setBusy(true);
    unlockAudio();
    if (!muted) playLaunch();
    setPhase("flying");

    const res = await launchPointsRound(address, amount);
    if (res.status !== 200 || !res.round) {
      setBusy(false);
      setPhase("idle");
      setError(res.error ?? "Could not start the round");
      void refetch();
      return;
    }
    void qc.invalidateQueries({ queryKey: ["points"] });

    const revealed = await revealPointsRound(address, res.round.id);
    setBusy(false);
    if (revealed.round) finish(revealed.round);
    else {
      setPhase("idle");
      setError(revealed.error ?? "Reveal failed — reload to finish the round");
    }
  }, [address, amount, betValid, muted, qc, refetch, finish]);

  const reset = () => {
    setPhase("idle");
    setRound(null);
    setError(null);
  };

  const rocketPhase =
    phase === "flying" ? "launching" : phase === "result" ? "result" : "idle";

  if (!isConnected) {
    return (
      <div className="prBox">
        <p className="prNote">
          Connect your wallet to spin points. Points come from trading — swap,
          bridge, perps, Earn or a real ETH launch.
        </p>
      </div>
    );
  }

  return (
    <div className="prBox">
      <Rocket
        phase={rocketPhase}
        multiplier={phase === "result" ? (round?.multiplier ?? null) : null}
      />

      <div className="prBalRow">
        <div className="prBal">
          <span className="prBalLabel">Your points</span>
          <span className="prBalValue">
            {isLoading ? "…" : formatPoints(balance)}
          </span>
        </div>
        <div className="prBal">
          <span className="prBalLabel">Pool</span>
          <span className="prBalValue prDim">
            {formatPoints(data?.pool.available ?? 0)}
          </span>
        </div>
      </div>

      {phase === "result" && round ? (
        <div className="prResult">
          <p className={(round.multiplier ?? 0) > 0 ? "win" : "lose"}>
            {(round.multiplier ?? 0) > 0
              ? `🎉 X${round.multiplier}! +${formatPoints(round.payout ?? 0)} points`
              : `💥 X0 — ${formatPoints(round.bet)} points lost`}
          </p>
          <Proof round={round} />
          <button className="btn launchAgain" onClick={reset}>
            Spin again
          </button>
        </div>
      ) : (
        <>
          <div className="prBetRow">
            <input
              className="prInput"
              inputMode="numeric"
              value={bet}
              disabled={busy}
              onChange={(e) => setBet(e.target.value.replace(/[^\d]/g, ""))}
              aria-label="Points to bet"
            />
            <span className="prUnit">pts</span>
          </div>
          <div className="prPresets">
            {PRESETS.map((p) => (
              <button
                key={p}
                className={`prPreset${amount === p ? " prPresetOn" : ""}`}
                disabled={busy}
                onClick={() => setBet(String(p))}
              >
                {formatPoints(p)}
              </button>
            ))}
            <button
              className="prPreset"
              disabled={busy || !limits}
              onClick={() =>
                setBet(String(Math.max(limits?.min ?? 0, limits?.maxAffordable ?? 0)))
              }
            >
              MAX
            </button>
          </div>

          <button
            className={`btn launch${busy ? " busy" : ""}`}
            disabled={busy || !betValid || !data?.pool.open}
            onClick={launch}
          >
            {busy ? (
              <>
                <span className="spinner" />
                Flying…
              </>
            ) : (
              `🚀 Launch for ${formatPoints(amount || 0)} points`
            )}
          </button>

          <p className="minmax">
            {data && !data.pool.open
              ? "The points pool is empty — spins are paused until it is topped up."
              : `Bet ${formatPoints(limits?.min ?? 0)}–${formatPoints(
                  Math.min(limits?.max ?? 0, limits?.maxAffordable ?? 0),
                )} points. Spins earn no new points — only the pool pays.`}
          </p>
        </>
      )}

      {error && <p className="prError">{error}</p>}

      <Odds />

      {(data?.history.length ?? 0) > 0 && (
        <div className="prHistory">
          <div className="prHistoryHead">Recent spins</div>
          {data!.history
            .filter((r) => r.status === "settled")
            .slice(0, 8)
            .map((r) => (
              <div className="prHistoryRow" key={r.id}>
                <span className={(r.multiplier ?? 0) > 0 ? "up" : "down"}>
                  X{r.multiplier ?? 0}
                </span>
                <span className="prDim">{formatPoints(r.bet)} pts</span>
                <span className={(r.multiplier ?? 0) > 0 ? "up" : "down"}>
                  {(r.multiplier ?? 0) > 0
                    ? `+${formatPoints((r.payout ?? 0) - r.bet)}`
                    : `−${formatPoints(r.bet)}`}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

/** Everything needed to recompute the round by hand. */
function Proof({ round }: { round: RocketRound }) {
  const [open, setOpen] = useState(false);
  if (!round.blockHash) return null;
  const recomputed = multiplierForRoll(round.roll ?? 0);
  return (
    <div className="prProof">
      <button className="prProofToggle" onClick={() => setOpen((v) => !v)}>
        {open ? "Hide" : "Verify this spin"} 🔍
      </button>
      {open && (
        <div className="prProofBody">
          <div>
            Base block <strong>#{round.targetBlock}</strong>
          </div>
          <div className="prProofHash">{round.blockHash}</div>
          <div>
            roll = keccak256(blockHash, you, {formatPoints(round.bet)}) % 10000 ={" "}
            <strong>{round.roll}</strong> → X{recomputed}
          </div>
          <div className="prDim">
            The block was chosen before it existed, so neither side could pick
            it. Same formula and same odds table as the ETH contract.
          </div>
        </div>
      )}
    </div>
  );
}

function Odds() {
  return (
    <div className="prOdds">
      {ROCKET_TABLE.map((row) => (
        <div className="prOddsCell" key={row.multiplier}>
          <span className={row.multiplier > 0 ? "up" : "down"}>
            X{row.multiplier}
          </span>
          <span className="prDim">{row.chance}%</span>
        </div>
      ))}
    </div>
  );
}
