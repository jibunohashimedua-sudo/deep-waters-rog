// The five highlight colours, plus shared types for highlights and notes.
//
// Fathom allows one second colour, and highlights are the one exception to
// it: they carry a reader's own meaning rather than decorating a screen.
// They are built inside the system's logic all the same — a tinted ground
// the verse sits on, a 2px coloured rule down its left edge, square corners,
// no lift, no glow. None of the five is green, so sonar keeps its one job.
//
// They are named for the sounding instrument the mark comes from, and those
// names go all the way down: the database stores 'shoal', not 'amber'. The
// old names were marker-pen names, and one of them — mint, for what is now
// a neutral grey — had stopped being true at all.
//
// See supabase/migrations/2026_09_07_highlight_colour_names.sql.

/** What the database stores, and what a reader is shown. */
export type HighlightColour =
  | "shoal"
  | "current"
  | "coral"
  | "beacon"
  | "fathom"
  | "silt";

export type HighlightPaint = {
  /** The name, shown to the reader. */
  name: string;
  /** Tinted ground the verse sits on, and the 2px rule down its left edge. */
  light: { ground: string; rule: string };
  dark: { ground: string; rule: string };
};

/** Display order, as the palette is written down. Beacon sits between the
    two warm marks (coral) and the violet mark (fathom) — a pink light on
    the shore between the two, and the order the eye reads them on the
    picker moves left-to-right through the spectrum. */
export const HIGHLIGHT_COLOURS: HighlightColour[] = [
  "shoal",
  "current",
  "coral",
  "beacon",
  "fathom",
  "silt"
];

/**
 * The palette of record.
 *
 * globals.css carries the same ten values as custom properties, because the
 * painting is done in CSS — an attribute selector per colour, so a verse
 * changes colour without a style attribute being written to it. These are
 * here so the values live somewhere legible next to their names, and so the
 * two can be checked against each other by eye.
 *
 * Ink stays at full strength on every one. Measured: the worst of the ten
 * is Shoal in dark at 12.87:1, against a 7:1 floor.
 */
export const HIGHLIGHT_PAINT: Record<HighlightColour, HighlightPaint> = {
  shoal: {
    name: "Shoal",
    light: { ground: "#F0E4CE", rule: "#C9A45E" },
    dark:  { ground: "#2A2114", rule: "#C9A45E" }
  },
  current: {
    name: "Current",
    light: { ground: "#D8E4F4", rule: "#1E5AA8" },
    dark:  { ground: "#14203A", rule: "#6FA8E8" }
  },
  coral: {
    name: "Coral",
    light: { ground: "#F5DCDC", rule: "#B23A1F" },
    dark:  { ground: "#2E1618", rule: "#E8735A" }
  },
  beacon: {
    // A pink light on the shore. Distinct from Coral (red) on the axis a
    // deuteranope loses: pink carries a blue channel that red does not,
    // which is what keeps the two apart when green sensitivity drops.
    // Ink on both grounds measures well above the 7:1 floor.
    name: "Beacon",
    light: { ground: "#F5DCE6", rule: "#A83466" },
    dark:  { ground: "#2A1421", rule: "#F19BC4" }
  },
  fathom: {
    name: "Fathom",
    light: { ground: "#E2DCF6", rule: "#3B23B8" },
    dark:  { ground: "#221A3E", rule: "#A78BFF" }
  },
  silt: {
    name: "Silt",
    light: { ground: "#E4E2DC", rule: "#565E6D" },
    dark:  { ground: "#1E1D22", rule: "#8B87A3" }
  }
};

/** The reader-facing name for a colour. */
export function highlightName(colour: HighlightColour): string {
  return HIGHLIGHT_PAINT[colour]?.name ?? "Highlight";
}

/**
 * What the retired names meant.
 *
 * The migration renames every row, so in a settled database nothing here is
 * ever hit. It stays because a database migration and a deploy are two
 * events and not one: a highlight written by the previous build in the
 * minutes between them arrives carrying an old name, and the honest thing
 * to do with it is show it in the colour the reader actually chose rather
 * than drop it on the floor.
 */
const RETIRED: Record<string, HighlightColour> = {
  amber: "shoal",
  sky: "current",
  rose: "coral",
  lavender: "fathom",
  mint: "silt"
};

/**
 * Read a stored colour, whatever vintage it is.
 *
 * Returns null for anything the palette has never known, so a row written
 * by hand or by some future build can be counted and reported rather than
 * silently painted the wrong colour.
 */
export function normaliseHighlightColour(v: unknown): HighlightColour | null {
  if (typeof v !== "string") return null;
  if (v in HIGHLIGHT_PAINT) return v as HighlightColour;
  return RETIRED[v] ?? null;
}

export type Highlight = {
  id: string;
  user_id: string;
  day_number: number;
  testament: "ot" | "nt";
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  colour: HighlightColour;
  created_at: string;
};

export type VerseNote = {
  id: string;
  user_id: string;
  day_number: number;
  testament: "ot" | "nt";
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  verse_text: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

/** Human-readable reference like "Genesis 1:3" or "Isaiah 3:1–5". */
export function formatVerseReference(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number
): string {
  if (verseEnd > verseStart) {
    return `${book} ${chapter}:${verseStart}–${verseEnd}`;
  }
  return `${book} ${chapter}:${verseStart}`;
}

/**
 * A reference for a set of verses that may have gaps in it.
 *
 * Tapping verses one at a time makes non-contiguous selections ordinary, and
 * a range is a claim about the text: "Psalm 42:3–7" says five verses when the
 * reader picked two. Runs are collapsed, gaps are kept:
 *
 *   [3]        -> "Psalm 42:3"
 *   [3,4,5]    -> "Psalm 42:3–5"
 *   [3,7]      -> "Psalm 42:3,7"
 *   [3,4,5,9]  -> "Psalm 42:3–5,9"
 */
export function formatVerseList(
  book: string,
  chapter: number,
  verses: number[]
): string {
  const sorted = Array.from(new Set(verses)).sort((a, b) => a - b);
  if (sorted.length === 0) return `${book} ${chapter}`;

  const parts: string[] = [];
  let runStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    const v = sorted[i];
    if (v === prev + 1) {
      prev = v;
      continue;
    }
    parts.push(runStart === prev ? `${runStart}` : `${runStart}–${prev}`);
    runStart = v;
    prev = v;
  }
  return `${book} ${chapter}:${parts.join(",")}`;
}
