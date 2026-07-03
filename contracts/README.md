# Deploying the KriptoNr1 contract

The frontend needs a deployed `KriptoNr1` contract address in
`NEXT_PUBLIC_CONTRACT_ADDRESS`. You deploy it yourself — **never share your
private key with anyone (including AI tools).**

> ⚠️ **Mainnet = real money.** This contract is **unaudited** and uses on-chain
> (non-VRF) randomness. Start with a small bankroll. For serious volume, swap
> the blockhash source for Chainlink VRF and get an audit.

## v3 — claim-on-win + on-chain referral free launches (current)

One transaction to play, a second only when you win:

- `launch()` — place the bet (one tx). A matured previous game is auto-settled
  here, so a losing player never has to send a settle tx.
- `preview(player)` — a free `eth_call` the frontend uses to learn the outcome
  after the reveal block: it shows a **Claim** button on a win and nothing on a
  loss.
- `claim()` — pay the winnings (winners only).
- `settle(player)` — permissionless cleanup for abandoned games (keeper/owner).

**Referral free launches** (new in v3):

- `freeLaunch(inviter)` — a real 0.001 ETH game at zero cost to the player;
  a win pays real ETH (up to 0.01 at X10). Every address gets ONE starter free
  launch; the inviter passed with it earns +1 free-launch credit per unique
  invitee (max `INVITE_CAP = 10`).
- `fundPromo()` — owner deposits the marketing budget the free launches draw
  from. `defundPromo(amount)` moves unused budget back to the withdrawable
  bankroll. Free launches auto-stop when the pool can't cover an X10 win.
- `freeLaunches(player)` / `promoPool` — frontend reads.

> ⚠️ **The promo IS farmable.** A free launch costs a player only gas, so bots
> with throwaway wallets can grind the pool (expected value ≈ 0.001 ETH per
> fresh address, ~2× that with self-referral). The promo pool hard-caps the
> total loss — treat `fundPromo()` deposits as ad spend you're willing to
> burn, start small (0.02–0.05 ETH), and refill only if real users show up.

> 🚨 **The pre-v2 contract (`0xd516…9082`) must be replaced before advertising.**
> It used a two-tx `launch()`/`resolve()` flow and **refunded** the bet when
> `resolve()` ran after the 256-block window — a guaranteed-profit exploit: a
> player who sees a loss just skips `resolve()`, waits ~9 min and reclaims the
> stake (win → claim, lose → refund; EV ≈ +63% per game), draining the bankroll.
> v2 forfeits expired bets to the bankroll instead. To migrate:
>
> 1. On the old contract (owner `0x3b3d…F68f`): `setPaused(true)`, then
>    `withdraw(<availableBankroll in wei>)`. Its `reserved` is 0, so the full
>    balance (0.0075 ETH = `7500000000000000` wei) is withdrawable — **enter the
>    amount in wei, not `0.0075`** (the usual Remix error).
> 2. Deploy v2 and fund it (≥ 0.01 ETH).
> 3. Point `NEXT_PUBLIC_CONTRACT_ADDRESS` (and the fallback in
>    `lib/contract.ts`) at the new address.

## Easiest: one-command script (no Remix, no compile)

A prebuilt artifact ships in `contracts/artifacts/KriptoNr1.json`, so deploying
is a single command with your own key. The key stays on your machine — it is
read from the environment and never leaves it.

```bash
# from the repo root
PRIVATE_KEY=0xYOUR_DEPLOYER_KEY FUND_ETH=0.01 node scripts/deploy.mjs
# testnet first:  CHAIN=base-sepolia PRIVATE_KEY=0x... FUND_ETH=0.01 node scripts/deploy.mjs
```

It deploys through the canonical CREATE2 proxy with a fixed salt, so with the
default owner the contract always lands at the address already baked into
`lib/contract.ts` — nothing else to wire. `FUND_ETH` seeds the bankroll in the
same transaction. Pass `OWNER=0x...` to make a different address the house
(withdraw/pause rights); the script then prints the new deterministic address to
put in `NEXT_PUBLIC_CONTRACT_ADDRESS`.

> The deployer key just needs a little Base ETH for gas (deploy costs a fraction
> of a cent). The default owner is the Base Account `0x9d17…f75e`; run
> `transferOwnership(<addr>)` afterwards to hand the house to another wallet.

## Alternative: deploy with Remix

1. Open <https://remix.ethereum.org>.
2. Create a file `KriptoNr1.sol`, paste the contents of
   [`KriptoNr1.sol`](./KriptoNr1.sol).
3. **Solidity Compiler** tab → compiler `0.8.24` (or newer 0.8.x) → **Compile**.
4. **Deploy & Run** tab:
   - Environment: **Injected Provider** (MetaMask / Coinbase Wallet).
   - In your wallet, select the **Base** network (mainnet) — chain id `8453`.
     (For safe testing first, use **Base Sepolia**, chain id `84532`.)
   - **The v2 constructor takes one argument, `_owner`** — the address with
     withdraw/pause rights. Paste your own wallet address into the field next
     to the orange **Deploy** button (or `0x0000…0000` to make the deployer the
     owner).
   - Type an ETH amount in the **VALUE** field to seed the bankroll on deploy
     (e.g. `0.01` ETH so 0.001 ETH bets at X10 are payable). Make sure the unit
     dropdown next to VALUE says **Ether**, not Wei.
   - Click **Deploy** and confirm in your wallet.
5. Copy the deployed contract address and put it in
   `NEXT_PUBLIC_CONTRACT_ADDRESS` (and the fallback in `lib/contract.ts`).

> Reminder for `withdraw(amount)` in Remix: the amount is in **wei**
> (`7500000000000000` = 0.0075 ETH), not in ETH.

## Fund the bankroll

The contract must hold enough ETH to cover the biggest possible payout for a
single bet:

```
required bankroll >= MAX_BET * MAX_MULTIPLIER = 0.001 * 10 = 0.01 ETH
```

If the balance is lower, large bets are rejected by the on-chain solvency check.
To add funds later: send ETH directly to the contract address, or call `fund()`.
Adjust `MAX_BET` in the contract before deploying to change how much you lock up.

## Owner controls

- `withdraw(amount)` — take ETH out of the bankroll (owner only).
- `setPaused(true/false)` — stop / resume the game.
- `transferOwnership(addr)` — hand over ownership.

## Networks

| Network      | Chain ID | `NEXT_PUBLIC_CHAIN` |
| ------------ | -------- | ------------------- |
| Base mainnet | 8453     | `base`              |
| Base Sepolia | 84532    | `baseSepolia`       |

Get Base Sepolia test ETH: <https://www.alchemy.com/faucets/base-sepolia> or the
Coinbase faucet.
