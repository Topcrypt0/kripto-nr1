"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useWalletClient } from "wagmi";
import {
  ExchangeClient,
  HttpTransport,
  InfoClient,
  type ClearinghouseStateResponse,
  type MetaAndAssetCtxsResponse,
} from "@nktkas/hyperliquid";
import {
  HL_BUILDER,
  HL_BUILDER_FEE,
  HL_BUILDER_FEE_PCT,
} from "@/lib/monetize";

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
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();

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
      return;
    }
    try {
      setState(await info.clearinghouseState({ user: address }));
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
        if (approved < HL_BUILDER_FEE) {
          setMsg({
            ok: true,
            text: `One-time signature: approving the ${HL_BUILDER_FEE_PCT} platform fee…`,
          });
          await exchange.approveBuilderFee({
            builder: HL_BUILDER,
            maxFeeRate: `${HL_BUILDER_FEE / 1000}%`,
          });
        }
        builder = { b: HL_BUILDER, f: HL_BUILDER_FEE };
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
      const text = e instanceof Error ? e.message : String(e);
      setMsg({ ok: false, text });
    } finally {
      setBusy(false);
    }
  }, [walletClient, address, market, side, usdSize, selected, info, loadAccount]);

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
            margin.{" "}
            {HL_BUILDER
              ? `Includes the ${HL_BUILDER_FEE_PCT} KRIPTO NR.1 platform fee (one-time approval on first trade).`
              : "Platform fee disabled (set NEXT_PUBLIC_HL_BUILDER)."}
          </p>
        </div>
      </div>
    </div>
  );
}
