// commentary_entries — Matthew Henry's Commentary on the Whole Bible.
//
// Source: revisedcommonversion/matthew-henry-commentary on Codeberg,
// released under CC0 1.0; the underlying text is public domain (Matthew
// Henry died in 1714).
//
// Henry writes on passages, not verses. Each chapter file carries
// "### Verses 1-21" headings, and that span is what a row holds, so the
// lens can ask for the passage containing the pinned verse and get the
// paragraph Henry actually wrote about it.
//
//   node scripts/import-commentary.mjs [--dry-run]
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DATA, DRY, db, upsertBatched } from "./lib-db.mjs";
import { BOOKS } from "./books.mjs";

const SOURCE = "Matthew Henry's Commentary on the Whole Bible (public domain, CC0 1.0)";
const ROOT = join(DATA, "matthew-henry");

/** Their directory names are our slugs, with a couple of spelling gaps. */
const DIR_ALIASES = new Map(Object.entries({
  "song-of-songs": ["song-of-solomon", "song-of-songs", "songofsolomon"],
  "psalms": ["psalms", "psalm"],
  "revelation": ["revelation", "revelation-of-john"]
}));

function dirFor(slug) {
  const candidates = DIR_ALIASES.get(slug) ?? [slug];
  for (const c of candidates) {
    const p = join(ROOT, c);
    if (existsSync(p)) return p;
  }
  return null;
}

/** Markdown to something a paragraph can be set in. */
function clean(md) {
  return md
    .replace(/^\s*[-=]{3,}\s*$/gm, "")     // setext underlines
    .replace(/`([^`]*)`/g, "$1")           // Henry's roman-numeral markers
    .replace(/\\'/g, "’")
    .replace(/\\"/g, '"')
    .replace(/\\([.\-*_])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const rows = [];
const missing = [];

for (const book of BOOKS) {
  const dir = dirFor(book.slug);
  if (!dir) { missing.push(book.name); continue; }

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".md")) continue;
    const chapter = Number.parseInt(/Chapter\s+0*(\d+)/i.exec(file)?.[1] ?? "", 10);
    if (!Number.isFinite(chapter)) continue;   // "Introduction to John.md"

    const md = readFileSync(join(dir, file), "utf8");
    // Split on the verse-span headings. Everything before the first one is
    // Henry's chapter preamble, kept as a whole-chapter entry.
    const parts = md.split(/^###\s+Verses?\s+(\d+)(?:\s*[-–]\s*(\d+))?\s*$/gm);

    const preamble = clean(parts[0].replace(/^[\s\S]*?^Commentary\s*$/m, ""));
    if (preamble.length > 80) {
      rows.push({
        source: SOURCE, book: book.name, chapter,
        verse_start: 0, verse_end: 0, body: preamble
      });
    }

    for (let i = 1; i < parts.length; i += 3) {
      const start = Number.parseInt(parts[i], 10);
      const end = parts[i + 1] ? Number.parseInt(parts[i + 1], 10) : start;
      const body = clean(parts[i + 2] ?? "");
      if (!Number.isFinite(start) || body.length < 40) continue;
      rows.push({
        source: SOURCE, book: book.name, chapter,
        verse_start: start, verse_end: Number.isFinite(end) ? end : start,
        body
      });
    }
  }
}

console.log(`commentary_entries: ${rows.length} rows`);
if (missing.length) console.log(`  no directory for: ${missing.join(", ")}`);
const j316 = rows.find(r => r.book === "John" && r.chapter === 3 && r.verse_start <= 16 && r.verse_end >= 16);
console.log("  John 3:16 falls in:", j316 ? `Verses ${j316.verse_start}-${j316.verse_end}, ${j316.body.length} chars` : "(none)");

if (!DRY) {
  const client = db();
  await upsertBatched(client, "commentary_entries", rows,
    "source,book,chapter,verse_start,verse_end", 200);
}
console.log("done");
