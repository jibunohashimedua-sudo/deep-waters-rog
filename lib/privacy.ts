/**
 * The private member's shape of the app.
 *
 * A private member keeps Today, Bible, Deep Waters Elite / the Bench, his
 * own notes and his Me page. Community, the prayer board, the leaderboard,
 * the finisher wall, cohorts, the testimony form and Church Pulse are not
 * locked for him — they are not there. No greyed row, no teaser, no "you
 * do not have access". Posting into a feed that nobody can read is worse
 * than not having the feed at all.
 *
 * Church pulse is in this list for the same reason as the rest: it is a
 * screen about the congregation, and a private member is not staff. He
 * keeps the Elite study layer, which is what the flag is for here.
 *
 * This module has no imports on purpose. It is read by the middleware
 * (which turns him away at the door), by the navigation (which never
 * draws the door) and by the server pages — one list, so the three can
 * never disagree, and nothing in it that the edge runtime cannot load.
 */

export const PRIVATE_MEMBER_BLOCKED_PREFIXES = [
  "/community",
  "/prayer",
  "/leaderboard",
  "/finishers",
  "/cohorts",
  "/c",
  "/testimonials",
  "/pulse"
];

export function isBlockedForPrivateMember(pathname: string): boolean {
  return PRIVATE_MEMBER_BLOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
