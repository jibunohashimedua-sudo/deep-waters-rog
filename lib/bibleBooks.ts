/**
 * The 66 books, everything the Bible browser needs to route and search.
 *
 * `abbr` is API.Bible's book id (GEN, 1CO …) and matches the abbreviations
 * already used by lib/plan.ts, so a chapter read here and the same chapter
 * read through the plan resolve to exactly the same API id.
 *
 * `slug` is what appears in the URL — /bible/genesis/1, /bible/1-corinthians/13.
 * Readable, shareable, and stable: never renumber or rename these, old links
 * would break.
 *
 * `aliases` exist so the search box finds a book the way people actually type
 * mid-service — "gen", "jn", "1 cor", "psalm", "song". Matching strips spaces
 * and punctuation, so "1cor", "1 cor" and "1 Cor." all arrive here the same.
 */

export type Testament = "ot" | "nt";

export type BookGroup =
  | "Law"
  | "History"
  | "Poetry"
  | "Major Prophets"
  | "Minor Prophets"
  | "Gospels"
  | "Acts"
  | "Paul's Letters"
  | "General Letters"
  | "Revelation";

export type BibleBook = {
  name: string;
  slug: string;
  abbr: string;
  chapters: number;
  testament: Testament;
  group: BookGroup;
  aliases: string[];
};

