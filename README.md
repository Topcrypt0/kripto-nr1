# 🚀 KRIPTO NR.1 — DEX platform

**Swap · Bridge · Perps · Predictions · Rocket Lottery — one branded terminal.**

| Tab | Route | Powered by | Your revenue |
| --- | --- | --- | --- |
| Swap & Bridge | `/swap` | [LI.FI](https://li.fi) aggregation (30+ chains, all major DEXes & bridges) | Integrator fee on **every** swap/bridge (`NEXT_PUBLIC_LIFI_FEE`, default 0.30%) |
| Perps | `/perps` | [Hyperliquid](https://hyperliquid.xyz) L1 | Builder-code fee on every order (`NEXT_PUBLIC_HL_BUILDER_FEE`, default 0.025% of notional) |
| Predictions | `/predict` | [Polymarket](https://polymarket.com) Gamma API | Referral / builder-program code on trade links (`NEXT_PUBLIC_POLYMARKET_REF`) |
| Rocket Lottery | `/lottery` | Own Solidity contract on Base | House edge ≈ 2% |
| Points & Rewards | `/points` | Own verified points engine | Retention loop — points are earned on the volume that pays every fee above |

The lottery keeps its own dedicated URL (`/lottery`) — the **Base App Mini App
manifest and embed point straight to it**, so the game keeps working inside
Base App / Farcaster exactly as before, while the web root (`/`) is the new
platform landing page.

Built with **Next.js (App Router)**, **wagmi/viem**, `@lifi/widget`,
`@nktkas/hyperliquid`, and a small **Solidity** contract for the lottery.

---

## 💰 Turning the fees on (step by step)

All revenue knobs live in `.env` (see `.env.example`) and are **public** values.

1. **Swap/Bridge (LI.FI)** — works out of the box: every quote carries
   `integrator=NEXT_PUBLIC_LIFI_INTEGRATOR` + `fee=NEXT_PUBLIC_LIFI_FEE`, and
   the fee accrues in LI.FI's FeeCollector contract on each chain. To *claim*
   the money, register the same integrator string at
   [portal.li.fi](https://portal.li.fi) (free) and withdraw from the dashboard.
2. **Perps (Hyperliquid builder codes)** — set `NEXT_PUBLIC_HL_BUILDER` to your
   own wallet address. On a user's first trade the UI asks for a one-time
   `approveBuilderFee` signature, after which every order routed through the
   Perps tab pays the builder fee straight to your address. Note: the builder
   wallet must hold ≥ 100 USDC in perps equity on Hyperliquid for fees to
   apply (their rule).
3. **Predictions (Polymarket)** — the tab shows live markets via the public
   Gamma API; "Trade" deep-links to Polymarket with `?via=` your code. Apply to
   Polymarket's builder/partner program and set `NEXT_PUBLIC_POLYMARKET_REF`
   for revenue share.
4. **Lottery** — unchanged; see [`contracts/README.md`](./contracts/README.md).

---

## ⚠️ Important — real money

This is a hobby/educational project:

- The Perps tab places **real leveraged orders** on Hyperliquid mainnet
  (funds must already be deposited on Hyperliquid; the terminal is
  non-custodial and trades the connected wallet's own account).
- The swap widget moves real funds cross-chain; routing and execution are
  LI.FI's contracts, the platform never holds user funds.
- The lottery contract is **unaudited** and its randomness is commit-reveal
  over a future `blockhash`, not VRF — see the notes below.
- You, as the operator, are responsible for the **legal** side (exchange fees,
  gambling, prediction markets) in your jurisdiction.
- **Test on Base Sepolia first** (`NEXT_PUBLIC_CHAIN=baseSepolia`) for the
  lottery, and with small sizes for the trading tabs.

---

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable                       | Example                | Meaning                                        |
| ------------------------------ | ---------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_CHAIN`            | `base` / `baseSepolia` | Which Base network the lottery uses            |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xabc…`               | Deployed `KriptoNr1` lottery address           |
| `NEXT_PUBLIC_BUILDER_CODE`     | `bc_xxxx`              | Base Builder Code for dashboard metrics        |
| `NEXT_PUBLIC_LIFI_INTEGRATOR`  | `kripto-nr1`           | LI.FI integrator id (register at portal.li.fi) |
| `NEXT_PUBLIC_LIFI_FEE`         | `0.003`                | Swap/bridge fee (0.003 = 0.30%)                |
| `NEXT_PUBLIC_HL_BUILDER`       | `0xYourWallet`         | Hyperliquid builder fee recipient              |
| `NEXT_PUBLIC_HL_BUILDER_FEE`   | `25`                   | Builder fee in tenths of bps (25 = 0.025%)     |
| `NEXT_PUBLIC_POLYMARKET_REF`   | `kriptonr1`            | Polymarket referral/partner code               |
| `BASE_API_KEY` (secret)        | `bdev_…`               | base.dev API key — optional, secret            |
| `KV_REST_API_URL` (secret)     | `https://…upstash.io`  | Points storage (Vercel KV / Upstash REST)      |
| `KV_REST_API_TOKEN` (secret)   | `AX…`                  | Points storage token                           |
| `NEXT_PUBLIC_POINTS_SEASON`    | `s1`                   | Points season key — bump to reset the board    |
| `POINTS_RPC_URL` (secret)      | `https://…`            | Base RPC used to verify launches/deposits      |

## Base Mini App / builder dashboard

- The Mini App manifest (`/.well-known/farcaster.json`) and the `fc:miniapp`
  embed launch **`/lottery`** — the rocket game stays a first-class Base App
  experience at its own URL.
- Lottery transactions are tagged with your
  [ERC-8021](https://docs.base.org/base-chain/builder-codes/app-developers)
  Builder Code (`lib/wagmi.ts`) so they count in the Base builder dashboard.

## Deploy

1. Push to GitHub, import at <https://vercel.com/new> (Next.js auto-detected).
2. Add the env vars above in **Project Settings → Environment Variables**.
3. Deploy. Verify the domain in the Base Developers Portal (the `base:app_id`
   meta tag is already in `app/layout.tsx`).

## ✨ Points & rewards

A retention loop on top of every tab: **swap, bridge, perps, Earn and the
rocket all pay points by USD volume**, points rank you on a public leaderboard,
points can be **gambled in the rocket** for up to X10, and points convert into
private-group access, weekly token reward pools, free launches and fee rebates.

> **Setting it up:** step-by-step operator instructions are in
> [`docs/POINTS_SETUP.md`](./docs/POINTS_SETUP.md).

### Nothing is self-reported

The browser only says *"this wallet did something, here is the tx hash"*. The
server re-derives the truth before minting a point:

| Action | Verified against | Volume used |
| --- | --- | --- |
| Swap / Bridge | LI.FI status API (`status=DONE`, `fromAddress` must match) | Larger of the sending / receiving leg in USD |
| Rocket launch | Base receipt → the contract's own `Played` / `FreePlayed` event | Stake in ETH → USD |
| Earn deposit | Base receipt → USDC `Transfer` out of the user's wallet | Deposit size (withdrawals score nothing) |
| Perps | Hyperliquid `userFillsByTime` for that wallet | Filled notional, per fill |

Every action carries a stable event id (tx hash, or Hyperliquid's `tid`) that is
reserved exactly once per season, so replaying a request awards nothing.

### The rules (all in `lib/points/config.ts`)

- **Rates** — swap 10 pts/$1, bridge 15, perps 5, Earn 8, rocket 200. Volume
  above a per-action soft cap still counts, at 25% of the rate, so one whale
  transaction can't own the board. Each product pays a one-time first-use bonus.
- **Referrals** — you earn **10%** of every point your invitees make and **3%**
  from the people *they* invite. Minted on top: an invitee never loses points.
  Both sides get +500 when an invitee first earns. The inviter is captured from
  the existing `?ref=<address>` link, bound once, and never re-parented.
- **Streaks** — trading on consecutive days adds +5%/day up to ×1.5.
- **Tiers** — Cadet → Pilot → Captain → Commander → Astronaut → Legend, each
  unlocking a perk set rendered straight from the same config the engine scores
  with, so the dashboard can never drift from the rules.

### Spending points: the points rocket

Points are not just a scoreboard — they are playable. `/lottery` has an
**ETH / points** switch. In points mode the same rocket runs with the same
odds table, settled against a **points pool** instead of the ETH bankroll.

**The lottery contract is not modified and not called.** What is reused is its
design:

1. **Commit** — a round is written down with a target Base block that does not
   exist yet, and the stake leaves the player's balance immediately. Neither
   the player nor the operator can know the outcome at this moment.
2. **Reveal** — once the chain produces that block,
   `roll = keccak256(blockHash, player, bet) % 10000` and the multiplier comes
   from the contract's own table (65% X0 · 22% X2 · 8% X3 · 4% X5 · 1% X10,
   house edge ≈ 2%). Every settled round shows its block number, block hash and
   roll, so anyone can recompute it by hand.

One difference in the player's favour: the EVM's `blockhash` opcode only reaches
back 256 blocks, so on-chain wins can expire. An RPC can read any past block, so
a points round **never expires** — a reload finishes it automatically.

Spins earn **no** points (otherwise the loop would mint points from nothing).
The pool is the only source, which is exactly what bounds the liability: seed it
with `POINTS_POOL`, top it up at runtime through the admin route, and the most
the game can ever pay out is what you funded plus what players lost into it. A
bet is refused unless the pool can still cover a worst-case X10 win, mirroring
the contract's `reserved` check.

### Claiming an ETH win as points

When a real ETH launch wins, the player picks: **claim the ETH** (the normal
on-chain `claim()`), or **take points instead** at +25% of the payout's dollar
value. Again, no contract change:

- The contract pays only if `claim()` arrives within 256 blocks. A player taking
  points simply never sends it, so the ETH returns to the bankroll — the house
  pays nothing in ETH, which is what funds the bonus.
- The obvious attack is to ask for points *and* claim the ETH. So points are not
  credited on request: the intent is recorded, and once the window closes the
  server proves on-chain that **no `Settled` event with a payout exists** for
  that player in the window. That one check covers `claim()`, a keeper's
  `settle()`, and the auto-settle inside the player's next `launch()`.
- After the window `_settle` can only take the expired branch, which emits
  `Expired`, never `Settled` — so once the check passes it can never be
  invalidated later. The wait is the contract's own ~8 minutes; the player can
  close the page.

### The private group is a subscription, priced off real fees

Access is sold in **30-day periods** at **100,000 points**. The number is round
on purpose, but the *floor* under it is derived rather than invented: the group
costs the operator ~$20/month to run, so a period may never be worth less than
$20 of fees actually paid to the platform.

```
floor:  $20 / 0.30% (NEXT_PUBLIC_LIFI_FEE) = $6,667 volume × 10 pts/$1 ≈ 66,700
price:  rounded UP to the next 100k        = 100,000 points per 30 days
        ( = $10,000 of swap volume = $30 of platform fees )
```

Rounding **up** rather than to-nearest is the point: raise the fee or
`GROUP_MONTH_USD` later and the price steps to the next 100k instead of quietly
falling below what the group costs to run. Every figure shown to the user is
computed from the rounded price, not the floor, so the dashboard never overstates
the deal. Renewing early extends from the current
expiry rather than from today, so no day is ever lost, and access can be prepaid
up to 12 periods ahead. Redeemed points are **burned** — they do not flow into
the rocket pool (`burned` in `GET /api/points/pool` tracks the total).

This is why the leaderboard ranks **lifetime earned** points while the spendable
balance is earned ± rocket P&L − redemptions: a monthly subscriber would
otherwise be demoted out of their tier every time they paid. Spending now never
moves your rank.

The operator gets the admit list from one authenticated call:

```bash
curl "https://<your-app>/api/points/group?members=1" \
  -H "authorization: Bearer $POINTS_ADMIN_TOKEN"
```

### Storage

Points live in any Upstash-compatible REST KV (`KV_REST_API_URL` +
`KV_REST_API_TOKEN` — Vercel KV sets both for you), talked to over plain
`fetch`, so the project keeps its zero-extra-dependency footprint. **Without
those vars the engine falls back to an in-memory store** — fine for `npm run
dev`, but totals reset on redeploy and the dashboard shows a warning saying so.
Bump `NEXT_PUBLIC_POINTS_SEASON` to archive a season and start everyone at zero.

### Where it lives

| File | Role |
| --- | --- |
| `lib/points/config.ts` | Rates, caps, tiers, rewards — shared by server and UI |
| `lib/points/verify.ts` | Per-source verification (the trust boundary) |
| `lib/points/engine.ts` | Awarding, idempotency, streaks, referral tree, balances |
| `lib/points/rocket.ts` | Points rocket: commit/reveal + pool accounting |
| `lib/points/convert.ts` | Taking an ETH win as points instead |
| `lib/points/store.ts` | KV abstraction (Upstash REST / in-memory) |
| `lib/points/rpc.ts` | Shared server-side Base client |
| `lib/points/client.ts` | `trackAction` with retry+replay queue, react-query hooks |
| `app/api/points/*` | `track`, `me`, `leaderboard`, `referral`, `rocket`, `convert`, `pool` |
| `app/points/page.tsx` | Dashboard, referral card, rewards, tiers, leaderboard |
| `components/PointsRocket.tsx` | The points-mode rocket UI, with per-round proof |

Redemptions of the catalogue items (group invites, pool payouts) are
operator-run — the program tracks, ranks and settles the rocket; you decide when
a season pays out.

## How the lottery works

- `contracts/KriptoNr1.sol` — **commit-reveal, claim-on-win**. `launch()` takes
  the bet in block N and reserves the worst-case payout; from block N+2 the
  frontend reads `preview(you)` to learn the outcome from `blockhash(N+1)`: on
  a **win** it shows a Claim button that calls `claim()`; on a loss there is
  nothing to sign. Bets must be revealed within 256 blocks (~8 min) or they are
  forfeited to the bankroll (frontend auto-reveals within seconds).
- Multipliers **X0 · X2 · X3 · X5 · X10**, min bet 0.0001 ETH, max 0.001 ETH,
  house edge ≈ 2%. Referral free launches are funded by an owner-capped promo
  pool (see [`contracts/README.md`](./contracts/README.md)).
- `app/lottery/page.tsx` — wallet connect, bet UI, `launch()` / `preview()` /
  `claim()` flow; `components/Rocket.tsx` — the rocket reacts to the result.

## License

MIT
