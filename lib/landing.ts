/**
 * Landing-page copy, carried over from the previous kriptonr1 site.
 *
 * The text is kept in Latvian, exactly as it was written for the community;
 * only the layout around it is new. Everything lives here so the page file
 * stays about structure rather than strings.
 */

/**
 * Photos and artwork still live in the old site's Wix media library, so they
 * are served straight from Wix's CDN — the ids below are the same assets the
 * previous kriptonr1 site used.
 */
const M = (id: string) => `https://static.wixstatic.com/media/${id}`;

export const ART = {
  logo: M("43dac4_8a4903eda5004de089a6c97b60e74576~mv2.png"),
  topBg: M("43dac4_ae5b3e22fd8f44e9b73a8b7d4b95bfb7~mv2.png"),
  bottomLeftBg: M("43dac4_d122fd48296b45ef94d928621b2f9ab2~mv2.png"),
  bottomRightBg: M("43dac4_4057df11f50d45c38e489ca7c9ff5f67~mv2.png"),
  terminal: M("8ce3a2_cd1f565bc777404abd630fc9f58629bb~mv2.png"),
  heroCoins: M("43dac4_b8b453f513f54865b4cd289fb9ad8c0d~mv2.jpg"),
  phone: M("43dac4_cab0e8c612754c2fa3a3be6c418397b7~mv2.png"),
  privateGroup: M("8ce3a2_b037940efc0346139aa9c38defc23c30~mv2.png"),
  products: M("8ce3a2_7e1e7da3a1c249c9abe24dca47a1ff4b~mv2.png"),
  news: M("8ce3a2_a721d5e6dfbc41dbb2235e6535ec1a6a~mv2.jpg"),
  handshake: M("43dac4_18b1bd02f4af4e2aa0826c9c2ec0b978~mv2.png"),
  tech: M("43dac4_b457ddc58fb84a38b35fd251d739b731~mv2.png"),
  developing: M("43dac4_a671a323b11f4be58db89fd49dd92657~mv2.png"),
};

/** Community links — the real destinations from the Kripto Nr.1 link set. */
export const SOCIAL = {
  telegramChannel: "https://t.me/kriptonr1",
  telegramChat: "https://t.me/+scpLA_vgetQ2YmJk",
  telegramPrivate: "https://t.me/tribute/app?startapp=siKw-5jq16tckash",
  youtube: "https://www.youtube.com/@kriptonr1",
  tiktok: "https://www.tiktok.com/@kriptonr1",
  // Private-group access: card via Tribute, crypto via the Telegram bot.
  payCard: "https://t.me/tribute/app?startapp=siKw-5jq16tckash",
  payCrypto: "https://t.me/Kripto_Nr1_bot",
};

export const SOCIAL_LINKS = [
  { label: "TELEGRAM KANĀLS", href: SOCIAL.telegramChannel, emoji: "📣" },
  { label: "TELEGRAM ČATS", href: SOCIAL.telegramChat, emoji: "💬" },
  { label: "TG PRIVĀTĀ GRUPA", href: SOCIAL.telegramPrivate, emoji: "🔒" },
  { label: "YOUTUBE KANĀLS", href: SOCIAL.youtube, emoji: "▶️" },
];

/** The dApp itself — every tab of the terminal. */
export const TERMINAL = [
  {
    href: "/swap",
    emoji: "🔁",
    title: "Swap & Bridge",
    desc: "Labākā maršruta agregators 30+ blokķēdēs un visās lielākajās DEX un tiltos. Viens klikšķis — labākā cena.",
    cta: "Treidot",
  },
  {
    href: "/perps",
    emoji: "📈",
    title: "Perps",
    desc: "Mūžīgie fjūčeri uz Hyperliquid — līdz 50× svira, CEX līmeņa ātrums, pilnībā on-chain.",
    cta: "Long / Short",
  },
  {
    href: "/earn",
    emoji: "🏦",
    title: "Earn (DeFi)",
    desc: "Liec stabilkoinus strādāt — pasīvs APY Morpho vaultos un Aave aizdevumos. Izņem jebkurā brīdī.",
    cta: "Pelnīt",
  },
  {
    href: "/predict",
    emoji: "🔮",
    title: "Prognozes",
    desc: "Dzīvie prognožu tirgi ar Polymarket. Politika, kripto, sports — treido iznākumu.",
    cta: "Skatīt tirgus",
  },
  {
    href: "/lottery",
    emoji: "🚀",
    title: "Raķešu loterija",
    desc: "Oriģinālā KRIPTO NR.1 raķete. Pierādāmi godīga on-chain spēle uz Base — laimests līdz X10.",
    cta: "Palaist raķeti",
  },
  {
    href: "/points",
    emoji: "✨",
    title: "Punkti un balvas",
    desc: "Katrs swap, bridge, perp darījums un raķetes palaišana pelna punktus pēc apgrozījuma. Uzaicini draugus par 10% no viņu punktiem, kāp līderu tabulā un atver privāto grupu.",
    cta: "Mani punkti",
  },
];

