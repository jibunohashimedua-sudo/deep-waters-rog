"use client";

/**
 * Whether there is a page of this app behind the current one.
 *
 * A back control has to answer one question before it can do anything:
 * did the reader get here from somewhere inside Deep Waters, or did they
 * arrive cold — a shared link, a notification, a home-screen shortcut,
 * a typed URL? Pop the history in the first case and you land where they
 * came from. Pop it in the second and you throw them out of the app.
 *
 * Next's App Router does not answer it. Its history entries carry a
 * route tree and an `__NA` flag, and `__NA` is set on the very first
 * entry too, so it cannot tell a cold arrival from a navigation.
 * `history.length` counts the whole tab, including every page the reader
 * visited before they ever opened this app.
 *
 * So we count our own. Module scope, not sessionStorage: it is per tab,
 * it dies with the tab, and — the point — a hard load resets it to zero,
 * which is exactly the cold arrival we are trying to detect. Same
 * reasoning as Nav's cachedNav.
 */

let navigations = 0;
let lastPath: string | null = null;

/** Called by RouteHistory on every route change. */
export function noteNavigation(pathname: string): void {
  if (lastPath === null) {
    lastPath = pathname;
    return;
  }
  if (lastPath !== pathname) {
    navigations += 1;
    lastPath = pathname;
  }
}

/** True when popping the history stays inside the app. */
export function canGoBackInApp(): boolean {
  return navigations > 0;
}

/**
 * Called when a back takes us up a level, so the counter stops claiming
 * there is something behind us that there isn't.
 */
export function noteBack(): void {
  if (navigations > 0) navigations -= 1;
}

/**
 * Called when a page is removed rather than left — a deleted sermon, a
 * deleted account. The entry it replaced is gone from the stack, so the
 * count must not keep offering it.
 */
export function noteReplace(): void {
  /* A replace swaps the current entry; the depth behind it is unchanged. */
}
