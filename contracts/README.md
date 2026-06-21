# Deploying the KriptoNr1 contract

The frontend needs a deployed `KriptoNr1` contract address in
`NEXT_PUBLIC_CONTRACT_ADDRESS`. You deploy it yourself — **never share your
private key with anyone (including AI tools).**

> ⚠️ **Mainnet = real money.** This contract is **unaudited** and uses on-chain
> (non-VRF) randomness. Start with a small bankroll. For serious volume, replace
> `_random()` with Chainlink VRF and get an audit.

## Easiest: deploy with Remix (no local tooling)

1. Open <https://remix.ethereum.org>.
2. Create a file `KriptoNr1.sol`, paste the contents of
   [`KriptoNr1.sol`](./KriptoNr1.sol).
3. **Solidity Compiler** tab → compiler `0.8.24` (or newer 0.8.x) → **Compile**.
4. **Deploy & Run** tab:
   - Environment: **Injected Provider** (MetaMask / Coinbase Wallet).
   - In your wallet, select the **Base** network (mainnet) — chain id `8453`.
     (For safe testing first, use **Base Sepolia**, chain id `84532`.)
   - Optional: type an ETH amount in the **VALUE** field to seed the bankroll on
     deploy (e.g. `1` ETH so 0.1 ETH bets at X10 are payable).
   - Click **Deploy** and confirm in your wallet.
5. Copy the deployed contract address.

## Fund the bankroll

The contract must hold enough ETH to cover the biggest possible payout for a
single bet:

```
required bankroll >= MAX_BET * MAX_MULTIPLIER = 0.1 * 10 = 1 ETH
```

If the balance is lower, large bets are rejected by the on-chain solvency check.
To add funds later: send ETH directly to the contract address, or call `fund()`.
Lower `MAX_BET` in the contract before deploying if you don't want to lock up 1 ETH.

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
