import Avatar from "@/components/Avatar";
import Link from "next/link";
import Check from "@/components/Check";
import { createClient } from "@/lib/supabase/server";
import CohortShareBox from "@/components/CohortShareBox";
import BackButton from "@/components/BackButton";
import CohortGone from "@/components/CohortGone";
import Mark from "@/components/Mark";

export default async function CohortLandingPage({
  params
}: {
  params: { slug: string };
}) {
  const supabase = createClient();
  const { data: cohort } = await supabase
    .from("cohort_summary")
    .select("*")
    .eq("slug", params.slug)
    .maybeSingle();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Notifications and shared links outlive the cohort they point at, so
  // land the reader on a friendly page instead of a raw 404.
  if (!cohort) {
    return <CohortGone signedIn={!!user} />;
  }

  let membership: { role: string } | null = null;
  let isLeader = false;
  if (user) {
    const { data: cm } = await supabase
      .from("cohort_members")
      .select("role")
      .eq("cohort_id", cohort.id)
      .eq("user_id", user.id)
      .maybeSingle();
    membership = cm;
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    isLeader = cm?.role === "leader" || cohort.created_by === user.id || prof?.role === "admin";
  }

  const { data: announcements } = await supabase
    .from("announcements")
    .select("id, title, body, created_at")
    .eq("cohort_id", cohort.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: members } = await supabase
    .from("cohort_members")
    .select("user_id, profiles(name, photo_url)")
    .eq("cohort_id", cohort.id)
    .limit(12);

  const startDate = new Date(cohort.start_date);
  const today = new Date();
  const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / 86400000);
  const status =
    daysUntil > 0
      ? `Starts in ${daysUntil} day${daysUntil === 1 ? "" : "s"}`
      : daysUntil === 0
      ? "Starts today"
      : `Day ${Math.min(90, Math.abs(daysUntil) + 1)} of 90`;

  const fmtDate = startDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  return (
    <main className="min-h-screen">
      <section className="bg-rog-purple text-white relative">
        {user && (
          <div className="absolute top-4 left-4 z-10">
            <Link href="/today" className="glass-dark inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm text-white font-medium hover:bg-white/25 transition">
              <span aria-hidden>&larr;</span>
              <span>Back to app</span>
            </Link>
          </div>
        )}
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="mb-4 flex justify-center">
            <Mark size={56} className="text-[#F3EDE4]" />
          </div>
          <h1 className="mt-3 text-5xl md:text-6xl font-bold tracking-tight">{cohort.name}</h1>
          {cohort.description && (
            <p className="mt-4 text-white/85 max-w-xl mx-auto">{cohort.description}</p>
          )}
          <p className="mt-4 text-white/70 text-sm">
            {cohort.member_count} member{cohort.member_count === 1 ? "" : "s"}
          </p>
          {isLeader && (
            <Link href={`/cohorts/${cohort.slug}/manage`} className="mt-6 inline-block text-sm underline text-white/80 hover:text-white">
              Manage cohort
            </Link>
          )}
        </div>
        <div className="h-px bg-white/20" />
      </section>

      <section className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        {/* Join / status card */}
        {membership ? (
          <div className="card text-center">
            <p className="text-rog-purple font-semibold">You&rsquo;re in this cohort.</p>
            {cohort.welcome_message && (
              <div className="mt-4 p-4 bg-rog-cream text-left">
                <p className="selectable mt-1 text-sm whitespace-pre-wrap">{cohort.welcome_message}</p>
              </div>
            )}
            <Link href="/today" className="btn-primary mt-4 inline-block">Go to today</Link>
          </div>
        ) : user ? (
          <div className="card text-center">
            <p className="text-rog-purple font-semibold text-lg">Join {cohort.name}?</p>
            <p className="mt-2 text-sm text-rog-muted">
              This cohort starts {fmtDate}. Joining adds you to the group. You can optionally align your start date.
            </p>
            <form action="/api/cohort/join" method="POST" className="mt-6 space-y-3">
              <input type="hidden" name="cohort_id" value={cohort.id} />
              <Check
                name="align_start"
                value="1"
                defaultChecked
                label={`Set my start date to ${fmtDate}`}
              />
              <button className="btn-primary w-full">Join this cohort</button>
            </form>
          </div>
        ) : (
          <div className="card text-center">
            <p className="text-rog-purple font-semibold text-lg">Sign up to join {cohort.name}</p>
            <p className="mt-2 text-sm text-rog-muted">Your start date will be {fmtDate}.</p>
            <Link href={`/signup?cohort=${cohort.slug}`} className="btn-primary mt-6 inline-block w-full">
              Sign up & join
            </Link>
            <p className="mt-3 text-sm">
              <Link href={`/login?cohort=${cohort.slug}`} className="text-rog-purple font-medium">
                Already have an account? Sign in
              </Link>
            </p>
          </div>
        )}

        {/* Announcements */}
        {membership && announcements && announcements.length > 0 && (
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Announcements</h2>
            <div className="mt-3 space-y-2">
              {announcements.map((a) => (
                <div key={a.id} className="card">
                  {a.title && <p className="font-bold text-rog-purple">{a.title}</p>}
                  <p className="selectable mt-1 text-sm whitespace-pre-wrap">{a.body}</p>
                  <p className="mt-2 text-xs text-rog-muted">
                    {new Date(a.created_at).toLocaleDateString("en-GB")}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members preview */}
        {members && members.length > 0 && (
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Who&rsquo;s here</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {members.map((m: any) => (
                <div key={m.user_id} title={m.profiles?.name}>
                  <Avatar name={m.profiles?.name ?? "?"} photoUrl={m.profiles?.photo_url} size="md" className="border-2 border-white" decorative />
                </div>
              ))}
              {cohort.member_count > 12 && (
                <div className="w-10 h-10 rounded-full bg-rog-line flex items-center justify-center text-xs text-rog-muted">
                  +{cohort.member_count - 12}
                </div>
              )}
            </div>
          </div>
        )}

        {membership && <CohortShareBox slug={cohort.slug} />}
      </section>
    </main>
  );
}