/** Produkti — the four cards from the old site's Produkti page. */
export const PRODUCTS_HEAD = {
  title: "Ienirsti kripto pasaulē ar Kripto nr.1 produktiem",
  desc:
    "Parādi savu kripto pārliecību ar stilu – mūsu produkti ir vairāk nekā tikai produkti, tas ir tavs skatījums uz brīvību un tehnoloģiju nākotni, kas runā tavā valodā.",
};

export const PRODUCTS = [
  {
    title: "Kripto Nr.1 Kursi",
    desc:
      "Nepietiek tikai ar vēlmi ieguldīt — nepieciešamas zināšanas, lai pieņemtu pārdomātus un drošus lēmumus.",
    img: M("8ce3a2_ae6bbfabb7fc4d7e849a5e333df63fd0~mv2.png"),
    more: "#kursi",
    cta: "IEGĀDĀTIES",
  },
  {
    title: "Kripto Nr.1 Privātā grupa",
    desc: "Šī nav tikai grupa — šis ir starts tavai jaunajai dzīvei kripto pasaulē.",
    img: M("8ce3a2_b037940efc0346139aa9c38defc23c30~mv2.png"),
    more: "#privata-grupa",
    cta: "IEGĀDĀTIES",
  },
  {
    title: "Kripto Nr.1 konsultācijas",
    desc: "Pieredze un zināšans kas noderēs",
    img: M("8ce3a2_40822f98a5c34cbc81e10c0b05b679b7~mv2.png"),
    more: "#konsultacijas",
    cta: "IEGĀDĀTIES",
  },
  {
    title: "Kripto Nr.1 Terminālis",
    desc: "Viss vienuviet: pērc, treido, swapo, bridge, pelni un prognozē.",
    img: M("8ce3a2_cd1f565bc777404abd630fc9f58629bb~mv2.png"),
    more: "/swap",
    cta: "ATVĒRT",
    internal: true,
  },
];

/** Kripto ziņas — the daily news feed the community runs. */
export const NEWS = {
  title: "Kripto ziņas",
  lead: "TEKOŠĀS DIENAS JAUNUMI — katru dienu, latviski.",
  desc:
    "Katru dienu apkopojam svarīgāko no kripto pasaules: ETF, regulējums, institūciju darījumi, tokenu palaišanas un tirgus kustības. Viss latviski, mūsu Telegram kanālā.",
};

export const MISSION = {
  title: "Mūsu misija",
  icons: [ART.handshake, ART.tech, ART.developing],
  lead:
    "Mūsu misija ir sniegt latviski runājošajiem cilvēkiem zināšanas, palīdzēt saglabāt kapitālu un saskatīt peļņas iespējas, izmantojot kriptoaktīvus.",
  body:
    "Kripto joma piedāvā daudzveidīgas peļņas iespējas un nepārtraukti attīstās. Mēs esam gatavi dalīties ar zināšanām, ko jau esam apguvuši, un turpinām mācīties, lai šīs zināšanas nodotu arī jums. Vai vēlaties būt daļa no šī ceļa?",
  quote:
    "„Viņi saka – tas ir tikai hype. Mēs sakām – paskaties uz cipariem.” Tu pats izlem, bet mēs dodam faktus.",
};

/**
 * Kripto Labs — the video library. The old site embeds each lesson from
 * YouTube; until the video ids are to hand these link to the channel.
 */
export const LABS_HEAD = {
  title: "Kripto Nr.1 Labs",
  desc: "Lietas, kas noderēs, uzsākot ceļu kriptovalūtā.",
};

