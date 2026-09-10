"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { VerseMarksProvider } from "@/lib/verseMarks";
import { ParallelOpenerContext } from "@/lib/parallelUi";
import {
  PARALLEL_MEDIA_QUERY,
  bookOf,
  clampRef,
  otherTranslation,
  recallPair,
  rememberPair,
  sameRef,
  urlForState,
  type PaneRef,
  type ParallelState
} from "@/lib/parallel";
import ReaderPane from "@/components/ReaderPane";
import BackControl from "@/components/BackControl";

/** How far out of step the two panes may drift before they are nudged back.
    Below this, translations simply run to different lengths and the honest
    answer is to leave them alone. */
const ALIGN_TOLERANCE_PX = 64;

/** How long after a scroll stops before the other pane is corrected. The
    correction happens in the pause, never during the movement: a pane that
    argues with your finger is worse than a pane slightly out of step. */
const ALIGN_SETTLE_MS = 160;

/** How long to ignore a pane's own scroll events after moving it ourselves,
    so a correction can't be mistaken for the reader scrolling. */
const ALIGN_QUIET_MS = 700;

const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Seed = {
  bookSlug: string;
  chapter: number;
  verse: number | null;
  verseEnd: number | null;
  bibleId: string;
  reference: string;
  html: string;
  fallbackNote: string | null;
};

type Props = {
  userId: string;
  isPastoral: boolean;
  /** The reader's type settings, as the server already computed them for
      the single pane. Both panes live inside one reading surface, so text
      size, font, line spacing and verse numbers apply to both from the
      first frame rather than after a profile query comes back. */
  readingAttrs: Record<string, string>;
  initial: ParallelState;
  /** The chapter the server rendered for this URL, so the first pane costs
      no fetch and the single pane below costs no change at all. */
  seed: Seed | null;
  /** The single-pane page, exactly as it has always been rendered. */
  children: ReactNode;
};

/**
 * Two Bibles, side by side, on the Bible tab.
 *
 * The whole of this component is a decision about what to render:
 *
 *   one pane, still on the server's own markup — the overwhelmingly common
 *   case, and byte for byte what it was before parallel reading existed;
 *
 *   one pane, client-rendered — the same single column, for when the left
 *   pane has been moved somewhere the server render doesn't cover, which
 *   happens after you have changed a reference and then turned the phone;
 *
 *   two panes.
 *
 * Nothing about the plan reading flow is touched, and nothing here records
 * reading progress, because the Bible tab never has: /bible writes no
 * completion and marks no plan day, so a chapter read in parallel counts
 * exactly as often as a chapter read on its own, which is not at all.
 * Progress belongs to /read, which has no second pane.
 */
