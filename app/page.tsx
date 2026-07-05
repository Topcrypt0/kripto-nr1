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
  FREE_BET,
  MAX_BET,
  MAX_WIN,
  MIN_BET,
  kriptoNr1Abi,
} from "@/lib/contract";
import { useEthUsd, usdFromEth, usdFromWei } from "@/lib/price";
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
import { appUrl } from "@/lib/miniapp";
import { captureReferrer, getReferrer } from "@/lib/referral";
import { Rocket } from "@/components/Rocket";
import { History, type HistoryItem } from "@/components/History";
import { Dashboard } from "@/components/Dashboard";

type Phase =
  | "idle"
  | "committing" // launch() tx in flight
  | "revealing" // waiting for the reveal block + reading preview()
  | "won" // preview says you won — Claim button shown
  | "claiming" // claim() tx in flight
  | "result"; // final: loss, or a claimed win

type GameResult = {
  multiplier: number;
  bet: bigint;
  payout: bigint;
  expired?: boolean;
  free?: boolean;
};

type PreviewData = {
  params: Parameters<typeof cardUrl>[0];
  text: string;
  link: string;
};

type SettledArgs = {
  bet: bigint;
  multiplier: bigint;
  payout: bigint;
  roll: bigint;
};

const PRESETS = ["0.0001", "0.0002", "0.0005", "0.001"];
const HISTORY_KEY = "kr1_history";

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.id });

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
  const [freePlay, setFreePlay] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const ethUsd = useEthUsd();

  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // The Farcaster Mini App connector powers silent auto-connect inside Base App,
  // but we don't want it as a visible "Connect Farcaster" button on the web.
  const isFarcaster = (c: { id: string; name: string }) =>
    /farcaster/i.test(c.id) || /farcaster/i.test(c.name);
  const visibleConnectors = connectors.filter((c) => !isFarcaster(c));

  // Auto-connect the host wallet when running inside Base App / a Mini App host.
  const autoConnected = useRef(false);
  useEffect(() => {
    if (autoConnected.current || isConnected) return;
    autoConnected.current = true;
    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (!(await sdk.isInMiniApp().catch(() => false))) return;
        const fc = connectors.find((c) => isFarcaster(c));
        if (fc) connect({ connector: fc });
      } catch {
        /* not in a Mini App host */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, connectors]);

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
    captureReferrer(address);
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
    chainId: activeChain.id,
    functionName: "bankroll",
    query: { refetchInterval: 15_000, enabled: contractConfigured },
  });

  const { data: pendingGame, refetch: refetchGames } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    chainId: activeChain.id,
    functionName: "games",
    args: address ? [address] : undefined,
    query: { enabled: contractConfigured && !!address, refetchInterval: 12_000 },
  });

  // On-chain free launches: starter + earned invite credits (contract v3).
  const { data: freeLaunchCount, refetch: refetchFree } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    chainId: activeChain.id,
    functionName: "freeLaunches",
    args: address ? [address] : undefined,
    query: { enabled: contractConfigured && !!address, refetchInterval: 30_000 },
  });
  const { data: promoPool } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    chainId: activeChain.id,
    functionName: "promoPool",
    query: { enabled: contractConfigured, refetchInterval: 30_000 },
  });
  // Free launches are on only when the promo pool can cover a worst-case X10.
  const freeSpins =
    promoPool !== undefined && promoPool >= parseEther(FREE_BET) * 10n
      ? Number(freeLaunchCount ?? 0n)
      : 0;

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
        eventName: "Settled",
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
            const a = l.args as unknown as SettledArgs;
            return {
              txHash: l.transactionHash ?? "",
              betWei: (a.bet ?? 0n).toString(),
              multiplier: Number(a.multiplier),
              payoutWei: (a.payout ?? 0n).toString(),
              refunded: false,
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

  // Poll preview(you) until the reveal block exists; returns the outcome.
  // Transient RPC errors are retried — one flaky response must not strand the
  // player mid-reveal (their bet would sit pending until it expires).
  async function pollPreview(): Promise<{ multiplier: number; payout: bigint }> {
    if (!publicClient || !address) throw new Error("Wallet not ready");
    for (let i = 0; i < 80; i++) {
      try {
        const [ready, mult, payout] = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: kriptoNr1Abi,
          functionName: "preview",
          args: [address],
        })) as readonly [boolean, bigint, bigint];
        if (ready) return { multiplier: Number(mult), payout };
      } catch {
        /* transient RPC failure — keep polling */
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    throw new Error("Timed out waiting for the reveal block — tap Check result.");
  }

  // Read the pending game from chain (loss record + display + free flag).
  async function pendingStake(): Promise<{ stake: bigint; free: boolean }> {
    if (!publicClient || !address) return { stake: 0n, free: false };
    const g = (await publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: kriptoNr1Abi,
      functionName: "games",
      args: [address],
    })) as readonly [bigint, bigint, boolean, boolean];
    return g[2]
      ? { stake: g[0], free: g[3] === true }
      : { stake: 0n, free: false };
  }

  function playOutcomeSound(mult: number) {
    const durMs = destMeta(mult).durMs;
    const delay = mult > 0 ? durMs * 0.85 : durMs * 0.65;
    window.setTimeout(() => {
      if (mutedRef.current) return;
      if (mult > 0) playWin();
      else playCrash();
    }, delay);
  }

  // A settled loss is only ever known locally (the loser never sends a tx), so
  // record it in the ledger here for accurate PnL. Keyed by the launch tx hash.
  function recordLoss(launchHash: string, stakeWei: bigint) {
    if (!address) return;
    setGames(
      mergeGames(address, [
        {
          txHash: launchHash,
          betWei: stakeWei.toString(),
          multiplier: 0,
          payoutWei: "0",
          refunded: false,
          ts: Date.now(),
        },
      ]),
    );
  }

  // After the reveal block: a win parks in "won" (Claim button); a loss/expiry
  // needs no transaction and settles straight to the result screen.
  async function revealOutcome(launchHash?: string) {
    const { multiplier, payout } = await pollPreview();
    const { stake, free } = await pendingStake();
    setFreePlay(free);
    if (multiplier > 0) {
      setResult({ multiplier, bet: stake, payout, free });
      setPhase("won");
      if (!mutedRef.current) playWin();
    } else {
      setResult({ multiplier: 0, bet: stake, payout: 0n, free });
      setPhase("result");
      setLocalPending(false);
      // A free-game loss costs the player nothing — record a 0 stake.
      if (launchHash) recordLoss(launchHash, free ? 0n : stake);
      playOutcomeSound(0);
      void refetchGames();
    }
  }

  // Step 1: place the bet (single transaction), then reveal the outcome.
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
      setLocalPending(true);
      void refetchGames();
      setPhase("revealing");
      await revealOutcome(hash);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Transaction failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
    }
  }

  // Recover a pending game after a reload / re-open (reads preview, no tx).
  async function handleCheck() {
    setError(null);
    setResult(null);
    try {
      setPhase("revealing");
      await revealOutcome();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Couldn't read the result";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
    }
  }

  // Step 2 (wins only): claim the payout.
  async function handleClaim() {
    if (!publicClient || !address) return;
    setError(null);
    try {
      setPhase("claiming");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "claim",
        dataSuffix: DATA_SUFFIX,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Claim reverted on-chain — try again.");
      }

      const ev = parseEventLogs({
        abi: kriptoNr1Abi,
        eventName: "Settled",
        logs: receipt.logs,
      })[0]?.args as SettledArgs | undefined;

      if (!ev) {
        // Claimed after the 256-block window — the bet expired (forfeited).
        const exp = parseEventLogs({
          abi: kriptoNr1Abi,
          eventName: "Expired",
          logs: receipt.logs,
        })[0]?.args as { bet: bigint } | undefined;
        setResult({
          multiplier: 0,
          bet: exp?.bet ?? result?.bet ?? 0n,
          payout: 0n,
          expired: true,
        });
        setPhase("result");
        setLocalPending(false);
        void refetchGames();
        return;
      }

      const mult = Number(ev.multiplier);
      const wasFree = result?.free ?? freePlay;
      setResult({
        multiplier: mult,
        bet: ev.bet,
        payout: ev.payout,
        free: wasFree,
      });
      setPhase("result");
      setLocalPending(false);
      setFreePlay(false);

      setHistory((prev) =>
        [
          {
            txHash: hash,
            player: address,
            multiplier: mult,
            payoutWei: ev.payout.toString(),
          },
          ...prev.filter((p) => p.txHash !== hash),
        ].slice(0, 10),
      );
      setGames(
        mergeGames(address, [
          {
            txHash: hash,
            // A free game costs the player nothing — its win is pure profit.
            betWei: wasFree ? "0" : ev.bet.toString(),
            multiplier: mult,
            payoutWei: ev.payout.toString(),
            refunded: false,
            ts: Date.now(),
          },
        ]),
      );

      void refetchGames();
      window.setTimeout(fetchHistory, 4000);
    } catch (e: unknown) {
      // Leave the game in "won" so the player can retry the claim.
      const msg = e instanceof Error ? e.message : "Claim failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("won");
    }
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
  }

  // A REAL free launch (contract v3): zero stake, real odds, real ETH payout
  // (up to 0.01 at X10), funded by the promo pool. Same preview/claim flow as
  // a paid launch — costs the player only gas.
  async function handleFreeLaunch() {
    if (freeSpins <= 0 || phase !== "idle") return;
    if (!publicClient || !address) return;
    setError(null);
    setResult(null);
    unlockAudio();
    if (!muted) playLaunch();

    try {
      setPhase("committing");
      setFreePlay(true);
      const inviter =
        (getReferrer() as `0x${string}` | null) ??
        "0x0000000000000000000000000000000000000000";
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "freeLaunch",
        args: [inviter],
        dataSuffix: DATA_SUFFIX,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "reverted") {
        throw new Error("Free launch reverted on-chain — please try again.");
      }
      setLocalPending(true);
      void refetchGames();
      void refetchFree();
      setPhase("revealing");
      await revealOutcome(hash);
    } catch (e: unknown) {
      setFreePlay(false);
      const msg =
        e instanceof Error ? e.message : "Transaction failed or rejected";
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
    }
  }

  const inviteLink = () =>
    address ? `${appUrl()}/?ref=${address}` : appUrl();

  // "win up to 0.01 ETH (~$16)" — the referral hook, always at the live price.
  const maxWinUsd = usdFromEth(Number(MAX_WIN), ethUsd);
  const inviteHook = `Join & get a FREE rocket launch — win up to ${MAX_WIN} ETH (~${maxWinUsd}) at X10, zero risk!`;

  // Sharing now opens a preview first — you see the card, then choose to share.
  function shareResult() {
    if (!result) return;
    const win = !result.expired && result.multiplier > 0;
    const pct = gamePct(result.multiplier, false);
    const betEth = Number(formatEther(result.bet)).toFixed(4);
    const payEth = Number(formatEther(result.payout)).toFixed(4);
    const payUsd = usdFromWei(result.payout, ethUsd);
    const name = destMeta(result.multiplier).name;
    const params = {
      win,
      big: result.expired ? "⌛" : `X${result.multiplier}`,
      pct: result.expired ? "expired" : `${pct > 0 ? "+" : ""}${pct}%`,
      sub: result.free
        ? win
          ? `FREE launch won ${payEth} ETH (${payUsd}) — yours is waiting`
          : `FREE launch, zero risk — get yours: up to ${MAX_WIN} ETH (~${maxWinUsd})`
        : result.expired
          ? `bet ${betEth} ETH expired`
          : `${name} · ${betEth} → ${payEth} ETH (${payUsd})`,
    };
    const text = win
      ? `I hit X${result.multiplier} on KRIPTO NR.1 🚀 ${inviteHook}`
      : `Launching rockets on KRIPTO NR.1 🚀 ${inviteHook}`;
    setPreview({ params, text, link: inviteLink() });
  }

  function shareStats() {
    const up = stats.pnl >= 0n;
    const pnlEth = Number(
      formatEther(stats.pnl < 0n ? -stats.pnl : stats.pnl),
    ).toFixed(4);
    const pnlUsd = usdFromWei(stats.pnl < 0n ? -stats.pnl : stats.pnl, ethUsd);
    const params = {
      win: up,
      big: `${stats.pnlPct >= 0 ? "+" : "−"}${Math.abs(stats.pnlPct).toFixed(0)}%`,
      pct: `${up ? "+" : "−"}${pnlEth} ETH (${pnlUsd})`,
      sub: `${stats.count + stats.refunds} launches · ${stats.winRate.toFixed(0)}% win${
        stats.best > 0 ? ` · best X${stats.best}` : ""
      }`,
    };
    const text = `My KRIPTO NR.1 run: ${params.big} PnL 🚀 ${inviteHook}`;
    setPreview({ params, text, link: inviteLink() });
  }

  async function doShare() {
    if (!preview || sharing) return;
    setSharing(true);
    const outcome = await shareCard(
      cardUrl(preview.params),
      preview.text,
      preview.link,
    );
    setSharing(false);
    setPreview(null);

    const msg =
      outcome === "cast"
        ? "Shared to your feed! You earn +1 free launch when a friend uses theirs 🎁"
        : outcome === "web"
          ? "Shared!"
          : outcome === "copied"
            ? "Invite link copied!"
            : "Couldn't share — try again";
    setShareMsg(msg);
    window.setTimeout(() => setShareMsg(null), 3200);
  }

  function copyInvite() {
    if (!preview) return;
    try {
      void navigator.clipboard.writeText(preview.link);
      setShareMsg("Invite link copied!");
      window.setTimeout(() => setShareMsg(null), 2500);
    } catch {
      /* ignore */
    }
  }

  const rocketPhase =
    phase === "committing" || phase === "revealing" || phase === "claiming"
      ? "launching"
      : phase === "won" || phase === "result"
        ? "result"
        : "idle";

  const busy =
    phase === "committing" || phase === "revealing" || phase === "claiming";

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
                {Number(formatEther(bankroll)).toFixed(4)} ETH (
                {usdFromWei(bankroll, ethUsd)})
              </b>
            </span>
          )}
        </div>

        {isConnected && !wrongChain && freeSpins > 0 && phase === "idle" &&
          !hasPending && (
            <button className="btn freeLaunch" onClick={handleFreeLaunch}>
              🎁 FREE launch — win up to {MAX_WIN} ETH (~{maxWinUsd}), zero risk
              <span className="freeCount">{freeSpins} left</span>
            </button>
          )}

        {phase === "result" && result ? (
          <div className="resultBox">
            {result.free ? (
              result.multiplier > 0 ? (
                <p className="win">
                  🎁 FREE launch won X{result.multiplier} — paid{" "}
                  {Number(formatEther(result.payout)).toFixed(4)} ETH (
                  {usdFromWei(result.payout, ethUsd)}), real ETH!
                </p>
              ) : (
                <p className="lose">
                  🎁 Free launch — X0. It cost you nothing, try again!
                </p>
              )
            ) : result.expired ? (
              <p className="lose">
                ⌛ Expired — claimed after the ~8 min window, bet forfeited.
              </p>
            ) : result.multiplier === 0 ? (
              <p className="lose">💥 Rocket failed — X0. Try again!</p>
            ) : (
              <p className="win">
                🎉 X{result.multiplier}! Paid{" "}
                {Number(formatEther(result.payout)).toFixed(4)} ETH (
                {usdFromWei(result.payout, ethUsd)})
              </p>
            )}
            {result.free && result.multiplier > 0 && (
              <p className="freeNote">
                Invite friends — you both get another free launch 🚀
              </p>
            )}
            <div className="resultBtns">
              <button className="btn launchAgain" onClick={reset}>
                Launch again
              </button>
              <button className="btn shareBtn" onClick={shareResult}>
                ↗ Share card
              </button>
            </div>
          </div>
        ) : phase === "won" && result ? (
          <div className="resultBox">
            <p className="win">
              🎉 X{result.multiplier}! You won{" "}
              {Number(formatEther(result.payout)).toFixed(4)} ETH (
              {usdFromWei(result.payout, ethUsd)})
              {result.free ? " — on a FREE launch!" : ""}
            </p>
            <button className="btn launch" onClick={handleClaim}>
              💰 Claim {Number(formatEther(result.payout)).toFixed(4)} ETH (
              {usdFromWei(result.payout, ethUsd)})
            </button>
            <p className="minmax">
              Claim within ~8 minutes or the win expires. A loss needs no
              transaction.
            </p>
          </div>
        ) : busy ? (
          <button className="btn launch busy" disabled>
            <span className="spinner" />
            {freePlay || phase === "committing"
              ? "Launching…"
              : phase === "claiming"
                ? "Claiming…"
                : "Revealing…"}
          </button>
        ) : !isConnected ? (
          <div className="connectRow">
            {promoPool !== undefined &&
              promoPool >= parseEther(FREE_BET) * 10n && (
                <p className="win">
                  🎁 New here? Connect &amp; get a FREE launch — a real chance
                  to win {MAX_WIN} ETH (~{maxWinUsd}) at X10. Zero risk, costs
                  nothing.
                </p>
              )}
            {visibleConnectors.map((c) => (
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
        ) : hasPending ? (
          <>
            <button className="btn launch" onClick={handleCheck}>
              <span className="rk">🚀</span> Check result
            </button>
            <p className="minmax">
              You have a pending launch — check it within ~8 minutes or it
              expires.
            </p>
          </>
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
              <span className="ethSuffix">
                ETH{betValid ? ` ≈ ${usdFromEth(Number(bet), ethUsd)}` : ""}
              </span>
            </div>

            <button
              className="btn launch"
              onClick={handleLaunch}
              disabled={!betValid || !contractConfigured}
            >
              <span className="rk">🚀</span> LAUNCH ROCKET
              {betValid
                ? ` — win up to ${usdFromEth(Number(bet) * 10, ethUsd)}`
                : ""}
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
          <Dashboard
            stats={stats}
            onShare={shareStats}
            sharing={sharing}
            ethUsd={ethUsd}
          />
        )}

        <History items={history} you={address} ethUsd={ethUsd} />

        {error && <p className="error">{error}</p>}
      </section>

      <footer className="foot">
        <span>Open source · MIT</span>
        <span className="mono">
          Min {MIN_BET} – Max {MAX_BET} ETH
        </span>
      </footer>

      {preview && (
        <div className="modalWrap" onClick={() => setPreview(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <div className="modalTitle">Your share card</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cardPreview"
              src={cardUrl(preview.params)}
              alt="Share card preview"
            />
            <p className="modalHint">
              Friends from your link get a FREE launch — a real shot at{" "}
              {MAX_WIN} ETH (~{maxWinUsd}), zero risk. When they use it, you
              earn +1 free launch too 🎁
            </p>
            <div className="modalBtns">
              <button
                className="btn primary"
                onClick={doShare}
                disabled={sharing}
              >
                {sharing ? "Sharing…" : "↗ Share"}
              </button>
              <button className="btn ghostBtn" onClick={copyInvite}>
                Copy link
              </button>
              <button
                className="btn ghostBtn"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
