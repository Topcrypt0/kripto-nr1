import type { Address } from "viem";

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as Address;

// Bet bounds — must match the Solidity contract constants.
export const MIN_BET = "0.0001"; // ETH
export const MAX_BET = "0.1"; // ETH

export const kriptoNr1Abi = [
  {
    type: "function",
    name: "launch",
    stateMutability: "payable",
    inputs: [],
    outputs: [
      { name: "multiplier", type: "uint256" },
      { name: "payout", type: "uint256" },
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
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "Launch",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "bet", type: "uint256", indexed: false },
      { name: "multiplier", type: "uint256", indexed: false },
      { name: "payout", type: "uint256", indexed: false },
      { name: "roll", type: "uint256", indexed: false },
    ],
  },
] as const;
