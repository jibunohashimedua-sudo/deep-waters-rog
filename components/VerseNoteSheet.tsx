"use client";
import { useEffect, useState } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import Sheet from "@/components/Sheet";

type Props = {
  open: boolean;
  reference: string;
  verseText: string;
  /** Existing note body (if editing), null when this is a new note. */
  initialBody: string | null;
  /** Called with the note body when Save is tapped. */
  onSave: (body: string) => void;
  /** Only present when initialBody is set — offers delete. */
  onDelete?: () => void;
  onClose: () => void;
  saving: boolean;
};

/**
 * Bottom sheet for the "Add note" flow. Same glass treatment as the
 * MoreSheet — this app already has a bottom-sheet grammar and we
 * match it exactly so the sheet feels native across the app.
 */
export default function VerseNoteSheet({
  open,
  reference,
  verseText,
  initialBody,
  onSave,
  onDelete,
  onClose,
  saving
}: Props) {
  const [body, setBody] = useState(initialBody ?? "");

  useEffect(() => {
    if (open) setBody(initialBody ?? "");
  }, [open, initialBody]);

  // Counted, so a sheet opened on top of another one doesn't leave the
  // body locked when the first of them closes. See lib/useLockBodyScroll.
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label={`Note on ${reference}`}
      dataVerseSheet
    >
        <div className="px-5 pb-5">
          <p className="meta">Note on</p>
          <h2 className="mt-2 font-serif text-2xl font-medium text-rog-ink leading-tight">
            {reference}
          </h2>

          {verseText && (
            <blockquote className="mt-4 scripture-prose text-[15px] leading-relaxed text-rog-muted border-l-2 border-rog-line pl-4 max-h-40 overflow-y-auto selectable">
              &ldquo;{verseText}&rdquo;
            </blockquote>
          )}

          <label htmlFor="dw-verse-note" className="mt-6 block text-sm font-medium text-rog-ink">
            Your note
          </label>
          <p className="mt-1 mb-2 text-xs text-rog-muted">
            Private to you. Never shared to the community.
          </p>
          <textarea
            id="dw-verse-note"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            enterKeyHint="done"
            placeholder="What did this stir? What are you carrying?"
            className="w-full border border-rog-line bg-white px-4 py-3 font-serif text-[15px] leading-relaxed focus:border-rog-purple focus:outline-none"
          />

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(body.trim())}
              className="btn-primary flex-1 disabled:opacity-50"
              disabled={saving || !body.trim()}
            >
              {saving ? "Saving…" : initialBody !== null ? "Save changes" : "Save note"}
            </button>
          </div>

          {onDelete && initialBody !== null && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-rog-muted hover:text-danger transition-colors"
                disabled={saving}
              >
                Delete this note
              </button>
            </div>
          )}
        </div>
    </Sheet>
  );
}
