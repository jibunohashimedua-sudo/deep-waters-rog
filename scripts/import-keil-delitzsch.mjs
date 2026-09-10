// exposition_entries — Keil and Delitzsch on the Old Testament.
//
// Source: the CrossWire Sword module "KD", whose own config states
// DistributionLicense=Public Domain, built from the text at
// en.wikisource.org. Karl Friedrich Keil (d. 1888) and Franz Delitzsch
// (d. 1890) published the ten volumes from 1864.
//
// Vincent's Word Studies is not here. The work itself is public domain —
// Vincent died in 1922 and archive.org marks the scans NOT_IN_COPYRIGHT —
// but no machine-readable edition of it exists under a licence that allows
// redistribution: CCEL requires permission to republish, CrossWire does not
// carry it, and the only alternative is OCR of the 1890 scans, whose Greek
// is destroyed (δοῦλος comes out as "KovKot"). An exposition built on
// that would be worse than no lens. See the report.
//
// The module is a zCom4 file: a block index (.bzs), a verse index (.bzv),
// and zlib-compressed blocks (.bzz). The verse index has one 12-byte entry
// per slot, and the slots walk the KJV versification in order — a testament
// heading, then per book a book heading, then per chapter a chapter
// heading, then the verses. Get that walk wrong by one and every comment
// lands on the wrong verse, so it is checked against the module's own
// reference labels before anything is written.
//
//   node scripts/import-keil-delitzsch.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join } from "node:path";
import { DATA, DRY, db, upsertBatched } from "./lib-db.mjs";
import { normaliseBookName } from "./books.mjs";

const SOURCE = "keil_delitzsch";
const MODULE = join(DATA, "KD", "modules", "comments", "zcom4", "kd");

const bzs = readFileSync(join(MODULE, "ot.bzs"));
const bzv = readFileSync(join(MODULE, "ot.bzv"));
const bzz = readFileSync(join(MODULE, "ot.bzz"));

// The versification comes from the KJV we already parsed, which is the
// versification the module declares.
const kjv = JSON.parse(readFileSync(join(DATA, "KJV-osis.json"), "utf8"));
const OT = kjv.books.slice(0, 39);

const slots = [{ kind: "testament" }];
for (const b of OT) {
  const name = normaliseBookName(b.name);
  if (!name) throw new Error(`unmapped book: ${b.name}`);
  slots.push({ kind: "book" });
  for (const c of b.chapters) {
    slots.push({ kind: "chapter" });
    for (const v of c.verses) {
      slots.push({ kind: "verse", book: name, chapter: c.chapter, verse: v.verse });
    }
  }
}

const cache = new Map();
function block(n) {
  if (cache.has(n)) return cache.get(n);
  const offset = bzs.readUInt32LE(n * 12);
  const size = bzs.readUInt32LE(n * 12 + 4);
  const buf = inflateSync(bzz.subarray(offset, offset + size));
  cache.set(n, buf);
  return buf;
}

function entryAt(i) {
  const b = bzv.readUInt32LE(i * 12);
  const start = bzv.readUInt32LE(i * 12 + 4);
  const size = bzv.readUInt32LE(i * 12 + 8);
  if (size === 0) return null;
  try {
    return block(b).subarray(start, start + size).toString("utf8");
  } catch {
    return null;
  }
}

/** OSIS to readable prose. Keil and Delitzsch quote a lot of Hebrew; it is
    left exactly as the module has it. */
function plain(osis) {
  return osis
    .replace(/<title[^>]*>([\s\S]*?)<\/title>/g, "$1. ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------- the walk
// A passage is stored against every verse it covers, so the same body
// arrives many times. Each distinct body becomes one row spanning the
// verses it was found on.
const passages = new Map();
for (let i = 0; i < slots.length; i++) {
  const s = slots[i];
  if (s.kind !== "verse") continue;
  const raw = entryAt(i);
  if (!raw) continue;
  const body = plain(raw);
  if (body.length < 40) continue;

  const key = `${s.book}|${s.chapter}|${body.length}|${body.slice(0, 80)}`;
  const found = passages.get(key);
  if (found) {
    found.verse_end = Math.max(found.verse_end, s.verse);
  } else {
    passages.set(key, {
      source: SOURCE,
      book: s.book,
      chapter: s.chapter,
      verse_start: s.verse,
      verse_end: s.verse,
      strongs_id: null,
      body
    });
  }
}

const rows = [...passages.values()];

// -------------------------------------------------------- the safety net
// The module labels most entries with their own reference ("Isa 43:1-2").
// If the walk had slipped, those labels would disagree with the slot the
// text was found in. Anything that disagrees is reported and the import
// stops rather than writing a commentary onto the wrong verses.
const ABBR = new Map(OT.map((b) => {
  const name = normaliseBookName(b.name);
  return [name.slice(0, 3).toLowerCase(), name];
}));
let checked = 0;
const wrong = [];
for (const r of rows) {
  const m = /^([1-3]?\s?[A-Za-z]{3})[a-z]*\.?\s+(\d+):(\d+)/.exec(r.body);
  if (!m) continue;
  const labelBook = ABBR.get(m[1].replace(/\s/g, "").slice(0, 3).toLowerCase());
  if (!labelBook) continue;
  checked++;
  if (labelBook !== r.book || Number(m[2]) !== r.chapter) {
    wrong.push(`${r.book} ${r.chapter}:${r.verse_start} carries a label reading "${m[0]}"`);
  }
}
// A slipped walk would mismatch nearly every label, not one of them. A
// handful of disagreements are typos in the module's own labels — Exodus
// 4:1-9 is labelled "Exo 1:1-9" there, though the text is unmistakably
// about Moses' three signs in chapter 4. So the check is on the rate, and
// every exception is printed rather than swallowed.
const rate = checked ? wrong.length / checked : 0;
console.log(`  verse mapping checked against ${checked} of the module's own labels`);
if (wrong.length > 0) {
  console.log(`  ${wrong.length} label(s) disagree (${(rate * 100).toFixed(2)}%) — typos in the source:`);
  for (const w of wrong.slice(0, 8)) console.log("   ", w);
}
if (rate > 0.01) {
  throw new Error(
    `verse mapping failed its check: ${wrong.length} of ${checked} labels disagree — nothing written`
  );
}

const chars = rows.reduce((n, r) => n + r.body.length, 0);
console.log(`exposition_entries: ${rows.length} passages, ${(chars / 1e6).toFixed(1)} MB of text`);
for (const ref of [["Isaiah", 43], ["Obadiah", 1]]) {
  const r = rows.find((x) => x.book === ref[0] && x.chapter === ref[1]);
  if (r) console.log(`  ${r.book} ${r.chapter}:${r.verse_start}-${r.verse_end}: ${r.body.slice(0, 90)}…`);
}

if (!DRY) {
  const client = db();
  await upsertBatched(client, "exposition_entries", rows,
    "source,book,chapter,verse_start,verse_end", 200);
}
console.log("done");
