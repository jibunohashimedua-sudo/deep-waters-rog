"use client";
import Link from "next/link";
import { useState } from "react";
import DayPicker from "./DayPicker";

type Props = {
  /** The day being viewed. */
  day: number;
  /** The reader's own current day. Used for "back to today". */
  currentDay: number;
  /** Set of kept days, for the picker's colouring. */
  doneDays: Set<number>;
};

/**
 * The header on the day view: step back a day, step forward a day, or open
 * the picker to jump. On any day that isn't your current day, a quiet
 * "back to today" pill sits alongside so you never feel lost.
 *
 * Prev and next hide at the extremes rather than going grey — a chevron
 * that points at nothing invites a tap that goes nowhere.
 */
export default function DayHeader({ day, currentDay, doneDays }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const prev = day > 1 ? day - 1 : null;
  const next = day < 90 ? day + 1 : null;
  const offDay = day !== currentDay;

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 shrink-0">
          {prev !== null ? (
            <Link
              href={`/day/${prev}`}
              className="tap-target inline-flex items-center justify-center w-11 h-11 text-rog-ink hover:opacity-70 transition"
              aria-label={`Go to day ${prev}`}
            >
              <span className="text-[15px] leading-none" aria-hidden>
                &larr;
              </span>
            </Link>
          ) : (
            <span className="w-11 h-11" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="tap-target inline-flex items-center gap-1 px-3 h-10 font-mono text-[11px] uppercase tracking-[0.13em] text-rog-ink hover:opacity-70 transition"
            aria-haspopup="dialog"
            aria-label={`Day ${day}. Pick another day.`}
          >
            Day {day}
            <span className="text-[9px] leading-none" aria-hidden>
              &#9662;
            </span>
          </button>
          {next !== null ? (
            <Link
              href={`/day/${next}`}
              className="tap-target inline-flex items-center justify-center w-11 h-11 text-rog-ink hover:opacity-70 transition"
              aria-label={`Go to day ${next}`}
            >
              <span className="text-[15px] leading-none" aria-hidden>
                &rarr;
              </span>
            </Link>
          ) : (
            <span className="w-11 h-11" aria-hidden />
          )}
        </div>

        {offDay && (
          <Link
            href={`/day/${currentDay}`}
            className="btn-secondary !py-2 !px-4 text-[12.5px] shrink-0"
          >
            Back to today
          </Link>
        )}
      </div>

      <DayPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        currentDay={currentDay}
        viewedDay={day}
        doneDays={doneDays}
      />
    </>
  );
}
