// DeFi / Earn config — stablecoin yield on Base.
// Everything is non-custodial and on-chain: deposits go straight into the
// protocol contracts, funds are always redeemable by the user.

import { erc20Abi } from "viem";

export { erc20Abi };

export const USDC_BASE =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

// --- Morpho: Gauntlet USDC Prime (ERC-4626 vault, curated by Gauntlet) ---
export const MORPHO_VAULT =
  "0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61" as const;

// --- Aave v3 on Base ---
export const AAVE_POOL =
  "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as const;
export const AAVE_AUSDC =
  "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB" as const;

export const RAY = 1e27;
export const SECONDS_PER_YEAR = 31_536_000;

/** Aave stores the annualized rate in ray; convert to a compounded APY. */
export function aaveRateToApy(liquidityRateRay: bigint): number {
  const apr = Number(liquidityRateRay) / RAY;
  return (1 + apr / SECONDS_PER_YEAR) ** SECONDS_PER_YEAR - 1;
}

// ERC-4626 subset used by the Morpho vault.
export const erc4626Abi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxWithdraw",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// Aave v3 Pool subset. getReserveData returns the full ReserveData struct;
// we only read currentLiquidityRate (field 3) for the APY.
export const aavePoolAbi = [
  {
    type: "function",
    name: "supply",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "onBehalfOf", type: "address" },
      { name: "referralCode", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getReserveData",
    stateMutability: "view",
    inputs: [{ name: "asset", type: "address" }],
    outputs: [
      {
        type: "tuple",
        name: "",
        components: [
          {
            type: "tuple",
            name: "configuration",
            components: [{ name: "data", type: "uint256" }],
          },
          { name: "liquidityIndex", type: "uint128" },
          { name: "currentLiquidityRate", type: "uint128" },
          { name: "variableBorrowIndex", type: "uint128" },
          { name: "currentVariableBorrowRate", type: "uint128" },
          { name: "currentStableBorrowRate", type: "uint128" },
          { name: "lastUpdateTimestamp", type: "uint40" },
          { name: "id", type: "uint16" },
          { name: "aTokenAddress", type: "address" },
          { name: "stableDebtTokenAddress", type: "address" },
          { name: "variableDebtTokenAddress", type: "address" },
          { name: "interestRateStrategyAddress", type: "address" },
          { name: "accruedToTreasury", type: "uint128" },
          { name: "unbacked", type: "uint128" },
          { name: "isolationModeTotalDebt", type: "uint128" },
        ],
      },
    ],
  },
] as const;

// Aave supply carries a referral code slot (currently unused by Aave, kept 0).
export const AAVE_REFERRAL = 0;
