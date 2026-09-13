/**
 * Shape options for the share image.
 *
 * A square, a portrait and a story. Each is a different composition, not
 * one drawing scaled — a story is more than twice as tall as it is wide,
 * and a square laid into it would float in the middle with dead space
 * above and below.
 *
 * Everything the card needs to change with the shape lives here: canvas
 * size, edge padding, the verse-length breakpoints that pick the type
 * size, the reference and footer sizes, the size of the mark. lib/og/card
 * reads a spec by name and renders inside it.
 */

export type Orient = "square" | "portrait" | "story";

export type OrientSpec = {
  /** Pixel dimensions of the exported image. Preview scales from these. */
  w: number;
  h: number;
  /** Symmetric horizontal edge padding. */
  padH: number;
  /** Top edge padding. */
  padT: number;
  /** Bottom edge padding. */
  padB: number;
  /** How many characters of the verse the card will hold before it clips
      with a marked ellipsis. Fewer on a square, more on a story. */
  maxChars: number;
  /** Verse-size brackets: `[maxCharsAtThisSize, sizePx]`. First matching
      bracket wins. Ordered smallest-length to largest. */
  verseBrackets: Array<[number, number]>;
  /** Line-height for the verse. Same across shapes today; kept per-shape
      so a future adjustment on one doesn't drag the others with it. */
  verseLineHeight: number;
  /** The mono reference under the verse. */
  refSize: number;
  refMarginTop: number;
  /** Footer mark bar scale — bar heights and gaps are multiplied by this
      so the mark reads at the same physical weight on each canvas. */
  footerBarScale: number;
  /** Footer wordmark type. */
  footerWordSize: number;
  /** Gap between the mark and the wordmark. */
  footerGap: number;
  /** Space above the footer's hairline rule. */
  footerRulePad: number;
};

export const ORIENT_SPECS: Record<Orient, OrientSpec> = {
  square: {
    w: 1080,
    h: 1080,
    padH: 88,
    padT: 88,
    padB: 76,
    // A square is the tightest shape; a long passage suffocates.
    maxChars: 380,
    verseBrackets: [[110, 72], [200, 60], [300, 48], [380, 40]],
    verseLineHeight: 1.44,
    refSize: 24,
    refMarginTop: 36,
    footerBarScale: 0.88,
    footerWordSize: 22,
    footerGap: 22,
    footerRulePad: 32
  },
  portrait: {
    w: 1080,
    h: 1350,
    padH: 88,
    padT: 88,
    padB: 80,
    maxChars: 560,
    verseBrackets: [[110, 72], [200, 60], [320, 50], [460, 42], [560, 36]],
    verseLineHeight: 1.44,
    refSize: 26,
    refMarginTop: 40,
    footerBarScale: 1,
    footerWordSize: 24,
    footerGap: 24,
    footerRulePad: 40
  },
  story: {
    // Instagram / WhatsApp story: 9:16, very tall. The scripture sits in
    // the upper half so it lands where the reader's eye rests; the mark
    // and the wordmark anchor the bottom, well clear of any UI overlay
    // that Stories draw on top.
    w: 1080,
    h: 1920,
    padH: 96,
    padT: 240,
    padB: 220,
    maxChars: 700,
    verseBrackets: [[120, 80], [220, 68], [360, 58], [500, 50], [700, 42]],
    verseLineHeight: 1.48,
    refSize: 28,
    refMarginTop: 48,
    footerBarScale: 1.1,
    footerWordSize: 26,
    footerGap: 26,
    footerRulePad: 48
  }
};

export function isOrient(v: unknown): v is Orient {
  return v === "square" || v === "portrait" || v === "story";
}
