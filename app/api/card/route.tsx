import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Serve the font from our own /public so rendering needs no external network
// (next/og's default font is fetched from a remote CDN, which is slow/fragile).
async function loadFont(origin: string) {
  const res = await fetch(new URL("/NotoSans.ttf", origin));
  return res.arrayBuffer();
}

// Rocket badge (the app logo) inlined as an SVG data-URI so it renders with no
// network fetch. Matches public/logo.svg.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16285f"/><stop offset="1" stop-color="#0a1330"/></linearGradient><linearGradient id="r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a6e"/><stop offset="0.5" stop-color="#e2231a"/><stop offset="1" stop-color="#9e120c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#bg)"/><circle cx="13" cy="15" r="1.3" fill="#f5b50a"/><circle cx="51" cy="19" r="1" fill="#ffffff"/><circle cx="49" cy="47" r="1.2" fill="#f5b50a"/><g transform="rotate(45 32 32)"><path d="M32 8 C40 16 42 26 42 34 L22 34 C22 26 24 16 32 8 Z" fill="url(#r)"/><rect x="22" y="34" width="20" height="14" rx="4" fill="url(#r)"/><circle cx="32" cy="26" r="5" fill="#cfe8ff" stroke="#ffffff" stroke-width="1.5"/><path d="M22 42 L15 54 L22 50 Z" fill="#b51009"/><path d="M42 42 L49 54 L42 50 Z" fill="#b51009"/><path d="M27 48 L32 61 L37 48 Z" fill="#f5b50a"/></g></svg>`;
const LOGO_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

// Dynamic PnL / invite card (1200x630, OG + Farcaster friendly). Emoji-free so
// it renders entirely from the bundled font.
// Params: win=1|0, big=<hero text>, pct=<signed %>, sub=<one-liner>
export async function GET(req: Request) {
  const fontData = await loadFont(req.url);
  const { searchParams } = new URL(req.url);
  const win = searchParams.get("win") === "1";
  const big = (searchParams.get("big") ?? "X0").slice(0, 12);
  const pct = (searchParams.get("pct") ?? "").slice(0, 16);
  const sub = (searchParams.get("sub") ?? "").slice(0, 80);

  const accent = win ? "#2fe08a" : "#ff5a4d";
  const glow = win ? "rgba(47,224,138,0.5)" : "rgba(255,90,77,0.45)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px 64px",
          background:
            "radial-gradient(1000px 520px at 50% -10%, #16276b 0%, #04060f 62%), linear-gradient(180deg, #050713 0%, #04060f 100%)",
          color: "#eef2ff",
          fontFamily: "sans-serif",
        }}
      >
        {/* header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                gap: "12px",
                fontSize: "40px",
                fontWeight: 700,
                letterSpacing: "1px",
              }}
            >
              <span>KRIPTO</span>
              <span style={{ color: "#ff5a4d" }}>NR.1</span>
            </div>
            <div
              style={{
                fontSize: "17px",
                letterSpacing: "5px",
                color: "#5f6ea3",
                marginTop: "4px",
              }}
            >
              ROCKET LOTTERY
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: "999px",
              background: "#0052ff",
              fontSize: "24px",
              fontWeight: 700,
              letterSpacing: "1px",
            }}
          >
            BASE
          </div>
        </div>

        {/* hero: rocket + result */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "36px",
          }}
        >
          <img
            src={LOGO_URI}
            width={230}
            height={230}
            style={{ borderRadius: "40px" }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontSize: "168px",
                fontWeight: 800,
                lineHeight: 1,
                color: accent,
                textShadow: `0 0 70px ${glow}`,
              }}
            >
              {big}
            </div>
            {pct ? (
              <div
                style={{ fontSize: "58px", fontWeight: 700, color: accent }}
              >
                {pct}
              </div>
            ) : null}
          </div>
        </div>

        {/* invite CTA */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            borderRadius: "20px",
            background: "linear-gradient(180deg, #ff7a52, #e0231a)",
            fontSize: "34px",
            fontWeight: 800,
            letterSpacing: "1px",
            color: "#fff",
            boxShadow: "0 0 60px rgba(255,74,44,0.45)",
          }}
        >
          JOIN &amp; GET 1 FREE LAUNCH
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "24px",
            color: "#8b97c7",
          }}
        >
          <div style={{ display: "flex" }}>{sub}</div>
          <div style={{ display: "flex", color: accent, fontWeight: 700 }}>
            {win ? "TO THE MOON" : "TRY AGAIN"}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Noto Sans", data: fontData, weight: 400, style: "normal" },
      ],
    },
  );
}
