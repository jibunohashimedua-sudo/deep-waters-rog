"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import {
  formatVerseList,
  formatVerseReference,
  type Highlight,
  type HighlightColour,
  type VerseNote
} from "@/lib/highlights";
import { bookByName } from "@/lib/bibleBooks";
import { planDayForChapter } from "@/lib/plan";
import { loadVerseMarks, useSharedVerseMarks } from "@/lib/verseMarks";
import { verseFragments, verseTextOnPage } from "@/lib/verseFragments";
import { cancelQueuedHighlights, enqueue, newId } from "@/lib/offline/queue";
import {
  forgetMarks,
  isNetworkFailure,
  rememberHighlights,
  rememberNotes
} from "@/lib/offline/marks";
import { reportOffline, reportOnline } from "@/lib/offline/useOnline";
import PlumbLine from "@/components/PlumbLine";
import VerseToolbar from "./VerseToolbar";
import VerseNoteSheet from "./VerseNoteSheet";
import CompareSheet from "./CompareSheet";
import ShareCardSheet from "./ShareCardSheet";
import type { BenchPhase } from "./BenchLayer";
// Type-only, so it is erased at compile time and pulls the panel in with it.
import type { SecondPassage } from "./BenchSecondText";
import { DEFAULT_BIBLE_ID } from "@/lib/translations";

/**
 * The Bench, fetched only for a reader who can open it.
 *
 * It used to be a plain import, which put the whole Elite study layer —
 * seven lens components, lib/studyData, every source line — into the chunk
 * for /read and /bible/[book]/[chapter]. Every member downloaded and parsed
 * a feature they cannot reach, and could read its vocabulary out of the
 * bundle.
 *
 * The type comes across as a type-only import, which is erased at compile
 * time and pulls nothing in with it. The component comes across through
 * next/dynamic, so the request is made the first time `showBench && anchor`
 * is true — a pastoral reader holding a verse. That is one selection ahead
 * of the tap on the Bench chip, so the panel is warm by the time it is
 * asked for.
 *
 * ssr:false because the Bench only exists once a verse is selected, which
 * is client state; there was never a server render of it to keep.
 */
const BenchLayer = dynamic(() => import("./BenchLayer"), { ssr: false });

/** Where a note is to be filed, when it is not the pinned verse. */
export type NoteRef = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

type ChapterInput = {
  /** Book name, e.g. "Isaiah". */
  book: string;
  /** Chapter number, 1-based. */
  chapter: number;
  /** Full display reference from API.Bible, e.g. "Isaiah 3". */
  reference: string;
  /** HTML already pre-wrapped by lib/verseParse.ts so verses are addressable. */
  html: string;
};

type Props = {
  userId: string;
  dayNumber: number;
  testament: "ot" | "nt";
  chapters: ChapterInput[];
  /** Set when the URL named a verse: bring it into view and mark it briefly. */
  focusVerse?: { start: number; end: number };
  /** The edition on screen. Compare leads its list with it. */
  translationId?: string;
  /** The Elite gate. False means the Bench chip is not rendered — see the
      note in VerseToolbar. Defaults to false so a surface that hasn't been
      told is a surface without Elite on it. */
  isPastoral?: boolean;
  /** Elite is suppressed on licensed third-party content. */
  suppressBench?: boolean;
};

/** How far below the top edge a focused verse settles — clears the sticky
    header and leaves it room to breathe rather than jamming it to the edge. */
const FOCUS_OFFSET_PX = 120;

/**
 * The thing that actually scrolls around this reader.
 *
 * On every surface but parallel reading that is the window, and always was.
 * A pane scrolls inside itself, so a verse link landing in one has to move
 * the pane rather than the page — the page doesn't move at all there, and
 * window.scrollTo would silently do nothing.
 */
function scrollerFor(el: HTMLElement | null): HTMLElement | Window {
  const pane = el?.closest<HTMLElement>("[data-pane-scroll]");
  return pane ?? window;
}

/** How long the focus mark stays at full strength, then how long it fades. */
const FOCUS_HOLD_MS = 1800;
const FOCUS_FADE_MS = 600;

/** The most verses you can hold at once. Past this a selection stops being
    a selection and becomes a passage, which is what a chapter link is for. */
const MAX_SELECTED = 20;

/** One selected verse. Selections may be non-contiguous but never span two
    chapters — a reference has one chapter in it, and so does a highlight row. */
type SelKey = { book: string; chapter: number; verse: number };

const keyOf = (s: SelKey) => `${s.book}|${s.chapter}|${s.verse}`;

/**
 * Coordinates the whole scripture area on /read and /bible alike:
 *   - renders each chapter's pre-wrapped HTML
 *   - fetches this reader's highlights and notes for those chapters
 *   - paints them onto the verses
 *   - owns tap-to-select and the bottom toolbar
 *   - handles highlight, note, copy, share and share-as-image
 *
 * Selection is a tap, not a drag. Text selection on a phone is a long-press,
 * a pair of draggable handles and a system menu we do not control, and it
 * gave no clear feedback about which verse you had actually caught. Tapping
 * a verse selects it, tapping it again lets it go, tapping another adds it,
 * and tapping anywhere else clears the lot. Scripture is no longer
 * user-selectable at all, which is why Copy is now a button on the toolbar.
 */
