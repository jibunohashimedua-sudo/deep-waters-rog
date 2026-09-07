import { redirect } from "next/navigation";

/**
 * Prayer used to be its own tab. It now lives as the second view inside
 * the Community tab, but every link, bookmark and notification that
 * already points at /prayer keeps working — it lands on the prayer wall.
 */
export default function PrayerRedirect() {
  redirect("/community?view=prayer");
}
