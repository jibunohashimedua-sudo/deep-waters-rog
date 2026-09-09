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
 *      <span data-number="1" class="v verse-num">1</span>
 *      <span class="verse-text">In the beginning...</span></span>
 *      <span class="dw-verse" data-verse="2">
 *      <span data-number="2" class="v verse-num">2</span>
 *      <span class="verse-text">The earth was...</span></span></p>
 *
 * Two children, always, in that order. `.dw-verse` is a two-column grid
 * and the number hangs in the first column, the way a printed Bible sets
 * it — so the left edge of the serif column is flush all the way down and
 * nothing in the prose has to make room for a number.
 *
 * The body has to be wrapped for that to work at all. A grid container
 * makes a grid item of every child, and a run of bare text becomes one
 * anonymous item — so a verse carrying any inline markup (the KJV's
 * italicised supplied words, the words of Christ) would shatter into a
 * cell per fragment. `.verse-text` is what keeps a verse one thing.
 *
 * The marker keeps its own class and its attributes; `verse-num` is added
 * alongside `v` rather than replacing it, because `lib/verseFragments.ts`
 * strips `.v` when it reads a verse back as plain text.
 *
 * A verse is a verse id, not a paragraph.
 * ---------------------------------------------------------------------
 * Poetry and quoted speech are why that is worth saying out loud. A
 * translation that sets a quotation as verse lines returns one verse in
 * several paragraphs, and only the first of them carries a number:
 *
 *   <p class="p"><span class="v" data-sid="MAT 4:4">4</span>But Jesus told
 *      him, “No! The Scriptures say,</p>
 *   <p data-vid="MAT 4:4" class="q1">‘People do not live by bread alone,</p>
 *   <p data-vid="MAT 4:4" class="q2">but by every word…’”</p>
 *
 * All three are Matthew 4:4. This used to hand back any paragraph with no
 * marker in it untouched, so those two poetry lines carried no verse id at
 * all: they couldn't be highlighted, selected, copied or noted, and a
 * highlight on verse 4 painted the first line and stopped at the quote.
 *
 * So the current verse is carried across paragraph boundaries. API.Bible
 * names the owner itself on a continuation paragraph, in
 * `data-vid="MAT 4:4"`, and that is used wherever it appears; the last
 * marker seen is the fallback for a translation that doesn't send it. A
 * section heading breaks the carry, because a heading belongs to the
 * chapter rather than to the verse above it.
 *
 * Continuation fragments are marked `data-dw-part="cont"`, on the span and
 * on its paragraph, so the styling can treat a run of them as one verse:
 * one tap target, one note dot, and no paragraph gap opening up inside a
 * highlight band.
 *
 * Runs per-paragraph so a verse never straddles a </p>, which keeps
 * the DOM well-formed even when API.Bible splits chapters strangely.
 */

// Matches a verse marker span, capturing the verse number.
const MARKER_RE = /<span[^>]*class="[^"]*\bv\b[^"]*"[^>]*>\s*(\d+)\s*<\/span>/g;

// Matches a whole <p …>…</p> block. `[\s\S]` because paragraphs can
// contain newlines, and `?` because we want the *nearest* </p>.
const PARAGRAPH_RE = /<p(\s[^>]*)?>([\s\S]*?)<\/p>/g;

// Section headings, reference lines and descriptive titles: the paragraph
// classes that sit between verses without belonging to one.
const HEADING_CLASS_RE = /class="[^"]*\b(?:s|s1|s2|s3|ms|ms1|mr|r|d|sp|qa)\b[^"]*"/;

// The owner API.Bible names on a continuation paragraph: data-vid="MAT 4:4".
// The verse is whatever follows the colon, which is the last run of digits.
const VID_RE = /\bdata-vid="[^"]*?(\d+)"/;

/** Nothing but tags and whitespace — an empty stanza break, typically
    `<p class="b"></p>`. There is no verse in it to wrap. */
function isBlank(inner: string): boolean {
  return inner.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() === "";
}

/** The empty first column a continuation fragment needs to stay in line
    with the verse it belongs to. A poetry line has no number of its own;
    it still has to sit under the one above it. */
const EMPTY_NUM = '<span class="verse-num" aria-hidden="true"></span>';

const contSpan = (verse: number, inner: string) =>
  `<span class="dw-verse" data-verse="${verse}" data-dw-part="cont">` +
  `${EMPTY_NUM}<span class="verse-text">${inner}</span></span>`;

/** Adds `verse-num` to the marker's class list, leaving everything else
    about the span — `data-number`, `data-sid` — exactly as it arrived. */
