/**
 * Finding a verse on the page, all of it.
 *
 * A verse is a verse id, not a paragraph: poetry and quoted lines arrive
 * from API.Bible as their own paragraphs continuing the verse above them,
 * so one verse can be two, three or six `.dw-verse` fragments down the
 * page. lib/verseParse.ts gives every one of them the same `data-verse`.
 *
 * Everything that acts on a verse — highlighting, the note dot, the
 * selection mark, copy, share, Compare, the jump-to-verse mark — has to
 * ask for all of them. Asking with `querySelector` gets the first, which
 * is how a highlight on Matthew 4:4 used to paint "But Jesus told him,"
 * and stop before "People do not live by bread alone".
 *
 * These two functions are the only place that answer lives, so no caller
 * can accidentally go back to asking for one.
 */

/** Every fragment of one verse, in the order they appear on the page. */
export function verseFragments(
  root: ParentNode,
  verse: number
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(`[data-verse="${verse}"]`)
  );
}

/**
 * One verse as plain text, its fragments joined.
 *
 * The verse marker is dropped — a verse quoted into a message doesn't
 * carry its own number inside the sentence.
 */
export function verseTextOnPage(root: ParentNode, verse: number): string {
  const parts: string[] = [];
  for (const el of verseFragments(root, verse)) {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".v").forEach((n) => n.remove());
    const t = (clone.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t) parts.push(t);
  }
  return parts.join(" ");
}
