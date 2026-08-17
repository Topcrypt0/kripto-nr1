// The award engine: turns verified actions into points, keeps the streak, pays
// the referral tree and exposes the reads the dashboard needs. Server-only.

import {
  GROUP_MAX_MONTHS,
  GROUP_MONTH_POINTS,
  GROUP_PERIOD_DAYS,
  GROUP_PERIOD_MS,
  REFERRAL_ACTIVATION_BONUS,
  REFERRAL_L1,
  REFERRAL_L2,
  SOURCES,
  formatPoints,
  nextTier,
  pointsForVolume,
  streakMultiplier,
  tierFor,
  type PointsSource,
} from "./config";
import {
  earnedPoints,
  emptyUser,
  getStore,
  totalPoints,
  type LeaderRow,
  type UserRecord,
} from "./store";
import type { VerifiedAction } from "./verify";

const DAY_MS = 86_400_000;
const dayIndex = (ms = Date.now()) => Math.floor(ms / DAY_MS);

export const isAddress = (s: unknown): s is string =>
  typeof s === "string" && /^0x[a-fA-F0-9]{40}$/.test(s);

export const norm = (a: string) => a.toLowerCase();

/** Load a user, creating (but not persisting) a blank record when new. */
async function load(address: string): Promise<UserRecord> {
  const store = getStore();
  const rec = (await store.getUser(norm(address))) ?? emptyUser(address);
  // Records written before the rocket / group features lack these fields.
  rec.gamble ??= 0;
  rec.converted ??= 0;
  rec.spent ??= 0;
  return rec;
}

async function save(rec: UserRecord) {
  const store = getStore();
  rec.updatedAt = Date.now();
  await store.putUser(rec);
  // The board ranks lifetime earned points, so spending on redemptions or
  // losing a rocket round never costs a wallet its position.
  await store.setScore(rec.address, earnedPoints(rec));
}

/** Spendable balance — everything the wallet holds, however it was earned. */
export async function balanceOf(address: string): Promise<number> {
  return totalPoints(await load(address));
}

/**
 * Move points out of a wallet and into the rocket. Refuses to overdraw, so a
 * balance can never go negative no matter how the caller behaves.
 */
export async function stakePoints(
  address: string,
  amount: number,
): Promise<{ ok: boolean; balance: number }> {
  const user = await load(address);
  const balance = totalPoints(user);
  if (amount <= 0 || balance < amount) return { ok: false, balance };

  user.gamble -= amount;
  const stats = user.rocket ?? { rounds: 0, staked: 0, won: 0, best: 0 };
  stats.rounds += 1;
  stats.staked += amount;
  user.rocket = stats;
  await save(user);
  return { ok: true, balance: totalPoints(user) };
}

/** Return a stake (round could not be committed) without touching the stats. */
export async function refundStake(address: string, amount: number) {
  const user = await load(address);
  user.gamble += amount;
  const stats = user.rocket;
  if (stats) {
    stats.rounds = Math.max(0, stats.rounds - 1);
    stats.staked = Math.max(0, stats.staked - amount);
  }
  await save(user);
}

/** Pay a points-rocket win. `multiplier` is recorded for the "best hit" stat. */
export async function payRocketWin(
  address: string,
  payout: number,
  multiplier: number,
): Promise<number> {
  const user = await load(address);
  user.gamble += payout;
  const stats = user.rocket ?? { rounds: 0, staked: 0, won: 0, best: 0 };
  stats.won += payout;
  if (multiplier > stats.best) stats.best = multiplier;
  user.rocket = stats;
  await save(user);
  return totalPoints(user);
}

/** Credit points taken in place of an ETH lottery payout. */
export async function creditConversion(
  address: string,
  points: number,
): Promise<number> {
  const user = await load(address);
  user.converted += points;
  await save(user);
  return totalPoints(user);
}

// ---------------------------------------------------------------------------
// Private group subscription
// ---------------------------------------------------------------------------

