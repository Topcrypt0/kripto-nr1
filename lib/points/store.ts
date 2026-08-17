// Persistence for the points program. Server-only.
//
// Two drivers behind one tiny interface:
//
//   • "redis"  — any Upstash-compatible REST endpoint (Vercel KV, Upstash
//                Redis, Redis Cloud's REST proxy). Talked to over plain fetch,
//                so the project keeps its zero-extra-dependency footprint.
//   • "memory" — process-local fallback used when no credentials are set. Good
//                enough for `next dev` and previews; it evaporates on redeploy,
//                which the dashboard surfaces instead of pretending otherwise.
//
// Data model (all keys namespaced by season):
//   kr1:<season>:u:<addr>   JSON UserRecord
//   kr1:<season>:lb         sorted set  addr -> total points   (leaderboard)
//   kr1:<season>:ev:<id>    idempotency marker for one awarded action
//   kr1:<season>:inv:<addr> set of addresses this address invited
//   kr1:<season>:meta       JSON counters (total points minted)

import { SEASON, type PointsSource } from "./config";

export type UserRecord = {
  address: string;
  /** Points from the user's own verified actions. */
  base: number;
  /** Points minted from invitees' activity (both levels). */
  referral: number;
  /** One-time quest / activation bonuses. */
  bonus: number;
  /**
   * Net result of the points rocket: stakes are subtracted the moment a round
   * is committed, payouts added on reveal. Goes negative when the player is
   * down — kept apart from `base` so gambling never distorts earned volume.
   */
  gamble: number;
  /** Points taken instead of an ETH lottery payout. */
  converted: number;
  /** Points-rocket lifetime stats (display only). */
  rocket?: { rounds: number; staked: number; won: number; best: number };
  /** Verified USD volume, total and per source. */
  volumeUsd: number;
  bySource: Partial<Record<PointsSource, { points: number; volumeUsd: number; actions: number }>>;
  actions: number;
  /** Lowercased address of the inviter, bound once and never changed. */
  referrer: string | null;
  /** Invitee count is denormalised so the profile read stays a single GET. */
  invitees: number;
  /** Whether the activation bonus for this user was already paid out. */
  activated: boolean;
  streak: number;
  /** UTC day index (days since epoch) of the last earning action. */
  lastDay: number;
  firstSeen: number;
  updatedAt: number;
  /** Cursor for incremental Hyperliquid fill syncing (ms timestamp). */
  hlCursor?: number;
  /**
   * An ETH lottery win the player chose to take as points. Held until the
   * contract's 256-block claim window closes and we can prove on-chain that
   * the ETH was never actually claimed — see lib/points/convert.ts.
   */
  pendingConvert?: {
    targetBlock: number;
    settleAfter: number;
    points: number;
    payoutWei: string;
    multiplier: number;
    createdAt: number;
  } | null;
};

export type LeaderRow = { address: string; points: number };

/**
 * One points-rocket round. Committed (with its target block) before that block
 * exists, revealed once the chain has produced it — the same commit-reveal the
 * contract uses, with the Base block hash as the beacon.
 */
export type RocketRound = {
  id: string;
  address: string;
  bet: number;
  targetBlock: number;
  createdAt: number;
  status: "pending" | "settled";
  blockHash?: string;
  roll?: number;
  multiplier?: number;
  payout?: number;
  settledAt?: number;
};

/**
 * The house pool for the points game — the operator's minted points budget.
 * `balance` holds stakes plus whatever the operator funded; `reserved` locks
 * the worst-case payout of every pending round, exactly like the contract's
 * `reserved`. Nothing can be paid out that the pool has not already covered,
 * so total liability is bounded by what was funded.
 */
export type Pool = {
  funded: number;
  balance: number;
  reserved: number;
  paidOut: number;
  wagered: number;
  rounds: number;
};

export const emptyPool = (): Pool => ({
  funded: 0,
  balance: 0,
  reserved: 0,
  paidOut: 0,
  wagered: 0,
  rounds: 0,
});

