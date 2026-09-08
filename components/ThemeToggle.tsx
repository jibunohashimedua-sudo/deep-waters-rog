"use client";
import { useEffect, useState } from "react";
import Icon from "./Icons";

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
        className="tap-target p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Theme"
        title={`Theme: ${choice}`}
      >
        <Icon name={choice} className="w-5 h-5" />
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
                <Icon name={c} className="w-[17px] h-[17px] shrink-0 text-rog-muted" />
                <span className="capitalize">{c}</span>
                {choice === c && (
                  <Icon name="check" className="ml-auto w-3.5 h-3.5 text-rog-muted" strokeWidth={2.2} />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