export const LABS = [
  { title: "KRIPTO IESĀCĒJIEM", id: "vLicX5G5YNU" },
  { title: "KRIPTO PAMATI IESĀCĒJIEM II", id: "yvaWxu8CQ60" },
  { title: "DEFI WORKSHOP", id: "B3NnoslNE9Q" },
  { title: "KRIPTO NR.1 PRIVATE EKSKURSIJA", id: "GiDvyGZW6GE" },
  { title: "NODOKĻI KRIPTOVALŪTĀ", id: "93Bt1Tv3_qA" },
  { title: "KĀ UZLIKT KRIPTO BOTUS", id: "_uSX1mgUkSk" },
];

export const COURSES_HEAD = {
  title: "Ienirsti kripto pasaulē ar mums!",
  desc: [
    "Mūsdienu digitālajā laikmetā kriptovalūtas kļūst par nozīmīgu finanšu pasaules daļu.",
    "Nepietiek tikai ar vēlmi ieguldīt — nepieciešamas zināšanas, lai pieņemtu pārdomātus un drošus lēmumus.",
    "Apmācības par kriptovalūtu, kas piemērotas gan iesācējiem, gan tiem, kuri vēlas padziļināt savas zināšanas.",
  ],
};

/** Courses and workshops. */
export const COURSES = [
  {
    title: "KRIPTO STARTA KOMPLEKTS",
    img: M("43dac4_db27d703928a41f99cf3fc6bb14832b0~mv2.png"),
    price: "149 € / $",
    headline: "SĀC SAVU KRIPTO CEĻU AR VISU, KAS NEPIECIEŠAMS!",
    lead:
      "Vai esi gatavs kripto pasaulei, bet nezini, ar ko sākt? Mums ir īpašs piedāvājums iesācējiem – viss, kas nepieciešams, lai sāktu pārliecinoši un droši. Padziļinātais kurss iesācējiem – soli pa solim par visu svarīgo: drošība, pirkšana, peļņas iespējas, stratēģijas un vēl daudz kas cits.",
    value: "Vērtība > 200 €/$ — Tu iegūsti visu par 149 €/$.",
    items: [
      "Kripto drošība un kriptovalūtu daudzveidība",
      "Kriptovalūtu pirkšana, pārdošana un kripto portfeļa veidošana",
      "Nodokļi kripto nozarē",
      "Treidinga pamati, tehniskā analīze / indikatori un trading boti",
      "Tirgus psiholoģija, projektu analīze, ilgtermiņa un īstermiņa stratēģija",
      "NFT un RWA, airdropi un retrodropi",
      "Memcoini un tap spēles",
      "Decentralizēto finanšu pamati",
    ],
  },
  {
    title: "TRADING KURSS",
    img: M("43dac4_4ab1e06a25b841a68bd06d07922c9a31~mv2.png"),
    price: "299 € / 299 USDT",
    headline: "PACEL SEVI JAUNĀ LĪMENĪ AR TRADING APMĀCĪBĀM",
    lead:
      "Esam izstrādājuši kursu, kas ietver 10 nodarbības un vairāk nekā 10 stundas vērtīga materiāla par trading pasauli. Pēc apmaksas tevi pievienos TG grupai, kur būs visi video materiāli un kur droši varēsi uzdot sev interesējošos un neskaidros jautājumus.",
    value: "Apmācību maksa 299 €/299 USDT, standartā 374.",
    items: [
      "Tradinga pamati",
      "Tirgus psiholoģija",
      "Indikatori",
      "Paterni",
      "FVG un ICC stratēģijas",
      "Eliot waves teorija",
      "Likviditāte",
      "Un vēl daudz kas cits",
    ],
  },
  {
    title: "DEFI KURSS",
    img: M("43dac4_b3b173f21f104c5a89808e9e1097738c~mv2.png"),
    price: "149 € / $",
    headline: "ATVER SAVU KRIPTO PASAULI AR DEFI",
    lead:
      "Vai esi gatavs kaut kam vairāk, bet nezini, ar ko sākt? Mums ir īpašs piedāvājums – viss, kas nepieciešams, lai atvērtu vārtus uz DeFi vidi: drošība, DeFi struktūra un darbības principi, protokolu pielietojums, DeFi stratēģijas un vēl daudz kas cits.",
    value: "Vērtība > 200 €/$ — Tu iegūsti visu par 149 €/$.",
    items: [
      "DeFi ievads",
      "DeFi struktūra un darbības principi",
      "Blokķēdes paaudzes — kā mēs tikām līdz paralēlai finanšu sistēmai",
      "Galvenie DeFi protokolu veidi",
      "Protokolu pielietojums, DeFi stratēģijas",
      "Aktīvi, ko izmantot DeFi",
      "DefiLlama",
      "Praktiskā nodarbība",
    ],
  },
];

