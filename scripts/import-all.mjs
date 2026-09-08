// Load every study dataset, in order, idempotently.
//
//   node scripts/fetch-datasets.mjs     # once, to get the sources
//   node scripts/import-all.mjs         # safe to re-run
//
// Each step upserts on a natural key, so a re-run updates in place and
// never duplicates. Row counts are read back from the tables at the end.
import { db, countRows, DRY } from "./lib-db.mjs";

const steps = [
  ["strongs_entries + lexicons", "./import-strongs.mjs"],
  ["kjv_verses + verse_words", "./import-verse-words.mjs"],
  ["cross_refs", "./import-cross-refs.mjs"],
  ["commentary_entries", "./import-commentary.mjs"]
];

for (const [label, mod] of steps) {
  console.log(`\n── ${label} ─────────────────────────────`);
  await import(mod);
}

if (!DRY) {
  const client = db();
  console.log("\n── row counts ───────────────────────────");
  for (const t of ["strongs_entries", "kjv_verses", "verse_words", "cross_refs", "commentary_entries", "vines_entries"]) {
    console.log(`  ${t.padEnd(20)} ${await countRows(client, t)}`);
  }
}
