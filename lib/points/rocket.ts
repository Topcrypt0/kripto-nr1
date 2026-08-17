// The points rocket: the same crash game as KriptoNr1.sol, played with points
// against a points pool instead of ETH against the bankroll. Server-only.
//
// The contract is NOT involved and NOT modified. What is reused is its design:
//
//   commit  — a round is written down with a target block that does not exist
//             yet, so neither the player nor the operator can know the outcome;
//   reveal  — once the chain has produced that block, the roll is
//             keccak256(blockHash, player, bet) % 10000 and the multiplier
//             comes from the contract's own table. Anyone can recompute it
//             from public data: the round shows its block, hash and roll.
//
// One difference in the player's favour: the EVM's `blockhash` opcode only
// reaches back 256 blocks, so on-chain wins expire. An RPC can read any past
// block, so a points round can always be revealed — it never expires.
//
// Spinning points awards no volume points; the pool is the only place new
// points come from, which is what bounds the operator's liability.

import { encodePacked, keccak256 } from "viem";
import {
  ROCKET_BPS,
  ROCKET_MAX_BET,
  ROCKET_MAX_MULTIPLIER,
  ROCKET_MIN_BET,
  multiplierForRoll,
} from "./config";
import {
  balanceOf,
  norm,
  payRocketWin,
  refundStake,
  stakePoints,
} from "./engine";
import { getStore, type Pool, type RocketRound } from "./store";
import { rpc } from "./rpc";

export class RocketError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

/** One pending round per player at a time, exactly like the contract. */
const lockName = (address: string) => `rocket:${address}`;
/** Long enough that a crashed reveal cannot strand a player forever. */
const LOCK_TTL = 900;

/**
 * Seed the pool from POINTS_POOL on first use, so a fresh deploy has a working
 * game without an extra admin call. Later top-ups go through fundPool().
 */
async function ensurePool(): Promise<Pool> {
  const store = getStore();
  const pool = await store.getPool();
  const seed = Number(process.env.POINTS_POOL ?? 0);
  if (pool.funded === 0 && Number.isFinite(seed) && seed > 0) {
    // The lock keeps two cold requests from seeding the pool twice.
    if (await store.lock("pool:seed", 60)) {
      return store.addToPool({ funded: seed, balance: seed });
    }
  }
  return pool;
}

/** Top up the house pool (admin route). Returns the new pool state. */
export async function fundPool(amount: number): Promise<Pool> {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new RocketError("Amount must be a non-zero number");
  }
  await ensurePool();
  return getStore().addToPool({ funded: amount, balance: amount });
}

export type RocketState = {
  pending: RocketRound | null;
  history: RocketRound[];
  balance: number;
  pool: { balance: number; reserved: number; available: number; open: boolean };
  limits: { min: number; max: number; maxAffordable: number };
};

/** Everything the points-rocket UI needs in one read. */
export async function getRocketState(address: string): Promise<RocketState> {
  const store = getStore();
  const me = norm(address);
  const [pool, balance, history] = await Promise.all([
    ensurePool(),
    balanceOf(me),
    store.listRounds(me, 12),
  ]);

  const available = pool.balance - pool.reserved;
  // The pool must be able to cover a worst-case X10 win on top of the stake.
  const maxAffordable = Math.max(
    0,
    Math.min(
      ROCKET_MAX_BET,
      Math.floor(available / (ROCKET_MAX_MULTIPLIER - 1)),
      Math.floor(balance),
    ),
  );

  return {
    pending: history.find((r) => r.status === "pending") ?? null,
    history,
    balance,
    pool: {
      balance: pool.balance,
      reserved: pool.reserved,
      available,
      open: maxAffordable >= ROCKET_MIN_BET,
    },
    limits: { min: ROCKET_MIN_BET, max: ROCKET_MAX_BET, maxAffordable },
  };
}

/**
 * Commit a round. Points leave the player's balance here — win or lose, the
 * stake is already gone, which is exactly what makes the reveal trustworthy.
 */
