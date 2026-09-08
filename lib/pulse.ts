/**
 * Church Pulse — the numbers behind the pastoral care screen, and the
 * words used to say them.
 *
 * Two rules live here rather than in the page, because both of them are
 * the sort of thing that rots the moment it is written twice:
 *
 *  1. The quiet threshold. One constant, passed to every query.
 *  2. The wording. "Check on", never "chase", "at risk", "lapsed" or
 *     "inactive". Quiet is not failure, and no reason is ever guessed —
 *     every sentence below is a count or a date read back plainly.
 */

/**
 * Days of silence before a person appears in the numbers as quiet.
 *
 * Silence means days since their last recorded activity of ANY kind — a
 * completed day, a chapter read, a reflection, a comment, an amen, a
 * prayer post. Not just plan completions: someone reading their Bible
 * daily outside the plan would otherwise be reported as silent.
 *
 * Passed into every RPC as p_quiet_days so the database and the page
 * cannot drift apart.
 */
export const QUIET_DAYS = 5;

/** A run this long or longer is worth naming in a reason. Below it,
    "was on a 2 day streak" is noise rather than context. */
export const STREAK_WORTH_NAMING = 3;

/** Above this share of a cohort reading in the last week, the bar is
    sonar. Below it, the bar is Shoal amber. Not a grade — a reading. */
export const COHORT_HEALTHY_RATIO = 0.5;

/** The curve needs at least this many days of plan history behind it
    before a line through the points means anything at all. */
export const CURVE_MIN_DAYS = 14;

/**
 * And a day only counts towards that history when a real share of the
 * church has actually reached it.
 *
 * Without this the curve is decided by whoever has the oldest start date.
 * One member on a start date of 2003 makes every one of the ninety days
 * "reached", and the page draws a line that falls to zero on day 3 and
 * stays there — a shape describing one person, labelled as the church.
 * A day is only on the curve when at least a tenth of the largest group
 * ever to reach a day has reached this one, and never fewer than three
 * people.
 */
export const CURVE_MIN_SHARE = 0.1;
export const CURVE_MIN_MEMBERS = 3;

/** How many names the check-on list asks for. */
export const CHECK_ON_LIMIT = 40;

/** How many waiting prayers the page asks for. */
export const PRAYERS_LIMIT = 20;

/** How many cohorts the page asks for. */
export const COHORTS_LIMIT = 60;

// ---------------------------------------------------------------------
// Row shapes, as the RPCs return them.
// ---------------------------------------------------------------------

export type PulseNumbers = {
  reading_today: number;
  on_track: number;
  quiet: number;
  new_testimonies: number;
};

/** Why this person is on the list. A code, not a sentence — the sentence
    is built by reasonFor() so there is one place it can be argued with. */
export type CheckOnKind = "never_started" | "quiet" | "prayer_unanswered";

export type CheckOnRow = {
  user_id: string;
  name: string;
  photo_url: string | null;
  kind: CheckOnKind;
  days_quiet: number;
  streak_before: number;
  cohort_name: string | null;
};

export type PulseCohortRow = {
  cohort_id: string;
  slug: string;
  name: string;
  leader_name: string | null;
  member_count: number;
  read_this_week: number;
  last_activity_at: string | null;
};

export type PulseCurvePoint = {
  day_number: number;
  eligible: number;
  completed: number;
};

export type PulsePerson = {
  user_id: string;
  name: string;
  photo_url: string | null;
  cohort_name: string | null;
  leader_name: string | null;
  last_read_at: string | null;
  last_activity_at: string | null;
  days_quiet: number;
  current_day: number;
  streak: number;
};

export type PulsePrayerRow = {
  id: string;
  user_id: string;
  name: string;
  photo_url: string | null;
  body: string;
  created_at: string;
  prayed_count: number;
  needs_pastor: boolean;
};

export type CareEntry = {
  id: string;
  subject_user_id: string;
  author_user_id: string;
  author_name: string;
  kind: "reached_out" | "note";
  body: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------

/** "1 day" / "9 days". Small enough to inline, common enough to share. */
export function days(n: number): string {
  return `${n} day${n === 1 ? "" : "s"}`;
}

/**
 * The one plain reason a name is on the list.
 *
 * Nothing here speculates. "Quiet 9 days" is a subtraction; it is not a
 * claim about why. Where a streak exists it is carried, because someone
 * who was consistent and stopped is a different conversation from
 * someone who never began.
 */
export function reasonFor(row: CheckOnRow): string {
  switch (row.kind) {
    case "never_started":
      return "Signed up, never started";
    case "prayer_unanswered":
      return "Posted a prayer, nobody responded";
    case "quiet":
      // "a 22 day streak", not "a 22 days streak" — attributive, so the
      // noun stays singular however long the run was.
      return row.streak_before >= STREAK_WORTH_NAMING
        ? `Quiet ${days(row.days_quiet)}, was on a ${row.streak_before} day streak`
        : `Quiet ${days(row.days_quiet)}`;
  }
}

/** A date the way this app writes dates everywhere else. */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short"
  });
}

/** Date and time, for the care log where the hour matters. */
export function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** How long ago, in whole days, said without a verdict attached. */
export function quietFor(daysQuiet: number): string {
  if (daysQuiet <= 0) return "Active today";
  return `Quiet ${days(daysQuiet)}`;
}

/**
 * The days of the curve that describe the church rather than one member.
 *
 * Shared by the drawing and by steepestFall, so the line and the mark on
 * it can never be reading different days.
 */
export function usableCurvePoints(points: PulseCurvePoint[]): PulseCurvePoint[] {
  const peak = points.reduce((m, p) => Math.max(m, p.eligible), 0);
  const floor = Math.max(CURVE_MIN_MEMBERS, Math.ceil(peak * CURVE_MIN_SHARE));
  return points.filter((p) => p.eligible >= floor);
}

/**
 * The steepest single-day fall in the curve, or null when there isn't
 * enough of a curve to have one. Returns the day the drop lands on.
 *
 * Only days that describe the church are compared, so a day one person
 * has reached can't invent a cliff.
 */
export function steepestFall(
  points: PulseCurvePoint[]
): { day: number; drop: number } | null {
  const usable = usableCurvePoints(points);
  if (usable.length < 2) return null;
  let best: { day: number; drop: number } | null = null;
  for (let i = 1; i < usable.length; i++) {
    const prev = usable[i - 1].completed / usable[i - 1].eligible;
    const here = usable[i].completed / usable[i].eligible;
    const drop = prev - here;
    if (drop > 0 && (!best || drop > best.drop)) {
      best = { day: usable[i].day_number, drop };
    }
  }
  return best;
}
