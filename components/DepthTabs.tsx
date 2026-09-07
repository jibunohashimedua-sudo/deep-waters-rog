"use client";
import { useState, type ReactNode } from "react";

type View = "progress" | "highlights" | "notes";

const VIEWS: { id: View; label: string }[] = [
  { id: "progress", label: "Progress" },
  { id: "highlights", label: "Highlights" },
  { id: "notes", label: "Notes" }
];

/**
 * The three ways of looking at your own depth: how far you have come, what
 * you have marked, and what you have written.
 *
 * Progress is the default because it is what Depth has always been, and
 * because it is the answer to the question people actually arrive with.
 *
 * The panels are all rendered and the inactive ones hidden, rather than
 * mounted on demand. Switching then costs nothing — no refetch, no relayout
 * of a hundred rows, and a filter you set on Highlights is still set when
 * you come back to it from Notes.
 */
export default function DepthTabs({
  progress,
  highlights,
  notes
}: {
  progress: ReactNode;
  highlights: ReactNode;
  notes: ReactNode;
}) {
  const [view, setView] = useState<View>("progress");

  return (
    <>
      <div className="segmented" data-cols="3" role="tablist" aria-label="Depth">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            id={`depth-tab-${v.id}`}
            aria-selected={view === v.id}
            aria-controls={`depth-panel-${v.id}`}
            className="segmented-option"
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>

      {VIEWS.map((v) => (
        <div
          key={v.id}
          role="tabpanel"
          id={`depth-panel-${v.id}`}
          aria-labelledby={`depth-tab-${v.id}`}
          hidden={view !== v.id}
        >
          {v.id === "progress" ? progress : v.id === "highlights" ? highlights : notes}
        </div>
      ))}
    </>
  );
}
