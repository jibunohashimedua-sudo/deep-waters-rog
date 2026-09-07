"use client";
import { useEffect, useState } from "react";
import {
  HIGHLIGHT_COLOURS,
  HIGHLIGHT_LIGHT,
  type HighlightColour
} from "@/lib/highlights";

type Props = {
  /** True when at least one verse is selected. */
  open: boolean;
  /** Live reference for the current selection — "Psalm 42:3,7". */
  reference: string;
  /** The cap, named in the quiet message when it is reached. */
  cap: number;
  atCap: boolean;
  /** The colour on the selection, if every selected verse shares one. */
  currentColour: HighlightColour | null;
  /** True when any selected verse already carries a highlight. */
  anyHighlighted: boolean;
  /** True when a selected verse already has a note. */
  hasNote: boolean;
  onHighlight: (colour: HighlightColour) => void;
  onRemoveHighlight: () => void;
  onNote: () => void;
  onCopy: () => void;
  onShare: () => void;
  onShareImage: () => void;
};

/**
 * The verse toolbar.
 *
 * It anchors to the bottom of the screen, in the space the tab bar has
 * vacated for the reading screen. It used to float beside the selection,
 * which meant it covered the words it was there to act on, and on a phone
 * it arrived under the reader's own thumb. A fixed place at the foot of the
 * screen is both easier to reach and impossible to lose.
 *
 * Opaque ground, one hairline along the top, no blur, no shadow. It slides
 * up and down in 200ms on transform alone.
 */
export default function VerseToolbar({
  open,
  reference,
  cap,
  atCap,
  currentColour,
  anyHighlighted,
  hasNote,
  onHighlight,
  onRemoveHighlight,
  onNote,
  onCopy,
  onShare,
  onShareImage
}: Props) {
  const [showColours, setShowColours] = useState(false);

  // Coming back to a fresh selection should never land on the swatch row —
  // the first question is always what to do, not which colour.
  useEffect(() => {
    if (!open) setShowColours(false);
  }, [open]);

  return (
    <div
      className="verse-bar"
      data-open={open ? "true" : undefined}
      role="dialog"
      aria-label="Verse actions"
      aria-hidden={!open}
    >
      <div className="verse-bar-ref">
        <span className="kicker kicker-strong" aria-live="polite">
          {reference}
        </span>
        {/* The cap, mentioned only when it is reached. A counter running
            beside every selection would be the app talking about itself. */}
        {atCap && <span className="kicker">{cap} at once is the most</span>}
      </div>

      {!showColours ? (
        <div className="verse-actions">
          <button
            type="button"
            className="verse-action"
            data-on={anyHighlighted ? "true" : undefined}
            onClick={() => setShowColours(true)}
          >
            {anyHighlighted ? "Change colour" : "Highlight"}
          </button>
          <button
            type="button"
            className="verse-action"
            data-on={hasNote ? "true" : undefined}
            onClick={onNote}
          >
            {hasNote ? "Edit note" : "Note"}
          </button>
          <button type="button" className="verse-action" onClick={onCopy}>
            Copy
          </button>
          <button type="button" className="verse-action" onClick={onShare}>
            Share
          </button>
          <button type="button" className="verse-action" onClick={onShareImage}>
            Share as image
          </button>
        </div>
      ) : (
        <div className="verse-actions">
          <button
            type="button"
            className="verse-action"
            onClick={() => setShowColours(false)}
            aria-label="Back to actions"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          {HIGHLIGHT_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              className="hl-swatch"
              data-c={c}
              data-on={currentColour === c ? "true" : undefined}
              aria-pressed={currentColour === c}
              aria-label={HIGHLIGHT_LIGHT[c].name}
              title={HIGHLIGHT_LIGHT[c].name}
              onClick={() => onHighlight(c)}
            />
          ))}

          {/* Offered whenever any selected verse already carries a mark —
              including a selection that spans two different colours, where
              "remove" is the only thing that means one clear thing. */}
          {anyHighlighted && (
            <button
              type="button"
              className="verse-action"
              onClick={onRemoveHighlight}
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}
