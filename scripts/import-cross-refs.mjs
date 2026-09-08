// cross_refs — cross references for every verse.
//
// Source: OpenBible.info's cross-reference dataset (CC BY 4.0), which is
// derived primarily from the Treasury of Scripture Knowledge (public
// domain) and ranked by reader votes. The votes are what let the lens show
// the strongest references first rather than an arbitrary dozen.
//
// The file is "From Verse \t To Verse \t Votes", OSIS-style refs, and a
// target may be a range: Exod.20.8-Exod.20.11.
//
//   node scripts/import-cross-refs.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, DRY, db, upsertBatched } from "./lib-db.mjs";
import { OSIS_TO_NAME } from "./books.mjs";

/** "Exod.20.11" → {book, chapter, verse}, or null for a book we don't carry. */
function parseRef(ref) {
  const m = /^([1-3]?[A-Za-z]+)\.(\d+)\.(\d+)$/.exec(ref.trim());
  if (!m) return null;
  const book = OSIS_TO_NAME.get(m[1]);
  if (!book) return null;
  return { book, chapter: Number(m[2]), verse: Number(m[3]) };
}

const text = readFileSync(join(DATA, "cross_references.txt"), "utf8");
const rows = [];
const seen = new Set();
let skipped = 0;

for (const line of text.split("\n")) {
  if (!line || line.startsWith("From Verse")) continue;
  const [from, to, votesRaw] = line.split("\t");
  if (!from || !to) continue;

  const src = parseRef(from);
  if (!src) { skipped++; continue; }

  // A target is either one verse or a range within one chapter.
  const [startRef, endRef] = to.split("-");
  const start = parseRef(startRef);
  if (!start) { skipped++; continue; }
  const end = endRef ? parseRef(endRef) : start;
  const verseEnd = end && end.book === start.book && end.chapter === start.chapter
    ? end.verse
    : start.verse;

  const target_ref = verseEnd > start.verse
    ? `${start.book} ${start.chapter}:${start.verse}-${verseEnd}`
    : `${start.book} ${start.chapter}:${start.verse}`;

  const key = `${src.book}|${src.chapter}|${src.verse}|${target_ref}`;
  if (seen.has(key)) continue;
  seen.add(key);

  rows.push({
    book: src.book, chapter: src.chapter, verse: src.verse,
    target_ref,
    target_book: start.book,
    target_chapter: start.chapter,
    target_verse_start: start.verse,
    target_verse_end: verseEnd,
    votes: Number.parseInt(votesRaw ?? "0", 10) || 0
  });
}

console.log(`cross_refs: ${rows.length} rows (${skipped} skipped — books outside the 66)`);
console.log("  sample:", JSON.stringify(rows.find(r => r.book === "John" && r.chapter === 3 && r.verse === 16)));

if (!DRY) {
  const client = db();
  await upsertBatched(client, "cross_refs", rows, "book,chapter,verse,target_ref", 1000);
}
console.log("done");
