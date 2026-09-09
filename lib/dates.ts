/**
 * Calendar-date maths for the reading plan and the Rhapsody schedule.
 *
 * The old code did `new Date("2026-09-01")` (parsed as UTC midnight) and
 * `.setHours(0,0,0,0)` (local midnight), which drifted by ± 1 day across
 * timezones and by ± 1 hour across DST changes. Every function here works
 * on the calendar directly so neither can happen.
 *
 * Rule of thumb inside this file: never construct a `Date` from an ISO
 * date string. Split it. Anchor calendar dates at UTC noon when you need a
 * `Date` object at all, because that puts them 12 hours away from any DST
 * shift or timezone-offset boundary.
 */

export type YMD = { year: number; month: number; day: number };

/** "2026-09-14" -> {year:2026, month:9, day:14}. Throws on malformed input.
    Undefined behaviour on strings that aren't ISO 8601 dates. */
export function parseISODate(iso: string): YMD {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) throw new Error(`parseISODate: not an ISO date: ${JSON.stringify(iso)}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** Calendar-day difference between two YYYY-MM-DD strings.
    Positive when `todayISO` is after `startISO`. Zero when they are the
    same calendar day. Anchored at UTC noon on both sides so DST cannot
    shift the answer. */
export function daysBetweenLocal(startISO: string, todayISO: string): number {
  const s = parseISODate(startISO);
  const t = parseISODate(todayISO);
  const sMs = Date.UTC(s.year, s.month - 1, s.day, 12);
  const tMs = Date.UTC(t.year, t.month - 1, t.day, 12);
  return Math.round((tMs - sMs) / 86400000);
}

/** Today, as "YYYY-MM-DD", in the given IANA timezone.
    When `tz` is empty or omitted, falls back to UTC — the same day the
    server thinks it is, which is one day off for users in some timezones
    for the first render before the `dw_tz` cookie has been set. */
export function todayISOForUser(tz?: string | null): string {
  const now = new Date();
  if (!tz) return isoDateFromParts(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  try {
    // `en-CA` formats as YYYY-MM-DD, which is the shape we want and doesn't
    // depend on the runtime's default locale.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(now);
  } catch {
    // Bad tz string (typo, spoofed cookie) — fall back rather than throw.
    return isoDateFromParts(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
  }
}

function isoDateFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A date as a person would write it: "7 Sep 2026".
 *
 * Not toLocaleDateString("en-GB"), which gives 07/09/2026 — ambiguous to
 * anyone who reads the month first, and this is a church with people in
 * it who do. Spelling the month out costs three characters and removes
 * the question entirely.
 *
 * Returns an empty string for a missing or unparseable date rather than
 * "Invalid Date", because an admin list should have a gap in it, not a
 * error message where a date goes.
 */
export function humanDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  // The year goes when it is this year. Two dates and a separator do not
  // fit on one line of a 390px phone with "2026" on both of them, and a
  // truncated date is worse than an implied one. A date from another
  // year still says which.
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" })
  });
}
