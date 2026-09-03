"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = {
  kicker: string;
  title: string;
  body: string;
  emoji: string;
  gradient: string; // from/to tailwind classes on a hero
};

const STEPS: Step[] = [
  {
    kicker: "Welcome",
    title: "Deep Waters",
    body: "A 90 day journey through the Bible together. Old Testament and New Testament, every single day. You will finish at day 90.",
    emoji: "🌊",
    gradient: "from-rog-purple via-[#4A2A85] to-rog-blue"
  },
  {
    kicker: "Every day",
    title: "Read together",
    body: "Roughly 13 chapters a day, split between OT and NT. Tap the reading cards to open the KJV text right in the app. No jumping between tabs.",
    emoji: "📖",
    gradient: "from-rog-blue via-[#4A5FD8] to-rog-purple"
  },
  {
    kicker: "One verse. One thought.",
    title: "Share what stood out",
    body: "After you read, drop the verse that hit you and a short reflection. It shows up on the community feed. Amen someone. Comment. Tag with @name.",
    emoji: "💬",
    gradient: "from-rog-pink via-[#D24A8A] to-rog-purple"
  },
  {
    kicker: "You are not alone",
    title: "Prayer, cohorts, and support",
    body: "Post prayer requests. See who is praying with you. Join a cohort to walk with a smaller group. Everyone is reading the same day.",
    emoji: "🙏",
    gradient: "from-rog-purple via-[#5B3A9E] to-rog-pink"
  },
  {
    kicker: "Track your journey",
    title: "Progress, badges, finisher wall",
    body: "See your 90 day grid fill up. Earn badges for streaks and milestones. Hit day 90 and land on the finisher wall.",
    emoji: "🏆",
    gradient: "from-rog-blue via-rog-purple to-rog-pink"
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
      className="min-h-screen flex flex-col"
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
          <div
            className={`relative rounded-[2rem] overflow-hidden bg-gradient-to-br ${step.gradient} text-white p-8 md:p-12 text-center shadow-2xl`}
          >
            {/* Soft glows */}
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-32 -right-24 w-80 h-80 bg-white/15 rounded-full blur-3xl" />

            <div className="relative">
              <div className="text-6xl md:text-7xl mb-6">{step.emoji}</div>
              <p className="kicker !text-white/85">{step.kicker}</p>
              <h1 className="mt-4 text-3xl md:text-4xl font-bold leading-tight">
                {step.title}
              </h1>
              <p className="mt-5 text-white/90 leading-relaxed">
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
                className={`h-1.5 rounded-full transition-all ${
                  idx === i ? "w-8 bg-rog-purple" : "w-1.5 bg-rog-purple/30 hover:bg-rog-purple/60"
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
