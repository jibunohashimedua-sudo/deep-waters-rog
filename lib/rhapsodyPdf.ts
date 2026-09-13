/**
 * Pull one day's article out of the monthly Rhapsody PDF.
 *
 * The devotional's layout is consistent: an article runs over two facing
 * pages, with the title set large in caps, the opening scripture in italic
 * under it, the article in the main serif, and the prayer or confession in
 * its own face at the end. Rather than guess at line order — which flips
 * between left- and right-hand pages — this reads the font each piece of
 * text is set in and where it sits on the page, and sorts it out from there.
 *
 * Nothing here is trusted blindly: whatever comes out is shown to an admin
 * to check and edit before members ever see it.
 */

type Item = { str: string; transform: number[]; width?: number };
type Cell = { x: number; w: number; str: string; key: string; size: number };
type Line = {
  y: number;
  x: number;
  text: string;
  key: string;
  size: number;
  dropStart?: boolean;
};

export type Article = {
  title: string;
  verse: string;
  body: string;
  prayerLabel: string;
  prayer: string;
};

const DAY_HEADER = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s*\d{1,2}$/i;
const FOOTER = /rhapsodyofrealities\.org|inspiring testimony|kingschat/i;
const PLAN_LABEL = /^(FURTHER STUDY:?|[12]-YEAR BIBLE READING PLAN)/i;
const PRAYER_LABEL = /^(PRAYER|CONFESSION)$/i;

const isCaps = (t: string) => /[A-Z]/.test(t) && t === t.toUpperCase();

/** A bare list of scripture references, as under "Further study". */
const isRefs = (t: string) =>
  /\d+:\d+/.test(t) &&
  !/\b(the|and|you|that|your|with|for|his|her|this|are|was|have|not|but)\b/i.test(
    t.replace(/\([^)]*\)/g, "")
  );

/** Text items -> visual lines, keeping position, font and size. */
function linesOf(items: Item[]): Line[] {
  const rows: { y: number; cells: Cell[] }[] = [];
  for (const it of items) {
    if (!it.str || !it.str.trim()) continue;
    const y = it.transform[5];
    const size = Math.round(Math.abs(it.transform[3]) * 10) / 10;
    const cell: Cell = {
      x: it.transform[4],
      w: it.width ?? 0,
      str: it.str,
      key: `${(it as { fontName?: string }).fontName}@${size}`,
      size
    };
    const row = rows.find((r) => Math.abs(r.y - y) <= 2.5);
    if (row) row.cells.push(cell);
    else rows.push({ y, cells: [cell] });
  }
  rows.sort((a, b) => b.y - a.y);

  // A drop cap sits on the baseline of the second line it spans, so it lands
  // in that row rather than on its own. Lift it out and remember where it was.
  let drop: { letter: string; x: number; w: number; y: number; size: number } | null = null;
  for (const r of rows) {
    r.cells.sort((a, b) => a.x - b.x);
    const c = r.cells[0];
    if (!c || drop) continue;
    const others = r.cells.slice(1);
    const rest = others.length ? Math.max(...others.map((o) => o.size)) : 0;
    if (c.str.trim().length === 1 && /[A-Za-z]/.test(c.str) && rest && c.size >= rest * 1.5) {
      drop = { letter: c.str.trim(), x: c.x, w: c.w, y: r.y, size: c.size };
      r.cells = others;
    }
  }

  const out: Line[] = rows
    .filter((r) => r.cells.length)
    .map((r) => {
      let text = "";
      r.cells.forEach((c, i) => {
        if (i > 0) {
          const p = r.cells[i - 1];
          if (c.x - (p.x + p.w) > 0.8 && !/\s$/.test(text) && !/^\s/.test(c.str)) text += " ";
        }
        text += c.str;
      });
      const chars: Record<string, number> = {};
      for (const c of r.cells) chars[c.key] = (chars[c.key] || 0) + c.str.length;
      return {
        y: r.y,
        x: r.cells[0].x,
        text: text.replace(/\s+/g, " ").trim(),
        key: Object.entries(chars).sort((a, b) => b[1] - a[1])[0][0],
        size: Math.max(...r.cells.map((c) => c.size))
      };
    })
    .filter((l) => l.text);

  // Put the lines that wrap around the drop cap back together, with the big
  // letter on the front where it belongs.
  if (drop) {
    const d = drop;
    const wrapped = out.filter(
      (l) => l.x >= d.x + d.w * 0.4 && l.y >= d.y - 1 && l.y <= d.y + d.size * 0.85
    );
    if (wrapped.length) {
      wrapped[0].text = d.letter + wrapped[0].text;
      wrapped[0].dropStart = true;
      for (let i = 1; i < wrapped.length; i++) {
        wrapped[0].text += " " + wrapped[i].text;
        out.splice(out.indexOf(wrapped[i]), 1);
      }
    }
  }
  return out;
}

const SMALL = new Set([
  "a","an","and","as","at","but","by","for","from","in","into","nor","of","on","onto",
  "or","the","to","up","upon","with","your","his","her","our","is","be"
]);