export type GroupStatus = {
  active: boolean;
  until: number | null;
  daysLeft: number;
  periods: number;
  pricePerPeriod: number;
  periodDays: number;
  maxPeriods: number;
  balance: number;
  /** Periods this wallet could afford right now. */
  affordable: number;
};

function groupStatusOf(user: UserRecord): GroupStatus {
  const until = user.groupUntil ?? null;
  const active = !!until && until > Date.now();
  const balance = totalPoints(user);
  return {
    active,
    until,
    daysLeft: active ? Math.ceil((until! - Date.now()) / 86_400_000) : 0,
    periods: user.groupPeriods ?? 0,
    pricePerPeriod: GROUP_MONTH_POINTS,
    periodDays: GROUP_PERIOD_DAYS,
    maxPeriods: GROUP_MAX_MONTHS,
    balance,
    affordable: Math.floor(balance / GROUP_MONTH_POINTS),
  };
}

export async function getGroupStatus(address: string): Promise<GroupStatus> {
  return groupStatusOf(await load(address));
}

/**
 * Buy `periods` × 30 days of group access. Points are burned, not moved to the
 * rocket pool — that is what keeps them scarce and keeps a period genuinely
 * worth $20 of platform fees.
 *
 * Access extends from the current expiry when still active, so renewing early
 * never loses a day. Spending does not touch the leaderboard or the tier: the
 * board ranks lifetime *earned* points (see earnedPoints), precisely so a
 * paying subscriber is not demoted every month.
 */
export async function redeemGroup(
  address: string,
  periods: number,
): Promise<{ ok: true; status: GroupStatus; spent: number } | { ok: false; error: string; status: GroupStatus }> {
  const store = getStore();
  const me = norm(address);
  const n = Math.floor(periods);

  if (!Number.isFinite(n) || n < 1 || n > GROUP_MAX_MONTHS) {
    return {
      ok: false,
      error: `Choose between 1 and ${GROUP_MAX_MONTHS} periods`,
      status: await getGroupStatus(me),
    };
  }

  // Serialise redemptions per wallet so two clicks can't buy one period twice.
  if (!(await store.lock(`group:${me}`, 20))) {
    return {
      ok: false,
      error: "A redemption is already in progress",
      status: await getGroupStatus(me),
    };
  }

  try {
    const user = await load(me);
    const cost = n * GROUP_MONTH_POINTS;
    const balance = totalPoints(user);
    if (balance < cost) {
      return {
        ok: false,
        error: `Not enough points — ${formatPoints(cost)} needed, you have ${formatPoints(balance)}`,
        status: groupStatusOf(user),
      };
    }

    const from = Math.max(Date.now(), user.groupUntil ?? 0);
    const until = from + n * GROUP_PERIOD_MS;
    // Prepaying further than the cap would lock points up for no good reason.
    if (until - Date.now() > GROUP_MAX_MONTHS * GROUP_PERIOD_MS) {
      return {
        ok: false,
        error: `You can prepay at most ${GROUP_MAX_MONTHS} periods ahead`,
        status: groupStatusOf(user),
      };
    }

    user.spent = (user.spent ?? 0) + cost;
    user.groupUntil = until;
    user.groupPeriods = (user.groupPeriods ?? 0) + n;
    await save(user);
    await store.setGroupExpiry(me, until);
    await store.addToPool({ burned: cost });

    return { ok: true, status: groupStatusOf(user), spent: cost };
  } finally {
    await store.unlock(`group:${me}`);
  }
}

/** Wallets with active access — the list the operator admits to the group. */
export async function listGroupMembers(limit = 500) {
  return getStore().activeGroupMembers(Math.min(Math.max(limit, 1), 1000));
}

/**
 * Bind an inviter to a wallet. First writer wins and the link is permanent —
 * that keeps a later visit with someone else's `?ref=` from stealing the tree.
 * Self-referral and simple A→B→A loops are rejected.
 */