export const HERO = {
  title: "Kripto latviski, viss vienuviet!",
  desc:
    "Kripto Nr. 1 – vadošais kriptovalūtu medijs un kopiena Latvijā. Piedāvājam kvalitatīvu saturu, aktualitātes, apmācības un diskusijas latviešu valodā.",
};

export const EVENTS = [
  "KRIPTO PAMATI IESĀCĒJIEM II",
  "DEFI WORKSHOP",
  "KRIPTO NR.1 PRIVATE EKSKURSIJA",
  "SARUNA AR VIESTURU TAMUŽU",
  "KĀ UZLIKT KRIPTO BOTUS",
  "NODOKĻI KRIPTOVALŪTĀ",
];

/**
 * The team. Consultation topics are shown as one shared list because the
 * old site did not tie a topic list to a single person unambiguously.
 */
export const TEAM = [
  {
    name: "Vilnis Priedītis",
    role: "Kripto Nr.1 līdzdibinātājs",
    bio:
      "Kripto investors kopš 2020. gada. Uzņēmējs ar vairāk kā 30 gadu pieredzi dažādās biznesa nozarēs. Kripto projekta ditextoken.com un pašizziņas aplikācijas Matchful (matchful.me) izveidotājs. TikTok pazīstams kā Kriptoplikpauris.",
    rate: "Konsultācijas maksa 70 EUR/h",
    telegram: "https://t.me/VilnisPrieditis",
    handle: "@VilnisPrieditis",
    photo: M("43dac4_193bb93a1adc492d8cc8ff950733b92f~mv2.png"),
    tgIcon: M("43dac4_5c69a2cc6204445bbda46fd48dca4d87~mv2.png"),
  },
  {
    name: "Rihards Pranis",
    role: "Kripto Nr.1 līdzdibinātājs",
    bio:
      "Treideris, ilgtermiņa investors un dažādu veiksmīgu NFT projektu veidotājs, ar pieredzi kripto jomā kopš 2019. gada. Radoša un inovatīva domāšana, spēja ātri pielāgoties mainīgajiem tirgus apstākļiem, kas nodrošina ilgtspējīgu attīstību gan investīciju jomā, gan projektu vadībā.",
    rate: "Konsultācijas maksa 70 EUR/h",
    telegram: "https://t.me/RihardsPranis",
    handle: "@RihardsPranis",
    photo: M("8ce3a2_1659c70421c144e0b03d97311fb06204~mv2.jpg"),
    tgIcon: M("43dac4_9c9305e6ac774f3984aade0b7e743393~mv2.png"),
  },
  {
    name: "Andrejs Kozlovs",
    role: "Kripto Nr.1 līdzdibinātājs",
    bio:
      "Kriptovalūtu un pasīvo ienākumu investors kopš 2021. gada. Mana stiprā puse ir ātri pielāgoties mainīgajiem tirgus apstākļiem, kas palīdz veidot diversificētu un ilgtermiņā ilgtspējīgu investīciju portfeli. Man ir vairāk nekā 10 gadu pieredze pārdošanā un komandu vadībā, kas sniedz stratēģisku redzējumu biznesa attīstībā. Seko man sociālajos tīklos: @MRACRYPTO",
    rate: "Konsultācijas maksa 70 EUR/h",
    telegram: "https://t.me/mracryptoo",
    handle: "@mracryptoo",
    photo: M("43dac4_bc1b7ec2a35d4ad096a483dfd210c69b~mv2.jpg"),
    tgIcon: M("43dac4_5e2399dd9d254eb3b0fc9ef9a2478c4e~mv2.png"),
  },
];

