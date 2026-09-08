import { redirect } from "next/navigation";

/**
 * The finisher wall is a view inside People now. This route stays alive
 * so old links, notifications and home-screen shortcuts keep working.
 */
export default function FinishersRedirect() {
  redirect("/community?view=finishers");
}
