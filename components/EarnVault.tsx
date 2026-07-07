"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import {
  useAccount,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { base } from "wagmi/chains";
import {
  AAVE_AUSDC,
  AAVE_POOL,
  AAVE_REFERRAL,
  MORPHO_VAULT,
  USDC_BASE,
  USDC_DECIMALS,
  aaveRateToApy,
  aavePoolAbi,
  erc20Abi,
  erc4626Abi,
} from "@/lib/defi";

type Protocol = "morpho" | "aave";

const fmt = (v: bigint | undefined, dp = 2) =>
  v === undefined ? "—" : Number(formatUnits(v, USDC_DECIMALS)).toFixed(dp);

export function EarnVault({
  protocol,
  title,
  sub,
  emoji,
}: {
  protocol: Protocol;
  title: string;
  sub: string;
  emoji: string;
}) {
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [tab, setTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const spender = protocol === "morpho" ? MORPHO_VAULT : AAVE_POOL;

  // --- reads ---
  const { data: walletUsdc, refetch: refetchWallet } = useReadContract({
    chainId: base.id,
    address: USDC_BASE,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    chainId: base.id,
    address: USDC_BASE,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, spender] : undefined,
    query: { enabled: Boolean(address) },
  });

  // Deposited balance (in USDC): Morpho maxWithdraw, Aave aToken balance (1:1).
  const { data: depositedMorpho, refetch: refetchDepM } = useReadContract({
    chainId: base.id,
    address: MORPHO_VAULT,
    abi: erc4626Abi,
    functionName: "maxWithdraw",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && protocol === "morpho" },
  });
  const { data: depositedAave, refetch: refetchDepA } = useReadContract({
    chainId: base.id,
    address: AAVE_AUSDC,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) && protocol === "aave" },
  });
  const deposited = protocol === "morpho" ? depositedMorpho : depositedAave;

  // --- APY ---
  const [morphoApy, setMorphoApy] = useState<number | null>(null);
  const [morphoTvl, setMorphoTvl] = useState<number | null>(null);
  useEffect(() => {
    if (protocol !== "morpho") return;
    let cancel = false;
    fetch("/api/morpho")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        if (cancel) return;
        setMorphoApy(Number(d.netApy) || 0);
        setMorphoTvl(Number(d.tvlUsd) || 0);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [protocol]);

  const { data: aaveReserve } = useReadContract({
    chainId: base.id,
    address: AAVE_POOL,
    abi: aavePoolAbi,
    functionName: "getReserveData",
    args: [USDC_BASE],
    query: { enabled: protocol === "aave", refetchInterval: 60_000 },
  });
  const aaveApy = aaveReserve
    ? aaveRateToApy(aaveReserve.currentLiquidityRate)
    : null;

  const apy = protocol === "morpho" ? morphoApy : aaveApy;

  // --- tx receipt ---
  const { isSuccess: txDone } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: base.id,
  });
  useEffect(() => {
    if (txDone) {
      refetchWallet();
      refetchAllowance();
      refetchDepM();
      refetchDepA();
      setTxHash(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txDone]);

  const amtWei = useMemo(() => {
    try {
      return amount ? parseUnits(amount, USDC_DECIMALS) : 0n;
    } catch {
      return 0n;
    }
  }, [amount]);

  const wrongChain = isConnected && chainId !== base.id;
  const needsApprove =
    tab === "deposit" &&
    amtWei > 0n &&
    (allowance === undefined || allowance < amtWei);

  const max = tab === "deposit" ? walletUsdc : deposited;

  const act = async () => {
    if (!address || amtWei <= 0n) return;
    setBusy(true);
    setMsg(null);
    try {
      let hash: `0x${string}`;
      if (needsApprove) {
        hash = await writeContractAsync({
          chainId: base.id,
          address: USDC_BASE,
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, amtWei],
        });
        setTxHash(hash);
        setMsg({ ok: true, text: "Approval sent — confirm, then press again to deposit." });
        return;
      }
      if (tab === "deposit") {
        hash =
          protocol === "morpho"
            ? await writeContractAsync({
                chainId: base.id,
                address: MORPHO_VAULT,
                abi: erc4626Abi,
                functionName: "deposit",
                args: [amtWei, address],
              })
            : await writeContractAsync({
                chainId: base.id,
                address: AAVE_POOL,
                abi: aavePoolAbi,
                functionName: "supply",
                args: [USDC_BASE, amtWei, address, AAVE_REFERRAL],
              });
        setMsg({ ok: true, text: `Deposited ${amount} USDC ✅ Now earning yield.` });
      } else {
        hash =
          protocol === "morpho"
            ? await writeContractAsync({
                chainId: base.id,
                address: MORPHO_VAULT,
                abi: erc4626Abi,
                functionName: "withdraw",
                args: [amtWei, address, address],
              })
            : await writeContractAsync({
                chainId: base.id,
                address: AAVE_POOL,
                abi: aavePoolAbi,
                functionName: "withdraw",
                args: [USDC_BASE, amtWei, address],
              });
        setMsg({ ok: true, text: `Withdrew ${amount} USDC ✅` });
      }
      setTxHash(hash);
      setAmount("");
    } catch (e) {
      const t = e instanceof Error ? e.message.split("\n")[0] : String(e);
      setMsg({ ok: false, text: /reject|denied/i.test(t) ? "Rejected in wallet." : t });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="earnCard">
      <div className="earnHead">
        <div className="earnLogo">{emoji}</div>
        <div className="earnHeadText">
          <div className="earnTitle">{title}</div>
          <div className="earnSub">{sub}</div>
        </div>
        <div className="earnApy">
          <div className="earnApyVal">
            {apy !== null ? `${(apy * 100).toFixed(2)}%` : "—"}
          </div>
          <div className="earnApyLbl">APY</div>
        </div>
      </div>

      <div className="earnStats">
        <div className="earnStat">
          <span className="earnStatK">Your deposit</span>
          <span className="earnStatV">${fmt(deposited)}</span>
        </div>
        <div className="earnStat">
          <span className="earnStatK">Wallet USDC</span>
          <span className="earnStatV">${fmt(walletUsdc)}</span>
        </div>
        {protocol === "morpho" && morphoTvl !== null && (
          <div className="earnStat">
            <span className="earnStatK">Vault TVL</span>
            <span className="earnStatV">
              ${(morphoTvl / 1e6).toFixed(1)}M
            </span>
          </div>
        )}
      </div>

      <div className="earnTabs">
        <button
          className={`earnTab${tab === "deposit" ? " earnTabOn" : ""}`}
          onClick={() => setTab("deposit")}
        >
          Deposit
        </button>
        <button
          className={`earnTab${tab === "withdraw" ? " earnTabOn" : ""}`}
          onClick={() => setTab("withdraw")}
        >
          Withdraw
        </button>
      </div>

      <div className="earnInputRow">
        <input
          className="earnInput"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          className="earnMax"
          onClick={() => max !== undefined && setAmount(formatUnits(max, USDC_DECIMALS))}
        >
          MAX
        </button>
        <span className="earnUsdc">USDC</span>
      </div>

      {wrongChain ? (
        <div className="earnMsg earnMsgErr">Switch your wallet to Base network.</div>
      ) : null}

      <button
        className="earnBtn"
        disabled={!isConnected || busy || amtWei <= 0n || wrongChain}
        onClick={act}
      >
        {busy
          ? "Confirm in wallet…"
          : !isConnected
            ? "Connect wallet"
            : needsApprove
              ? "Approve USDC"
              : tab === "deposit"
                ? "Deposit"
                : "Withdraw"}
      </button>

      {msg && (
        <div className={`earnMsg ${msg.ok ? "earnMsgOk" : "earnMsgErr"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
