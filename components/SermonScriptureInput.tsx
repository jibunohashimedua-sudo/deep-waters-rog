"use client";
import { useState } from "react";
import { parseReference, formatReference } from "@/lib/reference";
import { fetchParallelVerse } from "@/lib/parallelVerse";
import { DEFAULT_BIBLE_ID } from "@/lib/translations";

/**
 * Add a scripture to a sermon by typing its reference.
 *
 * The Bench can send a verse here, but a sermon is not written one Bench
 * visit at a time — a preacher sitting down with a passage in mind needs
 * to be able to say "Romans 8:28" and have the words arrive.
 *
 * It fetches through fetchParallelVerse, which is the same call Compare
 * and the Bench's Translations lens make, hitting the same endpoint and
 * the same chapter cache behind it. Deliberately not a second fetcher:
 * two ways to ask for the same verse is two things to keep in step and
 * two ways for it to fail differently.
 */
export default function SermonScriptureInput({
  translationId,
  onAdd
}: {
  translationId?: string | null;
  onAdd: (reference: string, text: string) => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseReference(value);

  async function add() {
    if (!parsed) {
      setError("Try something like Romans 8:28, or Psalm 23.");
      return;
    }
    setBusy(true);
    setError(null);

    // A whole-chapter reference would be the entire chapter in a sermon
    // block. Asking for the first verse and letting the preacher widen it
    // is the kinder default; the reference itself still says the chapter.
    const start = parsed.verseStart ?? 1;
    const end = parsed.verseEnd ?? start;

    const row = await fetchParallelVerse({
      bookSlug: parsed.book.slug,
      chapter: parsed.chapter,
      start,
      end,
      bibleId: translationId || DEFAULT_BIBLE_ID
    });
    setBusy(false);

    if (row.status !== "ready") {
      setError(row.status === "error" ? row.message : "That wouldn't load.");
      return;
    }
    onAdd(formatReference(parsed), row.text);
    setValue("");
  }

  return (
    <div className="sermon-add-scripture">
      <label htmlFor="sermon-ref" className="sr-only">
        Add a scripture by reference
      </label>
      <input
        id="sermon-ref"
        type="text"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void add();
          }
        }}
        placeholder="Romans 8:28"
        disabled={busy}
      />
      <button
        type="button"
        onClick={add}
        disabled={busy || !value.trim()}
        className="btn-secondary"
      >
        {busy ? "Fetching…" : "Add scripture"}
      </button>
      {error ? (
        <p className="sermon-add-note text-danger">{error}</p>
      ) : (
        parsed && (
          <p className="sermon-add-note">Adds {formatReference(parsed)}</p>
        )
      )}
    </div>
  );
}
