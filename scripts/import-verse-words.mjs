// verse_words — the KJV, one row per tagged word per Strong's number.
//
// Source: the CrossWire Sword KJV module (KJV text and its Strong's
// tagging are both public domain), repackaged as OSIS JSON by
// scrollmapper/bible_databases under the MIT licence.
//
// A <w> element wraps the English that renders one original-language word
// or phrase — "In the beginning" is one element carrying H7225 — and may
// carry more than one number. Each number becomes its own row, sharing the
// element's word_index, so the concordance finds the verse under either
// while the Words lens still groups by the phrase as printed.
//
//   node scripts/import-verse-words.mjs [--dry-run]
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA, DRY, db, upsertBatched } from "./lib-db.mjs";
import { byName, canonicalStrongs, normaliseBookName } from "./books.mjs";

const kjv = JSON.parse(readFileSync(join(DATA, "KJV-osis.json"), "utf8"));
const W = /<w\s+([^>]*?)>([\s\S]*?)<\/w>/g;

const rows = [];
const verseRows = [];
const unknown = new Set();
let verses = 0;

for (const book of kjv.books) {
  const name = normaliseBookName(book.name);
  if (!name) { unknown.add(book.name); continue; }
  const bookIndex = byName.get(name).index;

  for (const ch of book.chapters) {
    for (const v of ch.verses) {
      verses++;
      // The verse as the KJV prints it, tags stripped. The concordance and
      // the cross-reference lens both need real text to show.
      const plain = v.text
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .replace(/\s+([,.;:!?])/g, "$1")
        .trim();
      if (plain) {
        verseRows.push({
          book: name, chapter: ch.chapter, verse: v.verse,
          text: plain, book_index: bookIndex
        });
      }
      let wordIndex = 0;
      let m;
      // Self-closing <w .../> elements carry a Strong's number for an
      // original-language word the KJV renders with no English of its own
      // (articles, mostly). They must go before the paired elements are
      // read: left in, the "…/>" swallows the opening of the next real
      // word, and its number lands on the wrong English. That is how
      // John 3:16's "For" came out tagged G3588 instead of G1063.
      const text = v.text.replace(/<w\s[^>]*\/>/g, "");
      W.lastIndex = 0;
      while ((m = W.exec(text))) {
        // Drop any nested markup and keep the English as the reader sees it.
        const wordText = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        if (!wordText) continue;          // a self-closing <w/> with no English
        const lemma = /lemma="([^"]*)"/.exec(m[1])?.[1] ?? "";
        const ids = [...lemma.matchAll(/strong:([GH]\d+[a-zA-Z]?)/g)]
          .map((x) => canonicalStrongs(x[1]))
          .filter(Boolean);
        if (ids.length === 0) continue;   // untagged: supplied words, mostly
        wordIndex++;
        for (const id of new Set(ids)) {
          rows.push({
            book: name,
            chapter: ch.chapter,
            verse: v.verse,
            word_index: wordIndex,
            word_text: wordText,
            strongs_id: id,
            book_index: bookIndex
          });
        }
      }
    }
  }
}

if (unknown.size) throw new Error(`unmapped books: ${[...unknown].join(", ")}`);

console.log(`kjv_verses: ${verseRows.length} rows`);
console.log(`verse_words: ${rows.length} rows from ${verses} verses`);
console.log("  sample word:", JSON.stringify(rows.find(r => r.book === "John" && r.chapter === 3 && r.verse === 16)));
console.log("  sample verse:", JSON.stringify(verseRows.find(r => r.book === "John" && r.chapter === 3 && r.verse === 16)).slice(0, 220));

if (!DRY) {
  const client = db();
  await upsertBatched(client, "kjv_verses", verseRows, "book,chapter,verse", 1000);
  await upsertBatched(client, "verse_words", rows,
    "book,chapter,verse,word_index,strongs_id", 1000);
}
console.log("done");
