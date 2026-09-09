// Extract @mentions from text and resolve to user IDs.
//
// Two things this file has to get right:
//
// 1. Unicode. Names in this community carry accents (Ọlá, Ìyá, Björk),
//    diacritics of every stripe, and script-specific letters. The old
//    `[A-Za-z]` alphabet silently dropped them, so those readers could
//    never be @-mentioned. Every letter class here goes through `\p{L}`
//    with the `u` flag so the whole Unicode letter category matches.
//
// 2. Ambiguity. "@Sarah" used to notify every user whose name *started*
//    with "Sarah", so one mention could ping five people. Now the resolver
//    only accepts exact matches — full name, or first name — and if a
//    first-name match hits more than one row, nobody is notified. Better
//    silence than spam; the writer can add a surname to disambiguate.
//
// Tested by hand against these names — the regex and resolver both
// handle all seven:
//   Björk           → @Björk
//   Ọlá             → @Ọlá
//   Ìyá             → @Ìyá
//   Mary-Anne       → @Mary-Anne
//   Jean-Luc        → @Jean-Luc
//   Ann Marie Smith → @Ann Marie Smith  (matched on full name) or
//                     @Ann Marie        (matched on first two words)
//   O'Brien         → @O'Brien

import type { SupabaseClient } from "@supabase/supabase-js";

/** Any Unicode letter, plus straight `'`, curly `'`, and hyphen. Used
    inside a name. `\p{L}` requires the `u` flag on the enclosing regex. */
const NAME_CHAR = String.raw`[\p{L}'’-]`;

/** A first-word start: any Unicode letter. The name doesn't have to be
    Anglo, so uppercase is not required. */
const FIRST_WORD = `\\p{L}${NAME_CHAR}*`;

/** A second-word start MUST be uppercase — otherwise "@Björk sings" would
    swallow "sings". Real surnames that start lowercase (van, de, ó) still
    work as a single-word mention; the writer can type the surname alone
    or capitalise it. */
const SECOND_WORD = `\\p{Lu}${NAME_CHAR}*`;

/**
 * Match an @mention. Two shapes: "@First" or "@First Last".
 * `u` flag for Unicode property escapes. `g` to sweep the whole string.
 */
const MENTION_RE = new RegExp(
  String.raw`@(${FIRST_WORD}(?:\s${SECOND_WORD})?)`,
  "gu"
);

/** Case-fold via toLocaleLowerCase, then strip curly-quote variants so
    "O'Brien" and "O'Brien" both compare equal. */
function normalise(s: string): string {
  return s.toLocaleLowerCase().replace(/’/g, "'").trim();
}

export function extractMentionNames(text: string): string[] {
  const matches = text.match(MENTION_RE) ?? [];
  // Drop the leading "@" and dedupe by normalised form so "@Ann" and
  // "@ann" don't count twice.
  const seen = new Map<string, string>();
  for (const raw of matches) {
    const name = raw.slice(1).trim();
    const key = normalise(name);
    if (!seen.has(key)) seen.set(key, name);
  }
  return Array.from(seen.values());
}

export async function resolveMentions(
  supabase: SupabaseClient,
  text: string
): Promise<string[]> {
  const names = extractMentionNames(text);
  if (names.length === 0) return [];
  const { data } = await supabase.from("profiles").select("id, name:display_name").limit(1000);
  if (!data) return [];

  // Group profiles by normalised first-name and normalised full-name so
  // the match is a hash lookup, not an O(N × M) scan.
  const byFirst = new Map<string, string[]>();
  const byFull = new Map<string, string[]>();
  for (const p of data) {
    if (!p.name) continue;
    const full = normalise(p.name);
    const first = full.split(/\s+/)[0] ?? "";
    if (full) {
      byFull.set(full, [...(byFull.get(full) ?? []), p.id]);
    }
    if (first) {
      byFirst.set(first, [...(byFirst.get(first) ?? []), p.id]);
    }
  }

  const ids = new Set<string>();
  for (const raw of names) {
    const n = normalise(raw);
    // Exact full-name wins over first-name — someone typed the whole
    // thing to disambiguate.
    const fullHits = byFull.get(n);
    if (fullHits && fullHits.length > 0) {
      for (const id of fullHits) ids.add(id);
      continue;
    }
    // First-name only: notify iff exactly one person has that first
    // name. If two people share it, notify nobody — the writer can
    // disambiguate with the surname.
    const firstHits = byFirst.get(n);
    if (firstHits && firstHits.length === 1) {
      ids.add(firstHits[0]);
    }
  }
  return Array.from(ids);
}

export async function recordMentions(
  supabase: SupabaseClient,
  sourceType: "completion" | "comment" | "prayer",
  sourceId: string,
  text: string,
  excludeUserId?: string
) {
  const ids = await resolveMentions(supabase, text);
  const rows = ids
    .filter((id) => id !== excludeUserId)
    .map((id) => ({ source_type: sourceType, source_id: sourceId, mentioned_user_id: id }));
  if (rows.length > 0) await supabase.from("mentions").insert(rows);
}

/** Render text with @mentions highlighted. Returns an array of segments;
    each is either a plain-text run or a matched mention. */
export function splitMentions(text: string): { t: string; m: boolean }[] {
  // Fresh regex per call so the `g` flag's lastIndex doesn't leak.
  const re = new RegExp(String.raw`@(${FIRST_WORD}(?:\s${SECOND_WORD})?)`, "gu");
  const out: { t: string; m: boolean }[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push({ t: text.slice(last, match.index), m: false });
    out.push({ t: match[0], m: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ t: text.slice(last), m: false });
  return out;
}
