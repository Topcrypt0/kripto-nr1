"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEther, parseEther, parseEventLogs } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import {
  CONTRACT_ADDRESS,
  MAX_BET,
  MIN_BET,
  kriptoNr1Abi,
} from "@/lib/contract";
import { DATA_SUFFIX, activeChain } from "@/lib/wagmi";
import { destMeta } from "@/lib/destinations";
import { playCrash, playLaunch, playWin, unlockAudio } from "@/lib/sound";
import { Rocket } from "@/components/Rocket";
import { History, type HistoryItem } from "@/components/History";

type Phase = "idle" | "launching" | "result";

type GameResult = {
  multiplier: number;
  bet: bigint;
  payout: bigint;
};

const PRESETS = ["0.0001", "0.0002", "0.0005", "0.001"];
const HISTORY_KEY = "kr1_history";

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [bet, setBet] = useState<string>("0.0001");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<GameResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const wrongChain = isConnected && chainId !== activeChain.id;
  const contractConfigured =
    CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  // restore prefs + history on mount
  useEffect(() => {
    try {
      setMuted(localStorage.getItem("kr1_muted") === "1");
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 10)));
    } catch {
      /* ignore */
    }
  }, [history]);

  const { data: bankroll } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    functionName: "bankroll",
    query: { refetchInterval: 15_000, enabled: contractConfigured },
  });

  const { data: pendingWinnings, refetch: refetchWinnings } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    functionName: "winnings",
    args: address ? [address] : undefined,
    query: { enabled: contractConfigured && !!address, refetchInterval: 15_000 },
  });

  const hasWinnings = (pendingWinnings ?? 0n) > 0n;

  const fetchHistory = useCallback(async () => {
    if (!publicClient || !contractConfigured) return;
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 1800n ? latest - 1800n : 0n;
      const logs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        eventName: "Launch",
        fromBlock,
        toBlock: "latest",
      });
      const onChain: HistoryItem[] = logs
        .map((l) => ({
          txHash: l.transactionHash ?? "",
          block: l.blockNumber ?? 0n,
          logIndex: l.logIndex ?? 0,
          player: (l.args as { player: string }).player,
          multiplier: Number((l.args as { multiplier: bigint }).multiplier),
          payoutWei: (l.args as { payout: bigint }).payout.toString(),
        }))
        .sort((a, b) =>
          a.block === b.block
            ? b.logIndex - a.logIndex
            : Number(b.block - a.block),
        )
        .map(({ txHash, player, multiplier, payoutWei }) => ({
          txHash,
          player,
          multiplier,
          payoutWei,
        }));

      setHistory((prev) => {
        const extra = prev.filter(
          (p) => !onChain.some((o) => o.txHash === p.txHash),
        );
        return [...extra, ...onChain].slice(0, 10);
      });
    } catch {
      /* RPC range limits / hiccups — keep local history */
    }
  }, [publicClient, contractConfigured]);

  useEffect(() => {
    fetchHistory();
    const id = setInterval(fetchHistory, 20_000);
    return () => clearInterval(id);
  }, [fetchHistory]);

  const betValid = useMemo(() => {
    const n = Number(bet);
    return Number.isFinite(n) && n >= Number(MIN_BET) && n <= Number(MAX_BET);
  }, [bet]);

  function toggleMute() {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem("kr1_muted", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function handleLaunch() {
    setError(null);
    setResult(null);

    if (!betValid) {
      setError(`Bet must be between ${MIN_BET} and ${MAX_BET} ETH`);
      return;
    }
    if (!publicClient) {
      setError("RPC client not ready, try again");
      return;
    }

    unlockAudio();
    if (!muted) playLaunch();

    try {
      setPhase("launching");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "launch",
        value: parseEther(bet),
        dataSuffix: DATA_SUFFIX,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "reverted") {
        throw new Error("Transaction reverted on-chain — please try again.");
      }

      type LaunchArgs = { multiplier: bigint; bet: bigint; payout: bigint };

      let ev = parseEventLogs({
        abi: kriptoNr1Abi,
        eventName: "Launch",
        logs: receipt.logs,
      })[0]?.args as LaunchArgs | undefined;

      // Some public RPCs return a receipt without full logs — re-query the
      // event from the mined block as a fallback before giving up.
      if (!ev) {
        const refetched = await publicClient.getContractEvents({
          address: CONTRACT_ADDRESS,
          abi: kriptoNr1Abi,
          eventName: "Launch",
          blockHash: receipt.blockHash,
        });
        ev = refetched.find((l) => l.transactionHash === hash)?.args as
          | LaunchArgs
          | undefined;
      }

      if (!ev) {
        throw new Error(
          "Couldn't read the result (RPC hiccup). Your bet went through — check the recent launches.",
        );
      }

      const mult = Number(ev.multiplier);
      setResult({ multiplier: mult, bet: ev.bet, payout: ev.payout });
      setPhase("result");
      if (mult > 0) void refetchWinnings();

      // optimistic history entry (RPC may lag a moment)
      setHistory((prev) => [
        {
          txHash: hash,
          player: address ?? "0x",
          multiplier: mult,
          payoutWei: ev.payout.toString(),
        },
        ...prev.filter((p) => p.txHash !== hash),
      ].slice(0, 10));

      // play the result sound when the rocket reaches its destination
      const durMs = destMeta(mult).durMs;
      const delay = mult > 0 ? durMs * 0.85 : durMs * 0.65;
      window.setTimeout(() => {
        if (mutedRef.current) return;
        if (mult > 0) playWin();
        else playCrash();
      }, delay);

      window.setTimeout(fetchHistory, 4000);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Transaction failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
    }
  }

  async function handleClaim() {
    if (!publicClient) return;
    setError(null);
    try {
      setClaiming(true);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "claim",
        dataSuffix: DATA_SUFFIX,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refetchWinnings();
      if (!muted) playWin();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Claim failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
    } finally {
      setClaiming(false);
    }
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
  }

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          {/* Swap public/logo.svg for your own image to use the real logo */}
          <img src="/logo.svg" alt="KRIPTO NR.1" className="logoImg" />
          <span>
            KRIPTO <span className="accent">NR.1</span>
          </span>
        </div>
        <div className="topRight">
          <button
            className="iconBtn"
            onClick={toggleMute}
            aria-label={muted ? "Unmute" : "Mute"}
            title={muted ? "Unmute" : "Mute"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {isConnected && (
            <button className="btn ghost" onClick={() => disconnect()}>
              {address?.slice(0, 6)}…{address?.slice(-4)}
            </button>
          )}
        </div>
      </header>

      <section className="stage">
        <Rocket phase={phase} multiplier={result?.multiplier ?? null} />
      </section>

      <section className="panel">
        {!contractConfigured && (
          <p className="warn">
            ⚠️ Contract address is not set. Add{" "}
            <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your environment.
          </p>
        )}

        <div className="netline">
          <span>
            Network: <b>{activeChain.name}</b>
          </span>
          {bankroll !== undefined && (
            <span>
              Bankroll: <b>{Number(formatEther(bankroll)).toFixed(4)} ETH</b>
            </span>
          )}
        </div>

        {isConnected && !wrongChain && hasWinnings && phase !== "result" && (
          <button
            className="btn launch"
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming
              ? "Claiming…"
              : `💰 Claim ${Number(formatEther(pendingWinnings!)).toFixed(4)} ETH`}
          </button>
        )}

        {!isConnected ? (
          <div className="connectRow">
            {connectors.map((c) => (
              <button
                key={c.uid}
                className="btn primary"
                disabled={isConnecting}
                onClick={() => connect({ connector: c })}
              >
                Connect {c.name}
              </button>
            ))}
          </div>
        ) : wrongChain ? (
          <button
            className="btn primary"
            onClick={() => switchChain({ chainId: activeChain.id })}
          >
            Switch to {activeChain.name}
          </button>
        ) : phase === "result" && result ? (
          <div className="resultBox">
            {result.multiplier === 0 ? (
              <p className="lose">💥 Rocket failed — X0. Try again!</p>
            ) : (
              <p className="win">
                🎉 X{result.multiplier}! Won{" "}
                {Number(formatEther(result.payout)).toFixed(4)} ETH — claim it!
              </p>
            )}
            {hasWinnings && (
              <button
                className="btn launch"
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming
                  ? "Claiming…"
                  : `💰 Claim ${Number(formatEther(pendingWinnings!)).toFixed(4)} ETH`}
              </button>
            )}
            <button className="btn primary" onClick={reset}>
              Launch again
            </button>
          </div>
        ) : (
          <>
            <label className="label">Bet amount (ETH)</label>
            <div className="presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`chip ${bet === p ? "active" : ""}`}
                  onClick={() => setBet(p)}
                  disabled={phase === "launching"}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              className="input"
              type="number"
              min={MIN_BET}
              max={MAX_BET}
              step="0.0001"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              disabled={phase === "launching"}
            />

            <button
              className="btn launch"
              onClick={handleLaunch}
              disabled={phase === "launching" || !betValid || !contractConfigured}
            >
              {phase === "launching" ? "Launching…" : "🚀 LAUNCH ROCKET"}
            </button>

            <p className="odds">
              Outcomes: X0 (65%) · X2 (22%) · X3 (8%) · X5 (4%) · X10 (1%)
            </p>
          </>
        )}

        <History items={history} you={address} />

        {error && <p className="error">{error}</p>}
      </section>

      <footer className="foot">
        <span>Open source · MIT</span>
        <span>
          Min {MIN_BET} – Max {MAX_BET} ETH
        </span>
      </footer>
    </main>
  );
}
