// The five highlight colours + shared types for highlights and verse notes.
// Colours are low-opacity so scripture stays legible in light AND dark mode.

export type HighlightColour = "amber" | "mint" | "sky" | "rose" | "lavender";

export const HIGHLIGHT_COLOURS: HighlightColour[] = [
  "amber",
  "mint",
  "sky",
  "rose",
  "lavender"
];

// CSS variables — defined in globals.css so the same swatch reads
// correctly on the cream light ground and the deep dark ground.
export const HIGHLIGHT_CSS: Record<HighlightColour, string> = {
  amber:    "var(--hl-amber)",
  mint:     "var(--hl-mint)",
  sky:      "var(--hl-sky)",
  rose:     "var(--hl-rose)",
  lavender: "var(--hl-lavender)"
};

// Swatch colours for the toolbar UI (solid, opaque enough to see).
export const HIGHLIGHT_SWATCH: Record<HighlightColour, string> = {
  amber:    "#F0C36A",
  mint:     "#8FD3B3",
  sky:      "#8FBBE6",
  rose:     "#F2A6B6",
  lavender: "#C1AFE8"
};

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
