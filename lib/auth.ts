import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PROFILE_HEADER, forwardedProfile } from "@/lib/requestProfile";
export { PRIVATE_MEMBER_BLOCKED_PREFIXES, isBlockedForPrivateMember } from "@/lib/privacy";

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
  /** A private member is invisible to everyone but himself and the account
      named in private_owner_id. Optional until the private-members
      migration has been run — absent reads as false, which is every
      ordinary member. */
  is_private?: boolean | null;
  private_owner_id?: string | null;
  approved: boolean;
  email_reminders: boolean;
  push_reminders: boolean;
  reminder_hour: number;
  /** Optional until the bible_cache/translations migration has been run —
      translationById() falls back to the KJV when it's absent. */
  preferred_bible_id?: string | null;
};

/** Get the current user + profile, or redirect to login/onboarding.
 *
 *  Middleware has already done both halves of this on every protected
 *  request — it calls getUser() to refresh the session and reads the
 *  profile to decide onboarding and privacy — and it forwards what it read.
 *  Taking it from there rather than asking again saves two Supabase round
 *  trips on every server-rendered page. On p50 that is 124 ms; at p95 it is
 *  over 700 ms.
 *
 *  The fallback is the original code, unchanged, for anything middleware
 *  did not run on. */
export async function requireProfile(): Promise<{ userId: string; profile: Profile }> {
  const forwarded = forwardedProfile(headers().get(PROFILE_HEADER));
  if (forwarded.kind === "profile") {
    return { userId: forwarded.profile.id, profile: forwarded.profile };
  }
  if (forwarded.kind === "none") redirect("/onboarding");

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
  const forwarded = forwardedProfile(headers().get(PROFILE_HEADER));
  if (forwarded.kind === "profile") {
    if (!isPastoral(forwarded.profile)) return null;
    return { userId: forwarded.profile.id, profile: forwarded.profile };
  }
  if (forwarded.kind === "none") return null;

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

/** True when this profile is a private member. One reading of the flag,
    used by every server surface that consults it. */
export function isPrivateMember(profile: Pick<Profile, "is_private">): boolean {
  return profile.is_private === true;
}

/**
 * Does this account own a private member?
 *
 * Gated on ownership, never on the admin flag. The other admin on this
 * project has the same role, the same is_admin(), the same everything —
 * and must not see that this section exists. my_private_members() answers
 * for the caller only; an empty array is the whole answer.
 */
export async function privateMembersFor(): Promise<
  { user_id: string; name: string; photo_url: string | null; start_date: string; created_at: string; is_pastoral: boolean }[]
> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("my_private_members");
  if (error) {
    // A missing function means the migration has not been run yet. That is
    // "you own nobody", which is the right answer for every account but one.
    if (!/function|does not exist|schema cache/i.test(error.message)) {
      // eslint-disable-next-line no-console
      console.error("[deep-waters] private members:", error.message);
    }
    return [];
  }
  return (data ?? []) as any;
}

/** Require that this account owns at least one private member, else 404.
    Not a redirect to /today and not a "you do not have access" — an admin
    who tries the route directly is told the route does not exist. */
export async function requirePrivateOwner(): Promise<{
  userId: string;
  profile: Profile;
  members: Awaited<ReturnType<typeof privateMembersFor>>;
}> {
  const r = await requireProfile();
  const members = await privateMembersFor();
  if (members.length === 0) notFound();
  return { ...r, members };
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