function asVerseNum(markerHtml: string): string {
  return markerHtml.replace(
    /class="([^"]*)"/,
    (_m, cls: string) => `class="${cls} verse-num"`
  );
}

/**
 * One paragraph's inner HTML, with each verse wrapped.
 *
 * `carry` is the verse the paragraph opens in — either the one API.Bible
 * named on it, or the last one seen. Returns the verse the *next*
 * paragraph opens in (the last marker in this one, or `carry` unchanged
 * when there wasn't one), and whether this paragraph opened inside the
 * verse before it.
 */
function wrapVersesInParagraph(
  inner: string,
  carry: number | null
): { html: string; carry: number | null; continues: boolean } {
  const markers: { num: string; start: number; end: number; raw: string }[] = [];
  MARKER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER_RE.exec(inner)) !== null) {
    markers.push({
      num: m[1],
      start: m.index,
      end: m.index + m[0].length,
      raw: m[0]
    });
  }

  // No number in this paragraph: it continues the verse before it. That is
  // a poetry line, a quoted line, or a sentence broken across a paragraph
  // — one verse either way.
  if (markers.length === 0) {
    if (carry === null) return { html: inner, carry, continues: false };
    return { html: contSpan(carry, inner), carry, continues: true };
  }

  let out = "";
  let continues = false;

  // Text before the first marker. It belongs to the verse that was running
  // when the paragraph opened, so it is wrapped as a continuation rather
  // than left outside every verse the way it used to be.
  if (markers[0].start > 0) {
    const lead = inner.slice(0, markers[0].start);
    if (carry !== null && !isBlank(lead)) {
      out += contSpan(carry, lead);
      continues = true;
    } else {
      out += lead;
    }
  }

  for (let i = 0; i < markers.length; i++) {
    const stop = i + 1 < markers.length ? markers[i + 1].start : inner.length;
    // The marker becomes the first grid cell; everything up to the next
    // marker becomes the second. Splitting here rather than in the browser
    // is what lets the column widths be set in CSS alone.
    const body = inner.slice(markers[i].end, stop);
    out +=
      `<span class="dw-verse" data-verse="${markers[i].num}">` +
      `${asVerseNum(markers[i].raw)}<span class="verse-text">${body}</span></span>`;
  }

  const last = Number.parseInt(markers[markers.length - 1].num, 10);
  return { html: out, carry: Number.isFinite(last) ? last : carry, continues };
}

export function wrapVersesInHtml(html: string): string {
  // Carried across paragraphs — the whole point. See the note about
  // Matthew 4:4 at the top of this file.
  let carry: number | null = null;

  return html.replace(PARAGRAPH_RE, (_full, attrs, inner) => {
    const attrStr: string = attrs || "";

    // A heading is not part of the verse above it, and the verse after one
    // always opens with its own number, so the carry stops here.
    if (HEADING_CLASS_RE.test(attrStr)) {
      carry = null;
      return `<p${attrStr}>${inner}</p>`;
    }

    // API.Bible names the owner outright on a continuation paragraph.
    // Trust that over the running count wherever both are present.
    const vid = VID_RE.exec(attrStr);
    const named = vid ? Number.parseInt(vid[1], 10) : NaN;
    if (Number.isFinite(named)) carry = named;

    // An empty stanza break carries no words, so there is nothing to wrap
    // — wrapping it would put a 44px tap target in the middle of a poem.
    // It is still flagged as inside a verse so the styling can close the
    // gap it would otherwise open in a highlight band.
    if (isBlank(inner)) {
      const marker = carry !== null ? ' data-dw-part="cont"' : "";
      return `<p${attrStr}${marker}>${inner}</p>`;
    }

    const result = wrapVersesInParagraph(inner, carry);
    carry = result.carry;

    return `<p${attrStr}${result.continues ? ' data-dw-part="cont"' : ""}>${result.html}</p>`;
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
 * How many words of scripture are in a chapter.
 *
 * The automatic chapter tracker asks how long a chapter ought to take, and
 * the only honest answer comes from the chapter itself — Psalm 119 is not
 * Psalm 117. Verse numbers are stripped first so a chapter isn't credited
 * with a word for every marker in it.
 */
export function countWordsInHtml(html: string): number {
  const withoutMarkers = html.replace(new RegExp(MARKER_RE.source, "g"), " ");
  const text = stripToText(withoutMarkers);
  if (!text) return 0;
  return text.split(/\s+/).length;
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
 *
 * This one has always read whole verses, poetry included: it slices between
 * one marker and the next across the entire chapter rather than paragraph by
 * paragraph, so a continuation line falls inside the slice on its own. That
 * is why Compare and the highlight list never showed the gap the reader
 * could see on the page.
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
