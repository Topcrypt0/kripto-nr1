import { ImageResponse } from "next/og";
import { appUrl } from "@/lib/miniapp";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Same self-hosted font strategy as /api/card — no external network needed.
async function loadFont(reqUrl: string) {
  const configured = appUrl();
  const origin = configured.includes("localhost")
    ? new URL(reqUrl).origin
    : configured;
  const res = await fetch(new URL("/NotoSans.ttf", origin));
  return res.arrayBuffer();
}

// Query input is attacker-controlled; strip control/bidi characters.
const clean = (s: string, max: number) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    .slice(0, max);

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#16285f"/><stop offset="1" stop-color="#0a1330"/></linearGradient><linearGradient id="r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7a6e"/><stop offset="0.5" stop-color="#e2231a"/><stop offset="1" stop-color="#9e120c"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#bg)"/><circle cx="13" cy="15" r="1.3" fill="#f5b50a"/><circle cx="51" cy="19" r="1" fill="#ffffff"/><circle cx="49" cy="47" r="1.2" fill="#f5b50a"/><g transform="rotate(45 32 32)"><path d="M32 8 C40 16 42 26 42 34 L22 34 C22 26 24 16 32 8 Z" fill="url(#r)"/><rect x="22" y="34" width="20" height="14" rx="4" fill="url(#r)"/><circle cx="32" cy="26" r="5" fill="#cfe8ff" stroke="#ffffff" stroke-width="1.5"/><path d="M22 42 L15 54 L22 50 Z" fill="#b51009"/><path d="M42 42 L49 54 L42 50 Z" fill="#b51009"/><path d="M27 48 L32 61 L37 48 Z" fill="#f5b50a"/></g></svg>`;
const LOGO_URI = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

// Rocket-branded position share card (1200x630), Hyperliquid-style:
// coin + LONG/SHORT Nx badge, big PnL %, entry/mark prices, referral link.
// Params: coin, side=long|short, lev, pnl (signed %), entry, mark, ref
export async function GET(req: Request) {
  const fontData = await loadFont(req.url);
  const { searchParams } = new URL(req.url);
  const coin = clean(searchParams.get("coin") ?? "BTC", 12).toUpperCase();
  const isLong = (searchParams.get("side") ?? "long") !== "short";
  const lev = clean(searchParams.get("lev") ?? "", 4);
  const pnl = clean(searchParams.get("pnl") ?? "+0.0%", 12);
  const entry = clean(searchParams.get("entry") ?? "", 16);
  const mark = clean(searchParams.get("mark") ?? "", 16);
  const ref = clean(searchParams.get("ref") ?? "", 46);

  const win = !pnl.startsWith("-");
  const accent = win ? "#2fe08a" : "#ff5a4d";
  const glow = win ? "rgba(47,224,138,0.45)" : "rgba(255,90,77,0.4)";
  const sideColor = isLong ? "#2fe08a" : "#ff5a4d";
  const site = appUrl().replace(/^https?:\/\//, "");
  const link = ref ? `${site}/?ref=${ref}` : site;

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
        {/* header: brand + product */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URI} width={84} height={84} alt="" />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "42px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                }}
              >
                KRIPTO NR.1
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "20px",
                  letterSpacing: "6px",
                  color: "#8b97c7",
                }}
              >
                PERPS · HYPERLIQUID
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "34px",
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>{coin}</div>
            <div
              style={{
                display: "flex",
                padding: "8px 22px",
                borderRadius: "14px",
                fontSize: "28px",
                color: "#04060f",
                background: sideColor,
              }}
            >
              {isLong ? "LONG" : "SHORT"}
              {lev ? ` ${lev}×` : ""}
            </div>
          </div>
        </div>

        {/* hero PnL */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: "170px",
              fontWeight: 700,
              lineHeight: 1,
              color: accent,
              textShadow: `0 0 80px ${glow}`,
            }}
          >
            {pnl}
          </div>
          <div
            style={{
              display: "flex",
              gap: "56px",
              marginTop: "34px",
              fontSize: "28px",
              color: "#aab4dd",
            }}
          >
            {entry ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", color: "#5f6ea3", fontSize: "20px", letterSpacing: "2px" }}>
                  ENTRY PRICE
                </div>
                <div style={{ display: "flex", fontSize: "34px", color: "#eef2ff" }}>{entry}</div>
              </div>
            ) : null}
            {mark ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", color: "#5f6ea3", fontSize: "20px", letterSpacing: "2px" }}>
                  MARK PRICE
                </div>
                <div style={{ display: "flex", fontSize: "34px", color: "#eef2ff" }}>{mark}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* footer: referral link */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: "30px",
            borderTop: "2px solid rgba(255,255,255,0.12)",
            fontSize: "26px",
          }}
        >
          <div style={{ display: "flex", color: "#8b97c7" }}>
            Swap · Perps · Predictions · Rocket Lottery
          </div>
          <div style={{ display: "flex", color: "#f5b50a", fontWeight: 700 }}>
            {link}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: "sans-serif", data: fontData, style: "normal" }],
      headers: { "cache-control": "public, max-age=300" },
    },
  );
}
