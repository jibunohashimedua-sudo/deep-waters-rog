import { readPreferences } from "@/lib/preferences";

/**
 * The reader's type settings, as attributes for the reading surface.
 *
 * Spread onto the `<main>` of a reading route on the server, so the
 * chapter paints at the right size in the first frame. PreferencesApply
 * puts the same values on the document for everywhere else, but that
 * runs after a profile query comes back, and a page of scripture
 * changing size a moment after it appears is the one place that would
 * actually be felt.
 */
export function readingAttrs(
  profile: Record<string, unknown> | null | undefined
): Record<string, string> {
  const p = readPreferences(profile);
  return {
    "data-text-size": p.text_size,
    "data-line-spacing": p.line_spacing,
    "data-reading-font": p.reading_font,
    "data-verse-numbers": p.verse_numbers ? "on" : "off"
  };
}