export async function bindReferrer(
  address: string,
  referrer: string,
): Promise<{ bound: boolean; referrer: string | null }> {
  const me = norm(address);
  const inviter = norm(referrer);
  if (me === inviter) return { bound: false, referrer: null };

  const user = await load(me);
  if (user.referrer) return { bound: false, referrer: user.referrer };

  const inviterRec = await load(inviter);
  if (inviterRec.referrer === me) return { bound: false, referrer: null };

  user.referrer = inviter;
  await save(user);

  inviterRec.invitees = await getStore().addInvitee(inviter, me);
  await save(inviterRec);

  return { bound: true, referrer: inviter };
}

export type AwardResult = {
  /** Points credited to the acting wallet (0 when the action was a replay). */
  awarded: number;
  /** Points minted to the referral tree on top. */
  referralAwarded: number;
  /** Actions that were already counted before. */
  duplicates: number;
  volumeUsd: number;
  streak: number;
  multiplier: number;
  total: number;
  details: string[];
};

/**
 * Credit a batch of already-verified actions. Idempotent: every action carries
 * an event id that is reserved exactly once per season.
 */
export async function award(
  address: string,
  actions: VerifiedAction[],
): Promise<AwardResult> {
  const store = getStore();
  const me = norm(address);
  const user = await load(me);

  let earned = 0;
  let volume = 0;
  let duplicates = 0;
  const details: string[] = [];

  // Streak first — the multiplier applies to everything credited in this call.
  const today = dayIndex();
  if (actions.length > 0 && user.lastDay !== today) {
    user.streak = user.lastDay === today - 1 ? user.streak + 1 : 1;
    user.lastDay = today;
  }
  const multiplier = streakMultiplier(user.streak);

  for (const action of actions) {
    if (!(await store.claimEvent(action.eventId))) {
      duplicates++;
      continue;
    }

    const rule = SOURCES[action.source];
    if (!rule) continue;

    const bucket = user.bySource[action.source] ?? {
      points: 0,
      volumeUsd: 0,
      actions: 0,
    };

    let points = pointsForVolume(action.source, action.volumeUsd);
    // First time this wallet ever touches this product — pay the quest bonus.
    if (bucket.actions === 0 && rule.firstBonus > 0) {
      user.bonus += rule.firstBonus;
      details.push(`First ${rule.label.toLowerCase()} +${formatPoints(rule.firstBonus)}`);
    }
    points = Math.round(points * multiplier);

    bucket.points += points;
    bucket.volumeUsd += action.volumeUsd;
    bucket.actions += 1;
    user.bySource[action.source] = bucket;

    user.base += points;
    user.volumeUsd += action.volumeUsd;
    user.actions += 1;
    earned += points;
    volume += action.volumeUsd;
    if (action.detail) {
      details.push(`${action.detail} +${formatPoints(points)}`);
    }
  }

  if (earned === 0 && duplicates === actions.length) {
    return {
      awarded: 0,
      referralAwarded: 0,
      duplicates,
      volumeUsd: 0,
      streak: user.streak,
      multiplier,
      total: totalPoints(user),
      details,
    };
  }

  await save(user);

  const referralAwarded = earned > 0 ? await payReferrers(user, earned) : 0;

  return {
    awarded: earned,
    referralAwarded,
    duplicates,
    volumeUsd: volume,
    streak: user.streak,
    multiplier,
    total: totalPoints(user),
    details,
  };
}

/**
 * Mint referral points up the tree. Nothing is taken from the invitee — the
 * bonus is created on top, which is what makes sharing the link worth it.
 */
