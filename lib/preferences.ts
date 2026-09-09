/**
 * What a person has chosen about how the app looks and behaves.
 *
 * All of it lives on their profile row rather than in the browser, so it
 * follows them from the phone to the iPad to a borrowed laptop. The
 * browser keeps a copy of the two that would otherwise flash on load
 * (theme, and the book list), but the database is what is true.
 *
 * Every preference has a default that is correct on its own. Somebody who
 * never opens the Preferences screen — which will be most people — gets
 * the app exactly as it was before this file existed. That is the test
 * this module has to pass: the defaults below are not placeholders, they
 * are the shipped design.
 */

export type Theme = "system" | "light" | "dark";
export type BookLayout = "list" | "grouped";
export type TextSize = "small" | "medium" | "large" | "xlarge";
export type ReadingFont = "serif" | "sans";
export type LineSpacing = "tight" | "normal" | "relaxed";

export type Preferences = {
  // ---- Reading
  book_layout: BookLayout;
  verse_numbers: boolean;
  text_size: TextSize;
  reading_font: ReadingFont;
  line_spacing: LineSpacing;
  // ---- Appearance
  theme: Theme;
  // ---- Community
  show_on_leaderboard: boolean;
  share_reading_activity: boolean;
  // ---- Notifications
  email_reminders: boolean;
  push_reminders: boolean;
  reminder_hour: number;
};

export const DEFAULT_PREFERENCES: Preferences = {
  book_layout: "list",
  verse_numbers: true,
  text_size: "medium",
  reading_font: "serif",
  line_spacing: "normal",
  theme: "system",
  show_on_leaderboard: true,
  share_reading_activity: true,
  email_reminders: true,
  push_reminders: false,
  reminder_hour: 7
};

/** The columns this screen owns. Anything not in here is not a preference
    and must not be written by the preferences endpoint. */
export const PREFERENCE_KEYS = Object.keys(
  DEFAULT_PREFERENCES
) as (keyof Preferences)[];

const THEMES: Theme[] = ["system", "light", "dark"];
const LAYOUTS: BookLayout[] = ["list", "grouped"];
const SIZES: TextSize[] = ["small", "medium", "large", "xlarge"];
const FONTS: ReadingFont[] = ["serif", "sans"];
const SPACINGS: LineSpacing[] = ["tight", "normal", "relaxed"];

/**
 * Read a set of preferences off anything shaped like a profile row.
 *
 * Deliberately forgiving. A column that hasn't been migrated yet, a null
 * left by an older row, a value someone typed straight into the database
 * — every one of them falls back to the default rather than rendering a
 * broken screen. Preferences are not the sort of thing worth an error.
 */
export function readPreferences(row: Record<string, unknown> | null | undefined): Preferences {
  const r = row ?? {};
  const pick = <T extends string>(v: unknown, allowed: T[], fallback: T): T =>
    typeof v === "string" && (allowed as string[]).includes(v) ? (v as T) : fallback;
  const bool = (v: unknown, fallback: boolean) =>
    typeof v === "boolean" ? v : fallback;

  const hour = Number(r.reminder_hour);

  return {
    book_layout: pick(r.book_layout, LAYOUTS, DEFAULT_PREFERENCES.book_layout),
    verse_numbers: bool(r.verse_numbers, DEFAULT_PREFERENCES.verse_numbers),
    text_size: pick(r.text_size, SIZES, DEFAULT_PREFERENCES.text_size),
    reading_font: pick(r.reading_font, FONTS, DEFAULT_PREFERENCES.reading_font),
    line_spacing: pick(r.line_spacing, SPACINGS, DEFAULT_PREFERENCES.line_spacing),
    theme: pick(r.theme, THEMES, DEFAULT_PREFERENCES.theme),
    show_on_leaderboard: bool(
      r.show_on_leaderboard,
      DEFAULT_PREFERENCES.show_on_leaderboard
    ),
    share_reading_activity: bool(
      r.share_reading_activity,
      DEFAULT_PREFERENCES.share_reading_activity
    ),
    email_reminders: bool(r.email_reminders, DEFAULT_PREFERENCES.email_reminders),
    push_reminders: bool(r.push_reminders, DEFAULT_PREFERENCES.push_reminders),
    reminder_hour:
      Number.isFinite(hour) && hour >= 0 && hour <= 23
        ? Math.trunc(hour)
        : DEFAULT_PREFERENCES.reminder_hour
  };
}

/**
 * Validate one incoming preference. Returns the value to store, or a
 * reason to refuse it. The endpoint writes nothing it hasn't been through.
 */
export function validatePreference(
  key: string,
  value: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  switch (key) {
    // Not a preference so much as a fact: whether this person has been
    // shown the one-time pointer at this screen. Write-once, and only
    // ever to true.
    case "prefs_intro_seen":
      return value === true
        ? { ok: true, value: true }
        : { ok: false, error: "That can only be marked as seen." };
    case "book_layout":
      return LAYOUTS.includes(value as BookLayout)
        ? { ok: true, value }
        : { ok: false, error: "That isn't a book list style." };
    case "text_size":
      return SIZES.includes(value as TextSize)
        ? { ok: true, value }
        : { ok: false, error: "That isn't a text size." };
    case "reading_font":
      return FONTS.includes(value as ReadingFont)
        ? { ok: true, value }
        : { ok: false, error: "That isn't a font." };
    case "line_spacing":
      return SPACINGS.includes(value as LineSpacing)
        ? { ok: true, value }
        : { ok: false, error: "That isn't a line spacing." };
    case "theme":
      return THEMES.includes(value as Theme)
        ? { ok: true, value }
        : { ok: false, error: "That isn't a theme." };
    case "verse_numbers":
    case "show_on_leaderboard":
    case "share_reading_activity":
    case "email_reminders":
    case "push_reminders":
      return typeof value === "boolean"
        ? { ok: true, value }
        : { ok: false, error: "That setting is on or off." };
    case "reminder_hour": {
      const n = Number(value);
      return Number.isInteger(n) && n >= 0 && n <= 23
        ? { ok: true, value: n }
        : { ok: false, error: "Pick an hour of the day." };
    }
    default:
      return { ok: false, error: "That isn't a setting you can change here." };
  }
}
