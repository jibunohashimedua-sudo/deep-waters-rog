/**
 * Wrap each verse in API.Bible's HTML with a `<span data-verse="N">…</span>`
 * so the client can highlight per-verse and identify the verse span
 * a text selection lives inside.
 *
 * API.Bible returns HTML like:
 *   <p class="p"><span data-number="1" class="v">1</span> In the beginning...
 *      <span data-number="2" class="v">2</span> The earth was...</p>
 *
 * After wrapping:
 *   <p class="p"><span class="dw-verse" data-verse="1">
 *      <span data-number="1" class="v">1</span> In the beginning... </span>
 *      <span class="dw-verse" data-verse="2">
 *      <span data-number="2" class="v">2</span> The earth was...</span></p>
 *
 * The verse marker (`<span class="v">…</span>`) stays untouched so the
 * existing pink superscript styling in globals.css keeps working.
 *
 * Runs per-paragraph so a verse never straddles a </p>, which keeps
 * the DOM well-formed even when API.Bible splits chapters strangely.
 */

// Matches a verse marker span, capturing the verse number.
const MARKER_RE = /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>\s*(\d+)\s*<\/span>/g;

// Matches a whole <p …>…</p> block. `[\s\S]` because paragraphs can
// contain newlines, and `?` because we want the *nearest* </p>.
const PARAGRAPH_RE = /<p(\s[^>]*)?>([\s\S]*?)<\/p>/g;

function wrapVersesInParagraph(inner: string): string {
  const markers: { num: string; start: number }[] = [];
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(inner)) !== null) {
    markers.push({ num: m[1], start: m.index });
  }
  if (markers.length === 0) return inner;

  let out = "";
  // Text before the first marker (rare, but keep it).
  if (markers[0].start > 0) out += inner.slice(0, markers[0].start);

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].start;
    const end = i + 1 < markers.length ? markers[i + 1].start : inner.length;
    const segment = inner.slice(start, end);
    out += `<span class="dw-verse" data-verse="${markers[i].num}">${segment}</span>`;
  }
  return out;
}

export function wrapVersesInHtml(html: string): string {
  return html.replace(PARAGRAPH_RE, (_full, attrs, inner) => {
    const wrapped = wrapVersesInParagraph(inner);
    return `<p${attrs || ""}>${wrapped}</p>`;
  });
}

/**
 * The highest verse number in a chapter's HTML.
 *
 * Used to size the verse grid on the chapter picker. It reads the markers
 * API.Bible already sent rather than a table of verse counts kept here,
 * because those counts differ between translations — the KJV, the ESV and
 * the Vulgate genuinely disagree about where verses fall, most visibly in
 * the Psalms where a Hebrew superscription is verse 1 in some traditions
 * and unnumbered in others. A hardcoded table would be right for whichever
 * translation it was typed from and quietly wrong for the rest.
 *
 * Returns the highest number rather than the count of markers, because some
 * translations merge verses under a single marker ("1-2") and a grid has to
 * reach the last verse, not the number of markers before it.
 */
export function countVersesInHtml(html: string): number {
  const re = new RegExp(MARKER_RE.source, "g");
  let highest = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return highest;
}

/**
 * Every verse in a chapter's HTML, as plain text, keyed by verse number.
 *
 * Depth lists highlights, and a list of references with no words in them is
 * a list of coordinates. The highlights table stores a book, a chapter and a
 * range — it has never stored the text — so the text has to be read back out
 * of the chapter HTML the shared cache already holds.
 *
 * Regex rather than a DOM, because this runs on the server where there is no
 * DOM, and the input is the same narrow shape of markup API.Bible has always
 * returned. It is only ever asked for display text: nothing downstream parses
 * or trusts it.
 */
export function verseTextsFromHtml(html: string): Map<number, string> {
  const out = new Map<number, string>();

  // Section headings, reference lines and descriptive titles sit between
  // verses in API.Bible's markup. They belong to the chapter, not to the
  // verse above them, so they go before anything is sliced.
  const body = html.replace(
    /<p[^>]*class="[^"]*\b(?:s|s1|s2|s3|ms|ms1|mr|r|d|sp|qa)\b[^"]*"[^>]*>[\s\S]*?<\/p>/g,
    " "
  );

  const re = new RegExp(MARKER_RE.source, "g");
  const marks: { num: number; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n)) {
      marks.push({ num: n, start: m.index, end: m.index + m[0].length });
    }
  }

  for (let i = 0; i < marks.length; i++) {
    const from = marks[i].end;
    const to = i + 1 < marks.length ? marks[i + 1].start : body.length;
    const text = stripToText(body.slice(from, to));
    if (!text) continue;
    // A translation can repeat a marker across a paragraph break; the
    // pieces are one verse, so they join rather than overwrite.
    const existing = out.get(marks[i].num);
    out.set(marks[i].num, existing ? `${existing} ${text}` : text);
  }

  return out;
}

/** Tags out, entities in, whitespace collapsed. */
function stripToText(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The text of a verse range, joined — "3" or "3–5". */
export function joinVerseRange(
  verses: Map<number, string>,
  start: number,
  end: number
): string {
  const parts: string[] = [];
  for (let v = start; v <= end; v++) {
    const t = verses.get(v);
    if (t) parts.push(t);
  }
  return parts.join(" ");
}
