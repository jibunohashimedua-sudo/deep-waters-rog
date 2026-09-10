// Two Bibles side by side: what the state is, how it is written into the
// address bar, and how it is remembered between visits.
//
// The address bar is the source of truth while you are reading. Every change
// to either pane rewrites it with history.replaceState — which Next has
// supported natively since 14.1 and which this app is well past — so the URL
// is always correct, nothing re-renders on the server, and neither pane loses
// its scroll position. Opening that URL cold restores the whole view: both
// references, both translations, and whether the panes were linked.
//
// What localStorage remembers is only what the URL cannot: the pair you last
// used, so arriving at a bare /bible/john/3 and opening a second pane gives
// you back the translations you were reading in rather than a guess.

import { bookBySlug, type BibleBook } from "@/lib/bibleBooks";
import { DEFAULT_BIBLE_ID, TRANSLATIONS, translationById } from "@/lib/translations";

/**
 * The narrowest viewport that gets two columns.
 *
 * Chosen from real devices rather than a round number. It has to admit an
 * iPad mini held upright (744) and everything larger, and it has to refuse
 * every phone held upright (430 at the very widest). Between those two lies
 * the phone in landscape, which the threshold takes from about an iPhone 13
 * mini (812) upward and leaves out at an SE (667) — where half of 667, less
 * the gutters, is about twenty-eight characters a line, and two columns of
 * that is not a reading experience worth defending.
 */
export const PARALLEL_MIN_WIDTH = 720;

export const PARALLEL_MEDIA_QUERY = `(min-width: ${PARALLEL_MIN_WIDTH}px)`;

/**
 * Where one pane is pointed.
 *
 * A verse means "land on this one", and a run of them means "land on this
 * run" — /bible/john/3/16-18 marks all three on arrival, and a pane has to
 * be able to say so too. Carrying only the first verse looked harmless
 * until a shared range link opened into a parallel view and quietly marked
 * one verse of the three.
 */
export type PaneRef = {
  bookSlug: string;
  chapter: number;
  verse: number | null;
  /** The last verse of a run. Null for a single verse, or for none. */
  verseEnd?: number | null;
};

/** The verse segment of a reading URL: "16", or "16-18". */
function verseSegment(ref: PaneRef): string | null {
  if (!ref.verse) return null;
  const end = ref.verseEnd ?? ref.verse;
  return end > ref.verse ? `${ref.verse}-${end}` : `${ref.verse}`;
}

/** One pane, whole: where it is and what it is reading in. */
export type PaneState = {
  ref: PaneRef;
  bibleId: string;
};

export type ParallelState = {
  /** Whether a second pane has been asked for. Not whether one fits. */
  open: boolean;
  linked: boolean;
  left: PaneState;
  right: PaneState;
};

// ------------------------------------------------------------- references

/** "romans.8", "romans.8.5", or "john.3.16-18" — dots, so nothing needs
    URL-encoding, and the same verse run the path would have written. */
export function encodeRef(ref: PaneRef): string {
  const seg = verseSegment(ref);
  return seg
    ? `${ref.bookSlug}.${ref.chapter}.${seg}`
    : `${ref.bookSlug}.${ref.chapter}`;
}

export function decodeRef(raw: string | null | undefined): PaneRef | null {
  if (!raw) return null;
  const [slug, chapterRaw, verseRaw] = raw.split(".");
  const book = slug ? bookBySlug(slug) : null;
  if (!book) return null;
  const chapter = Number.parseInt(chapterRaw ?? "", 10);
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > book.chapters) return null;
  const [startRaw, endRaw] = (verseRaw ?? "").split("-");
  const verse = startRaw ? Number.parseInt(startRaw, 10) : NaN;
  const end = endRaw ? Number.parseInt(endRaw, 10) : NaN;
  const start = Number.isFinite(verse) && verse > 0 ? verse : null;
  return {
    bookSlug: book.slug,
    chapter,
    verse: start,
    verseEnd:
      start !== null && Number.isFinite(end) && end >= start ? end : null
  };
}

/** The reading route for a pane — the same route a single pane has always
    had, so the left pane's URL is a URL that already meant something. */
export function pathForRef(ref: PaneRef): string {
  const seg = verseSegment(ref);
  return seg
    ? `/bible/${ref.bookSlug}/${ref.chapter}/${seg}`
    : `/bible/${ref.bookSlug}/${ref.chapter}`;
}

/** Clamp a reference to a book that actually has that chapter. */
export function clampRef(ref: PaneRef): PaneRef {
  const book = bookBySlug(ref.bookSlug);
  if (!book) return ref;
  return {
    ...ref,
    chapter: Math.min(Math.max(1, ref.chapter), book.chapters)
  };
}

export function bookOf(ref: PaneRef): BibleBook | null {
  return bookBySlug(ref.bookSlug);
}

export function referenceLabel(ref: PaneRef): string {
  const book = bookOf(ref);
  if (!book) return "";
  return `${book.name} ${ref.chapter}`;
}

