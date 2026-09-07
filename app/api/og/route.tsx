import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

// Load a font, but never let a failed fetch crash the whole card.
// Google sometimes returns an HTML error page instead of the font file,
// which is what caused "Unsupported OpenType signature <!DO".
async function loadFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    // If Google handed us HTML, bail out.
    if (type.includes("text/html")) return null;
    const buf = await res.arrayBuffer();
    // A real font file is well over 1KB; an error page is tiny.
    if (buf.byteLength < 1000) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const day = searchParams.get("day") ?? "1";
  const name = searchParams.get("name") ?? "Reader";
  const verse = searchParams.get("verse") ?? "";
  const text = searchParams.get("text") ?? "";
  const photo = searchParams.get("photo") ?? "";
  const markUrl = `${origin}/deep-waters-mark-cream.png`;

  // Stable TTF sources. If both fail, we render with the system font.
  const [fontBold, fontRegular] = await Promise.all([
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-700-normal.ttf"),
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-normal.ttf")
  ]);

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] = [];
  if (fontRegular) fonts.push({ name: "Poppins", data: fontRegular, weight: 400, style: "normal" });
  if (fontBold) fonts.push({ name: "Poppins", data: fontBold, weight: 700, style: "normal" });

  const fontFamily = fonts.length > 0 ? "Poppins" : "sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1350px",
          display: "flex",
          flexDirection: "column",
          background: "#F7F1EA",
          fontFamily: fontFamily,
          position: "relative"
        }}
      >
        {/* Purple top with the mark */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 40,
            background: "#3B1E6E",
            padding: "60px 80px 80px",
            color: "white"
          }}
        >
          <img src={markUrl} width={140} height={140} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 6,
                color: "#E85D9E",
                fontWeight: 500
              }}
            >
              90 DAYS
            </div>
            <div
              style={{
                fontSize: 110,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 12
              }}
            >
              DEEP WATERS
            </div>
          </div>
        </div>
        {/* Blue bar */}
        <div style={{ height: 12, background: "#2E4FD1" }} />

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "60px 80px",
            flex: 1
          }}
        >
          {/* Photo */}
          {photo ? (
            <img
              src={photo}
              width={200}
              height={200}
              style={{
                borderRadius: 100,
                objectFit: "cover",
                border: "6px solid #E85D9E"
              }}
            />
          ) : (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: 100,
                background: "#F0D5C4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 80,
                color: "#3B1E6E",
                fontWeight: 700,
                border: "6px solid #E85D9E"
              }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}

          <div
            style={{
              fontSize: 20,
              letterSpacing: 4,
              color: "#E85D9E",
              marginTop: 40,
              fontWeight: 500
            }}
          >
            DAY {day} COMPLETE
          </div>
          <div
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "#3B1E6E",
              marginTop: 8,
              textAlign: "center"
            }}
          >
            {name}
          </div>

          {verse && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 50,
                padding: 40,
                background: "white",
                borderRadius: 24,
                width: "100%",
                border: "2px solid #E4DED6"
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  letterSpacing: 3,
                  color: "#E85D9E",
                  fontWeight: 500
                }}
              >
                VERSE OF THE DAY
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#3B1E6E",
                  marginTop: 10
                }}
              >
                {verse}
              </div>
              {text && (
                <div
                  style={{
                    fontSize: 24,
                    color: "#0F0F0F",
                    marginTop: 16,
                    fontStyle: "italic",
                    lineHeight: 1.5
                  }}
                >
                  &ldquo;{text.length > 180 ? text.slice(0, 180) + "..." : text}&rdquo;
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pink footer */}
        <div
          style={{
            background: "#E85D9E",
            color: "white",
            padding: "20px",
            fontSize: 20,
            fontWeight: 500,
            letterSpacing: 4,
            textAlign: "center",
            display: "flex",
            justifyContent: "center"
          }}
        >
          DEEP WATERS
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: fonts.length > 0 ? fonts : undefined
    }
  );
}
