// Hyperliquid "agent" (API wallet) support — the same mechanism the official
// app.hyperliquid.xyz UI uses. The user's wallet signs ONE approveAgent
// action; afterwards every order is signed locally by a throwaway key with
// zero wallet popups. This also sidesteps wallets (Rabby and others) that
// refuse EIP-712 signatures whose domain chainId (1337 for HL L1 actions)
// differs from the wallet's active network.
//
// The agent key can ONLY sign Hyperliquid trading actions for the account
// that approved it — it cannot move funds to other addresses (withdrawals
// require the master wallet), which is why keeping it in localStorage is the
// accepted industry practice.

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const KEY_PREFIX = "kr1_hl_agent_";

export const AGENT_NAME = "kripto-nr1";

function storageKey(user: string): string {
  return `${KEY_PREFIX}${user.toLowerCase()}`;
}

export function getOrCreateAgentKey(user: string): `0x${string}` {
  let pk = localStorage.getItem(storageKey(user)) as `0x${string}` | null;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    pk = generatePrivateKey();
    localStorage.setItem(storageKey(user), pk);
  }
  return pk;
}

export function agentAccount(user: string) {
  return privateKeyToAccount(getOrCreateAgentKey(user));
}

/** Drop the stored key (e.g. when HL reports the agent as unknown). */
export function resetAgentKey(user: string) {
  localStorage.removeItem(storageKey(user));
}
