// strongs_entries — one row per Strong's number.
//
// Greek  : TBESG, STEPBible.org (CC BY 4.0). Brief lexicon based on
//          Abbott-Smith, keyed to extended Strong's.
// Hebrew : Strong's Hebrew dictionary and Brown-Driver-Briggs, both from
//          the OpenScriptures Hebrew Bible project (CC BY 4.0), joined on
//          the project's own LexicalIndex so a Strong's number reaches its
//          BDB entry.
//
// Thayer's is not here. See the report: no edition of Thayer's could be
// found in a machine-readable form under a licence clean enough to import,
// so the Greek side is Abbott-Smith via TBESG and is labelled as such.
//
//   node scripts/import-strongs.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, DRY, db, upsertBatched } from "./lib-db.mjs";
import { canonicalStrongs } from "./books.mjs";

const GREEK_SOURCE = "TBESG (Abbott-Smith), STEPBible.org — CC BY 4.0";
const HEBREW_SOURCE = "Strong's Hebrew + Brown-Driver-Briggs, OpenScriptures Hebrew Bible — CC BY 4.0";

/** Strip the light HTML the lexicons carry, keeping the words. */
function clean(html) {
  return String(html ?? "")
    .replace(/<ref[^>]*>/g, "")
    .replace(/<\/ref>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseGreek() {
  const text = readFileSync(join(DATA, "TBESG.txt"), "utf8");
  const out = new Map();
  for (const line of text.split("\n")) {
    if (!/^G\d/.test(line)) continue;
    const f = line.split("\t");
    const id = canonicalStrongs(f[0]);
    if (!id || out.has(id)) continue;
    const gloss = (f[6] ?? "").trim();
    const full = clean(f[7]);
    const definition = [gloss, full].filter(Boolean).join(" — ");
    if (!definition) continue;
    out.set(id, {
      strongs_id: id,
      language: "greek",
      lemma: (f[3] ?? "").trim() || null,
      transliteration: (f[4] ?? "").trim() || null,
      definition,
      source: GREEK_SOURCE
    });
  }
  return [...out.values()];
}

/** Pull <entry id="…"> blocks out of one of the OSHB lexicon files. */
function entries(xml, tag = "entry") {
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`, "g");
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push({ attrs: m[1], body: m[2] });
  return out;
}
const attr = (attrs, name) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? null;
const tagText = (body, tag) => {
  const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(body);
  return m ? clean(m[1]) : null;
};

function parseHebrew() {
  const strongXml = readFileSync(join(DATA, "HebrewStrong.xml"), "utf8");
  const bdbXml = readFileSync(join(DATA, "BrownDriverBriggs.xml"), "utf8");
  const indexXml = readFileSync(join(DATA, "LexicalIndex.xml"), "utf8");

  // BDB entries by their own id.
  const bdb = new Map();
  for (const e of entries(bdbXml)) {
    const id = attr(e.attrs, "id");
    if (!id) continue;
    const def = clean(e.body);
    if (def) bdb.set(id, def);
  }

  // The index joins a Strong's number to a BDB entry. The join lives in an
  // attribute, not an element: <xref bdb="a.ab.ab" strong="3" twot="1a"/>.
  // Every BDB entry a number reaches, not just the first. BDB splits roots
  // into homonyms, and taking whichever xref came first in the file gave
  // H1254 "be fat" instead of "create". Keeping them all is what the source
  // actually says.
  const strongToBdb = new Map();
  for (const m of indexXml.matchAll(/<xref\b([^>]*)\/>/g)) {
    const bdbRef = attr(m[1], "bdb");
    const strong = attr(m[1], "strong");
    if (!bdbRef || !strong) continue;
    const id = canonicalStrongs("H" + strong);
    if (!id) continue;
    const list = strongToBdb.get(id) ?? [];
    if (!list.includes(bdbRef)) list.push(bdbRef);
    strongToBdb.set(id, list);
  }
  console.log(`  BDB join: ${strongToBdb.size} Strong's numbers reach a BDB entry`);

  const out = new Map();
  for (const e of entries(strongXml)) {
    const id = canonicalStrongs(attr(e.attrs, "id"));
    if (!id || out.has(id)) continue;
    const strongsDef = [tagText(e.body, "meaning"), tagText(e.body, "usage")]
      .filter(Boolean).join(" — ");
    const bdbDef = (strongToBdb.get(id) ?? [])
      .map((ref) => bdb.get(ref))
      .filter(Boolean)
      .join("  ·  ") || null;
    const definition = [strongsDef, bdbDef && `BDB: ${bdbDef}`]
      .filter(Boolean).join("  ").slice(0, 6000);
    if (!definition) continue;
    out.set(id, {
      strongs_id: id,
      language: "hebrew",
      lemma: tagText(e.body, "w") || null,
      transliteration: attr(/<w\b([^>]*)>/.exec(e.body)?.[1] ?? "", "xlit"),
      definition,
      source: HEBREW_SOURCE
    });
  }
  return [...out.values()];
}

const greek = parseGreek();
const hebrew = parseHebrew();
const rows = [...greek, ...hebrew];

console.log(`strongs_entries: ${greek.length} Greek + ${hebrew.length} Hebrew = ${rows.length}`);
console.log("  sample:", JSON.stringify(rows.find(r => r.strongs_id === "G25")).slice(0, 220));
console.log("  sample:", JSON.stringify(rows.find(r => r.strongs_id === "H430")).slice(0, 220));

if (!DRY) {
  const client = db();
  await upsertBatched(client, "strongs_entries", rows, "strongs_id", 1000);
}
console.log("done");
