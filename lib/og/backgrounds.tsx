/* eslint-disable @next/next/no-img-element -- Satori-only file. */
import type { CSSProperties, ReactNode } from "react";
import type { OrientSpec } from "./orientations";

/**
 * Backgrounds for the share card.
 *
 * Every background is built from divs and gradients only — the same
 * primitives lib/og/card is built from — because Satori (what @vercel/og
 * uses) does not lay out SVG paths. That constraint is a good thing: it
 * keeps the compositions inside the Fathom system, which is where they
 * belong. No photography, no imagery of people or places, no glow.
 *
 * Every background carries its own composition per shape rather than one
 * drawing cropped three ways. The specs live here, not in card.tsx,
 * because the card should not know how to draw a plumb line — it should
 * know how to ask for one at the right scale.
 *
 * Legibility is the rule: the scripture is always painted on the ground,
 * so the ground has to stay quiet. Every added mark sits well outside
 * the type area (a padH-wide margin on the left and right, a padT-tall
 * margin at the top) or fades to near-transparency where the mark meets
 * the type. Tested against the longest verse we are likely to share.
 */

// Fathom, dark, on every card. A share image goes out into other people's
// feeds where a themed page can't. Constants match lib/og/card.tsx.
export const GROUND = "#0C0A18";
export const INK = "#E9E6F2";
export const QUIET = "#8B87A3";
export const RULE = "#262239";
// The accent, only ever used as a hairline. Never a fill.
const ACCENT = "#A78BFF";

export type Background = "plain" | "sounding" | "plumb" | "tide";

export const BACKGROUNDS: Background[] = ["plain", "sounding", "plumb", "tide"];

export function isBackground(v: unknown): v is Background {
  return v === "plain" || v === "sounding" || v === "plumb" || v === "tide";
}

/** Human label, shown in the picker. */
export const BACKGROUND_LABEL: Record<Background, string> = {
  plain: "Plain",
  sounding: "Sounding",
  plumb: "Plumb",
  tide: "Tide"
};

/** Resolve "random" (or anything unrecognised) into a real background. */
export function resolveBackground(v: unknown): Background {
  if (isBackground(v)) return v;
  return BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)];
}

/**
 * Render the background layer.
 *
 * Returned as one absolute-positioned element that spans the whole card
 * behind the content div. Every mark inside it is authored per orientation
 * so a square, a portrait and a story each get a composition that reads
 * for that shape.
 */
export function renderBackground(bg: Background, spec: OrientSpec): ReactNode {
  const layerStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    // Satori requires an explicit display value on every flex container.
    flexDirection: "column",
    pointerEvents: "none"
  };

  switch (bg) {
    case "plain":
      return <div style={layerStyle} />;
    case "sounding":
      return <div style={layerStyle}>{sounding(spec)}</div>;
    case "plumb":
      return <div style={layerStyle}>{plumb(spec)}</div>;
    case "tide":
      return <div style={layerStyle}>{tide(spec)}</div>;
  }
}

// ---------- Individual backgrounds ----------

/**
 * A horizontal sounding rule near the top edge — a hairline with a row of
 * short vertical ticks descending from it, the way a depth ruler prints
 * along the deck of a chart. Sits well above the verse type on every
 * shape and never crosses it.
 */
function sounding(spec: OrientSpec): ReactNode {
  // How far in from each edge the sounding rule runs. Uses padH so it
  // aligns with the content column below.
  const inset = spec.padH;
  // The rule sits half-way up the top padding on portrait/square, and
  // higher up on story where the top padding is huge.
  const y = spec.h >= 1600 ? Math.round(spec.padT * 0.42) : Math.round(spec.padT * 0.55);

  const runWidth = spec.w - inset * 2;
  const majorEvery = Math.round(runWidth / 8);
  const ticks: ReactNode[] = [];
  for (let i = 0; i <= 8; i++) {
    const isMajor = i % 2 === 0;
    ticks.push(
      <div
        key={i}
        style={{
          display: "flex",
          position: "absolute",
          left: i * majorEvery,
          top: 0,
          width: 1,
          height: isMajor ? 16 : 10,
          background: RULE
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: inset,
        top: y,
        width: runWidth,
        height: 24
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: runWidth,
          height: 1,
          background: RULE
        }}
      />
      {ticks}
    </div>
  );
}

/**
 * A vertical plumb line down the left edge, with graduated marks at
 * fathom intervals. Sits in the outer edge margin, clear of the verse
 * measure. On a story the marks run further because the canvas is taller.
 */
function plumb(spec: OrientSpec): ReactNode {
  // A generous outer margin from the very edge, and well inside the
  // horizontal padding so the rule never crowds the type.
  const x = Math.round(spec.padH * 0.42);
  const top = spec.padT;
  const bottom = spec.h - spec.padB;
  const runHeight = bottom - top;

  // Six marks total on every shape — the eye reads them as one rhythm
  // regardless of how tall the canvas is.
  const marks = 6;
  const step = runHeight / (marks - 1);
  const dots: ReactNode[] = [];
  for (let i = 0; i < marks; i++) {
    const isMajor = i === 0 || i === marks - 1 || i === Math.floor(marks / 2);
    dots.push(
      <div
        key={i}
        style={{
          display: "flex",
          position: "absolute",
          left: -6,
          top: Math.round(i * step),
          width: isMajor ? 14 : 8,
          height: 1,
          background: RULE
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: x,
        top,
        width: 14,
        height: runHeight
      }}
    >
      {/* The plumb itself, one hairline. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 0,
          top: 0,
          width: 1,
          height: runHeight,
          background: RULE
        }}
      />
      {dots}
      {/* The bob at the bottom, a small square rather than a drawn shape,
          because Satori draws rectangles. Fills with the accent to
          signal position — the one place the accent appears on the card. */}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: -3,
          top: runHeight - 8,
          width: 8,
          height: 8,
          background: ACCENT
        }}
      />
    </div>
  );
}

/**
 * A soft vertical gradient — a hint of surface tone at the top fading into
 * the deeper violet-black at the bottom. Reads as looking down into water.
 * Every stop is close in luminance so the type never has to fight for
 * contrast: the deepest tone at the far edges is only a few points off
 * the base ground.
 */
function tide(spec: OrientSpec): ReactNode {
  // The exact stops read as a very gentle darkening from top to bottom.
  // Kept well inside the ground's own family so ink stays comfortably
  // legible everywhere.
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        inset: 0,
        background:
          "linear-gradient(180deg, #171233 0%, #100C22 40%, #0C0A18 80%, #08061A 100%)"
      }}
    />
  );
}