export interface PointsStore {
  readonly kind: "redis" | "memory";
  getUser(address: string): Promise<UserRecord | null>;
  putUser(rec: UserRecord): Promise<void>;
  /** Mirror a user's total into the leaderboard index. */
  setScore(address: string, total: number): Promise<void>;
  /** Reserve an action id. Returns false when it was already counted. */
  claimEvent(id: string): Promise<boolean>;
  top(limit: number, offset?: number): Promise<LeaderRow[]>;
  rank(address: string): Promise<number | null>;
  countUsers(): Promise<number>;
  addInvitee(inviter: string, invitee: string): Promise<number>;
  listInvitees(inviter: string): Promise<string[]>;

  // --- points rocket ---
  /** Take a named lock. False when someone else already holds it. */
  lock(name: string, ttlSeconds: number): Promise<boolean>;
  unlock(name: string): Promise<void>;
  getRound(id: string): Promise<RocketRound | null>;
  putRound(round: RocketRound): Promise<void>;
  pushRound(address: string, id: string): Promise<void>;
  listRounds(address: string, limit: number): Promise<RocketRound[]>;
  getPool(): Promise<Pool>;
  /** Atomically add the given deltas and return the resulting pool. */
  addToPool(delta: Partial<Pool>): Promise<Pool>;
}

const key = {
  user: (a: string) => `kr1:${SEASON}:u:${a}`,
  lb: () => `kr1:${SEASON}:lb`,
  event: (id: string) => `kr1:${SEASON}:ev:${id}`,
  invitees: (a: string) => `kr1:${SEASON}:inv:${a}`,
  lock: (n: string) => `kr1:${SEASON}:lock:${n}`,
  round: (id: string) => `kr1:${SEASON}:r:${id}`,
  rounds: (a: string) => `kr1:${SEASON}:rs:${a}`,
  pool: () => `kr1:${SEASON}:pool`,
};

const POOL_FIELDS: (keyof Pool)[] = [
  "funded",
  "balance",
  "reserved",
  "paidOut",
  "wagered",
  "rounds",
];

/** Keep at most this many rounds of history per player. */
export const ROUND_HISTORY = 50;

export function emptyUser(address: string): UserRecord {
  const now = Date.now();
  return {
    address: address.toLowerCase(),
    base: 0,
    referral: 0,
    bonus: 0,
    gamble: 0,
    converted: 0,
    volumeUsd: 0,
    bySource: {},
    actions: 0,
    referrer: null,
    invitees: 0,
    activated: false,
    streak: 0,
    lastDay: 0,
    firstSeen: now,
    updatedAt: now,
  };
}

export function totalPoints(u: UserRecord): number {
  // `gamble` is signed; the spend path never lets the sum go below zero.
  return Math.round(
    u.base + u.referral + u.bonus + (u.gamble ?? 0) + (u.converted ?? 0),
  );
}

// ---------------------------------------------------------------------------
// Upstash REST driver
// ---------------------------------------------------------------------------

type RestConfig = { url: string; token: string };

