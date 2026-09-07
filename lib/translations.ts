/**
 * The translations we offer, and the rules for when one can't be used.
 *
 * This list is not the API.Bible catalogue. It was built by test-fetching
 * real chapters with our own key and comparing verse counts — the catalogue
 * lists plenty we either cannot serve or should not, and a picker where half
 * the options fail is worse than a short one.
 *
 * Two things are deliberately encoded rather than discovered at runtime:
 *
 *   `missing`  — books the translation genuinely doesn't carry. The Septuagint
 *                has no New Testament; Targum Onkelos is the Torah only. We
 *                fall back to the KJV for those and say so.
 *
 *   `diverges` — books where the translation is *available* but numbered on a
 *                different tradition, so it would quietly mis-place highlights
 *                and verse notes. Only Douay-Rheims has this: it numbers the
 *                Psalms on the Greek/Latin tradition, so its Psalm 23 is the
 *                Psalm 24 everyone else knows, and it counts the superscription
 *                as a verse besides. A chapter remap wouldn't save it — the
 *                verses inside don't line up either. So Psalms falls back.
 */

export const DEFAULT_BIBLE_ID = "de4e12af7f28f599-02"; // KJV, the long-standing default

export type TranslationGroup = "Complete Bibles" | "Study editions";

export type Translation = {
  id: string;
  abbr: string;
  name: string;
  group: TranslationGroup;
  /** One short line for the picker. */
  note: string;
  /** Book abbreviations this translation does not carry at all. */
  missing?: string[];
  /** Books it carries but numbers on a different tradition. */
  diverges?: string[];
};

const OT_ABBRS = "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL".split(" ");
const NT_ABBRS = "MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" ");
const TORAH = ["GEN", "EXO", "LEV", "NUM", "DEU"];

export const TRANSLATIONS: Translation[] = [
  // ---- Complete Bibles: all 66 books, verse numbering verified ----
  { id: DEFAULT_BIBLE_ID, abbr: "KJV", name: "King James Version", group: "Complete Bibles", note: "The classic. Our default." },
  { id: "78a9f6124f344018-01", abbr: "NIV", name: "New International Version", group: "Complete Bibles", note: "Modern and widely read." },
  { id: "63097d2a0a2f7db3-01", abbr: "NKJV", name: "New King James Version", group: "Complete Bibles", note: "The King James in today's English." },
  { id: "d6e14a625393b4da-01", abbr: "NLT", name: "New Living Translation", group: "Complete Bibles", note: "Thought for thought, very readable." },
  { id: "43e315b442a7c862-01", abbr: "NLTUK", name: "New Living Translation, Anglicised", group: "Complete Bibles", note: "The NLT with British spelling." },
  { id: "bba9f40183526463-01", abbr: "BSB", name: "Berean Standard Bible", group: "Complete Bibles", note: "Modern and closely literal." },
  { id: "06125adad2d5898a-01", abbr: "ASV", name: "American Standard Version", group: "Complete Bibles", note: "Formal and precise, from 1901." },
  { id: "40072c4a5aba4022-01", abbr: "RV", name: "Revised Version 1885", group: "Complete Bibles", note: "The King James's first revision." },
  { id: "c315fa9f71d4af3a-01", abbr: "GNV", name: "Geneva Bible", group: "Complete Bibles", note: "The Reformers' Bible, before the KJV." },
  { id: "55212e3cf5d04d49-01", abbr: "KJVCPB", name: "Cambridge Paragraph Bible", group: "Complete Bibles", note: "The KJV set as paragraphs, not verses." },
  { id: "01b29f4b342acc35-01", abbr: "LSV", name: "Literal Standard Version", group: "Complete Bibles", note: "Very literal, keeps the Hebrew tenses." },
  { id: "65eec8e0b60e656b-01", abbr: "FBV", name: "Free Bible Version", group: "Complete Bibles", note: "Plain contemporary English." },
  { id: "66c22495370cdfc0-01", abbr: "T4T", name: "Translation for Translators", group: "Complete Bibles", note: "Spells out what the text implies." },
  { id: "c89622d31b60c444-02", abbr: "TOJB", name: "The Orthodox Jewish Bible", group: "Complete Bibles", note: "Hebrew and Yiddish names throughout." },
  { id: "9879dbb7cfe39e4d-04", abbr: "WEB", name: "World English Bible", group: "Complete Bibles", note: "Modern, freely given." },
  { id: "7142879509583d59-04", abbr: "WEBBE", name: "World English Bible, British", group: "Complete Bibles", note: "The WEB with British spelling." },
  { id: "72f4e6dc683324df-01", abbr: "WEBU", name: "World English Bible Updated", group: "Complete Bibles", note: "The WEB, freshly revised." },
  { id: "32664dc3288a28df-01", abbr: "WEBUS", name: "World English Bible, American", group: "Complete Bibles", note: "The WEB in American English." },
  { id: "f72b840c855f362c-04", abbr: "WMB", name: "World Messianic Bible", group: "Complete Bibles", note: "The WEB with Hebrew names." },
  { id: "04da588535d2f823-04", abbr: "WMBBE", name: "World Messianic Bible, British", group: "Complete Bibles", note: "Hebrew names, British spelling." },
  {
    id: "179568874c45066f-01",
    abbr: "DRA",
    name: "Douay-Rheims",
    group: "Complete Bibles",
    note: "The classic English Catholic Bible. Psalms shown in the KJV.",
    // Carries all 66, but numbers the Psalms on the Greek/Latin tradition.
    diverges: ["PSA"]
  },

  // ---- Study editions: real coverage gaps, handled by falling back ----
  {
    id: "bf8f1c7f3f9045a5-01",
    abbr: "OJPS",
    name: "JPS TaNaKH 1917",
    group: "Study editions",
    note: "The Jewish translation. Old Testament only.",
    missing: NT_ABBRS
  },
  {
    id: "65bfdebd704a8324-01",
    abbr: "Brenton",
    name: "Brenton's English Septuagint",
    group: "Study editions",
    note: "The Greek Old Testament the apostles quoted.",
    // No NT, and its Nehemiah/Esther/Daniel sit under Septuagint names.
    missing: [...NT_ABBRS, "NEH", "EST", "DAN"]
  },
  {
    id: "6bab4d6c61b31b80-01",
    abbr: "LXXup",
    name: "Brenton's Septuagint, updated spelling",
    group: "Study editions",
    note: "The same Greek Old Testament, easier to read.",
    missing: [...NT_ABBRS, "NEH", "EST", "DAN"]
  },
  {
    id: "32339cf2f720ff8e-01",
    abbr: "TCENT",
    name: "Text-Critical English New Testament",
    group: "Study editions",
    note: "Shows the manuscript variants. New Testament only.",
    missing: OT_ABBRS
  },
  {
    id: "ec290b5045ff54a5-01",
    abbr: "Onkelos",
    name: "Targum Onkelos (Etheridge)",
    group: "Study editions",
    note: "The Aramaic Torah. Genesis to Deuteronomy only.",
    missing: [...OT_ABBRS.filter((b) => !TORAH.includes(b)), ...NT_ABBRS]
  }
];

