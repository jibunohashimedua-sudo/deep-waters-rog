"use client";
import { Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import CommunityFeed from "@/components/CommunityFeed";
import PrayerWall from "@/components/PrayerWall";

type View = "reflections" | "prayer";

const VIEWS: { key: View; label: string }[] = [
  { key: "reflections", label: "Reflections" },
  { key: "prayer", label: "Prayer" }
];

/**
 * Community holds both "together" features. Reflections is the front door;
 * Prayer moved in here when the Bible tab took the fifth slot in the bar.
 *
 * The view lives in ?view= rather than in state alone so a link to the
 * prayer wall still lands on the prayer wall — /prayer redirects here.
 */
function CommunityView() {
  const router = useRouter();
  const params = useSearchParams();
  const view: View = params.get("view") === "prayer" ? "prayer" : "reflections";

  const pick = useCallback(
    (next: View) => {
      // replace, not push: flipping the segment shouldn't build up history
      // the back button then has to chew through.
      router.replace(next === "prayer" ? "/community?view=prayer" : "/community", {
        scroll: false
      });
    },
    [router]
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
        {view === "prayer" ? "Prayer" : "Community"}
      </h1>
      <p className="mt-2 text-sm text-rog-muted">
        {view === "prayer"
          ? "Bear one another’s burdens."
          : "What today’s reading stirred in us."}
      </p>

      <div
        role="tablist"
        aria-label="Community views"
        className="mt-6 flex gap-2"
      >
        {VIEWS.map((v) => {
          const active = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => pick(v.key)}
              className="chip !min-h-[44px] px-5"
              data-on={active ? "true" : undefined}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Only the chosen view mounts, so the other one isn't running a
          realtime subscription and a feed query in the background. */}
      {view === "prayer" ? <PrayerWall /> : <CommunityFeed />}
    </main>
  );
}

export default function CommunityPage() {
  return (
    <>
      <Nav />
      <Suspense
        fallback={
          <main className="max-w-3xl mx-auto px-6 py-10">
            <p className="kicker">Deep Waters</p>
            <div className="skeleton mt-3 h-9 w-48" />
            <div className="skeleton mt-6 h-[52px] w-full max-w-md !rounded-full" />
            <div className="skeleton mt-6 h-40 w-full" />
          </main>
        }
      >
        <CommunityView />
      </Suspense>
    </>
  );
}
