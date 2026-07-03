// Referral capture. Free launches are ON-CHAIN now (contract v3): every new
// address gets one real free launch (win up to 0.01 ETH, zero stake), and the
// inviter earns +1 free launch per unique invitee (capped in the contract).
// This module only remembers who invited this device so the frontend can pass
// the inviter to freeLaunch(inviter).

const REF_KEY = "kr1_ref"; // who invited this device

const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s);

export function getReferrer(): string | null {
  try {
    const v = localStorage.getItem(REF_KEY);
    return v && isAddr(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * Run once per load (and again once the wallet is known). Captures
 * `?ref=<addr>` into localStorage — first inviter wins, self-invites ignored.
 */
export function captureReferrer(self?: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (
      ref &&
      isAddr(ref) &&
      ref.toLowerCase() !== (self ?? "").toLowerCase() &&
      getReferrer() == null
    ) {
      localStorage.setItem(REF_KEY, ref);
    }
  } catch {
    /* ignore */
  }
  return getReferrer();
}
