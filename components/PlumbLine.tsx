"use client";
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

/**
 * The plumb line.
 *
 * A 1px rule down the far left of the scripture column, a tick at every
 * verse, and a sonar marker that descends as you scroll. You are taking a
 * sounding, and the point of it is that you can see how deep you are —
 * how much of this passage is behind you, and how much is still under you.
 *
 * It is not a scrollbar. The marker is a fixed 20px and never grows, so it
 * reads as a bob on a line rather than as a proportion of a document. The
 * ticks come from the same verse elements the numbers do — measured off
 * `.verse-num`, which sits on the first baseline by construction — so the
 * ticks and the numbers cannot drift out of step with each other.
 *
 * Nothing here animates. The marker follows scroll and stops when scroll
 * stops: no easing, no trailing, no glow. And it is not hidden under
 * prefers-reduced-motion, because it is not motion — it is position, and
 * a reader who has asked for less movement has not asked to know less
 * about where they are.
 */
export default function PlumbLine({
  containerRef,
  onArrive
}: {
  containerRef: RefObject<HTMLDivElement>;
  /** True once the marker has reached the last tick. */
  onArrive?: (arrived: boolean) => void;
}) {
  const [ticks, setTicks] = useState<number[]>([]);
  const [height, setHeight] = useState(0);
  const [top, setTop] = useState(0);
  const [arrived, setArrived] = useState(false);
  // The tick is drawn, not styled, so its width can't come from a media
  // query — it is measured here instead and follows the same 380px line
  // the number column does.
  const [tick, setTick] = useState(TICK);

  // Measure after layout, and again whenever the column reflows — a font
  // swapping in, the Bench opening, a rotation. Measuring once on mount
  // put every tick a few pixels out the moment Literata landed.
  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const measure = () => {
      const rootTop = root.getBoundingClientRect().top;
      // One tick per verse, not per fragment: a psalm set across four
      // paragraphs is one verse and gets one tick, on its first line.
      const nums = root.querySelectorAll<HTMLElement>(
        '.dw-verse:not([data-dw-part="cont"]) .verse-num'
      );
      const ys: number[] = [];
      nums.forEach((n) => {
        const r = n.getBoundingClientRect();
        ys.push(Math.round(r.top - rootTop + r.height / 2));
      });
      setTicks(ys);
      setHeight(root.offsetHeight);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    // Web fonts land after first paint and change every baseline with them.
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & { fonts: FontFaceSet }).fonts.ready.then(measure);
    }
    return () => ro.disconnect();
  }, [containerRef]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let raf = 0;

    // What actually scrolls around this passage. The window, on every
    // reading screen there has ever been — and the pane, when the chapter
    // is one of two side by side, because there the page itself never
    // moves. Reading window.scrollY in a pane gives a sounding that is
    // always zero: a plumb line that says you are at the surface however
    // far down the chapter you have read.
    const pane = root.closest<HTMLElement>("[data-pane-scroll]");
    const scrollTop = () => (pane ? pane.scrollTop : window.scrollY);
    const viewport = () => (pane ? pane.clientHeight : window.innerHeight);
    const originTop = () => (pane ? pane.getBoundingClientRect().top : 0);

    const update = () => {
      raf = 0;
      const rect = root.getBoundingClientRect();
      const y = scrollTop();
      // 0 when the first line of the passage is at the top of the screen,
      // 1 when the last line is at the bottom of it. A passage shorter
      // than the screen is entirely in front of you, so it is 1 at once.
      const start = rect.top - originTop() + y;
      const end = start + rect.height - viewport();
      const span = end - start;
      const f = span <= 0 ? 1 : Math.max(0, Math.min(1, (y - start) / span));
      setTop(f * Math.max(0, root.offsetHeight - MARKER));
      setArrived(f >= 0.999);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    const onResize = () => {
      setTick(window.innerWidth < 380 ? TICK_NARROW : TICK);
      onScroll();
    };

    update();
    onResize();
    const scroller: HTMLElement | Window = pane ?? window;
    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [containerRef]);

  useEffect(() => {
    onArrive?.(arrived);
  }, [arrived, onArrive]);

  if (!height) return null;

  return (
    <>
      <svg
        className="plumb"
        width={tick}
        height={height}
        viewBox={`0 0 ${tick} ${height}`}
        aria-hidden
        focusable="false"
      >
        <rect className="plumb-rule" x="0" y="0" width="1" height={height} />
        {ticks.map((y, i) => (
          <rect key={i} className="plumb-tick" x="0" y={y} width={tick} height="1" />
        ))}
      </svg>
      <span className="plumb-marker" style={{ top }} aria-hidden />
    </>
  );
}

/** Fixed. A plumb bob is the same size however deep the water is. */
const MARKER = 20;
const TICK = 3;
/** Under 380px, where the number column narrows to 2.5ch too. */
const TICK_NARROW = 2;
