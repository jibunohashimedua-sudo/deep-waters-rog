"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import {
  HIGHLIGHT_CSS,
  formatVerseReference,
  type Highlight,
  type HighlightColour,
  type VerseNote
} from "@/lib/highlights";
import { bookByName } from "@/lib/bibleBooks";
import VerseToolbar, { type ToolbarPos } from "./VerseToolbar";
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

type Selection = {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  text: string;
  rect: ToolbarPos;
  /** DOM element for the containing chapter — used to mark verses as
      "selecting" so the highlight tone shows through the browser's own
      selection colour. */
  rootEl: HTMLElement;
};

/**
 * Coordinates the entire /read scripture area:
 *   - renders every chapter's pre-wrapped HTML
 *   - fetches this user's highlights + notes for these chapters
 *   - paints highlights and note markers on the DOM verses
 *   - listens for selectionchange, shows our own toolbar
 *   - handles highlight save/change/remove, note write/edit/delete,
 *     share (Web Share + clipboard fallback), and share-as-image
 *
 * iOS Safari's native selection callout cannot be fully suppressed by
 * JS — it's system UI. We show our toolbar above the selection with
 * high z-index so it dominates visually; the native callout may still
 * appear alongside on some iOS versions. See the commit message for
 * the honest breakdown.
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
  const [selection, setSelection] = useState<Selection | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSaving, setSheetSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

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
  }, [userId, chapters, supabase]);

  // Paint highlights + note markers whenever the state changes.
  useEffect(() => {
    for (const [key, root] of chapterRefs.current) {
      const [book, chapter] = key.split("|");
      const chNum = Number(chapter);
      const verseEls = root.querySelectorAll<HTMLElement>(".dw-verse");

      // Reset first — no leftover state on this pass.
      verseEls.forEach((el) => {
        el.style.removeProperty("--hl");
        el.removeAttribute("data-hl");
        el.removeAttribute("data-note");
      });

      // Later highlights win on overlap — same rule as the DB, insertion order.
      const chapterHighlights = highlights
        .filter((h) => h.book === book && h.chapter === chNum)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      for (const h of chapterHighlights) {
        for (let v = h.verse_start; v <= h.verse_end; v++) {
          const el = root.querySelector<HTMLElement>(`[data-verse="${v}"]`);
          if (!el) continue;
          el.style.setProperty("--hl", HIGHLIGHT_CSS[h.colour]);
          el.setAttribute("data-hl", h.colour);
        }
      }

      // Notes marker — a small dot after the verse (see globals.css).
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

  // Landing on a verse.
  //
  // Deliberately a jump rather than a filter: the verse is brought into view
  // and marked for a moment, and the rest of the chapter stays exactly where
  // it was above and below it. Someone following a shared link usually wants
  // the surrounding sentence too, and a verse shown alone is how scripture
  // gets quoted into meaning things it doesn't.
  //
  // The mark is held as state and re-applied after every render rather than
  // written once onto elements we keep hold of. React owns this subtree
  // through dangerouslySetInnerHTML and replaces it wholesale when the
  // highlights and notes arrive, which quietly detached the very spans the
  // mark had been written to: the attribute survived, on nodes no longer in
  // the document, and the reader saw nothing.
  const [focusPhase, setFocusPhase] = useState<"on" | "fading" | "off">(
    focusVerse ? "on" : "off"
  );

  // No dependency array on purpose. This is the pass that keeps the DOM in
  // step with focusPhase, and it has to run after any render that might have
  // rebuilt the verses underneath it. It is a handful of querySelectors over
  // a range that is almost always one verse.
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

  // Selection tracking.
  useEffect(() => {
    if (typeof window === "undefined") return;

    let lastRoot: HTMLElement | null = null;

    function clearSelectingMarks() {
      if (!lastRoot) return;
      lastRoot
        .querySelectorAll<HTMLElement>('[data-selecting="true"]')
        .forEach((el) => el.removeAttribute("data-selecting"));
      lastRoot = null;
    }

    function findChapterRoot(node: Node | null): HTMLElement | null {
      let n: Node | null = node;
      while (n) {
        if (n instanceof HTMLElement && n.dataset.book && n.dataset.chapter) {
          return n;
        }
        n = n.parentNode;
      }
      return null;
    }

    function findVerseNumber(node: Node | null): number | null {
      let n: Node | null = node;
      while (n) {
        if (n instanceof HTMLElement && n.dataset.verse) {
          const v = parseInt(n.dataset.verse, 10);
          return Number.isFinite(v) ? v : null;
        }
        n = n.parentNode;
      }
      return null;
    }

    function onChange() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        clearSelectingMarks();
        setSelection(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const root = findChapterRoot(range.commonAncestorContainer);
      if (!root) {
        clearSelectingMarks();
        setSelection(null);
        return;
      }
      const vs = findVerseNumber(range.startContainer);
      const ve = findVerseNumber(range.endContainer);
      if (!vs || !ve) {
        clearSelectingMarks();
        setSelection(null);
        return;
      }
      const verseStart = Math.min(vs, ve);
      const verseEnd = Math.max(vs, ve);
      const text = sel.toString().trim();
      if (!text) {
        clearSelectingMarks();
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      const pos: ToolbarPos = {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      };

      // Mark verses in the selection so the highlight tone shows through
      // the browser's selection colour — small tell that we own this range.
      clearSelectingMarks();
      lastRoot = root;
      for (let v = verseStart; v <= verseEnd; v++) {
        const el = root.querySelector<HTMLElement>(`[data-verse="${v}"]`);
        if (el) el.setAttribute("data-selecting", "true");
      }

      setSelection({
        book: root.dataset.book!,
        chapter: Number(root.dataset.chapter),
        verseStart,
        verseEnd,
        text,
        rect: pos,
        rootEl: root
      });
    }

    // Also drop the toolbar on scroll — otherwise the pill floats over
    // stale content until the user re-selects.
    function onScroll() {
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        clearSelectingMarks();
        setSelection(null);
      }
    }

    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", onScroll);
      clearSelectingMarks();
    };
  }, []);

  // Small toast, no library. Auto-clears.
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Find any highlight that fully spans the current selection.
  const currentHighlight: Highlight | null = selection
    ? (highlights
        .filter(
          (h) =>
            h.book === selection.book &&
            h.chapter === selection.chapter &&
            h.verse_start <= selection.verseStart &&
            h.verse_end >= selection.verseEnd
        )
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0] as Highlight) ?? null
    : null;

  const existingNote: VerseNote | null = selection
    ? notes.find(
        (n) =>
          n.book === selection.book &&
          n.chapter === selection.chapter &&
          n.verse_start === selection.verseStart &&
          n.verse_end === selection.verseEnd
      ) ?? null
    : null;

  const hasNoteOnRange = selection
    ? notes.some(
        (n) =>
          n.book === selection.book &&
          n.chapter === selection.chapter &&
          n.verse_start <= selection.verseStart &&
          n.verse_end >= selection.verseEnd
      )
    : false;

  // Actions ----------------------------------------------------------

  async function saveHighlight(colour: HighlightColour) {
    if (!selection) return;
    const optimistic: Highlight = {
      id: `optimistic-${Date.now()}`,
      user_id: userId,
      day_number: dayNumber,
      testament,
      book: selection.book,
      chapter: selection.chapter,
      verse_start: selection.verseStart,
      verse_end: selection.verseEnd,
      colour,
      created_at: new Date().toISOString()
    };
    // Remove any highlights on the same span so the new one replaces cleanly.
    const stripped = highlights.filter(
      (h) =>
        !(
          h.book === selection.book &&
          h.chapter === selection.chapter &&
          h.verse_start === selection.verseStart &&
          h.verse_end === selection.verseEnd
        )
    );
    setHighlights([...stripped, optimistic]);

    // Delete then insert — cleanest for "replace on the same span".
    const { error: delErr } = await supabase
      .from("highlights")
      .delete()
      .eq("user_id", userId)
      .eq("book", selection.book)
      .eq("chapter", selection.chapter)
      .eq("verse_start", selection.verseStart)
      .eq("verse_end", selection.verseEnd);
    if (delErr) {
      setHighlights(highlights); // rollback
      showToast(friendlyError(delErr.message));
      return;
    }
    const { data, error } = await supabase
      .from("highlights")
      .insert({
        user_id: userId,
        day_number: dayNumber,
        testament,
        book: selection.book,
        chapter: selection.chapter,
        verse_start: selection.verseStart,
        verse_end: selection.verseEnd,
        colour
      })
      .select()
      .single();
    if (error) {
      setHighlights(highlights); // rollback
      showToast(friendlyError(error.message));
      return;
    }
    setHighlights([...stripped, data as Highlight]);
    dismissSelection();
  }

  async function removeHighlight() {
    if (!selection || !currentHighlight) return;
    const prev = highlights;
    setHighlights(highlights.filter((h) => h.id !== currentHighlight.id));
    const { error } = await supabase
      .from("highlights")
      .delete()
      .eq("id", currentHighlight.id);
    if (error) {
      setHighlights(prev);
      showToast(friendlyError(error.message));
      return;
    }
    dismissSelection();
  }

  async function saveNote(body: string) {
    if (!selection) return;
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
      const optimistic: VerseNote = {
        id: `optimistic-${Date.now()}`,
        user_id: userId,
        day_number: dayNumber,
        testament,
        book: selection.book,
        chapter: selection.chapter,
        verse_start: selection.verseStart,
        verse_end: selection.verseEnd,
        verse_text: selection.text,
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
          book: selection.book,
          chapter: selection.chapter,
          verse_start: selection.verseStart,
          verse_end: selection.verseEnd,
          verse_text: selection.text,
          body
        })
        .select()
        .single();
      setSheetSaving(false);
      if (error) {
        setNotes(notes);
        showToast(friendlyError(error.message));
        return;
      }
      setNotes([...notes, data as VerseNote]);
    }
    setSheetOpen(false);
    dismissSelection();
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
    dismissSelection();
    showToast("Note deleted.");
  }

  /**
   * A link that lands the recipient on the verse, not the front door.
   *
   * This used to share window.location.origin — so someone sent "Isaiah 43:2"
   * got the home page and had to go and find it, which rather undoes the point
   * of sharing a verse. The book comes through as a display name because that
   * is what the reader sees, so it goes back through the book table to reach
   * the slug the route is built on.
   *
   * Works from /read as well as /bible: a verse shared out of the daily plan
   * still points at a stable, readable Bible route rather than at whichever
   * plan day happened to contain it.
   */
  function shareUrl(): string {
    if (typeof window === "undefined") return "";
    const origin = window.location.origin;
    if (!selection) return origin;

    const book = bookByName(selection.book);
    // Shouldn't happen — the reader is always given canonical names — but a
    // share is not worth breaking over a lookup miss.
    if (!book) return origin;

    const segment =
      selection.verseStart === selection.verseEnd
        ? `${selection.verseStart}`
        : `${selection.verseStart}-${selection.verseEnd}`;
    return `${origin}/bible/${book.slug}/${selection.chapter}/${segment}`;
  }

  async function share() {
    if (!selection) return;
    const ref = formatVerseReference(
      selection.book,
      selection.chapter,
      selection.verseStart,
      selection.verseEnd
    );
    const text = `“${selection.text}” — ${ref}`;
    const url = shareUrl();
    if (typeof navigator !== "undefined" && (navigator as any).share) {
      try {
        await (navigator as any).share({ text, url });
        dismissSelection();
        return;
      } catch {
        /* user cancelled — fall through to clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast("Copied to clipboard.");
      dismissSelection();
    } catch {
      showToast("Couldn't copy. Try again.");
    }
  }

  async function shareImage() {
    if (!selection) return;
    const ref = formatVerseReference(
      selection.book,
      selection.chapter,
      selection.verseStart,
      selection.verseEnd
    );
    const params = new URLSearchParams({ ref, text: selection.text });
    const url = `/api/og/verse?${params.toString()}`;
    showToast("Building your card…");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("bad response");
      const blob = await res.blob();
      const file = new File([blob], `deep-waters-${ref.replace(/[^\w]+/g, "-")}.png`, {
        type: "image/png"
      });
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: ref, url: shareUrl() });
          setToast(null);
          dismissSelection();
          return;
        } catch {
          /* fall through */
        }
      }
      // Download fallback.
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      showToast("Card downloaded.");
      dismissSelection();
    } catch {
      showToast("Couldn't build the card. Try again.");
    }
  }

  function dismissSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
  }

  function openNote() {
    if (!selection) return;
    setSheetOpen(true);
  }

  const currentRef = selection
    ? formatVerseReference(
        selection.book,
        selection.chapter,
        selection.verseStart,
        selection.verseEnd
      )
    : "";

  // Render -----------------------------------------------------------

  return (
    <>
      <div ref={rootRef} className="mt-16">
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
                className="bible-content selectable"
                dangerouslySetInnerHTML={{ __html: c.html }}
              />
            </article>
          </div>
        ))}
      </div>

      <VerseToolbar
        pos={selection?.rect ?? null}
        currentColour={currentHighlight?.colour ?? null}
        hasNote={hasNoteOnRange}
        onHighlight={saveHighlight}
        onRemoveHighlight={removeHighlight}
        onNote={openNote}
        onShare={share}
        onShareImage={shareImage}
      />

      <VerseNoteSheet
        open={sheetOpen}
        reference={currentRef}
        verseText={selection?.text ?? ""}
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
          className="fixed bottom-8 left-1/2 z-[80] -translate-x-1/2 px-4 py-2 text-[13px] font-medium pointer-events-none"
          style={{
            // The tab bar is hidden while reading, so this sits on the
            // bottom edge. Square: it is a message, not something to press.
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
