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
and points convert into private-group access, weekly token reward pools, free
launches and fee rebates.

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
| `lib/points/engine.ts` | Awarding, idempotency, streaks, referral tree |
| `lib/points/store.ts` | KV abstraction (Upstash REST / in-memory) |
| `lib/points/client.ts` | `trackAction` with retry+replay queue, react-query hooks |
| `app/api/points/*` | `track`, `me`, `leaderboard`, `referral` |
| `app/points/page.tsx` | Dashboard, referral card, rewards, tiers, leaderboard |

Redemptions themselves are operator-run (invite links, pool payouts) — the
program tracks and ranks; you decide when a season pays out.

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
