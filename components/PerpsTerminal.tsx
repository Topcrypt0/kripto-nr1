"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  parseUnits,
} from "viem";
import { arbitrum } from "viem/chains";
import { useAccount, useWalletClient, useWriteContract } from "wagmi";
import {
  ExchangeClient,
  HttpTransport,
  InfoClient,
  type ClearinghouseStateResponse,
  type MetaAndAssetCtxsResponse,
} from "@nktkas/hyperliquid";
import { HL_BUILDER, HL_BUILDER_FEE } from "@/lib/monetize";
import { PerpsChart } from "@/components/PerpsChart";

type Market = {
  index: number;
  coin: string;
  szDecimals: number;
  maxLeverage: number;
  markPx: number;
  prevDayPx: number;
  funding: number;
  openInterest: number;
  dayNtlVlm: number;
};

const POLL_MS = 5_000;

// --- Hyperliquid funding (native bridge on Arbitrum) ---------------------
// Sending native USDC to the HL bridge credits the SENDER's Hyperliquid
// perps account within ~1 minute. Deposits below 5 USDC are NOT credited
// (bridge rule), so the UI enforces the minimum.
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const HL_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7" as const;
const MIN_DEPOSIT = 5;

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http("https://arb1.arbitrum.io/rpc"),
});

// Swap page prefilled to "anything -> USDC on Arbitrum" (widget buildUrl).
const FUND_SWAP_URL = `/swap?toChain=${arbitrum.id}&toToken=${ARB_USDC}`;

/** Format a price for HL: ≤5 significant figures, ≤(6 - szDecimals) decimals. */
function formatPx(px: number, szDecimals: number): string {
  const maxDecimals = Math.max(0, 6 - szDecimals);
  const sig = Number(px.toPrecision(5));
  const fixed = sig.toFixed(maxDecimals);
  // Trim trailing zeros — HL rejects them.
  return String(Number(fixed));
}

