"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import VerseToolbar from "./VerseToolbar";
import VerseNoteSheet from "./VerseNoteSheet";

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
};

/** How far below the top edge a focused verse settles — clears the sticky
    header and leaves it room to breathe rather than jamming it to the edge. */
const FOCUS_OFFSET_PX = 120;

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
  focusVerse
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const rootRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [notes, setNotes] = useState<VerseNote[]>([]);
  const [selected, setSelected] = useState<SelKey[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
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

  // Load highlights + notes for these chapters.
  useEffect(() => {
    let cancelled = false;
    const chapterKeys = chapters.map((c) => ({ book: c.book, chapter: c.chapter }));
    (async () => {
      const bookNames = Array.from(new Set(chapterKeys.map((c) => c.book)));
      // Separate plain queries — no nested joins (avoids HTTP 300 ambiguity).
      const [{ data: hData, error: hErr }, { data: nData, error: nErr }] =
        await Promise.all([
          supabase
            .from("highlights")
            .select("*")
            .eq("user_id", userId)
            .in("book", bookNames),
          supabase
            .from("verse_notes")
            .select("*")
            .eq("user_id", userId)
            .in("book", bookNames)
        ]);
      if (cancelled) return;
      if (hErr) showToast(friendlyError(hErr.message));
      if (nErr) showToast(friendlyError(nErr.message));
      const chapterSet = new Set(chapterKeys.map((c) => `${c.book}|${c.chapter}`));
      setHighlights(
        (hData ?? []).filter((h) => chapterSet.has(`${h.book}|${h.chapter}`)) as Highlight[]
      );
      setNotes(
        (nData ?? []).filter((n) => chapterSet.has(`${n.book}|${n.chapter}`)) as VerseNote[]
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, chapters, supabase, showToast]);

  // ------------------------------------------------------------ painting

  // Highlights and note markers. Highlights are stored as spans (a verse
  // range), so they're expanded to one attribute per verse here — which is
  // also what makes "the newest wins" work: later rows simply overwrite the
  // attribute, so a verse ends up wearing one colour rather than a blend.
  useEffect(() => {
    for (const [key, root] of chapterRefs.current) {
      const [book, chapter] = key.split("|");
      const chNum = Number(chapter);
      const verseEls = root.querySelectorAll<HTMLElement>(".dw-verse");

      verseEls.forEach((el) => {
        el.removeAttribute("data-hl");
        el.removeAttribute("data-note");
      });

      const chapterHighlights = highlights
        .filter((h) => h.book === book && h.chapter === chNum)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      for (const h of chapterHighlights) {
        for (let v = h.verse_start; v <= h.verse_end; v++) {
          const el = root.querySelector<HTMLElement>(`[data-verse="${v}"]`);
          if (el) el.setAttribute("data-hl", h.colour);
        }
      }

      const chapterNotes = notes.filter(
        (n) => n.book === book && n.chapter === chNum
      );
      for (const n of chapterNotes) {
        for (let v = n.verse_start; v <= n.verse_end; v++) {
          const el = root.querySelector<HTMLElement>(`[data-verse="${v}"]`);
          if (el) el.setAttribute("data-note", "true");
        }
      }
    }
  }, [highlights, notes]);

  // The selection mark. Written straight onto the DOM rather than rendered,
  // because React owns this subtree through dangerouslySetInnerHTML — and
  // re-run on every render for the same reason: when the highlights arrive
  // React replaces the whole subtree, and any attribute written once would
  // be left behind on nodes no longer in the document.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const wanted = new Set(selected.map(keyOf));
    for (const [key, chapterRoot] of chapterRefs.current) {
      const [book, chapter] = key.split("|");
      chapterRoot.querySelectorAll<HTMLElement>(".dw-verse").forEach((el) => {
        const v = Number(el.dataset.verse);
        const on = wanted.has(`${book}|${chapter}|${v}`);
        if (on) el.setAttribute("data-sel", "true");
        else el.removeAttribute("data-sel");
      });
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
    function onDocClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (rootRef.current?.contains(t)) return;
      if (t.closest(".verse-bar") || t.closest("[data-verse-sheet]")) return;
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

  // No dependency array on purpose — same reason as the selection pass above.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !focusVerse) return;
    for (let v = focusVerse.start; v <= focusVerse.end; v++) {
      const el = root.querySelector<HTMLElement>(`[data-verse="${v}"]`);
      if (!el) continue;
      if (focusPhase === "off") el.removeAttribute("data-focus");
      else el.setAttribute("data-focus", focusPhase === "fading" ? "fading" : "true");
    }
  });

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
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({
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
  const verseNumbers = sortedSelected.map((s) => s.verse);
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
      const el = root.querySelector<HTMLElement>(`[data-verse="${v}"]`);
      if (!el) continue;
      // Drop the verse marker itself — a quoted verse doesn't carry its
      // own number inside the sentence.
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".v").forEach((n) => n.remove());
      const t = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
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
    const optimistic: Highlight[] = runs.map((r, i) => ({
      id: `optimistic-${Date.now()}-${i}`,
      user_id: userId,
      day_number: dayNumber,
      testament,
      book: anchor.book,
      chapter: anchor.chapter,
      verse_start: r.start,
      verse_end: r.end,
      colour,
      created_at: now
    }));
    setHighlights([...kept, ...optimistic]);
    clearSelection();

    // Clear the old rows on these verses, then write the new ones. Deleting
    // by id is exact — a filter on verse ranges would need an overlap test
    // PostgREST can't express, and would quietly miss partial overlaps.
    // Optimistic ids were never written, so they are dropped here rather
    // than sent — an empty `.in()` list builds `id=in.()`, which PostgREST
    // rejects outright and which would roll the whole highlight back.
    const doomed = previous
      .filter((h) => !kept.includes(h))
      .map((h) => h.id)
      .filter((id) => !id.startsWith("optimistic-"));

    if (doomed.length > 0) {
      const { error } = await supabase.from("highlights").delete().in("id", doomed);
      if (error) {
        setHighlights(previous);
        showToast(friendlyError(error.message));
        return;
      }
    }

    const { data, error } = await supabase
      .from("highlights")
      .insert(
        runs.map((r) => ({
          user_id: userId,
          day_number: dayNumber,
          testament,
          book: anchor.book,
          chapter: anchor.chapter,
          verse_start: r.start,
          verse_end: r.end,
          colour
        }))
      )
      .select();
    if (error) {
      setHighlights(previous);
      showToast(friendlyError(error.message));
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

    // Same guard as above: a selection whose only highlight is still
    // optimistic has nothing to delete, and an empty `.in()` is an error.
    const saved = doomed.filter((id) => !id.startsWith("optimistic-"));
    if (saved.length === 0) return;

    const { error } = await supabase.from("highlights").delete().in("id", saved);
    if (error) {
      setHighlights(previous);
      showToast(friendlyError(error.message));
    }
  }

  async function saveNote(body: string) {
    if (!anchor) return;
    setSheetSaving(true);
    if (existingNote) {
      const prev = notes;
      setNotes(
        notes.map((n) =>
          n.id === existingNote.id ? { ...n, body, updated_at: new Date().toISOString() } : n
        )
      );
      const { error } = await supabase
        .from("verse_notes")
        .update({ body })
        .eq("id", existingNote.id);
      setSheetSaving(false);
      if (error) {
        setNotes(prev);
        showToast(friendlyError(error.message));
        return;
      }
    } else {
      const prev = notes;
      const text = selectionText();
      const optimistic: VerseNote = {
        id: `optimistic-${Date.now()}`,
        user_id: userId,
        day_number: dayNumber,
        testament,
        book: anchor.book,
        chapter: anchor.chapter,
        verse_start: spanStart,
        verse_end: spanEnd,
        verse_text: text,
        body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      setNotes([...notes, optimistic]);
      const { data, error } = await supabase
        .from("verse_notes")
        .insert({
          user_id: userId,
          day_number: dayNumber,
          testament,
          book: anchor.book,
          chapter: anchor.chapter,
          verse_start: spanStart,
          verse_end: spanEnd,
          verse_text: text,
          body
        })
        .select()
        .single();
      setSheetSaving(false);
      if (error) {
        setNotes(prev);
        showToast(friendlyError(error.message));
        return;
      }
      setNotes([...prev, data as VerseNote]);
    }
    setSheetOpen(false);
    clearSelection();
    showToast("Note saved.");
  }

  async function deleteNote() {
    if (!existingNote) return;
    setSheetSaving(true);
    const prev = notes;
    setNotes(notes.filter((n) => n.id !== existingNote.id));
    const { error } = await supabase
      .from("verse_notes")
      .delete()
      .eq("id", existingNote.id);
    setSheetSaving(false);
    if (error) {
      setNotes(prev);
      showToast(friendlyError(error.message));
      return;
    }
    setSheetOpen(false);
    clearSelection();
    showToast("Note deleted.");
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

  async function shareImage() {
    const text = selectionText();
    if (!text) return;
    const params = new URLSearchParams({ ref: reference, text });
    showToast("Building your card…");
    try {
      const res = await fetch(`/api/og/verse?${params.toString()}`);
      if (!res.ok) throw new Error(`card responded ${res.status}`);
      const blob = await res.blob();
      const file = new File(
        [blob], `deep-waters-${reference.replace(/[^\w]+/g, "-")}.png`,
        { type: "image/png" }
      );
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: reference, url: shareUrl() });
          setToast(null);
          clearSelection();
          return;
        } catch {
          /* fall through to the download */
        }
      }
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      showToast("Card downloaded.");
      clearSelection();
    } catch (err) {
      // Say what went wrong rather than shrugging — a card that silently
      // never arrives is indistinguishable from a broken button.
      console.error("[deep-waters] verse card:", err);
      showToast("Couldn't build the card. Try again.");
    }
  }

  const noteReference = anchor
    ? formatVerseReference(anchor.book, anchor.chapter, spanStart, spanEnd)
    : "";

  // -------------------------------------------------------------- render

  return (
    <>
      <div ref={rootRef} className="mt-10">
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
                dangerouslySetInnerHTML={{ __html: c.html }}
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
        onCopy={copy}
        onShare={share}
        onShareImage={shareImage}
      />

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

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 z-[80] -translate-x-1/2 px-4 py-2 text-[13px] font-medium pointer-events-none"
          style={{
            // Sits clear of the verse toolbar when the toolbar is up, and
            // on the bottom edge when it isn't. Square: it is a message,
            // not something to press.
            bottom: selected.length > 0 ? 120 : 32,
            background: "var(--text)",
            color: "var(--bg)"
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
