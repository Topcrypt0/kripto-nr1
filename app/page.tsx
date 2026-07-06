import Link from "next/link";

const PRODUCTS = [
  {
    href: "/swap",
    emoji: "🔁",
    title: "Swap & Bridge",
    desc: "Best-route aggregator across 30+ chains and every major DEX & bridge. One click, best price.",
    cta: "Trade now",
  },
  {
    href: "/perps",
    emoji: "📈",
    title: "Perps",
    desc: "Perpetual futures on Hyperliquid — up to 50× leverage, CEX-grade speed, fully on-chain.",
    cta: "Long / Short",
  },
  {
    href: "/predict",
    emoji: "🔮",
    title: "Predictions",
    desc: "Live prediction markets powered by Polymarket. Politics, crypto, sports — trade the outcome.",
    cta: "Browse markets",
  },
  {
    href: "/lottery",
    emoji: "🚀",
    title: "Rocket Lottery",
    desc: "The original KRIPTO NR.1 rocket. Provably-fair on-chain crash game on Base — win up to X10.",
    cta: "Launch rocket",
  },
];

export default function Home() {
  return (
    <main className="pHome">
      <section className="pHero">
        <img src="/hero.png" alt="KRIPTO NR.1 rocket" className="pHeroImg" />
        <div className="pHeroText">
          <h1 className="pHeroTitle">
            KRIPTO <span className="accent">NR.1</span>
          </h1>
          <p className="pHeroTag">
            The №1 crypto terminal — swap, bridge, perps, prediction markets
            and the legendary rocket. Ready? 🚀
          </p>
          <div className="pHeroBtns">
            <Link href="/swap" className="pBtnPrimary">
              Start trading
            </Link>
            <Link href="/lottery" className="pBtnGhost">
              🚀 Play lottery
            </Link>
          </div>
        </div>
      </section>

      <section className="pGrid">
        {PRODUCTS.map((p) => (
          <Link key={p.href} href={p.href} className="pCard">
            <div className="pCardEmoji">{p.emoji}</div>
            <div className="pCardTitle">{p.title}</div>
            <div className="pCardDesc">{p.desc}</div>
            <div className="pCardCta">{p.cta} →</div>
          </Link>
        ))}
      </section>

      <footer className="pFoot">
        <span>KRIPTO NR.1 · open source · non-custodial</span>
        <span className="pFootMuted">
          Routing by LI.FI · Perps by Hyperliquid · Markets by Polymarket
        </span>
      </footer>
    </main>
  );
}
