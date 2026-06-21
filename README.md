# 🚀 KRIPTO NR.1

Open-source rocket **crash-style game** on the **Base** blockchain. Launch the
rocket "KRIPTO NR.1", bet ETH, and win a multiplier of your stake:

- **X0** (rocket failed) · **X2** · **X3** · **X5** · **X10**
- Min bet **0.0001 ETH** · Max bet **0.001 ETH**
- House edge ≈ 2% (EV ≈ 0.98)

Built with **Next.js (App Router)**, **wagmi/viem**, and a small **Solidity**
contract.

---

## ⚠️ Important — gambling with real money

This is a hobby/educational project. If you deploy on **Base mainnet** you are
running a real-money gambling app:

- The contract is **unaudited**. Bugs holding ETH = lost funds.
- Randomness is **on-chain (not Chainlink VRF)**. The `tx.origin == msg.sender`
  check blocks the "wrapper contract reverts on a loss" attack, and ordinary
  players cannot predict outcomes — but this is **not** VRF-grade. For serious
  volume, switch `_random()` to Chainlink VRF and get an audit.
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

| Variable                       | Example                  | Meaning                          |
| ------------------------------ | ------------------------ | -------------------------------- |
| `NEXT_PUBLIC_CHAIN`            | `base` / `baseSepolia`   | Which Base network to use        |
| `NEXT_PUBLIC_CONTRACT_ADDRESS` | `0xabc…`                 | Deployed `KriptoNr1` address     |

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

- `contracts/KriptoNr1.sol` — holds the bankroll, validates bets
  (min/max + solvency), rolls an outcome, and instantly pays winners.
- `app/page.tsx` — wallet connect, bet UI, sends `launch()` and reads the
  `Launch` event from the receipt to show the result.
- `components/Rocket.tsx` — the rocket animation reacts to the result.

## License

MIT
