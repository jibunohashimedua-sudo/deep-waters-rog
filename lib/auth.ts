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
  approved: boolean;
  email_reminders: boolean;
  push_reminders: boolean;
  reminder_hour: number;
};

/** Get the current user + profile, or redirect to login/onboarding. */
export async function requireProfile(): Promise<{ userId: string; profile: Profile }> {
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) redirect("/onboarding");
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