export const CONSULTANTS = [
  {
    name: "Vilnis Priedītis",
    photo: M("43dac4_193bb93a1adc492d8cc8ff950733b92f~mv2.png"),
    telegram: "https://t.me/VilnisPrieditis",
    rate: "Konsultācijas maksa 70 EUR/h",
    topics: [
      "Kripto pamati no nulles, kripto maku izveidošana.",
      "Individuāla kripto portfeļa izveide.",
      "Trading pamati.",
      "Decentralizētas (DEX) un centralizētas (CEX) biržas, to lietošana.",
      "Naudas pārskaitīšana, saņemšana.",
      "Nodokļi kripto nozarē.",
      "Tirgus psiholoģija.",
      "Futures trading.",
      "Biznesa uzsākšana, biznesa plāna sastādīšana, komandas veidošana.",
    ],
  },
  {
    name: "Andrejs Kozlovs",
    photo: M("43dac4_bc1b7ec2a35d4ad096a483dfd210c69b~mv2.jpg"),
    telegram: "https://t.me/mracryptoo",
    rate: "Konsultācijas maksa 70 EUR/h",
    topics: [
      "Kripto pamati (ar ko un kā sākt).",
      "Individuāla portfeļa izveide.",
      "Trading pamati.",
      "Decentralizētas (DEX), centralizētas (CEX) biržas, to lietošana.",
      "Naudas pārskaitīšana, saņemšana.",
      "DeFi pamati.",
      "Tirgus psiholoģija.",
      "Trading botu izmantošana.",
      "Futures treidings.",
      "Drošība kripto vidē.",
      "Excel konsultācijas.",
    ],
  },
  {
    name: "Rihards Pranis",
    photo: M("8ce3a2_ea7ad6b90d5e4ddcb64e346de107ef7f~mv2.png"),
    telegram: "https://t.me/RihardsPranis",
    rate: "Konsultācijas maksa 70 EUR/h",
    topics: [
      "Kripto pamati (drošība, maka izveide, naudas iemaksa, pirkšana, pārdošana un pārsūtīšana).",
      "Individuāla portfeļa izveide un investīciju ieteikumi, atbilstoši kapitālam un riskam.",
      "Trading pamati, lai iemācītos lasīt grafikus un noteikt cenas virzienu.",
      "Decentralizētas un centralizētas biržas, to lietošana.",
      "Naudas pārskaitījumi / nodokļi.",
      "DeFi platformas.",
      "Padziļināta tirgus analīze un psiholoģija.",
      "NFT veidošana, pirkšana/pārdošana.",
      "Mindset.",
      "Jaunu un esošu projektu padziļināta analīze, lai noteiktu, vai tā ir laba investīcija.",
    ],
  },
  {
    name: "Lauris Klagišs",
    role: "Zvērināts advokāts",
    photo: M("8ce3a2_4785b80395f74b70b43ee6441249b278~mv2.jpeg"),
    telegram: "https://t.me/kriptonr1",
    rate: "Konsultācijas maksa 200 EUR + PVN/h",
    topics: [
      "Nodokļu aprēķināšana un nomaksa.",
      "VID darbības metodes un principi.",
      "Legālas iespējas samazināt maksājamo nodokļu apmēru.",
      "Nodokļu jurisdikcijas un nodokļu režīmu izvēle.",
      "Profesionāla pārstāvība Valsts ieņēmumu dienestā.",
      "VID lēmumu pārsūdzēšana.",
      "Pārstāvība administratīvajās tiesās par nodokļu uzrēķiniem.",
      "Klienta sagatavošana Valsts ieņēmumu dienesta pārbaudēm.",
      "Konsultācijas nodokļu maksājumu atlikšanā vai sadalīšanā.",
    ],
  },
];

