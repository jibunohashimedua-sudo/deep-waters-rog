/**
 * The significant words in a verse, for the Bench's word rail.
 *
 * This is a reading aid, not a lexicon. It takes the verse as it stands on
 * the page and drops the words nobody looks up — articles, pronouns,
 * auxiliaries, the connective tissue of English — so what is left is the
 * handful of words a study would actually reach for.
 *
 * The Strong's number attached to each word is a placeholder until the
 * dataset lands. It is written as a placeholder rather than guessed at: a
 * wrong Strong's number is worse than an absent one, because it looks
 * right.
 */

/** Words the rail never offers. Function words, not content words. */
const STOP = new Set(
  `a about after against all also am among an and any are as at be because been
   before being between both but by came can cannot come could did do does
   doing done down during each either else even ever every for from further had
   has hast hath have having he her here hers herself him himself his how i if
   in into is it its itself let like may me might mine more most must my myself
   neither nor not now o of off on once one only or other ought our ours
   ourselves out over own said same shall shalt she should since so some such
   than that the thee their theirs them themselves then there therefore these
   they thine this those thou though thy till to too under unto until up upon
   us very was we were what when where whether which while who whom whose why
   will with within without would ye yet you your yours yourself yourselves`
    .split(/\s+/)
    .filter(Boolean)
);

export type BenchWord = {
  /** The word as it is written in the verse, punctuation stripped. */
  word: string;
  /** Lowercased, for matching and for keys. */
  key: string;
  /** Null until the Strong's dataset is loaded. */
  strongs: string | null;
};

/** How many words the rail will carry. Past this it stops being a rail. */
const MAX_WORDS = 24;

/**
 * Pull the significant words out of a verse, in the order they are written.
 * Repeats are dropped — the rail is a set of words to look up, and the same
 * word twice is one thing to look up.
 */
export function significantWords(text: string): BenchWord[] {
  const out: BenchWord[] = [];
  const seen = new Set<string>();
  // Apostrophes and hyphens stay inside a word; everything else splits.
  const tokens = text.split(/[^A-Za-z’'’-]+/);
  for (const raw of tokens) {
    const word = raw.replace(/^[-'’]+|[-'’]+$/g, "");
    if (word.length < 3) continue;
    const key = word.toLowerCase();
    if (STOP.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push({ word, key, strongs: null });
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

/** What a word's number reads as while the dataset is still to come. */
export const STRONGS_PLACEHOLDER = "—";
