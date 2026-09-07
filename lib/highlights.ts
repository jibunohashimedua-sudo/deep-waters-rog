// The five highlight colours, plus shared types for highlights and notes.
//
// Fathom allows one second colour, and highlights are the one exception to
// it: they carry a reader's own meaning rather than decorating a screen.
// They are built inside the system's logic all the same — a tinted ground
// the verse sits on, a 2px coloured rule down its left edge, square corners,
// no shadow, no glow. None of the five is green, so sonar keeps its one job.
//
// The colours are named for the sounding instrument the mark comes from:
// Shoal, Current, Coral, Fathom, Silt.
//
// ── on the stored values ────────────────────────────────────────────────
// The `colour` column carries a CHECK constraint written when the palette
// was amber/mint/sky/rose/lavender, so those five strings are still what
// goes in and out of the database. Renaming them would mean a hand-run
// migration, and until it ran every new highlight would be rejected by the
// constraint. So the stored key stays legacy and the palette below gives it
// its Fathom name and colours. Nothing a reader sees says "amber".
// ────────────────────────────────────────────────────────────────────────

/** What the database stores. Do not change without migrating the CHECK. */
export type HighlightColour = "amber" | "sky" | "rose" | "lavender" | "mint";

export type HighlightPaint = {
  /** Fathom name, shown to the reader. */
  name: string;
  /** Tinted ground the verse sits on. */
  ground: string;
  /** 2px rule down the left edge, identifying the colour. */
  rule: string;
};

/** Display order, as the palette is written down. */
export const HIGHLIGHT_COLOURS: HighlightColour[] = [
  "amber",    // Shoal
  "sky",      // Current
  "rose",     // Coral
  "lavender", // Fathom
  "mint"      // Silt
];

export const HIGHLIGHT_LIGHT: Record<HighlightColour, HighlightPaint> = {
  amber:    { name: "Shoal",   ground: "#F0E4CE", rule: "#C9A45E" },
  sky:      { name: "Current", ground: "#D8E4F4", rule: "#1E5AA8" },
  rose:     { name: "Coral",   ground: "#F5DCDC", rule: "#B23A1F" },
  lavender: { name: "Fathom",  ground: "#E2DCF6", rule: "#3B23B8" },
  mint:     { name: "Silt",    ground: "#E4E2DC", rule: "#565E6D" }
};

export const HIGHLIGHT_DARK: Record<HighlightColour, HighlightPaint> = {
  amber:    { name: "Shoal",   ground: "#2A2114", rule: "#C9A45E" },
  sky:      { name: "Current", ground: "#14203A", rule: "#6FA8E8" },
  rose:     { name: "Coral",   ground: "#2E1618", rule: "#E8735A" },
  lavender: { name: "Fathom",  ground: "#221A3E", rule: "#A78BFF" },
  mint:     { name: "Silt",    ground: "#1E1D22", rule: "#8B87A3" }
};

/** The reader-facing name for a stored colour. */
export function highlightName(colour: HighlightColour): string {
  return HIGHLIGHT_LIGHT[colour]?.name ?? "Highlight";
}

/** True for a value the palette knows. Guards rows written by older builds. */
export function isHighlightColour(v: unknown): v is HighlightColour {
  return typeof v === "string" && v in HIGHLIGHT_LIGHT;
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
