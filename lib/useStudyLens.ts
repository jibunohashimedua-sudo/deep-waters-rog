"use client";
import { useEffect, useRef, useState } from "react";

/**
 * One lens's data, fetched only when that lens is actually on screen.
 *
 * `active` is the whole gate: a lens that has not been opened never runs
 * its query, and a lens that is opened on a new verse re-runs it once. The
 * key is what identifies "the same question" — change it and the answer is
 * fetched again; leave it and the answer is kept.
 *
 * In Stack mode every lens is on screen at once, and `active` is handed to
 * them one at a time as each finishes, so a stacked Bench fills in from the
 * top rather than firing seven queries at the same moment.
 */
export function useStudyLens<T>(args: {
  active: boolean;
  key: string;
  load: () => Promise<T>;
  onError?: (message: string) => void;
  onSettled?: () => void;
}): { data: T | null; loading: boolean } {
  const { active, key, load, onError, onSettled } = args;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const loadedFor = useRef<string | null>(null);

  // The callbacks are read through refs so a caller passing an inline
  // closure — which every caller does — doesn't re-run the query on
  // every render of the pane.
  const loadRef = useRef(load);
  loadRef.current = load;
  const errRef = useRef(onError);
  errRef.current = onError;
  const settledRef = useRef(onSettled);
  settledRef.current = onSettled;

  useEffect(() => {
    if (!active) return;
    if (loadedFor.current === key) return;
    loadedFor.current = key;

    let cancelled = false;
    setLoading(true);
    setData(null);

    loadRef.current()
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        loadedFor.current = null;   // a failure is not an answer; let it retry
        errRef.current?.(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        settledRef.current?.();
      });

    return () => {
      cancelled = true;
    };
  }, [active, key]);

  return { data, loading };
}
