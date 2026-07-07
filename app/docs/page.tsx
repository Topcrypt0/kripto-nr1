import type { Metadata } from "next";
import {
  HL_BUILDER_FEE_PCT,
  LIFI_FEE,
  LIFI_INTEGRATOR,
} from "@/lib/monetize";

export const metadata: Metadata = {
  title: "Docs — KRIPTO NR.1 🚀",
  description:
    "How the KRIPTO NR.1 platform works: products, fees, security model, self-hosting and links.",
};

const GITHUB = "https://github.com/Topcrypt0/kripto-nr1";

export default function DocsPage() {
  return (
    <main className="pPage docsPage">
      <div className="pPageHead">
        <h1 className="pPageTitle">Documentation</h1>
        <span className="pFeeBadge">OPEN SOURCE · MIT</span>
      </div>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🚀 What is KRIPTO NR.1?</h2>
        <p className="docsP">
          KRIPTO NR.1 is an open-source, <b>non-custodial</b> crypto terminal.
          The platform never holds your funds and has no accounts, deposits or
          withdrawals of its own — every action is a transaction signed by{" "}
          <b>your</b> wallet and executed by the underlying protocol. The full
          source code is public on{" "}
          <a href={GITHUB} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🔁 Swap &amp; Bridge</h2>
        <p className="docsP">
          The <a href="/swap">Swap</a> tab is powered by the{" "}
          <a href="https://li.fi" target="_blank" rel="noreferrer">
            LI.FI
          </a>{" "}
          aggregation protocol. It compares routes across every major DEX and
          bridge on 30+ chains and executes the best one. Token approvals and
          swaps run through LI.FI&apos;s audited contracts — the same
          infrastructure used by jumper.exchange.
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">📈 Perps</h2>
        <p className="docsP">
          The <a href="/perps">Perps</a> tab is a trading terminal for{" "}
          <a href="https://hyperliquid.xyz" target="_blank" rel="noreferrer">
            Hyperliquid
          </a>
          , a fully on-chain perpetuals exchange. The terminal trades your own
          Hyperliquid account: deposit USDC at{" "}
          <a
            href="https://app.hyperliquid.xyz"
            target="_blank"
            rel="noreferrer"
          >
            app.hyperliquid.xyz
          </a>{" "}
          (Arbitrum), connect the same wallet here, and every order is signed
          locally by your wallet. On your first trade Hyperliquid asks for a
          one-time approval signature that routes orders through this
          interface.
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🏦 Earn (DeFi)</h2>
        <p className="docsP">
          The <a href="/earn">Earn</a> tab lets you deposit USDC into
          blue-chip yield sources on Base for passive APY:{" "}
          <a href="https://morpho.org" target="_blank" rel="noreferrer">
            Morpho
          </a>{" "}
          (Gauntlet USDC Prime vault) and{" "}
          <a href="https://aave.com" target="_blank" rel="noreferrer">
            Aave v3
          </a>{" "}
          lending. Deposits go directly into each protocol&apos;s audited
          contracts — non-custodial, withdraw anytime. Rates are live and
          variable; there is no KRIPTO NR.1 fee on Earn (the platform earns
          when you fund via swap or buy crypto).
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">💳 Buy Crypto</h2>
        <p className="docsP">
          The <b>Buy Crypto</b> button on the home page opens a fiat card
          on-ramp (via{" "}
          <a href="https://privy.io" target="_blank" rel="noreferrer">
            Privy
          </a>{" "}
          + MoonPay/Coinbase) that delivers USDC or ETH straight to your
          connected wallet on Base — so you can fund the platform with a bank
          card without an exchange. KRIPTO NR.1 never holds your funds.
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🔮 Predictions</h2>
        <p className="docsP">
          The <a href="/predict">Predict</a> tab shows live odds and volumes
          from{" "}
          <a href="https://polymarket.com" target="_blank" rel="noreferrer">
            Polymarket
          </a>{" "}
          prediction markets. The &quot;Trade&quot; button opens the KRIPTO
          Predict terminal (
          <a
            href="https://github.com/Topcrypt0/kripto-polymarket-app"
            target="_blank"
            rel="noreferrer"
          >
            open source
          </a>
          ) where you can trade with just an email login — a gasless smart
          wallet is created for you automatically; orders execute on
          Polymarket&apos;s order book.
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🎰 Rocket Lottery</h2>
        <p className="docsP">
          The original KRIPTO NR.1 game: a provably-fair on-chain crash game
          on Base with multipliers up to X10 (min bet 0.0001 ETH, max 0.001
          ETH, house edge ≈ 2%). Outcomes use commit-reveal over a future
          blockhash — the contract source and design notes are in the{" "}
          <a
            href={`${GITHUB}/tree/main/contracts`}
            target="_blank"
            rel="noreferrer"
          >
            contracts folder
          </a>
          . It lives at its own URL,{" "}
          <a href="/lottery">/lottery</a>, and runs as a Base App Mini App.
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">💸 Fees — full transparency</h2>
        <p className="docsP">
          KRIPTO NR.1 is funded by small interface fees on top of the
          underlying protocol costs. There are no hidden markups beyond this
          table, and all values are visible in the open-source config
          (<code>lib/monetize.ts</code>):
        </p>
        <div className="docsTableWrap">
          <table className="docsTable">
            <thead>
              <tr>
                <th>Product</th>
                <th>Interface fee</th>
                <th>How it&apos;s charged</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Swap &amp; Bridge</td>
                <td>{(LIFI_FEE * 100).toFixed(2)}% of the send amount</td>
                <td>
                  Included in the quoted route (integrator{" "}
                  <code>{LIFI_INTEGRATOR}</code>) — what you see quoted is
                  what you get.
                </td>
              </tr>
              <tr>
                <td>Perps</td>
                <td>{HL_BUILDER_FEE_PCT} of order notional</td>
                <td>
                  Hyperliquid builder fee, added to the exchange fee on fills.
                  You approve the exact maximum once, in your wallet, before
                  your first trade.
                </td>
              </tr>
              <tr>
                <td>Predictions</td>
                <td>none on this site</td>
                <td>Trades execute on Polymarket under Polymarket&apos;s fees.</td>
              </tr>
              <tr>
                <td>Lottery</td>
                <td>≈ 2% house edge</td>
                <td>Built into the multiplier odds, enforced on-chain.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🔐 Security model</h2>
        <ul className="docsList">
          <li>
            <b>Non-custodial:</b> no deposits to KRIPTO NR.1, ever. If a page
            asks you to send funds to a &quot;platform address&quot;, it is a
            scam — verify you are on the official domain.
          </li>
          <li>
            <b>Sign what you see:</b> every wallet prompt comes from LI.FI
            contracts, Hyperliquid&apos;s signing scheme, or the lottery
            contract. Read the prompt before signing.
          </li>
          <li>
            <b>Open source:</b> audit the code, run it yourself, or fork it —{" "}
            <a href={GITHUB} target="_blank" rel="noreferrer">
              github.com/Topcrypt0/kripto-nr1
            </a>
            .
          </li>
          <li>
            <b>Risk:</b> leveraged perps can liquidate your margin; the
            lottery is gambling; bridges and smart contracts carry protocol
            risk. Never trade more than you can afford to lose.
          </li>
        </ul>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🛠 Self-hosting</h2>
        <p className="docsP">
          Clone the{" "}
          <a href={GITHUB} target="_blank" rel="noreferrer">
            repository
          </a>
          , <code>npm install</code>, copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and <code>npm run dev</code>. Every
          integration (chains, fees, contract addresses) is configured through
          environment variables — see the README for the full table.
        </p>
      </section>

      <section className="docsSection pPanel">
        <h2 className="docsH2">🔗 Links</h2>
        <ul className="docsList">
          <li>
            GitHub:{" "}
            <a href={GITHUB} target="_blank" rel="noreferrer">
              Topcrypt0/kripto-nr1
            </a>
          </li>
          <li>
            Routing: <a href="https://li.fi" target="_blank" rel="noreferrer">LI.FI</a>
          </li>
          <li>
            Perps:{" "}
            <a href="https://hyperliquid.xyz" target="_blank" rel="noreferrer">
              Hyperliquid
            </a>
          </li>
          <li>
            Prediction markets:{" "}
            <a href="https://polymarket.com" target="_blank" rel="noreferrer">
              Polymarket
            </a>
          </li>
          <li>
            Chain: <a href="https://base.org" target="_blank" rel="noreferrer">Base</a>
          </li>
        </ul>
      </section>
    </main>
  );
}
