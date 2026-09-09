import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type Profile = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  start_date: string;
  cohort_id: string | null;
  role: "member" | "admin";
  /** The Elite gate. Optional until the pastoral migration has been run —
      absent reads as false everywhere, so the layer simply doesn't appear. */
  is_pastoral?: boolean | null;
  approved: boolean;
  email_reminders: boolean;
  push_reminders: boolean;
  reminder_hour: number;
  /** Optional until the bible_cache/translations migration has been run —
      translationById() falls back to the KJV when it's absent. */
  preferred_bible_id?: string | null;
};

/** Get the current user + profile, or redirect to login/onboarding. */
export async function requireProfile(): Promise<{ userId: string; profile: Profile }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  // Distinguish "this account has no profile yet" from "the lookup failed".
  // Treating them the same sent established members back through onboarding
  // on any transient Supabase blip. A real fetch failure should surface, not
  // quietly rewrite where someone is in the app.
  if (error) {
    // eslint-disable-next-line no-console
    console.error("[deep-waters] profile lookup failed:", error.message);
    throw new Error("Could not load your profile. Refresh to try again.");
  }
  if (!profile) redirect("/onboarding");
  return { userId: user.id, profile: profile as Profile };
}

/** True when this profile carries the Elite gate. One reading of the flag,
    used by every server surface that consults it. */
export function isPastoral(profile: Pick<Profile, "is_pastoral">): boolean {
  return profile.is_pastoral === true;
}

/** Require the Elite gate, else redirect to /today — the same shape as
    requireAdmin, and the same silence: someone without the flag is never
    told there was a door here. */
export async function requirePastoral(): Promise<{ userId: string; profile: Profile }> {
  const r = await requireProfile();
  if (!isPastoral(r.profile)) redirect("/today");
  return r;
}

/**
 * The Elite gate for an API route: the profile when it carries the flag,
 * null when it does not.
 *
 * requirePastoral() redirects, which is right for a page and wrong for a
 * route handler — an XHR cannot follow a 307 to /today and read JSON out
 * of it. app/api/pulse/care had its own copy of this check, and the copy
 * had drifted: it discarded the profile lookup error, so a transient
 * Supabase blip read as "no profile" and the caller was told their own
 * care log did not exist.
 *
 * This keeps requireProfile's distinction, which is the whole reason that
 * function throws rather than redirecting: "this account has no profile"
 * and "the lookup failed" are different answers and must not be collapsed.
 *
 *   null   — not signed in, no profile row, or no flag. The caller turns
 *            all three into the same 404: no route handler should tell
 *            anyone which of the three it was.
 *   throws — the lookup itself failed. The caller surfaces a 500, the same
 *            way a page surfaces "Could not load your profile".
 */
export async function getPastoralUser(): Promise<{
  userId: string;
  profile: Profile;
} | null> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    // eslint-disable-next-line no-console
    console.error("[deep-waters] profile lookup failed:", error.message);
    throw new Error("Could not load your profile. Refresh to try again.");
  }
  if (!profile) return null;
  if (!isPastoral(profile as Profile)) return null;
  return { userId: user.id, profile: profile as Profile };
}

/** Require admin, else redirect to /today. */
export async function requireAdmin(): Promise<{ userId: string; profile: Profile }> {
  const r = await requireProfile();
  if (r.profile.role !== "admin") redirect("/today");
  return r;
}

/** Check if user is leader of a cohort (or admin). */
export async function isCohortLeader(userId: string, cohortId: string): Promise<boolean> {
  const supabase = createClient();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (profile?.role === "admin") return true;
  const { data: cohort } = await supabase.from("cohorts").select("created_by").eq("id", cohortId).single();
  if (cohort?.created_by === userId) return true;
  const { data: cm } = await supabase
    .from("cohort_members")
    .select("role")
    .eq("cohort_id", cohortId)
    .eq("user_id", userId)
    .maybeSingle();
  return cm?.role === "leader";
}