export const PARTNERS = [
  {
    name: "Bitunix birža",
    img: M("8ce3a2_662aacd74b244587823b052ffc14e0d2~mv2.jpg"),
    kind: "CEX",
    desc:
      "Viena no visstraujāk augošajām CEX biržām, dibināta 2021. gada novembrī. Svarīgi ir tas, ka Bitunix ir ieguvusi ASV un Kanādas MSB licenci, un uzņēmums pašlaik strādā pie citu valstu licenču iegūšanas.",
  },
  {
    name: "Pionex birža",
    img: M("8ce3a2_d8785e879efb4f019cb30064eae06750~mv2.jpg"),
    kind: "CEX · boti",
    desc:
      "Birža ar automatizētiem tirdzniecības rīkiem: vairāki bezmaksas tirdzniecības roboti (arbitrāža, rebalancing), daudzveidīgas tirdzniecības iespējas un zemas komisijas. Izveidota tā, lai atvieglotu tirdzniecību arī nepieredzējušiem tirgotājiem.",
  },
  {
    name: "Tangem Cold Wallet",
    img: M("8ce3a2_b50a3085ecc047f6a1700ea81e84d454~mv2.jpg"),
    kind: "Aparātmaks",
    desc:
      "Kripto maks, kas izskatās kā plastikāta kredītkarte. Privātās atslēgas tiek glabātas fiziski uz kartes, nevis ierīcē — EAL6+ sertifikāts. Pieejami komplekti ar 2 vai 3 kartēm un komplekts ar 2 kartēm un gredzenu.",
  },
  {
    name: "Tradeify",
    img: M("43dac4_31d577e1f6064e91a2f5f4d307db72cf~mv2.jpeg"),
    kind: "Prop firma",
    desc:
      "Strauji augoša prop firma, kas dod pieeju ievērojamam tirdzniecības kapitālam: apliecini prasmes vienkāršotā Challenge procesā un pārvaldi finansētu kontu. Elastīgi noteikumi, moderna tehnoloģiskā bāze un treideriem izdevīga peļņas sadale. Promo kods: KRIPTONR1.",
  },
  {
    name: "TradingView",
    img: M("8ce3a2_e428fd30cdc84d9b83b62354b22a7ec1~mv2.jpg"),
    kind: "Analīze",
    desc:
      "Tiešsaistes platforma finanšu tirgu analīzei un tirdzniecībai: grafiku analīze, indikatori, brīdinājumi un plašas watchlist iespējas akcijām, forex un kriptovalūtām. Reģistrējoties ar mūsu linku un iegādājoties maksas plānu, saņem $15 kredītu savam kontam.",
  },
];

