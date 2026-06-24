import type { Address } from "viem";

// Defaults to the live mainnet contract so the app works even if the Vercel env
// var is missing. The address is public; override with NEXT_PUBLIC_CONTRACT_ADDRESS.
export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "0xd51600bDF8cA07b9015c954B96456ac035689082") as Address;

// Bet bounds — must match the Solidity contract constants.
export const MIN_BET = "0.0001"; // ETH
export const MAX_BET = "0.001"; // ETH

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
    name: "resolve",
    stateMutability: "nonpayable",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
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
    name: "Committed",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "targetBlock", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Resolved",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "multiplier", type: "uint256", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "roll", type: "uint256", indexed: false },
      { name: "refunded", type: "bool", indexed: false },
    ],
  },
] as const;