function restConfig(): RestConfig | null {
  const url =
    process.env.KV_REST_API_URL ??
    process.env.UPSTASH_REDIS_REST_URL ??
    process.env.REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ??
    process.env.UPSTASH_REDIS_REST_TOKEN ??
    process.env.REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

class RedisStore implements PointsStore {
  readonly kind = "redis" as const;
  constructor(private cfg: RestConfig) {}

  /** One round-trip for N commands. Throws on transport / auth failures. */
  private async pipeline(cmds: (string | number)[][]): Promise<unknown[]> {
    const res = await fetch(`${this.cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmds),
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`points store ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as ({ result?: unknown; error?: string })[];
    return json.map((r) => {
      if (r?.error) throw new Error(`points store: ${r.error}`);
      return r?.result;
    });
  }

  private async one<T>(cmd: (string | number)[]): Promise<T> {
    const [r] = await this.pipeline([cmd]);
    return r as T;
  }

  async getUser(address: string) {
    const raw = await this.one<string | null>(["GET", key.user(address)]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserRecord;
    } catch {
      return null;
    }
  }

  async putUser(rec: UserRecord) {
    await this.one(["SET", key.user(rec.address), JSON.stringify(rec)]);
  }

  async setScore(address: string, total: number) {
    await this.one(["ZADD", key.lb(), total, address]);
  }

  async claimEvent(id: string) {
    // NX + a 1-year TTL: long enough that no realistic replay slips through,
    // short enough that the key space stays bounded per season.
    const r = await this.one<string | null>([
      "SET",
      key.event(id),
      "1",
      "NX",
      "EX",
      31_536_000,
    ]);
    return r === "OK";
  }

  async top(limit: number, offset = 0) {
    const flat = await this.one<string[]>([
      "ZRANGE",
      key.lb(),
      offset,
      offset + limit - 1,
      "REV",
      "WITHSCORES",
    ]);
    const rows: LeaderRow[] = [];
    for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) {
      rows.push({ address: flat[i], points: Number(flat[i + 1]) });
    }
    return rows;
  }

  async rank(address: string) {
    const r = await this.one<number | null>([
      "ZREVRANK",
      key.lb(),
      address,
    ]);
    return typeof r === "number" ? r + 1 : null;
  }

  async countUsers() {
    return (await this.one<number>(["ZCARD", key.lb()])) ?? 0;
  }

  async addInvitee(inviter: string, invitee: string) {
    const [, count] = await this.pipeline([
      ["SADD", key.invitees(inviter), invitee],
      ["SCARD", key.invitees(inviter)],
    ]);
    return Number(count ?? 0);
  }

  async listInvitees(inviter: string) {
    return (await this.one<string[]>(["SMEMBERS", key.invitees(inviter)])) ?? [];
  }

  async lock(name: string, ttlSeconds: number) {
    const r = await this.one<string | null>([
      "SET",
      key.lock(name),
      "1",
      "NX",
      "EX",
      ttlSeconds,
    ]);
    return r === "OK";
  }

  async unlock(name: string) {
    await this.one(["DEL", key.lock(name)]);
  }

  async getRound(id: string) {
    const raw = await this.one<string | null>(["GET", key.round(id)]);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as RocketRound;
    } catch {
      return null;
    }
  }

  async putRound(round: RocketRound) {
    await this.one(["SET", key.round(round.id), JSON.stringify(round)]);
  }

  async pushRound(address: string, id: string) {
    await this.pipeline([
      ["LPUSH", key.rounds(address), id],
      ["LTRIM", key.rounds(address), 0, ROUND_HISTORY - 1],
    ]);
  }

  async listRounds(address: string, limit: number) {
    const ids =
      (await this.one<string[]>([
        "LRANGE",
        key.rounds(address),
        0,
        Math.max(0, limit - 1),
      ])) ?? [];
    if (ids.length === 0) return [];
    const raws = await this.pipeline(ids.map((id) => ["GET", key.round(id)]));
    return raws.flatMap((raw) => {
      try {
        return raw ? [JSON.parse(raw as string) as RocketRound] : [];
      } catch {
        return [];
      }
    });
  }

  async getPool() {
    const flat = await this.one<Record<string, string> | string[] | null>([
      "HGETALL",
      key.pool(),
    ]);
    const pool = emptyPool();
    if (!flat) return pool;
    // Upstash returns an object for HGETALL; a raw Redis proxy may return the
    // flattened field/value array.
    const entries = Array.isArray(flat)
      ? flat.reduce<Record<string, string>>((acc, v, i, arr) => {
          if (i % 2 === 0) acc[v] = arr[i + 1];
          return acc;
        }, {})
      : flat;
    for (const f of POOL_FIELDS) {
      const n = Number(entries[f]);
      if (Number.isFinite(n)) pool[f] = n;
    }
    return pool;
  }

  async addToPool(delta: Partial<Pool>) {
    const fields = POOL_FIELDS.filter((f) => Number(delta[f] ?? 0) !== 0);
    if (fields.length === 0) return this.getPool();
    // HINCRBYFLOAT is atomic per field, so concurrent rounds cannot lose an
    // update the way a read-modify-write on a JSON blob would.
    await this.pipeline(
      fields.map((f) => ["HINCRBYFLOAT", key.pool(), f, Number(delta[f])]),
    );
    return this.getPool();
  }
}

