"use client";
import { useEffect } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The day you're on now (highlighted, and where "Back to today" goes). */
  currentDay: number;
  /** The day you're currently viewing (marked distinctly from today). */
  viewedDay: number;
  /** Set of day numbers already kept — coloured accent. */
  doneDays: Set<number>;
};

/**
 * Jump to any day in the plan.
 *
 * Same 10×9 grid Depth uses to visualise the ninety days, opened as a bottom
 * sheet from the day view header. Each cell tells you its own state at a
 * glance:
 *   - kept          — accent violet
 *   - today         — sonar mark
 *   - viewing       — hairline ring, so you can see where you are
 *   - missed (past, not kept)   — recessed plate
 *   - upcoming (future)          — page ground
 *
 * Tap opens /day/N and closes the sheet.
 */
export default function DayPicker({
  open,
  onClose,
  currentDay,
  viewedDay,
  doneDays
}: Props) {
  const router = useRouter();

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

  function go(n: number) {
    onClose();
    router.push(`/day/${n}`);
  }

  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pick a day"
        className={`bottom-glass absolute left-0 right-0 bottom-0 rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="pt-2 pb-2 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        <div className="px-5 pb-5">
          <p className="kicker">Ninety days</p>
          <h2 className="mt-2 text-[22px] md:text-[26px] font-semibold tracking-[-0.02em] text-rog-ink leading-tight">
            Pick a day
          </h2>
          <p className="mt-2 text-sm text-rog-muted">
            Tap any day to open it. Days you&rsquo;ve kept are marked.
          </p>

          <div className="mt-5 grid grid-cols-10 gap-px bg-rog-line">
            {Array.from({ length: 90 }, (_, i) => i + 1).map((d) => {
              const done = doneDays.has(d);
              const isToday = d === currentDay;
              const isViewing = d === viewedDay;
              const isPastNotKept = d < currentDay && !done;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => go(d)}
                  title={`Day ${d}`}
                  aria-label={`Day ${d}${done ? ", kept" : ""}${isToday ? ", today" : ""}`}
                  aria-current={isViewing ? "true" : undefined}
                  className="aspect-square flex items-center justify-center font-mono text-[9.5px] tabular-nums transition-colors"
                  style={{
                    background: done
                      ? "var(--accent)"
                      : isToday
                        ? "var(--sonar)"
                        : isPastNotKept
                          ? "var(--soft-bg)"
                          : "var(--bg)",
                    color:
                      done || isToday ? "var(--on-accent)" : "var(--ink-data)",
                    outline: isViewing
                      ? "var(--rule-section) solid var(--accent)"
                      : isToday
                        ? "var(--rule-hairline) solid var(--sonar)"
                        : undefined,
                    outlineOffset: isViewing
                      ? "calc(var(--rule-section) * -1)"
                      : isToday
                        ? "calc(var(--rule-hairline) * -1)"
                        : undefined
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="kicker">
              {doneDays.size} kept
            </p>
            {viewedDay !== currentDay && (
              <button
                type="button"
                onClick={() => go(currentDay)}
                className="btn-secondary !py-2 !px-5 text-[13.5px]"
              >
                Back to today
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
