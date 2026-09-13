"use client";
import { forwardRef, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name, and — for the sheets that show it —
      the same string that appears as a heading inside. */
  label: string;
  children: ReactNode;
  /** Extra classes on the sheet panel itself. MoreSheet uses this for its
      wide-screen centering (`md:mx-auto md:max-w-md`). */
  className?: string;
  /** MoreSheet stacks below the app's other overlays at z-50; every other
      sheet sits above the reading chrome at z-[70]. */
  zIndexClass?: string;
  /** Extra clearance above the safe-area inset, in px. Most sheets want
      16; a plain option list (SelectSheet) is shorter and wants 12. */
  bottomPad?: number;
  /** Tags the outer wrapper `data-verse-sheet`, so ScriptureReader's "tap
      outside clears the selection" rule counts a tap in here as inside
      rather than outside. */
  dataVerseSheet?: boolean;
};

/**
 * The one bottom sheet shape in the app: dim flat backdrop, square panel,
 * a hand-drawn grabber pill, slides up on a shared timing curve.
 *
 * Six sheets — the reference picker, the translation switcher, the day
 * picker, the More sheet, the translation comparison, and the verse note
 * editor — used to each hand-copy this same ~15 lines of backdrop-plus-
 * panel-plus-grabber JSX. This is that shape, named once. Each caller
 * keeps its own header, its own body, its own footer buttons — only the
 * shell is shared.
 */
const Sheet = forwardRef<HTMLDivElement, Props>(function Sheet(
  {
    open,
    onClose,
    label,
    children,
    className = "",
    zIndexClass = "z-[70]",
    bottomPad = 16,
    dataVerseSheet = false
  },
  ref
) {
  return (
    <div
      {...(dataVerseSheet ? { "data-verse-sheet": true } : {})}
      className={`fixed inset-0 ${zIndexClass} ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={`sheet ${className} ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: `calc(env(safe-area-inset-bottom) + ${bottomPad}px)` }}
      >
        <div className="pt-2 pb-2 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        {children}
      </div>
    </div>
  );
});

export default Sheet;
