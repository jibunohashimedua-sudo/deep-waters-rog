/**
 * Rhapsody of Realities — calendar helpers.
 *
 * The devotional follows the calendar month, not the 90-day plan, so
 * everything here is keyed on a plain date string (YYYY-MM-DD). Dates are
 * built and read part-by-part rather than through `new Date("2026-09-01")`,
 * which JavaScript parses as UTC midnight and can land on the day before.
 */

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/** A Date -> "YYYY-MM-DD" in the machine's own timezone. */
export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today as "YYYY-MM-DD". */
export function todayISO(): string {
  return isoDate(new Date());
}

/** "2026-09-14" -> [2026, 9, 14] */
function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.split("-").map(Number);
  return [y, m, d || 1];
}

/** Any date in a month -> the 1st of that month, "YYYY-MM-01". */
export function monthStart(iso: string): string {
  const [y, m] = parts(iso);
  return `${y}-${String(m).padStart(2, "0")}-01`;
}

/** "2026-09-01" -> "September 2026". */
export function monthLabel(monthISO: string): string {
  const [y, m] = parts(monthISO);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Step a month forward or back: ("2026-09-01", -1) -> "2026-08-01". */
export function addMonths(monthISO: string, delta: number): string {
  const [y, m] = parts(monthISO);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Every date in a month, in order, as "YYYY-MM-DD". */
export function datesInMonth(monthISO: string): string[] {
  const [y, m] = parts(monthISO);
  const count = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= count; d++) {
    out.push(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** Day-of-month for a date string: "2026-09-14" -> 14. */
export function dayOfMonth(iso: string): number {
  return parts(iso)[2];
}

/** Short weekday for a date string: "2026-09-14" -> "Mon". */
export function weekdayShort(iso: string): string {
  const [y, m, d] = parts(iso);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(y, m - 1, d).getDay()];
}

/** "14 September 2026" — used in headings on the reader. */
export function longDate(iso: string): string {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
