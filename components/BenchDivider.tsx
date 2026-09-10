"use client";
import { useCallback, useRef, useState } from "react";
import {
  BALANCED, KEY_STEP, SNAPS,
  applySnap, clampFraction
} from "@/lib/benchSplit";

type Props = {
  /** The Bench's current share of the window, 0 to 1. */
  fraction: number;
  /** Called on every move while dragging. Cheap: it writes a CSS property
      and does not re-render the app. */
  onPreview: (fraction: number) => void;
  /** Called when the drag ends, or a key moves it. This one is kept. */
  onCommit: (fraction: number) => void;
};

/** Which resting place this width is at, if any, for the screen reader. */
function snapLabel(fraction: number): string | null {
  const at = SNAPS.find((s) => Math.abs(s.fraction - fraction) < 0.005);
  return at ? at.label : null;
}

/**
 * The handle between the reader and the Bench.
 *
 * The line itself is a hairline, because that is all a boundary needs to
 * be. What you grab is much wider than what you see — a 28px invisible
 * band centred on the line — because on an iPad the thing doing the
 * grabbing is a fingertip, and a 1px target is a target you miss.
 *
 * Dragging writes the width straight to a CSS property rather than through
 * React state. The layout follows the finger; the app does not re-render
 * sixty times a second to make that happen.
 */
export default function BenchDivider({ fraction, onPreview, onCommit }: Props) {
  // Two of the same fact, on purpose. The ref is what the move handler
  // reads: state does not change until React re-renders, and the first
  // pointermove after the grab arrives before that — so a state-only flag
  // drops the opening movement and the divider seems to stick for an
  // instant every time you take hold of it. The state is only for the
  // look of the thing.
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const latest = useRef(fraction);

  const positionFrom = useCallback((clientX: number) => {
    const w = window.innerWidth;
    // The Bench is on the right, so the further left the finger, the wider
    // it gets.
    const raw = (w - clientX) / w;
    return clampFraction(applySnap(raw), w);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Capture, so the drag survives the pointer leaving the 28px band —
      // which it will, because fingers wander. Guarded: a pointer that has
      // already gone makes this throw, and a throw here would leave the
      // divider stuck mid-drag.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* no capture; the drag still works, it just ends at the edge */
      }
      draggingRef.current = true;
      setDragging(true);
      e.preventDefault();
    },
    []
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const next = positionFrom(e.clientX);
      latest.current = next;
      onPreview(next);
    },
    [positionFrom, onPreview]
  );

  const endDrag = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      setDragging(false);
      onCommit(latest.current);
    },
    [onCommit]
  );

  const nudge = useCallback(
    (delta: number) => {
      const next = clampFraction(latest.current + delta, window.innerWidth);
      latest.current = next;
      onCommit(next);
    },
    [onCommit]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      latest.current = fraction;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudge(KEY_STEP);          // left widens the Bench
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudge(-KEY_STEP);
      } else if (e.key === "Home") {
        e.preventDefault();
        latest.current = BALANCED;
        onCommit(BALANCED);
      }
    },
    [fraction, nudge, onCommit]
  );

  const percent = Math.round(fraction * 100);
  const resting = snapLabel(fraction);

  return (
    <div
      ref={ref}
      className="bench-divider"
      data-dragging={dragging ? "true" : undefined}
      role="separator"
      aria-orientation="vertical"
      aria-label="Width of the study panel"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={
        resting
          ? `Study panel ${percent} per cent — ${resting}`
          : `Study panel ${percent} per cent`
      }
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
      // Back to half and half, without hunting for the middle.
      onDoubleClick={() => {
        latest.current = BALANCED;
        onCommit(BALANCED);
      }}
      title="Drag to resize. Double-click for half and half."
    >
      <span className="bench-divider-line" aria-hidden />
    </div>
  );
}
