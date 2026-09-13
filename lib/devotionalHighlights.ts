// Highlights and notes on a devotional article — anchored to the text,
// not to a fragile character offset.
//
// Everything here is client-callable. The DB is behind Supabase's REST
// API with row-level security; a caller signs in and can only see and
// change its own rows. The server does not need to know about
// placement — that is a client concern.
//
// See supabase/migrations/2026_09_13_devotional_highlights.sql for the
// storage shape.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { HighlightColour } from "./highlights";

// -----------------------------------------------------------------
// Attribution shown on a shared card of a devotional selection.
//
// TODO(zo): confirm final credit with the Rhapsody of Realities
// publisher before ship — this is a PLACEHOLDER and may not be the
// copyright notice they expect. A credit line and a copyright notice
// are not the same thing; the publisher decides which is correct here.
// The middle dot matches the mono separator used elsewhere.
// -----------------------------------------------------------------
export const RHAPSODY_ATTRIBUTION =
  "From Rhapsody of Realities · Pastor Chris Oyakhilome";

// How much text either side of the quote to store for recovery. 64 chars
// each side gives a match string of up to 137 characters — enough that
// even a short quote like "in Christ" is essentially unique across the
// article once its surroundings are in the string too.
export const CONTEXT_CHARS = 64;

/** Which piece of the article a mark belongs to. Stable — the parser
    labels sections by structure. */
export type Section = "verse" | "body" | "prayer";

export function isSection(v: unknown): v is Section {
  return v === "verse" || v === "body" || v === "prayer";
}

/**
 * The document a placement algorithm reads against — the article
 * unpacked into its sections and, for the body, its paragraphs.
 *
 * Built once per render from the row in rhapsody_days.
 */
export type ArticleDoc = {
  date: string;
  sections: {
    verse: string[]; // 0 or 1 element
    body: string[];  // paragraphs
    prayer: string[]; // 0 or 1 element
  };
};

