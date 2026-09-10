import type { BenchMode } from "./bench";

/**
 * How wide the Bench is, and where the divider between it and the reader
 * sits.
 *
 * THIS FILE IS THE ONE PLACE THE WIDTH IS DECIDED.
 *
 * It used to be nine hard-coded lengths in globals.css — three widths for
 * three jobs: the Bench's own width, the padding that keeps the reader
 * clear of it, and the right edge of the verse toolbar. Changing the split
 * meant changing all nine and hoping you found them all. Now the number is
 * computed here, written once to the CSS custom property below, and every
 * rule in the stylesheet reads that property. There is nothing to keep in
 * step by hand.
 */

/** The property every rule reads. Set on <html>. */
export const BENCH_WIDTH_VAR = "--bench-w";

/**
 * The three places the divider likes to rest, as the Bench's share of the
 * window. Tune these; nothing else needs to change.
 */
export const SNAPS = [
  { id: "read", label: "Read", fraction: 0.34 },
  { id: "balanced", label: "Balanced", fraction: 0.5 },
  { id: "study", label: "Study", fraction: 0.66 }
] as const;

export const BALANCED = SNAPS[1].fraction;

/**
 * Where the Bench starts out in each layout, before anyone has dragged it.
 * These are the widths the app has always used, so nothing jumps for
 * someone who never touches the divider.
 */
export const DEFAULT_FRACTION: Record<BenchMode, number> = {
  sheet: 1,      // not a column; unused
  split: 0.46,
  desk: 0.62,
  wide: 0.66
};

/**
 * The floors. Below these a pane stops being narrow and starts being
 * useless, so the divider stops rather than letting either side collapse.
 *
 * The reader's floor is a comfortable line of scripture: about 45 to 50
 * characters of Literata once its own side padding is taken off.
 *
 * The Bench's floor assumes the harder case — the lens column carrying
 * Greek and a lexicon entry, with the Notes column reflowed below it
 * rather than sitting beside it. Notes dropping below is what keeps this
 * number honest; reserving room for a 300px Notes column here would cost
 * the reader 300px it does not need to lose.
 */
export const READER_MIN_PX = 440;
export const BENCH_MIN_PX = 380;

/** Under this, there is no honest split to be had and the Bench is a sheet. */
export const SPLIT_MIN_WINDOW_PX = READER_MIN_PX + BENCH_MIN_PX;

/**
 * Widths at which the inside of the Bench rearranges.
 *
 * Not container queries: the Bench renders the reference picker and the
 * sermon picker, both fixed to the viewport, and inline-size containment
 * would make the Bench their containing block and trap them inside it.
 * The width is already known here, so the Bench is told what it has.
 */
export const NOTES_BESIDE_MIN_PX = 660;   // lens column + gap + 300px Notes
export const RACK_TWO_MIN_PX = 1000;      // two columns of panels

/** How near a snap the pull starts, as a fraction of the window. */
export const SNAP_RANGE = 0.06;

/** How hard it pulls at the centre of that range. 1 would be a hard snap. */
export const SNAP_STRENGTH = 0.85;

/** One arrow-key press, as a fraction of the window. */
export const KEY_STEP = 0.02;

/**
 * Pull the raw pointer position gently towards a resting place.
 *
 * Not a jump: the pull is strongest exactly on a snap and fades to nothing
 * at the edge of its range, so the divider lingers at Read, Balanced and
 * Study without ever refusing a width in between. Push on and it lets go.
 */
export function applySnap(fraction: number): number {
  let best = fraction;
  let bestDistance = SNAP_RANGE;
  for (const snap of SNAPS) {
    const distance = Math.abs(fraction - snap.fraction);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = snap.fraction;
    }
  }
  if (best === fraction) return fraction;
  const t = bestDistance / SNAP_RANGE;      // 0 on the snap, 1 at the edge
  const pull = (1 - t) ** 2 * SNAP_STRENGTH;
  return fraction + (best - fraction) * pull;
}

/** Keep both sides above their floors, whatever the pointer asks for. */
export function clampFraction(fraction: number, windowWidth: number): number {
  if (windowWidth <= 0) return fraction;
  const min = BENCH_MIN_PX / windowWidth;
  const max = 1 - READER_MIN_PX / windowWidth;
  if (min > max) return fraction;           // too narrow to honour both
  return Math.min(Math.max(fraction, min), max);
}

/** The Bench's width in pixels, which is the number the stylesheet wants. */
export function widthFor(fraction: number, windowWidth: number): number {
  return Math.round(clampFraction(fraction, windowWidth) * windowWidth);
}

// ----------------------------------------------------------------- storage
//
// Per device and per layout, so the split someone likes on a desktop is not
// forced on the same account's iPad, and portrait and landscape can differ.

const KEY = "dw:bench-split";

export function storageKey(mode: BenchMode): string {
  return `${KEY}:${mode}`;
}

export function readStoredFraction(mode: BenchMode): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(mode));
    if (!raw) return null;
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 && n < 1 ? n : null;
  } catch {
    // A browser with site data switched off still gets a working divider,
    // it just does not remember where it was left.
    return null;
  }
}

export function writeStoredFraction(mode: BenchMode, fraction: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(mode), String(fraction));
  } catch {
    /* nothing to do, and nothing worth telling the reader about */
  }
}
