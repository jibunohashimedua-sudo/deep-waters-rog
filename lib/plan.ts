// The 90-day Deep Waters reading plan.
// OT + NT interleaved, both streams finish on day 90.
// KJV chapter counts.

type Book = { name: string; abbr: string; chapters: number };

const OT_BOOKS: Book[] = [
  { name: "Genesis", abbr: "GEN", chapters: 50 },
  { name: "Exodus", abbr: "EXO", chapters: 40 },
  { name: "Leviticus", abbr: "LEV", chapters: 27 },
  { name: "Numbers", abbr: "NUM", chapters: 36 },
  { name: "Deuteronomy", abbr: "DEU", chapters: 34 },
  { name: "Joshua", abbr: "JOS", chapters: 24 },
  { name: "Judges", abbr: "JDG", chapters: 21 },
  { name: "Ruth", abbr: "RUT", chapters: 4 },
  { name: "1 Samuel", abbr: "1SA", chapters: 31 },
  { name: "2 Samuel", abbr: "2SA", chapters: 24 },
  { name: "1 Kings", abbr: "1KI", chapters: 22 },
  { name: "2 Kings", abbr: "2KI", chapters: 25 },
  { name: "1 Chronicles", abbr: "1CH", chapters: 29 },
  { name: "2 Chronicles", abbr: "2CH", chapters: 36 },
  { name: "Ezra", abbr: "EZR", chapters: 10 },
  { name: "Nehemiah", abbr: "NEH", chapters: 13 },
  { name: "Esther", abbr: "EST", chapters: 10 },
  { name: "Job", abbr: "JOB", chapters: 42 },
  { name: "Psalms", abbr: "PSA", chapters: 150 },
  { name: "Proverbs", abbr: "PRO", chapters: 31 },
  { name: "Ecclesiastes", abbr: "ECC", chapters: 12 },
  { name: "Song of Songs", abbr: "SNG", chapters: 8 },
  { name: "Isaiah", abbr: "ISA", chapters: 66 },
  { name: "Jeremiah", abbr: "JER", chapters: 52 },
  { name: "Lamentations", abbr: "LAM", chapters: 5 },
  { name: "Ezekiel", abbr: "EZK", chapters: 48 },
  { name: "Daniel", abbr: "DAN", chapters: 12 },
  { name: "Hosea", abbr: "HOS", chapters: 14 },
  { name: "Joel", abbr: "JOL", chapters: 3 },
  { name: "Amos", abbr: "AMO", chapters: 9 },
  { name: "Obadiah", abbr: "OBA", chapters: 1 },
  { name: "Jonah", abbr: "JON", chapters: 4 },
  { name: "Micah", abbr: "MIC", chapters: 7 },
  { name: "Nahum", abbr: "NAM", chapters: 3 },
  { name: "Habakkuk", abbr: "HAB", chapters: 3 },
  { name: "Zephaniah", abbr: "ZEP", chapters: 3 },
  { name: "Haggai", abbr: "HAG", chapters: 2 },
  { name: "Zechariah", abbr: "ZEC", chapters: 14 },
  { name: "Malachi", abbr: "MAL", chapters: 4 }
];

const NT_BOOKS: Book[] = [
  { name: "Matthew", abbr: "MAT", chapters: 28 },
  { name: "Mark", abbr: "MRK", chapters: 16 },
  { name: "Luke", abbr: "LUK", chapters: 24 },
  { name: "John", abbr: "JHN", chapters: 21 },
  { name: "Acts", abbr: "ACT", chapters: 28 },
  { name: "Romans", abbr: "ROM", chapters: 16 },
  { name: "1 Corinthians", abbr: "1CO", chapters: 16 },
  { name: "2 Corinthians", abbr: "2CO", chapters: 13 },
  { name: "Galatians", abbr: "GAL", chapters: 6 },
  { name: "Ephesians", abbr: "EPH", chapters: 6 },
  { name: "Philippians", abbr: "PHP", chapters: 4 },
  { name: "Colossians", abbr: "COL", chapters: 4 },
  { name: "1 Thessalonians", abbr: "1TH", chapters: 5 },
  { name: "2 Thessalonians", abbr: "2TH", chapters: 3 },
  { name: "1 Timothy", abbr: "1TI", chapters: 6 },
  { name: "2 Timothy", abbr: "2TI", chapters: 4 },
  { name: "Titus", abbr: "TIT", chapters: 3 },
  { name: "Philemon", abbr: "PHM", chapters: 1 },
  { name: "Hebrews", abbr: "HEB", chapters: 13 },
  { name: "James", abbr: "JAS", chapters: 5 },
  { name: "1 Peter", abbr: "1PE", chapters: 5 },
  { name: "2 Peter", abbr: "2PE", chapters: 3 },
  { name: "1 John", abbr: "1JN", chapters: 5 },
  { name: "2 John", abbr: "2JN", chapters: 1 },
  { name: "3 John", abbr: "3JN", chapters: 1 },
  { name: "Jude", abbr: "JUD", chapters: 1 },
  { name: "Revelation", abbr: "REV", chapters: 22 }
];

export type Chapter = { book: string; abbr: string; chapter: number };
export type DayReading = {
  day: number;
  ot: Chapter[];
  nt: Chapter[];
};

