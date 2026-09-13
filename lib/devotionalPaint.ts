// Paint helper for devotional highlights and note markers.
//
// Given a block's plain text and the placed highlights / notes that fall
// inside it, produce the HTML the reader sees. Every character is
// escaped; wrappers and markers only ever wrap or follow plain text
// runs. The result is deterministic — running the paint twice on the
// same inputs gives identical HTML — so re-running on every render is
// safe.
//
// Overlap rule matches scripture: later-created highlight wins where
// two overlap, so a verse ends up wearing one colour rather than a
// blend. Notes are independent of highlights: a passage can be
// highlighted, noted, both, or neither.

import type { HighlightColour } from "./highlights";

export type PaintedHighlight = {
  id: string;
  range_id: string;
  offset: number;
  length: number;
  colour: HighlightColour;
  /** Milliseconds since epoch. Newer beats older on an overlap. */
  createdAtMs: number;
};

export type PaintedNote = {
  id: string;
  offset: number;
  length: number;
};

/**
 * Assemble the HTML for one block.
 *
 * `plainText` is the source of truth — never read the current DOM to
 * compute it, because the paint's whole job is to rewrite the DOM from
 * this string. `highlights` and `notes` are only the ones that fall
 * inside this block; the caller filters.
 */
export function paintBlock(
  plainText: string,
  highlights: PaintedHighlight[],
  notes: PaintedNote[]
): string {
  // Per-character colour (or null). Later beats earlier on overlap.
  const colours: Array<HighlightColour | null> = new Array(plainText.length).fill(null);
  const rangeIds: Array<string | null> = new Array(plainText.length).fill(null);

  const sorted = [...highlights].sort((a, b) => a.createdAtMs - b.createdAtMs);
  for (const h of sorted) {
    const start = Math.max(0, Math.min(plainText.length, h.offset));
    const end = Math.max(start, Math.min(plainText.length, h.offset + h.length));
    for (let i = start; i < end; i++) {
      colours[i] = h.colour;
      rangeIds[i] = h.range_id;
    }
  }

  // Note markers sorted by the END of the note's range. We emit each
  // marker immediately after the character at (offset + length - 1),
  // so a note on the whole highlighted run leaves its dot just past
  // the end of the run.
  const marks = [...notes]
    .map((n) => ({
      atCharIndex: Math.max(0, Math.min(plainText.length - 1, n.offset + n.length - 1)),
      id: n.id
    }))
    .sort((a, b) => a.atCharIndex - b.atCharIndex);

  let out = "";
  let currentColour: HighlightColour | null = null;
  let currentRangeId: string | null = null;
  let openWrapper = false;
  let markIndex = 0;

  const openWrap = (colour: HighlightColour, rangeId: string) => {
    out +=
      `<span class="dw-devo-hl" data-hl="${escapeAttr(colour)}"` +
      ` data-range-id="${escapeAttr(rangeId)}">`;
    openWrapper = true;
  };
  const closeWrap = () => {
    if (openWrapper) {
      out += "</span>";
      openWrapper = false;
    }
  };

  for (let i = 0; i < plainText.length; i++) {
    const c = colours[i];
    const r = rangeIds[i];

    if (c !== currentColour || r !== currentRangeId) {
      closeWrap();
      currentColour = c;
      currentRangeId = r;
      if (c && r) openWrap(c, r);
    }

    out += escapeHtml(plainText[i]);

    // A note marker fires immediately after its last character. If a
    // marker sits inside a highlight wrapper it lands inside the
    // wrapper, so its dot inherits the tint edge — that is deliberate.
    while (markIndex < marks.length && marks[markIndex].atCharIndex === i) {
      out +=
        `<span class="dw-devo-note-marker" data-note-id="${escapeAttr(marks[markIndex].id)}"` +
        ` aria-label="Note attached to this passage"></span>`;
      markIndex++;
    }
  }
  closeWrap();

  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * Compute the offset within `blockElement` of the given DOM point.
 *
 * The standard trick: create a Range from the block's start to the
 * point, ask for its toString() length. That is the plain-text offset
 * regardless of what wrappers or markers happen to be in the block.
 */
export function offsetIn(blockElement: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(blockElement);
  range.setEnd(node, offset);
  return range.toString().length;
}

/**
 * The plain-text length of a block element — accounting for any
 * `.dw-devo-note-marker` markers which have no textContent so already
 * cost zero characters, and for any wrapper spans which contain the
 * plain characters and so cost the right amount.
 *
 * Kept as a helper so a caller can compare against the stored block
 * length without having to know why textContent is right.
 */
export function blockLength(blockElement: HTMLElement): number {
  return blockElement.textContent?.length ?? 0;
}