/** Build an ArticleDoc from a stored rhapsody_days row. */
export function articleFrom(row: {
  date: string;
  verse_text: string | null;
  body: string | null;
  prayer: string | null;
}): ArticleDoc {
  const bodyBlocks = (row.body ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const verseBlocks = row.verse_text?.trim() ? [row.verse_text.trim()] : [];
  const prayerBlocks = row.prayer?.trim() ? [row.prayer.trim()] : [];
  return {
    date: row.date,
    sections: { verse: verseBlocks, body: bodyBlocks, prayer: prayerBlocks }
  };
}

/** The stored anchor. Same shape whether the mark is a highlight or a
    note — the difference is what the mark carries (colour vs body). */
export type Anchor = {
  section: Section;
  block: number;
  offset: number;
  length: number;
  quote: string;
  prefix: string;
  suffix: string;
};

export type Highlight = Anchor & {
  id: string;
  range_id: string;
  colour: HighlightColour;
  created_at: string;
};

export type Note = Anchor & {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

/** Where a mark landed on the current article. */
export type Placement =
  | { kind: "placed"; section: Section; block: number; offset: number; length: number; step: 1 | 2 | 3 | 4 }
  | { kind: "orphan" };

/**
 * Place one anchor against the current article.
 *
 * The ladder walks five levels; each accepts only when the match is
 * UNIQUE. A non-unique match at any level falls through to the next
 * level — never a first-match guess.
 *
 *   1  exact hit at the stored offset
 *   2  prefix + quote + suffix, in the same section+block
 *   3  quote alone, in the same section+block
 *   4  prefix + quote + suffix, anywhere in the article
 *   5  orphan (the row is kept; the reader sees it in a small panel)
 *
 * Every step compares plain text against the block's own textContent,
 * so a re-extract that changes punctuation or whitespace inside the
 * surrounding context won't stop the match — it will just push it down
 * the ladder until one of the levels lands unambiguously.
 */
export function place(anchor: Anchor, doc: ArticleDoc): Placement {
  const sectionBlocks = doc.sections[anchor.section] ?? [];
  const block = sectionBlocks[anchor.block] ?? "";

  // Step 1: exact hit at stored offset.
  if (block.substr(anchor.offset, anchor.length) === anchor.quote) {
    return {
      kind: "placed",
      section: anchor.section,
      block: anchor.block,
      offset: anchor.offset,
      length: anchor.length,
      step: 1
    };
  }

  const contextual =
    (anchor.prefix ?? "") + anchor.quote + (anchor.suffix ?? "");

  // Step 2: prefix + quote + suffix in the same block. Must be unique.
  if (block && contextual !== anchor.quote) {
    const uniqueOffset = findUnique(block, contextual);
    if (uniqueOffset !== -1) {
      return {
        kind: "placed",
        section: anchor.section,
        block: anchor.block,
        offset: uniqueOffset + (anchor.prefix?.length ?? 0),
        length: anchor.quote.length,
        step: 2
      };
    }
  }

  // Step 3: quote alone in the same block. Must be unique.
  if (block) {
    const uniqueOffset = findUnique(block, anchor.quote);
    if (uniqueOffset !== -1) {
      return {
        kind: "placed",
        section: anchor.section,
        block: anchor.block,
        offset: uniqueOffset,
        length: anchor.quote.length,
        step: 3
      };
    }
  }

  // Step 4: prefix + quote + suffix anywhere in the article. Must be
  // unique across every block of every section.
  if (contextual !== anchor.quote) {
    const hit = findUniqueAcross(doc, contextual);
    if (hit) {
      return {
        kind: "placed",
        section: hit.section,
        block: hit.block,
        offset: hit.offset + (anchor.prefix?.length ?? 0),
        length: anchor.quote.length,
        step: 4
      };
    }
  }

  // Step 5: cannot place. The row is kept; the reader sees it in the
  // orphan panel, with the stored quote and (for notes) the full body.
  return { kind: "orphan" };
}

/** Return the offset of `needle` in `haystack` iff it appears exactly
    once. Returns -1 for zero or two-or-more matches. */
function findUnique(haystack: string, needle: string): number {
  if (!needle) return -1;
  const first = haystack.indexOf(needle);
  if (first === -1) return -1;
  const second = haystack.indexOf(needle, first + 1);
  if (second !== -1) return -1;
  return first;
}

/** Same as findUnique, but across every block of every section. */
function findUniqueAcross(
  doc: ArticleDoc,
  needle: string
): { section: Section; block: number; offset: number } | null {
  let hit: { section: Section; block: number; offset: number } | null = null;
  for (const section of ["verse", "body", "prayer"] as Section[]) {
    const blocks = doc.sections[section] ?? [];
    for (let b = 0; b < blocks.length; b++) {
      const off = findUnique(blocks[b], needle);
      if (off !== -1) {
        if (hit) return null; // second hit — not unique
        hit = { section, block: b, offset: off };
      }
    }
  }
  return hit;
}

/**
 * Extract prefix/quote/suffix from a block, given the plain-text
 * offset+length of the selection. Called at save time to freeze the
 * recovery triple.
 */
export function extractAnchor(
  block: string,
  offset: number,
  length: number
): Pick<Anchor, "quote" | "prefix" | "suffix"> {
  const quote = block.substr(offset, length);
  const prefixStart = Math.max(0, offset - CONTEXT_CHARS);
  const prefix = block.slice(prefixStart, offset);
  const suffix = block.slice(offset + length, offset + length + CONTEXT_CHARS);
  return { quote, prefix, suffix };
}

// -----------------------------------------------------------------
// Load / save. Thin wrappers around Supabase's REST API — RLS makes them
// safe to call from the client.
// -----------------------------------------------------------------

export async function loadForDate(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<{ highlights: Highlight[]; notes: Note[]; error: string | null }> {
  const [hlRes, noteRes] = await Promise.all([
    supabase
      .from("devotional_highlights")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at"),
    supabase
      .from("devotional_notes")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .order("created_at")
  ]);
  const error = hlRes.error?.message ?? noteRes.error?.message ?? null;
  return {
    highlights: (hlRes.data ?? []) as Highlight[],
    notes: (noteRes.data ?? []) as Note[],
    error
  };
}

export async function insertHighlights(
  supabase: SupabaseClient,
  rows: Array<Omit<Highlight, "id" | "created_at">>
): Promise<{ data: Highlight[] | null; error: string | null }> {
  const withOffsetColumn = rows.map((r) => ({
    user_id: (r as unknown as { user_id: string }).user_id,
    range_id: r.range_id,
    date: (r as unknown as { date: string }).date,
    section: r.section,
    block: r.block,
    offset: r.offset, // column is quoted "offset" in SQL — the JS name is unquoted here and PostgREST passes it through
    length: r.length,
    quote: r.quote,
    prefix: r.prefix ?? null,
    suffix: r.suffix ?? null,
    colour: r.colour
  }));
  const { data, error } = await supabase
    .from("devotional_highlights")
    .insert(withOffsetColumn)
    .select();
  return { data: (data ?? null) as Highlight[] | null, error: error?.message ?? null };
}

export async function deleteHighlights(
  supabase: SupabaseClient,
  ids: string[]
): Promise<string | null> {
  if (ids.length === 0) return null;
  const { error } = await supabase
    .from("devotional_highlights")
    .delete()
    .in("id", ids);
  return error?.message ?? null;
}

export async function upsertNote(
  supabase: SupabaseClient,
  row:
    | (Omit<Note, "id" | "created_at" | "updated_at"> & { user_id: string; date: string })
    | (Partial<Note> & { id: string; body: string })
): Promise<{ data: Note | null; error: string | null }> {
  // Two shapes — inserting a fresh note or updating one by id.
  if ("id" in row && row.id) {
    const { data, error } = await supabase
      .from("devotional_notes")
      .update({ body: row.body })
      .eq("id", row.id)
      .select()
      .single();
    return { data: (data ?? null) as Note | null, error: error?.message ?? null };
  }
  const fresh = row as Omit<Note, "id" | "created_at" | "updated_at"> & {
    user_id: string;
    date: string;
  };
  const { data, error } = await supabase
    .from("devotional_notes")
    .insert({
      user_id: fresh.user_id,
      date: fresh.date,
      section: fresh.section,
      block: fresh.block,
      offset: fresh.offset,
      length: fresh.length,
      quote: fresh.quote,
      prefix: fresh.prefix ?? null,
      suffix: fresh.suffix ?? null,
      body: fresh.body
    })
    .select()
    .single();
  return { data: (data ?? null) as Note | null, error: error?.message ?? null };
}

export async function deleteNote(
  supabase: SupabaseClient,
  id: string
): Promise<string | null> {
  const { error } = await supabase.from("devotional_notes").delete().eq("id", id);
  return error?.message ?? null;
}
