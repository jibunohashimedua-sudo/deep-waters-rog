"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Mark from "@/components/Mark";

type Step = {
  kicker: string;
  title: string;
  body: string;
  /** Set on the brand slide, which shows the four-bar mark instead. */
  brand?: boolean;
};

const STEPS: Step[] = [
  {
    kicker: "Welcome",
    title: "Deep Waters",
    body: "A 90 day journey through the Bible together. Old Testament and New Testament, every single day. You will finish at day 90.",
    brand: true
  },
  {
    kicker: "Every day",
    title: "Read together",
    body: "Roughly 13 chapters a day, split between OT and NT. Tap the reading cards to open the KJV text right in the app. No jumping between tabs."
  },
  {
    kicker: "One verse. One thought.",
    title: "Share what stood out",
    body: "After you read, drop the verse that hit you and a short reflection. It shows up on the community feed. Amen someone. Comment. Tag with @name."
  },
  {
    kicker: "You are not alone",
    title: "Prayer, cohorts, and support",
    body: "Post prayer requests. See who is praying with you. Join a cohort to walk with a smaller group. Everyone is reading the same day."
  },
  {
    kicker: "Track your journey",
    title: "Progress, badges, finisher wall",
    body: "See your 90 day grid fill up. Earn badges for streaks and milestones. Hit day 90 and land on the finisher wall."
  }
];

export default function WelcomePage() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const total = STEPS.length;
  const step = STEPS[i];
  const isLast = i === total - 1;

  const next = useCallback(() => {
    if (isLast) router.push("/signup");
    else setI((n) => n + 1);
  }, [isLast, router]);

  const back = useCallback(() => setI((n) => Math.max(0, n - 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") back();
      if (e.key === "Escape") router.push("/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, back, router]);

  // Touch swipe
  const [touchStart, setTouchStart] = useState<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    setTouchStart(e.targetTouches[0].clientX);
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) next();
      else back();
    }
    setTouchStart(null);
  }

  return (
    <main
      className="main-plain min-h-screen flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4">
        <Link href="/" className="text-sm text-rog-muted hover:text-rog-purple">
          Skip
        </Link>
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-rog-purple">
          Deep Waters
        </p>
        <div className="w-10" />
      </div>

      {/* Hero card */}
      <section className="flex-1 flex items-center justify-center px-6 py-4">
        <div className="w-full max-w-xl">
          {/* One ground for all five steps, and it's the same violet-black
              the splash rises out of. Five different purple gradients made
              onboarding feel like five different apps. */}
          <div
            className="relative overflow-hidden p-8 md:p-12 text-center"
            style={{ background: "#0C0A18", color: "#E9E6F2" }}
          >
            <div className="relative">
              {/* Only the brand slide carries a mark now. The other four
                  used to open with an 80px icon of the thing they describe,
                  and those icons are gone with the rest of the set — so the
                  words are the slide. Which is the honest arrangement: each
                  one is a sentence about what this app asks of you, and a
                  picture of a book was never adding to it. */}
              {step.brand && (
                <div className="mb-8 flex justify-center" style={{ color: "#E9E6F2" }}>
                  <Mark size={88} className="text-[#F3EDE4] w-20 md:w-24 h-auto" />
                </div>
              )}
              <p className="kicker" style={{ color: "#8B87A3" }}>
                {step.kicker}
              </p>
              <h1 className="mt-4 text-[30px] md:text-4xl font-semibold tracking-[-0.03em] leading-tight">
                {step.title}
              </h1>
              <p className="mt-5 leading-relaxed text-[15px]" style={{ color: "#B9B4C9" }}>
                {step.body}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="mt-6 flex justify-center gap-2">
            {STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setI(idx)}
                aria-label={`Step ${idx + 1}`}
                className={`h-[3px] transition-all ${
                  idx === i ? "w-8 bg-rog-purple" : "w-2 bg-rog-line hover:bg-rog-muted"
                }`}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={back}
              disabled={i === 0}
              className="btn-secondary flex-1 disabled:opacity-30"
            >
              Back
            </button>
            <button onClick={next} className="btn-primary flex-1">
              {isLast ? "Get started" : "Next"}
            </button>
          </div>

          {isLast && (
            <p className="mt-4 text-center text-sm text-rog-muted">
              Already a member?{" "}
              <Link href="/login" className="text-rog-purple font-semibold">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