function flatten(books: Book[]): Chapter[] {
  const out: Chapter[] = [];
  for (const b of books) {
    for (let c = 1; c <= b.chapters; c++) {
      out.push({ book: b.name, abbr: b.abbr, chapter: c });
    }
  }
  return out;
}

function distribute(items: Chapter[], days: number): Chapter[][] {
  const base = Math.floor(items.length / days);
  const extra = items.length % days;
  const buckets: Chapter[][] = [];
  let idx = 0;
  for (let i = 0; i < days; i++) {
    const size = base + (i < extra ? 1 : 0);
    buckets.push(items.slice(idx, idx + size));
    idx += size;
  }
  return buckets;
}

const otChapters = flatten(OT_BOOKS);
const ntChapters = flatten(NT_BOOKS);
const otPerDay = distribute(otChapters, 90);
const ntPerDay = distribute(ntChapters, 90);

export const READING_PLAN: DayReading[] = Array.from({ length: 90 }, (_, i) => ({
  day: i + 1,
  ot: otPerDay[i],
  nt: ntPerDay[i]
}));

export function formatReading(chapters: Chapter[]): string {
  if (chapters.length === 0) return "";
  const runs: { book: string; s: number; e: number }[] = [];
  for (const ch of chapters) {
    const last = runs[runs.length - 1];
    if (last && last.book === ch.book && last.e === ch.chapter - 1) {
      last.e = ch.chapter;
    } else {
      runs.push({ book: ch.book, s: ch.chapter, e: ch.chapter });
    }
  }
  return runs
    .map((r) => (r.s === r.e ? `${r.book} ${r.s}` : `${r.book} ${r.s} to ${r.e}`))
    .join("; ");
}

// Build a passage ID for API.Bible fetching. Uses first chapter of each run.
export function buildPassageIds(chapters: Chapter[]): string[] {
  return chapters.map((c) => `${c.abbr}.${c.chapter}`);
}

import { daysBetweenLocal, todayISOForUser, parseISODate } from "./dates";

/**
 * Which day of the plan the reader is on.
 *
 * `startDate` is the reader's own start (from `profiles.start_date`) as a
 * YYYY-MM-DD string. `todayISO` is today in the reader's own timezone —
 * server callers hand in `todayForCurrentRequest()` (which reads the
 * `dw_tz` cookie), client callers pass `todayISOForUser()` off the
 * browser's `Intl.DateTimeFormat`. Omitting `todayISO` falls back to UTC
 * and is one day off for some timezones — the /today banner tells the
 * reader about a possible ± 1 day shift while the cookie propagates.
 *
 * Was `new Date(iso).setHours(0,0,0,0)` compared as epoch ms, which drifted
 * by ± 1 day in west-of-UTC timezones and by ± 1 hour across DST changes.
 * This is calendar-only maths — no `Date` construction from ISO input, no
 * `.setHours` — so neither drift is reachable any more.
 */
export function currentDayNumber(
  startDate: string | Date,
  todayISO?: string
): number {
  const startISO = normaliseStart(startDate);
  const today = todayISO ?? todayISOForUser(null);
  const diff = daysBetweenLocal(startISO, today);
  return Math.max(1, Math.min(90, diff + 1));
}

function normaliseStart(v: string | Date): string {
  if (typeof v === "string") {
    // Trust the ISO date prefix; parseISODate throws on anything malformed.
    parseISODate(v);
    return v.slice(0, 10);
  }
  // Kept for backwards compatibility with the few call sites that already
  // hand in a Date. Read UTC parts so we're not at the mercy of the
  // runtime's default timezone — which on Vercel is UTC anyway.
  const y = v.getUTCFullYear();
  const m = String(v.getUTCMonth() + 1).padStart(2, "0");
  const d = String(v.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ---------------------------------------------------------------------------
// Chapter → plan day
//
// Every chapter of all 66 books appears in the 90-day plan exactly once, so
// any chapter can be traced back to the day it belongs to. The free Bible
// browser uses this to file a highlight or a verse note under the same day
// it would have had if it had been made on /read — same rows, same shape,
// nothing special-cased.
//
// It does NOT make the day complete. Completions are written only by the
// "mark day complete" flow; reading and highlighting never touch that table.
// ---------------------------------------------------------------------------

const CHAPTER_TO_DAY = new Map<string, { day: number; testament: "ot" | "nt" }>();
for (let i = 0; i < 90; i++) {
  for (const c of otPerDay[i]) {
    CHAPTER_TO_DAY.set(`${c.book}|${c.chapter}`, { day: i + 1, testament: "ot" });
  }
  for (const c of ntPerDay[i]) {
    CHAPTER_TO_DAY.set(`${c.book}|${c.chapter}`, { day: i + 1, testament: "nt" });
  }
}

export function planDayForChapter(
  book: string,
  chapter: number
): { day: number; testament: "ot" | "nt" } | null {
  return CHAPTER_TO_DAY.get(`${book}|${chapter}`) ?? null;
}

/**
 * Which chapters of one book fall on days the reader has already completed.
 * Used to mark chapters quietly on the chapter picker.
 */
export function readChaptersForBook(book: string, completedDays: Iterable<number>): Set<number> {
  const out = new Set<number>();
  for (const day of completedDays) {
    const reading = READING_PLAN[day - 1];
    if (!reading) continue;
    for (const c of [...reading.ot, ...reading.nt]) {
      if (c.book === book) out.add(c.chapter);
    }
  }
  return out;
}
