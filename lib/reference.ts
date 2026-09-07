/**
 * Parse a reference the way someone types it mid-service.
 *
 * "John 3:16", "jn 3:16", "Ps 23", "1 cor 13:4", "Genesis 1:1-5" all arrive
 * here and come out the other side as a book, a chapter, and optionally a
 * verse or verse range. This is meant to be the fastest path in the whole
 * Bible feature — someone hears a reference read aloud and has perhaps three
 * seconds to type it — so it forgives everything it safely can: any spacing,
 * any capitalisation, abbreviations, a full stop instead of a colon, and an
 * en dash instead of a hyphen because that is what phone keyboards produce.
 *
 * What it deliberately does NOT forgive is a chapter that doesn't exist. If
 * someone types "Genesis 99" we return null rather than clamping to 50 and
 * sending them somewhere they didn't ask for. The caller then falls back to
 * showing book matches, which is the honest response to a reference we can't
 * honour.
 */

import { BIBLE_BOOKS, searchBooks, type BibleBook } from "./bibleBooks";

export type ParsedReference = {
  book: BibleBook;
  chapter: number;
  /** Undefined for a whole-chapter reference like "Ps 23". */
  verseStart?: number;
  /** Only set for a range; a single verse leaves this undefined. */
  verseEnd?: number;
};

/**
 * Book text, then chapter, then an optional verse or verse range.
 *
 * The book group is lazy on purpose. Given "1 cor 13" the engine first tries
 * to end the book at "1", finds "cor" where it needs digits, and backtracks
 * until the book is "1 cor" and the chapter is 13 — which is exactly the
 * reading we want, and it falls out of the grammar rather than needing a
 * special case for the numbered books.
 *
 * Separators: ":" or "." between chapter and verse, "-" or "–" for a range.
 */
const REFERENCE_RE =
  /^(.+?)\s*(\d+)\s*(?:[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?$/;

/** Strip everything that isn't a letter or digit, matching bibleBooks. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const BY_EXACT = new Map<string, BibleBook>();
for (const book of BIBLE_BOOKS) {
  BY_EXACT.set(normalise(book.name), book);
  BY_EXACT.set(normalise(book.slug), book);
  BY_EXACT.set(normalise(book.abbr), book);
  for (const alias of book.aliases) BY_EXACT.set(normalise(alias), book);
}

/**
 * Turn the book half of a reference into a book.
 *
 * An exact name, slug, abbreviation or alias wins outright. Failing that we
 * fall back to the ranked search, but only accept a prefix-quality match —
 * score 3 or better. A "contains" match is good enough to filter a visible
 * list, where the reader can see what came back and choose, but not good
 * enough to navigate on: "us" appears inside Exodus, Leviticus, Numbers and
 * Deuteronomy, and jumping to whichever sorts first would be a guess wearing
 * the costume of an answer.
 */
function resolveBook(token: string): BibleBook | null {
  const key = normalise(token);
  if (!key) return null;

  const exact = BY_EXACT.get(key);
  if (exact) return exact;

  // A single letter is too little to go on — "j" is John, Jonah, Job, Jude,
  // James, Judges, Jeremiah, Joel and Joshua.
  if (key.length < 2) return null;

  const [best] = searchBooks(token);
  if (!best) return null;

  const name = normalise(best.name);
  const slug = normalise(best.slug);
  const prefixed =
    name.startsWith(key) ||
    slug.startsWith(key) ||
    best.aliases.some((a) => normalise(a).startsWith(key));

  return prefixed ? best : null;
}

/**
 * Parse a typed reference. Returns null when the text isn't a reference at
 * all (so the caller can treat it as a book search instead), or when it names
 * a chapter or verse that can't exist.
 */
export function parseReference(input: string): ParsedReference | null {
  const text = input.trim();
  if (!text) return null;

  const m = REFERENCE_RE.exec(text);
  if (!m) return null;

  const [, bookText, chapterText, verseText, verseEndText] = m;

  const book = resolveBook(bookText);
  if (!book) return null;

  const chapter = Number.parseInt(chapterText, 10);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) {
    return null;
  }

  if (verseText === undefined) return { book, chapter };

  const first = Number.parseInt(verseText, 10);
  if (!Number.isFinite(first) || first < 1) return null;

  if (verseEndText === undefined) {
    return { book, chapter, verseStart: first };
  }

  const second = Number.parseInt(verseEndText, 10);
  if (!Number.isFinite(second) || second < 1) return null;

  // "John 3:18-16" is a typo, not an error worth refusing — read it the way
  // it was obviously meant.
  const start = Math.min(first, second);
  const end = Math.max(first, second);

  // A range of one is just a verse; keeping it as a range would put a
  // pointless "16-16" in the URL.
  if (start === end) return { book, chapter, verseStart: start };

  return { book, chapter, verseStart: start, verseEnd: end };
}

/** The route a parsed reference points at. */
export function referenceHref(ref: ParsedReference): string {
  const base = `/bible/${ref.book.slug}/${ref.chapter}`;
  if (ref.verseStart === undefined) return base;
  if (ref.verseEnd === undefined) return `${base}/${ref.verseStart}`;
  return `${base}/${ref.verseStart}-${ref.verseEnd}`;
}

/** How a parsed reference reads back to the person who typed it. */
export function formatReference(ref: ParsedReference): string {
  const base = `${ref.book.name} ${ref.chapter}`;
  if (ref.verseStart === undefined) return base;
  if (ref.verseEnd === undefined) return `${base}:${ref.verseStart}`;
  return `${base}:${ref.verseStart}-${ref.verseEnd}`;
}

/**
 * Parse the `[verse]` URL segment: "16" or "16-18".
 *
 * Separate from parseReference because the URL is a stricter grammar than the
 * search box — it is generated by us, so anything malformed is a broken link
 * rather than a person mistyping, and should 404 rather than be guessed at.
 */
export function parseVerseSegment(
  segment: string
): { start: number; end: number } | null {
  const m = /^(\d+)(?:-(\d+))?$/.exec(segment);
  if (!m) return null;

  const start = Number.parseInt(m[1], 10);
  if (!Number.isFinite(start) || start < 1) return null;

  if (m[2] === undefined) return { start, end: start };

  const end = Number.parseInt(m[2], 10);
  if (!Number.isFinite(end) || end < start) return null;

  return { start, end };
}
