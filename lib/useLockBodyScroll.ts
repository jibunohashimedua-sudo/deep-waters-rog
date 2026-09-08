"use client";
import { useEffect } from "react";

/**
 * Hold the page still while a sheet is open — counted, not captured.
 *
 * Every sheet used to capture `document.body.style.overflow` on open and
 * restore it on close. With one sheet at a time that is correct. With two,
 * it isn't: sheet B captures the "hidden" that sheet A had already set, A
 * closes and restores "", then B closes and puts "hidden" back on a page
 * with no sheet on it. The body stays locked and the reader is stuck.
 *
 * EXCELLENCE_AUDIT.md filed that as a P2 because the app rarely stacked
 * sheets. The Bench opens over the verse toolbar, so stacking is ordinary
 * now, and the race is real.
 *
 * One module-level count, one captured value taken at the first lock and
 * restored at the last unlock. Behaviour for a single sheet is identical to
 * what it replaced.
 */
let locks = 0;
let previousOverflow = "";

export function useLockBodyScroll(open: boolean): void {
  useEffect(() => {
    if (!open) return;
    if (locks === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [open]);
}

export default useLockBodyScroll;