export const TRANSLATION_GROUPS: TranslationGroup[] = ["Complete Bibles", "Study editions"];

const BY_ID = new Map(TRANSLATIONS.map((t) => [t.id, t]));

export function translationById(id: string | null | undefined): Translation {
  return (id && BY_ID.get(id)) || BY_ID.get(DEFAULT_BIBLE_ID)!;
}

export function translationsInGroup(group: TranslationGroup): Translation[] {
  return TRANSLATIONS.filter((t) => t.group === group);
}

export type Resolved = {
  /** The translation to actually fetch. */
  id: string;
  /** What the reader chose, whether or not we could honour it. */
  chosen: Translation;
  /** Set when we had to use the KJV instead — copy for the reader. */
  fallbackNote: string | null;
};

/**
 * Decide which translation to fetch for one book. Everything the reader chose
 * is honoured unless the book genuinely isn't there, or is numbered on a
 * different tradition — in which case we serve the KJV and hand back a line
 * explaining why, rather than showing an error or, worse, the wrong chapter.
 */
export function resolveTranslation(
  chosenId: string | null | undefined,
  bookAbbr: string,
  bookName: string
): Resolved {
  const chosen = translationById(chosenId);
  if (chosen.id === DEFAULT_BIBLE_ID) {
    return { id: chosen.id, chosen, fallbackNote: null };
  }
  if (chosen.missing?.includes(bookAbbr)) {
    return {
      id: DEFAULT_BIBLE_ID,
      chosen,
      fallbackNote: `The ${chosen.abbr} doesn’t include ${bookName}, so this is the King James.`
    };
  }
  if (chosen.diverges?.includes(bookAbbr)) {
    return {
      id: DEFAULT_BIBLE_ID,
      chosen,
      fallbackNote: `The ${chosen.abbr} numbers ${bookName} differently from the rest of the app, so this is the King James — your highlights stay where you put them.`
    };
  }
  return { id: chosen.id, chosen, fallbackNote: null };
}