export const FAQ = [
  {
    q: "KAS IR KRIPTOVALŪTA?",
    a: "Kriptovalūta ir digitāla vai virtuāla valūta, kas izmanto kriptogrāfiju, lai nodrošinātu drošību. Atšķirībā no tradicionālajām valūtām (piemēram, eiro vai dolāra), kriptovalūtām parasti nav fiziskas formas, un tās netiek kontrolētas vai izdotas centrālās bankas vai valdības iestādes. Tās pastāv tikai digitālā formā. Kriptovalūtas darbojas uz blokķēdes tehnoloģijas (blockchain) pamata.",
  },
  {
    q: "KAS IR BLOKĶĒDE?",
    a: "Blokķēde (angļu valodā: blockchain) ir īpaša digitāla datubāze vai ierakstu grāmata, kas tiek izplatīta (decentralizēta) un pastāvīgi papildināta. Tā ir tehnoloģija, kas atrodas kriptovalūtu, piemēram, Bitcoin vai Ethereum, pamatā, bet to var izmantot arī citos veidos.",
  },
  {
    q: "KĀ STRĀDĀ BLOKĶĒDE?",
    a: "Bloki (blocks) — informācija tiek glabāta blokos, katrs bloks satur noteiktu datu apjomu (piemēram, darījumus). Ķēde (chain) — katrs jauns bloks tiek piesaistīts iepriekšējam, veidojot „ķēdi”. Decentralizācija — tā vietā, lai dati tiktu glabāti vienā centrālā serverī, blokķēde tiek kopēta un uzturēta daudzos datoros (mezglos) vienlaikus visā pasaulē. Nemainīgums (immutability) — kad bloks ir pievienots ķēdei, to vairs nevar izmainīt vai izdzēst, neizmainot visus nākamos blokus, kas padara krāpšanu praktiski neiespējamu. Caurspīdīgums un pārbaudāmība — visi blokķēdes darījumi ir publiski redzami un pārbaudāmi, bet lietotāju identitāte var palikt anonīma.",
  },
  {
    q: "KAS IR CEX?",
    a: "CEX ir saīsinājums no centralizēta birža (angļu val.: Centralized Exchange). Tā ir tiešsaistes platforma (Bybit, Bitunix, Binance utt.), kur lietotāji var pirkt, pārdot un tirgot kriptovalūtas, izmantojot starpnieku — pašu biržu. Atšķirībā no DEX (decentralizētas biržas), CEX pārvalda lietotāju līdzekļus, uztur orderu grāmatu un nodrošina klientu apkalpošanu.",
  },
  {
    q: "KAS IR DEX?",
    a: "DEX ir saīsinājums no decentralizēta birža (angļu val.: Decentralized Exchange). Tā ir kriptovalūtu tirdzniecības platforma (Uniswap, Pancakeswap utt.), kas darbojas bez centrālās autoritātes vai starpnieka (piemēram, bankas vai uzņēmuma). Lietotāji tirgo savas kriptovalūtas tieši savā starpā, izmantojot viedos līgumus (smart contracts) un blokķēdes tehnoloģiju.",
  },
  {
    q: "KUR GLABĀT KRIPTOVALŪTU?",
    a: "Self-custody maki, kur privātās atslēgas kontrolē tu pats: programmatūras maki (Metamask, Rabby, Phantom) — pilna kontrole un viegli lietot, bet pakļauti riskam, ja dators vai telefons ir apdraudēts; aparātmaki (Tangem, Trezor, Ledger) — maksimāla drošība, jo privātās atslēgas nekad neatstāj ierīci, taču tie maksā ~50–200 € un ir mazāk ērti ikdienai. Centralizētas biržas (Binance, Bitunix, Bybit, Coinbase) ir viegli lietojamas un neprasa privāto atslēgu pārvaldību, bet līdzekļus kontrolē birža.",
  },
  {
    q: "KAS IR SEED PHRASE?",
    a: "Seed phrase jeb atkopšanas frāze (bieži saukta par backup phrase) ir 12, 24 vai 36 vārdu gara frāze, kuru ģenerē tavs kriptovalūtas maks (piem., Rabby, Ledger, Metamask), kad tu to izveido. Šie vārdi nav nejauši — tie ir izvēlēti no BIP-39 saraksta ar 2048 fiksētiem angļu valodas vārdiem. Tā ir vienīgā atslēga uz tavu maku: ja pazaudē telefonu vai datoru, maku vari atjaunot citā ierīcē tikai ar šo frāzi, un, ja kāds cits to iegūst, viņš var nozagt visu tavu kriptovalūtu pat bez tavas paroles. Pieraksti to uz papīra un noliec drošā vietā — nekad neglabā to kā ekrānuzņēmumu vai mākonī.",
  },
];

export const PRIVATE = {
  title: "👑 KRIPTO PRIVATE Nr.1 👑",
  intro:
    "Esi soli priekšā pārējiem un pievienojies mūsu privātajai grupai, kurā satiksi līdzīgi domājošus cilvēkus, kas dalīsies ar informāciju un pieredzi! 👋",
  offerTitle: "KO MĒS PIEDĀVĀJAM?",
  offer: [
    "Trading signāli, tirgus analīze un portfeļa izveide",
    "Airdropi un Retrodropi",
    "Augsta riska memecoini ar milzīgu potenciālu",
    "DEFI instrumenti, likviditātes nodrošināšana līdz PAT 1000% APR",
    "NFT WL saņemšana Top NFT kolekcijās",
    "Piedalīšanās privātajos tokenu izpārdošanas raundos Top Crypto projektos",
    "Traidings uz CEX un DEX",
    "Ilgtermiņa portfelis",
    "Tokenu analīzes",
    "Piedalīšanās uz IDO — Initial DEX Offering",
    "Iknedēļas sazvani par jebkuru tēmu",
  ],
  joinTitle:
    "Ja Tu vēl neesi pievienojies mūsu privātajai grupai, to var izdarīt 2 veidos:",
  blurb:
    "Visvērtīgākā informācija ir pieejama mūsu Telegram „KriptoNr1 Private” grupā — ekskluzīvā kopienā ar ierobežotu piekļuvi, kur dalāmies ar padziļinātiem ieskatiem un iespējām.",
};

export const DISCLAIMER =
  "Mēs neesam finanšu padomdevēji un nesniedzam ieguldījumu rekomendācijas. Katrs ieguldīšanas lēmums un ar to saistītie riski pilnībā attiecas uz lēmumu pieņēmēju. Mēs vienkārši dalāmies ar savu pieredzi un zināšanām.";