export const BIBLE_BOOKS: BibleBook[] = [
  // ---- Law ----
  { name: "Genesis", slug: "genesis", abbr: "GEN", chapters: 50, testament: "ot", group: "Law", aliases: ["gen", "ge", "gn"] },
  { name: "Exodus", slug: "exodus", abbr: "EXO", chapters: 40, testament: "ot", group: "Law", aliases: ["exo", "ex", "exod"] },
  { name: "Leviticus", slug: "leviticus", abbr: "LEV", chapters: 27, testament: "ot", group: "Law", aliases: ["lev", "lv"] },
  { name: "Numbers", slug: "numbers", abbr: "NUM", chapters: 36, testament: "ot", group: "Law", aliases: ["num", "nm", "nu"] },
  { name: "Deuteronomy", slug: "deuteronomy", abbr: "DEU", chapters: 34, testament: "ot", group: "Law", aliases: ["deut", "deu", "dt"] },

  // ---- History ----
  { name: "Joshua", slug: "joshua", abbr: "JOS", chapters: 24, testament: "ot", group: "History", aliases: ["josh", "jos", "jsh"] },
  { name: "Judges", slug: "judges", abbr: "JDG", chapters: 21, testament: "ot", group: "History", aliases: ["judg", "jdg", "jg"] },
  { name: "Ruth", slug: "ruth", abbr: "RUT", chapters: 4, testament: "ot", group: "History", aliases: ["rut", "rth", "ru"] },
  { name: "1 Samuel", slug: "1-samuel", abbr: "1SA", chapters: 31, testament: "ot", group: "History", aliases: ["1sa", "1sam", "1s", "firstsamuel", "isamuel"] },
  { name: "2 Samuel", slug: "2-samuel", abbr: "2SA", chapters: 24, testament: "ot", group: "History", aliases: ["2sa", "2sam", "2s", "secondsamuel", "iisamuel"] },
  { name: "1 Kings", slug: "1-kings", abbr: "1KI", chapters: 22, testament: "ot", group: "History", aliases: ["1ki", "1kgs", "1k", "firstkings", "ikings"] },
  { name: "2 Kings", slug: "2-kings", abbr: "2KI", chapters: 25, testament: "ot", group: "History", aliases: ["2ki", "2kgs", "2k", "secondkings", "iikings"] },
  { name: "1 Chronicles", slug: "1-chronicles", abbr: "1CH", chapters: 29, testament: "ot", group: "History", aliases: ["1ch", "1chr", "1chron", "firstchronicles"] },
  { name: "2 Chronicles", slug: "2-chronicles", abbr: "2CH", chapters: 36, testament: "ot", group: "History", aliases: ["2ch", "2chr", "2chron", "secondchronicles"] },
  { name: "Ezra", slug: "ezra", abbr: "EZR", chapters: 10, testament: "ot", group: "History", aliases: ["ezr", "ez"] },
  { name: "Nehemiah", slug: "nehemiah", abbr: "NEH", chapters: 13, testament: "ot", group: "History", aliases: ["neh", "ne"] },
  { name: "Esther", slug: "esther", abbr: "EST", chapters: 10, testament: "ot", group: "History", aliases: ["est", "esth", "es"] },

  // ---- Poetry ----
  { name: "Job", slug: "job", abbr: "JOB", chapters: 42, testament: "ot", group: "Poetry", aliases: ["jb"] },
  { name: "Psalms", slug: "psalms", abbr: "PSA", chapters: 150, testament: "ot", group: "Poetry", aliases: ["psa", "ps", "psalm", "pss"] },
  { name: "Proverbs", slug: "proverbs", abbr: "PRO", chapters: 31, testament: "ot", group: "Poetry", aliases: ["pro", "prov", "pr", "prv"] },
  { name: "Ecclesiastes", slug: "ecclesiastes", abbr: "ECC", chapters: 12, testament: "ot", group: "Poetry", aliases: ["ecc", "eccl", "ec", "qoheleth"] },
  { name: "Song of Songs", slug: "song-of-songs", abbr: "SNG", chapters: 8, testament: "ot", group: "Poetry", aliases: ["sng", "song", "songofsolomon", "sos", "canticles", "ss"] },

  // ---- Major Prophets ----
  { name: "Isaiah", slug: "isaiah", abbr: "ISA", chapters: 66, testament: "ot", group: "Major Prophets", aliases: ["isa", "is"] },
  { name: "Jeremiah", slug: "jeremiah", abbr: "JER", chapters: 52, testament: "ot", group: "Major Prophets", aliases: ["jer", "jr"] },
  { name: "Lamentations", slug: "lamentations", abbr: "LAM", chapters: 5, testament: "ot", group: "Major Prophets", aliases: ["lam", "la"] },
  { name: "Ezekiel", slug: "ezekiel", abbr: "EZK", chapters: 48, testament: "ot", group: "Major Prophets", aliases: ["ezk", "ezek", "eze"] },
  { name: "Daniel", slug: "daniel", abbr: "DAN", chapters: 12, testament: "ot", group: "Major Prophets", aliases: ["dan", "dn"] },

  // ---- Minor Prophets ----
  { name: "Hosea", slug: "hosea", abbr: "HOS", chapters: 14, testament: "ot", group: "Minor Prophets", aliases: ["hos", "ho"] },
  { name: "Joel", slug: "joel", abbr: "JOL", chapters: 3, testament: "ot", group: "Minor Prophets", aliases: ["jol", "joe", "jl"] },
  { name: "Amos", slug: "amos", abbr: "AMO", chapters: 9, testament: "ot", group: "Minor Prophets", aliases: ["amo", "am"] },
  { name: "Obadiah", slug: "obadiah", abbr: "OBA", chapters: 1, testament: "ot", group: "Minor Prophets", aliases: ["oba", "obad", "ob"] },
  { name: "Jonah", slug: "jonah", abbr: "JON", chapters: 4, testament: "ot", group: "Minor Prophets", aliases: ["jon", "jnh"] },
  { name: "Micah", slug: "micah", abbr: "MIC", chapters: 7, testament: "ot", group: "Minor Prophets", aliases: ["mic", "mc"] },
  { name: "Nahum", slug: "nahum", abbr: "NAM", chapters: 3, testament: "ot", group: "Minor Prophets", aliases: ["nam", "nah", "na"] },
  { name: "Habakkuk", slug: "habakkuk", abbr: "HAB", chapters: 3, testament: "ot", group: "Minor Prophets", aliases: ["hab", "hb"] },
  { name: "Zephaniah", slug: "zephaniah", abbr: "ZEP", chapters: 3, testament: "ot", group: "Minor Prophets", aliases: ["zep", "zeph", "zp"] },
  { name: "Haggai", slug: "haggai", abbr: "HAG", chapters: 2, testament: "ot", group: "Minor Prophets", aliases: ["hag", "hg"] },
  { name: "Zechariah", slug: "zechariah", abbr: "ZEC", chapters: 14, testament: "ot", group: "Minor Prophets", aliases: ["zec", "zech", "zc"] },
  { name: "Malachi", slug: "malachi", abbr: "MAL", chapters: 4, testament: "ot", group: "Minor Prophets", aliases: ["mal", "ml"] },

  // ---- Gospels ----
  { name: "Matthew", slug: "matthew", abbr: "MAT", chapters: 28, testament: "nt", group: "Gospels", aliases: ["mat", "matt", "mt"] },
  { name: "Mark", slug: "mark", abbr: "MRK", chapters: 16, testament: "nt", group: "Gospels", aliases: ["mrk", "mk", "mar"] },
  { name: "Luke", slug: "luke", abbr: "LUK", chapters: 24, testament: "nt", group: "Gospels", aliases: ["luk", "lk"] },
  { name: "John", slug: "john", abbr: "JHN", chapters: 21, testament: "nt", group: "Gospels", aliases: ["jhn", "jn", "joh"] },

  // ---- Acts ----
  { name: "Acts", slug: "acts", abbr: "ACT", chapters: 28, testament: "nt", group: "Acts", aliases: ["act", "ac"] },

  // ---- Paul's Letters ----
  { name: "Romans", slug: "romans", abbr: "ROM", chapters: 16, testament: "nt", group: "Paul's Letters", aliases: ["rom", "ro", "rm"] },
  { name: "1 Corinthians", slug: "1-corinthians", abbr: "1CO", chapters: 16, testament: "nt", group: "Paul's Letters", aliases: ["1co", "1cor", "1corinthians", "firstcorinthians", "icorinthians"] },
  { name: "2 Corinthians", slug: "2-corinthians", abbr: "2CO", chapters: 13, testament: "nt", group: "Paul's Letters", aliases: ["2co", "2cor", "2corinthians", "secondcorinthians", "iicorinthians"] },
  { name: "Galatians", slug: "galatians", abbr: "GAL", chapters: 6, testament: "nt", group: "Paul's Letters", aliases: ["gal", "ga"] },
  { name: "Ephesians", slug: "ephesians", abbr: "EPH", chapters: 6, testament: "nt", group: "Paul's Letters", aliases: ["eph", "ep"] },
  { name: "Philippians", slug: "philippians", abbr: "PHP", chapters: 4, testament: "nt", group: "Paul's Letters", aliases: ["php", "phil", "pp"] },
  { name: "Colossians", slug: "colossians", abbr: "COL", chapters: 4, testament: "nt", group: "Paul's Letters", aliases: ["col", "cl"] },
  { name: "1 Thessalonians", slug: "1-thessalonians", abbr: "1TH", chapters: 5, testament: "nt", group: "Paul's Letters", aliases: ["1th", "1thess", "1thes", "firstthessalonians"] },
  { name: "2 Thessalonians", slug: "2-thessalonians", abbr: "2TH", chapters: 3, testament: "nt", group: "Paul's Letters", aliases: ["2th", "2thess", "2thes", "secondthessalonians"] },
  { name: "1 Timothy", slug: "1-timothy", abbr: "1TI", chapters: 6, testament: "nt", group: "Paul's Letters", aliases: ["1ti", "1tim", "firsttimothy"] },
  { name: "2 Timothy", slug: "2-timothy", abbr: "2TI", chapters: 4, testament: "nt", group: "Paul's Letters", aliases: ["2ti", "2tim", "secondtimothy"] },
  { name: "Titus", slug: "titus", abbr: "TIT", chapters: 3, testament: "nt", group: "Paul's Letters", aliases: ["tit", "ti"] },
  { name: "Philemon", slug: "philemon", abbr: "PHM", chapters: 1, testament: "nt", group: "Paul's Letters", aliases: ["phm", "phlm", "philem"] },

  // ---- General Letters ----
  { name: "Hebrews", slug: "hebrews", abbr: "HEB", chapters: 13, testament: "nt", group: "General Letters", aliases: ["heb", "hb"] },
  { name: "James", slug: "james", abbr: "JAS", chapters: 5, testament: "nt", group: "General Letters", aliases: ["jas", "jam", "jm"] },
  { name: "1 Peter", slug: "1-peter", abbr: "1PE", chapters: 5, testament: "nt", group: "General Letters", aliases: ["1pe", "1pet", "1pt", "firstpeter"] },
  { name: "2 Peter", slug: "2-peter", abbr: "2PE", chapters: 3, testament: "nt", group: "General Letters", aliases: ["2pe", "2pet", "2pt", "secondpeter"] },
  { name: "1 John", slug: "1-john", abbr: "1JN", chapters: 5, testament: "nt", group: "General Letters", aliases: ["1jn", "1jo", "1john", "firstjohn"] },
  { name: "2 John", slug: "2-john", abbr: "2JN", chapters: 1, testament: "nt", group: "General Letters", aliases: ["2jn", "2jo", "2john", "secondjohn"] },
  { name: "3 John", slug: "3-john", abbr: "3JN", chapters: 1, testament: "nt", group: "General Letters", aliases: ["3jn", "3jo", "3john", "thirdjohn"] },
  { name: "Jude", slug: "jude", abbr: "JUD", chapters: 1, testament: "nt", group: "General Letters", aliases: ["jud", "jd"] },

  // ---- Revelation ----
  { name: "Revelation", slug: "revelation", abbr: "REV", chapters: 22, testament: "nt", group: "Revelation", aliases: ["rev", "rv", "apocalypse", "revelations"] }
];

