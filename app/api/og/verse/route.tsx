/* eslint-disable @next/next/no-img-element -- @vercel/og renders with
   Satori, which only supports plain <img>; next/image cannot be used here. */
import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

async function loadFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (type.includes("text/html")) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength < 1000) return null;
    return buf;
  } catch {
    return null;
  }
}

/**
 * Branded verse card. Called from ScriptureReader's "Image" action
 * with `?ref=Isaiah%203%3A1&text=…`. Returns a 1080×1350 PNG suitable
 * for Instagram / camera-roll saving.
 *
 * Design: same brand grammar as the completion share card, but centred
 * on the verse rather than the reader — no photo, no day-count.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const ref = searchParams.get("ref") ?? "";
  const text = searchParams.get("text") ?? "";
  const markUrl = `${origin}/deep-waters-mark-cream.png`;

  const [poppinsBold, poppinsRegular, serifRegular, serifItalic] = await Promise.all([
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-700-normal.ttf"),
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/poppins@latest/latin-400-normal.ttf"),
    loadFont(
      "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-400-normal.ttf"
    ),
    loadFont(
      "https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-400-italic.ttf"
    )
  ]);

  const fonts: {
    name: string;
    data: ArrayBuffer;
    weight: 400 | 700;
    style: "normal" | "italic";
  }[] = [];
  if (poppinsRegular)
    fonts.push({ name: "Poppins", data: poppinsRegular, weight: 400, style: "normal" });
  if (poppinsBold)
    fonts.push({ name: "Poppins", data: poppinsBold, weight: 700, style: "normal" });
  if (serifRegular)
    fonts.push({ name: "SourceSerif", data: serifRegular, weight: 400, style: "normal" });
  if (serifItalic)
    fonts.push({ name: "SourceSerif", data: serifItalic, weight: 400, style: "italic" });

  const hasSerif = fonts.some((f) => f.name === "SourceSerif");
  const scriptureFamily = hasSerif ? "SourceSerif" : "serif";
  const uiFamily = fonts.some((f) => f.name === "Poppins") ? "Poppins" : "sans-serif";

  // Auto-fit the verse to the card. Longer verses drop a step.
  const len = text.length;
  const verseSize =
    len < 90 ? 60 : len < 180 ? 52 : len < 280 ? 44 : len < 400 ? 38 : 32;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1080px",
          height: "1350px",
          display: "flex",
          flexDirection: "column",
          background: "#F7F1EA",
          fontFamily: uiFamily,
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
            padding: "60px 80px 70px",
            color: "white"
          }}
        >
          <img src={markUrl} width={120} height={120} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 22,
                letterSpacing: 6,
                color: "#E85D9E",
                fontWeight: 500
              }}
            >
              SCRIPTURE
            </div>
            <div
              style={{
                fontSize: 88,
                fontWeight: 700,
                lineHeight: 1,
                marginTop: 10
              }}
            >
              DEEP WATERS
            </div>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "80px 80px 40px",
            flex: 1
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: 56,
              background: "white",
              borderRadius: 32,
              border: "2px solid #E4DED6",
              flex: 1
            }}
          >
            <div
              style={{
                fontSize: 22,
                letterSpacing: 6,
                color: "#3B1E6E",
                fontWeight: 500,
                textTransform: "uppercase"
              }}
            >
              {ref}
            </div>
            <div
              style={{
                fontFamily: scriptureFamily,
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: verseSize,
                lineHeight: 1.4,
                color: "#0F0F0F",
                marginTop: 34,
                display: "flex"
              }}
            >
              “{text}”
            </div>
          </div>
        </div>

        {/* Purple footer */}
        <div
          style={{
            background: "#3B1E6E",
            color: "white",
            padding: "22px",
            fontSize: 18,
            fontWeight: 500,
            letterSpacing: 4,
            textAlign: "center",
            display: "flex",
            justifyContent: "center"
          }}
        >
          A 90 DAY BIBLE READING PLAN
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
