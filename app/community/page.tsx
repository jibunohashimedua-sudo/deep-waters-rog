"use client";
import { Suspense, useCallback } from "react";
import LoadingRule from "@/components/LoadingRule";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import CommunityFeed from "@/components/CommunityFeed";
import PrayerWall from "@/components/PrayerWall";
import LeaderboardView from "@/components/LeaderboardView";
import FinishersView from "@/components/FinishersView";
import CohortsView from "@/components/CohortsView";

type View = "feed" | "prayer" | "leaderboard" | "finishers" | "cohorts";

const VIEWS: { key: View; label: string; title: string; blurb: string }[] = [
  {
    key: "feed",
    label: "Feed",
    title: "People",
    blurb: "What today’s reading stirred in us."
  },
  {
    key: "prayer",
    label: "Prayer",
    title: "Prayer",
    blurb: "Bear one another’s burdens."
  },
  {
    key: "leaderboard",
    label: "Leaderboard",
    title: "Leaderboard",
    blurb: ""
  },
  {
    key: "finishers",
    label: "Finishers",
    title: "Finishers",
    blurb: ""
  },
  {
    key: "cohorts",
    label: "Cohorts",
    title: "Cohorts",
    blurb: ""
  }
];

/**
 * People — the "together" side of the app. One page, five views.
 *
 * The four surfaces that used to live at their own routes (feed, prayer,
 * leaderboard, finishers, cohorts) are now one destination with a
 * segmented control at the top. Old routes redirect here with a `?view=`
 * so bookmarks and home-screen shortcuts keep working.
 *
 * The view lives in `?view=` rather than pure state so a shared link
 * lands where you meant it to.
 */
function PeopleView() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("view") ?? "feed";
  const view: View =
    raw === "prayer" || raw === "leaderboard" || raw === "finishers" || raw === "cohorts"
      ? (raw as View)
      : "feed";

  const active = VIEWS.find((v) => v.key === view)!;

  const pick = useCallback(
    (next: View) => {
      // Replace, not push — flipping tabs shouldn't build up history the
      // back button then has to chew through.
      const url = next === "feed" ? "/community" : `/community?view=${next}`;
      router.replace(url, { scroll: false });
    },
    [router]
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="text-[28px] md:text-[34px] font-semibold tracking-[-0.03em] text-rog-ink leading-tight">
        {active.title}
      </h1>
      {active.blurb && (
        <p className="mt-2 text-sm text-rog-muted">{active.blurb}</p>
      )}

      {/* Segmented control. Horizontally scrollable on narrow screens so
          all five chips stay reachable at 380 px without wrapping into
          two rows. */}
      <div
        role="tablist"
        aria-label="People views"
        className="mt-6 flex gap-2 overflow-x-auto -mx-6 px-6 pb-1 no-scrollbar"
      >
        {VIEWS.map((v) => {
          const on = view === v.key;
          return (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(v.key)}
              className="chip !min-h-[44px] px-4 shrink-0"
              data-on={on ? "true" : undefined}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {/* Only the chosen view mounts, so the other four aren't running
          realtime subscriptions or list queries in the background. */}
      {view === "feed" && <CommunityFeed />}
      {view === "prayer" && <PrayerWall />}
      {view === "leaderboard" && <LeaderboardView />}
      {view === "finishers" && <FinishersView />}
      {view === "cohorts" && <CohortsView />}
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
            <LoadingRule label="Loading the community" />
          </main>
        }
      >
        <PeopleView />
      </Suspense>
    </>
  );
}