// ----------------------------------------------------------- translations

// Translation ids are long opaque hashes. The address bar carries the code
// instead — lt=kjv&pt=nlt — because a URL is something people read, copy and
// send each other, and "de4e12af7f28f599-02" tells the recipient nothing.

const BY_ABBR = new Map(TRANSLATIONS.map((t) => [t.abbr.toLowerCase(), t]));

export function translationCode(id: string): string {
  return translationById(id).abbr.toLowerCase();
}

export function translationFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return BY_ABBR.get(code.toLowerCase())?.id ?? null;
}

// ------------------------------------------------------------ the address

/** What the query string is allowed to say about a parallel view. */
export const PARALLEL_PARAMS = ["lt", "p", "pt", "link"] as const;

/**
 * Read a parallel view out of a URL.
 *
 * The left pane comes from the path, which the caller has already resolved —
 * so this only reads what the query adds to it. A URL with no `p` is a
 * single pane, which is every Bible URL ever shared before today.
 */
export function parseParallelParams(
  left: PaneRef,
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  fallbackBibleId: string
): ParallelState {
  const get = (k: string): string | null => {
    if (params instanceof URLSearchParams) return params.get(k);
    const v = params[k];
    return Array.isArray(v) ? v[0] ?? null : v ?? null;
  };

  const leftBible = translationFromCode(get("lt")) ?? fallbackBibleId;
  const right = decodeRef(get("p"));
  const rightBible =
    translationFromCode(get("pt")) ?? otherTranslation(leftBible);

  return {
    open: right !== null,
    linked: get("link") !== "0",
    left: { ref: left, bibleId: leftBible },
    right: { ref: right ?? left, bibleId: rightBible }
  };
}

/**
 * The whole view as one URL.
 *
 * A closed second pane writes the plain reading URL and nothing else — no
 * empty parameters, no `link=1` — so that closing the pane leaves behind
 * exactly the address a single pane has always had, and a verse link shared
 * out of the Bible is as clean as it was.
 *
 * Any query parameter this module doesn't own is carried through untouched.
 */
export function urlForState(
  state: ParallelState,
  existing?: URLSearchParams,
  /**
   * The path to keep instead of one built from the left pane's reference.
   *
   * A reference can be written more ways than one and only one of them is
   * the reader's: /john/3/16-18 is a range, and a pane holds a verse to
   * land on rather than a span, so rebuilding the path from pane state
   * would quietly rewrite that URL to /john/3/16. Callers pass the path
   * they were actually served for as long as the left pane is still on it.
   */
  pathOverride?: string | null
): string {
  const params = new URLSearchParams(existing?.toString() ?? "");
  for (const key of PARALLEL_PARAMS) params.delete(key);

  if (state.open) {
    params.set("lt", translationCode(state.left.bibleId));
    params.set("p", encodeRef(state.right.ref));
    params.set("pt", translationCode(state.right.bibleId));
    if (!state.linked) params.set("link", "0");
  }

  const query = params.toString();
  const path = pathOverride ?? pathForRef(state.left.ref);
  return `${path}${query ? `?${query}` : ""}`;
}

/** Two references pointing at exactly the same place. */
export function sameRef(a: PaneRef, b: PaneRef): boolean {
  return (
    a.bookSlug === b.bookSlug &&
    a.chapter === b.chapter &&
    a.verse === b.verse &&
    (a.verseEnd ?? null) === (b.verseEnd ?? null)
  );
}

// -------------------------------------------------------------- memory

const STORE_KEY = "dw.parallel.v1";

type Remembered = {
  left: string;
  right: string;
  linked: boolean;
  open: boolean;
};

/** A sensible second translation when there is nothing remembered: not the
    one already on screen, because a pane comparing a text with itself is a
    pane doing nothing. */
export function otherTranslation(bibleId: string): string {
  if (bibleId !== DEFAULT_BIBLE_ID) return DEFAULT_BIBLE_ID;
  // NLT — the most-reached-for modern rendering beside the King James.
  return TRANSLATIONS.find((t) => t.abbr === "NLT")?.id ?? DEFAULT_BIBLE_ID;
}

export function rememberPair(state: ParallelState): void {
  try {
    const value: Remembered = {
      left: translationCode(state.left.bibleId),
      right: translationCode(state.right.bibleId),
      linked: state.linked,
      open: state.open
    };
    window.localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    /* private browsing, or storage full. The view still works. */
  }
}

export function recallPair(): {
  left: string | null;
  right: string | null;
  linked: boolean;
  open: boolean;
} {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return { left: null, right: null, linked: true, open: false };
    const parsed = JSON.parse(raw) as Partial<Remembered>;
    return {
      left: translationFromCode(parsed.left),
      right: translationFromCode(parsed.right),
      linked: parsed.linked !== false,
      open: parsed.open === true
    };
  } catch {
    return { left: null, right: null, linked: true, open: false };
  }
}
