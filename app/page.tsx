import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Mark from "@/components/Mark";

export default async function LandingPage() {
  // Signed-in people never want the sales pitch. Without this, anyone who
  // opens the app from their home screen or a stale bookmark lands on the
  // "Join Deep Waters" page and reads it as having been logged out.
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (user) redirect("/today");

  return (
    <main className="main-plain min-h-screen">
      {/* The hero is the dark ground, in both themes — the same violet-black
          the splash rises out of. The blurred white orbs are gone: they were
          depth painted on rather than built, on the one page where the whole
          idea is depth. */}
      <section style={{ background: "#0C0A18", color: "#E9E6F2" }}>
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-20 text-center">
          <div className="mb-8 flex justify-center">
            <Mark size={104} className="text-[#E9E6F2] w-24 md:w-28 h-auto" />
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-[-0.03em]">
            DEEP WATERS
          </h1>
          <p className="mt-5 meta" style={{ color: "#8B87A3" }}>
            A 90 day Bible reading plan
          </p>
          <p className="mt-8 max-w-xl mx-auto text-[15px] leading-relaxed" style={{ color: "#B9B4C9" }}>
            Old Testament and New Testament, every single day.
            Read together. Finish together.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/welcome"
              className="btn px-8 py-4 text-[15px] font-medium"
              style={{ background: "#E9E6F2", color: "#0C0A18" }}
            >
              Join Deep Waters
            </Link>
            <Link
              href="/login"
              className="btn px-8 py-4 text-[15px]"
              style={{ border: "1px solid #302A47", color: "#E9E6F2" }}
            >
              I already have an account
            </Link>
          </div>
        </div>
      </section>

      {/* Verse card */}
      <section className="py-20 px-6">
        {/* Scripture doesn't need a box round it. A rule and a measure. */}
        <div className="max-w-2xl mx-auto quoted">
          <p className="font-serif text-xl md:text-[26px] leading-[1.6] text-rog-ink">
            With joy shall ye draw water out of the wells of salvation.
          </p>
          <p className="mt-4 meta">Isaiah 12:3</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          {/* No meta over the heading — the heading is the heading. */}
          <h2 className="text-[30px] md:text-[38px] font-semibold tracking-[-0.03em] text-rog-ink text-center leading-tight">
            Read. Reflect. Share. Finish.
          </h2>
          <div className="grid md:grid-cols-4 gap-4 mt-12">
            {[
              { n: "01", t: "Sign up", d: "Add your name and a photo. Pick your start date." },
              { n: "02", t: "Read daily", d: "OT + NT every day. Roughly 13 chapters." },
              { n: "03", t: "Share a verse", d: "One verse. One thought. Post to the community." },
              { n: "04", t: "Finish at day 90", d: "Get on the finisher wall. Get your card." }
            ].map((s) => (
              <div key={s.n} className="card">
                {/* The numbers stay: these four really are a sequence. */}
                <p className="meta">Step {s.n}</p>
                <h3 className="mt-3 text-[19px] font-semibold text-rog-ink leading-tight tracking-[-0.02em]">{s.t}</h3>
                <p className="mt-2 text-sm text-rog-muted leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer
        className="text-center py-8 meta"
        style={{ background: "#0C0A18", color: "#8B87A3" }}
      >
        Deep Waters
      </footer>
    </main>
  );
}
