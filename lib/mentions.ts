// Extract @mentions from text and resolve to user IDs.
// Mentions are matched by name (case-insensitive, first-name or full-name match).

import type { SupabaseClient } from "@supabase/supabase-js";

export function extractMentionNames(text: string): string[] {
  const matches = text.match(/@([A-Za-z][A-Za-z'-]*(?:\s[A-Z][A-Za-z'-]*)?)/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.slice(1).trim())));
}

export async function resolveMentions(
  supabase: SupabaseClient,
  text: string
): Promise<string[]> {
  const names = extractMentionNames(text);
  if (names.length === 0) return [];
  const { data } = await supabase.from("profiles").select("id, name").limit(1000);
  if (!data) return [];
  const ids = new Set<string>();
  for (const n of names) {
    const lower = n.toLowerCase();
    for (const p of data) {
      const full = p.name.toLowerCase();
      const first = full.split(" ")[0];
      if (full === lower || first === lower || full.startsWith(lower)) {
        ids.add(p.id);
      }
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

/** Render text with @mentions highlighted. Returns array of strings/JSX-safe segments. */
export function splitMentions(text: string): { t: string; m: boolean }[] {
  const re = /@([A-Za-z][A-Za-z'-]*(?:\s[A-Z][A-Za-z'-]*)?)/g;
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
