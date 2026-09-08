"use client";

/** Does this reader want motion? Asked at the moment of the scroll, not
    cached, because the setting can change while the app is open. */
function reducedMotion(): boolean {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Bring an element to the top of its own scroller — and move nothing else.
 *
 * Deliberately not scrollIntoView: that walks up the tree and scrolls every
 * ancestor that can move, which on a phone means the page behind the Bench
 * slides too, and the chapter you were reading is somewhere else when you
 * close the sheet. This adjusts one container's scrollTop by the distance
 * between the two boxes, so nothing above it moves at all.
 */
export function scrollPaneTo(container: HTMLElement | null, target: HTMLElement | null): void {
  if (!container) return;
  const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
  if (!target) {
    container.scrollTo({ top: 0, behavior });
    return;
  }
  const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
  if (Math.abs(delta) < 1) return;
  container.scrollTo({ top: container.scrollTop + delta, behavior });
}

/**
 * Keep the chosen chip in view along a horizontal strip.
 *
 * Same rule: the strip scrolls, the page does not. The chip is nudged just
 * inside the edge it was hiding behind rather than centred, so the row
 * keeps the order the eye already had.
 */
export function scrollRailTo(rail: HTMLElement | null, chip: HTMLElement | null): void {
  if (!rail || !chip) return;
  const railBox = rail.getBoundingClientRect();
  const chipBox = chip.getBoundingClientRect();
  const pad = 16;
  let delta = 0;
  if (chipBox.left < railBox.left + pad) {
    delta = chipBox.left - railBox.left - pad;
  } else if (chipBox.right > railBox.right - pad) {
    delta = chipBox.right - railBox.right + pad;
  }
  if (delta === 0) return;
  rail.scrollTo({
    left: rail.scrollLeft + delta,
    behavior: reducedMotion() ? "auto" : "smooth"
  });
}
