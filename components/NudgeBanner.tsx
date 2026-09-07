"use client";
import { useEffect, useState } from "react";

export default function NudgeBanner({ completed, day }: { completed: boolean; day: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (completed) return;
    const hour = new Date().getHours();
    setShow(hour >= 20); // 8pm local time
  }, [completed]);

  if (!show) return null;

  return (
    <div className="mb-6 bg-rog-purple text-white px-5 py-4 flex items-center gap-3">
      <span className="text-2xl">⏰</span>
      <div>
        <p className="font-semibold">Day {day} is still open</p>
        <p className="text-sm text-white/85">A few chapters before bed. You&rsquo;ve got this.</p>
      </div>
    </div>
  );
}
