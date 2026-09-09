/* eslint-disable @next/next/no-img-element -- @vercel/og renders with
   Satori, which only supports plain <img>; next/image cannot be used here. */
import { ImageResponse } from "@vercel/og";

/**
 * The share card, in Fathom.
 *
 * Violet-black ground, ink at full strength, Literata for the scripture and
 * Plex Mono for everything that is a label or a number. Square corners, no
 * lift, no orbs, no blur. The mark sits small and quiet in the corner
 * with the wordmark beside it: branding present, not dominating.
 *
 * Shared by /api/og (a day kept) and /api/og/verse (a verse shared) so the
 * two cards cannot drift apart.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

// Fathom, dark. A share card is always dark — it goes out into other
// people's feeds, where it is one image and not a themed page.
const GROUND = "#0C0A18";
const INK = "#E9E6F2";
const QUIET = "#8B87A3";
const RULE = "#262239";

type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

/**
 * Load a font, but never let a failed fetch crash the whole card.
 *
 * Google sometimes returns an HTML error page instead of the font file,
 * which is what produced "Unsupported OpenType signature <!DO" and took the
 * whole route down with it. Content type and size are both checked, and a
 * miss falls back to the system font rather than throwing.
 */
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

/** Stable TTF sources. If they all fail, the card renders in system fonts. */
export async function loadCardFonts(): Promise<{
  fonts: LoadedFont[];
  serif: string;
  mono: string;
}> {
  const [literata, literataSemi, plexMono] = await Promise.all([
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/literata@latest/latin-400-normal.ttf"),
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/literata@latest/latin-600-normal.ttf"),
    loadFont("https://cdn.jsdelivr.net/fontsource/fonts/ibm-plex-mono@latest/latin-400-normal.ttf")
  ]);

  const fonts: LoadedFont[] = [];
  if (literata) fonts.push({ name: "Literata", data: literata, weight: 400, style: "normal" });
  if (literataSemi) fonts.push({ name: "Literata", data: literataSemi, weight: 600, style: "normal" });
  if (plexMono) fonts.push({ name: "IBM Plex Mono", data: plexMono, weight: 400, style: "normal" });

  return {
    fonts,
    serif: literata ? "Literata" : "serif",
    mono: plexMono ? "IBM Plex Mono" : "monospace"
  };
}

/**
 * Fit the verse to the card.
 *
 * A psalm and a genealogy are not the same length, and one type size for
 * both means either a card with six words rattling around it or one with
 * the last line running off the bottom. Long passages are cut at a word
 * boundary rather than mid-syllable, and the cut is marked, because a
 * quotation that stops without saying so is a misquotation.
 */
export function fitVerse(text: string): { text: string; size: number } {
  const clean = text.replace(/\s+/g, " ").trim();
  const LIMIT = 560;

  let out = clean;
  if (clean.length > LIMIT) {
    const cut = clean.slice(0, LIMIT);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > LIMIT * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }

  const n = out.length;
  const size = n <= 110 ? 72 : n <= 200 ? 60 : n <= 320 ? 50 : n <= 460 ? 42 : 36;
  return { text: out, size };
}

/** The four-bar mark, drawn in divs — Satori has no SVG path layout. */
function FourBarMark({ colour = INK }: { colour?: string }) {
  // The brand mark's own proportions, scaled up a little for a 1080px
  // card: at the drawn size the four bars closed up into one shape.
  const bars = [
    { w: 72, h: 12 },
    { w: 54, h: 12 },
    { w: 36, h: 12 },
    { w: 18, h: 12 }
  ];
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8
      }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            width: b.w,
            height: b.h,
            // The bars are the one round thing on the card, because they
            // are the mark and the mark is drawn that way.
            borderRadius: b.h / 2,
            background: colour
          }}
        />
      ))}
    </div>
  );
}

