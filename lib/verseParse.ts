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
