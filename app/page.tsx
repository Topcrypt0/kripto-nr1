import Link from "next/link";
import { BuyCrypto } from "@/components/BuyCrypto";
import {
  ART,
  CONSULT_TOPICS,
  COURSES,
  COURSES_HEAD,
  DISCLAIMER,
  FAQ,
  HERO,
  LABS,
  LABS_HEAD,
  LEGAL_CONSULT,
  MISSION,
  NEWS,
  PARTNERS,
  PRIVATE,
  PRODUCTS,
  PRODUCTS_HEAD,
  SOCIAL,
  TEAM,
  TERMINAL,
} from "@/lib/landing";

const NAV = [
  { href: "#sakums", label: "Sākums" },
  { href: "#labs", label: "Kripto Labs" },
  { href: "#produkti", label: "Produkti" },
  { href: "#konsultacijas", label: "Konsultācijas" },
  { href: "#privata-grupa", label: "Privātā grupa" },
  { href: "#partneri", label: "Sadarbības partneri" },
  { href: "#komanda", label: "Komanda" },
  { href: "#kontakti", label: "Kontakti" },
];

const SOCIALS = [
  { label: "Telegram", href: SOCIAL.telegramChannel, cls: "kTg" },
  { label: "YouTube", href: SOCIAL.youtube, cls: "kYt" },
  { label: "TikTok", href: SOCIAL.tiktok, cls: "kTt" },
];

/** Brand glyphs, drawn inline so the page stays self-contained. */
function Glyph({ kind }: { kind: string }) {
  if (kind === "kTt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M16.6 5.8a4.3 4.3 0 0 1-1.1-2.8h-3v12.1a2.5 2.5 0 1 1-1.8-2.4V9.6a5.5 5.5 0 1 0 4.8 5.5V9a7.3 7.3 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z"
        />
      </svg>
    );
  }
  if (kind === "kYt") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          fill="currentColor"
          d="M23 12s0-3.8-.5-5.6a2.9 2.9 0 0 0-2-2C18.7 4 12 4 12 4s-6.7 0-8.5.4a2.9 2.9 0 0 0-2 2C1 8.2 1 12 1 12s0 3.8.5 5.6a2.9 2.9 0 0 0 2 2C5.3 20 12 20 12 20s6.7 0 8.5-.4a2.9 2.9 0 0 0 2-2C23 15.8 23 12 23 12ZM9.8 15.4V8.6l5.9 3.4-5.9 3.4Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.4 12.9l-4.8-1.5c-1-.3-1-1 .2-1.5l18.7-7.2c.9-.3 1.6.2 1.4 1.6Z"
      />
    </svg>
  );
}

