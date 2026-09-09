import { createClient } from "@/lib/supabase/server";

/**
 * The people behind a number on the admin dashboard.
 *
 * A figure with people behind it should always be openable. "14
 * completions today" is a fact about the church; "who are the other
 * thirteen" is the question a pastor actually has, and it is the one the
 * dashboard could not answer.
 *
 * Every figure defined here comes in two halves — who did, and who
 * didn't. The second is usually the more useful one: nobody needs
 * following up for having read.
 *
 * ---------------------------------------------------------------------
 * A note on how this reads the database, because it matters.
 *
 * It uses the *signed-in admin's* connection, never the service key.
 * That is not an oversight and must not be "optimised" later. The
 * private-members work put a RESTRICTIVE row-level policy on `profiles`
 * and `completions` which is AND-ed with every other rule, so even an
 * "admins can read everything" policy cannot see past it. A private
 * member is therefore absent from these lists, from the counts, and from
 * the exports, without this file doing anything at all. The service key
 * bypasses row-level security entirely and would silently undo that.
 *
 * The admin check is made three times over, deliberately:
 *   1. requireAdmin() on the page, which redirects.
 *   2. assertAdmin() below, in the query path, which throws.
 *   3. The row-level policies on the tables themselves.
 * Hiding a button is not one of the three.
 */

export type FigureKey = "completions-today" | "completions-week";

export type FigurePerson = {
  id: string;
  /** The account name. Always shown to an admin. */
  name: string;
  /** What members see them by, if they set one. Never instead. */
  nickname: string | null;
  photoUrl: string | null;
  cohortId: string | null;
  cohortName: string | null;
  /** When they completed, for the "did" list. Null on the "didn't". */
  at: string | null;
  /** Which plan day, for the "did" list. */
  day: number | null;
};

export type FigureResult = {
  key: FigureKey;
  title: string;
  /** What the number on the dashboard was counting. */
  blurb: string;
  didLabel: string;
  didntLabel: string;
  did: FigurePerson[];
  didnt: FigurePerson[];
  cohorts: { id: string; name: string }[];
};

const FIGURES: Record<
  FigureKey,
  { title: string; blurb: string; didLabel: string; didntLabel: string; hours: number }
> = {
  "completions-today": {
    title: "Completed today",
    blurb: "Members who finished a day of the plan in the last 24 hours.",
    didLabel: "Completed",
    didntLabel: "Not yet",
    hours: 24
  },
  "completions-week": {
    title: "Completed this week",
    blurb: "Members who finished a day of the plan in the last 7 days.",
    didLabel: "Completed",
    didntLabel: "Not yet",
    hours: 24 * 7
  }
};

export function isFigureKey(v: string): v is FigureKey {
  return v in FIGURES;
}

export function figureTitle(key: FigureKey): string {
  return FIGURES[key].title;
}

/** Throws unless the caller is an admin. The page has already redirected
    a non-admin, so reaching this is either a bug or somebody trying it
    on; either way it stops here rather than returning rows. */
async function assertAdmin(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not-admin");
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (data?.role !== "admin") throw new Error("not-admin");
}

export async function loadFigure(key: FigureKey): Promise<FigureResult> {
  await assertAdmin();

  const spec = FIGURES[key];
  const since = new Date(Date.now() - spec.hours * 3600_000).toISOString();
  const supabase = createClient();

  const [{ data: people }, { data: done }, { data: cohortRows }] = await Promise.all([
    // Approved members only: somebody still waiting to be let in has not
    // failed to read, they have not started.
    supabase
      .from("profiles")
      .select("id, name, nickname, photo_url, cohort_id")
      .eq("approved", true)
      .order("name"),
    supabase
      .from("completions")
      .select("user_id, day_number, completed_at")
      .eq("is_full", true)
      .gte("completed_at", since),
    supabase.from("cohorts").select("id, name")
  ]);

  const cohorts = (cohortRows ?? []).map((c: any) => ({ id: c.id, name: c.name }));
  const cohortName = new Map(cohorts.map((c) => [c.id, c.name]));

  // Latest completion per person in the window.
  const latest = new Map<string, { at: string; day: number }>();
  for (const row of (done ?? []) as any[]) {
    const prev = latest.get(row.user_id);
    if (!prev || row.completed_at > prev.at) {
      latest.set(row.user_id, { at: row.completed_at, day: row.day_number });
    }
  }

  const did: FigurePerson[] = [];
  const didnt: FigurePerson[] = [];
  for (const p of (people ?? []) as any[]) {
    const hit = latest.get(p.id);
    const person: FigurePerson = {
      id: p.id,
      name: p.name,
      nickname: p.nickname ?? null,
      photoUrl: p.photo_url ?? null,
      cohortId: p.cohort_id ?? null,
      cohortName: p.cohort_id ? cohortName.get(p.cohort_id) ?? null : null,
      at: hit?.at ?? null,
      day: hit?.day ?? null
    };
    (hit ? did : didnt).push(person);
  }

  return {
    key,
    title: spec.title,
    blurb: spec.blurb,
    didLabel: spec.didLabel,
    didntLabel: spec.didntLabel,
    did,
    didnt,
    cohorts
  };
}

/**
 * How many *people*, not how many rows.
 *
 * The dashboard used to count rows in `completions`, which is not the
 * same number: somebody catching up on two days in one evening counted
 * twice. That made the figure disagree with the list of names behind it,
 * and of the two the list is the one that is true.
 */
export async function countPeople(key: FigureKey): Promise<number> {
  const spec = FIGURES[key];
  const since = new Date(Date.now() - spec.hours * 3600_000).toISOString();
  const supabase = createClient();
  const { data } = await supabase
    .from("completions")
    .select("user_id")
    .eq("is_full", true)
    .gte("completed_at", since);
  return new Set((data ?? []).map((r: any) => r.user_id)).size;
}
