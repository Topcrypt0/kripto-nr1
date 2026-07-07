"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";

const INTERVALS = ["5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_MS: Record<Interval, number> = {
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
};

const CANDLES = 200;
const REFRESH_MS = 15_000;

type ChartMode = "rocket" | "tradingview";
const MODE_KEY = "kr1_chart_mode";

export function PerpsChart({ coin }: { coin: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [interval, setIntervalKey] = useState<Interval>("1h");
  const [empty, setEmpty] = useState(false);
  const [mode, setMode] = useState<ChartMode>("rocket");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MODE_KEY);
      if (saved === "tradingview") setMode("tradingview");
    } catch {
      /* ignore */
    }
  }, []);
  const switchMode = (m: ChartMode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !coin || mode !== "rocket") return;

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b97c7",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,.05)" },
        horzLines: { color: "rgba(255,255,255,.05)" },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,.1)",
        timeVisible: true,
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,.1)" },
      crosshair: {
        horzLine: { color: "rgba(245,181,10,.5)", labelBackgroundColor: "#f5b50a" },
        vertLine: { color: "rgba(245,181,10,.5)", labelBackgroundColor: "#f5b50a" },
      },
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#2fe08a",
      downColor: "#ff6a52",
      wickUpColor: "#2fe08a",
      wickDownColor: "#ff6a52",
      borderVisible: false,
    });

    const info = new InfoClient({ transport: new HttpTransport() });
    let disposed = false;
    let first = true;

    const load = async () => {
      try {
        const end = Date.now();
        const start = end - INTERVAL_MS[interval] * CANDLES;
        const candles = await info.candleSnapshot({
          coin,
          interval,
          startTime: start,
          endTime: end,
        });
        if (disposed) return;
        setEmpty(candles.length === 0);
        series.setData(
          candles.map((c) => ({
            time: Math.floor(c.t / 1000) as UTCTimestamp,
            open: Number(c.o),
            high: Number(c.h),
            low: Number(c.l),
            close: Number(c.c),
          })),
        );
        if (first) {
          chart.timeScale().fitContent();
          first = false;
        }
      } catch {
        // transient network error — keep last data
      }
    };

    load();
    const timer = setInterval(load, REFRESH_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      chart.remove();
      chartRef.current = null;
    };
  }, [coin, interval, mode]);

  // Full TradingView chart (indicators, drawing tools) via the public embed.
  // Hyperliquid market data is listed on TradingView; users can also switch
  // the symbol inside the widget.
  const tvUrl =
    `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(`HYPERLIQUID:${coin}USD`)}` +
    `&interval=60&theme=dark&style=1&locale=en&withdateranges=1` +
    `&hide_side_toolbar=0&allow_symbol_change=1&save_image=1` +
    `&backgroundColor=%230a0f26&studies=%5B%5D`;

  return (
    <div className="hlChartWrap">
      <div className="hlChartBar">
        {mode === "rocket" &&
          INTERVALS.map((i) => (
            <button
              key={i}
              className={`hlTf${i === interval ? " hlTfOn" : ""}`}
              onClick={() => setIntervalKey(i)}
            >
              {i}
            </button>
          ))}
        <span className="hlChartSpacer" />
        <button
          className={`hlTf${mode === "rocket" ? " hlTfOn" : ""}`}
          onClick={() => switchMode("rocket")}
          title="Fast built-in chart with live Hyperliquid data"
        >
          🚀 Rocket
        </button>
        <button
          className={`hlTf${mode === "tradingview" ? " hlTfOn" : ""}`}
          onClick={() => switchMode("tradingview")}
          title="Full TradingView chart: indicators & drawing tools"
        >
          📊 TradingView
        </button>
      </div>
      {mode === "rocket" ? (
        <>
          <div ref={containerRef} className="hlChart" />
          {empty && <div className="pLoading">No chart data for {coin}.</div>}
        </>
      ) : (
        <iframe
          key={coin}
          src={tvUrl}
          className="hlTvFrame"
          title={`${coin} TradingView chart`}
          allowFullScreen
        />
      )}
    </div>
  );
}
