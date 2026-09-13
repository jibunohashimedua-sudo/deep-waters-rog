"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { type HighlightColour } from "@/lib/highlights";
import {
  RHAPSODY_ATTRIBUTION,
  articleFrom,
  deleteHighlights,
  deleteNote,
  extractAnchor,
  insertHighlights,
  isSection,
  loadForDate,
  place,
  upsertNote,
  type ArticleDoc,
  type Highlight,
  type Note,
  type Placement,
  type Section
} from "@/lib/devotionalHighlights";
import { paintBlock, offsetIn } from "@/lib/devotionalPaint";
import ShareCardSheet from "./ShareCardSheet";
import VerseToolbar from "./VerseToolbar";

/**
 * The interactive layer on top of a Rhapsody article.
 *
 * The article's server-rendered text is handed in as three sections. This
 * component renders each section as one or more block paragraphs, each
 * carrying a data-devo-section / data-devo-block pair — that pair is the
 * stable id the placement algorithm anchors highlights and notes to.
 *
 * The paint pass is where devotional differs from the scripture reader.
 * Scripture's paint is unconditional because React re-injects each verse's
 * `dangerouslySetInnerHTML`, so the paint has to reassert on every render
 * or it loses the fight. Here we own the DOM directly: rewriting a block's
 * `innerHTML` blows away any live text selection, and doing it on every
 * render — one for each `selectionchange` during a drag — destroys the
 * selection mid-drag. So the paint effect is gated on
 * `[placedHighlights, placedNotes, doc]`; it fires when marks or the
 * article change, and stays out of the way while the reader is selecting.
 *
 * The toolbar is the shared VerseToolbar from the scripture reader,
 * bottom-fixed and out of the way of the text. Only the callbacks that
 * make sense for prose are passed in — highlight, note, copy, share as
 * image. Compare and Share (link + text) are omitted; the toolbar skips
 * rendering those buttons.
 *
 * Attribution: a shared card of a Rhapsody selection carries a small
 * mono credit line — the constant is in lib/devotionalHighlights.ts, and
 * the wording is a PLACEHOLDER until the publisher confirms.
 */

type Props = {
  userId: string;
  currentDayNumber: number;
  entry: {
    date: string;
    title: string;
    verse_text: string | null;
    body: string | null;
    prayer: string | null;
    prayer_label: string | null;
  };
  initialHighlights: Highlight[];
  initialNotes: Note[];
  humanDate: string;
};

type PlacedHighlight = Highlight & { placement: Placement };
type PlacedNote = Note & { placement: Placement };

// A selection captured from the browser, resolved to plain-text anchors
// per block. One selection can produce several anchors (a cross-block
// pick). No client rect: the toolbar is bottom-fixed and doesn't need
// to know where on screen the words are.
type Captured = {
  fullQuote: string;
  ranges: Array<{
    section: Section;
    block: number;
    offset: number;
    length: number;
    quote: string;
    prefix: string;
    suffix: string;
  }>;
};

