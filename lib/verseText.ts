import { createClient } from "@/lib/supabase/server";
import { bookByName } from "@/lib/bibleBooks";
import { resolveTranslation } from "@/lib/translations";
import { verseTextsFromHtml, joinVerseRange } from "@/lib/verseParse";

/** The shape both highlights and notes share for this lookup. */
type Marked = {
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
};

/** Key a mark by the chapter it lives in. */
const chapterKey = (book: string, chapter: number) => `${book}|${chapter}`;

/** Key a mark by its exact span. */
export const spanKey = (m: Marked) =>
  `${m.book}|${m.chapter}|${m.verse_start}|${m.verse_end}`;

/**
 * Fill in the words behind a set of marks.
 *
 * Highlights store a reference, not a quotation, so Depth has to go and get
 * the text. It comes from public.bible_cache — the same rows the reading
 * screen fills as people read — which means one query for the whole page and
 * not a single call to API.Bible, whose rate limit is the reason that cache
 * exists at all.
 *
 * Deliberately cache-only. A chapter has to have been read for a verse in it
 * to be highlighted, so it is nearly always there; when it genuinely isn't —
 * a cold cache, or a row aged past its TTL — the row still lists with its
 * reference and its colour, and it still opens the chapter when tapped. A
 * missing quotation is a quieter failure than a page that waits on forty
 * network calls before it will draw.
 *
 * No nested joins anywhere near this: plain queries, merged in code.
 */
export async function fetchVerseText(
  marks: Marked[],
  preferredBibleId: string | null | undefined
): Promise<{ text: Map<string, string>; error: string | null }> {
  const text = new Map<string, string>();
  if (marks.length === 0) return { text, error: null };

  // One entry per distinct chapter, carrying the translation it should be
  // read in — which is per-book, since not every book is in every edition.
  const chapters = new Map<
    string,
    { bibleId: string; abbr: string; chapter: number }
  >();
  for (const m of marks) {
    const key = chapterKey(m.book, m.chapter);
    if (chapters.has(key)) continue;
    const book = bookByName(m.book);
    if (!book) continue;
    const resolved = resolveTranslation(preferredBibleId, book.abbr, book.name);
    chapters.set(key, {
      bibleId: resolved.id,
      abbr: book.abbr,
      chapter: m.chapter
    });
  }
  if (chapters.size === 0) return { text, error: null };

  const supabase = createClient();

  // One filter naming the exact rows. `.in()` on three columns separately
  // would ask for the cross product — every chapter number against every
  // book — and hand back chapters nobody on this page has marked.
  const clauses = Array.from(chapters.values()).map(
    (c) => `and(bible_id.eq.${c.bibleId},book.eq.${c.abbr},chapter.eq.${c.chapter})`
  );

  // Batched, because PostgREST takes its filter in the query string and a
  // reader with highlights across eighty chapters would build a URL past
  // what the server will accept. Forty clauses is roughly 2.5KB, well
  // inside it, and the batches go out together.
  const BATCH = 40;
  const batches: string[][] = [];
  for (let i = 0; i < clauses.length; i += BATCH) {
    batches.push(clauses.slice(i, i + BATCH));
  }

  const results = await Promise.all(
    batches.map((b) =>
      supabase.from("bible_cache").select("book, chapter, content").or(b.join(","))
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    // Surfaced to the page, which says so quietly. The list still renders.
    return { text, error: failed.error.message };
  }

  // Parse each chapter once, however many marks point into it.
  const parsed = new Map<string, Map<number, string>>();
  for (const r of results) {
    for (const row of r.data ?? []) {
      parsed.set(`${row.book}|${row.chapter}`, verseTextsFromHtml(row.content));
    }
  }

  for (const m of marks) {
    const book = bookByName(m.book);
    if (!book) continue;
    const verses = parsed.get(`${book.abbr}|${m.chapter}`);
    if (!verses) continue;
    const joined = joinVerseRange(verses, m.verse_start, m.verse_end);
    if (joined) text.set(spanKey(m), joined);
  }

  return { text, error: null };
}
