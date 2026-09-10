"use client";
import { useEffect, useState } from "react";
import { modeForViewport, type BenchMode, type Segments } from "@/lib/bench";
import { SPLIT_MIN_WINDOW_PX } from "@/lib/benchSplit";

/**
 * Which layout the Bench is in, measured and never guessed.
 *
 * There is no device detection here and there must not be. iPad Split View
 * and Stage Manager can hand a 320px window to a large tablet, and a folding
 * phone changes width halfway through a session.
 *
 * The measurements come from matchMedia rather than from window.innerWidth.
 * Media queries *are* the CSS viewport — the same thing the stylesheet is
 * reading — where innerWidth is the window and includes a classic
 * scrollbar; and a media query fires its own change event, which a resize
 * listener does not always get when the viewport changes underneath a page
 * (a fold, a Split View drag, a rotation that keeps the same window). The
 * resize and orientation listeners stay as belt and braces.
 *
 * Each query answers one threshold from the rule table in lib/bench.ts, and
 * the answers are turned back into a representative width and height so the
 * rule itself lives in exactly one place.
 */
// The width is read in buckets, one per threshold the rule table cares
// about — and the smallest-split threshold has to be one of them. Without
// its own step, a 834px iPad in portrait was measured as "600 or more",
// compared against a minimum well above 600, and sent to a sheet: the
// number was right and the thing it was measured against was not. The step
// is interpolated from the constant rather than written out, so it follows
// the floors whenever they move.
const WIDTH_STEPS: [string, number][] = [
  ["(min-width: 1500px)", 1500],
  ["(min-width: 1024px)", 1024],
  [`(min-width: ${SPLIT_MIN_WINDOW_PX}px)`, SPLIT_MIN_WINDOW_PX],
  ["(min-width: 600px)", 600]
];
const TALL = "(min-height: 500px)";
const SEGMENT_QUERIES = [
  "(horizontal-viewport-segments: 2)",
  "(vertical-viewport-segments: 2)"
];

type Layout = { mode: BenchMode; segments: Segments };

export function useBenchLayout(): Layout {
  const [state, setState] = useState<Layout>(() => read());

  useEffect(() => {
    const measure = () =>
      setState((prev) => {
        const next = read();
        return prev.mode === next.mode && prev.segments === next.segments
          ? prev
          : next;
      });
    measure();

    const queries = [...WIDTH_STEPS.map(([q]) => q), TALL, ...SEGMENT_QUERIES]
      .map((q) => safeQuery(q))
      .filter((q): q is MediaQueryList => q !== null);
    for (const q of queries) q.addEventListener?.("change", measure);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      for (const q of queries) q.removeEventListener?.("change", measure);
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  return state;
}

function read(): Layout {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { mode: "sheet", segments: "none" };
  }
  const segments: Segments = matches("(horizontal-viewport-segments: 2)")
    ? "horizontal"
    : matches("(vertical-viewport-segments: 2)")
      ? "vertical"
      : "none";
  const width = WIDTH_STEPS.find(([q]) => matches(q))?.[1] ?? 599;
  const height = matches(TALL) ? 500 : 499;
  return { mode: modeForViewport(width, height, segments), segments };
}

function safeQuery(query: string): MediaQueryList | null {
  try {
    return window.matchMedia(query);
  } catch {
    // A browser that has never heard of viewport segments throws rather
    // than answering false. A device with one screen is the same answer.
    return null;
  }
}

function matches(query: string): boolean {
  return safeQuery(query)?.matches ?? false;
}
