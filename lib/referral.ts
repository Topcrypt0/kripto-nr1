// Promotional free-launch credits + referral capture. Device-local (localStorage),
// no backend, no real ETH — free launches are no-stakes bonus spins, so there's
// nothing of value to farm. A precise cross-device inviter payout would need a
// shared backend; this is the honest no-infra version.

const REF_KEY = "kr1_ref"; // who invited this device
const SPINS_KEY = "kr1_free_spins"; // current free-launch balance
const STARTED_KEY = "kr1_started"; // starter grant given
const INVITED_KEY = "kr1_invited"; // invite bonus given
const EARNED_KEY = "kr1_share_earned"; // spins earned by sharing (capped)

const STARTER = 1; // brand-new device
const INVITE_BONUS = 1; // arriving via a ref link
const SHARE_BONUS = 1; // per share
const SHARE_CAP = 5; // max spins earnable via sharing

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

export function getFreeSpins(): number {
  try {
    return Math.max(0, Number(localStorage.getItem(SPINS_KEY) ?? "0") || 0);
  } catch {
    return 0;
  }
}

function setFreeSpins(n: number) {
  try {
    localStorage.setItem(SPINS_KEY, String(Math.max(0, n)));
  } catch {
    /* ignore */
  }
}

export function addFreeSpins(n: number): number {
  const v = getFreeSpins() + n;
  setFreeSpins(v);
  return v;
}

export function useFreeSpin(): number {
  const v = Math.max(0, getFreeSpins() - 1);
  setFreeSpins(v);
  return v;
}

export function getReferrer(): string | null {
  try {
    return localStorage.getItem(REF_KEY);
  } catch {
    return null;
  }
}

/**
 * Run once per load (and again once we know the wallet). Grants the starter
 * bonus on a fresh device and captures `?ref=<addr>` + the invite bonus.
 * Returns the resulting free-spin balance.
 */
export function initFreeSpins(self?: string): number {
  if (typeof window === "undefined") return 0;
  try {
    if (localStorage.getItem(STARTED_KEY) !== "1") {
      localStorage.setItem(STARTED_KEY, "1");
      addFreeSpins(STARTER);
    }

    const ref = new URLSearchParams(window.location.search).get("ref");
    if (
      ref &&
      isAddr(ref) &&
      ref.toLowerCase() !== (self ?? "").toLowerCase()
    ) {
      if (getReferrer() == null) localStorage.setItem(REF_KEY, ref);
      if (localStorage.getItem(INVITED_KEY) !== "1") {
        localStorage.setItem(INVITED_KEY, "1");
        addFreeSpins(INVITE_BONUS);
      }
    }
  } catch {
    /* ignore */
  }
  return getFreeSpins();
}

/** Reward the inviter for sharing (capped). Returns the new balance + whether granted. */
export function grantShareReward(): { spins: number; granted: boolean } {
  try {
    const earned = Number(localStorage.getItem(EARNED_KEY) ?? "0") || 0;
    if (earned >= SHARE_CAP) return { spins: getFreeSpins(), granted: false };
    localStorage.setItem(EARNED_KEY, String(earned + 1));
    return { spins: addFreeSpins(SHARE_BONUS), granted: true };
  } catch {
    return { spins: getFreeSpins(), granted: false };
  }
}

/** Weighted outcome, identical odds to the on-chain contract. */
export function rollMultiplier(): number {
  const r = Math.random() * 10000;
  if (r < 6500) return 0;
  if (r < 8700) return 2;
  if (r < 9500) return 3;
  if (r < 9900) return 5;
  return 10;
}
