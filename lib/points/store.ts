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
};

export type LeaderRow = { address: string; points: number };

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
}

const key = {
  user: (a: string) => `kr1:${SEASON}:u:${a}`,
  lb: () => `kr1:${SEASON}:lb`,
  event: (id: string) => `kr1:${SEASON}:ev:${id}`,
  invitees: (a: string) => `kr1:${SEASON}:inv:${a}`,
};

export function emptyUser(address: string): UserRecord {
  const now = Date.now();
  return {
    address: address.toLowerCase(),
    base: 0,
    referral: 0,
    bonus: 0,
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
  return Math.round(u.base + u.referral + u.bonus);
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
}

// ---------------------------------------------------------------------------
// In-memory driver
// ---------------------------------------------------------------------------

type Mem = {
  users: Map<string, UserRecord>;
  scores: Map<string, number>;
  events: Set<string>;
  invitees: Map<string, Set<string>>;
};

// Survives hot-reloads in dev (module re-evaluation) by hanging off globalThis.
const g = globalThis as typeof globalThis & { __kr1Points?: Mem };
const mem: Mem = (g.__kr1Points ??= {
  users: new Map(),
  scores: new Map(),
  events: new Set(),
  invitees: new Map(),
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
