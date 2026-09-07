"use client";
import { useEffect, useState } from "react";

type Choice = "light" | "dark" | "system";

function apply(choice: Choice) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const actual = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = actual;
  if (choice === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", choice);
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState<Choice>("system");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Choice) || "system";
    setChoice(stored);
    // Keep in sync with system changes when set to system
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!localStorage.getItem("theme")) {
        document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
      }
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function pick(c: Choice) {
    setChoice(c);
    apply(c);
    setOpen(false);
  }

  const icon = choice === "dark" ? "🌙" : choice === "light" ? "☀️" : "🌓";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="tap-target p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Theme"
        title={`Theme: ${choice}`}
      >
        <span className="text-lg">{icon}</span>
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-40 overflow-hidden glass-chip z-40">
            {(["light", "dark", "system"] as const).map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 ${
                  choice === c ? "font-semibold" : ""
                }`}
              >
                <span className="w-5 text-center">
                  {c === "dark" ? "🌙" : c === "light" ? "☀️" : "🌓"}
                </span>
                <span className="capitalize">{c}</span>
                {choice === c && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
