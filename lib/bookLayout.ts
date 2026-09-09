/**
 * How the Bible tab lists its books.
 *
 * Two ways, and people genuinely want different ones. A single list is
 * how most Bible apps do it and how most people picture the Bible —
 * Genesis at the top, Revelation at the bottom, one scroll. Grouping by
 * section (Law, History, Poetry, the Gospels…) is how the Bible is
 * taught, and someone who learned it that way finds Habakkuk faster in a
 * list of twelve Minor Prophets than in a run of sixty-six.
 *
 * The single list is the default because it needs no prior knowledge.
 * The choice is kept here, in the browser, so the preferences screen can
 * set it without a round trip and without a column on the profile.
 */

export type BookLayout = "list" | "grouped";

export const DEFAULT_BOOK_LAYOUT: BookLayout = "list";

const KEY = "dw:bookLayout";

export function readBookLayout(): BookLayout {
  if (typeof localStorage === "undefined") return DEFAULT_BOOK_LAYOUT;
  try {
    const v = localStorage.getItem(KEY);
    return v === "grouped" || v === "list" ? v : DEFAULT_BOOK_LAYOUT;
  } catch {
    // Private mode, blocked storage, a value someone else wrote — none of
    // which is worth failing the Bible tab over.
    return DEFAULT_BOOK_LAYOUT;
  }
}

export function writeBookLayout(layout: BookLayout): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, layout);
  } catch {
    /* see readBookLayout */
  }
}