export default function ParallelBible({
  userId,
  isPastoral,
  readingAttrs,
  initial,
  seed,
  children
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<ParallelState>(initial);
  const [wide, setWide] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);
  const onMarksError = useCallback(
    (message: string) => showToast(friendlyError(message)),
    [showToast]
  );

  // ------------------------------------------------------------- width

  // Before paint rather than after it, so a wide screen arriving on a
  // parallel URL doesn't show one column for a frame and then split.
  useIsomorphicLayoutEffect(() => {
    const mq = window.matchMedia(PARALLEL_MEDIA_QUERY);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ------------------------------------------------------------ memory

  // What was remembered from last time, applied only where this URL said
  // nothing. A link someone sent you always wins over what you last did.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (initial.open) return;
    const recall = recallPair();
    if (!recall.right && !recall.open) return;
    setState((prev) => ({
      ...prev,
      open: recall.open,
      linked: recall.linked,
      right: {
        ref: prev.left.ref,
        bibleId:
          recall.right && recall.right !== prev.left.bibleId
            ? recall.right
            : otherTranslation(prev.left.bibleId)
      }
    }));
  }, [initial.open]);

  // ------------------------------------------------------------ address

  // The address bar, kept correct without re-rendering anything.
  //
  // replaceState rather than a router push: the panes are already showing
  // the right text, so there is nothing to fetch and nothing to re-render —
  // and a push would remount both panes and throw away both scroll
  // positions to arrive at the page it is already on. Next has supported
  // the native History methods since 14.1 and keeps its own router state in
  // step with them, so usePathname and useSearchParams stay honest.
  // The path this page was actually served on. Kept, and reused whenever
  // the left pane hasn't moved off it, because a reference can be written
  // more ways than one and only one of them is the reader's: /john/3/16-18
  // is a range, and rebuilding that path from a pane — which holds a verse
  // to land on, not a span — would quietly rewrite it to /john/3/16 on
  // arrival and lose the other two verses out of the address bar.
  const servedPath = useRef<string | null>(null);
  if (servedPath.current === null && typeof window !== "undefined") {
    servedPath.current = window.location.pathname;
  }

  useEffect(() => {
    // Only what is actually on the screen goes in the address bar. A second
    // pane folded away because the window is too narrow is remembered, but
    // it is not described here — the URL says what someone opening it would
    // see, which on a phone held upright is one Bible.
    const url = urlForState(
      { ...state, open: state.open && wide },
      new URLSearchParams(window.location.search),
      sameRef(state.left.ref, initial.left.ref) ? servedPath.current : null
    );
    const current = `${window.location.pathname}${window.location.search}`;
    if (url !== current) window.history.replaceState(null, "", url);
    rememberPair(state);

    // The tab's name. replaceState doesn't re-run the server's metadata, so
    // without this the tab still said Romans 8 while the page had been moved
    // to Genesis 28 — and a browser's tab strip and history are both built
    // on that string. Only touched once the left pane has actually left the
    // page it was served as, so a chapter opened at a verse range keeps the
    // title the server wrote for it.
    if (!sameRef(state.left.ref, initial.left.ref)) {
      const book = bookOf(state.left.ref);
      if (book) {
        document.title = `${book.name} ${state.left.ref.chapter} · Deep Waters`;
      }
    }
  }, [state, wide, initial]);

  // ---------------------------------------------------------- alignment

  const leftEl = useRef<HTMLElement | null>(null);
  const rightEl = useRef<HTMLElement | null>(null);
  const quietUntil = useRef(0);
  const settleTimer = useRef<number | null>(null);
  const touching = useRef<"left" | "right" | null>(null);

  const setLeftScroller = useCallback((el: HTMLElement | null) => {
    leftEl.current = el;
  }, []);
  const setRightScroller = useCallback((el: HTMLElement | null) => {
    rightEl.current = el;
  }, []);

  /**
   * Put the follower roughly where the driver is, by verse.
   *
   * By verse and not by pixel, because that is the only thing the two
   * columns genuinely share: the NLT runs shorter than the KJV, so matching
   * scroll offsets would drift further apart the further down you read,
   * and matching proportions would put you next to the wrong sentence.
   */
  const align = useCallback((driver: "left" | "right") => {
    const from = driver === "left" ? leftEl.current : rightEl.current;
    const to = driver === "left" ? rightEl.current : leftEl.current;
    if (!from || !to) return;
    // Never move a pane somebody has their finger on.
    if (touching.current && touching.current !== driver) return;

    const fromTop = from.getBoundingClientRect().top;
    const toTop = to.getBoundingClientRect().top;

    // The first verse whose bottom edge is still below the top of the pane —
    // the one you are actually looking at, not the one that has just left.
    let anchor: HTMLElement | null = null;
    for (const el of Array.from(
      from.querySelectorAll<HTMLElement>("[data-verse]")
    )) {
      if (el.getBoundingClientRect().bottom > fromTop + 8) {
        anchor = el;
        break;
      }
    }
    if (!anchor) return;
    const verse = anchor.dataset.verse;
    if (!verse) return;

    const mate = to.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
    if (!mate) return;

    const offset = anchor.getBoundingClientRect().top - fromTop;
    const target =
      to.scrollTop + (mate.getBoundingClientRect().top - toTop) - offset;
    const clamped = Math.max(0, Math.min(target, to.scrollHeight - to.clientHeight));
    if (Math.abs(clamped - to.scrollTop) < ALIGN_TOLERANCE_PX) return;

    quietUntil.current = Date.now() + ALIGN_QUIET_MS;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    to.scrollTo({ top: clamped, behavior: reduced ? "auto" : "smooth" });
  }, []);

  const onPaneScroll = useCallback(
    (driver: "left" | "right") => {
      if (!state.linked) return;
      if (Date.now() < quietUntil.current) return;
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(
        () => align(driver),
        ALIGN_SETTLE_MS
      );
    },
    [state.linked, align]
  );

  const onLeftScroll = useCallback(() => onPaneScroll("left"), [onPaneScroll]);
  const onRightScroll = useCallback(() => onPaneScroll("right"), [onPaneScroll]);

  // Which pane is under a finger, so alignment never fights it.
  useEffect(() => {
    if (!state.open || !wide) return;
    const mark = (e: Event) => {
      const t = e.target as Node | null;
      if (leftEl.current?.contains(t as Node)) touching.current = "left";
      else if (rightEl.current?.contains(t as Node)) touching.current = "right";
      else touching.current = null;
    };
    const release = () => {
      touching.current = null;
    };
    document.addEventListener("pointerdown", mark, true);
    document.addEventListener("pointerup", release, true);
    document.addEventListener("pointercancel", release, true);
    return () => {
      document.removeEventListener("pointerdown", mark, true);
      document.removeEventListener("pointerup", release, true);
      document.removeEventListener("pointercancel", release, true);
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, [state.open, wide]);

  // ------------------------------------------------------------ actions

  const moveRef = useCallback((side: "left" | "right", raw: PaneRef) => {
    const ref = clampRef(raw);
    setState((prev) => {
      // Linked, the other side goes to the same place. Only the reference
      // travels — the translations are the entire point of the pairing.
      if (prev.linked) {
        return {
          ...prev,
          left: { ...prev.left, ref },
          right: { ...prev.right, ref }
        };
      }
      return side === "left"
        ? { ...prev, left: { ...prev.left, ref } }
        : { ...prev, right: { ...prev.right, ref } };
    });
  }, []);

  const setTranslation = useCallback((side: "left" | "right", id: string) => {
    setState((prev) =>
      side === "left"
        ? { ...prev, left: { ...prev.left, bibleId: id } }
        : { ...prev, right: { ...prev.right, bibleId: id } }
    );
  }, []);

  const openSecond = useCallback(() => {
    setState((prev) => {
      const recall = recallPair();
      const bibleId =
        recall.right && recall.right !== prev.left.bibleId
          ? recall.right
          : otherTranslation(prev.left.bibleId);
      return {
        ...prev,
        open: true,
        right: { ref: prev.left.ref, bibleId }
      };
    });
  }, []);

  const closeSecond = useCallback(() => {
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  const toggleLink = useCallback(() => {
    setState((prev) => {
      const linked = !prev.linked;
      // Turning it back on brings the second pane to where the first one
      // is. "Linked" and "showing two different chapters" cannot both be
      // true, and the first pane is the one you are reading.
      return linked
        ? { ...prev, linked, right: { ...prev.right, ref: prev.left.ref } }
        : { ...prev, linked };
    });
  }, []);

  // Swapping carries the scroll positions across with the text, so the side
  // you were reading is still the passage you were reading.
  const pendingSwap = useRef<{ left: number; right: number } | null>(null);
  const swap = useCallback(() => {
    pendingSwap.current = {
      left: leftEl.current?.scrollTop ?? 0,
      right: rightEl.current?.scrollTop ?? 0
    };
    setState((prev) => {
      // The left pane is the one you are reading in, so what it is reading
      // in is your translation. Swapping genuinely changes that.
      supabase
        .from("profiles")
        .update({ preferred_bible_id: prev.right.bibleId })
        .eq("id", userId)
        .then(({ error }) => {
          if (error) console.error("[deep-waters] swap translation:", error.message);
        });
      return { ...prev, left: prev.right, right: prev.left };
    });
  }, [supabase, userId]);

  useIsomorphicLayoutEffect(() => {
    const p = pendingSwap.current;
    if (!p) return;
    pendingSwap.current = null;
    quietUntil.current = Date.now() + ALIGN_QUIET_MS;
    if (leftEl.current) leftEl.current.scrollTop = p.right;
    if (rightEl.current) rightEl.current.scrollTop = p.left;
  });

  // ------------------------------------------------------------- render

  const opener = useMemo(
    () => ({ open: openSecond, available: wide }),
    [openSecond, wide]
  );

  const split = state.open && wide;

  const seedMatches = (side: "left" | "right") => {
    if (!seed) return null;
    const pane = side === "left" ? state.left : state.right;
    return pane.ref.bookSlug === seed.bookSlug &&
      pane.ref.chapter === seed.chapter &&
      pane.bibleId === seed.bibleId
      ? {
          reference: seed.reference,
          html: seed.html,
          fallbackNote: seed.fallbackNote
        }
      : null;
  };

  // The server's own markup, whenever the left pane is still standing where
  // the server render put it. That is every first load, every narrow
  // screen, and the whole of the single-pane experience.
  const leftIsServerRender =
    !!seed &&
    sameRef(state.left.ref, {
      bookSlug: seed.bookSlug,
      chapter: seed.chapter,
      verse: seed.verse,
      verseEnd: seed.verseEnd
    }) &&
    state.left.bibleId === seed.bibleId;

  if (!split) {
    return (
      <ParallelOpenerContext.Provider value={opener}>
        {leftIsServerRender ? (
          children
        ) : (
          <main data-surface="reading" className="parallel-single" {...readingAttrs}>
            <ReaderPane
              side="left"
              pane={state.left}
              userId={userId}
              isPastoral={isPastoral}
              seed={seedMatches("left")}
              onRefChange={(ref) => moveRef("left", ref)}
              onTranslationChange={(id) => setTranslation("left", id)}
              persistTranslation
              split={false}
              backHref={`/bible/${state.left.ref.bookSlug}`}
              controls={
                state.open ? (
                  // Folded away, not closed. Said once and quietly, because
                  // it comes back on its own the moment the window has room.
                  <span className="parallel-folded" role="status">
                    Second Bible hidden — no room
                  </span>
                ) : wide ? (
                  <button
                    type="button"
                    onClick={openSecond}
                    className="chip parallel-toggle"
                    aria-label="Open a second Bible beside this one"
                    title="Read two translations side by side"
                  >
                    + Bible
                  </button>
                ) : null
              }
            />
          </main>
        )}
      </ParallelOpenerContext.Provider>
    );
  }

  return (
    <ParallelOpenerContext.Provider value={opener}>
      <VerseMarksProvider userId={userId} supabase={supabase} onError={onMarksError}>
        <main
          data-surface="reading"
          data-parallel="on"
          className="parallel-split"
          {...readingAttrs}
        >
          {/* The controls that belong to the pair rather than to either
              side, in one thin bar across the top.

              They started out tucked into the panes' own headers, which
              read tidily on a desktop and fell apart on an iPad held
              upright: a 384px column carrying a back control, a reference,
              two chapter arrows, a translation and two more chips squeezed
              the reference — the one thing that says where you are — down
              to nothing. Grouping them here is also the truer arrangement.
              Linking, swapping and closing are things you do to the pair;
              they were never the left pane's business. */}
          <div className="parallel-pair-bar">
            <BackControl
              variant="bare"
              fallbackHref={`/bible/${state.left.ref.bookSlug}`}
              label="Back to the chapter list"
              className="shrink-0"
            />

            <span className="parallel-pair-end">
              <button
                type="button"
                onClick={toggleLink}
                aria-pressed={state.linked}
                className="chip parallel-toggle"
                title={
                  state.linked
                    ? "Linked — both sides move together. Tap to unlink."
                    : "Unlinked — each side moves on its own. Tap to link."
                }
              >
                {state.linked ? "Linked" : "Unlinked"}
              </button>
              <button
                type="button"
                onClick={swap}
                className="chip parallel-toggle"
                aria-label="Swap the two sides"
                title="Swap the two sides"
              >
                Swap
              </button>
              <button
                type="button"
                onClick={closeSecond}
                className="chip parallel-toggle"
                aria-label="Close the second Bible"
                title="Close the second Bible"
              >
                Close
              </button>
            </span>
          </div>

          <ReaderPane
            side="left"
            pane={state.left}
            userId={userId}
            isPastoral={isPastoral}
            seed={seedMatches("left")}
            onRefChange={(ref) => moveRef("left", ref)}
            onTranslationChange={(id) => setTranslation("left", id)}
            persistTranslation
            split
            onScroller={setLeftScroller}
            onScroll={onLeftScroll}
          />

          <ReaderPane
            side="right"
            pane={state.right}
            userId={userId}
            isPastoral={isPastoral}
            seed={seedMatches("right")}
            onRefChange={(ref) => moveRef("right", ref)}
            onTranslationChange={(id) => setTranslation("right", id)}
            persistTranslation={false}
            split
            onScroller={setRightScroller}
            onScroll={onRightScroll}
          />
        </main>

        {toast && (
          <div role="status" aria-live="polite" className="toast">
            {toast}
          </div>
        )}
      </VerseMarksProvider>
    </ParallelOpenerContext.Provider>
  );
}
