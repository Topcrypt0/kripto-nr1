import Link from "next/link";
import { BuyCrypto } from "@/components/BuyCrypto";
import {
  CONSULT_TOPICS,
  COURSES,
  DISCLAIMER,
  EVENTS,
  FAQ,
  LABS,
  LEGAL_CONSULT,
  MISSION,
  PARTNERS,
  SOCIAL,
  SOCIAL_LINKS,
  TEAM,
  TERMINAL,
  WHITELIST,
} from "@/lib/landing";

const NAV = [
  { href: "#terminalis", label: "Terminālis" },
  { href: "#labs", label: "Kripto Labs" },
  { href: "#kursi", label: "Kursi" },
  { href: "#konsultacijas", label: "Konsultācijas" },
  { href: "#partneri", label: "Partneri" },
  { href: "#komanda", label: "Komanda" },
  { href: "#zinasanas", label: "Zināšanas" },
  { href: "#kontakti", label: "Kontakti" },
];

function Socials() {
  return (
    <div className="lpSocials">
      {SOCIAL_LINKS.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noreferrer" className="lpSocial">
          <span aria-hidden>{s.emoji}</span>
          {s.label}
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="lp">
      {/* ---------- hero: the decentralised terminal ---------- */}
      <section className="lpHero">
        <img src="/hero.png" alt="" className="lpHeroImg" />
        <div className="lpHeroInner">
          <span className="lpEyebrow">KRIPTO <span className="accent">NR.1</span> · KRIPTO LATVISKI, VISS VIENUVIET</span>
          <h1 className="lpHeroTitle">
            IZMĒĢINI MŪSU
            <br />
            <span className="lpHeroAccent">DECENTRALIZĒTO</span>
            <br />
            KRIPTO TERMINĀLI
          </h1>
          <p className="lpHeroTag">
            Viss vienuviet: pērc, treido, swapo, bridge, pelni un prognozē.
            Bez konta, bez depozīta — tavs maks, tavi līdzekļi. 🚀
          </p>
          <div className="lpHeroBtns">
            <Link href="/swap" className="lpBtn lpBtnPrimary">
              Atvērt termināli
            </Link>
            <BuyCrypto />
            <Link href="/lottery" className="lpBtn lpBtnGhost">
              🚀 Raķešu loterija
            </Link>
          </div>
          <div className="lpHeroFacts">
            <span>Non-custodial</span>
            <span>30+ blokķēdes</span>
            <span>Atvērtais pirmkods</span>
            <span>Base</span>
          </div>
        </div>
      </section>

      <nav className="lpJump">
        {NAV.map((n) => (
          <a key={n.href} href={n.href} className="lpJumpLink">
            {n.label}
          </a>
        ))}
      </nav>

      {/* ---------- the dApp ---------- */}
      <section id="terminalis" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Kripto Nr.1 Terminālis</h2>
          <p className="lpLead">
            Mūsu dApp — decentralizēta platforma, kas savieno labākos kripto
            protokolus vienā vietā. Tu paraksti katru darījumu pats, mēs neturam
            tavus līdzekļus.
          </p>
        </div>
        <div className="lpGrid">
          {TERMINAL.map((p) => (
            <Link key={p.href} href={p.href} className="lpCard lpCardLink">
              <div className="lpCardEmoji">{p.emoji}</div>
              <div className="lpCardTitle">{p.title}</div>
              <div className="lpCardDesc">{p.desc}</div>
              <div className="lpCardCta">{p.cta} →</div>
            </Link>
          ))}
        </div>
        <div className="lpDappBar">
          <div>
            <div className="lpDappTitle">Gatavs sākt?</div>
            <div className="lpDappSub">
              Pievieno maku un izmēģini termināli — vai izlasi, kā tas darbojas.
            </div>
          </div>
          <div className="lpDappBtns">
            <Link href="/swap" className="lpBtn lpBtnPrimary">
              Atvērt dApp
            </Link>
            <Link href="/docs" className="lpBtn lpBtnGhost">
              Dokumentācija
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- who we are ---------- */}
      <section className="lpSection">
        <div className="lpTwoCol">
          <div className="lpPanel lpPanelPad">
            <h2 className="lpH2">Kripto latviski, viss vienuviet!</h2>
            <p className="lpP">
              Kripto Nr. 1 – vadošais kriptovalūtu medijs un kopiena Latvijā.
              Piedāvājam kvalitatīvu saturu, aktualitātes, apmācības un
              diskusijas latviešu valodā.
            </p>
            <p className="lpQuote">{MISSION.quote}</p>
          </div>
          <div className="lpPanel lpPanelPad">
            <h2 className="lpH2">{MISSION.title}</h2>
            <p className="lpP">{MISSION.lead}</p>
            <p className="lpP lpMuted">{MISSION.body}</p>
          </div>
        </div>
      </section>

      {/* ---------- kripto labs ---------- */}
      <section id="labs" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Kripto Nr.1 Labs</h2>
          <p className="lpLead">Lietas, kas noderēs, uzsākot ceļu kriptovalūtā.</p>
        </div>
        <div className="lpGrid">
          {LABS.map((l) =>
            l.external ? (
              <a key={l.title} href={l.href} target="_blank" rel="noreferrer" className="lpCard lpCardLink">
                <div className="lpCardEmoji">{l.emoji}</div>
                <div className="lpCardTitle">{l.title}</div>
                <div className="lpCardDesc">{l.desc}</div>
                <div className="lpCardCta">Apskatīties →</div>
              </a>
            ) : (
              <Link key={l.title} href={l.href} className="lpCard lpCardLink">
                <div className="lpCardEmoji">{l.emoji}</div>
                <div className="lpCardTitle">{l.title}</div>
                <div className="lpCardDesc">{l.desc}</div>
                <div className="lpCardCta">Apskatīties →</div>
              </Link>
            )
          )}
        </div>
      </section>

      {/* ---------- courses ---------- */}
      <section id="kursi" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Apmācības un kursi</h2>
          <p className="lpLead">
            Mūsdienu digitālajā laikmetā kriptovalūtas kļūst par nozīmīgu
            finanšu pasaules daļu. Nepietiek tikai ar vēlmi ieguldīt —
            nepieciešamas zināšanas, lai pieņemtu pārdomātus un drošus lēmumus.
          </p>
        </div>
        <div className="lpGrid lpGrid3">
          {COURSES.map((c) => (
            <article key={c.title} className="lpCard">
              <div className="lpCourseHead">
                <h3 className="lpCardTitle">{c.title}</h3>
                <span className="lpPrice">{c.price}</span>
              </div>
              <p className="lpCardDesc">{c.lead}</p>
              <ul className="lpList">
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <a
                href={SOCIAL.contact}
                target="_blank"
                rel="noreferrer"
                className="lpBtn lpBtnGhost lpBtnBlock"
              >
                Pieteikties
              </a>
            </article>
          ))}
        </div>
        <div className="lpPanel lpPanelPad lpEvents">
          <h3 className="lpH3">Workshopi un ieraksti</h3>
          <div className="lpChips">
            {EVENTS.map((e) => (
              <span key={e} className="lpChip">
                {e}
              </span>
            ))}
          </div>
          <p className="lpP lpMuted">
            Katru otro otrdienu 20:00 ieslēdz YouTube – mēs esam tiešraidē kopā ar tevi!
          </p>
        </div>
      </section>

      {/* ---------- consultations ---------- */}
      <section id="konsultacijas" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Konsultācijas</h2>
          <p className="lpLead">
            Lai pieteiktos konsultācijai, sazinies ar izvēlēto Kripto Nr. 1
            partneri privāti Telegram.
          </p>
        </div>
        <div className="lpTwoCol">
          <div className="lpPanel lpPanelPad">
            <h3 className="lpH3">TĒMAS KONSULTĀCIJĀM</h3>
            <ul className="lpList">
              {CONSULT_TOPICS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="lpRate">Konsultācijas maksa 70 EUR/h</p>
          </div>
          <div className="lpPanel lpPanelPad">
            <h3 className="lpH3">{LEGAL_CONSULT.name}</h3>
            <p className="lpRole">{LEGAL_CONSULT.role}</p>
            <ul className="lpList">
              {LEGAL_CONSULT.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="lpRate">{LEGAL_CONSULT.rate}</p>
          </div>
        </div>
      </section>

      {/* ---------- partners ---------- */}
      <section id="partneri" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Sadarbības partneri</h2>
          <p className="lpLead">
            Mūsu stiprā puse ir partnerība ar kriptovalūtu tehnoloģiju
            uzņēmumiem. Tā nodrošina mums piekļuvi mūsdienīgiem risinājumiem un
            dod drošību, efektivitāti ikvienā darījumā.
          </p>
        </div>
        <div className="lpGrid">
          {PARTNERS.map((p) => (
            <article key={p.name} className="lpCard">
              <div className="lpPartnerHead">
                <h3 className="lpCardTitle">{p.name}</h3>
                <span className="lpTag">{p.kind}</span>
              </div>
              <p className="lpCardDesc">{p.desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- team ---------- */}
      <section id="komanda" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Komanda</h2>
          <p className="lpLead">
            Ienirsti kripto pasaulē ar mums — cilvēkiem, kas šo ceļu jau ir izgājuši.
          </p>
        </div>
        <div className="lpGrid lpGrid3">
          {TEAM.map((m) => (
            <article key={m.name} className="lpCard">
              <div className="lpAvatar" aria-hidden>
                {m.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")}
              </div>
              <h3 className="lpCardTitle">{m.name}</h3>
              <p className="lpRole">{m.role}</p>
              <p className="lpCardDesc">{m.bio}</p>
              <p className="lpRate">{m.rate}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- private group / whitelist ---------- */}
      <section id="whitelist" className="lpSection">
        <div className="lpPanel lpPanelPad lpWhitelist">
          <h2 className="lpH2">{WHITELIST.title}</h2>
          {WHITELIST.body.map((b) => (
            <p key={b} className="lpP">
              {b}
            </p>
          ))}
          <p className="lpP lpMuted">{WHITELIST.privateGroup}</p>
          <div className="lpNotes">
            <div className="lpNotesTitle">Svarīgi:</div>
            <ul className="lpList">
              {WHITELIST.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
          <p className="lpP">{WHITELIST.outro}</p>
          <a
            href={SOCIAL.whitelistForm}
            target="_blank"
            rel="noreferrer"
            className="lpBtn lpBtnPrimary"
          >
            PIETEIKTIES
          </a>
        </div>
      </section>

      {/* ---------- knowledge base ---------- */}
      <section id="zinasanas" className="lpSection">
        <div className="lpSectionHead">
          <h2 className="lpH2">Kripto zināšanas</h2>
          <p className="lpLead">
            ...kas palīdzēs Tev saprast kripto un sasniegt rezultātus! Dalāmies
            ar zināšanām par blokķēdi, tirdzniecību, investīcijām un airdropiem,
            lai Tu varētu droši un pārliecinoši virzīties kripto pasaulē.
          </p>
        </div>
        <div className="lpFaq">
          {FAQ.map((f) => (
            <details key={f.q} className="lpFaqItem">
              <summary className="lpFaqQ">{f.q}</summary>
              <p className="lpFaqA">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- community & contact ---------- */}
      <section id="kontakti" className="lpSection">
        <div className="lpPanel lpPanelPad lpContact">
          <h2 className="lpH2">Sazinies ar mums</h2>
          <p className="lpLead">
            Ienirsti kripto pasaulē – sarunas, zināšanas un atbalsts.
            Pievienojies mūsu sociālajiem tīkliem!
          </p>
          <Socials />
        </div>
      </section>

      <footer className="lpFoot">
        <p className="lpDisclaimer">{DISCLAIMER}</p>
        <div className="lpFootRow">
          <span>
            KRIPTO NR.1 · atvērtais pirmkods · non-custodial ·{" "}
            <Link href="/docs" className="lpFootLink">
              dokumentācija
            </Link>
          </span>
          <span className="lpFootMuted">
            Routing by LI.FI · Perps by Hyperliquid · Markets by Polymarket
          </span>
        </div>
      </footer>
    </main>
  );
}
