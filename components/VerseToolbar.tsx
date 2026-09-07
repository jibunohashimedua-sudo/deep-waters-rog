"use client";
import { useEffect, useRef, useState } from "react";
import {
  HIGHLIGHT_COLOURS,
  HIGHLIGHT_SWATCH,
  type HighlightColour
} from "@/lib/highlights";

export type ToolbarPos = {
  /** Anchor rect from Range.getBoundingClientRect() (viewport coords). */
  top: number;
  left: number;
  bottom: number;
  right: number;
};

type Props = {
  pos: ToolbarPos | null;
  /** Highlight already covering the selection, if any — offers "remove". */
  currentColour: HighlightColour | null;
  /** True when the selection contains a verse that already has a note. */
  hasNote: boolean;
  onHighlight: (colour: HighlightColour) => void;
  onRemoveHighlight: () => void;
  onNote: () => void;
  onShare: () => void;
  onShareImage: () => void;
};

const TOOLBAR_WIDTH = 288;
const TOOLBAR_HEIGHT = 46;
const GUTTER = 12;
const ARROW = 6;

/**
 * Small floating glass pill anchored to the current selection. It flips
 * below the selection when there isn't room above, and clamps to the
 * viewport edges so it never scrolls off screen.
 */
export default function VerseToolbar({
  pos,
  currentColour,
  hasNote,
  onHighlight,
  onRemoveHighlight,
  onNote,
  onShare,
  onShareImage
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fade + rise on appear; collapse the swatch row whenever the anchor moves.
  useEffect(() => {
    if (!pos) {
      setMounted(false);
      setExpanded(false);
      return;
    }
    // Next frame so the transition catches the mount.
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [pos]);

  if (!pos) return null;

  // Prefer above the selection, but flip below when there isn't room.
  const wantsAbove = pos.top > TOOLBAR_HEIGHT + GUTTER + 40;
  const top = wantsAbove
    ? Math.max(GUTTER, pos.top - TOOLBAR_HEIGHT - ARROW - 6)
    : Math.min(
        window.innerHeight - TOOLBAR_HEIGHT - GUTTER,
        pos.bottom + ARROW + 6
      );

  // Horizontal: centre on selection, then clamp.
  const centre = (pos.left + pos.right) / 2;
  let left = centre - TOOLBAR_WIDTH / 2;
  if (left < GUTTER) left = GUTTER;
  if (left + TOOLBAR_WIDTH > window.innerWidth - GUTTER) {
    left = window.innerWidth - GUTTER - TOOLBAR_WIDTH;
  }

  const containerStyle: React.CSSProperties = {
    position: "fixed",
    top,
    left,
    width: TOOLBAR_WIDTH,
    zIndex: 60,
    opacity: mounted ? 1 : 0,
    transform: `translateY(${mounted ? 0 : wantsAbove ? 4 : -4}px)`,
    transition: "opacity 150ms ease, transform 150ms ease",
    pointerEvents: mounted ? "auto" : "none"
  };

  return (
    <div ref={ref} style={containerStyle} role="dialog" aria-label="Verse actions">
      <div
        style={{
          // Opaque, hairline, flat. A toolbar that floats over scripture
          // has to be readable more than it has to look like glass — the
          // blur was compositing the words underneath it on every frame.
          background: "var(--card-bg)",
          border: "1px solid var(--line)",
          borderRadius: 999,
          padding: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2
        }}
      >
        {!expanded ? (
          <>
            <ToolbarButton
              label={currentColour ? "Change" : "Highlight"}
              onClick={() => setExpanded(true)}
              icon={
                <span
                  aria-hidden
                  style={{
                    display: "inline-block",
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: currentColour
                      ? HIGHLIGHT_SWATCH[currentColour]
                      : "conic-gradient(#D6A84A, #067A5A, #487EC8, #C66080, #3B23B8, #D6A84A)"
                  }}
                />
              }
            />
            <ToolbarButton
              label="Note"
              onClick={onNote}
              active={hasNote}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M8 6h11M8 12h11M8 18h7" />
                  <circle cx="4" cy="6" r="1" fill="currentColor" />
                  <circle cx="4" cy="12" r="1" fill="currentColor" />
                  <circle cx="4" cy="18" r="1" fill="currentColor" />
                </svg>
              }
            />
            <ToolbarButton
              label="Share"
              onClick={onShare}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3v13" />
                  <path d="M7 8l5-5 5 5" />
                  <path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                </svg>
              }
            />
            <ToolbarButton
              label="Image"
              onClick={onShareImage}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="1.5" />
                  <path d="M4 18l6-6 5 5 5-5" />
                </svg>
              }
            />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="Back"
              style={pillButton(false)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
            {HIGHLIGHT_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onHighlight(c)}
                aria-label={`Highlight ${c}`}
                aria-pressed={currentColour === c}
                style={{
                  ...pillButton(false),
                  padding: 0,
                  width: 32,
                  height: 32
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    background: HIGHLIGHT_SWATCH[c],
                    boxShadow:
                      currentColour === c
                        ? "0 0 0 2px var(--accent)"
                        : "inset 0 0 0 1px rgba(0,0,0,0.08)"
                  }}
                />
              </button>
            ))}
            {currentColour && (
              <button
                type="button"
                onClick={onRemoveHighlight}
                aria-label="Remove highlight"
                style={pillButton(false)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 6l12 12M18 6l-12 12" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function pillButton(active: boolean): React.CSSProperties {
  return {
    all: "unset",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 38,
    minWidth: 44, // ≥44px tap target
    padding: "0 10px",
    borderRadius: 999,
    color: "var(--text)",
    background: active ? "var(--accent-soft)" : "transparent",
    transition: "background 0.15s ease"
  };
}

function ToolbarButton({
  label,
  icon,
  onClick,
  active
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        ...pillButton(!!active),
        gap: 6,
        fontFamily: '"Poppins", system-ui, sans-serif',
        fontSize: 12,
        fontWeight: 500,
        color: active ? "var(--accent)" : "var(--text)"
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
