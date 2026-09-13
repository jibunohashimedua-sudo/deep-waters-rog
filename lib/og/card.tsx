/* eslint-disable @next/next/no-img-element -- @vercel/og renders with
   Satori, which only supports plain <img>; next/image cannot be used here. */
import { ImageResponse } from "@vercel/og";
import {
  ORIENT_SPECS,
  type Orient,
  type OrientSpec
} from "./orientations";
import {
  BACKGROUNDS,
  GROUND,
  INK,
  QUIET,
  RULE,
  isBackground,
  renderBackground,
  resolveBackground,
  type Background
} from "./backgrounds";

/**
 * The share card, in Fathom.
 *
 * Violet-black ground, ink at full strength, Literata for the scripture
 * and Plex Mono for everything that is a label or a number. Square
 * corners, no lift, no orbs, no blur. The mark sits small and quiet in
 * the corner with the wordmark beside it: branding present, not
 * dominating.
 *
 * Now composed per orientation and per background, not stretched. See
 * lib/og/orientations for the size + spacing per shape, and
 * lib/og/backgrounds for the marks that go behind the scripture.
 *
 * Shared by /api/og (a day kept) and /api/og/verse (a verse shared) so
 * the two cards cannot drift apart.
 */

// Default (backwards compatible with the pre-orientations card).
export const CARD_W = ORIENT_SPECS.portrait.w;
export const CARD_H = ORIENT_SPECS.portrait.h;

export type CardOptions = {
  orient?: Orient;
  bg?: Background | "random";
};

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
 * which is what produced "Unsupported OpenType signature <!DO" and took
 * the whole route down with it. Content type and size are both checked,
 * and a miss falls back to the system font rather than throwing.
 */
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
 * Fit the verse to the card, per shape.
 *
 * A psalm and a genealogy are not the same length, and one type size for
 * both means a card with six words rattling around it or one with the
 * last line running off the bottom. The spec chooses both the size
 * bracket and the length cap.
 */
export function fitVerse(text: string, spec: OrientSpec): { text: string; size: number } {
  const clean = text.replace(/\s+/g, " ").trim();

  let out = clean;
  if (clean.length > spec.maxChars) {
    const cut = clean.slice(0, spec.maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > spec.maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }

  const n = out.length;
  const bracket = spec.verseBrackets.find(([limit]) => n <= limit);
  const size = bracket ? bracket[1] : spec.verseBrackets[spec.verseBrackets.length - 1][1];
  return { text: out, size };
}

/** The four-bar mark, drawn in divs — Satori has no SVG path layout. */
function FourBarMark({
  colour = INK,
  depth,
  scale = 1
}: {
  colour?: string;
  depth?: number;
  scale?: number;
}) {
  const bars = [
    { w: 72 * scale, h: 12 * scale },
    { w: 54 * scale, h: 12 * scale },
    { w: 36 * scale, h: 12 * scale },
    { w: 18 * scale, h: 12 * scale }
  ];
  const fill = depth === undefined ? null : Math.max(0, Math.min(1, depth));
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8 * scale
      }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: b.w,
            height: b.h,
            borderRadius: b.h / 2,
            background: fill === null ? colour : RULE,
            overflow: "hidden"
          }}
        >
          {fill !== null && (
            <div
              style={{
                width: b.w * fill,
                height: b.h,
                borderRadius: b.h / 2,
                background: colour
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/** Mark + wordmark, small and quiet at the foot of the card. */
function Footer({
  spec,
  mono,
  depth
}: {
  spec: OrientSpec;
  mono: string;
  depth?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spec.footerGap,
        borderTop: `1px solid ${RULE}`,
        paddingTop: spec.footerRulePad
      }}
    >
      <FourBarMark colour={INK} depth={depth} scale={spec.footerBarScale} />
      <div
        style={{
          fontFamily: mono,
          fontSize: spec.footerWordSize,
          letterSpacing: "0.13em",
          color: QUIET
        }}
      >
        DEEP WATERS
      </div>
    </div>
  );
}

/** The outer shell. Always has the background layer behind the content. */
function CardShell({
  spec,
  serif,
  bg,
  children
}: {
  spec: OrientSpec;
  serif: string;
  bg: Background;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: spec.w,
        height: spec.h,
        background: GROUND
      }}
    >
      {renderBackground(bg, spec)}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: spec.w,
          height: spec.h,
          padding: `${spec.padT}px ${spec.padH}px ${spec.padB}px`,
          color: INK,
          fontFamily: serif
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A verse, shared. The scripture is the hero and everything else is a gauge. */
export async function verseCard(
  reference: string,
  text: string,
  day?: number,
  opts: CardOptions = {}
) {
  const orient: Orient = opts.orient ?? "portrait";
  const spec = ORIENT_SPECS[orient];
  const bg: Background = opts.bg === "random" || !opts.bg
    ? (opts.bg === "random" ? resolveBackground("random") : "plain")
    : (isBackground(opts.bg) ? opts.bg : "plain");
  const { fonts, serif, mono } = await loadCardFonts();
  const verse = fitVerse(text, spec);
  const depth = day && day > 0 ? Math.min(1, day / 90) : undefined;
  const ref = reference.replace(/\s+/g, " ").trim().toUpperCase();

  return new ImageResponse(
    (
      <CardShell spec={spec} serif={serif} bg={bg}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: verse.size,
              lineHeight: spec.verseLineHeight,
              color: INK
            }}
          >
            {verse.text}
          </div>
          <div
            style={{
              fontFamily: mono,
              fontSize: spec.refSize,
              letterSpacing: "0.13em",
              color: QUIET,
              marginTop: spec.refMarginTop
            }}
          >
            {ref || "DEEP WATERS"}
          </div>
        </div>

        <Footer spec={spec} mono={mono} depth={depth} />
      </CardShell>
    ),
    { width: spec.w, height: spec.h, fonts: fonts.length > 0 ? fonts : undefined }
  );
}

/** A day kept. Portrait only for now; unchanged shape. */
export async function dayCard(opts: {
  day: string;
  name: string;
  reference: string;
  text: string;
  photo: string;
}) {
  const spec = ORIENT_SPECS.portrait;
  const { fonts, serif, mono } = await loadCardFonts();
  const verse = opts.text ? fitVerse(opts.text, spec) : null;
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
      <CardShell spec={spec} serif={serif} bg="plain">
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

        <Footer spec={spec} mono={mono} depth={Math.min(1, (Number(opts.day) || 0) / 90)} />
      </CardShell>
    ),
    { width: spec.w, height: spec.h, fonts: fonts.length > 0 ? fonts : undefined }
  );
}

// Re-export so callers get a single import surface.
export { BACKGROUNDS, isBackground, resolveBackground } from "./backgrounds";
export type { Background } from "./backgrounds";
export { ORIENT_SPECS, isOrient } from "./orientations";
export type { Orient } from "./orientations";
