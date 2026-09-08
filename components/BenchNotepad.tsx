"use client";
import { useEffect, useRef, useState } from "react";
import type { VerseNote } from "@/lib/highlights";
import { formatVerseReference } from "@/lib/highlights";

type Props = {
  notes: VerseNote[];
  /** The composer's text. Held above this component so it survives a
      rotation, a fold, or a Split View window being dragged wider. */
  draft: string;
  onDraftChange: (value: string) => void;
  /** The note being edited, if any. */
  editingId: string | null;
  onEdit: (note: VerseNote) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: (id: string) => void;
  saving: boolean;
  /** Set by the Bench's Note action, to bring the composer into view. */
  focusSignal: number;
};

/** How long a delete stays armed before it disarms itself. */
const ARM_MS = 4000;

/**
 * The pastor's notes on the pinned verse, and the composer.
 *
 * These are the app's own verse notes — the same table, the same RLS, the
 * same private-to-the-author rule. Elite does not keep a second set of
 * notes; it shows you the ones you already have on this verse and lets you
 * edit and delete them, which the reader could not do anywhere until now.
 *
 * Delete takes two taps and no modal. The first arms it and says so; it
 * disarms itself after four seconds, which is the same promise a modal
 * makes without stopping the room to make it.
 */
export default function BenchNotepad({
  notes,
  draft,
  onDraftChange,
  editingId,
  onEdit,
  onCancelEdit,
  onSave,
  onDelete,
  saving,
  focusSignal
}: Props) {
  const [armed, setArmed] = useState<string | null>(null);
  const composer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  // The Note action brings the composer into view. It does not focus the
  // field: a keyboard that opens because a panel scrolled is a keyboard
  // nobody asked for.
  useEffect(() => {
    if (focusSignal === 0) return;
    composer.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusSignal]);

  return (
    <div className="bench-notepad">
      {notes.length > 0 && (
        <ul className="bench-rows">
          {notes.map((n) => {
            const edited =
              new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() >
              1500;
            return (
              <li key={n.id} className="bench-row">
                <p className="kicker kicker-strong">
                  {formatVerseReference(n.book, n.chapter, n.verse_start, n.verse_end)}
                </p>
                <p className="bench-said">{n.body}</p>
                <p className="kicker">
                  {edited ? "Edited " : ""}
                  {new Date(n.updated_at).toLocaleDateString("en-GB")}
                </p>
                <div className="bench-row-actions">
                  <button
                    type="button"
                    className="bench-act"
                    onClick={() => {
                      setArmed(null);
                      onEdit(n);
                    }}
                    disabled={saving}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="bench-act"
                    data-danger={armed === n.id ? "true" : undefined}
                    onClick={() => {
                      if (armed === n.id) {
                        setArmed(null);
                        onDelete(n.id);
                      } else {
                        setArmed(n.id);
                      }
                    }}
                    disabled={saving}
                  >
                    {armed === n.id ? "Tap again to delete" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {notes.length === 0 && (
        <p className="bench-empty">Nothing written on this verse yet.</p>
      )}

      <div className="bench-composer" ref={composer}>
        <label htmlFor="bench-note" className="kicker">
          {editingId ? "Editing your note" : "Your note"}
        </label>
        <textarea
          id="bench-note"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={4}
          enterKeyHint="done"
          placeholder="What is this passage doing?"
          className="bench-textarea"
        />
        <div className="bench-composer-actions">
          {editingId && (
            <button
              type="button"
              className="bench-act"
              onClick={onCancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            className="bench-primary"
            onClick={onSave}
            disabled={saving || !draft.trim()}
          >
            {saving ? "Saving…" : editingId ? "Update note" : "Save note"}
          </button>
        </div>
        <p className="bench-source">Private to you. Never shared to the feed.</p>
      </div>
    </div>
  );
}
