"use client";

import { useMemo, useState } from "react";
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
import { activeChain } from "@/lib/wagmi";
import { Rocket } from "@/components/Rocket";

type Phase = "idle" | "launching" | "result";

type GameResult = {
  multiplier: number;
  bet: bigint;
  payout: bigint;
};

const PRESETS = ["0.0001", "0.001", "0.01", "0.05", "0.1"];

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

  const wrongChain = isConnected && chainId !== activeChain.id;

  const { data: bankroll } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: kriptoNr1Abi,
    functionName: "bankroll",
    query: { refetchInterval: 15_000 },
  });

  const betValid = useMemo(() => {
    const n = Number(bet);
    return Number.isFinite(n) && n >= Number(MIN_BET) && n <= Number(MAX_BET);
  }, [bet]);

  const contractConfigured =
    CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

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

    try {
      setPhase("launching");
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "launch",
        value: parseEther(bet),
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const logs = parseEventLogs({
        abi: kriptoNr1Abi,
        eventName: "Launch",
        logs: receipt.logs,
      });

      const ev = logs[0]?.args as
        | { multiplier: bigint; bet: bigint; payout: bigint }
        | undefined;

      if (!ev) {
        throw new Error("Could not read the result from the transaction");
      }

      setResult({
        multiplier: Number(ev.multiplier),
        bet: ev.bet,
        payout: ev.payout,
      });
      setPhase("result");
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : "Transaction failed or rejected";
      // Trim long wallet error blobs.
      setError(msg.split("\n")[0].slice(0, 160));
      setPhase("idle");
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
          <span className="logo">🚀</span>
          <span>
            KRIPTO <span className="accent">NR.1</span>
          </span>
        </div>
        {isConnected ? (
          <button className="btn ghost" onClick={() => disconnect()}>
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </button>
        ) : null}
      </header>

      <section className="stage">
        <Rocket
          phase={phase}
          multiplier={result?.multiplier ?? null}
        />
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
                🎉 X{result.multiplier}! You won{" "}
                {Number(formatEther(result.payout)).toFixed(4)} ETH
              </p>
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

        {error && <p className="error">{error}</p>}
      </section>

      <footer className="foot">
        <span>Open source · MIT</span>
        <span>Min {MIN_BET} – Max {MAX_BET} ETH</span>
      </footer>
    </main>
  );
}
