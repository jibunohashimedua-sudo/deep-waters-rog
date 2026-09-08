import { redirect } from "next/navigation";

/**
 * The cohort list is a view inside People now. The individual cohort
 * pages (/c/[slug], /cohorts/new, /cohorts/[slug]/manage) are untouched
 * — this only redirects the top-level list route.
 */
export default function CohortsRedirect() {
  redirect("/community?view=cohorts");
}