async function payReferrers(user: UserRecord, earned: number): Promise<number> {
  if (!user.referrer) return 0;
  let minted = 0;

  const l1 = await load(user.referrer);
  const l1Points = Math.round(earned * REFERRAL_L1);
  l1.referral += l1Points;
  minted += l1Points;

  // The invitee's very first points activate the pair — both sides get a bonus.
  if (!user.activated) {
    user.activated = true;
    user.bonus += REFERRAL_ACTIVATION_BONUS;
    l1.bonus += REFERRAL_ACTIVATION_BONUS;
    minted += REFERRAL_ACTIVATION_BONUS;
    await save(user);
  }
  await save(l1);

  if (l1.referrer && l1.referrer !== user.address) {
    const l2 = await load(l1.referrer);
    const l2Points = Math.round(earned * REFERRAL_L2);
    l2.referral += l2Points;
    minted += l2Points;
    await save(l2);
  }

  return minted;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type SourceBreakdown = {
  source: PointsSource;
  label: string;
  emoji: string;
  href: string;
  points: number;
  volumeUsd: number;
  actions: number;
};

export type Profile = {
  address: string;
  /** Spendable balance. */
  total: number;
  /** Lifetime produced — what the rank and tier are based on. */
  earned: number;
  spent: number;
  group: GroupStatus;
  base: number;
  referral: number;
  bonus: number;
  gamble: number;
  converted: number;
  rocket: { rounds: number; staked: number; won: number; best: number };
  volumeUsd: number;
  actions: number;
  rank: number | null;
  players: number;
  streak: number;
  multiplier: number;
  tier: ReturnType<typeof tierFor>;
  next: ReturnType<typeof nextTier>;
  /** 0–1 progress from the current tier's floor to the next one. */
  progress: number;
  referrer: string | null;
  invitees: number;
  breakdown: SourceBreakdown[];
  hlCursor?: number;
  isNew: boolean;
};

export async function getProfile(address: string): Promise<Profile> {
  const store = getStore();
  const me = norm(address);
  const existing = await store.getUser(me);
  const user = existing ?? emptyUser(me);
  const total = totalPoints(user);
  // Tier and progress track lifetime earned, matching the leaderboard.
  const earned = earnedPoints(user);
  const tier = tierFor(earned);
  const next = nextTier(earned);

  const [rank, players] = await Promise.all([
    existing ? store.rank(me) : Promise.resolve(null),
    store.countUsers(),
  ]);

  const breakdown: SourceBreakdown[] = (
    Object.keys(SOURCES) as PointsSource[]
  ).map((source) => {
    const b = user.bySource[source];
    return {
      source,
      label: SOURCES[source].label,
      emoji: SOURCES[source].emoji,
      href: SOURCES[source].href,
      points: b?.points ?? 0,
      volumeUsd: b?.volumeUsd ?? 0,
      actions: b?.actions ?? 0,
    };
  });

  return {
    address: me,
    total,
    earned,
    spent: Math.round(user.spent ?? 0),
    group: groupStatusOf(user),
    base: Math.round(user.base),
    referral: Math.round(user.referral),
    bonus: Math.round(user.bonus),
    gamble: Math.round(user.gamble ?? 0),
    converted: Math.round(user.converted ?? 0),
    rocket: user.rocket ?? { rounds: 0, staked: 0, won: 0, best: 0 },
    volumeUsd: user.volumeUsd,
    actions: user.actions,
    rank,
    players,
    streak: user.streak,
    multiplier: streakMultiplier(user.streak),
    tier,
    next,
    progress: next
      ? Math.min(1, Math.max(0, (earned - tier.min) / (next.min - tier.min)))
      : 1,
    referrer: user.referrer,
    invitees: user.invitees,
    breakdown,
    hlCursor: user.hlCursor,
    isNew: !existing,
  };
}

export async function getLeaderboard(limit = 100): Promise<LeaderRow[]> {
  return getStore().top(Math.min(Math.max(limit, 1), 500));
}

/** Persist the Hyperliquid sync cursor without touching any point totals. */
export async function setHlCursor(address: string, cursor: number) {
  const user = await load(address);
  if ((user.hlCursor ?? 0) >= cursor) return;
  user.hlCursor = cursor;
  await save(user);
}
