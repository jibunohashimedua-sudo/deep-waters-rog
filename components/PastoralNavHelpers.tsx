/**
 * Which routes belong to More, for a pastoral reader.
 *
 * This file exists so that these two strings live somewhere a member's
 * bundle never reaches. `moreMatches()` in lib/nav.tsx is imported by both
 * Nav and BottomNav, so anything named in it is in a chunk loaded on every
 * signed-in page — which is how "/sermons" came to be readable in the
 * bundle of someone who cannot open it. ELITE_EXCELLENCE_AUDIT P2-J.
 *
 * The only importer is MoreSheetPastoralRows, which is itself behind a
 * next/dynamic boundary that mounts only when the flag is true. A member
 * never requests the chunk, so a member never receives these names.
 */

/** The route prefixes that light the More tab for a pastoral reader. */
export function pastoralRoutePatterns(): string[] {
  return ["/pulse", "/sermons"];
}

/** True when this path is one of More's pastoral rows. */
export function matchesPastoralMoreRoute(pathname: string): boolean {
  return pastoralRoutePatterns().some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
