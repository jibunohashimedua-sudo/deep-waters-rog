"use client";
import { useEffect, useState } from "react";

/**
 * The warm line at the top of Today.
 *
 * All the phrasing lives in this file so it's easy to edit. Two rules the
 * copy has to keep: never count or mention missed days, and never instruct —
 * this is a friendly hello, not the church talking.
 */

const GREETINGS = {
  morning: ["Good morning"],
  afternoon: ["Good afternoon"],
  evening: ["Good evening"],
  // 10pm–5am. Softer, and never implies they should be asleep.
  late: ["Still up", "Late night", "Late one"]
};

const SUBLINES = {
  firstDay: [
    "Day one. Let's begin.",
    "Day one of ninety. Here we go.",
    "The first day. Take your time.",
    "Day one. No rush."
  ],
  lastDay: [
    "Last day. You're nearly there.",
    "Day ninety. The final one.",
    "The last one. Finish well."
  ],
  penultimate: [
    "One more after this.",
    "Two left, counting today.",
    "Nearly ninety."
  ],
  doneToday: [
    "Today's done. Well done.",
    "Today's kept. Nothing else needed.",
    "That's today done.",
    "Today's saved. Rest easy."
  ],
  // Shown when someone comes back after a gap. Warm only — the gap is
  // never counted, named, or alluded to.
  returning: [
    "Good to have you back.",
    "Welcome back.",
    "Glad you're here.",
    "Good to see you."
  ],
  everyday: [
    "Ready when you are.",
    "Whenever you're ready.",
    "Take it at your pace.",
    "A few chapters, that's all."
  ]
};

/** Same phrase all day, a different one tomorrow. */
function pick(list: string[], seed: number): string {
  return list[seed % list.length];
}

function timeOfDay(hour: number): keyof typeof GREETINGS {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "late";
}

export type GreetingProps = {
  /** Full profile name; only the first word is used. */
  name: string;
  day: number;
  completedToday: boolean;
  /** Still passed, still never printed: a run is something the gauge
      shows by being full, not a number the app reads back to you. */
  streak: number;
  /** They have history, but there's a gap between it and today. */
  returning: boolean;
};

function firstNameOf(name: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "there";
}

function subline(
  { day, completedToday, streak, returning }: Omit<GreetingProps, "name">,
  seed: number
): string {
  // First match wins, in this order.
  if (day === 1 && !completedToday) return pick(SUBLINES.firstDay, seed);
  // Day 90 still to do reads as the finish line; day 90 already saved is a
  // finish, so "you're nearly there" would be wrong — fall through to done.
  if (day === 90 && !completedToday) return pick(SUBLINES.lastDay, seed);
  if (day === 89 && !completedToday) return pick(SUBLINES.penultimate, seed);
  if (completedToday) return pick(SUBLINES.doneToday, seed);
  if (returning) return pick(SUBLINES.returning, seed);
  return pick(SUBLINES.everyday, seed);
}

export default function Greeting({ name, day, completedToday, streak, returning }: GreetingProps) {
  // Time of day has to come from the device, so it's right wherever they are.
  // Rendering it only after mount avoids a hydration mismatch; the pre-mount
  // markup is the same shape held invisible, so nothing moves when it lands.
  const [line, setLine] = useState<{ greeting: string; sub: string } | null>(null);

  useEffect(() => {
    const now = new Date();
    // Seed from the local calendar date: stable all day, rolls over at midnight.
    const seed =
      now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
    setLine({
      greeting: pick(GREETINGS[timeOfDay(now.getHours())], seed),
      sub: subline({ day, completedToday, streak, returning }, seed)
    });
  }, [day, completedToday, streak, returning]);

  const first = firstNameOf(name);

  return (
    <div className="mb-10">
      {/* Styled like the page heading but deliberately a <p>: "Day N" below is
          the page's real h1, and two h1s would break the heading order. */}
      {/* The one large sans line in the app. Scripture gets the serif;
          the person being spoken to gets the interface face, at weight. */}
      <p className="text-[27px] md:text-[32px] font-semibold tracking-[-0.025em] text-rog-ink leading-[1.14]">
        {line ? (
          `${line.greeting}, ${first}.`
        ) : (
          // Placeholder of the same shape, so the heading never jumps.
          <span className="invisible" aria-hidden>
            Good morning, {first}.
          </span>
        )}
      </p>
      <p className="mt-2 text-[13.5px] text-rog-muted">
        {line ? (
          line.sub
        ) : (
          <span className="invisible" aria-hidden>
            Ready when you are.
          </span>
        )}
      </p>
    </div>
  );
}