/** "SAY WHAT HE SAID" -> "Say What He Said", for headings that aren't shouted. */
export function titleCase(s: string): string {
  const words = s.toLowerCase().split(/(\s+)/);
  let wordIndex = 0;
  return words
    .map((w) => {
      if (/^\s+$/.test(w)) return w;
      const i = wordIndex++;
      const cased = w.replace(/(^|[—–-])([a-z])/g, (_, p, c) => p + c.toUpperCase());
      if (i > 0 && SMALL.has(w.replace(/[^a-z']/g, ""))) return w;
      return cased;
    })
    .join("");
}

type PageLines = { pn: number; lines: Line[] };

/** Assemble one article from the lines of the pages it runs across. */
export function articleFromLines(perPage: PageLines[]): Article {
  const all = perPage.flatMap((p) => p.lines.map((l) => ({ ...l, page: p.pn })));
  if (!all.length) return { title: "", verse: "", body: "", prayerLabel: "PRAYER", prayer: "" };

  const chars: Record<string, number> = {};
  for (const l of all) chars[l.key] = (chars[l.key] || 0) + l.text.length;
  const bodyKey = Object.entries(chars).sort((a, b) => b[1] - a[1])[0][0];

  const junk = (l: Line) =>
    /^\d{1,3}$/.test(l.text) ||
    DAY_HEADER.test(l.text) ||
    FOOTER.test(l.text) ||
    PLAN_LABEL.test(l.text) ||
    PRAYER_LABEL.test(l.text) ||
    (l.key === bodyKey && (isRefs(l.text) || / & /.test(l.text)));

  const first = perPage[0].pn;
  const pageA = all.filter((l) => l.page === first);
  const headSize = Math.max(0, ...pageA.filter((l) => isCaps(l.text) && !junk(l)).map((l) => l.size));
  const titleLines = pageA.filter((l) => isCaps(l.text) && l.size === headSize && !junk(l));
  const title = titleCase(titleLines.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim());

  const labelLine = all.find((l) => PRAYER_LABEL.test(l.text));
  const prayerLabel = labelLine ? labelLine.text.toUpperCase() : "PRAYER";

  // The opening scripture is the unbroken run of non-body lines under the
  // title. Quotes woven into the article use the same italic, so the font
  // alone can't tell them apart — position can.
  const verseLines: Line[] = [];
  const lastTitle = titleLines.length ? pageA.indexOf(titleLines[titleLines.length - 1]) : -1;
  if (lastTitle >= 0) {
    for (let i = lastTitle + 1; i < pageA.length; i++) {
      const l = pageA[i];
      if (junk(l)) continue;
      if (l.key === bodyKey) break;
      verseLines.push(l);
    }
  }

  // The prayer sits below the "PRAYER" (or "CONFESSION") heading on its own
  // page — anchor it by position, not by font. Font-counting was the old
  // trick and it broke on any day whose body carried an italic scripture
  // quote near the end: that italic outweighed the actual prayer on the
  // closing page, and the wrong lines ended up in the prayer field.
  //
  // Using the label's own coordinates: everything on the same page as the
  // label, below it (lower y — PDF y is bottom-up), and above whatever
  // junk() already recognises (Further study, the reading plan block, the
  // footer) is the prayer.
  let prayerLines: Line[] = [];
  if (labelLine) {
    const labelPage = (labelLine as Line & { page: number }).page;
    const labelY = labelLine.y;
    prayerLines = all.filter(
      (l) => (l as Line & { page: number }).page === labelPage && l.y < labelY && !junk(l)
    );
  } else {
    // No PRAYER / CONFESSION heading found — one of the odd Sunday variants,
    // or an article without a written prayer. Fall back to the font-frequency
    // guess so the field isn't empty.
    const pageB = all.filter((l) => l.page !== first && !junk(l));
    const counts: Record<string, number> = {};
    for (const l of pageB) if (l.key !== bodyKey) counts[l.key] = (counts[l.key] || 0) + l.text.length;
    const prayerKey = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    prayerLines = prayerKey ? pageB.filter((l) => l.key === prayerKey) : [];
  }

  const skip = new Set([...verseLines, ...prayerLines, ...titleLines].map((l) => `${l.y}:${l.text}`));
  const paras: string[] = [];
  for (const p of perPage) {
    const keep = p.lines.filter((l) => !junk(l) && !skip.has(`${l.y}:${l.text}`));
    if (!keep.length) continue;
    const left = Math.min(...keep.filter((l) => !l.dropStart).map((l) => l.x));
    keep.forEach((l, i) => {
      // An indented line starts a new paragraph; lines wrapping the drop cap don't.
      const newPara = i === 0 ? p.pn === first : !l.dropStart && l.x - left > 3;
      if (newPara || !paras.length) paras.push(l.text);
      else paras[paras.length - 1] += " " + l.text;
    });
  }

  const join = (ls: Line[]) => ls.map((l) => l.text).join(" ").replace(/\s+/g, " ").trim();
  return { title, verse: join(verseLines), body: paras.join("\n\n"), prayerLabel, prayer: join(prayerLines) };
}

export { linesOf };
