"use client";

import { useEffect, useMemo, useState } from "react";
import { POLYMARKET_APP_URL, polymarketTradeUrl } from "@/lib/monetize";

type GammaMarket = {
  question?: string;
  groupItemTitle?: string;
  outcomes?: string;
  outcomePrices?: string;
  volume24hr?: number;
};

type GammaEvent = {
  id: string;
  title: string;
  slug: string;
  icon?: string;
  image?: string;
  volume24hr?: number;
  liquidity?: number;
  endDate?: string;
  markets?: GammaMarket[];
};

const TAGS: { slug: string; label: string }[] = [
  { slug: "", label: "🔥 Trending" },
  { slug: "politics", label: "Politics" },
  { slug: "crypto", label: "Crypto" },
  { slug: "sports", label: "Sports" },
  { slug: "pop-culture", label: "Culture" },
];

function parsePair(m: GammaMarket): { name: string; p: number }[] {
  try {
    const outcomes: string[] = JSON.parse(m.outcomes ?? "[]");
    const prices: string[] = JSON.parse(m.outcomePrices ?? "[]");
    return outcomes.map((name, i) => ({ name, p: Number(prices[i] ?? 0) }));
  } catch {
    return [];
  }
}

/** Top outcomes to visualize for an event card. */
function topOutcomes(ev: GammaEvent): { name: string; p: number }[] {
  const markets = ev.markets ?? [];
  if (markets.length === 0) return [];
  if (markets.length === 1) return parsePair(markets[0]).slice(0, 3);
  // Multi-market event (e.g. an election): each market is a candidate;
  // show the top 3 by implied probability of its first outcome (Yes).
  return markets
    .map((m) => ({
      name: m.groupItemTitle || m.question || "?",
      p: parsePair(m)[0]?.p ?? 0,
    }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);
}

function fmtVol(n?: number): string {
  if (!n || !Number.isFinite(n)) return "—";
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function PredictionMarkets() {
  const [tag, setTag] = useState("");
  const [events, setEvents] = useState<GammaEvent[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(false);
    fetch(`/api/polymarket?limit=48${tag ? `&tag=${tag}` : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setEvents(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tag]);

  const shown = useMemo(() => {
    if (!events) return null;
    const q = query.trim().toLowerCase();
    return q
      ? events.filter((e) => e.title.toLowerCase().includes(q))
      : events;
  }, [events, query]);

  return (
    <>
      {POLYMARKET_APP_URL && (
        <a
          className="pmAppBanner"
          href={POLYMARKET_APP_URL}
          target="_blank"
          rel="noreferrer"
        >
          <span className="pmAppBannerTitle">🚀 KRIPTO Predict Terminal</span>
          <span className="pmAppBannerDesc">
            Trade with just an email — no wallet or gas needed. Open the
            terminal →
          </span>
        </a>
      )}
      <div className="pmToolbar">
        <input
          className="pmSearch"
          placeholder="Search markets…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {TAGS.map((t) => (
          <button
            key={t.slug}
            className={`pmChip${tag === t.slug ? " pmChipOn" : ""}`}
            onClick={() => setTag(t.slug)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="pLoading">
          Couldn&apos;t load markets — try again in a minute.
        </div>
      )}
      {!error && shown === null && (
        <div className="pLoading">Loading markets…</div>
      )}
      {shown !== null && shown.length === 0 && (
        <div className="pLoading">No markets found.</div>
      )}

      <div className="pmGrid">
        {(shown ?? []).map((ev) => {
          const outs = topOutcomes(ev);
          return (
            <div className="pmCard" key={ev.id}>
              <div className="pmCardHead">
                {(ev.icon || ev.image) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="pmIcon" src={ev.icon || ev.image} alt="" />
                )}
                <div className="pmQ">{ev.title}</div>
              </div>
              <div className="pmOutcomes">
                {outs.map((o) => (
                  <div className="pmOut" key={o.name}>
                    <span className="pmOutName">{o.name}</span>
                    <span className="pmBar">
                      <span
                        className="pmBarFill"
                        style={{ width: `${Math.round(o.p * 100)}%` }}
                      />
                    </span>
                    <span className="pmOutPct">
                      {(o.p * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
              <div className="pmMeta">
                <span>24h vol {fmtVol(ev.volume24hr)}</span>
                {ev.endDate && (
                  <span>
                    ends {new Date(ev.endDate).toLocaleDateString("en-US")}
                  </span>
                )}
              </div>
              <a
                className="pmTrade"
                href={polymarketTradeUrl(ev.slug)}
                target="_blank"
                rel="noreferrer"
              >
                Trade →
              </a>
            </div>
          );
        })}
      </div>
    </>
  );
}
