"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * One-time banner explaining that the day count may have shifted by one.
 *
 * The timezone fix in `lib/plan.ts` moves `currentDayNumber` from an
 * epoch-ms comparison (which drifted by one day in west-of-UTC timezones
 * and by an hour across DST changes) to a calendar-day comparison. That
 * corrects a real bug — but for a reader who has already been on the
 * broken version, "today" may now read one number lower than yesterday.
 *
 * This banner tells them, offers a link to `/me/edit` so they can adjust
 * their start date if they'd rather stay on the old number, and remembers
 * they've seen it via localStorage. Auto-hides after two weeks so a
 * future deploy can delete the component without new users ever seeing it.
 */

const STORAGE_KEY = "dw_tz_notice_seen";

/** Shown until this date (inclusive). Deploy day + 14. */
const SHOW_UNTIL = "2026-09-22";

export default function TimezoneNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Past the show-until date, render nothing regardless — this component
    // will be deleted in a later pass, but until then it self-retires.
    const today = new Date().toISOString().slice(0, 10);
    if (today > SHOW_UNTIL) return;
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // localStorage disabled (private tab, cleared site data). Fall
      // through to showing the banner — one-time-per-visit is still fine.
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Nothing to do — the banner just re-appears on the next visit.
    }
    setVisible(false);
  }

  return (
    <div
      role="status"
      className="surface-soft mb-6 px-4 py-3 text-[13px] leading-5 text-rog-ink"
      style={{ borderLeft: "2px solid var(--accent)" }}
    >
      <p>
        We fixed a timezone bug. Your day count may have shifted by one.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Link
          href="/me/edit"
          className="kicker kicker-strong underline"
          style={{ color: "var(--accent)" }}
        >
          Adjust your start date
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="kicker text-rog-muted underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
