"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import SelectSheet from "./SelectSheet";
import { TRANSLATIONS, TRANSLATION_GROUPS, translationById } from "@/lib/translations";
import { writeBookLayout } from "@/lib/bookLayout";
import { NICKNAME_MAX } from "@/lib/nickname";
import {
  type LineSpacing,
  type Preferences,
  type ReadingFont,
  type TextSize,
  type Theme
} from "@/lib/preferences";

/**
 * The offline download panel, loaded after this screen rather than with it.
 *
 * It carries the whole download walker — the chapter list, the batching, the
 * storage estimate — and none of that is needed to draw a preferences screen.
 * Somebody who came here to change their text size should not pay for a
 * Bible downloader to do it.
 */
const OfflineDownload = dynamic(() => import("./OfflineDownload"), { ssr: false });

type Props = {
  initial: Preferences;
  initialNickname: string;
  /** The account name, shown as the fallback so nobody has to guess what
      clearing the nickname box will leave behind. */
  accountName: string;
  initialTranslation: string;
};

/**
 * Everything about how the app looks and behaves for one person.
 *
 * No save button. Every control writes as it is changed, one setting per
 * request, and the change is on screen before the request comes back —
 * these are preferences, not a form, and a preference that needs
 * confirming is a preference that has been made into work.
 *
 * The two that would otherwise flash on load — the theme and the book
 * list — are also written to the browser, so the next page paints right
 * without waiting for a profile query. The database stays the truth; the
 * browser copy is a cache that gets corrected on the next load.
 */
