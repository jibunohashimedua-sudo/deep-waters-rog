"use client";
import { createContext, useContext } from "react";

/**
 * The way in to a second pane, offered by the reading header.
 *
 * The control belongs beside the translation code, in the bar that already
 * carries where-you-are and what-you're-reading-in — not in a menu, and not
 * as a new piece of chrome of its own. But the state it opens lives in the
 * shell around the page, which is a different component and a different
 * concern, so the shell publishes the action and the header renders a chip
 * for it when there is one.
 *
 * Null on every surface that has no second pane — /read, the daily
 * reading, the devotional — where the header renders exactly what it
 * rendered before this existed.
 */
export type ParallelOpener = {
  /** Open the second pane. */
  open: () => void;
  /** False on a viewport too narrow for two columns, where the chip is not
      offered at all rather than offered and then refused. */
  available: boolean;
};

export const ParallelOpenerContext = createContext<ParallelOpener | null>(null);

export function useParallelOpener(): ParallelOpener | null {
  return useContext(ParallelOpenerContext);
}
