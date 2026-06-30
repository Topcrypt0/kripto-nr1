import { ImageResponse } from "next/og";

export const runtime = "edge";
export const dynamic = "force-dynamic";

// Serve the font from our own /public so rendering needs no external network
// (next/og's default font is fetched from a remote CDN, which is slow/fragile).
async function loadFont(origin: string) {
  const res = await fetch(new URL("/NotoSans.ttf", origin));
  return res.arrayBuffer();
}

// Dynamic PnL share card (1200x630, OG/Farcaster friendly). Kept emoji-free so
// it renders entirely from the bundled font (no remote glyph fetches).
// Params: win=1|0, big=<hero text>, pct=<signed %>, sub=<one-liner>
export async function GET(req: Request) {
  const fontData = await loadFont(req.url);
  const { searchParams } = new URL(req.url);
  const win = searchParams.get("win") === "1";
  const big = (searchParams.get("big") ?? "X0").slice(0, 12);
  const pct = (searchParams.get("pct") ?? "").slice(0, 16);
  const sub = (searchParams.get("sub") ?? "").slice(0, 80);

  const accent = win ? "#2fe08a" : "#ff5a4d";
  const glow = win ? "rgba(47,224,138,0.55)" : "rgba(255,90,77,0.5)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "62px 72px",
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
          <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "62px",
                height: "62px",
                borderRadius: "16px",
                background: "linear-gradient(180deg, #ff7a52, #e0231a)",
                fontSize: "30px",
                fontWeight: 800,
                color: "#fff",
              }}
            >
              K1
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  fontSize: "36px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                }}
              >
                <span>KRIPTO</span>
                <span style={{ color: "#ff5a4d" }}>NR.1</span>
              </div>
              <div
                style={{
                  fontSize: "16px",
                  letterSpacing: "4px",
                  color: "#5f6ea3",
                  marginTop: "4px",
                }}
              >
                ROCKET LOTTERY
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "9px 18px",
              borderRadius: "999px",
              background: "#0052ff",
              fontSize: "22px",
              fontWeight: 700,
              letterSpacing: "1px",
            }}
          >
            BASE
          </div>
        </div>

        {/* hero result */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              fontSize: "230px",
              fontWeight: 800,
              lineHeight: 1,
              color: accent,
              textShadow: `0 0 80px ${glow}`,
            }}
          >
            {big}
          </div>
          {pct ? (
            <div
              style={{
                marginTop: "10px",
                fontSize: "66px",
                fontWeight: 700,
                color: accent,
              }}
            >
              {pct}
            </div>
          ) : null}
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "26px",
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
