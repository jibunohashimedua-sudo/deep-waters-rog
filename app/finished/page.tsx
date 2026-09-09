import Link from "next/link";
import Nav from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export const metadata = { title: "Finished · Deep Waters" };

/**
 * You reached the end.
 *
 * `/today` routes here when `hasFinishedPlan(profile.start_date)` is true —
 * the alternative was parking the reader on Day 90 forever, which is a
 * soft loop, not a finish.
 *
 * Two actions: back to the reflections that make up ninety days of
 * reading, or start over. "Start again" is a form POST to
 * /api/plan/restart which just moves `profiles.start_date` to today;
 * nothing is deleted, and anyone who wants a genuine wipe still has
 * `Reset my activity` on /depth.
 */
export default async function FinishedPage() {
  const { userId, profile } = await requireProfile();
  const supabase = createClient();

  const [{ count: kept }, { count: written }] = await Promise.all([
    supabase
      .from("completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_full", true),
    supabase
      .from("completions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("reflection", "is", null)
  ]);

  const daysKept = kept ?? 0;
  const reflectionsWritten = written ?? 0;

  return (
    <>
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="mt-3 font-serif text-[32px] md:text-[40px] leading-[1.12] tracking-[-0.01em] text-rog-ink">
          You reached the end of Deep Waters.
        </h1>
        <p className="mt-4 font-serif text-[17px] leading-[1.6] text-rog-muted max-w-[36ch]">
          Ninety days is a long walk. However many you kept, thank you for
          walking it, {profile.name.split(" ")[0]}.
        </p>

        {/* Mono metadata about what you actually did, in the same voice as
            the rest of the app — position and count, no ornament. */}
        <div className="mt-10 border-t border-rog-line pt-6">
          <p className="mt-3 font-mono text-[17px] tabular-nums text-rog-ink">
            {daysKept} of 90 kept
            {reflectionsWritten > 0 && (
              <>, and wrote {reflectionsWritten} reflection{reflectionsWritten === 1 ? "" : "s"}</>
            )}
          </p>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link href="/depth" className="btn-secondary flex-1 text-center">
            See your reflections
          </Link>
          {/* Plain form POST — no client JS, no fetch, redirect back to
              /today which will route to the new Day 1. */}
          <form action="/api/plan/restart" method="POST" className="flex-1">
            <button type="submit" className="btn-primary w-full">
              Start again
            </button>
          </form>
        </div>

        <p className="mt-10 text-xs text-rog-muted leading-relaxed max-w-prose">
          Starting again moves your start date to today. Every reflection,
          highlight and note you already have stays where it is; nothing is
          deleted. If you want a proper reset, that&rsquo;s still on your
          Depth page under Danger zone.
        </p>
      </main>
    </>
  );
}
