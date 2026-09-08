"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import {
  TRANSLATIONS,
  TRANSLATION_GROUPS,
  translationById
} from "@/lib/translations";

/**
 * Which translation you're reading in, and the way to change it.
 *
 * It lives in the sticky reading bar, so it travels down the chapter with
 * you: the moment you want another rendering is the moment a line stops
 * making sense, and that is never at the top of the page.
 *
 * It shows the code and nothing else — KJV, NIV — because the bar has three
 * things in it on a 360px phone and the full name of a translation is not
 * one of them. The name, and a line about what the edition is, live in the
 * sheet, where there is room to read them.
 *
 * The choice is saved to the profile, not the browser, so it follows the
 * reader to their other devices. Changing it re-renders this same chapter on
 * the server and puts the page back exactly where it was — nobody asked to be
 * returned to the top, still less to Genesis.
 */
export default function TranslationSwitcher({
  userId,
  currentId
}: {
  userId: string;
  currentId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = translationById(currentId);

  // Where the reader was standing when they asked for another translation.
  // router.refresh() keeps the scroll position on its own in every browser
  // we've tried, but "on its own" is not a guarantee, and landing back at
  // verse 1 of a chapter you were halfway down is the exact complaint this
  // control exists to answer.
  const restoreTo = useRef<number | null>(null);

  useEffect(() => {
    if (pending || restoreTo.current === null) return;
    const y = restoreTo.current;
    restoreTo.current = null;
    window.scrollTo({ top: y, behavior: "auto" });
  }, [pending]);

  // Counted, so a sheet opened on top of another one doesn't leave the
  // body locked when the first of them closes. See lib/useLockBodyScroll.
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function change(id: string) {
    if (id === currentId) {
      setOpen(false);
      return;
    }
    restoreTo.current = window.scrollY;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ preferred_bible_id: id })
      .eq("id", userId);
    setSaving(false);
    if (err) {
      restoreTo.current = null;
      setError(friendlyError(err.message));
      return;
    }
    setOpen(false);
    // Re-render this same chapter on the server in the new translation. The
    // route doesn't change, so the book, the chapter and the verse you were
    // looking at all stay exactly as they are.
    startTransition(() => router.refresh());
  }

  const busy = saving || pending;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={busy}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Translation: ${current.name}. Change it.`}
        className="chip gap-1.5 !px-3.5 min-h-[44px] font-mono !text-[9.5px] tracking-[0.13em] uppercase disabled:opacity-60"
      >
        {busy ? "…" : current.abbr}
        <span className="text-[8px]" aria-hidden>
          &#9662;
        </span>
      </button>

      <span className="sr-only" aria-live="polite">
        {busy ? "Changing translation" : `Reading in ${current.name}`}
      </span>

      <div
        data-verse-sheet
        className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          aria-label="Close"
          onClick={() => setOpen(false)}
          className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose a translation"
          className={`bottom-glass absolute left-0 right-0 bottom-0 rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
            open ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
        >
          <div className="pt-2 pb-2 flex justify-center">
            <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
          </div>

          <div className="px-5 pb-5">
            <p className="kicker">Reading in {current.abbr}</p>
            <h2 className="mt-2 font-serif text-2xl font-medium text-rog-ink leading-tight">
              Translation
            </h2>
            <p className="mt-2 text-sm text-rog-muted">
              Your choice is saved to your account and follows you everywhere
              you read. It never touches your highlights or notes.
            </p>

            {error && <p className="mt-4 text-sm text-danger">{error}</p>}

            {TRANSLATION_GROUPS.map((g) => {
              const list = TRANSLATIONS.filter((t) => t.group === g);
              if (list.length === 0) return null;
              return (
                <div key={g} className="mt-6">
                  <h3 className="text-sm font-semibold text-rog-ink">{g}</h3>
                  <ul className="mt-2 card-list">
                    {list.map((t) => {
                      const on = t.id === currentId;
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => change(t.id)}
                            disabled={busy}
                            aria-current={on ? "true" : undefined}
                            className="card w-full text-left flex items-start gap-3 disabled:opacity-60"
                          >
                            <span className="font-mono text-[10px] tracking-[0.13em] uppercase text-rog-muted pt-1 w-[64px] shrink-0">
                              {t.abbr}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-medium text-rog-ink leading-tight">
                                {t.name}
                              </span>
                              <span className="block mt-1 text-xs text-rog-muted">
                                {t.note}
                              </span>
                            </span>
                            {on && (
                              <span
                                className="text-rog-purple text-sm pt-0.5"
                                aria-hidden
                              >
                                &#10003;
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
