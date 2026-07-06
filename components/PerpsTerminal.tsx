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
  type FrontendOpenOrdersResponse,
  type L2BookResponse,
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
const BOOK_POLL_MS = 3_000;

// --- Hyperliquid funding -------------------------------------------------
// Primary path: LI.FI routes any token on any chain straight into the user's
// Hyperliquid perps balance (HyperCore = chain id 1337 in LI.FI) — one click,
// and the swap carries our integrator fee. Secondary path for users who
// already hold USDC on Arbitrum: a direct transfer to the official HL bridge
// (credited in ~1 min; deposits under 5 USDC are NOT credited).
const HYPERCORE_CHAIN_ID = 1337;
const FUND_SWAP_URL = `/swap?toChain=${HYPERCORE_CHAIN_ID}`;
const ARB_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as const;
const HL_BRIDGE = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7" as const;
const MIN_DEPOSIT = 5;

const arbClient = createPublicClient({
  chain: arbitrum,
  transport: http("https://arb1.arbitrum.io/rpc"),
});

/** Format a price for HL: ≤5 significant figures, ≤(6 - szDecimals) decimals. */
function formatPx(px: number, szDecimals: number): string {
  const maxDecimals = Math.max(0, 6 - szDecimals);
  const sig = Number(px.toPrecision(5));
  const fixed = sig.toFixed(maxDecimals);
  return String(Number(fixed));
}

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
  const exchange = useMemo(
    () =>
      walletClient
        ? new ExchangeClient({
            transport: new HttpTransport(),
            wallet: walletClient,
          })
        : null,
    [walletClient],
  );

  const [markets, setMarkets] = useState<Market[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string>("BTC");
  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [limitPx, setLimitPx] = useState<string>("");
  const [usdSize, setUsdSize] = useState<string>("100");
  const [leverage, setLeverage] = useState<string>("");
  const [curLeverage, setCurLeverage] = useState<number | null>(null);
  const [state, setState] = useState<ClearinghouseStateResponse | null>(null);
  // Unified-account mode (HL merges spot & perps into one balance): the
  // classic perps clearinghouse then reports 0, and the real tradable
  // balance lives in the spot state — read both to show the truth.
  const [abstraction, setAbstraction] = useState<string>("default");
  const [spotUsdc, setSpotUsdc] = useState<number>(0);
  const [orders, setOrders] = useState<FrontendOpenOrdersResponse>([]);
  const [book, setBook] = useState<L2BookResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
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
      /* transient — keep last snapshot */
    }
  }, [info]);

  const loadAccount = useCallback(async () => {
    if (!address) {
      setState(null);
      setOrders([]);
      setArbUsdc(null);
      setCurLeverage(null);
      return;
    }
    info
      .clearinghouseState({ user: address })
      .then(setState)
      .catch(() => {});
    info
      .userAbstraction({ user: address })
      .then((mode) => setAbstraction(String(mode)))
      .catch(() => {});
    info
      .spotClearinghouseState({ user: address })
      .then((spot) => {
        const usdc = spot.balances?.find((b) => b.coin === "USDC");
        setSpotUsdc(usdc ? Number(usdc.total) - Number(usdc.hold) : 0);
      })
      .catch(() => {});
    info
      .frontendOpenOrders({ user: address })
      .then(setOrders)
      .catch(() => {});
    info
      .activeAssetData({ user: address, coin: selected })
      .then((d) => setCurLeverage(d.leverage?.value ?? null))
      .catch(() => {});
    arbClient
      .readContract({
        address: ARB_USDC,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })
      .then(setArbUsdc)
      .catch(() => {});
  }, [info, address, selected]);

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

  // Order book for the selected market.
  useEffect(() => {
    let cancelled = false;
    setBook(null);
    const load = () =>
      info
        .l2Book({ coin: selected, nSigFigs: 5 })
        .then((b) => {
          if (!cancelled) setBook(b);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, BOOK_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [info, selected]);

  const market = markets.find((m) => m.coin === selected) ?? markets[0];
  const shown = filter
    ? markets.filter((m) => m.coin.toLowerCase().includes(filter.toLowerCase()))
    : markets;

  const chg =
    market && market.prevDayPx > 0
      ? ((market.markPx - market.prevDayPx) / market.prevDayPx) * 100
      : 0;

  const positions = state?.assetPositions ?? [];
  const withdrawable = Number(state?.withdrawable ?? 0);
  const perpsValue = Number(state?.marginSummary?.accountValue ?? 0);
  // Unified account: spot USDC doubles as perps margin, so count it in.
  const isUnified =
    abstraction === "unifiedAccount" || abstraction === "portfolioMargin";
  const availableToTrade = withdrawable + (isUnified ? spotUsdc : 0);
  const accountValue = perpsValue + (isUnified ? spotUsdc : 0);
  const arbUsdcNum = arbUsdc !== null ? Number(formatUnits(arbUsdc, 6)) : null;
  const needsFunding = isConnected && state !== null && accountValue <= 0;

  const assetIndexByCoin = useCallback(
    (coin: string) => markets.find((m) => m.coin === coin)?.index,
    [markets],
  );

  const friendlyError = useCallback(
    (e: unknown): string => {
      let text = e instanceof Error ? e.message : String(e);
      if (/typed data|sign/i.test(text) && connector?.id !== "injected") {
        text =
          "Your wallet type can't sign Hyperliquid orders. Smart wallets (Base Account, in-app wallets) are not supported by Hyperliquid — connect a standard wallet like MetaMask or Rabby and try again.";
      } else if (/does not exist|insufficient/i.test(text)) {
        text = `${text} — make sure your Hyperliquid trading balance is funded (Deposit button above).`;
      }
      return text;
    },
    [connector?.id],
  );

  /** Attach the builder code when the user has approved it (approve once). */
  const getBuilder = useCallback(async (): Promise<
    { b: `0x${string}`; f: number } | undefined
  > => {
    if (!HL_BUILDER || !address || !exchange) return undefined;
    try {
      const approved = Number(
        await info
          .maxBuilderFee({ user: address, builder: HL_BUILDER })
          .catch(() => 0),
      );
      if (approved >= HL_BUILDER_FEE) {
        return { b: HL_BUILDER, f: HL_BUILDER_FEE };
      }
      setMsg({
        ok: true,
        text: "One-time signature to enable trading via KRIPTO NR.1…",
      });
      await exchange.approveBuilderFee({
        builder: HL_BUILDER,
        maxFeeRate: `${HL_BUILDER_FEE / 1000}%`,
      });
      return { b: HL_BUILDER, f: HL_BUILDER_FEE };
    } catch {
      // Approval can fail for reasons outside the user's control (e.g. the
      // builder account is below HL's 100 USDC requirement) — never block
      // trading on it.
      return undefined;
    }
  }, [address, exchange, info]);

  const placeOrder = useCallback(async () => {
    if (!exchange || !address || !market) return;
    setBusy(true);
    setMsg(null);
    try {
      const isBuy = side === "long";
      const usd = Number(usdSize);
      if (!Number.isFinite(usd) || usd <= 0) {
        throw new Error("Enter a valid order size in USD.");
      }

      let px: number;
      let tif: "Ioc" | "Gtc";
      if (orderType === "limit") {
        px = Number(limitPx);
        if (!Number.isFinite(px) || px <= 0) {
          throw new Error("Enter a valid limit price.");
        }
        tif = "Gtc";
      } else {
        // Market order = aggressive IOC limit around the mark price.
        px = market.markPx * (isBuy ? 1.02 : 0.98);
        tif = "Ioc";
      }
      const size = usd / (orderType === "limit" ? Number(limitPx) : market.markPx);

      const builder = await getBuilder();
      const result = await exchange.order({
        orders: [
          {
            a: market.index,
            b: isBuy,
            p: formatPx(px, market.szDecimals),
            s: formatSz(size, market.szDecimals),
            r: false,
            t: { limit: { tif } },
          },
        ],
        grouping: "na",
        ...(builder ? { builder } : {}),
      });

      const status = result.response?.data?.statuses?.[0];
      if (status && typeof status === "object" && "error" in status) {
        throw new Error(String(status.error));
      }
      const resting =
        status && typeof status === "object" && "resting" in status;
      setMsg({
        ok: true,
        text: resting
          ? `Limit ${isBuy ? "buy" : "sell"} ${selected} placed at ${limitPx} ✅`
          : `${isBuy ? "Long" : "Short"} ${selected} ~${fmtUsd(usd)} filled ✅`,
      });
      loadAccount();
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  }, [
    exchange,
    address,
    market,
    side,
    orderType,
    limitPx,
    usdSize,
    selected,
    getBuilder,
    friendlyError,
    loadAccount,
  ]);

  const applyLeverage = useCallback(async () => {
    if (!exchange || !market) return;
    const lev = Math.round(Number(leverage));
    if (!Number.isFinite(lev) || lev < 1 || lev > market.maxLeverage) {
      setMsg({
        ok: false,
        text: `Leverage must be between 1 and ${market.maxLeverage}× for ${market.coin}.`,
      });
      return;
    }
    setRowBusy("lev");
    setMsg(null);
    try {
      await exchange.updateLeverage({
        asset: market.index,
        isCross: true,
        leverage: lev,
      });
      setCurLeverage(lev);
      setMsg({ ok: true, text: `${market.coin} leverage set to ${lev}× ✅` });
    } catch (e) {
      setMsg({ ok: false, text: friendlyError(e) });
    } finally {
      setRowBusy(null);
    }
  }, [exchange, market, leverage, friendlyError]);

  const closePosition = useCallback(
    async (coin: string, szi: number) => {
      const m = markets.find((x) => x.coin === coin);
      if (!exchange || !m) return;
      setRowBusy(`close:${coin}`);
      setMsg(null);
      try {
        const isBuy = szi < 0; // buy back a short / sell a long
        const px = m.markPx * (isBuy ? 1.02 : 0.98);
        const builder = await getBuilder();
        const result = await exchange.order({
          orders: [
            {
              a: m.index,
              b: isBuy,
              p: formatPx(px, m.szDecimals),
              s: formatSz(Math.abs(szi), m.szDecimals),
              r: true, // reduce-only
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
        setMsg({ ok: true, text: `${coin} position closed ✅` });
        loadAccount();
      } catch (e) {
        setMsg({ ok: false, text: friendlyError(e) });
      } finally {
        setRowBusy(null);
      }
    },
    [exchange, markets, getBuilder, friendlyError, loadAccount],
  );

  const cancelOrder = useCallback(
    async (coin: string, oid: number) => {
      const a = assetIndexByCoin(coin);
      if (!exchange || a === undefined) return;
      setRowBusy(`cancel:${oid}`);
      setMsg(null);
      try {
        await exchange.cancel({ cancels: [{ a, o: oid }] });
        setMsg({ ok: true, text: "Order cancelled ✅" });
        loadAccount();
      } catch (e) {
        setMsg({ ok: false, text: friendlyError(e) });
      } finally {
        setRowBusy(null);
      }
    },
    [exchange, assetIndexByCoin, friendlyError, loadAccount],
  );

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

  // --- order book rendering ---
  const bids = book?.levels?.[0]?.slice(0, 8) ?? [];
  const asks = book?.levels?.[1]?.slice(0, 8) ?? [];
  const maxBookSz = Math.max(
    1e-9,
    ...bids.map((l) => Number(l.sz)),
    ...asks.map((l) => Number(l.sz)),
  );
  const bestBid = Number(bids[0]?.px ?? 0);
  const bestAsk = Number(asks[0]?.px ?? 0);
  const spreadPct =
    bestBid > 0 && bestAsk > 0 ? ((bestAsk - bestBid) / bestAsk) * 100 : null;

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
            const c =
              m.prevDayPx > 0
                ? ((m.markPx - m.prevDayPx) / m.prevDayPx) * 100
                : 0;
            return (
              <button
                key={m.coin}
                className={`hlRow${m.coin === selected ? " hlRowActive" : ""}`}
                onClick={() => {
                  setSelected(m.coin);
                  setLimitPx("");
                }}
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

      {/* --- selected market: stats, chart, account --- */}
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
            <span className="hlStatV">
              {market ? fmtUsd(market.dayNtlVlm) : "—"}
            </span>
          </div>
        </div>

        {market && <PerpsChart coin={market.coin} />}

        <div className="hlBody">
          <div className="hlAcctHead">
            <span className="hlLabel" style={{ margin: 0 }}>
              Your account
            </span>
            <a className="hlDepositBtn" href={FUND_SWAP_URL}>
              💰 Deposit
            </a>
          </div>
          {!isConnected && (
            <div className="hlNote">
              Connect a wallet (top right) to see balances and trade. Fund
              your Hyperliquid balance from any chain with the Deposit button
              — this terminal is non-custodial and trades your own account.
            </div>
          )}
          {isConnected && (
            <>
              <div className="hlPosRow">
                <span className="pMuted">
                  Account value{isUnified ? " (unified)" : ""}
                </span>
                <span>{fmtUsd(accountValue)}</span>
              </div>
              <div className="hlPosRow">
                <span className="pMuted">Available to trade</span>
                <span>{fmtUsd(availableToTrade)}</span>
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
                    <span>
                      {Math.abs(szi)} @ {fmtPx(Number(pos.entryPx ?? 0))}
                    </span>
                    <span className={pnl >= 0 ? "pGreen" : "pRed"}>
                      {pnl >= 0 ? "+" : ""}
                      {pnl.toFixed(2)}$
                    </span>
                    <button
                      className="hlMiniBtn"
                      disabled={rowBusy === `close:${pos.coin}` || !exchange}
                      onClick={() => closePosition(pos.coin, szi)}
                    >
                      {rowBusy === `close:${pos.coin}` ? "…" : "Close"}
                    </button>
                  </div>
                );
              })}

              <div className="hlLabel" style={{ marginTop: 14 }}>
                Open orders
              </div>
              {orders.length === 0 && (
                <div className="hlNote">No open orders.</div>
              )}
              {orders.slice(0, 12).map((o) => (
                <div className="hlPosRow" key={o.oid}>
                  <span className={o.side === "B" ? "pGreen" : "pRed"}>
                    {o.side === "B" ? "BUY" : "SELL"} {o.coin}
                  </span>
                  <span>
                    {o.sz} @ {o.limitPx}
                  </span>
                  <button
                    className="hlMiniBtn"
                    disabled={rowBusy === `cancel:${o.oid}` || !exchange}
                    onClick={() => cancelOrder(o.coin, o.oid)}
                  >
                    {rowBusy === `cancel:${o.oid}` ? "…" : "Cancel"}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* --- order book + order form --- */}
      <div className="pPanel">
        <div className="hlBody">
          {isConnected && (
            <div className="hlBalRow">
              <span className="hlStatK">Trading balance</span>
              <span
                className={`hlBalV ${availableToTrade > 0 ? "pGreen" : "pRed"}`}
              >
                {fmtUsd(availableToTrade)}
              </span>
            </div>
          )}

          {isConnected && !isEoaWallet && (
            <div className="hlMsg hlMsgWarn">
              ⚠️ Hyperliquid requires a standard (EOA) wallet signature. Smart
              wallets like Base Account can&apos;t place orders — connect
              MetaMask / Rabby instead.
            </div>
          )}

          {needsFunding && (
            <div className="hlFund">
              <div className="hlFundTitle">💰 Fund your trading account</div>
              <div className="hlFundDesc">
                One click from any token on any chain — funds land directly in
                your Hyperliquid perps balance.
              </div>
              <a className="hlFundSwap" href={FUND_SWAP_URL}>
                🔁 Deposit from any chain →
              </a>
              {arbUsdcNum !== null && arbUsdcNum >= MIN_DEPOSIT && isEoaWallet && (
                <>
                  <div className="hlFundDesc" style={{ marginTop: 10 }}>
                    Or send your Arbitrum USDC (
                    <b className="pMono">{arbUsdcNum.toFixed(2)}</b>) via the
                    official bridge:
                  </div>
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
                      disabled={depositBusy}
                      onClick={deposit}
                    >
                      {depositBusy ? "Sending…" : "Deposit"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* order book */}
          <div className="hlBook">
            <div className="hlBookHead">
              <span>Order book</span>
              <span className="pMuted">
                {spreadPct !== null ? `spread ${spreadPct.toFixed(3)}%` : ""}
              </span>
            </div>
            {!book && <div className="pLoading">Loading book…</div>}
            {[...asks].reverse().map((l) => (
              <div className="hlBookRow" key={`a${l.px}`}>
                <span
                  className="hlBookBar hlBookAsk"
                  style={{ width: `${(Number(l.sz) / maxBookSz) * 100}%` }}
                />
                <span className="pRed">{fmtPx(Number(l.px))}</span>
                <span>{Number(l.sz).toFixed(3)}</span>
              </div>
            ))}
            {book && <div className="hlBookMid">{market ? fmtPx(market.markPx) : ""}</div>}
            {bids.map((l) => (
              <div className="hlBookRow" key={`b${l.px}`}>
                <span
                  className="hlBookBar hlBookBid"
                  style={{ width: `${(Number(l.sz) / maxBookSz) * 100}%` }}
                />
                <span className="pGreen">{fmtPx(Number(l.px))}</span>
                <span>{Number(l.sz).toFixed(3)}</span>
              </div>
            ))}
          </div>

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

          <div className="hlTypeBtns">
            <button
              className={`hlType${orderType === "market" ? " hlTypeOn" : ""}`}
              onClick={() => setOrderType("market")}
            >
              Market
            </button>
            <button
              className={`hlType${orderType === "limit" ? " hlTypeOn" : ""}`}
              onClick={() => {
                setOrderType("limit");
                if (!limitPx && market) {
                  setLimitPx(formatPx(market.markPx, market.szDecimals));
                }
              }}
            >
              Limit
            </button>
          </div>

          {orderType === "limit" && (
            <div className="hlField">
              <label className="hlLabel">Limit price (USD)</label>
              <input
                className="hlInput"
                inputMode="decimal"
                value={limitPx}
                onChange={(e) => setLimitPx(e.target.value)}
                placeholder={market ? formatPx(market.markPx, market.szDecimals) : ""}
              />
            </div>
          )}

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
            <label className="hlLabel">
              Leverage {curLeverage ? `· current ${curLeverage}×` : ""}
            </label>
            <div className="hlFundRow">
              <input
                className="hlInput"
                inputMode="numeric"
                value={leverage}
                onChange={(e) => setLeverage(e.target.value)}
                placeholder={market ? `1–${market.maxLeverage}` : ""}
              />
              <button
                className="hlMiniBtn hlMiniWide"
                disabled={!exchange || rowBusy === "lev" || !leverage}
                onClick={applyLeverage}
              >
                {rowBusy === "lev" ? "…" : "Set"}
              </button>
            </div>
          </div>

          <div className="hlField">
            <label className="hlLabel">Est. size</label>
            <div className="hlInput" style={{ opacity: 0.8 }}>
              {market && Number(usdSize) > 0
                ? `${formatSz(
                    Number(usdSize) /
                      (orderType === "limit" && Number(limitPx) > 0
                        ? Number(limitPx)
                        : market.markPx),
                    market.szDecimals,
                  )} ${market.coin}`
                : "—"}
            </div>
          </div>

          <button
            className="hlSubmit"
            disabled={!isConnected || !exchange || busy || !market}
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
            {orderType === "market"
              ? "Market order (IOC, ~2% max slippage), cross margin."
              : "Limit order (GTC), cross margin."}{" "}
            Non-custodial — orders are signed by your own wallet. See{" "}
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