export default function PreferencesForm({
  initial,
  initialNickname,
  accountName,
  initialTranslation
}: Props) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Preferences>(initial);
  const [translation, setTranslation] = useState(initialTranslation);
  const [note, setNote] = useState<{ message: string; tone: "ok" | "bad" } | null>(
    null
  );
  const noteTimer = useRef<number | null>(null);

  const flash = useCallback((message: string, tone: "ok" | "bad" = "bad") => {
    setNote({ message, tone });
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(
      () => setNote(null),
      tone === "ok" ? 1600 : 2600
    );
  }, []);

  /**
   * Write one setting. Optimistic, and rolled back with the reason if the
   * server refuses — which for a preference should be never, and is worth
   * saying plainly on the day it isn't.
   *
   * `silent` is for the settings you can see land. Change the text size
   * and the sample resizes under your thumb; change the theme and the
   * whole app turns. Saying "Saved" on top of that is the interface
   * narrating something the reader has just watched happen. The ones that
   * change nothing visible — the leaderboard switch, the reminder time —
   * do get told, because otherwise there is no way to know it stuck.
   */
  const save = useCallback(
    async (
      key: string,
      value: unknown,
      rollback: () => void,
      silent = false
    ) => {
      try {
        const res = await fetch("/api/preferences", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          rollback();
          flash(j.error ?? "That didn't save.");
          return false;
        }
        if (!silent) flash("Saved", "ok");
        return true;
      } catch {
        rollback();
        flash("That didn't save. Check your connection.");
        return false;
      }
    },
    [flash]
  );

  /** The settings whose effect is on the screen the moment you choose
      them, and so need no word from us. */
  const VISIBLE_ON_CHANGE: (keyof Preferences)[] = [
    "text_size",
    "reading_font",
    "line_spacing",
    "verse_numbers"
  ];

  function set<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    const before = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    void save(
      key,
      value,
      () => setPrefs((p) => ({ ...p, [key]: before })),
      VISIBLE_ON_CHANGE.includes(key)
    );
  }

  // Reading type is applied to the document as it changes, so the sample
  // below — and every reading screen behind this one — is already right
  // when the reader goes back to it.
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.textSize = prefs.text_size;
    el.dataset.lineSpacing = prefs.line_spacing;
    el.dataset.readingFont = prefs.reading_font;
    el.dataset.verseNumbers = prefs.verse_numbers ? "on" : "off";
  }, [prefs.text_size, prefs.line_spacing, prefs.reading_font, prefs.verse_numbers]);

  function pickTheme(choice: Theme) {
    const before = prefs.theme;
    setPrefs((p) => ({ ...p, theme: choice }));
    // Applied and cached in the browser immediately: the theme script in
    // the document head reads localStorage before React exists, and that
    // is what stops the next page loading in the wrong one.
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme =
      choice === "system" ? (prefersDark ? "dark" : "light") : choice;
    try {
      if (choice === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", choice);
    } catch {
      /* private mode; the database still has it */
    }
    // Visible: the whole app has just changed colour.
    void save("theme", choice, () => setPrefs((p) => ({ ...p, theme: before })), true);
  }

  function pickLayout(choice: Preferences["book_layout"]) {
    const before = prefs.book_layout;
    setPrefs((p) => ({ ...p, book_layout: choice }));
    // The Bible tab reads the browser copy so it renders the right list
    // on the first paint. lib/bookLayout is the one mechanism for this,
    // as it was before — the database is simply what feeds it now.
    writeBookLayout(choice);
    // Not visible from here — the list it changes is on another tab.
    void save("book_layout", choice, () => {
      setPrefs((p) => ({ ...p, book_layout: before }));
      writeBookLayout(before);
    });
  }

  async function pickTranslation(id: string) {
    const before = translation;
    setTranslation(id);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "preferred_bible_id", value: id })
      });
      if (!res.ok) throw new Error();
      flash("Saved", "ok");
      // The reading pages render the chapter server-side in whichever
      // translation the profile names, so they have to be told.
      router.refresh();
    } catch {
      setTranslation(before);
      flash("That didn't save. Try again.");
    }
  }

  return (
    <div className="prefs">
      <NicknameField
        initial={initialNickname}
        accountName={accountName}
        onSaved={() => {
          flash("Saved", "ok");
          router.refresh();
        }}
      />

      <Group
        title="Reading"
        blurb="How scripture is set on the page. Changes apply straight away."
      >
        <Choice<TextSize>
          label="Text size"
          hint="The whole verse — numbers, indents and all — moves with it."
          value={prefs.text_size}
          onChange={(v) => set("text_size", v)}
          options={[
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
            { value: "xlarge", label: "Largest" }
          ]}
        />

        <Choice<ReadingFont>
          label="Font"
          hint="Serif was drawn for reading at length. Sans is easier for some eyes."
          value={prefs.reading_font}
          onChange={(v) => set("reading_font", v)}
          options={[
            { value: "serif", label: "Serif" },
            { value: "sans", label: "Sans" }
          ]}
        />

        <Choice<LineSpacing>
          label="Line spacing"
          value={prefs.line_spacing}
          onChange={(v) => set("line_spacing", v)}
          options={[
            { value: "tight", label: "Tight" },
            { value: "normal", label: "Normal" },
            { value: "relaxed", label: "Relaxed" }
          ]}
        />

        <Toggle
          label="Verse numbers"
          hint="Off hides the numbers but keeps the shape of the page."
          checked={prefs.verse_numbers}
          onChange={(v) => set("verse_numbers", v)}
        />

        {/* The sample. It is the real thing — the same classes, the same
            grid — so what is on this screen is what will be on the next. */}
        <div className="prefs-sample" aria-label="Sample">
          <div className="bible-content">
            <p className="p">
              <span className="dw-verse" data-verse="1">
                <span className="v verse-num" data-number="1">1</span>
                <span className="verse-text">
                  In the beginning God created the heavens and the earth.
                </span>
              </span>
            </p>
          </div>
        </div>

        <Choice<Preferences["book_layout"]>
          label="Book list"
          hint="One list from Genesis to Revelation, or grouped by section."
          value={prefs.book_layout}
          onChange={pickLayout}
          options={[
            { value: "list", label: "Single list" },
            { value: "grouped", label: "Grouped" }
          ]}
        />

        <div className="prefs-row">
          <div className="prefs-row-text">
            <span className="prefs-label">Translation</span>
            <span className="prefs-hint">
              {translationById(translation).note} Your ninety days stay the
              same — only the wording changes.
            </span>
          </div>
          <SelectSheet
            label="Bible translation"
            value={translation}
            onChange={pickTranslation}
            className="prefs-control-wide"
            options={TRANSLATION_GROUPS.flatMap((g) =>
              TRANSLATIONS.filter((t) => t.group === g).map((t) => ({
                value: t.id,
                label: `${t.abbr} — ${t.name}`,
                group: g
              }))
            )}
          />
        </div>

        {/* Under Reading rather than in a section of its own: it is a
            reading setting — whether scripture is here when the signal
            isn't — and it sits directly under the translation it downloads.
            It also carries the list of anything written but not yet sent,
            because "what is this app holding on my phone" is one question
            and it should have one answer. */}
        <OfflineDownload translationId={translation} />
      </Group>

      <Group title="Appearance" blurb="How the app looks everywhere else.">
        <Choice<Theme>
          label="Theme"
          hint="Follow device uses whatever your phone is set to, including at sunset."
          value={prefs.theme}
          onChange={pickTheme}
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "Follow device" }
          ]}
        />
      </Group>

      <Group
        title="Community"
        blurb="What other members see of your reading. Nothing here deletes anything."
      >
        <Toggle
          label="Show me on the leaderboard"
          hint="Off keeps your streak and your days — you just aren't in the table."
          checked={prefs.show_on_leaderboard}
          onChange={(v) => set("show_on_leaderboard", v)}
        />
        <Toggle
          label="Share my reading on the feed"
          hint="Off keeps your completed days and reflections to yourself. They stay in Depth."
          checked={prefs.share_reading_activity}
          onChange={(v) => set("share_reading_activity", v)}
        />
      </Group>

      <Group title="Notifications" blurb="A nudge on the days you'd rather not miss.">
        <Toggle
          label="Email reminder"
          checked={prefs.email_reminders}
          onChange={(v) => set("email_reminders", v)}
        />
        <Toggle
          label="Push notification"
          checked={prefs.push_reminders}
          onChange={(v) => set("push_reminders", v)}
        />
        <div className="prefs-row">
          <div className="prefs-row-text">
            <span className="prefs-label">Reminder time</span>
            <span className="prefs-hint">In your own timezone.</span>
          </div>
          <SelectSheet
            label="Reminder time"
            value={String(prefs.reminder_hour)}
            onChange={(v) => set("reminder_hour", Number(v))}
            className="prefs-control"
            options={Array.from({ length: 24 }, (_, h) => ({
              value: String(h),
              label: `${String(h).padStart(2, "0")}:00`
            }))}
          />
        </div>
      </Group>

      {note && (
        <div
          role="status"
          aria-live="polite"
          className="toast"
          data-tone={note.tone}
          style={{ bottom: 0 }}
        >
          {note.message}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Group({
  title,
  blurb,
  children
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="prefs-group">
      <h2 className="prefs-group-title">{title}</h2>
      {blurb && <p className="prefs-group-blurb">{blurb}</p>}
      <div className="prefs-group-body">{children}</div>
    </section>
  );
}

/** A row of two to four mutually exclusive choices. A segmented control
    rather than a dropdown, because seeing the alternatives is most of
    what makes a preference easy to set. */
function Choice<T extends string>({
  label,
  hint,
  value,
  onChange,
  options
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="prefs-block">
      <span className="prefs-label">{label}</span>
      {hint && <span className="prefs-hint">{hint}</span>}
      <div className="segmented mt-3" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className="segmented-option"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="prefs-row prefs-row-tappable">
      <span className="prefs-row-text">
        <span className="prefs-label">{label}</span>
        {hint && <span className="prefs-hint">{hint}</span>}
      </span>
      <input
        type="checkbox"
        className="prefs-switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/**
 * The nickname.
 *
 * The one field on this screen that can be refused, so it is the one
 * field with a button: a name typed a character at a time would be
 * rejected on every keystroke until the last one, which is no way to be
 * told anything. It saves on blur and on Enter, and says what happened.
 */
function NicknameField({
  initial,
  accountName,
  onSaved
}: {
  initial: string;
  accountName: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function commit() {
    const next = value.trim();
    if (next === saved.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: "nickname", value: next })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error ?? "That name wasn't accepted.");
        return;
      }
      const stored = (j.nickname as string | null) ?? "";
      setValue(stored);
      setSaved(stored);
      onSaved();
    } catch {
      setError("That didn't save. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="prefs-group">
      <h2 className="prefs-group-title">Your name here</h2>
      <p className="prefs-group-blurb">
        What other members see — on the feed, the prayer board, the
        leaderboard and in your cohort. Leave it empty to go by{" "}
        {accountName}.
      </p>
      <div className="prefs-group-body">
        <div className="prefs-block">
          <label htmlFor="pf-nickname" className="prefs-label">
            Name you go by
          </label>
          <input
            id="pf-nickname"
            type="text"
            value={value}
            maxLength={NICKNAME_MAX}
            autoComplete="nickname"
            placeholder={accountName}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            disabled={busy}
            className="mt-3"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "pf-nickname-error" : undefined}
          />
          {error ? (
            <p id="pf-nickname-error" className="prefs-error mt-2">
              {error}
            </p>
          ) : (
            <p className="prefs-hint mt-2">
              Your church still sees your account name — {accountName} — in
              the admin pages, so nobody loses track of who you are.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
