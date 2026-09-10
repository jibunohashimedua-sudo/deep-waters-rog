import Avatar from "@/components/Avatar";
import Link from "next/link";
import Check from "@/components/Check";
import { createClient } from "@/lib/supabase/server";
import CohortShareBox from "@/components/CohortShareBox";
import CohortGone from "@/components/CohortGone";
import Mark from "@/components/Mark";
import BackControl from "@/components/BackControl";
import { redirect } from "next/navigation";

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

  // /c is a public path, so the middleware serves it without a session
  // lookup and its private-member gate never runs here. A cohort page is
  // one of the surfaces a private member does not have, so the gate is
  // repeated on this one route by hand. Signed-out visitors following a
  // share link are unaffected.
  if (user) {
    const { data: me } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if ((me as { is_private?: boolean } | null)?.is_private === true) {
      redirect("/today");
    }
  }

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

  // cohort_faces, not cohort_members joined to profiles: this page is a
  // public share link, and profiles is signed-in only now. The view
  // exposes a name and a picture for approved, visible members and
  // nothing else — see 2026_09_19_close_anonymous_reads.sql.
  let { data: members } = await supabase
    .from("cohort_faces")
    .select("user_id, name, photo_url")
    .eq("cohort_id", cohort.id)
    .limit(12);

  // The view arrives with the migration. Between a deploy and that
  // migration, fall back to the join it replaced — the old path still
  // works right up until profiles is closed, and the two changes land
  // together, so whichever order they land in the faces show.
  if (!members) {
    const { data: legacy } = await supabase
      .from("cohort_members")
      .select("user_id, profiles(name:display_name, photo_url)")
      .eq("cohort_id", cohort.id)
      .limit(12);
    members = (legacy ?? []).map((m: any) => ({
      user_id: m.user_id,
      name: m.profiles?.name,
      photo_url: m.profiles?.photo_url
    }));
  }

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
            {/* Was a Link to /today, which took a member who had come
                from People back to the front door instead of to People.
                Same treatment, the app's one back behaviour. */}
            <BackControl
              variant="on-dark"
              fallbackHref="/community?view=cohorts"
              label="Back"
            />
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
                <div key={m.user_id} title={m.name}>
                  <Avatar name={m.name ?? "?"} photoUrl={m.photo_url} size="md" className="border-2 border-white" decorative />
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
