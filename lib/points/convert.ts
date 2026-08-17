// "Take the win in points instead of ETH" — without touching the contract.
// Server-only.
//
// How it works, and why it is safe:
//
//   The contract pays a win only when the player sends claim() within 256
//   blocks. A player who prefers points simply never sends it: the ETH stays
//   put and returns to the bankroll when the window closes. So the house pays
//   nothing in ETH, and can afford to hand out points worth MORE than the
//   payout (CONVERT_BONUS).
//
//   The catch is obvious — a player could ask for points AND still claim the
//   ETH. So points are not credited on request. We record the intent, wait for
//   the window to close, and then prove on-chain that no `Settled` event with
//   a payout exists for that player in the window. That single check covers
//   every way the ETH could have been taken: claim(), a keeper's settle(), or
//   the auto-settle inside the player's next launch().
//
//   After the window, `_settle` can only hit the expired branch (blockhash
//   returns 0), which emits `Expired`, never `Settled`. So the check is final:
//   once it passes, it can never be invalidated later.

import { formatEther } from "viem";
import { CONTRACT_ADDRESS, kriptoNr1Abi } from "@/lib/contract";
import { CONVERT_BONUS, CONVERT_RATE, convertPoints } from "./config";
import { creditConversion, norm } from "./engine";
import { getStore, type UserRecord } from "./store";
import { rpc } from "./rpc";
import { getEthUsd } from "./verify";

/** The contract's own reveal window, in blocks. */
const CLAIM_WINDOW = 256;

export class ConvertError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export type ConvertStatus = {
  state: "none" | "pending" | "credited" | "voided";
  points?: number;
  payoutEth?: string;
  multiplier?: number;
  /** Block after which the points can be released. */
  settleAfter?: number;
  currentBlock?: number;
  /** Rough seconds left until that block (Base produces one every ~2s). */
  secondsLeft?: number;
  balance?: number;
  message?: string;
};

async function loadUser(address: string): Promise<UserRecord | null> {
  return getStore().getUser(norm(address));
}

/**
 * Register the intent to take a pending win as points. Verifies against the
 * contract that the win is real, unclaimed, and belongs to this wallet.
 */
export async function requestConversion(
  address: string,
): Promise<ConvertStatus> {
  const store = getStore();
  const me = norm(address);
  const player = me as `0x${string}`;

  const existing = (await loadUser(me))?.pendingConvert;
  if (existing) {
    // Already asked — just report where it stands.
    return settleConversion(me);
  }

  let preview: readonly [boolean, bigint, bigint];
  let game: readonly [bigint, bigint, boolean, boolean];
  let head: bigint;
  try {
    [preview, game, head] = await Promise.all([
      rpc.readContract({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "preview",
        args: [player],
      }) as Promise<readonly [boolean, bigint, bigint]>,
      rpc.readContract({
        address: CONTRACT_ADDRESS,
        abi: kriptoNr1Abi,
        functionName: "games",
        args: [player],
      }) as Promise<readonly [bigint, bigint, boolean, boolean]>,
      rpc.getBlockNumber(),
    ]);
  } catch {
    throw new ConvertError("Base RPC unreachable — try again", true);
  }

  const [ready, multiplier, payout] = preview;
  const [, targetBlock, active] = game;

  if (!active) throw new ConvertError("No pending launch to convert");
  if (!ready) throw new ConvertError("The reveal block isn't here yet", true);
  if (multiplier === 0n || payout === 0n) {
    throw new ConvertError("That launch wasn't a win");
  }
  // Past the window the ETH is already forfeited and preview() would read 0 —
  // guard anyway so a stale UI can't register a worthless conversion.
  if (head > targetBlock + BigInt(CLAIM_WINDOW)) {
    throw new ConvertError("The claim window has already closed");
  }

  const payoutUsd = Number(formatEther(payout)) * (await getEthUsd());
  const points = convertPoints(payoutUsd);
  if (points <= 0) throw new ConvertError("Could not price this payout", true);

  const pool = await store.getPool();
  if (pool.balance - pool.reserved < points) {
    throw new ConvertError(
      "The points pool can't cover that conversion right now — claim the ETH instead",
    );
  }

  const user = await loadUser(me);
  if (!user) throw new ConvertError("Wallet has no points profile yet");

  user.pendingConvert = {
    targetBlock: Number(targetBlock),
    settleAfter: Number(targetBlock) + CLAIM_WINDOW,
    points,
    payoutWei: payout.toString(),
    multiplier: Number(multiplier),
    createdAt: Date.now(),
  };
  await store.putUser(user);

  return {
    state: "pending",
    points,
    payoutEth: formatEther(payout),
    multiplier: Number(multiplier),
    settleAfter: user.pendingConvert.settleAfter,
    currentBlock: Number(head),
    secondsLeft: Math.max(
      0,
      (user.pendingConvert.settleAfter - Number(head)) * 2,
    ),
  };
}

/**
 * Release (or void) a pending conversion. Safe to call as often as the UI
 * likes — it only credits once, guarded by a season-unique event id.
 */
export async function settleConversion(
  address: string,
): Promise<ConvertStatus> {
  const store = getStore();
  const me = norm(address);
  const user = await loadUser(me);
  const pending = user?.pendingConvert;
  if (!user || !pending) return { state: "none" };

  let head: bigint;
  try {
    head = await rpc.getBlockNumber();
  } catch {
    throw new ConvertError("Base RPC unreachable — try again", true);
  }

  if (Number(head) <= pending.settleAfter) {
    return {
      state: "pending",
      points: pending.points,
      payoutEth: formatEther(BigInt(pending.payoutWei)),
      multiplier: pending.multiplier,
      settleAfter: pending.settleAfter,
      currentBlock: Number(head),
      secondsLeft: Math.max(0, (pending.settleAfter - Number(head)) * 2),
    };
  }

  // The window is closed. Did the ETH move? One log query settles it.
  let claimed: boolean;
  try {
    const logs = await rpc.getLogs({
      address: CONTRACT_ADDRESS,
      event: kriptoNr1Abi.find(
        (i) => i.type === "event" && i.name === "Settled",
      ) as never,
      args: { player: me as `0x${string}` } as never,
      fromBlock: BigInt(pending.targetBlock),
      toBlock: BigInt(pending.settleAfter + 1),
    });
    claimed = logs.some(
      (l) => ((l as { args?: { payout?: bigint } }).args?.payout ?? 0n) > 0n,
    );
  } catch {
    throw new ConvertError("Could not read the claim window — try again", true);
  }

  user.pendingConvert = null;
  await store.putUser(user);

  if (claimed) {
    return {
      state: "voided",
      message:
        "That win was claimed in ETH on-chain, so no points were credited.",
    };
  }

  // Credit exactly once, even if two settle calls race.
  const eventId = `convert:${me}:${pending.targetBlock}`;
  if (!(await store.claimEvent(eventId))) {
    return { state: "credited", points: pending.points };
  }

  await store.addToPool({ balance: -pending.points, paidOut: pending.points });
  const balance = await creditConversion(me, pending.points);

  return {
    state: "credited",
    points: pending.points,
    payoutEth: formatEther(BigInt(pending.payoutWei)),
    multiplier: pending.multiplier,
    balance,
  };
}

/** Quote shown on the win screen, before the player decides. */
export function quoteConversion(payoutWei: bigint, ethUsd: number) {
  const payoutUsd = Number(formatEther(payoutWei)) * ethUsd;
  return {
    points: convertPoints(payoutUsd),
    payoutUsd,
    rate: CONVERT_RATE,
    bonus: CONVERT_BONUS,
  };
}