/** Group order as they appear on the picker, per testament. */
export const OT_GROUPS: BookGroup[] = ["Law", "History", "Poetry", "Major Prophets", "Minor Prophets"];
export const NT_GROUPS: BookGroup[] = ["Gospels", "Acts", "Paul's Letters", "General Letters", "Revelation"];

const BY_SLUG = new Map(BIBLE_BOOKS.map((b) => [b.slug, b]));
const BY_ABBR = new Map(BIBLE_BOOKS.map((b) => [b.abbr, b]));
const BY_NAME = new Map(BIBLE_BOOKS.map((b) => [b.name.toLowerCase(), b]));

export function bookBySlug(slug: string): BibleBook | null {
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

export function bookByAbbr(abbr: string): BibleBook | null {
  return BY_ABBR.get(abbr.toUpperCase()) ?? null;
}

/** The plan stores book *names* ("1 Samuel"), so completions map back this way. */
export function bookByName(name: string): BibleBook | null {
  return BY_NAME.get(name.trim().toLowerCase()) ?? null;
}

export function booksInGroup(group: BookGroup): BibleBook[] {
  return BIBLE_BOOKS.filter((b) => b.group === group);
}

/** Strip everything that isn't a letter or digit: "1 Cor." and "1cor" match. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Filter books for the search box. Ranked so the most likely intent wins:
 * an exact abbreviation or alias first, then names that start with what was
 * typed, then names that merely contain it. An empty query returns
 * everything, so the picker can render the full grid unfiltered.
 */
export function searchBooks(query: string): BibleBook[] {
  const q = normalise(query);
  if (!q) return BIBLE_BOOKS;

  const scored: { book: BibleBook; score: number }[] = [];
  for (const book of BIBLE_BOOKS) {
    const name = normalise(book.name);
    const slug = normalise(book.slug);
    const abbr = normalise(book.abbr);
    const aliases = book.aliases.map(normalise);

    let score = -1;
    if (abbr === q || aliases.includes(q)) score = 0;
    else if (name === q || slug === q) score = 1;
    else if (aliases.some((a) => a.startsWith(q))) score = 2;
    else if (name.startsWith(q) || slug.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 4;

    if (score >= 0) scored.push({ book, score });
  }

  // Ties keep canonical order, which is what people expect from a Bible.
  return scored
    .sort((a, b) => a.score - b.score || BIBLE_BOOKS.indexOf(a.book) - BIBLE_BOOKS.indexOf(b.book))
    .map((s) => s.book);
}

/**
 * Walk one chapter forward or back across the whole Bible, so Genesis 50
 * rolls into Exodus 1 and Malachi 4 into Matthew 1. Returns null at the two
 * ends — Genesis 1 has no previous, Revelation 22 no next.
 */
export function stepChapter(
  book: BibleBook,
  chapter: number,
  direction: 1 | -1
): { book: BibleBook; chapter: number } | null {
  const next = chapter + direction;
  if (next >= 1 && next <= book.chapters) return { book, chapter: next };

  const i = BIBLE_BOOKS.indexOf(book);
  const neighbour = BIBLE_BOOKS[i + direction];
  if (!neighbour) return null;
  return {
    book: neighbour,
    chapter: direction === 1 ? 1 : neighbour.chapters
  };
}
