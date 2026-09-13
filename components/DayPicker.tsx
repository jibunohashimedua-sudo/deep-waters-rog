"use client";
import { useEffect } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useRouter } from "next/navigation";
import Sheet from "@/components/Sheet";

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
    <Sheet open={open} onClose={onClose} label="Pick a day">
        <div className="px-5 pb-5">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Ninety days</h2>
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
                  className="tap-target aspect-square flex items-center justify-center font-mono text-[9.5px] tabular-nums transition-colors"
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
            <p className="meta">
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
    </Sheet>
  );
}
