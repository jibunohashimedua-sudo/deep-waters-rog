// The 66 books, read from the app's own list so the imports can never drift
// from what the reader shows. lib/bibleBooks.ts is the single source of truth
// for names, slugs and canonical order; this just parses it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "lib", "bibleBooks.ts"), "utf8");

const rows = [...src.matchAll(
  /\{\s*name:\s*"([^"]+)",\s*slug:\s*"([^"]+)",\s*abbr:\s*"([^"]+)"/g
)].map(([, name, slug, abbr], i) => ({ name, slug, abbr, index: i }));

if (rows.length !== 66) {
  throw new Error(`expected 66 books from lib/bibleBooks.ts, parsed ${rows.length}`);
}

export const BOOKS = rows;
export const byName = new Map(rows.map((b) => [b.name, b]));

/** OSIS book codes (Gen, Exod, 1Sam, Matt, Phlm, Rev …) → our book names. */
export const OSIS_TO_NAME = new Map(Object.entries({
  Gen:"Genesis", Exod:"Exodus", Lev:"Leviticus", Num:"Numbers", Deut:"Deuteronomy",
  Josh:"Joshua", Judg:"Judges", Ruth:"Ruth", "1Sam":"1 Samuel", "2Sam":"2 Samuel",
  "1Kgs":"1 Kings", "2Kgs":"2 Kings", "1Chr":"1 Chronicles", "2Chr":"2 Chronicles",
  Ezra:"Ezra", Neh:"Nehemiah", Esth:"Esther", Job:"Job", Ps:"Psalms", Prov:"Proverbs",
  Eccl:"Ecclesiastes", Song:"Song of Solomon", Isa:"Isaiah", Jer:"Jeremiah",
  Lam:"Lamentations", Ezek:"Ezekiel", Dan:"Daniel", Hos:"Hosea", Joel:"Joel",
  Amos:"Amos", Obad:"Obadiah", Jonah:"Jonah", Mic:"Micah", Nah:"Nahum",
  Hab:"Habakkuk", Zeph:"Zephaniah", Hag:"Haggai", Zech:"Zechariah", Mal:"Malachi",
  Matt:"Matthew", Mark:"Mark", Luke:"Luke", John:"John", Acts:"Acts",
  Rom:"Romans", "1Cor":"1 Corinthians", "2Cor":"2 Corinthians", Gal:"Galatians",
  Eph:"Ephesians", Phil:"Philippians", Col:"Colossians",
  "1Thess":"1 Thessalonians", "2Thess":"2 Thessalonians",
  "1Tim":"1 Timothy", "2Tim":"2 Timothy", Titus:"Titus", Phlm:"Philemon",
  Heb:"Hebrews", Jas:"James", "1Pet":"1 Peter", "2Pet":"2 Peter",
  "1John":"1 John", "2John":"2 John", "3John":"3 John", Jude:"Jude", Rev:"Revelation"
}));

/**
 * Book names as other people write them → ours.
 *
 * The Sword KJV uses Roman numerals ("I Samuel") and long forms
 * ("Revelation of John"); OSIS cross-references use codes; Matthew Henry's
 * files use slugs. Everything lands on the names in lib/bibleBooks.ts,
 * because those are the names the reader sees and the names the Bench
 * hands to a query.
 */
const ALIASES = new Map(Object.entries({
  "I Samuel":"1 Samuel", "II Samuel":"2 Samuel",
  "I Kings":"1 Kings", "II Kings":"2 Kings",
  "I Chronicles":"1 Chronicles", "II Chronicles":"2 Chronicles",
  "I Corinthians":"1 Corinthians", "II Corinthians":"2 Corinthians",
  "I Thessalonians":"1 Thessalonians", "II Thessalonians":"2 Thessalonians",
  "I Timothy":"1 Timothy", "II Timothy":"2 Timothy",
  "I Peter":"1 Peter", "II Peter":"2 Peter",
  "I John":"1 John", "II John":"2 John", "III John":"3 John",
  "Song of Solomon":"Song of Songs", "Canticles":"Song of Songs",
  "Revelation of John":"Revelation", "The Revelation":"Revelation",
  "Psalm":"Psalms"
}));

/** Any of the above spellings, or one of ours, → our book name or null. */
export function normaliseBookName(raw) {
  if (!raw) return null;
  const name = String(raw).trim();
  if (byName.has(name)) return name;
  const alias = ALIASES.get(name);
  return alias && byName.has(alias) ? alias : null;
}

/** 'G0025' / 'strong:H07225' / 'H430' → the canonical 'G25' / 'H7225'. */
export function canonicalStrongs(raw) {
  if (!raw) return null;
  const m = String(raw).match(/([GH])0*(\d+)([a-zA-Z]?)/);
  if (!m) return null;
  return `${m[1]}${Number.parseInt(m[2], 10)}${m[3] ? m[3].toUpperCase() : ""}`;
}
