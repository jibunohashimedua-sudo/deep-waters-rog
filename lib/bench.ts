/**
 * The Bench's shared vocabulary: its lenses, and the layout it is in.
 *
 * Both live here rather than inside a component so the sheet, the split
 * column and the desk rack are all describing the same seven things in the
 * same order, and so a layout mode can be reasoned about without opening
 * the renderer.
 */

export type LensId =
  | "translations"
  | "words"
  | "wordstudy"
  | "concordance"
  | "crossrefs"
  | "commentary"
  | "house";

export type Lens = {
  id: LensId;
  /** The tab label. Mono, uppercase, as every label in this system is. */
  label: string;
  /** Where this lens's content comes from, printed at its foot. */
  source: string;
  /** True while the dataset behind it has not been loaded. */
  pending?: boolean;
  /** Lenses the word rail aims at. */
  takesWord?: boolean;
};

export const LENSES: Lens[] = [
  {
    id: "translations",
    label: "Translations",
    source: "API.Bible, the same editions as Compare"
  },
  {
    id: "words",
    label: "Words",
    source:
      "Strong's tagging of the KJV (CrossWire Sword module, public domain, via scrollmapper/bible_databases, MIT). Greek: TBESG/Abbott-Smith, STEPBible.org, CC BY 4.0. Hebrew: Strong's + Brown-Driver-Briggs, OpenScriptures Hebrew Bible, CC BY 4.0",
    takesWord: true
  },
  {
    id: "wordstudy",
    label: "Word study",
    source:
      "Old Testament: Keil and Delitzsch, Biblical Commentary on the Old Testament (1864), public domain — CrossWire module KD. New Testament: A. T. Robertson, Word Pictures in the New Testament — CrossWire module RWP; volumes 1–4 public domain, volumes 5–6 © Broadman Press, used under the module's free non-commercial distribution licence",
    takesWord: true
  },
  {
    id: "concordance",
    label: "Concordance",
    source:
      "Strong's tagging of the KJV (CrossWire Sword module, public domain, via scrollmapper/bible_databases, MIT)",
    takesWord: true
  },
  {
    id: "crossrefs",
    label: "Cross refs",
    source:
      "Treasury of Scripture Knowledge, ranked by readers — OpenBible.info, CC BY 4.0"
  },
  {
    id: "commentary",
    label: "Commentary",
    source:
      "Matthew Henry's Commentary on the Whole Bible, public domain — revisedcommonversion/matthew-henry-commentary, CC0 1.0"
  },
  {
    id: "house",
    label: "The house",
    source: "Reflections your church shared to the community feed"
  }
];

export const LENS_BY_ID = new Map(LENSES.map((l) => [l.id, l]));

/**
 * Where Stack mode's reveal counter starts.
 *
 * Stack shows all seven lenses at once and lets them in one at a time, so
 * a stacked Bench fills from the top instead of firing seven queries at
 * the same moment. The counter advances when a visible lens finishes
 * loading.
 *
 * It used to start at 0, and that was a deadlock: index 0 is Translations,
 * which loads through useParallelRows rather than useStudyLens and had no
 * way to report that it had settled. Nothing advanced the counter, so
 * index 1 never became visible, and four lenses sat there telling the
 * reader "no cross references for this verse" about a verse they had never
 * been asked about. ELITE_EXCELLENCE_AUDIT P1-A.
 *
 * Two lenses are live from the first frame now, so the chain has two
 * independent ways to take its first step. That matters because one lens
 * in the middle of the list cannot always load at all: the Concordance
 * needs a chosen word, and a verse the KJV numbers differently has none.
 * With two starters the chain steps past it instead of stopping on it.
 */
export const STACK_SEED = 1;

/** The word rail shows on these, and in Stack. */
export const WORD_LENSES: LensId[] = LENSES.filter((l) => l.takesWord).map(
  (l) => l.id
);

/**
 * The four layouts, chosen on the CSS viewport and never on a user agent.
 *
 *   sheet  — under 600px wide and at least 500px tall. A phone held upright.
 *   split  — 600–1023px, and *any* width under 500px tall. Two columns.
 *   desk   — 1024px and up. Reader, panels, notepad.
 *   wide   — 1500px and up. Desk, with the panels in two columns.
 *
 * The height rule beats the width rule on purpose: a sheet at 86% of a
 * 390px-tall window leaves nothing of the chapter behind it, which is the
 * one thing the sheet exists to keep.
 */
export type BenchMode = "sheet" | "split" | "desk" | "wide";

/** Where the fold is, when the browser will tell us. */
export type Segments = "none" | "horizontal" | "vertical";

export function modeForViewport(
  width: number,
  height: number,
  segments: Segments = "none"
): BenchMode {
  // A folded-open phone hands us two segments. Follow them rather than the
  // width, and let the CSS align the boundary to the seam.
  if (segments === "horizontal" && width < 1024) return "split";
  if (segments === "vertical" && width < 1024) return "split";
  if (width >= 1500) return "wide";
  if (width >= 1024) return "desk";
  if (width >= 600) return "split";
  return height < 500 ? "split" : "sheet";
}

/** True where the Bench is a sheet over the chapter rather than a column. */
export function isSheetMode(mode: BenchMode): boolean {
  return mode === "sheet";
}

/** True where every panel is on screen at once, so tabs give way to a rack. */
export function isRackMode(mode: BenchMode): boolean {
  return mode === "desk" || mode === "wide";
}

/** Desk presets. Each is an ordered set of panels, nothing more. */
export const PRESETS: { id: string; label: string; panels: LensId[] }[] = [
  {
    id: "sermon",
    label: "Sermon prep",
    panels: ["translations", "crossrefs", "commentary", "house"]
  },
  { id: "word", label: "Word study", panels: ["words", "wordstudy", "concordance"] },
  { id: "devotional", label: "Devotional", panels: ["translations", "house"] },
  {
    id: "everything",
    label: "Everything",
    panels: LENSES.map((l) => l.id)
  }
];
