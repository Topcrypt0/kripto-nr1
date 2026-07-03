# 🚀 KRIPTO NR.1

Open-source rocket **crash-style game** on the **Base** blockchain. Launch the
rocket "KRIPTO NR.1", bet ETH, and win a multiplier of your stake:

- **X0** (rocket failed) · **X2** · **X3** · **X5** · **X10**
- Min bet **0.0001 ETH** · Max bet **0.001 ETH**
- House edge ≈ 2% (EV ≈ 0.98)
- **Referral free launches**: every new player gets one FREE on-chain launch
  (real win up to 0.01 ETH at X10, zero risk); inviters earn +1 free launch per
  invitee. Funded by an owner-capped promo pool (see
  [`contracts/README.md`](./contracts/README.md)).
- ETH amounts are shown with live **USD** equivalents throughout the UI.

Built with **Next.js (App Router)**, **wagmi/viem**, and a small **Solidity**
contract.

---

## ⚠️ Important — gambling with real money

This is a hobby/educational project. If you deploy on **Base mainnet** you are
running a real-money gambling app:

- The contract is **unaudited**. Bugs holding ETH = lost funds.
- Randomness is **on-chain (not Chainlink VRF)**: commit-reveal over a future
  `blockhash`. The bet is irreversible before the result is known, so neither a
  wrapper contract nor a smart wallet can "revert on a loss", and ordinary
  players cannot predict outcomes — but this is **not** VRF-grade (the Base
  sequencer is trusted). For serious volume, switch to Chainlink VRF and get an
  audit.
- Bets must be revealed within **256 blocks (~8 min)** or they are forfeited to
  the bankroll — an expiry refund would be a guaranteed-profit exploit (skip the
  reveal on a loss, reclaim the stake). The frontend auto-reveals within seconds.
  **Contracts deployed before 2026-07-02 refunded expired bets — replace them**
  (see [`contracts/README.md`](./contracts/README.md)).
- The owner can withdraw the non-reserved bankroll at any time — players are
  trusting the operator not to pull funds mid-flight (reserved payouts for
  pending games are protected on-chain).
- You, as the operator, are responsible for the **legal** side of running
  gambling in your jurisdiction.
- **Test on Base Sepolia first** (`NEXT_PUBLIC_CHAIN=baseSepolia`).

---

## Quick start

```bash
npm install
cp .env.example .env.local      # then fill in the values
npm run dev                     # http://localhost:3000
```

### Environment variables

| Variable                       | Example                  | Meaning                            |
| ------------------------------ | ------------------------ | ---------------------------------- |
| `NEXT_PUBLIC_CHAIN`            | `base` / `baseSepolia`   | Which Base network to use          |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xabc…`                 | Deployed `KriptoNr1` address       |
| `NEXT_PUBLIC_BUILDER_CODE`     | `bc_xxxx`                | Builder Code for dashboard metrics |
| `BASE_API_KEY` (secret)        | `bdev_…`                 | base.dev API key — optional, secret |

## Showing up in the Base builder dashboard

The Base dashboard only counts transactions that are **tagged with your Builder
Code**. This app tags every `launch()` transaction using an
[ERC-8021](https://docs.base.org/base-chain/builder-codes/app-developers)
`dataSuffix` (see `lib/wagmi.ts`). Metrics count **real mainnet transactions**, so
the numbers stay at 0 until someone actually plays on Base mainnet with this build
deployed. `BASE_API_KEY` is a secret base.dev key for data APIs — not required for
the game; keep it out of git and rotate it if it leaks.

## Deploy the contract

See [`contracts/README.md`](./contracts/README.md). Easiest path is Remix — no
local toolchain needed. Remember to **fund the bankroll** (≥ 0.01 ETH for 0.001
ETH bets at X10).

## Deploy the frontend (Vercel)

1. Push this repo to GitHub (already done if you used the setup script).
2. Go to <https://vercel.com/new>, import the repo.
3. Add the two env vars above in **Project Settings → Environment Variables**.
4. Deploy. Vercel auto-detects Next.js.
5. Put your Vercel domain into the **Base Developers Portal** to verify ownership
   — the required `base:app_id` meta tag is already in `app/layout.tsx`.

## How it works

- `contracts/KriptoNr1.sol` — **commit-reveal, claim-on-win**. `launch()` takes
  the bet in block N and reserves the worst-case payout; no result is computed
  yet, so wallets (including Base Account smart wallets) show a plain transfer
  with no outcome preview. From block N+2 the frontend reads `preview(you)` (a
  free `eth_call`) to learn the outcome from `blockhash(N+1)`: on a **win** it
  shows a Claim button that calls `claim()` to pay you; on a **loss** there is
  nothing to sign. The bet is irreversible before the result is known, so
  there's no "inspect then revert on loss" exploit and no `tx.origin`
  restriction.
- `app/page.tsx` — wallet connect, bet UI, sends `launch()`, polls
  `preview()`, and on a win shows the Claim button (`claim()`), reading the
  `Settled` event for the payout.
- `components/Rocket.tsx` — the rocket animation reacts to the result.

## License

MIT