/** Format a size to the market's szDecimals. */
function formatSz(sz: number, szDecimals: number): string {
  return String(Number(sz.toFixed(szDecimals)));
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPx(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toPrecision(4);
}

export function PerpsTerminal() {
  const { address, isConnected, connector } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  // Hyperliquid L1 actions are verified by recovering an ECDSA signer, so
  // only plain EOA wallets (MetaMask, Rabby, …) can trade. Smart wallets
  // (Base Account passkeys, most mini-app hosts) produce signatures HL
  // cannot verify — warn instead of failing cryptically.
  const isEoaWallet = connector?.id === "injected";

  const info = useMemo(
    () => new InfoClient({ transport: new HttpTransport() }),
    [],
  );

  const [markets, setMarkets] = useState<Market[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>("BTC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [usdSize, setUsdSize] = useState<string>("100");
  const [state, setState] = useState<ClearinghouseStateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [arbUsdc, setArbUsdc] = useState<bigint | null>(null);
  const [depositAmt, setDepositAmt] = useState("");
  const [depositBusy, setDepositBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMarkets = useCallback(async () => {
    try {
      const [meta, ctxs]: MetaAndAssetCtxsResponse =
        await info.metaAndAssetCtxs();
      const list: Market[] = meta.universe
        .map((u, i) => ({
          index: i,
          coin: u.name,
          szDecimals: u.szDecimals,
          maxLeverage: u.maxLeverage,
          markPx: Number(ctxs[i]?.markPx ?? 0),
          prevDayPx: Number(ctxs[i]?.prevDayPx ?? 0),
          funding: Number(ctxs[i]?.funding ?? 0),
          openInterest: Number(ctxs[i]?.openInterest ?? 0),
          dayNtlVlm: Number(ctxs[i]?.dayNtlVlm ?? 0),
        }))
        .filter((m) => m.markPx > 0)
        .sort((a, b) => b.dayNtlVlm - a.dayNtlVlm);
      setMarkets(list);
    } catch {
      // transient network error — keep last snapshot
    }
  }, [info]);

  const loadAccount = useCallback(async () => {
    if (!address) {
      setState(null);
      setArbUsdc(null);
      return;
    }
    try {
      setState(await info.clearinghouseState({ user: address }));
    } catch {
      /* keep last */
    }
    try {
      setArbUsdc(
        await arbClient.readContract({
          address: ARB_USDC,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        }),
      );
    } catch {
      /* keep last */
    }
  }, [info, address]);

  useEffect(() => {
    loadMarkets();
    loadAccount();
    timer.current = setInterval(() => {
      loadMarkets();
      loadAccount();
    }, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [loadMarkets, loadAccount]);

  const market = markets.find((m) => m.coin === selected) ?? markets[0];
  const shown = filter
    ? markets.filter((m) =>
        m.coin.toLowerCase().includes(filter.toLowerCase()),
      )
    : markets;

  const chg = market && market.prevDayPx > 0
    ? ((market.markPx - market.prevDayPx) / market.prevDayPx) * 100
    : 0;

  const positions = state?.assetPositions ?? [];
  const withdrawable = Number(state?.withdrawable ?? 0);
  const accountValue = Number(state?.marginSummary?.accountValue ?? 0);
  const arbUsdcNum = arbUsdc !== null ? Number(formatUnits(arbUsdc, 6)) : null;
  const needsFunding = isConnected && state !== null && accountValue <= 0;

  const deposit = useCallback(async () => {
    if (!address) return;
    const amt = Number(depositAmt);
    if (!Number.isFinite(amt) || amt < MIN_DEPOSIT) {
      setMsg({
        ok: false,
        text: `Minimum deposit is ${MIN_DEPOSIT} USDC — smaller transfers are not credited by the Hyperliquid bridge.`,
      });
      return;
    }
    if (arbUsdcNum !== null && amt > arbUsdcNum) {
      setMsg({ ok: false, text: "Amount exceeds your USDC balance on Arbitrum." });
      return;
    }
    setDepositBusy(true);
    setMsg(null);
    try {
      await writeContractAsync({
        chainId: arbitrum.id,
        address: ARB_USDC,
        abi: erc20Abi,
        functionName: "transfer",
        args: [HL_BRIDGE, parseUnits(depositAmt, 6)],
      });
      setMsg({
        ok: true,
        text: "Deposit sent ✅ Funds appear in your Hyperliquid account in ~1 minute.",
      });
      setDepositAmt("");
    } catch (e) {
      const text = e instanceof Error ? e.message.split("\n")[0] : String(e);
      setMsg({ ok: false, text });
    } finally {
      setDepositBusy(false);
    }
  }, [address, depositAmt, arbUsdcNum, writeContractAsync]);

  const placeOrder = useCallback(async () => {
    if (!walletClient || !address || !market) return;
    setBusy(true);
    setMsg(null);
    try {
      const exchange = new ExchangeClient({
        transport: new HttpTransport(),
        wallet: walletClient,
      });

      // Builder revenue: make sure the user has approved our builder fee once,
      // then attach the builder code to the order itself.
      let builder: { b: `0x${string}`; f: number } | undefined;
      if (HL_BUILDER) {
        const approved = Number(
          await info
            .maxBuilderFee({ user: address, builder: HL_BUILDER })
            .catch(() => 0),
        );
        if (approved >= HL_BUILDER_FEE) {
          builder = { b: HL_BUILDER, f: HL_BUILDER_FEE };
        } else {
          try {
            setMsg({
              ok: true,
              text: "One-time signature to enable trading via KRIPTO NR.1…",
            });
            await exchange.approveBuilderFee({
              builder: HL_BUILDER,
              maxFeeRate: `${HL_BUILDER_FEE / 1000}%`,
            });
            builder = { b: HL_BUILDER, f: HL_BUILDER_FEE };
          } catch {
            // Builder approval can fail for reasons outside the user's
            // control (e.g. the builder account is below Hyperliquid's
            // 100 USDC perps-balance requirement). Never block trading on
            // it — place the order without attribution instead.
            builder = undefined;
          }
        }
      }

      // Market order = aggressive IOC limit around the mark price.
      const isBuy = side === "long";
      const slippage = 0.02;
      const px = market.markPx * (isBuy ? 1 + slippage : 1 - slippage);
      const usd = Number(usdSize);
      if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error("Enter a valid order size in USD.");
      }
      const size = usd / market.markPx;

      const result = await exchange.order({
        orders: [
          {
            a: market.index,
            b: isBuy,
            p: formatPx(px, market.szDecimals),
            s: formatSz(size, market.szDecimals),
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
        ...(builder ? { builder } : {}),
      });

      const status = result.response?.data?.statuses?.[0];
      if (status && typeof status === "object" && "error" in status) {
        throw new Error(String(status.error));
      }
      setMsg({
        ok: true,
        text: `${isBuy ? "Long" : "Short"} ${selected} ~${fmtUsd(usd)} filled ✅`,
      });
      loadAccount();
    } catch (e) {
      let text = e instanceof Error ? e.message : String(e);
      if (/typed data|sign/i.test(text) && connector?.id !== "injected") {
        text =
          "Your wallet type can't sign Hyperliquid orders. Smart wallets (Base Account, in-app wallets) are not supported by Hyperliquid — connect a standard wallet like MetaMask or Rabby and try again.";
      } else if (/does not exist|Insufficient margin|insufficient/i.test(text)) {
        text = `${text} — make sure your Hyperliquid trading balance is funded (see Deposit below).`;
      }
      setMsg({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }, [
    walletClient,
    address,
    market,
    side,
    usdSize,
    selected,
    info,
    loadAccount,
    connector?.id,
  ]);

  return (
    <div className="hlLayout">
      {/* --- markets --- */}
      <div className="pPanel">
        <div style={{ padding: "10px 12px" }}>
          <input
            className="hlInput"
            placeholder="Search markets…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <div className="hlList">
          {shown.length === 0 && <div className="pLoading">Loading…</div>}
          {shown.slice(0, 60).map((m) => {
            const c = m.prevDayPx > 0
              ? ((m.markPx - m.prevDayPx) / m.prevDayPx) * 100
              : 0;
            return (
              <button
                key={m.coin}
                className={`hlRow${m.coin === selected ? " hlRowActive" : ""}`}
                onClick={() => setSelected(m.coin)}
              >
                <span className="hlCoin">
                  {m.coin}
                  <span className="hlLev">{m.maxLeverage}×</span>
                </span>
                <span className="hlPx">{fmtPx(m.markPx)}</span>
                <span className={`hlChg ${c >= 0 ? "pGreen" : "pRed"}`}>
                  {c >= 0 ? "+" : ""}
                  {c.toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* --- selected market + account --- */}
      <div className="pPanel">
        <div className="hlHead">
          <div className="hlStat">
            <span className="hlStatK">{market?.coin ?? "—"}-PERP</span>
            <span className={`hlBigPx ${chg >= 0 ? "pGreen" : "pRed"}`}>
              {market ? fmtPx(market.markPx) : "—"}
            </span>
          </div>
          <div className="hlStat">
            <span className="hlStatK">24h</span>
            <span className={`hlStatV ${chg >= 0 ? "pGreen" : "pRed"}`}>
              {chg >= 0 ? "+" : ""}
              {chg.toFixed(2)}%
            </span>
          </div>
          <div className="hlStat">
            <span className="hlStatK">Funding / h</span>
            <span className="hlStatV">
              {market ? `${(market.funding * 100).toFixed(4)}%` : "—"}
            </span>
          </div>
          <div className="hlStat">
            <span className="hlStatK">Open interest</span>
            <span className="hlStatV">
              {market ? fmtUsd(market.openInterest * market.markPx) : "—"}
            </span>
          </div>
          <div className="hlStat">
            <span className="hlStatK">24h volume</span>
            <span className="hlStatV">{market ? fmtUsd(market.dayNtlVlm) : "—"}</span>
          </div>
        </div>

        {market && <PerpsChart coin={market.coin} />}

        <div className="hlBody">
          <div className="hlLabel">Your account</div>
          {!isConnected && (
            <div className="hlNote">
              Connect a wallet (top right) to see balances and trade. Funds
              must be deposited to Hyperliquid (USDC on Arbitrum via{" "}
              <a
                href="https://app.hyperliquid.xyz"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#ffd98a" }}
              >
                app.hyperliquid.xyz
              </a>
              ) — this terminal trades the same account, non-custodially.
            </div>
          )}
          {isConnected && (
            <>
              <div className="hlPosRow">
                <span className="pMuted">Account value</span>
                <span>{fmtUsd(accountValue)}</span>
              </div>
              <div className="hlPosRow">
                <span className="pMuted">Withdrawable</span>
                <span>{fmtUsd(withdrawable)}</span>
              </div>
              <div className="hlLabel" style={{ marginTop: 14 }}>
                Open positions
              </div>
              {positions.length === 0 && (
                <div className="hlNote">No open positions.</div>
              )}
              {positions.map((p) => {
                const pos = p.position;
                const szi = Number(pos.szi);
                const pnl = Number(pos.unrealizedPnl);
                return (
                  <div className="hlPosRow" key={pos.coin}>
                    <span className={szi >= 0 ? "pGreen" : "pRed"}>
                      {szi >= 0 ? "LONG" : "SHORT"} {pos.coin}
                    </span>
                    <span>{Math.abs(szi)} @ {fmtPx(Number(pos.entryPx ?? 0))}</span>
                    <span className={pnl >= 0 ? "pGreen" : "pRed"}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}$
                    </span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* --- order form --- */}
      <div className="pPanel">
        <div className="hlBody">
          {isConnected && (
            <div className="hlBalRow">
              <span className="hlStatK">Trading balance</span>
              <span
                className={`hlBalV ${withdrawable > 0 ? "pGreen" : "pRed"}`}
              >
                {fmtUsd(withdrawable)}
              </span>
            </div>
          )}

          {isConnected && !isEoaWallet && (
            <div className="hlMsg hlMsgWarn">
              ⚠️ Hyperliquid requires a standard (EOA) wallet signature.
              Smart wallets like Base Account can&apos;t place orders — connect
              MetaMask / Rabby instead.
            </div>
          )}

          {needsFunding && (
            <div className="hlFund">
              <div className="hlFundTitle">💰 Fund your trading account</div>
              <div className="hlFundDesc">
                Deposit USDC (Arbitrum) straight into Hyperliquid via the
                official bridge — arrives in ~1 minute.
                {arbUsdcNum !== null && (
                  <>
                    {" "}
                    Your Arbitrum USDC:{" "}
                    <b className="pMono">{arbUsdcNum.toFixed(2)}</b>
                  </>
                )}
              </div>
              {arbUsdcNum !== null && arbUsdcNum >= MIN_DEPOSIT ? (
                <div className="hlFundRow">
                  <input
                    className="hlInput"
                    inputMode="decimal"
                    placeholder={`min ${MIN_DEPOSIT}`}
                    value={depositAmt}
                    onChange={(e) => setDepositAmt(e.target.value)}
                  />
                  <button
                    className="hlFundBtn"
                    disabled={depositBusy || !isEoaWallet}
                    onClick={deposit}
                  >
                    {depositBusy ? "Sending…" : "Deposit"}
                  </button>
                </div>
              ) : (
                <a className="hlFundSwap" href={FUND_SWAP_URL}>
                  🔁 No USDC on Arbitrum? Swap from any chain →
                </a>
              )}
              {arbUsdcNum !== null &&
                arbUsdcNum >= MIN_DEPOSIT &&
                !isEoaWallet && (
                  <div className="hlNote">
                    Deposits are disabled for smart wallets — Hyperliquid
                    couldn&apos;t sign trades or withdrawals from one, so funds
                    would be stuck. Use MetaMask / Rabby.
                  </div>
                )}
            </div>
          )}

          <div className="hlSideBtns">
            <button
              className={`hlSide hlSideLong${side === "long" ? " hlSideOn" : ""}`}
              onClick={() => setSide("long")}
            >
              LONG ▲
            </button>
            <button
              className={`hlSide hlSideShort${side === "short" ? " hlSideOn" : ""}`}
              onClick={() => setSide("short")}
            >
              SHORT ▼
            </button>
          </div>

          <div className="hlField">
            <label className="hlLabel">Size (USD)</label>
            <input
              className="hlInput"
              inputMode="decimal"
              value={usdSize}
              onChange={(e) => setUsdSize(e.target.value)}
              placeholder="100"
            />
          </div>

          <div className="hlField">
            <label className="hlLabel">Est. size</label>
            <div className="hlInput" style={{ opacity: 0.8 }}>
              {market && Number(usdSize) > 0
                ? `${formatSz(Number(usdSize) / market.markPx, market.szDecimals)} ${market.coin}`
                : "—"}
            </div>
          </div>

          <button
            className="hlSubmit"
            disabled={!isConnected || !walletClient || busy || !market}
            onClick={placeOrder}
          >
            {busy
              ? "Placing…"
              : `${side === "long" ? "Buy / Long" : "Sell / Short"} ${market?.coin ?? ""}`}
          </button>

          {msg && (
            <div className={`hlMsg ${msg.ok ? "hlMsgOk" : "hlMsgErr"}`}>
              {msg.text}
            </div>
          )}

          <p className="hlNote">
            Market order (IOC, ~2% max slippage) on Hyperliquid mainnet, cross
            margin. Non-custodial — orders are signed by your own wallet. See{" "}
            <a href="/docs" style={{ color: "#ffd98a" }}>
              docs
            </a>{" "}
            for details and fees.
          </p>
        </div>
      </div>
    </div>
  );
}