function SocialRow({ big = false }: { big?: boolean }) {
  return (
    <div className={big ? "kSocials kSocialsBig" : "kSocials"}>
      {SOCIALS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noreferrer"
          className={`kSocial ${s.cls}`}
          title={s.label}
          aria-label={s.label}
        >
          <Glyph kind={s.cls} />
        </a>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main
      className="k"
      style={
        {
          // The old site's falling-coin artwork, used by .kCoins sections.
          "--coinsL": `url(${ART.bottomLeftBg})`,
          "--coinsR": `url(${ART.bottomRightBg})`,
        } as React.CSSProperties
      }
    >
      {/* ---------- site bar, in the old site's own layout ---------- */}
      <nav className="kBar">
        <div className="kBarLinks">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="kBarLink">
              {n.label}
            </a>
          ))}
        </div>
        <div className="kBarRight">
          <a href="#privata-grupa" className="kRedBtn kBarWhitelist">
            Privātā grupa
          </a>
          <SocialRow />
        </div>
      </nav>

      {/* ---------- Sākums ---------- */}
      <section id="sakums" className="kHero">
        <img src={ART.heroCoins} alt="" className="kHeroBg" />
        <div className="kHeroInner">
          <h1 className="kHeroTitle">
            Izmēģini mūsu <span className="kAccent">decentralizēto</span> kripto
            termināli
          </h1>
          <p className="kHeroSub">
            Viss vienuviet: pērc, treido, swapo, bridge, pelni un prognozē.
            Bez konta un bez depozīta — tavs maks, tavi līdzekļi.
          </p>
          <div className="kHeroBtns">
            <Link href="/swap" className="kRedBtn kRedBtnLg">
              ATVĒRT DAPP TERMINĀLI
            </Link>
            <BuyCrypto />
          </div>
          <h2 className="kHeroTitle2">{HERO.title}</h2>
          <p className="kHeroSub">{HERO.desc}</p>
          <div className="kHeroBtns">
            <a href={SOCIAL.telegramChannel} target="_blank" rel="noreferrer" className="kRedBtn">
              TELEGRAM KANĀLS <Glyph kind="kTg" />
            </a>
            <a href={SOCIAL.telegramChat} target="_blank" rel="noreferrer" className="kRedBtn">
              TELEGRAM ČATS <Glyph kind="kTg" />
            </a>
            <a href={SOCIAL.telegramPrivate} target="_blank" rel="noreferrer" className="kRedBtn">
              TG PRIVĀTĀ GRUPA <Glyph kind="kTg" />
            </a>
          </div>
          <img src={ART.phone} alt="" className="kHeroPhone" />
        </div>
      </section>

      {/* ---------- the dApp ---------- */}
      <section id="terminalis" className="kSection">
        <h2 className="kH2">Kripto Nr.1 Terminālis</h2>
        <p className="kLead">
          Mūsu dApp — decentralizēta platforma, kas savieno labākos kripto
          protokolus vienā vietā. Tu paraksti katru darījumu pats, mēs neturam
          tavus līdzekļus.
        </p>
        <div className="kGrid kGrid3">
          {TERMINAL.map((p) => (
            <Link key={p.href} href={p.href} className="kCard kCardLink">
              <div className="kCardEmoji">{p.emoji}</div>
              <h3 className="kCardTitleW">{p.title}</h3>
              <p className="kCardDesc">{p.desc}</p>
              <span className="kMore">{p.cta} →</span>
            </Link>
          ))}
        </div>
        <div className="kCenter">
          <Link href="/swap" className="kRedBtn kRedBtnLg">
            ATVĒRT DAPP TERMINĀLI
          </Link>
        </div>
      </section>

      {/* ---------- Mūsu misija ---------- */}
      <section id="misija" className="kSection kCoins">
        <h2 className="kH2">{MISSION.title}</h2>
        <div className="kMission">
          {[MISSION.lead, PRIVATE.blurb, MISSION.body].map((t, i) => (
            <div key={t} className="kMissionCol">
              <div className="kMissionIcon">
                <img src={MISSION.icons[i]} alt="" />
              </div>
              <p className="kMissionText">{t}</p>
            </div>
          ))}
        </div>
        <p className="kJoin">
          Ienirsti kripto pasaulē – sarunas, zināšanas un atbalsts. Pievienojies
          mūsu sociālajiem tīkliem!
        </p>
        <SocialRow big />
      </section>

      {/* ---------- Kripto Labs ---------- */}
      <section id="labs" className="kSection">
        <h2 className="kH2">{LABS_HEAD.title}</h2>
        <p className="kLead">{LABS_HEAD.desc}</p>
        <div className="kLabs">
          {LABS.map((title) => (
            <a
              key={title}
              href={SOCIAL.youtube}
              target="_blank"
              rel="noreferrer"
              className="kCard kLabCard"
            >
              <h3 className="kCardTitle">{title}</h3>
              <span className="kPlay" aria-hidden>
                <Glyph kind="kYt" />
              </span>
              <span className="kMore">Skatīties YouTube →</span>
            </a>
          ))}
        </div>
      </section>

      {/* ---------- courses ---------- */}
      <section id="kursi" className="kSection kCoins">
        <h2 className="kH2">{COURSES_HEAD.title}</h2>
        {COURSES_HEAD.desc.map((d) => (
          <p key={d} className="kLead">
            {d}
          </p>
        ))}
        {COURSES.map((c) => (
          <article key={c.title} className="kCard kCourse">
            <img src={c.img} alt="" className="kCourseImg" />
            <div className="kCourseBody">
              <h3 className="kCardTitle">{c.title}</h3>
              <ul className="kList">
                {c.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <p className="kCourseHeadline">{c.headline}</p>
              <p className="kCourseValue">{c.value}</p>
              <p className="kPrice">{c.price}</p>
            </div>
            <div className="kCourseCta">
              <a href="#kontakti" className="kRedBtn">
                PIETEIKTIES
              </a>
            </div>
          </article>
        ))}
      </section>

      {/* ---------- Produkti ---------- */}
      <section id="produkti" className="kSection kCoins">
        <h2 className="kH2">{PRODUCTS_HEAD.title}</h2>
        <p className="kLead">{PRODUCTS_HEAD.desc}</p>
        <div className="kGrid kGrid2">
          {PRODUCTS.map((p) => (
            <article key={p.title} className="kCard kProduct">
              <h3 className="kCardTitleW">{p.title}</h3>
              <p className="kCardDesc">{p.desc}</p>
              <img src={p.img} alt="" className="kProductImg" />
              {p.internal ? (
                <Link href={p.more} className="kMoreLink">
                  Vairāk informācijas šeit!
                </Link>
              ) : (
                <a href={p.more} className="kMoreLink">
                  Vairāk informācijas šeit!
                </a>
              )}
              {p.internal ? (
                <Link href={p.more} className="kRedBtn">
                  {p.cta}
                </Link>
              ) : (
                <a href="#kontakti" className="kRedBtn">
                  {p.cta}
                </a>
              )}
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Konsultācijas ---------- */}
      <section id="konsultacijas" className="kSection">
        <h2 className="kH2">Konsultācijas</h2>
        <p className="kLead">
          Lai pieteiktos konsultācijai, sazinies ar izvēlēto Kripto Nr. 1
          partneri privāti Telegram.
        </p>
        <div className="kGrid kGrid2">
          <article className="kCard">
            <h3 className="kCardTitle">TĒMAS KONSULTĀCIJĀM</h3>
            <ul className="kList">
              {CONSULT_TOPICS.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="kRate">Konsultācijas maksa 70 EUR/h</p>
          </article>
          <article className="kCard kCenterCard">
            <img
              src={LEGAL_CONSULT.photo}
              alt={LEGAL_CONSULT.name}
              className="kAvatar"
            />
            <h3 className="kCardTitleW">{LEGAL_CONSULT.name}</h3>
            <p className="kRole">{LEGAL_CONSULT.role}</p>
            <ul className="kList kListLeft">
              {LEGAL_CONSULT.topics.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <p className="kRate">{LEGAL_CONSULT.rate}</p>
          </article>
        </div>
      </section>

      {/* ---------- Sadarbības partneri ---------- */}
      <section id="partneri" className="kSection kCoins">
        <h2 className="kH2">Sadarbības partneri</h2>
        <p className="kLead">
          Mūsu stiprā puse ir partnerība ar kriptovalūtu tehnoloģiju
          uzņēmumiem. Tā nodrošina mums piekļuvi mūsdienīgiem risinājumiem un
          dod drošību, efektivitāti ikvienā darījumā.
        </p>
        <div className="kGrid kGrid3">
          {PARTNERS.map((p) => (
            <article key={p.name} className="kCard kProduct">
              <h3 className="kCardTitleW">{p.name}</h3>
              <img src={p.img} alt="" className="kProductImg" />
              <p className="kCardDesc">{p.desc}</p>
              <a href="#kontakti" className="kMoreLink">
                Vairāk informācija šeit!
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Komanda ---------- */}
      <section id="komanda" className="kSection">
        <h2 className="kH2">Komanda</h2>
        <div className="kGrid kGrid3">
          {TEAM.map((m) => (
            <article key={m.name} className="kCard kCenterCard">
              <img src={m.photo} alt={m.name} className="kAvatar" />
              <h3 className="kCardTitleW">{m.name}</h3>
              <p className="kRole">{m.role}</p>
              <p className="kCardDesc">{m.bio}</p>
              <p className="kRate">{m.rate}</p>
              <a
                href={m.telegram}
                target="_blank"
                rel="noreferrer"
                className="kTgBtn"
              >
                <img src={m.tgIcon} alt="" />
                {m.handle}
              </a>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- privātā grupa ---------- */}
      <section id="privata-grupa" className="kSection kCoins">
        <h2 className="kH2">{PRIVATE.title}</h2>
        <p className="kLead">{PRIVATE.intro}</p>
        <div className="kCard kPrivate">
          <h3 className="kCardTitle">{PRIVATE.offerTitle}</h3>
          <ol className="kOffer">
            {PRIVATE.offer.map((o, i) => (
              <li key={o}>
                <span className="kOfferNo">{i + 1}</span>
                {o}
              </li>
            ))}
          </ol>
        </div>
        <p className="kJoin kJoinSm">{PRIVATE.joinTitle}</p>
        <div className="kCenter">
          <a
            href={SOCIAL.payCard}
            target="_blank"
            rel="noreferrer"
            className="kRedBtn kRedBtnLg"
          >
            💳 MAKSĀT AR KARTI
          </a>
          <a
            href={SOCIAL.payCrypto}
            target="_blank"
            rel="noreferrer"
            className="kRedBtn kRedBtnLg"
          >
            ₿ MAKSĀT AR KRIPTO
          </a>
        </div>
        <p className="kPayHint">
          Ar karti — caur Tribute. Ar kripto — mūsu Telegram botā @Kripto_Nr1_bot.
        </p>
      </section>

      {/* ---------- knowledge base ---------- */}
      <section id="zinasanas" className="kSection">
        <h2 className="kH2">Kripto zināšanas</h2>
        <p className="kLead">
          ...kas palīdzēs Tev saprast kripto un sasniegt rezultātus! Dalāmies ar
          zināšanām par blokķēdi, tirdzniecību, investīcijām un airdropiem, lai
          Tu varētu droši un pārliecinoši virzīties kripto pasaulē.
        </p>
        <div className="kFaq">
          {FAQ.map((f) => (
            <details key={f.q} className="kCard kFaqItem">
              <summary className="kFaqQ">{f.q}</summary>
              <p className="kFaqA">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- Kripto ziņas ---------- */}
      <section id="zinas" className="kSection kCoins">
        <h2 className="kH2">{NEWS.title}</h2>
        <p className="kEyebrow">{NEWS.lead}</p>
        <p className="kLead">{NEWS.desc}</p>
        <div className="kCenter">
          <a
            href={SOCIAL.telegramChannel}
            target="_blank"
            rel="noreferrer"
            className="kRedBtn"
          >
            LASĪT ZIŅAS
          </a>
        </div>
      </section>

      {/* ---------- Kontakti ---------- */}
      <section id="kontakti" className="kSection">
        <h2 className="kH2">Sazinies ar mums</h2>
        <p className="kJoin">
          Ienirsti kripto pasaulē – sarunas, zināšanas un atbalsts. Pievienojies
          mūsu sociālajiem tīkliem!
        </p>
        <SocialRow big />
        <p className="kLead">
          Lai pieteiktos konsultācijai vai kursam, sazinies ar izvēlēto Kripto
          Nr. 1 partneri privāti Telegram:
        </p>
        <div className="kCenter kContacts">
          {TEAM.map((m) => (
            <a
              key={m.name}
              href={m.telegram}
              target="_blank"
              rel="noreferrer"
              className="kTgBtn"
            >
              <img src={m.tgIcon} alt="" />
              {m.name} · {m.handle}
            </a>
          ))}
        </div>
      </section>

      <footer className="kFoot">
        <p className="kDisclaimer">{DISCLAIMER}</p>
        <p className="kFootRow">
          KRIPTO NR.1 · atvērtais pirmkods · non-custodial ·{" "}
          <Link href="/docs">dokumentācija</Link>
        </p>
      </footer>
    </main>
  );
}
