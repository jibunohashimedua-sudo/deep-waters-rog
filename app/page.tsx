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
    <main className="min-h-screen">
      {/* Purple hero block */}
      <section className="bg-rog-purple text-white relative overflow-hidden">
        {/* subtle blurred glass orbs for depth */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-20 text-center">
          <div className="mb-8 flex justify-center">
            <Mark size={104} className="text-[#F3EDE4] w-24 md:w-28 h-auto" />
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight">
            DEEP WATERS
          </h1>
          <p className="mt-4 text-base md:text-lg font-light tracking-[0.3em] uppercase text-white/80">
            A 90 day Bible reading plan
          </p>
          <p className="mt-8 text-white/85 max-w-xl mx-auto">
            Old Testament and New Testament, every single day.
            Read together. Finish together.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/welcome" className="btn bg-white text-rog-purple px-8 py-4 text-lg font-semibold hover:bg-rog-cream shadow-xl shadow-black/10">
              Join Deep Waters
            </Link>
            <Link href="/login" className="glass-dark btn text-white px-8 py-4 text-lg">
              I already have an account
            </Link>
          </div>
        </div>
        <div className="h-px bg-white/20 relative" />
      </section>

      {/* Verse card */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto card text-center">
          <p className="font-serif italic text-xl md:text-2xl leading-relaxed text-rog-ink">
            &ldquo;With joy shall ye draw water out of the wells of salvation.&rdquo;
          </p>
          <p className="mt-4 kicker">Isaiah 12:3</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="kicker text-center">How it works</p>
          <h2 className="mt-4 font-serif text-3xl md:text-4xl font-medium text-rog-ink text-center leading-tight">
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
                <p className="text-rog-muted text-xs font-medium tracking-[0.2em] uppercase">{s.n}</p>
                <h3 className="mt-3 font-serif text-xl font-medium text-rog-ink leading-tight">{s.t}</h3>
                <p className="mt-2 text-sm text-rog-muted leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-rog-purple text-white text-center py-8 text-sm tracking-[0.2em] uppercase">
        Deep Waters
      </footer>
    </main>
  );
}