export async function launchRound(
  address: string,
  bet: number,
): Promise<RocketRound> {
  const store = getStore();
  const me = norm(address);

  const stake = Math.floor(bet);
  if (!Number.isFinite(stake) || stake < ROCKET_MIN_BET || stake > ROCKET_MAX_BET) {
    throw new RocketError(
      `Bet must be between ${ROCKET_MIN_BET} and ${ROCKET_MAX_BET} points`,
    );
  }

  // The lock doubles as the "one pending game" rule and as protection against
  // two concurrent requests spending the same points twice.
  if (!(await store.lock(lockName(me), LOCK_TTL))) {
    throw new RocketError("You already have a round in flight — reveal it first");
  }

  try {
    const pool = await ensurePool();
    const reserve = stake * ROCKET_MAX_MULTIPLIER;
    // Mirrors the contract: after the stake is in, the pool must still cover
    // every reserved payout including this one.
    if (pool.balance + stake - pool.reserved < reserve) {
      throw new RocketError(
        "The points pool can't cover a X10 win on that bet right now — try a smaller one",
      );
    }

    const staked = await stakePoints(me, stake);
    if (!staked.ok) {
      throw new RocketError(
        `Not enough points — you have ${Math.floor(staked.balance)}`,
      );
    }

    // Only now is the pool moved, so a failed stake never touches it.
    const after = await store.addToPool({
      balance: stake,
      reserved: reserve,
      wagered: stake,
      rounds: 1,
    });
    if (after.balance - after.reserved < 0) {
      // Lost a race against another round — undo everything and ask for less.
      await store.addToPool({
        balance: -stake,
        reserved: -reserve,
        wagered: -stake,
        rounds: -1,
      });
      await refundStake(me, stake);
      throw new RocketError("The pool just filled up — try again in a moment");
    }

    let blockNumber: bigint;
    try {
      blockNumber = await rpc.getBlockNumber();
    } catch {
      await store.addToPool({
        balance: -stake,
        reserved: -reserve,
        wagered: -stake,
        rounds: -1,
      });
      await refundStake(me, stake);
      throw new RocketError("Base RPC unreachable — your points were not spent", true);
    }

    const round: RocketRound = {
      id: crypto.randomUUID(),
      address: me,
      bet: stake,
      // +2 rather than the contract's +1: an RPC's head can lag a block, and a
      // target that is already mined would be knowable at commit time.
      targetBlock: Number(blockNumber) + 2,
      createdAt: Date.now(),
      status: "pending",
    };
    await store.putRound(round);
    await store.pushRound(me, round.id);
    return round;
  } catch (e) {
    await store.unlock(lockName(me));
    throw e;
  }
}

/**
 * Reveal a committed round against the hash of its target block. Idempotent:
 * a round already settled just returns its stored result.
 */
export async function revealRound(
  address: string,
  roundId: string,
): Promise<RocketRound> {
  const store = getStore();
  const me = norm(address);

  const round = await store.getRound(roundId);
  if (!round || round.address !== me) throw new RocketError("Round not found");
  if (round.status === "settled") return round;

  let head: bigint;
  try {
    head = await rpc.getBlockNumber();
  } catch {
    throw new RocketError("Base RPC unreachable — try again", true);
  }
  if (Number(head) < round.targetBlock) {
    throw new RocketError("Waiting for the reveal block", true);
  }

  let blockHash: `0x${string}`;
  try {
    const block = await rpc.getBlock({ blockNumber: BigInt(round.targetBlock) });
    blockHash = block.hash;
  } catch {
    throw new RocketError("Could not read the reveal block — try again", true);
  }
  if (!blockHash) throw new RocketError("Reveal block has no hash yet", true);

  // Identical to the contract's roll, with the points stake in place of the
  // wei bet: keccak256(abi.encodePacked(blockHash, player, bet)) % 10000.
  const digest = keccak256(
    encodePacked(
      ["bytes32", "address", "uint256"],
      [blockHash, me as `0x${string}`, BigInt(round.bet)],
    ),
  );
  const roll = Number(BigInt(digest) % BigInt(ROCKET_BPS));
  const multiplier = multiplierForRoll(roll);
  const payout = round.bet * multiplier;
  const reserve = round.bet * ROCKET_MAX_MULTIPLIER;

  const settled: RocketRound = {
    ...round,
    status: "settled",
    blockHash,
    roll,
    multiplier,
    payout,
    settledAt: Date.now(),
  };
  // Persist the result BEFORE paying, so a crash mid-payout cannot re-roll a
  // round into a different outcome.
  await store.putRound(settled);

  // The unspent part of the reserve stays in the pool — that is the house edge
  // accruing, exactly as the contract's bankroll keeps a losing bet.
  await store.addToPool({
    reserved: -reserve,
    balance: -payout,
    paidOut: payout,
  });
  if (payout > 0) await payRocketWin(me, payout, multiplier);

  await store.unlock(lockName(me));
  return settled;
}

/**
 * Recover a player who somehow holds a lock with no pending round (a crashed
 * commit). Safe: it only clears the lock, never touches points.
 */
export async function clearStuckLock(address: string) {
  await getStore().unlock(lockName(norm(address)));
}
