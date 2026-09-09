"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  HIGHLIGHT_COLOURS,
  highlightName,
  type HighlightColour
} from "@/lib/highlights";

/**
 * The chip that opens the Bench, fetched only for a reader who has it.
 *
 * This toolbar is a static import in ScriptureReader and therefore in
 * every member's bundle. The chip's label and its data-elite marker used
 * to be written here, so both were readable by anyone who opened devtools
 * on the reading screen. Behind this boundary they are in a chunk no page
 * lists. See components/BenchChip.tsx.
 */
const BenchChip = dynamic(() => import("./BenchChip"), { ssr: false });

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
  onCompare: () => void;
  /** Elite only. False means the chip does not exist — there is no locked
      button here for a member to find. */
  showBench: boolean;
  onBench: () => void;
  /** True once the Bench has been collapsed back down onto this toolbar.
      The handle it leaves behind is the second tap that closes everything;
      the Bench never jumps straight from open to closed. */
  benchCollapsed: boolean;
  onCloseAll: () => void;
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
  onCompare,
  showBench,
  onBench,
  benchCollapsed,
  onCloseAll,
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
      {/* Left behind when the Bench collapses onto this bar. Tapping it is
          the second tap: it lets the verse go and takes the bar with it. */}
      {benchCollapsed && (
        <button
          type="button"
          className="verse-grab"
          onClick={onCloseAll}
          aria-label="Close"
        >
          <span className="verse-grab-bar" aria-hidden />
        </button>
      )}

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
          {/* Sits next to Note rather than out by Share: comparing is
              something you do while you're still reading the verse, not
              something you do with it afterwards. */}
          <button type="button" className="verse-action" onClick={onCompare}>
            Compare
          </button>
          {/* The seventh chip. A reader without the flag never sees it,
              and never downloads it either — see BenchChip. */}
          {showBench && <BenchChip onClick={onBench} />}
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
            Back
          </button>

          {HIGHLIGHT_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              className="hl-swatch"
              data-c={c}
              data-on={currentColour === c ? "true" : undefined}
              aria-pressed={currentColour === c}
              aria-label={highlightName(c)}
              title={highlightName(c)}
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
