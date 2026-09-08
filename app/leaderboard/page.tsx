import { redirect } from "next/navigation";

/**
 * The Leaderboard is a view inside People now — same page as the feed and
 * the finisher wall. This route stays alive rather than 404ing because it
 * is in people's history, in old links, and on anything anyone has added
 * to their home screen.
 */
export default function LeaderboardRedirect() {
  redirect("/community?view=leaderboard");
}
