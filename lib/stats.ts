// Per-address game ledger + lifetime stats, persisted in localStorage. The
// Resolved event gives us bet, payout, multiplier and refunded for every game,
// so we can compute exact PnL without an indexer.

export type GameRecord = {
  txHash: string;
  betWei: string;
  multiplier: number;
  payoutWei: string;
  refunded: boolean;
  ts: number;
};

export type Stats = {
  count: number; // resolved games that were a real win/loss (refunds excluded)
  wins: number;
  losses: number;
  refunds: number;
  wagered: bigint; // sum of bets (non-refunded)
  returned: bigint; // sum of payouts (wins)
  pnl: bigint; // returned - wagered
  pnlPct: number; // pnl / wagered * 100
  winRate: number; // wins / (wins + losses) * 100
  best: number; // best multiplier hit
};

const MAX_RECORDS = 500;
const keyFor = (addr?: string) => `kr1_games_${(addr ?? "anon").toLowerCase()}`;

export function loadGames(addr?: string): GameRecord[] {
  try {
    const raw = localStorage.getItem(keyFor(addr));
    return raw ? (JSON.parse(raw) as GameRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveGames(addr: string | undefined, games: GameRecord[]) {
  try {
    localStorage.setItem(keyFor(addr), JSON.stringify(games.slice(0, MAX_RECORDS)));
  } catch {
    /* ignore quota / serialization issues */
  }
}

/** Merge new records in (dedupe by txHash), newest first, and persist. */
export function mergeGames(
  addr: string | undefined,
  incoming: GameRecord[],
): GameRecord[] {
  const existing = loadGames(addr);
  const seen = new Set(existing.map((g) => g.txHash));
  const merged = [...incoming.filter((g) => !seen.has(g.txHash)), ...existing]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_RECORDS);
  saveGames(addr, merged);
  return merged;
}

export function computeStats(games: GameRecord[]): Stats {
  let wins = 0;
  let losses = 0;
  let refunds = 0;
  let wagered = 0n;
  let returned = 0n;
  let best = 0;

  for (const g of games) {
    if (g.refunded) {
      refunds++;
      continue;
    }
    wagered += BigInt(g.betWei);
    returned += BigInt(g.payoutWei);
    if (g.multiplier > 0) {
      wins++;
      if (g.multiplier > best) best = g.multiplier;
    } else {
      losses++;
    }
  }

  const decided = wins + losses;
  const pnl = returned - wagered;
  const pnlPct =
    wagered > 0n ? (Number(pnl) / Number(wagered)) * 100 : 0;
  const winRate = decided > 0 ? (wins / decided) * 100 : 0;

  return {
    count: decided,
    wins,
    losses,
    refunds,
    wagered,
    returned,
    pnl,
    pnlPct,
    winRate,
    best,
  };
}

/** Single-game profit percentage: +100% for X2, -100% for a loss, 0 for refund. */
export function gamePct(multiplier: number, refunded: boolean): number {
  if (refunded) return 0;
  return multiplier > 0 ? (multiplier - 1) * 100 : -100;
}
