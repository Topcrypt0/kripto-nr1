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
import {
  type GameRecord,
  computeStats,
  gamePct,
  loadGames,
  mergeGames,
} from "@/lib/stats";
import { cardUrl, shareCard } from "@/lib/share";
import { Rocket } from "@/components/Rocket";
import { History, type HistoryItem } from "@/components/History";
import { Dashboard } from "@/components/Dashboard";

type Phase = "idle" | "committing" | "revealing" | "result";

type GameResult = {
  multiplier: number;
  bet: bigint;
  payout: bigint;
  refunded: boolean;
};

type ResolvedArgs = {
  bet: bigint;
  multiplier: bigint;
  payout: bigint;
  roll: bigint;
  refunded: boolean;
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [games, setGames] = useState<GameRecord[]>([]);
  // Drives the pending state from the local game flow instead of the laggy
  // on-chain read, so you can relaunch the instant a game resolves. null = no
  // local opinion yet (e.g. fresh load) → defer to chain.
  const [localPending, setLocalPending] = useState<boolean | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const wrongChain = isConnected && chainId !== activeChain.id;
  const contractConfigured =
    CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const stats = useMemo(() => computeStats(games), [games]);

  useEffect(() => {
    try {
      setMuted(localStorage.getItem("kr1_muted") === "1");
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw) as HistoryItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  // Load this account's ledger; reset the local-pending opinion on switch.
  useEffect(() => {
    setGames(loadGames(address));
    setLocalPending(null);
  }, [address]);

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

  const { data: pendingGame, refetch: refetchGames } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    functionName: "games",
    args: address ? [address] : undefined,
    query: { enabled: contractConfigured && !!address, refetchInterval: 12_000 },
  });

  // games() returns [bet, targetBlock, active]. Local flow wins when it has an
  // opinion; otherwise fall back to the chain read (recovery after a reload).
  const hasPending =
    localPending !== null ? localPending : pendingGame?.[2] === true;

  const fetchHistory = useCallback(async () => {
    if (!publicClient || !contractConfigured) return;
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = latest > 1800n ? latest - 1800n : 0n;
      const logs = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        eventName: "Resolved",
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

      // Backfill this player's ledger from on-chain logs (exact bet + refunded).
      if (address) {
        const mine: GameRecord[] = logs
          .filter(
            (l) =>
              (l.args as { player?: string }).player?.toLowerCase() ===
              address.toLowerCase(),
          )
          .map((l) => {
            const a = l.args as unknown as ResolvedArgs;
            return {
              txHash: l.transactionHash ?? "",
              betWei: (a.bet ?? 0n).toString(),
              multiplier: Number(a.multiplier),
              payoutWei: (a.payout ?? 0n).toString(),
              refunded: Boolean(a.refunded),
              ts: Number(l.blockNumber ?? 0n),
            };
          });
        if (mine.length) setGames(mergeGames(address, mine));
      }
    } catch {
      /* keep local history on RPC hiccups */
    }
  }, [publicClient, contractConfigured, address]);

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

  async function waitForBlock(target: bigint) {
    if (!publicClient) return;
    for (let i = 0; i < 40; i++) {
      const bn = await publicClient.getBlockNumber();
      if (bn > target) return;
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("Timed out waiting for the reveal block — try Reveal again.");
  }

  // Step 2: reveal + pay. targetBlock is read from chain if not provided.
  async function resolveGame(targetBlock?: bigint, betWei?: bigint) {
    if (!publicClient || !address) return;
    setPhase("revealing");

    let target = targetBlock;
    let stake = betWei;
    if (target === undefined) {
      const g = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "games",
        args: [address],
      })) as readonly [bigint, bigint, boolean];
      if (!g[2]) {
        // Nothing pending on-chain — clear local flag and bail to idle.
        setLocalPending(false);
        setPhase("idle");
        return;
      }
      stake = g[0];
      target = g[1];
    }

    await waitForBlock(target);

    const hash = await writeContractAsync({
      address: CONTRACT_ADDRESS,
      abi: kriptoNr1Abi,
      functionName: "resolve",
      args: [address],
      dataSuffix: DATA_SUFFIX,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === "reverted") {
      throw new Error("Reveal reverted on-chain — try Reveal again.");
    }

    let ev = parseEventLogs({
      abi: kriptoNr1Abi,
      eventName: "Resolved",
      logs: receipt.logs,
    })[0]?.args as ResolvedArgs | undefined;

    if (!ev) {
      const refetched = await publicClient.getContractEvents({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        eventName: "Resolved",
        blockHash: receipt.blockHash,
      });
      ev = refetched.find((l) => l.transactionHash === hash)?.args as
        | ResolvedArgs
        | undefined;
    }
    if (!ev) {
      throw new Error("Couldn't read the result (RPC hiccup) — check history.");
    }

    const mult = Number(ev.multiplier);
    const stakeWei = ev.bet ?? stake ?? 0n;
    setResult({
      multiplier: mult,
      bet: stakeWei,
      payout: ev.payout,
      refunded: ev.refunded,
    });
    setPhase("result");
    // The game is settled on-chain — let the player relaunch immediately.
    setLocalPending(false);

    setHistory((prev) =>
      [
        {
          txHash: hash,
          player: address,
          multiplier: mult,
          payoutWei: ev!.payout.toString(),
        },
        ...prev.filter((p) => p.txHash !== hash),
      ].slice(0, 10),
    );

    setGames(
      mergeGames(address, [
        {
          txHash: hash,
          betWei: stakeWei.toString(),
          multiplier: mult,
          payoutWei: ev.payout.toString(),
          refunded: ev.refunded,
          ts: Date.now(),
        },
      ]),
    );

    const durMs = destMeta(mult).durMs;
    const delay = mult > 0 ? durMs * 0.85 : durMs * 0.65;
    window.setTimeout(() => {
      if (mutedRef.current) return;
      if (mult > 0) playWin();
      else playCrash();
    }, delay);

    void refetchGames();
    window.setTimeout(fetchHistory, 4000);
  }

  // Step 1: commit the bet, then auto-reveal.
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
      setPhase("committing");
      const stake = parseEther(bet);
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "launch",
        value: stake,
        dataSuffix: DATA_SUFFIX,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Launch reverted on-chain — please try again.");
      }
      // Bet is committed — there's now a pending game until we reveal it.
      setLocalPending(true);
      void refetchGames();
      await resolveGame(receipt.blockNumber + 1n, stake);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Transaction failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
    }
  }

  async function handleReveal() {
    setError(null);
    setResult(null);
    try {
      await resolveGame();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Reveal failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
    }
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
  }

  async function runShare(
    params: Parameters<typeof cardUrl>[0],
    text: string,
  ) {
    if (sharing) return;
    setSharing(true);
    setShareMsg(null);
    const outcome = await shareCard(cardUrl(params), text);
    setSharing(false);
    setShareMsg(
      outcome === "cast"
        ? "Shared to your feed!"
        : outcome === "web"
          ? "Shared!"
          : outcome === "copied"
            ? "Card link copied!"
            : "Couldn't share — try again",
    );
    window.setTimeout(() => setShareMsg(null), 2600);
  }

  function shareResult() {
    if (!result) return;
    const win = !result.refunded && result.multiplier > 0;
    const pct = gamePct(result.multiplier, result.refunded);
    const betEth = Number(formatEther(result.bet)).toFixed(4);
    const payEth = Number(formatEther(result.payout)).toFixed(4);
    const name = destMeta(result.multiplier).name;
    const params = {
      win,
      big: result.refunded ? "↩︎" : `X${result.multiplier}`,
      pct: result.refunded ? "refunded" : `${pct > 0 ? "+" : ""}${pct}%`,
      sub: result.refunded
        ? `bet ${betEth} ETH returned`
        : `${name} · ${betEth} → ${payEth} ETH`,
    };
    const text = win
      ? `🚀 I hit X${result.multiplier} on KRIPTO NR.1 — rocket lottery on Base!`
      : `💥 KRIPTO NR.1 got me. Revenge launch incoming. Rocket lottery on Base 🚀`;
    void runShare(params, text);
  }

  function shareStats() {
    const up = stats.pnl >= 0n;
    const pnlEth = Number(
      formatEther(stats.pnl < 0n ? -stats.pnl : stats.pnl),
    ).toFixed(4);
    const params = {
      win: up,
      big: `${stats.pnlPct >= 0 ? "+" : "−"}${Math.abs(stats.pnlPct).toFixed(0)}%`,
      pct: `${up ? "+" : "−"}${pnlEth} ETH`,
      sub: `${stats.count + stats.refunds} launches · ${stats.winRate.toFixed(0)}% win${
        stats.best > 0 ? ` · best X${stats.best}` : ""
      }`,
    };
    const text = up
      ? `📈 ${params.pct} on KRIPTO NR.1 — rocket lottery on Base 🚀`
      : `Grinding KRIPTO NR.1 on Base. ${stats.count + stats.refunds} launches in 🚀`;
    void runShare(params, text);
  }

  const rocketPhase =
    phase === "committing" || phase === "revealing"
      ? "launching"
      : phase === "result"
        ? "result"
        : "idle";

  const busy = phase === "committing" || phase === "revealing";

  return (
    <main className="wrap">
      <header className="topbar">
        <div className="brand">
          {/* Swap public/logo.svg for your own image to use the real logo */}
          <img src="/logo.svg" alt="KRIPTO NR.1" className="logoImg" />
          <div className="brandText">
            <div className="brandTitle">
              KRIPTO <span className="accent">NR.1</span>
            </div>
            <div className="brandSub">Rocket Lottery</div>
          </div>
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
            <button
              className="walletPill"
              onClick={() => disconnect()}
              title="Disconnect"
            >
              <span className="dot" /> {address?.slice(0, 6)}…{address?.slice(-4)}
            </button>
          )}
        </div>
      </header>

      <section className="stage">
        <Rocket phase={rocketPhase} multiplier={result?.multiplier ?? null} />
      </section>

      <section className="panel">
        {!contractConfigured && (
          <p className="warn">
            ⚠️ Contract address is not set. Add{" "}
            <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> in your environment.
          </p>
        )}

        <div className="netline">
          <span className="netBase">
            <span className="netSquare" />
            Network <b>{activeChain.name}</b>
          </span>
          {bankroll !== undefined && (
            <span>
              Bankroll{" "}
              <b className="mono">
                {Number(formatEther(bankroll)).toFixed(4)} ETH
              </b>
            </span>
          )}
        </div>

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
            {result.refunded ? (
              <p className="lose">
                ↩️ Refunded — revealed too late, bet returned.
              </p>
            ) : result.multiplier === 0 ? (
              <p className="lose">💥 Rocket failed — X0. Try again!</p>
            ) : (
              <p className="win">
                🎉 X{result.multiplier}! Paid{" "}
                {Number(formatEther(result.payout)).toFixed(4)} ETH
              </p>
            )}
            <div className="resultBtns">
              <button className="btn launchAgain" onClick={reset}>
                Launch again
              </button>
              <button
                className="btn shareBtn"
                onClick={shareResult}
                disabled={sharing}
              >
                {sharing ? "…" : "↗ Share card"}
              </button>
            </div>
          </div>
        ) : busy ? (
          <button className="btn launch busy" disabled>
            <span className="spinner" />
            {phase === "committing" ? "Launching… (1/2)" : "Revealing… (2/2)"}
          </button>
        ) : hasPending ? (
          <button className="btn launch" onClick={handleReveal}>
            <span className="rk">🚀</span> Reveal result
          </button>
        ) : (
          <>
            <div className="betHead">
              <label className="label">Bet amount</label>
              <span className="minmax">
                min {MIN_BET} · max {MAX_BET} ETH
              </span>
            </div>
            <div className="presets">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`chip ${bet === p ? "active" : ""}`}
                  onClick={() => setBet(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="inputWrap">
              <input
                className="input"
                type="number"
                min={MIN_BET}
                max={MAX_BET}
                step="0.0001"
                value={bet}
                onChange={(e) => setBet(e.target.value)}
              />
              <span className="ethSuffix">ETH</span>
            </div>

            <button
              className="btn launch"
              onClick={handleLaunch}
              disabled={!betValid || !contractConfigured}
            >
              <span className="rk">🚀</span> LAUNCH ROCKET
            </button>

            <div className="odds">
              <span className="o0">X0 65%</span>
              <span className="o2">X2 22%</span>
              <span className="o3">X3 8%</span>
              <span className="o5">X5 4%</span>
              <span className="o10">X10 1%</span>
            </div>
          </>
        )}

        {shareMsg && <p className="shareToast">{shareMsg}</p>}

        {isConnected && (
          <Dashboard stats={stats} onShare={shareStats} sharing={sharing} />
        )}

        <History items={history} you={address} />

        {error && <p className="error">{error}</p>}
      </section>

      <footer className="foot">
        <span>Open source · MIT</span>
        <span className="mono">
          Min {MIN_BET} – Max {MAX_BET} ETH
        </span>
      </footer>
    </main>
  );
}