export default function DevotionalReader({
  userId,
  currentDayNumber,
  entry,
  initialHighlights,
  initialNotes,
  humanDate
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the plain text of every block so the paint pass always starts
  // from truth instead of reading a DOM the paint itself wrote.
  const plainTextRef = useRef<Map<string, string>>(new Map());
  // True while the reader's most recent pointer went down on the
  // toolbar. Tapping a toolbar button (Highlight, a swatch, Note…)
  // collapses the browser's text selection as a side effect, which
  // otherwise fires selectionchange with an empty range and closes the
  // bar before the button's own click has a chance to run. This flag
  // lets the selection handler ignore that particular collapse.
  const toolbarTouchedRef = useRef(false);

  const doc: ArticleDoc = useMemo(() => articleFrom(entry), [entry]);
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [toast, setToast] = useState<string | null>(null);
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareText, setShareText] = useState("");
  const [shareRef, setShareRef] = useState("");
  const [noteSheet, setNoteSheet] = useState<null | {
    range_id?: string;
    anchor: Captured["ranges"][number];
    quote: string;
    existing: Note | null;
  }>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (!m) return;
    const t = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(t);
  }, []);

  // -----------------------------------------------------------------
  // Compute placements. If the article changed underneath our stored
  // anchors, this is where they either re-anchor to their new position
  // or fall into the orphan panel.
  // -----------------------------------------------------------------
  const placedHighlights = useMemo<PlacedHighlight[]>(
    () => highlights.map((h) => ({ ...h, placement: place(h, doc) })),
    [highlights, doc]
  );
  const placedNotes = useMemo<PlacedNote[]>(
    () => notes.map((n) => ({ ...n, placement: place(n, doc) })),
    [notes, doc]
  );

  const orphanHighlights = placedHighlights.filter(
    (h) => h.placement.kind === "orphan"
  );
  const orphanNotes = placedNotes.filter((n) => n.placement.kind === "orphan");

  // -----------------------------------------------------------------
  // Refresh from the server on mount and whenever the article's date
  // changes. Initial data is server-fetched, but a save from another
  // device should show up on return.
  // -----------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { highlights: hl, notes: nt, error } = await loadForDate(
        supabase,
        userId,
        entry.date
      );
      if (cancelled) return;
      if (error) {
        showToast(friendlyError(error));
        return;
      }
      setHighlights(hl);
      setNotes(nt);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId, entry.date, showToast]);

  // -----------------------------------------------------------------
  // The paint pass. Gated on marks + article — never on selection.
  //
  // This is the opposite pattern from the scripture reader. There, the
  // paint has to be unconditional because React re-injects each verse's
  // `dangerouslySetInnerHTML` on every render and would otherwise erase
  // the wrappers we just wrote. Here we own the DOM directly, so an
  // unconditional paint is a bug in the other direction: every render
  // would call `block.innerHTML = ...`, which destroys any live text
  // selection. During a drag, `selectionchange` fires many times per
  // second and each one triggers a re-render. If paint ran with those,
  // the browser would hand the selection back only to have us wipe it
  // on the next frame, and the reader could never hold more than a word.
  //
  // The right trigger is the marks themselves: paint when a highlight
  // or note is added, removed, or re-anchored; paint when the article
  // changes; stay out of the way otherwise.
  // -----------------------------------------------------------------
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const blocks = root.querySelectorAll<HTMLElement>("[data-devo-block]");
    blocks.forEach((block) => {
      const section = block.getAttribute("data-devo-section");
      const idx = Number(block.getAttribute("data-devo-block"));
      if (!isSection(section) || !Number.isFinite(idx)) return;
      const key = `${section}|${idx}`;
      const plain = plainTextRef.current.get(key) ?? "";
      const hlsInBlock = placedHighlights
        .filter(
          (h) =>
            h.placement.kind === "placed" &&
            h.placement.section === section &&
            h.placement.block === idx
        )
        .map((h) => ({
          id: h.id,
          range_id: h.range_id,
          offset: (h.placement as { offset: number }).offset,
          length: (h.placement as { length: number }).length,
          colour: h.colour,
          createdAtMs: new Date(h.created_at).getTime()
        }));
      const notesInBlock = placedNotes
        .filter(
          (n) =>
            n.placement.kind === "placed" &&
            n.placement.section === section &&
            n.placement.block === idx
        )
        .map((n) => ({
          id: n.id,
          offset: (n.placement as { offset: number }).offset,
          length: (n.placement as { length: number }).length
        }));
      block.innerHTML = paintBlock(plain, hlsInBlock, notesInBlock);
    });
  }, [placedHighlights, placedNotes, doc]);

  // -----------------------------------------------------------------
  // Selection handling. Watches the browser's own selection; when the
  // reader releases inside our container with a non-empty selection,
  // we resolve it to per-block plain-text anchors and open the floating
  // toolbar.
  // -----------------------------------------------------------------
  useEffect(() => {
    function onSelection() {
      const root = containerRef.current;
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        // A tap on the toolbar itself collapses the selection as a
        // side effect. Don't close the bar out from under its own tap
        // — the button's onClick is next in line to run and will
        // clear captured itself once it has done its work.
        if (toolbarTouchedRef.current) return;
        setCaptured(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) {
        setCaptured(null);
        return;
      }
      const captured = captureSelection(root, sel);
      setCaptured(captured);
    }
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, []);

  // Track pointerdowns for two reasons:
  //   (1) Set the toolbar-touched flag so the selection handler ignores
  //       the collapse that follows a tap on a bar button. The flag is
  //       lowered on the next pointerup — the collapse we're guarding
  //       against fires between the two.
  //   (2) A tap that lands outside both the article and the toolbar
  //       clears the selection and closes the bar.
  useEffect(() => {
    function onDown(e: PointerEvent) {
      const root = containerRef.current;
      if (!root) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const inToolbar = !!target.closest(".verse-bar");
      toolbarTouchedRef.current = inToolbar;
      if (inToolbar) return;
      if (root.contains(target)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) sel.removeAllRanges();
      setCaptured(null);
    }
    function onUp() {
      toolbarTouchedRef.current = false;
    }
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointerup", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
    };
  }, []);

  // -----------------------------------------------------------------
  // Save handlers.
  // -----------------------------------------------------------------
  const saveHighlight = useCallback(
    async (colour: HighlightColour) => {
      if (!captured) return;
      const range_id = crypto.randomUUID();
      const rows = captured.ranges.map((r) => ({
        user_id: userId,
        range_id,
        date: entry.date,
        section: r.section,
        block: r.block,
        offset: r.offset,
        length: r.length,
        quote: r.quote,
        prefix: r.prefix,
        suffix: r.suffix,
        colour
      }));
      // Optimistic; roll back on failure.
      const previous = highlights;
      const optimistic: Highlight[] = rows.map((r, i) => ({
        id: `optimistic-${range_id}-${i}`,
        user_id: userId,
        range_id,
        section: r.section,
        block: r.block,
        offset: r.offset,
        length: r.length,
        quote: r.quote,
        prefix: r.prefix,
        suffix: r.suffix,
        colour,
        created_at: new Date().toISOString()
      }) as Highlight);
      setHighlights([...previous, ...optimistic]);
      window.getSelection()?.removeAllRanges();
      setCaptured(null);
      const { data, error } = await insertHighlights(supabase, rows as any);
      if (error) {
        setHighlights(previous);
        showToast(friendlyError(error));
        return;
      }
      if (data) {
        setHighlights([...previous, ...data]);
      }
    },
    [captured, entry.date, highlights, supabase, userId, showToast]
  );

  const removeHighlightsAtSelection = useCallback(async () => {
    if (!captured) return;
    // Which stored highlights overlap the current selection? The
    // placed placement is what defines where a highlight visually sits
    // right now, so we compare against the selection by
    // section+block+range using it.
    const touched = highlights.filter((h) => {
      const placement = placedHighlights.find((p) => p.id === h.id)?.placement;
      if (!placement || placement.kind !== "placed") return false;
      const p = placement;
      return captured.ranges.some((r) => {
        if (r.section !== p.section || r.block !== p.block) return false;
        const rStart = r.offset;
        const rEnd = r.offset + r.length;
        const pStart = p.offset;
        const pEnd = p.offset + p.length;
        return rStart < pEnd && pStart < rEnd;
      });
    });
    if (touched.length === 0) return;
    const previous = highlights;
    setHighlights(highlights.filter((h) => !touched.some((t) => t.id === h.id)));
    window.getSelection()?.removeAllRanges();
    setCaptured(null);
    // Every saved id (not optimistic-*).
    const savedIds = touched.map((t) => t.id).filter((id) => !id.startsWith("optimistic-"));
    if (savedIds.length > 0) {
      const err = await deleteHighlights(supabase, savedIds);
      if (err) {
        setHighlights(previous);
        showToast(friendlyError(err));
      }
    }
  }, [captured, highlights, placedHighlights, supabase, showToast]);

  const openNoteFromSelection = useCallback(() => {
    if (!captured || captured.ranges.length === 0) return;
    // A note anchors to a single range — the first block the selection
    // touches. Cross-block notes would need cross-block anchors, which
    // is more UX than this pass needs.
    const r = captured.ranges[0];
    const existing =
      notes.find(
        (n) =>
          n.section === r.section &&
          n.block === r.block &&
          n.offset === r.offset &&
          n.length === r.length
      ) ?? null;
    setNoteSheet({
      anchor: r,
      quote: r.quote,
      existing
    });
    window.getSelection()?.removeAllRanges();
    setCaptured(null);
  }, [captured, notes]);

  const copy = useCallback(async () => {
    if (!captured) return;
    try {
      await navigator.clipboard.writeText(captured.fullQuote);
      showToast("Copied.");
    } catch {
      showToast("Couldn't copy.");
    }
  }, [captured, showToast]);

  const share = useCallback(() => {
    if (!captured) return;
    setShareText(captured.fullQuote);
    setShareRef(`${entry.title} · ${humanDate}`);
    setShareOpen(true);
  }, [captured, entry.title, humanDate]);

  const saveNote = useCallback(
    async (body: string) => {
      if (!noteSheet) return;
      const trimmed = body.trim();
      if (!trimmed) return;
      const previous = notes;
      if (noteSheet.existing) {
        setNotes(
          notes.map((n) =>
            n.id === noteSheet.existing!.id
              ? { ...n, body: trimmed, updated_at: new Date().toISOString() }
              : n
          )
        );
        const { error } = await upsertNote(supabase, {
          id: noteSheet.existing.id,
          body: trimmed
        });
        if (error) {
          setNotes(previous);
          showToast(friendlyError(error));
          return;
        }
      } else {
        const optimistic: Note = {
          id: `optimistic-${Date.now()}`,
          section: noteSheet.anchor.section,
          block: noteSheet.anchor.block,
          offset: noteSheet.anchor.offset,
          length: noteSheet.anchor.length,
          quote: noteSheet.anchor.quote,
          prefix: noteSheet.anchor.prefix,
          suffix: noteSheet.anchor.suffix,
          body: trimmed,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setNotes([...previous, optimistic]);
        const { data, error } = await upsertNote(supabase, {
          user_id: userId,
          date: entry.date,
          section: noteSheet.anchor.section,
          block: noteSheet.anchor.block,
          offset: noteSheet.anchor.offset,
          length: noteSheet.anchor.length,
          quote: noteSheet.anchor.quote,
          prefix: noteSheet.anchor.prefix,
          suffix: noteSheet.anchor.suffix,
          body: trimmed
        } as any);
        if (error) {
          setNotes(previous);
          showToast(friendlyError(error));
          return;
        }
        if (data) {
          setNotes([...previous, data]);
        }
      }
      setNoteSheet(null);
      showToast("Note saved.");
    },
    [entry.date, notes, noteSheet, supabase, userId, showToast]
  );

  const removeNote = useCallback(async () => {
    if (!noteSheet?.existing) return;
    const target = noteSheet.existing;
    const previous = notes;
    setNotes(notes.filter((n) => n.id !== target.id));
    setNoteSheet(null);
    const err = await deleteNote(supabase, target.id);
    if (err) {
      setNotes(previous);
      showToast(friendlyError(err));
    }
  }, [noteSheet, notes, supabase, showToast]);

  // -----------------------------------------------------------------
  // Toolbar meta, derived from the current selection.
  //
  // `currentColour` is the colour on the selection when every placed
  // highlight it overlaps shares one; otherwise null (mixed or none).
  // `anyHighlighted` and `hasNote` decide whether the toolbar's labels
  // read "Highlight" / "Note" or "Change colour" / "Edit note".
  // -----------------------------------------------------------------
  const toolbarMeta = useMemo(() => {
    if (!captured) {
      return {
        currentColour: null as HighlightColour | null,
        anyHighlighted: false,
        hasNote: false
      };
    }
    const overlappingColours = new Set<HighlightColour>();
    let anyHighlighted = false;
    for (const h of placedHighlights) {
      if (h.placement.kind !== "placed") continue;
      const p = h.placement;
      const hit = captured.ranges.some((r) => {
        if (r.section !== p.section || r.block !== p.block) return false;
        const rEnd = r.offset + r.length;
        const pEnd = p.offset + p.length;
        return r.offset < pEnd && p.offset < rEnd;
      });
      if (hit) {
        anyHighlighted = true;
        overlappingColours.add(h.colour);
      }
    }
    const currentColour =
      overlappingColours.size === 1 ? [...overlappingColours][0] : null;
    const first = captured.ranges[0];
    const hasNote = first
      ? placedNotes.some(
          (n) =>
            n.placement.kind === "placed" &&
            n.placement.section === first.section &&
            n.placement.block === first.block &&
            (n.placement as { offset: number }).offset === first.offset &&
            (n.placement as { length: number }).length === first.length
        )
      : false;
    return { currentColour, anyHighlighted, hasNote };
  }, [captured, placedHighlights, placedNotes]);

  // The reference line for the toolbar. Prose has no verse address, so
  // we show what identifies this piece: the article title (kept short by
  // trimming everything after the first "·" if the source packs a date
  // in there) and the human date beside it.
  const toolbarReference = useMemo(() => {
    const short = (entry.title || "Rhapsody").split("·")[0].trim();
    return `${short} · ${humanDate}`;
  }, [entry.title, humanDate]);

  // -----------------------------------------------------------------
  // Render. Keep the plain text of every block in the ref as it mounts,
  // so the paint pass has it.
  // -----------------------------------------------------------------
  const registerBlock = useCallback(
    (section: Section, block: number, plain: string) => (el: HTMLElement | null) => {
      if (!el) return;
      plainTextRef.current.set(`${section}|${block}`, plain);
    },
    []
  );

  return (
    <div ref={containerRef} className="devo-reader">
      {doc.sections.verse.length > 0 && (
        <blockquote className="mt-10 surface-soft selectable">
          <p
            className="scripture-prose text-lg leading-relaxed text-rog-ink"
            data-devo-section="verse"
            data-devo-block={0}
            ref={registerBlock("verse", 0, doc.sections.verse[0])}
          >
            {doc.sections.verse[0]}
          </p>
        </blockquote>
      )}

      {doc.sections.body.length > 0 && (
        <div className="mt-10 bible-content selectable">
          {doc.sections.body.map((para, i) => (
            <p
              key={i}
              data-devo-section="body"
              data-devo-block={i}
              ref={registerBlock("body", i, para)}
            >
              {para}
            </p>
          ))}
        </div>
      )}

      {doc.sections.prayer.length > 0 && (
        <div className="mt-16 surface-soft selectable">
          <p className="chapter-mark accent-pink">
            {entry.prayer_label?.trim() || "Prayer"}
          </p>
          <p
            className="mt-3 font-serif text-base leading-relaxed text-rog-ink"
            data-devo-section="prayer"
            data-devo-block={0}
            ref={registerBlock("prayer", 0, doc.sections.prayer[0])}
          >
            {doc.sections.prayer[0]}
          </p>
        </div>
      )}

      {/* Orphan panel — highlights and notes whose anchor no longer
          places against today's article. Never hidden: for notes in
          particular, the reader's own writing must always be reachable. */}
      {(orphanHighlights.length > 0 || orphanNotes.length > 0) && (
        <section className="mt-16 border-t border-rog-line pt-6">
          <p className="meta">Not on today&rsquo;s article</p>
          <p
            className="mt-2 text-[13px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            The article was updated after these were saved. Your words are
            still yours.
          </p>
          <ul style={{ marginTop: 16, listStyle: "none", padding: 0 }}>
            {orphanHighlights.map((h) => (
              <li
                key={h.id}
                className="mark-row"
                style={{
                  paddingLeft: 8,
                  borderLeft: `2px solid var(--hl-${h.colour}-rule)`
                }}
              >
                <p
                  className="mark-text selectable"
                  style={{ background: `var(--hl-${h.colour}-ground)`, padding: "4px 8px" }}
                >
                  {h.quote}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <span className="meta">
                    Saved {new Date(h.created_at).toLocaleDateString("en-GB")}
                  </span>
                  <button
                    type="button"
                    className="meta"
                    style={{ color: "var(--danger)", textDecoration: "underline" }}
                    onClick={async () => {
                      const previous = highlights;
                      setHighlights(highlights.filter((x) => x.id !== h.id));
                      const err = await deleteHighlights(supabase, [h.id]);
                      if (err) {
                        setHighlights(previous);
                        showToast(friendlyError(err));
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
            {orphanNotes.map((n) => (
              <li key={n.id} className="mark-row">
                <p className="mark-text selectable">{n.quote}</p>
                <p
                  className="mark-note selectable"
                  style={{ marginTop: 4, whiteSpace: "pre-wrap" }}
                >
                  {n.body}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                  <span className="meta">
                    Saved {new Date(n.created_at).toLocaleDateString("en-GB")}
                  </span>
                  <button
                    type="button"
                    className="meta"
                    style={{ color: "var(--danger)", textDecoration: "underline" }}
                    onClick={async () => {
                      const previous = notes;
                      setNotes(notes.filter((x) => x.id !== n.id));
                      const err = await deleteNote(supabase, n.id);
                      if (err) {
                        setNotes(previous);
                        showToast(friendlyError(err));
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The action bar is the shared VerseToolbar the scripture reader
          uses, bottom-fixed and out of the way of the selected text.
          Only the callbacks that make sense for prose are wired in —
          Compare and Share (link + text) are omitted, so the toolbar
          skips rendering those buttons. */}
      <VerseToolbar
        open={captured != null}
        reference={toolbarReference}
        currentColour={toolbarMeta.currentColour}
        anyHighlighted={toolbarMeta.anyHighlighted}
        hasNote={toolbarMeta.hasNote}
        onHighlight={saveHighlight}
        onRemoveHighlight={removeHighlightsAtSelection}
        onNote={openNoteFromSelection}
        onCopy={copy}
        onShareImage={share}
      />

      {noteSheet && (
        <DevotionalNoteSheet
          quote={noteSheet.quote}
          initialBody={noteSheet.existing?.body ?? ""}
          onSave={saveNote}
          onDelete={noteSheet.existing ? removeNote : undefined}
          onClose={() => setNoteSheet(null)}
        />
      )}

      <ShareCardSheet
        open={shareOpen}
        reference={shareRef}
        verseText={shareText}
        dayNumber={currentDayNumber}
        attribution={RHAPSODY_ATTRIBUTION}
        onClose={() => setShareOpen(false)}
        onToast={(m) => showToast(m)}
      />

      {toast && (
        <div role="status" aria-live="polite" className="toast" style={{ bottom: 24 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------
// Small purpose-built note sheet — same shape as VerseNoteSheet but
// speaks about the devotional passage rather than a verse span.
// -----------------------------------------------------------------
function DevotionalNoteSheet({
  quote,
  initialBody,
  onSave,
  onDelete,
  onClose
}: {
  quote: string;
  initialBody: string;
  onSave: (body: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit() {
    if (!body.trim() || saving) return;
    setSaving(true);
    try {
      await onSave(body);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="sheet-backdrop"
        style={{ position: "absolute", inset: 0, border: 0, cursor: "pointer" }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--bg)",
          borderTop: "1px solid var(--line)",
          padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)"
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <p className="meta">Note on this passage</p>
          <blockquote
            className="mt-3 surface-soft"
            style={{ fontFamily: "var(--font-serif), serif", fontSize: 15, lineHeight: 1.55 }}
          >
            {quote}
          </blockquote>
          <label
            htmlFor="dw-devo-note"
            className="meta"
            style={{ marginTop: 16, display: "block" }}
          >
            Your note
          </label>
          <textarea
            id="dw-devo-note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            enterKeyHint="done"
            placeholder="What did this stir?"
            className="w-full border border-rog-line bg-white px-4 py-3 font-serif text-[15px] leading-relaxed focus:border-rog-purple focus:outline-none"
            style={{ marginTop: 8 }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="chapter-pager-prev"
                style={{ flex: 1, justifyContent: "center", color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="chapter-pager-prev"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!body.trim() || saving}
              className="chapter-pager-next"
              style={{ flex: 1.6, justifyContent: "center", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------
// Selection → captured. Resolves the browser's Selection to per-block
// plain-text anchors so the placement algorithm can save them.
// -----------------------------------------------------------------
function captureSelection(root: HTMLElement, sel: Selection): Captured | null {
  if (sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const startBlock = closestBlock(range.startContainer);
  const endBlock = closestBlock(range.endContainer);
  if (!startBlock || !endBlock) return null;
  if (!root.contains(startBlock) || !root.contains(endBlock)) return null;

  // Every block the selection touches, in document order.
  const blocks = collectBlocksBetween(root, startBlock, endBlock);
  if (blocks.length === 0) return null;

  const ranges: Captured["ranges"] = [];
  const fullQuoteParts: string[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const blockEl = blocks[i];
    const section = blockEl.getAttribute("data-devo-section");
    const blockIdx = Number(blockEl.getAttribute("data-devo-block"));
    if (!isSection(section) || !Number.isFinite(blockIdx)) continue;
    const plain = blockEl.textContent ?? "";

    const start = i === 0 ? offsetIn(blockEl, range.startContainer, range.startOffset) : 0;
    const end =
      i === blocks.length - 1
        ? offsetIn(blockEl, range.endContainer, range.endOffset)
        : plain.length;
    if (end <= start) continue;

    const length = end - start;
    const { quote, prefix, suffix } = extractAnchor(plain, start, length);
    if (!quote.trim()) continue;
    ranges.push({
      section,
      block: blockIdx,
      offset: start,
      length,
      quote,
      prefix,
      suffix
    });
    fullQuoteParts.push(quote);
  }

  if (ranges.length === 0) return null;

  return {
    fullQuote: fullQuoteParts.join(" "),
    ranges
  };
}

function closestBlock(node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n) {
    if (n instanceof HTMLElement && n.hasAttribute("data-devo-block")) return n;
    n = n.parentNode;
  }
  return null;
}

function collectBlocksBetween(
  root: HTMLElement,
  start: HTMLElement,
  end: HTMLElement
): HTMLElement[] {
  const all = Array.from(root.querySelectorAll<HTMLElement>("[data-devo-block]"));
  const startIdx = all.indexOf(start);
  const endIdx = all.indexOf(end);
  if (startIdx === -1 || endIdx === -1) return [];
  const [a, b] = startIdx <= endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
  return all.slice(a, b + 1);
}
