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

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="tap-target px-2 py-1 meta hover:text-rog-ink"
        aria-label={`Theme: ${choice}. Change it.`}
        title={`Theme: ${choice}`}
      >
        {choice}
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          {/* Opaque. `glass-chip` is a transparent border-only treatment, so
              the page behind this menu was reading straight through it. */}
          <div
            className="absolute right-0 mt-2 w-40 overflow-hidden border border-rog-line z-40"
            style={{ background: "var(--bg)" }}
          >
            {(["light", "dark", "system"] as const).map((c) => (
              <button
                key={c}
                onClick={() => pick(c)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 flex items-center gap-2 ${
                  choice === c ? "font-semibold" : ""
                }`}
              >
                <span className="capitalize">{c}</span>
                {/* The tick was the twenty-second icon in a set that is
                    now five. A word says it, and says it in the metadata
                    face the rest of the app's state is written in. */}
                {choice === c && <span className="ml-auto meta">On</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
