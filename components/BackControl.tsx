"use client";
import { useRouter } from "next/navigation";
import { canGoBackInApp, noteBack } from "@/lib/navHistory";

type Props = {
  /** Where the page above this one lives. Used only when there is no
      app history to pop — a shared link, a notification, a cold URL. */
  fallbackHref: string;
  /** Read out to a screen reader. The control's own text is short. */
  label?: string;
  /**
   * `chip` is the app bar's pill; `bare` is the reading header's plain
   * mono word. Two shapes because there are two kinds of chrome in this
   * app, not because there are two kinds of back.
   */
  variant?: "chip" | "bare" | "on-dark";
  className?: string;
};

/**
 * The one back control.
 *
 * It pops the history. That is the whole change, and it is the one the
 * app was missing: every back in here used to be a Link to a named
 * parent, which is a *forward* navigation to the page above. Press it
 * and the stack grows — /sermons, then the sermon, then /sermons again
 * — so the device's own back gesture then walked you into the sermon you
 * had just left. The two controls disagreed, and the device was right.
 *
 * The named parent survives as the fallback, which is what it was
 * always actually for. Somebody who opened a sermon from a notification,
 * or a verse from a shared link, has nothing of ours behind them; back
 * has to mean "up" for them, and `router.replace` is used rather than
 * push so their first press does not leave a dead entry behind either.
 *
 * lib/navHistory is what tells the two cases apart.
 */
export default function BackControl({
  fallbackHref,
  label = "Back",
  variant = "chip",
  className = ""
}: Props) {
  const router = useRouter();

  function go() {
    if (canGoBackInApp()) {
      noteBack();
      router.back();
      return;
    }
    router.replace(fallbackHref);
  }

  if (variant === "on-dark") {
    // The cohort invite page's hero is full-bleed purple; the glass chip
    // would be invisible on it. Same control, same behaviour, the
    // treatment that page already had.
    return (
      <button
        type="button"
        onClick={go}
        aria-label={label}
        className={`glass-dark inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-white font-medium hover:bg-white/25 transition ${className}`}
      >
        <span aria-hidden>&larr;</span>
        <span>Back</span>
      </button>
    );
  }

  if (variant === "bare") {
    return (
      <button
        type="button"
        onClick={go}
        aria-label={label}
        className={`reading-back ${className}`}
      >
        Back
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={go}
      aria-label={label}
      className={`glass-chip inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-rog-purple hover:opacity-70 transition ${className}`}
    >
      <span aria-hidden>&larr;</span>
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