/** Mark + wordmark, small and quiet in the bottom corner. */
function Footer({ mono }: { mono: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        borderTop: `1px solid ${RULE}`,
        paddingTop: 40
      }}
    >
      <FourBarMark colour={QUIET} />
      <div
        style={{
          fontFamily: mono,
          fontSize: 24,
          letterSpacing: "0.13em",
          color: QUIET
        }}
      >
        DEEP WATERS
      </div>
    </div>
  );
}

const shell = (serif: string): React.CSSProperties => ({
  width: `${CARD_W}px`,
  height: `${CARD_H}px`,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  background: GROUND,
  color: INK,
  fontFamily: serif,
  padding: "88px 88px 80px"
});

/** A verse, shared. The scripture is the hero and everything else is a gauge. */
export async function verseCard(reference: string, text: string) {
  const { fonts, serif, mono } = await loadCardFonts();
  const verse = fitVerse(text);
  // A reference is metadata, so it is set as metadata. Ranges like
  // "Psalm 42:1–4" come through whole — nothing here parses them.
  const ref = reference.replace(/\s+/g, " ").trim().toUpperCase();

  return new ImageResponse(
    (
      <div style={shell(serif)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.13em",
              color: QUIET,
              paddingBottom: 36,
              borderBottom: `1px solid ${RULE}`
            }}
          >
            {ref || "DEEP WATERS"}
          </div>
          <div
            style={{
              marginTop: 64,
              fontSize: verse.size,
              lineHeight: 1.44,
              color: INK
            }}
          >
            {verse.text}
          </div>
        </div>

        <Footer mono={mono} />
      </div>
    ),
    { width: CARD_W, height: CARD_H, fonts: fonts.length > 0 ? fonts : undefined }
  );
}

/** A day kept. The person's name leads; the verse they wrote down follows. */
export async function dayCard(opts: {
  day: string;
  name: string;
  reference: string;
  text: string;
  photo: string;
}) {
  const { fonts, serif, mono } = await loadCardFonts();
  const verse = opts.text ? fitVerse(opts.text) : null;
  // Up to two initials, the same as the portrait everywhere else in the
  // app — one letter reads as a placeholder, two read as a person.
  const parts = opts.name.trim().split(/\s+/).filter(Boolean);
  const initial = (
    parts.length === 0
      ? "?"
      : parts.length === 1
      ? parts[0].charAt(0)
      : parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
  ).toUpperCase();

  return new ImageResponse(
    (
      <div style={shell(serif)}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 26,
              letterSpacing: "0.13em",
              color: QUIET,
              paddingBottom: 36,
              borderBottom: `1px solid ${RULE}`
            }}
          >
            {`DAY ${opts.day} OF 90 · KEPT`}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 36, marginTop: 64 }}>
            {/* Square, like every portrait in the app. A person is not a
                button, so nothing about them is a pill. */}
            {opts.photo ? (
              <img
                src={opts.photo}
                alt=""
                width={140}
                height={140}
                style={{ width: 140, height: 140, objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 140,
                  height: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `1px solid ${RULE}`,
                  fontFamily: mono,
                  fontSize: 52,
                  letterSpacing: "0.08em",
                  color: QUIET
                }}
              >
                {initial}
              </div>
            )}
            <div style={{ fontSize: 64, lineHeight: 1.15, color: INK }}>
              {opts.name}
            </div>
          </div>

          {verse && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
              <div style={{ fontSize: verse.size, lineHeight: 1.44, color: INK }}>
                {verse.text}
              </div>
              {opts.reference && (
                <div
                  style={{
                    marginTop: 32,
                    fontFamily: mono,
                    fontSize: 24,
                    letterSpacing: "0.13em",
                    color: QUIET
                  }}
                >
                  {opts.reference.toUpperCase()}
                </div>
              )}
            </div>
          )}
        </div>

        <Footer mono={mono} />
      </div>
    ),
    { width: CARD_W, height: CARD_H, fonts: fonts.length > 0 ? fonts : undefined }
  );
}
