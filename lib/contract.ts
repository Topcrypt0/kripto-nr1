import type { Address } from "viem";

// Defaults to the live mainnet contract so the app works even if the Vercel env
// var is missing. The address is public; override with NEXT_PUBLIC_CONTRACT_ADDRESS.
// v3 (claim-on-win + referral free launches), deployed 2026-07-02.
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0x8b35250aB830Bf5190dc4220fD9Aa7a6D30A0E31") as Address;

// Bet bounds — must match the Solidity contract constants.
export const MIN_BET = "0.0001"; // ETH
export const MAX_BET = "0.001"; // ETH
export const FREE_BET = "0.001"; // ETH — stake of a promo free launch
export const MAX_WIN = "0.01"; // ETH — FREE_BET/MAX_BET × X10

export const kriptoNr1Abi = [
  {
    type: "function",
    name: "launch",
    stateMutability: "payable",
    inputs: [],
    outputs: [{ name: "targetBlock", type: "uint256" }],
  },
  {
    type: "function",
    name: "freeLaunch",
    stateMutability: "nonpayable",
    inputs: [{ name: "inviter", type: "address" }],
    outputs: [{ name: "targetBlock", type: "uint256" }],
  },
  {
    type: "function",
    name: "freeLaunches",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "promoPool",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "fundPromo",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [
      { name: "multiplier", type: "uint256" },
      { name: "payout", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "multiplier", type: "uint256" },
      { name: "payout", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "preview",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "ready", type: "bool" },
      { name: "multiplier", type: "uint256" },
      { name: "payout", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "games",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "bet", type: "uint128" },
      { name: "targetBlock", type: "uint64" },
      { name: "active", type: "bool" },
      { name: "free", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "bankroll",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "availableBankroll",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "Played",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "targetBlock", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FreePlayed",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "inviter", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "targetBlock", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "InviteReward",
    inputs: [
      { name: "inviter", type: "address", indexed: true },
      { name: "invitee", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "Settled",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "multiplier", type: "uint256", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "roll", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Expired",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
    ],
  },
] as const;
