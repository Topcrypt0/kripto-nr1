// Server-side verification of every points-earning action. Server-only.
//
// The client never tells us how many points it deserves — it only says "this
// address did something, here is the tx hash". Each verifier independently
// re-reads the truth from a source the user cannot forge (LI.FI's status API,
// a Base receipt, Hyperliquid's fill history) and returns the USD volume that
// actually settled, together with a stable event id used for idempotency.

import { createPublicClient, fallback, formatEther, http, parseEventLogs } from "viem";
import { base, baseSepolia } from "viem/chains";
import { erc20Abi } from "viem";
import { CONTRACT_ADDRESS, kriptoNr1Abi } from "@/lib/contract";
import { AAVE_POOL, MORPHO_VAULT, USDC_BASE, USDC_DECIMALS } from "@/lib/defi";
import { LIFI_INTEGRATOR } from "@/lib/monetize";
import type { PointsSource } from "./config";

export type VerifiedAction = {
  source: PointsSource;
  /** Unique per real-world action — replays of the same id award nothing. */
  eventId: string;
  volumeUsd: number;
  /** Optional human note surfaced in the API response. */
  detail?: string;
};

export class VerifyError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
  }
}

const eq = (a?: string | null, b?: string | null) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

// ---------------------------------------------------------------------------
// ETH price (server side) — 60s memo so a burst of launches costs one fetch.
// ---------------------------------------------------------------------------

let ethUsd = { value: 0, at: 0 };

async function getEthUsd(): Promise<number> {
  if (ethUsd.value > 0 && Date.now() - ethUsd.at < 60_000) return ethUsd.value;
  try {
    const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      cache: "no-store",
    });
    const json = (await res.json()) as { data?: { amount?: string } };
    const n = Number(json.data?.amount);
    if (Number.isFinite(n) && n > 0) ethUsd = { value: n, at: Date.now() };
  } catch {
    /* keep the last known price */
  }
  if (ethUsd.value <= 0) throw new VerifyError("ETH price unavailable", true);
  return ethUsd.value;
}

// ---------------------------------------------------------------------------
// Base RPC (server side)
// ---------------------------------------------------------------------------

const useTestnet = process.env.NEXT_PUBLIC_CHAIN === "baseSepolia";
const chain = useTestnet ? baseSepolia : base;

const rpc = createPublicClient({
  chain,
  transport: fallback(
    [
      ...(process.env.POINTS_RPC_URL ? [http(process.env.POINTS_RPC_URL)] : []),
      ...(process.env.NEXT_PUBLIC_RPC_URL
        ? [http(process.env.NEXT_PUBLIC_RPC_URL)]
        : []),
      http("https://base-rpc.publicnode.com"),
      http("https://base.llamarpc.com"),
      http(),
    ],
    { rank: false },
  ),
});

async function receiptFor(txHash: `0x${string}`) {
  let receipt;
  try {
    receipt = await rpc.getTransactionReceipt({ hash: txHash });
  } catch {
    // Not mined yet (or the RPC is behind) — the client may retry.
    throw new VerifyError("Transaction not found yet", true);
  }
  if (receipt.status !== "success") {
    throw new VerifyError("Transaction reverted on-chain");
  }
  return receipt;
}

// ---------------------------------------------------------------------------
// Swap & bridge — LI.FI status API
// ---------------------------------------------------------------------------

type LifiToken = { decimals?: number; priceUSD?: string; symbol?: string };
type LifiSide = {
  txHash?: string;
  chainId?: number;
  amount?: string;
  amountUSD?: string;
  token?: LifiToken;
};
type LifiStatus = {
  status?: string;
  substatus?: string;
  fromAddress?: string;
  toAddress?: string;
  sending?: LifiSide;
  receiving?: LifiSide;
};

function sideUsd(side?: LifiSide): number {
  if (!side) return 0;
  const direct = Number(side.amountUSD);
  if (Number.isFinite(direct) && direct > 0) return direct;
  // Older/edge responses omit amountUSD — derive it from amount × price.
  const amount = Number(side.amount);
  const decimals = side.token?.decimals;
  const price = Number(side.token?.priceUSD);
  if (
    Number.isFinite(amount) &&
    Number.isFinite(price) &&
    typeof decimals === "number"
  ) {
    return (amount / 10 ** decimals) * price;
  }
  return 0;
}

/**
 * Verifies a swap/bridge executed through the LI.FI widget. Cross-chain routes
 * only count once both legs are DONE, so a stuck bridge cannot be farmed.
 */
export async function verifyLifi(
  address: string,
  txHash: string,
  fromChain?: number,
  toChain?: number,
): Promise<VerifiedAction> {
  const params = new URLSearchParams({ txHash });
  if (fromChain) params.set("fromChain", String(fromChain));
  if (toChain) params.set("toChain", String(toChain));

  const res = await fetch(`https://li.quest/v1/status?${params}`, {
    headers: { "x-lifi-integrator": LIFI_INTEGRATOR },
    cache: "no-store",
  });
  if (res.status === 404) {
    throw new VerifyError("Route not indexed yet", true);
  }
  if (!res.ok) {
    throw new VerifyError(`LI.FI status ${res.status}`, res.status >= 500);
  }

  const data = (await res.json()) as LifiStatus;
  if (data.status === "FAILED") throw new VerifyError("Route failed");
  if (data.status !== "DONE") {
    throw new VerifyError("Route still executing", true);
  }
  // The address that signed the source transaction is the only one credited.
  if (data.fromAddress && !eq(data.fromAddress, address)) {
    throw new VerifyError("Route belongs to another wallet");
  }

  const from = data.sending?.chainId;
  const to = data.receiving?.chainId ?? from;
  const source: PointsSource = from && to && from !== to ? "bridge" : "swap";

  // Score on the larger leg: bridges shave fees off the receiving side, and we
  // do not want a user penalised for the bridge's own cut.
  const volumeUsd = Math.max(sideUsd(data.sending), sideUsd(data.receiving));
  if (volumeUsd <= 0) throw new VerifyError("Could not price this route", true);

  return {
    source,
    eventId: `lifi:${(data.sending?.txHash ?? txHash).toLowerCase()}`,
    volumeUsd,
    detail:
      source === "bridge"
        ? `Bridged ${data.sending?.token?.symbol ?? ""} ${from} → ${to}`.trim()
        : `Swapped ${data.sending?.token?.symbol ?? ""} → ${
            data.receiving?.token?.symbol ?? ""
          }`.trim(),
  };
}

