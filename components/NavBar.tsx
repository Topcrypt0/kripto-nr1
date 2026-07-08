"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { captureReferrer } from "@/lib/referral";
import { BuyCrypto } from "@/components/BuyCrypto";

const TABS = [
  { href: "/swap", label: "Swap", emoji: "🔁" },
  { href: "/perps", label: "Perps", emoji: "📈" },
  { href: "/earn", label: "Earn", emoji: "🏦" },
  { href: "/predict", label: "Predict", emoji: "🔮" },
  { href: "/lottery", label: "Lottery", emoji: "🚀" },
  { href: "/docs", label: "Docs", emoji: "📄" },
];

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export function NavBar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  // Avoid SSR/client hydration mismatch on wallet state.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Platform-wide referral capture: any page visited with ?ref=<addr>
  // remembers the inviter (used by the lottery's free launches and the
  // share-card links from every tab).
  useEffect(() => {
    captureReferrer(address);
  }, [address]);

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === "injected");
    const baseAccount = connectors.find((c) => c.id === "baseAccount");
    const hasInjected =
      typeof window !== "undefined" &&
      Boolean((window as { ethereum?: unknown }).ethereum);
    const connector =
      (hasInjected ? injected : undefined) ?? baseAccount ?? connectors[0];
    if (connector) connect({ connector });
  };

  return (
    <nav className="pNav">
      <Link href="/" className="pBrand">
        <img src="/logo.svg" alt="" className="pLogo" />
        <span className="pBrandText">
          <span className="pBrandTitle">
            KRIPTO <span className="accent">NR.1</span>
          </span>
          <span className="pBrandSub">DEX · PERPS · PREDICT</span>
        </span>
      </Link>

      <div className="pTabs">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`pTab${pathname?.startsWith(t.href) ? " pTabActive" : ""}`}
          >
            <span className="pTabEmoji">{t.emoji}</span>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="pNavRight">
        <BuyCrypto className="pNavBuy" />
        {mounted && isConnected ? (
          <button
            className="pWallet"
            onClick={() => disconnect()}
            title="Disconnect"
          >
            <span className="pDot" />
            {short(address)}
          </button>
        ) : (
          <button
            className="pWallet"
            onClick={handleConnect}
            disabled={isPending}
          >
            {isPending ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>
    </nav>
  );
}