// ---------------------------------------------------------------------------
// In-memory driver
// ---------------------------------------------------------------------------

type Mem = {
  users: Map<string, UserRecord>;
  scores: Map<string, number>;
  events: Set<string>;
  invitees: Map<string, Set<string>>;
  locks: Map<string, number>;
  rounds: Map<string, RocketRound>;
  history: Map<string, string[]>;
  pool: Pool;
};

// Survives hot-reloads in dev (module re-evaluation) by hanging off globalThis.
const g = globalThis as typeof globalThis & { __kr1Points?: Mem };
const mem: Mem = (g.__kr1Points ??= {
  users: new Map(),
  scores: new Map(),
  events: new Set(),
  invitees: new Map(),
  locks: new Map(),
  rounds: new Map(),
  history: new Map(),
  pool: emptyPool(),
});

class MemoryStore implements PointsStore {
  readonly kind = "memory" as const;

  async getUser(address: string) {
    const u = mem.users.get(address);
    return u ? ({ ...u, bySource: { ...u.bySource } } as UserRecord) : null;
  }

  async putUser(rec: UserRecord) {
    mem.users.set(rec.address, { ...rec, bySource: { ...rec.bySource } });
  }

  async setScore(address: string, total: number) {
    mem.scores.set(address, total);
  }

  async claimEvent(id: string) {
    if (mem.events.has(id)) return false;
    mem.events.add(id);
    return true;
  }

  private sorted(): LeaderRow[] {
    return [...mem.scores.entries()]
      .map(([address, points]) => ({ address, points }))
      .sort((a, b) => b.points - a.points || a.address.localeCompare(b.address));
  }

  async top(limit: number, offset = 0) {
    return this.sorted().slice(offset, offset + limit);
  }

  async rank(address: string) {
    const i = this.sorted().findIndex((r) => r.address === address);
    return i < 0 ? null : i + 1;
  }

  async countUsers() {
    return mem.scores.size;
  }

  async addInvitee(inviter: string, invitee: string) {
    const set = mem.invitees.get(inviter) ?? new Set<string>();
    set.add(invitee);
    mem.invitees.set(inviter, set);
    return set.size;
  }

  async listInvitees(inviter: string) {
    return [...(mem.invitees.get(inviter) ?? [])];
  }

  async lock(name: string, ttlSeconds: number) {
    const until = mem.locks.get(name);
    if (until && until > Date.now()) return false;
    mem.locks.set(name, Date.now() + ttlSeconds * 1000);
    return true;
  }

  async unlock(name: string) {
    mem.locks.delete(name);
  }

  async getRound(id: string) {
    const r = mem.rounds.get(id);
    return r ? { ...r } : null;
  }

  async putRound(round: RocketRound) {
    mem.rounds.set(round.id, { ...round });
  }

  async pushRound(address: string, id: string) {
    const list = [id, ...(mem.history.get(address) ?? [])].slice(
      0,
      ROUND_HISTORY,
    );
    mem.history.set(address, list);
  }

  async listRounds(address: string, limit: number) {
    return (mem.history.get(address) ?? [])
      .slice(0, limit)
      .flatMap((id) => {
        const r = mem.rounds.get(id);
        return r ? [{ ...r }] : [];
      });
  }

  async getPool() {
    return { ...mem.pool };
  }

  async addToPool(delta: Partial<Pool>) {
    for (const f of POOL_FIELDS) {
      const d = Number(delta[f] ?? 0);
      if (d) mem.pool[f] += d;
    }
    return { ...mem.pool };
  }
}

let cached: PointsStore | null = null;

export function getStore(): PointsStore {
  if (cached) return cached;
  const cfg = restConfig();
  cached = cfg ? new RedisStore(cfg) : new MemoryStore();
  return cached;
}

/** True when points survive a redeploy (i.e. a real KV is wired up). */
export function isDurable(): boolean {
  return getStore().kind === "redis";
}
