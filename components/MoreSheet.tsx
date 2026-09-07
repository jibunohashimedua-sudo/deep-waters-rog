"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Choice = "light" | "dark" | "system";

function applyTheme(choice: Choice) {
  const prefersDark =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  const actual = choice === "system" ? (prefersDark ? "dark" : "light") : choice;
  document.documentElement.dataset.theme = actual;
  if (choice === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", choice);
}

type Props = {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
};

export default function MoreSheet({ open, onClose, isAdmin }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [theme, setTheme] = useState<Choice>("system");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = (localStorage.getItem("theme") as Choice) || "system";
    setTheme(stored);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function signOut() {
    onClose();
    await supabase.auth.signOut();
    router.push("/");
  }

  function pickTheme(c: Choice) {
    setTheme(c);
    applyTheme(c);
  }

  const link =
    "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-rog-ink hover:bg-black/5 dark:hover:bg-white/10 transition";
  const label = "px-4 pt-4 pb-1 text-[11px] font-semibold tracking-[0.18em] uppercase text-rog-muted";

  return (
    <div
      className={`md:hidden fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop — dim + soft blur so the page behind softens */}
      <button
        aria-label="Close"
        onClick={onClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="More"
        className={`bottom-glass absolute left-0 right-0 bottom-0 rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        {/* Grabber */}
        <div className="pt-2 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        <div className="px-2 pb-2">
          <p className={label}>Groups</p>
          <Link href="/cohorts" onClick={onClose} className={link}>
            <span aria-hidden>👥</span> Cohorts
          </Link>

          <p className={label}>Celebrate</p>
          <Link href="/finishers" onClick={onClose} className={link}>
            <span aria-hidden>🏁</span> Finishers
          </Link>
          <Link href="/testimonials" onClick={onClose} className={link}>
            <span aria-hidden>💬</span> Share testimony
          </Link>

          <p className={label}>Updates</p>
          <Link href="/announcements" onClick={onClose} className={link}>
            <span aria-hidden>📣</span> Announcements
          </Link>

          <p className={label}>Settings</p>
          <Link href="/me/edit" onClick={onClose} className={link}>
            <span aria-hidden>✏️</span> Edit profile
          </Link>

          <div className="px-4 py-3">
            <p className="text-sm font-medium text-rog-ink mb-2">Theme</p>
            <div className="flex gap-1 p-1 rounded-full glass-chip">
              {(["light", "dark", "system"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => pickTheme(c)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-full transition capitalize ${
                    theme === c
                      ? "bg-rog-purple text-white"
                      : "text-rog-muted hover:text-rog-ink"
                  }`}
                >
                  {c === "dark" ? "🌙 " : c === "light" ? "☀️ " : "🌓 "}
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button type="button" onClick={signOut} className={`${link} w-full text-left`}>
            <span aria-hidden>↩︎</span> Sign out
          </button>

          {isAdmin && (
            <>
              <p className={label}>Admin</p>
              <Link href="/admin" onClick={onClose} className={link}>
                <span aria-hidden>🛠</span> Admin dashboard
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
