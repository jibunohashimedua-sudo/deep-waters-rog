"use client";
import { createClient } from "@/lib/supabase/client";

/**
 * The Bench's study queries.
 *
 * Every one of these is read-only reference data, gated by RLS to a
 * signed-in reader, and every one is called from a lens that is already on
 * screen — nothing here runs on render. See BenchLayer for the gating.
 */

export type TaggedWord = {
  verse: number;
  wordIndex: number;
  word: string;
  strongsIds: string[];
};

export type StrongsEntry = {
  strongs_id: string;
  language: "greek" | "hebrew";
  lemma: string | null;
  transliteration: string | null;
  definition: string | null;
  source: string;
};

export type ConcordanceHit = {
  book: string;
  chapter: number;
  verse: number;
  word: string;
  text: string;
};

export type CrossRef = {
  target_ref: string;
  votes: number;
  text: string | null;
};

export type ExpositionEntry = {
  source: string;
  verse_start: number;
  verse_end: number;
  strongs_id: string | null;
  body: string;
};

export type CommentaryEntry = {
  verse_start: number;
  verse_end: number;
  body: string;
  source: string;
};

/** The KJV's tagged words for a verse span, in reading order. */
export async function fetchTaggedWords(
  book: string,
  chapter: number,
  verseStart: number,
  verseEnd: number
): Promise<TaggedWord[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("verse_words")
    .select("verse, word_index, word_text, strongs_id")
    .eq("book", book)
    .eq("chapter", chapter)
    .gte("verse", verseStart)
    .lte("verse", verseEnd)
    .order("verse")
    .order("word_index")
    .limit(400);
  if (error) throw new Error(error.message);

  // One word element can carry two numbers; they arrive as two rows.
  const byWord = new Map<string, TaggedWord>();
  for (const r of data ?? []) {
    const row = r as { verse: number; word_index: number; word_text: string; strongs_id: string };
    const key = `${row.verse}|${row.word_index}`;
    const existing = byWord.get(key);
    if (existing) existing.strongsIds.push(row.strongs_id);
    else byWord.set(key, {
      verse: row.verse,
      wordIndex: row.word_index,
      word: row.word_text,
      strongsIds: [row.strongs_id]
    });
  }
  return [...byWord.values()];
}

/** Lexicon entries for a set of Strong's numbers. */
export async function fetchStrongsEntries(ids: string[]): Promise<Map<string, StrongsEntry>> {
  if (ids.length === 0) return new Map();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("strongs_entries")
    .select("strongs_id, language, lemma, transliteration, definition, source")
    .in("strongs_id", ids);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((e) => [(e as StrongsEntry).strongs_id, e as StrongsEntry]));
}

/** How many verses use this number, and one page of them in canonical order. */
export async function fetchConcordance(
  strongsId: string,
  offset: number,
  pageSize: number,
  exclude: { book: string; chapter: number; verse: number }
): Promise<{ total: number; hits: ConcordanceHit[] }> {
  const supabase = createClient();
  const { data, error, count } = await supabase
    .from("verse_words")
    .select("book, chapter, verse, word_text, book_index", { count: "exact" })
    .eq("strongs_id", strongsId)
    .order("book_index")
    .order("chapter")
    .order("verse")
    .range(offset, offset + pageSize - 1);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    book: string; chapter: number; verse: number; word_text: string;
  }[];
  // A word can be tagged twice in one verse; the verse is one hit.
  const seen = new Set<string>();
  const wanted = rows.filter((r) => {
    const k = `${r.book}|${r.chapter}|${r.verse}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return !(r.book === exclude.book && r.chapter === exclude.chapter && r.verse === exclude.verse);
  });

  const texts = await fetchVerseTexts(
    wanted.map((r) => ({ book: r.book, chapter: r.chapter, verse: r.verse }))
  );
  return {
    total: count ?? 0,
    hits: wanted.map((r) => ({
      book: r.book,
      chapter: r.chapter,
      verse: r.verse,
      word: r.word_text,
      text: texts.get(`${r.book}|${r.chapter}|${r.verse}`) ?? ""
    }))
  };
}

/** Cross references for a verse, strongest first, each with its text. */
export async function fetchCrossRefs(
  book: string,
  chapter: number,
  verse: number,
  limit: number
): Promise<CrossRef[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cross_refs")
    .select("target_ref, votes, target_book, target_chapter, target_verse_start, target_verse_end")
    .eq("book", book)
    .eq("chapter", chapter)
    .eq("verse", verse)
    .order("votes", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    target_ref: string; votes: number; target_book: string;
    target_chapter: number; target_verse_start: number; target_verse_end: number;
  }[];

  // A reference may name a run of verses; the first of them stands for it.
  const texts = await fetchVerseTexts(
    rows.map((r) => ({ book: r.target_book, chapter: r.target_chapter, verse: r.target_verse_start }))
  );
  return rows.map((r) => ({
    target_ref: r.target_ref,
    votes: r.votes,
    text: texts.get(`${r.target_book}|${r.target_chapter}|${r.target_verse_start}`) ?? null
  }));
}

/** The exposition of the passage containing this verse. */
export async function fetchExposition(
  book: string,
  chapter: number,
  verse: number
): Promise<ExpositionEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exposition_entries")
    .select("source, verse_start, verse_end, strongs_id, body")
    .eq("book", book)
    .eq("chapter", chapter)
    .lte("verse_start", verse)
    .gte("verse_end", verse)
    .order("verse_start")
    .limit(3);
  if (error) throw new Error(error.message);
  return (data ?? []) as ExpositionEntry[];
}

/** Matthew Henry on the passage containing this verse. */
export async function fetchCommentary(
  book: string,
  chapter: number,
  verse: number
): Promise<CommentaryEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("commentary_entries")
    .select("verse_start, verse_end, body, source")
    .eq("book", book)
    .eq("chapter", chapter)
    .lte("verse_start", verse)
    .gte("verse_end", verse)
    .order("verse_start")
    .limit(3);
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentaryEntry[];
}

/**
 * KJV text for a handful of references, in one round trip.
 *
 * PostgREST has no tuple IN, so this asks for the union of the chapters
 * involved and picks the verses out here. A page of twelve references
 * touches at most twelve chapters, and this is one request rather than
 * twelve.
 */
async function fetchVerseTexts(
  refs: { book: string; chapter: number; verse: number }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (refs.length === 0) return out;
  const supabase = createClient();

  const clauses = Array.from(
    new Set(refs.map((r) => `and(book.eq."${r.book}",chapter.eq.${r.chapter})`))
  );
  const { data, error } = await supabase
    .from("kjv_verses")
    .select("book, chapter, verse, text")
    .or(clauses.join(","))
    .limit(2000);
  if (error) throw new Error(error.message);

  const wanted = new Set(refs.map((r) => `${r.book}|${r.chapter}|${r.verse}`));
  for (const r of (data ?? []) as { book: string; chapter: number; verse: number; text: string }[]) {
    const key = `${r.book}|${r.chapter}|${r.verse}`;
    if (wanted.has(key)) out.set(key, r.text);
  }
  return out;
}
