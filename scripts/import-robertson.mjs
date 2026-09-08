// word_study_entries — A. T. Robertson, Word Pictures in the New Testament.
//
// LICENCE, AND WHY ONLY PART OF IT IS HERE.
//
// The CrossWire module RWP carries all six volumes, but its own conf is
// explicit that they are not all free:
//
//   DistributionLicense=Copyrighted; Free non-commercial distribution
//   Vol 1,2,3,4  Public Domain
//   Volume 5 (c) 1932. Renewal 1960 Broadman Press. All rights reserved.
//   Volume 6 (c) 1933. Renewal 1960 Broadman Press. All rights reserved.
//
// So only volumes 1 to 4 are imported — Matthew and Mark, Luke, Acts, and
// the Epistles of Paul. Volumes 5 and 6 are left out: John and Hebrews,
// and the General Epistles with Revelation.
//
// The module notes that volume 5's copyright expires at the end of 2006
// and volume 6's at the end of 2007. Those dates are the pre-1998 term.
// The Copyright Term Extension Act took renewed works of 1932 and 1933 to
// 95 years from publication, which is 2028 and 2029. Treating them as
// expired would be taking the module's arithmetic over the statute, so
// they stay out until somebody who can make that call says otherwise.
//
//   node scripts/import-robertson.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { DATA, DRY, db, upsertBatched } from "./lib-db.mjs";
import { normaliseBookName } from "./books.mjs";

const SOURCE = "robertson";
const MODULE = join(DATA, "RWP", "modules", "comments", "zcom", "rwp");

/** Volumes 1–4, the ones the module states are public domain. */
const PUBLIC_DOMAIN_BOOKS = new Set([
  "Matthew", "Mark",                                   // vol 1
  "Luke",                                              // vol 2
  "Acts",                                              // vol 3
  "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
  "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
  "1 Timothy", "2 Timothy", "Titus", "Philemon"        // vol 4
]);

const czs = readFileSync(join(MODULE, "nt.czs"));
const czv = readFileSync(join(MODULE, "nt.czv"));
const czz = readFileSync(join(MODULE, "nt.czz"));

const kjv = JSON.parse(readFileSync(join(DATA, "KJV-osis.json"), "utf8"));
const NT = kjv.books.slice(39);

const slots = [{ kind: "testament" }];
const kjvText = new Map();
for (const b of NT) {
  const name = normaliseBookName(b.name);
  if (!name) throw new Error(`unmapped book: ${b.name}`);
  slots.push({ kind: "book" });
  for (const c of b.chapters) {
    slots.push({ kind: "chapter" });
    for (const v of c.verses) {
      slots.push({ kind: "verse", book: name, chapter: c.chapter, verse: v.verse });
      kjvText.set(`${name}|${c.chapter}|${v.verse}`,
        v.text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().toLowerCase());
    }
  }
}

// This module is zCom, not zCom4: index entries are 10 bytes, not 12 —
// uint32 block, uint32 offset, uint16 size.
const ENTRY = 10;
const cache = new Map();
function block(n) {
  if (cache.has(n)) return cache.get(n);
  const offset = czs.readUInt32LE(n * 12);
  const size = czs.readUInt32LE(n * 12 + 4);
  const buf = inflateSync(czz.subarray(offset, offset + size));
  cache.set(n, buf);
  return buf;
}
function entryAt(i) {
  if (i < 0 || i >= czv.length / ENTRY) return null;
  const b = czv.readUInt32LE(i * ENTRY);
  const start = czv.readUInt32LE(i * ENTRY + 4);
  const size = czv.readUInt16LE(i * ENTRY + 8);
  if (size === 0) return null;
  try {
    return block(b).subarray(start, start + size).toString("utf8")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return null;
  }
}

// This module's index carries one entry more than the versification has
// slots, and the extra one is at the front: read at the slot itself and
// every note lands a verse early. The offset is not assumed — it is chosen
// below by testing which one puts Robertson's catchwords in their own
// verses, and the winner has to win by a mile.
function scoreShift(shift) {
  let checked = 0, hit = 0;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.kind !== "verse") continue;
    const body = entryAt(i + shift);
    if (!body) continue;
    const m = /^([A-Za-z][A-Za-z' ]{2,40}?)\s*\(/.exec(body);
    if (!m) continue;
    const cue = m[1].trim().toLowerCase();
    if (cue.length < 4) continue;
    const verse = kjvText.get(`${s.book}|${s.chapter}|${s.verse}`);
    if (!verse) continue;
    checked++;
    if (verse.includes(cue)) hit++;
  }
  return { checked, hit, rate: checked ? hit / checked : 0 };
}

const scores = [0, 1, 2].map((sh) => ({ shift: sh, ...scoreShift(sh) }));
for (const s of scores) {
  console.log(`  shift ${s.shift}: ${s.hit}/${s.checked} catchwords in their own verse (${(s.rate * 100).toFixed(1)}%)`);
}
const best = scores.reduce((a, b) => (b.rate > a.rate ? b : a));
const runnerUp = scores.filter((s) => s !== best).reduce((a, b) => (b.rate > a.rate ? b : a));
if (best.rate < 0.4 || best.rate < runnerUp.rate * 5) {
  throw new Error(
    `alignment is not clear (best ${(best.rate * 100).toFixed(1)}%, next ${(runnerUp.rate * 100).toFixed(1)}%) — nothing written`
  );
}
console.log(`  using shift ${best.shift}`);

const rows = [];
let skippedCopyright = 0;
for (let i = 0; i < slots.length; i++) {
  const s = slots[i];
  if (s.kind !== "verse") continue;
  const body = entryAt(i + best.shift);
  if (!body || body.length < 40) continue;
  if (!PUBLIC_DOMAIN_BOOKS.has(s.book)) { skippedCopyright++; continue; }
  rows.push({
    source: SOURCE,
    book: s.book,
    chapter: s.chapter,
    verse_start: s.verse,
    verse_end: s.verse,
    strongs_id: null,
    body
  });
}

const chars = rows.reduce((n, r) => n + r.body.length, 0);
console.log(`word_study_entries (${SOURCE}): ${rows.length} notes, ${(chars / 1e6).toFixed(1)} MB of text`);
console.log(`  ${skippedCopyright} notes left out — volumes 5 and 6 are still in copyright`);
const sample = rows.find((r) => r.book === "Romans" && r.chapter === 8 && r.verse_start === 28);
if (sample) console.log(`  Romans 8:28: ${sample.body.slice(0, 100)}…`);

if (!DRY) {
  const client = db();
  await upsertBatched(client, "word_study_entries", rows,
    "source,book,chapter,verse_start,verse_end", 500);
}
console.log("done");
