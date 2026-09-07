"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import {
  TRANSLATIONS,
  TRANSLATION_GROUPS,
  translationById
} from "@/lib/translations";

/**
 * The small control beside a chapter heading. Deliberately unobtrusive — it
 * shows which translation you're in and lets you swap without leaving the
 * chapter, so two renderings can be compared a tap apart.
 *
 * The choice is saved to the profile, not the browser, so it follows the
 * reader to their other devices.
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = translationById(currentId);

  async function change(id: string) {
    if (id === currentId) return;
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .update({ preferred_bible_id: id })
      .eq("id", userId);
    setSaving(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    // Re-render the chapter on the server in the new translation.
    startTransition(() => router.refresh());
  }

  const busy = saving || pending;

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <div className="relative inline-flex items-center">
        <label htmlFor="translation" className="sr-only">
          Translation
        </label>
        <select
          id="translation"
          value={currentId}
          disabled={busy}
          onChange={(e) => change(e.target.value)}
          // Sized to the abbreviation, not to the longest option: the full
          // "King James Version" was setting the width of the control and
          // pushing it off the edge of a phone.
          // A pill, because it is a thing you press — and 44px tall,
          // because it is a thing you press with a thumb.
          className="chip appearance-none min-h-[44px] max-w-[132px] truncate pl-4 pr-8 font-mono !text-[9.5px] tracking-[0.13em] uppercase disabled:opacity-60"
        >
          {TRANSLATION_GROUPS.map((g) => (
            <optgroup key={g} label={g}>
              {TRANSLATIONS.filter((t) => t.group === g).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.abbr} — {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-3.5 text-rog-muted text-[9px]"
          aria-hidden
        >
          ▾
        </span>
      </div>
      <span className="sr-only" aria-live="polite">
        {busy ? "Changing translation" : `Reading in ${current.name}`}
      </span>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