// ---------------------------------------------------------------------------
// Rocket lottery — Base receipt
// ---------------------------------------------------------------------------

/**
 * Verifies a launch by re-reading the receipt and pulling the stake out of the
 * contract's own `Played` / `FreePlayed` event. Free launches carry the promo
 * stake, so they earn points too — that is the whole point of the funnel.
 */
export async function verifyLottery(
  address: string,
  txHash: string,
): Promise<VerifiedAction> {
  const receipt = await receiptFor(txHash as `0x${string}`);
  if (!eq(receipt.to, CONTRACT_ADDRESS)) {
    throw new VerifyError("Not a rocket launch transaction");
  }
  if (!eq(receipt.from, address)) {
    throw new VerifyError("Transaction belongs to another wallet");
  }

  const played = parseEventLogs({
    abi: kriptoNr1Abi,
    eventName: ["Played", "FreePlayed"],
    logs: receipt.logs,
  }).find((l) => eq((l.args as { player?: string }).player, address));

  if (!played) throw new VerifyError("No launch event in this transaction");

  const bet = (played.args as { bet?: bigint }).bet ?? 0n;
  const volumeUsd = Number(formatEther(bet)) * (await getEthUsd());

  return {
    source: "lottery",
    eventId: `rocket:${txHash.toLowerCase()}`,
    volumeUsd,
    detail:
      played.eventName === "FreePlayed"
        ? "Free rocket launch 🚀"
        : `Rocket launch · ${formatEther(bet)} ETH`,
  };
}

// ---------------------------------------------------------------------------
// Earn — Morpho / Aave deposits on Base
// ---------------------------------------------------------------------------

const EARN_TARGETS = [MORPHO_VAULT, AAVE_POOL] as const;

/**
 * Verifies a stablecoin deposit by summing the USDC the user actually moved in
 * this transaction. Withdrawals score nothing: only transfers *out of* the
 * user's wallet count.
 */
export async function verifyEarn(
  address: string,
  txHash: string,
): Promise<VerifiedAction> {
  const receipt = await receiptFor(txHash as `0x${string}`);
  if (!EARN_TARGETS.some((t) => eq(receipt.to, t))) {
    throw new VerifyError("Not an Earn deposit transaction");
  }
  if (!eq(receipt.from, address)) {
    throw new VerifyError("Transaction belongs to another wallet");
  }

  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
  }).filter(
    (l) => eq(l.address, USDC_BASE) && eq((l.args as { from?: string }).from, address),
  );

  const total = transfers.reduce(
    (sum, l) => sum + ((l.args as { value?: bigint }).value ?? 0n),
    0n,
  );
  if (total === 0n) throw new VerifyError("No deposit found in this transaction");

  return {
    source: "earn",
    eventId: `earn:${txHash.toLowerCase()}`,
    volumeUsd: Number(total) / 10 ** USDC_DECIMALS,
    detail: "Stablecoin deposit",
  };
}

// ---------------------------------------------------------------------------
// Perps — Hyperliquid fill history
// ---------------------------------------------------------------------------

type HlFill = {
  coin?: string;
  px?: string;
  sz?: string;
  time?: number;
  tid?: number;
  hash?: string;
};

/** How far back a first-time sync will look — keeps the first call bounded. */
const HL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const HL_MAX_FILLS = 400;

/**
 * Pulls the wallet's fills straight from Hyperliquid and turns each one into
 * its own verified action. `since` is the user's stored cursor, so repeated
 * syncs are cheap and never double-count (each fill also carries its own
 * event id as a second line of defence).
 */
export async function verifyPerps(
  address: string,
  since: number | undefined,
): Promise<{ actions: VerifiedAction[]; cursor: number }> {
  const startTime = Math.max(since ?? 0, Date.now() - HL_LOOKBACK_MS);

  const res = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "userFillsByTime", user: address, startTime }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new VerifyError(`Hyperliquid ${res.status}`, res.status >= 500);
  }

  const fills = (await res.json()) as HlFill[];
  if (!Array.isArray(fills)) throw new VerifyError("Unexpected fill response", true);

  let cursor = startTime;
  const actions: VerifiedAction[] = [];

  for (const f of fills.slice(0, HL_MAX_FILLS)) {
    const px = Number(f.px);
    const sz = Number(f.sz);
    const time = Number(f.time);
    if (!Number.isFinite(px) || !Number.isFinite(sz) || !Number.isFinite(time)) {
      continue;
    }
    if (time > cursor) cursor = time;
    const notional = Math.abs(px * sz);
    if (notional <= 0) continue;
    actions.push({
      source: "perps",
      // tid is unique per fill; hash+time is the fallback for older responses.
      eventId: `hl:${f.tid ?? `${f.hash}-${time}`}`,
      volumeUsd: notional,
      detail: `${f.coin ?? "Perp"} fill`,
    });
  }

  // Advance past the newest fill so the next sync starts strictly after it.
  return { actions, cursor: cursor + 1 };
}