export default function ScriptureReader({
  userId,
  dayNumber,
  testament,
  chapters,
  focusVerse,
  translationId,
  isPastoral = false,
  suppressBench = false
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();

  const rootRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<string, HTMLElement>>(new Map());

  /**
   * The marks on these verses — shared when the page has more than one pane
   * on it, held here when it has one.
   *
   * A highlight belongs to a verse, not to a surface, so two panes showing
   * the same verse have to be looking at the same row rather than at two
   * copies of it that drift apart the moment one of them is written to.
   * When there is no shared store — every surface in the app except a Bible
   * page with a second pane open — this is the same local state, the same
   * fetch and the same code path it has always been. See lib/verseMarks.
   */
  const shared = useSharedVerseMarks();
  const [ownHighlights, setOwnHighlights] = useState<Highlight[]>([]);
  const [ownNotes, setOwnNotes] = useState<VerseNote[]>([]);
  const highlights = shared ? shared.highlights : ownHighlights;
  const notes = shared ? shared.notes : ownNotes;
  const setHighlights = shared ? shared.setHighlights : setOwnHighlights;
  const setNotes = shared ? shared.setNotes : setOwnNotes;
  const [selected, setSelected] = useState<SelKey[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Captured the moment the reader opens the sheet, so a later selection
  // change on the page doesn't rewrite what they're about to share.
  const [shareText, setShareText] = useState("");
  // closed → open → collapsed. Collapsing puts the six-chip toolbar back
  // with the verse still selected; the toolbar's own handle is what closes
  // the rest of the way.
  const [benchPhase, setBenchPhase] = useState<BenchPhase>("closed");

  // The Bench's second window, held here rather than inside the Bench.
  //
  // BenchLayer only mounts while a verse is pinned, and moving the pin —
  // tapping the held verse off, then tapping another on — empties the
  // selection for a moment. State inside the Bench does not survive that,
  // so the passage the reader had chosen vanished exactly when he did the
  // one thing the window exists to survive. Up here it outlives the
  // re-pin, and is let go of only when he clears it or closes the Bench
  // outright.
  const [second, setSecond] = useState<SecondPassage | null>(null);
  const [secondCapped, setSecondCapped] = useState<string | null>(null);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [atCap, setAtCap] = useState(false);

  // Small toast, no library. Auto-clears.
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Which chapters this reader is showing, as one comparable string, so a
  // re-render that rebuilds the array doesn't re-enter either effect below.
  const chapterKeysList = useMemo(
    () => chapters.map((c) => ({ book: c.book, chapter: c.chapter })),
    [chapters]
  );
  const chaptersKey = chapterKeysList
    .map((c) => `${c.book}|${c.chapter}`)
    .join(",");

  // With a shared store, this reader doesn't fetch — it says which chapters
  // it has on screen and the store loads their union once for every pane.
  const paneId = useId();
  const registerShared = shared?.register;
  const unregisterShared = shared?.unregister;
  useEffect(() => {
    if (!registerShared || !unregisterShared) return;
    registerShared(paneId, chapterKeysList);
    return () => unregisterShared(paneId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerShared, unregisterShared, paneId, chaptersKey]);

  // Load highlights + notes for these chapters. Only when this reader holds
  // its own — a shared store has already loaded them for every pane at once.
  useEffect(() => {
    if (shared) return;
    let cancelled = false;
    (async () => {
      const res = await loadVerseMarks(supabase, userId, chapterKeysList);
      if (cancelled) return;
      for (const message of res.errors) showToast(friendlyError(message));
      setOwnHighlights(res.highlights);
      setOwnNotes(res.notes);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared, userId, chaptersKey, supabase, showToast]);

  // ------------------------------------------------------------ painting

  // Everything a verse can be wearing, painted in one pass, from stored
  // data, after every render.
  //
  // It runs unconditionally — no dependency array — and that is the whole
  // point rather than an oversight.
  //
  // React re-injects this subtree. `dangerouslySetInnerHTML={{__html}}`
  // builds a new object on every render, and the React the App Router runs
  // compares that prop by object identity rather than by the HTML string
  // inside it, so a commit replaces every verse element with a fresh one.
  // (Memoising the object below stops that happening for a plain re-render,
  // but it still happens whenever the chapter itself legitimately changes,
  // and a subtree we do not own is not something to build a guarantee on.)
  //
  // A highlight is not a decoration that can be lost in a repaint: once a
  // verse is highlighted it stays highlighted until the reader removes it.
  // So the paint is idempotent and re-derives all four states — highlight,
  // note, selection, focus — every time. This used to be three effects,
  // one of which was gated on [highlights, notes]; after React replaced the
  // nodes, the ungated selection effect repainted itself and the gated
  // highlight effect did not, so selecting any verse wiped every highlight
  // on screen until the next fetch.
  useEffect(() => {
    const wanted = new Set(selected.map(keyOf));

    for (const [key, root] of chapterRefs.current) {
      const [book, chapter] = key.split("|");
      const chNum = Number(chapter);

      // Wipe the slate first, so a highlight the reader has just removed
      // leaves with the same pass that repaints the ones that remain.
      root.querySelectorAll<HTMLElement>(".dw-verse").forEach((el) => {
        el.removeAttribute("data-hl");
        el.removeAttribute("data-note");
        el.removeAttribute("data-sel");
        el.removeAttribute("data-focus");
      });

      // Highlights. Oldest first, so a later row simply overwrites the
      // attribute and a verse ends up wearing one colour rather than a
      // blend — "the newest wins" falls out of the order.
      const chapterHighlights = highlights
        .filter((h) => h.book === book && h.chapter === chNum)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      for (const h of chapterHighlights) {
        for (let v = h.verse_start; v <= h.verse_end; v++) {
          // Every fragment of the verse, not the first one. A verse set as
          // poetry or quoted speech is several paragraphs — see
          // lib/verseFragments.ts.
          for (const el of verseFragments(root, v)) {
            el.setAttribute("data-hl", h.colour);
          }
        }
      }

      // Note dots.
      const chapterNotes = notes.filter(
        (n) => n.book === book && n.chapter === chNum
      );
      for (const n of chapterNotes) {
        for (let v = n.verse_start; v <= n.verse_end; v++) {
          // The dot goes on the last fragment only — it marks the end of
          // the verse, and one verse gets one dot however many lines it
          // was set across.
          const parts = verseFragments(root, v);
          const last = parts[parts.length - 1];
          if (last) last.setAttribute("data-note", "true");
        }
      }

      // The selection mark. It sits on top of a highlight rather than
      // instead of it: the attribute is added, the highlight's stays, and
      // globals.css draws the selected state over the top for as long as
      // the selection lasts. Let go of the verse and the highlight is
      // simply there again, because it never went anywhere.
      root.querySelectorAll<HTMLElement>(".dw-verse").forEach((el) => {
        const v = Number(el.dataset.verse);
        if (wanted.has(`${book}|${chapter}|${v}`)) {
          el.setAttribute("data-sel", "true");
        }
      });

      // The arrived-at verse, from /bible/john/3/16.
      if (focusVerse && focusPhase !== "off") {
        for (let v = focusVerse.start; v <= focusVerse.end; v++) {
          for (const el of verseFragments(root, v)) {
            el.setAttribute(
              "data-focus",
              focusPhase === "fading" ? "fading" : "true"
            );
          }
        }
      }
    }
  });

  // ------------------------------------------------------------ selecting

  // One listener on the container, rather than a handler per verse: the
  // verses are injected HTML, so there is nothing to attach a React handler
  // to. A tap that lands on a verse toggles it; a tap anywhere else in the
  // reading area clears the selection.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    function verseFrom(target: EventTarget | null): {
      book: string;
      chapter: number;
      verse: number;
    } | null {
      let n = target as Node | null;
      let verse: number | null = null;
      while (n) {
        if (n instanceof HTMLElement) {
          if (verse === null && n.dataset.verse) {
            const v = Number.parseInt(n.dataset.verse, 10);
            if (Number.isFinite(v)) verse = v;
          }
          if (verse !== null && n.dataset.book && n.dataset.chapter) {
            return {
              book: n.dataset.book,
              chapter: Number(n.dataset.chapter),
              verse
            };
          }
        }
        n = n.parentNode;
      }
      return null;
    }

    function onClick(e: MouseEvent) {
      const hit = verseFrom(e.target);
      if (!hit) {
        setSelected([]);
        setAtCap(false);
        return;
      }
      setSelected((prev) => {
        const k = keyOf(hit);
        const already = prev.some((s) => keyOf(s) === k);
        if (already) {
          setAtCap(false);
          return prev.filter((s) => keyOf(s) !== k);
        }
        // A selection lives in one chapter. Tapping into a different one
        // starts again there rather than building a reference that spans
        // two books and means nothing.
        const sameChapter = prev.filter(
          (s) => s.book === hit.book && s.chapter === hit.chapter
        );
        if (sameChapter.length !== prev.length) {
          setAtCap(false);
          return [hit];
        }
        if (prev.length >= MAX_SELECTED) {
          setAtCap(true);
          return prev;
        }
        setAtCap(false);
        // A light tap back, where the phone supports it. Wrapped because
        // Safari on iOS has no vibrate() at all and older Android throws
        // when the page hasn't been interacted with — which it has, but
        // the call is not worth an exception either way.
        try {
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate(8);
          }
        } catch {
          /* no haptics here, and nothing depends on them */
        }
        return [...prev, hit];
      });
    }

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, []);

  // Tapping outside the reading area clears too — the toolbar and the note
  // sheet excepted, since a tap on those is the whole point of selecting.
  useEffect(() => {
    if (selected.length === 0) return;
    /** Is this element the reading area, the toolbar, or a sheet? */
    function isInside(n: EventTarget | null): boolean {
      if (!(n instanceof HTMLElement)) return false;
      if (n === rootRef.current) return true;
      if (n.classList.contains("verse-bar")) return true;
      return n.hasAttribute("data-verse-sheet");
    }

    function onDocClick(e: MouseEvent) {
      // "Inside" is decided from the event's own path, which the browser
      // captured when the event was dispatched — not by walking up from
      // e.target now.
      //
      // This listener runs on the document, above React's own. By the time
      // it fires, React may already have re-rendered, and a control that
      // removes itself when you press it is gone: the Bench's panel chips
      // do exactly that, since opening a panel takes its chip out of the
      // closed list. A detached node has no ancestors, so closest() called
      // "outside" on a tap that was plainly inside the Bench, the selection
      // was cleared, and the Bench went down with it. The path still holds
      // the ancestors the node had when it was pressed.
      const path = typeof e.composedPath === "function" ? e.composedPath() : [];
      if (path.length > 0) {
        if (path.some(isInside)) return;
      } else {
        // Only for an engine with no composedPath. Same rule, same risk.
        const t = e.target as HTMLElement | null;
        if (!t) return;
        if (rootRef.current?.contains(t)) return;
        if (t.closest(".verse-bar") || t.closest("[data-verse-sheet]")) return;
      }
      setSelected([]);
      setAtCap(false);
    }
    // Registered on the next tick so the very click that made the selection
    // doesn't immediately clear it again.
    const id = window.setTimeout(
      () => document.addEventListener("click", onDocClick),
      0
    );
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", onDocClick);
    };
  }, [selected.length]);

  // Compare belongs to a selection, so it goes when the selection does.
  // Several paths empty the selection without going through
  // clearSelection() — a tap outside, Escape, tapping into another
  // chapter — and a Compare sheet left open over nothing shows the
  // "which book is this?" state, which is a true answer to a question
  // nobody asked.
  useEffect(() => {
    if (selected.length === 0) {
      setCompareOpen(false);
      setBenchPhase("closed");
    }
  }, [selected.length]);

  // Escape clears, for anyone reading on a keyboard.
  useEffect(() => {
    if (selected.length === 0) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelected([]);
        setAtCap(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.length]);

  // ------------------------------------------------------------- focus

  // Landing on a verse.
  //
  // Deliberately a jump rather than a filter: the verse is brought into view
  // and marked for a moment, and the rest of the chapter stays exactly where
  // it was above and below it. Someone following a shared link usually wants
  // the surrounding sentence too, and a verse shown alone is how scripture
  // gets quoted into meaning things it doesn't.
  const [focusPhase, setFocusPhase] = useState<"on" | "fading" | "off">(
    focusVerse ? "on" : "off"
  );

  // The focus mark itself is painted with everything else, in the single
  // pass above — every verse state is written in one place now.

  // Scroll to the verse, then start the mark's clock.
  useEffect(() => {
    if (!focusVerse) return;

    let inner = 0;
    let fade = 0;
    let clear = 0;
    // Two frames: the first lets the mark paint, the second means the scroll
    // maths runs against a layout that has settled.
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const el = rootRef.current?.querySelector<HTMLElement>(
          `[data-verse="${focusVerse.start}"]`
        );
        // A verse number past the end of this chapter in this translation.
        // The chapter still renders from the top, which is the honest
        // fallback, so there is nothing to apologise for here.
        if (!el) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const scroller = scrollerFor(rootRef.current);
        const currentTop =
          scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;
        const originTop =
          scroller === window
            ? 0
            : (scroller as HTMLElement).getBoundingClientRect().top;
        const top = el.getBoundingClientRect().top - originTop + currentTop;
        scroller.scrollTo({
          top: Math.max(0, top - FOCUS_OFFSET_PX),
          behavior: reduced ? "auto" : "smooth"
        });

        // The clock starts here, inside the frame, rather than beside it.
        // Browsers pause rAF in a background tab but keep firing timers, so
        // starting it outside would mean a verse link opened in a background
        // tab — which is how a shared link tends to be opened — faded out
        // unseen, leaving an unmarked verse for whenever the reader looked.
        fade = window.setTimeout(() => setFocusPhase("fading"), FOCUS_HOLD_MS);
        clear = window.setTimeout(
          () => setFocusPhase("off"),
          FOCUS_HOLD_MS + FOCUS_FADE_MS
        );
      });
    });

    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      window.clearTimeout(fade);
      window.clearTimeout(clear);
    };
  }, [focusVerse]);

  // ------------------------------------------------- derived selection

  const sortedSelected = useMemo(
    () => [...selected].sort((a, b) => a.verse - b.verse),
    [selected]
  );
  const anchor = sortedSelected[0] ?? null;
  // Memoised because the Bench takes this list as a prop, and a fresh array
  // on every render would re-enter its effects on every render.
  const verseNumbers = useMemo(
    () => sortedSelected.map((s) => s.verse),
    [sortedSelected]
  );
  const spanStart = verseNumbers[0] ?? 0;
  const spanEnd = verseNumbers[verseNumbers.length - 1] ?? 0;

  /** The honest reference — runs collapsed, gaps kept. */
  const reference = anchor
    ? formatVerseList(anchor.book, anchor.chapter, verseNumbers)
    : "";

  /** The selected verses' text, read back off the page in verse order. */
  const selectionText = useCallback((): string => {
    if (!anchor) return "";
    const root = chapterRefs.current.get(`${anchor.book}|${anchor.chapter}`);
    if (!root) return "";
    const parts: string[] = [];
    for (const v of verseNumbers) {
      // The whole verse, every fragment of it joined — so copy, share, the
      // note sheet and the shared card all quote the poetry too.
      const t = verseTextOnPage(root, v);
      if (t) parts.push(t);
    }
    return parts.join(" ");
  }, [anchor, verseNumbers]);

  /** Highlights touching any selected verse. */
  const touchedHighlights = useMemo(() => {
    if (!anchor) return [] as Highlight[];
    const chosen = new Set(verseNumbers);
    return highlights.filter((h) => {
      if (h.book !== anchor.book || h.chapter !== anchor.chapter) return false;
      for (let v = h.verse_start; v <= h.verse_end; v++) {
        if (chosen.has(v)) return true;
      }
      return false;
    });
  }, [anchor, verseNumbers, highlights]);

  // The colour shown as current only when every selected verse actually
  // wears it. A mixed selection has no current colour, which is the truth.
  const currentColour: HighlightColour | null = useMemo(() => {
    if (!anchor || verseNumbers.length === 0) return null;
    const byVerse = new Map<number, HighlightColour>();
    const ordered = [...touchedHighlights].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (const h of ordered) {
      for (let v = h.verse_start; v <= h.verse_end; v++) byVerse.set(v, h.colour);
    }
    const first = byVerse.get(verseNumbers[0]);
    if (!first) return null;
    return verseNumbers.every((v) => byVerse.get(v) === first) ? first : null;
  }, [anchor, verseNumbers, touchedHighlights]);

  const existingNote: VerseNote | null = anchor
    ? notes.find(
        (n) =>
          n.book === anchor.book &&
          n.chapter === anchor.chapter &&
          n.verse_start === spanStart &&
          n.verse_end === spanEnd
      ) ?? null
    : null;

  const hasNoteOnRange = anchor
    ? notes.some(
        (n) =>
          n.book === anchor.book &&
          n.chapter === anchor.chapter &&
          n.verse_start <= spanStart &&
          n.verse_end >= spanEnd
      )
    : false;

  // ------------------------------------------------------------- actions

  function clearSelection() {
    setSelected([]);
    setAtCap(false);
    setCompareOpen(false);
  }

  /**
   * Put the whole thing away.
   *
   * The toolbar's grab handle, and nothing else. Letting go of the verse
   * is not the same as being finished with the Bench: tapping a verse off
   * on the way to tapping another one is how a reader moves the pin, and
   * the second window has to still be there when he lands.
   */
  function closeBench() {
    clearSelection();
    setSecond(null);
    setSecondCapped(null);
  }

  /**
   * Highlighting a non-contiguous selection writes one row per run, so
   * "3,7" becomes two highlights rather than one row claiming 3–7. The
   * rows are what Depth lists later, and a row has to be true on its own.
   */
  function runsOf(verses: number[]): { start: number; end: number }[] {
    const runs: { start: number; end: number }[] = [];
    let start = verses[0];
    let prev = verses[0];
    for (let i = 1; i <= verses.length; i++) {
      const v = verses[i];
      if (v === prev + 1) {
        prev = v;
        continue;
      }
      runs.push({ start, end: prev });
      start = v;
      prev = v;
    }
    return runs;
  }

  async function saveHighlight(colour: HighlightColour) {
    if (!anchor || verseNumbers.length === 0) return;
    const previous = highlights;
    const chosen = new Set(verseNumbers);
    const runs = runsOf(verseNumbers);
    const now = new Date().toISOString();

    // Optimistic: strip anything overlapping these verses, then lay the new
    // runs on top, so the screen shows the answer before the network does.
    const kept = highlights.filter((h) => {
      if (h.book !== anchor.book || h.chapter !== anchor.chapter) return true;
      for (let v = h.verse_start; v <= h.verse_end; v++) {
        if (chosen.has(v)) return false;
      }
      return true;
    });
    // Real ids, chosen here rather than by the database.
    //
    // These used to be `optimistic-…` placeholders swapped for the server's
    // ids once the insert came back — which works right up until the insert
    // cannot go anywhere. A highlight made on a train has to be a highlight
    // the reader can then *remove* on the same train, and it has to be
    // sendable later without any chance of arriving twice. Both need it to
    // have had a real, final id from the first moment. A uuid the client
    // picks is exactly that, and it makes the eventual insert idempotent:
    // a second attempt collides with the primary key, and a collision here
    // means it is already saved.
    const rows = runs.map((r) => ({
      id: newId(),
      user_id: userId,
      day_number: dayNumber,
      testament,
      book: anchor.book,
      chapter: anchor.chapter,
      verse_start: r.start,
      verse_end: r.end,
      colour
    }));
    const optimistic: Highlight[] = rows.map((row) => ({ ...row, created_at: now }));
    setHighlights([...kept, ...optimistic]);
    clearSelection();
    void rememberHighlights(optimistic);

    // Clear the old rows on these verses, then write the new ones. Deleting
    // by id is exact — a filter on verse ranges would need an overlap test
    // PostgREST can't express, and would quietly miss partial overlaps.
    const doomed = previous.filter((h) => !kept.includes(h)).map((h) => h.id);

    // Any of those still sitting in the queue were never written, so they
    // are withdrawn rather than deleted. An insert followed by a delete for
    // a row the server has never heard of is two round trips describing
    // something that did not happen.
    const cancelled = new Set(await cancelQueuedHighlights(doomed));
    const toDelete = doomed.filter((id) => !cancelled.has(id));
    void forgetMarks(doomed);

    if (toDelete.length > 0) {
      const { error } = await supabase.from("highlights").delete().in("id", toDelete);
      if (error) {
        if (!isNetworkFailure(error)) {
          setHighlights(previous);
          showToast(friendlyError(error.message));
          return;
        }
        // No signal. The screen is right, and the queue carries the removal.
        await enqueue("highlight-remove", { ids: toDelete });
      }
    }

    const { data, error } = await supabase.from("highlights").insert(rows).select();
    if (error) {
      if (!isNetworkFailure(error)) {
        setHighlights(previous);
        showToast(friendlyError(error.message));
        return;
      }
      await enqueue("highlight-add", { rows });
      return;
    }
    setHighlights([...kept, ...((data ?? []) as Highlight[])]);
  }

  async function removeHighlight() {
    if (touchedHighlights.length === 0) return;
    const previous = highlights;
    const doomed = touchedHighlights.map((h) => h.id);
    setHighlights(highlights.filter((h) => !doomed.includes(h.id)));
    clearSelection();
    void forgetMarks(doomed);

    // Withdraw before deleting, same as above: one made offline and removed
    // offline never needs to trouble the server at all.
    const cancelled = new Set(await cancelQueuedHighlights(doomed));
    const saved = doomed.filter((id) => !cancelled.has(id));
    // An empty `.in()` list builds `id=in.()`, which PostgREST rejects
    // outright and which would roll the whole removal back.
    if (saved.length === 0) return;

    const { error } = await supabase.from("highlights").delete().in("id", saved);
    if (error) {
      if (!isNetworkFailure(error)) {
        setHighlights(previous);
        showToast(friendlyError(error.message));
        return;
      }
      await enqueue("highlight-remove", { ids: saved });
    }
  }

  /**
   * The three note operations, written once.
   *
   * The note sheet and the Bench both act on the same rows, so create,
   * update and delete live here rather than twice. Each returns true when
   * it stuck, so a caller can decide what to clear.
   */
  const createNote = useCallback(
    async (body: string, verseText: string, at?: NoteRef): Promise<boolean> => {
      // `at` is the whole reason this takes an argument. Everything on the
      // Bench is aimed at the pinned verse except the second-text window,
      // which holds a passage the reader chose for himself — and a note
      // written there must be filed against *that* passage. Left to the
      // anchor it would land on the verse in the reader, which is the one
      // place these two references could get crossed.
      if (!anchor && !at) return false;
      const book = at?.book ?? anchor!.book;
      const chapter = at?.chapter ?? anchor!.chapter;
      const verseStart = at?.verseStart ?? spanStart;
      const verseEnd = at?.verseEnd ?? spanEnd;
      // A note is filed under a plan day. For a passage in another book
      // that is that passage's day, not the day the reader happens to be
      // on — falling back to this screen's day when the plan never passes
      // through it.
      const placed = at ? planDayForChapter(book, chapter) : null;
      const day = placed?.day ?? dayNumber;
      const test = placed?.testament ?? testament;

      const prev = notes;
      // Its own id from the start, for the same reason a highlight gets one:
      // a note written with no signal has to be editable and deletable
      // before the server has ever heard of it, and its eventual send has to
      // be safe to repeat. /api/verse-note accepts the id and treats a
      // collision on it as "already saved".
      const payload = {
        id: newId(),
        day_number: day,
        testament: test,
        book,
        chapter,
        verse_start: verseStart,
        verse_end: verseEnd,
        verse_text: verseText,
        body
      };
      const optimistic: VerseNote = {
        ...payload,
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as VerseNote;
      setNotes([...prev, optimistic]);
      void rememberNotes([optimistic]);

      let res: Response;
      try {
        res = await fetch("/api/verse-note", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
      } catch {
        // No signal. The note stays on the screen and in the queue — it is
        // the one thing in this app that must never be lost, because it is
        // the only thing here the reader wrote themselves.
        reportOffline();
        await enqueue("verse-note-add", payload);
        showToast("Note saved on this device. It’ll sync when you’re back online.");
        return true;
      }
      reportOnline();
      if (!res.ok) {
        // The server having a bad moment is worth another go; the server
        // refusing is not, and the reader should hear about it now.
        if (res.status >= 500 || res.status === 401) {
          await enqueue("verse-note-add", payload);
          showToast("Note saved on this device. It’ll sync shortly.");
          return true;
        }
        setNotes(prev);
        void forgetMarks([payload.id]);
        const j = await res.json().catch(() => ({}));
        showToast(friendlyError(j.error));
        return false;
      }
      const j = await res.json();
      setNotes([...prev, j.note as VerseNote]);
      void rememberNotes([j.note as VerseNote]);
      showToast("Note saved.");
      return true;
    },
    [anchor, notes, setNotes, userId, dayNumber, testament, spanStart, spanEnd, showToast]
  );

  const updateNote = useCallback(
    async (id: string, body: string): Promise<boolean> => {
      const prev = notes;
      const next = notes.map((n) =>
        n.id === id ? { ...n, body, updated_at: new Date().toISOString() } : n
      );
      setNotes(next);
      void rememberNotes(next.filter((n) => n.id === id));

      // Server-side length cap and validation live in /api/verse-note.
      let res: Response;
      try {
        res = await fetch("/api/verse-note", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, body })
        });
      } catch {
        reportOffline();
        await enqueue("verse-note-edit", { id, body });
        showToast("Saved on this device. It’ll sync when you’re back online.");
        return true;
      }
      reportOnline();
      if (!res.ok) {
        if (res.status >= 500 || res.status === 401) {
          await enqueue("verse-note-edit", { id, body });
          showToast("Saved on this device. It’ll sync shortly.");
          return true;
        }
        setNotes(prev);
        const j = await res.json().catch(() => ({}));
        showToast(friendlyError(j.error));
        return false;
      }
      showToast("Note updated.");
      return true;
    },
    [notes, setNotes, showToast]
  );

  const removeNote = useCallback(
    async (id: string): Promise<boolean> => {
      const prev = notes;
      setNotes(notes.filter((n) => n.id !== id));
      void forgetMarks([id]);

      const { error } = await supabase.from("verse_notes").delete().eq("id", id);
      if (error) {
        if (!isNetworkFailure(error)) {
          setNotes(prev);
          showToast(friendlyError(error.message));
          return false;
        }
        await enqueue("verse-note-remove", { id });
        showToast("Deleted on this device. It’ll sync when you’re back online.");
        return true;
      }
      showToast("Note deleted.");
      return true;
    },
    [notes, setNotes, supabase, showToast]
  );

  /** The note sheet's Save. Create or update, then close and let go. */
  async function saveNote(body: string) {
    if (!anchor) return;
    setSheetSaving(true);
    const ok = existingNote
      ? await updateNote(existingNote.id, body)
      : await createNote(body, selectionText());
    setSheetSaving(false);
    if (!ok) return;
    setSheetOpen(false);
    clearSelection();
  }

  /** The note sheet's Delete. */
  async function deleteNote() {
    if (!existingNote) return;
    setSheetSaving(true);
    const ok = await removeNote(existingNote.id);
    setSheetSaving(false);
    if (!ok) return;
    setSheetOpen(false);
    clearSelection();
  }

  /**
   * A link that lands the recipient on the verse, not the front door.
   *
   * The book comes through as a display name because that is what the reader
   * sees, so it goes back through the book table to reach the slug the route
   * is built on. Works from /read as well as /bible: a verse shared out of
   * the daily plan still points at a stable, readable Bible route rather
   * than at whichever plan day happened to contain it.
   */
  function shareUrl(): string {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (!anchor) return origin;

    const book = bookByName(anchor.book);
    // Shouldn't happen — the reader is always given canonical names — but a
    // share is not worth breaking over a lookup miss.
    if (!book) return origin;

    const segment = spanStart === spanEnd ? `${spanStart}` : `${spanStart}-${spanEnd}`;
    return `${origin}/bible/${book.slug}/${anchor.chapter}/${segment}`;
  }

  async function copy() {
    const text = selectionText();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(`“${text}” — ${reference}`);
      showToast("Copied.");
      clearSelection();
    } catch {
      showToast("Couldn't copy. Try again.");
    }
  }

  async function share() {
    const text = selectionText();
    if (!text) return;
    const body = `“${text}” — ${reference}`;
    const url = shareUrl();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ text: body, url });
        clearSelection();
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${body}\n${url}`);
      showToast("Copied to clipboard.");
      clearSelection();
    } catch {
      showToast("Couldn't copy. Try again.");
    }
  }

  // "Share as image" no longer generates on the spot. It opens the
  // picker sheet so the reader can pick a shape and a background, see a
  // scaled preview, and only then fetch the full-resolution PNG. The
  // sheet remembers their choice for next time.
  function shareImage() {
    const text = selectionText();
    if (!text) return;
    setShareText(text);
    setShareOpen(true);
  }

  const noteReference = anchor
    ? formatVerseReference(anchor.book, anchor.chapter, spanStart, spanEnd)
    : "";

  /** Elite's one condition on this surface: the flag, and a surface that
      isn't licensed third-party content.
     
      Rhapsody of Realities is named here rather than left to the caller.
      The devotional does not mount this reader today, so the prop alone
      would be a promise about a page that could quietly stop being true if
      it ever did — and the one surface Elite must never appear on is not
      the place for a promise that depends on nobody changing their mind. */
  const licensed = pathname?.startsWith("/rhapsody") ?? false;
  const showBench = isPastoral && !suppressBench && !licensed;

  /** The pinned verse's words. Read off the page only while the Bench is
      up — it walks the DOM, and there is no reason to walk it otherwise. */
  const benchText = useMemo(
    () => (benchPhase === "open" ? selectionText() : ""),
    [benchPhase, selectionText]
  );

  // The Mark control lives on the page, outside this component and across
  // a server boundary, so arrival is published as an attribute on the
  // reading surface rather than passed down. CSS does the rest.
  const publishArrival = useCallback((arrived: boolean) => {
    const surface = rootRef.current?.closest<HTMLElement>('[data-surface="reading"]');
    if (!surface) return;
    if (arrived) surface.dataset.arrived = "true";
    else delete surface.dataset.arrived;
  }, []);

  useEffect(() => {
    const surface = rootRef.current?.closest<HTMLElement>('[data-surface="reading"]');
    return () => {
      if (surface) delete surface.dataset.arrived;
    };
  }, []);

  /**
   * The injected chapter markup, held still.
   *
   * `dangerouslySetInnerHTML={{ __html: … }}` written inline builds a new
   * object on every render, and the React the App Router runs compares
   * that prop by object identity rather than by the string inside it. So
   * every render of this component — selecting a verse, opening the
   * toolbar, a toast arriving — threw away every verse element and
   * re-injected the chapter from scratch. Verified with a MutationObserver
   * (one wholesale swap of all 22 nodes, no attribute changes) and by
   * catching the innerHTML setter (React's own commitUpdate).
   *
   * Memoised on the HTML string, so the object only changes when the
   * chapter genuinely does. The paint pass above is written to survive a
   * re-injection anyway; this stops there being one to survive.
   */
  const chapterHtml = useMemo(
    () => chapters.map((c) => ({ __html: c.html })),
    [chapters]
  );

  // -------------------------------------------------------------- render

  return (
    <>
      <div ref={rootRef} className="scripture-column mt-10">
        <PlumbLine containerRef={rootRef} onArrive={publishArrival} />
        {chapters.map((c, i) => (
          <div key={`${c.book}-${c.chapter}`}>
            {i > 0 && (
              <div className="my-12" aria-hidden>
                <span className="block h-px w-full bg-rog-line" />
              </div>
            )}
            <article
              data-book={c.book}
              data-chapter={c.chapter}
              ref={(el) => {
                const key = `${c.book}|${c.chapter}`;
                if (el) chapterRefs.current.set(key, el);
                else chapterRefs.current.delete(key);
              }}
            >
              <p className="chapter-mark mb-4">{c.reference}</p>
              <div
                className="bible-content"
                dangerouslySetInnerHTML={chapterHtml[i]}
              />
            </article>
          </div>
        ))}
      </div>

      <VerseToolbar
        open={selected.length > 0}
        reference={reference}
        cap={MAX_SELECTED}
        atCap={atCap}
        currentColour={currentColour}
        anyHighlighted={touchedHighlights.length > 0}
        hasNote={hasNoteOnRange}
        onHighlight={saveHighlight}
        onRemoveHighlight={removeHighlight}
        onNote={() => setSheetOpen(true)}
        onCompare={() => setCompareOpen(true)}
        showBench={showBench}
        onBench={() => setBenchPhase("open")}
        benchCollapsed={benchPhase === "collapsed"}
        onCloseAll={closeBench}
        onCopy={copy}
        onShare={share}
        onShareImage={shareImage}
      />

      {/* Share-as-image picker. Opened from the verse toolbar. Remembers
          the reader's last shape + background so the second card doesn't
          ask again. */}
      <ShareCardSheet
        open={shareOpen}
        reference={noteReference || reference}
        verseText={shareText}
        dayNumber={dayNumber}
        onClose={() => setShareOpen(false)}
        onToast={(m) => (m ? showToast(m) : setToast(null))}
        onShared={clearSelection}
      />

      {/* The same verses, in several translations at once. Uses the anchor's
          book and the run from first to last selected verse, so a range
          compares as a range. */}
      <CompareSheet
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        bookSlug={anchor ? bookByName(anchor.book)?.slug ?? null : null}
        chapter={anchor?.chapter ?? 1}
        start={spanStart}
        end={spanEnd}
        reference={noteReference}
        currentId={translationId ?? DEFAULT_BIBLE_ID}
        onToast={showToast}
      />

      {/* The Bench. Opened from the chip, never navigated to: it is a layer
          over the chapter you are already in. It mounts only for a pastoral
          reader with a verse held, so a member's reading screen has exactly
          the components it had before. */}
      {showBench && anchor && (
        <BenchLayer
          phase={benchPhase}
          userId={userId}
          second={second}
          onSecondChange={setSecond}
          secondCapped={secondCapped}
          onSecondCappedChange={setSecondCapped}
          book={anchor.book}
          chapter={anchor.chapter}
          spanStart={spanStart}
          spanEnd={spanEnd}
          verses={verseNumbers}
          reference={reference}
          text={benchText}
          dayNumber={dayNumber}
          testament={testament}
          translationId={translationId ?? DEFAULT_BIBLE_ID}
          notes={notes}
          onCreateNote={createNote}
          onUpdateNote={updateNote}
          onDeleteNote={removeNote}
          onCollapse={() => setBenchPhase("collapsed")}
          onToast={showToast}
        />
      )}

      <VerseNoteSheet
        open={sheetOpen}
        reference={noteReference}
        verseText={sheetOpen ? selectionText() : ""}
        initialBody={existingNote?.body ?? null}
        onSave={saveNote}
        onDelete={existingNote ? deleteNote : undefined}
        onClose={() => setSheetOpen(false)}
        saving={sheetSaving}
      />

      {/* A strip on the bottom edge, full width, above the tab bar — not
          a floating pill in the middle of the screen. It clears the verse
          toolbar when the toolbar is up. */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="toast"
          style={{ bottom: selected.length > 0 ? 96 : 0 }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
