"use client";

import { useState } from "react";
import { useFiatOnramp, usePrivy } from "@privy-io/react-auth";
import { useAccount, useConnect } from "wagmi";
import {
  BASE_CAIP2,
  ONRAMP_ASSETS,
  PRIVY_APP_ID,
  PRIVY_ONRAMP_ENV,
} from "@/lib/privy";

/**
 * "Buy Crypto" — a fiat card on-ramp (Privy → MoonPay/Coinbase) that delivers
 * USDC or ETH straight to the user's connected wallet on Base, so someone with
 * no crypto can fund the platform without leaving the site.
 */
export function BuyCrypto({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { ready, authenticated, login } = usePrivy();
  const { fund } = useFiatOnramp();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (!PRIVY_APP_ID) return null;

  const ensureConnected = (): string | null => {
    if (address) return address;
    const injected = connectors.find((c) => c.id === "injected");
    const baseAccount = connectors.find((c) => c.id === "baseAccount");
    const hasInjected =
      typeof window !== "undefined" &&
      Boolean((window as { ethereum?: unknown }).ethereum);
    const connector =
      (hasInjected ? injected : undefined) ?? baseAccount ?? connectors[0];
    if (connector) connect({ connector });
    return null;
  };

  const buy = async (asset: "usdc" | "eth") => {
    const to = ensureConnected();
    if (!to) {
      setNote("Connect a wallet first, then choose an amount.");
      return;
    }
    setBusy(asset);
    setNote(null);
    try {
      if (ready && !authenticated) await login();
      await fund({
        source: { assets: ["usd", "eur", "gbp"], defaultAsset: "usd" },
        destination: {
          asset: ONRAMP_ASSETS[asset],
          chain: BASE_CAIP2,
          address: to,
        },
        // Only pin the environment when explicitly overridden; otherwise let
        // Privy match the app's own mode.
        ...(PRIVY_ONRAMP_ENV ? { environment: PRIVY_ONRAMP_ENV } : {}),
        defaultAmount: "50",
      });
      setNote("Payment started — funds arrive in your wallet in a few minutes.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/quote/i.test(msg)) {
        setNote(
          "No card quotes available yet — the onramp provider must be enabled for this app's mode in the Privy dashboard (upgrade the app to Production for real purchases).",
        );
      } else if (!/exit|cancel|close/i.test(msg)) {
        setNote(msg);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <button
        className={className ?? "pBtnBuy"}
        onClick={() => setOpen(true)}
      >
        💳 Buy Crypto
      </button>

      {open && (
        <div className="buyBack" onClick={() => setOpen(false)}>
          <div className="buyModal" onClick={(e) => e.stopPropagation()}>
            <div className="buyHead">
              <span className="buyTitle">💳 Buy Crypto with a card</span>
              <button className="buyClose" onClick={() => setOpen(false)}>
                ✕
              </button>
            </div>
            <p className="buyDesc">
              Pay with a bank card and receive crypto straight to your wallet on
              Base — no exchange needed. {!isConnected && "Connect a wallet first."}
            </p>
            <div className="buyOpts">
              <button
                className="buyOpt"
                disabled={busy !== null}
                onClick={() => buy("usdc")}
              >
                <span className="buyOptCoin">USDC</span>
                <span className="buyOptSub">
                  {busy === "usdc" ? "Opening…" : "For trading & earning"}
                </span>
              </button>
              <button
                className="buyOpt"
                disabled={busy !== null}
                onClick={() => buy("eth")}
              >
                <span className="buyOptCoin">ETH</span>
                <span className="buyOptSub">
                  {busy === "eth" ? "Opening…" : "For gas & the lottery"}
                </span>
              </button>
            </div>
            {note && <div className="buyNote">{note}</div>}
            <div className="buyFine">
              Powered by Privy · card processing by MoonPay/Coinbase. KRIPTO
              NR.1 never holds your funds.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
