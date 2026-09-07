import { redirect } from "next/navigation";

/**
 * /me was the profile. Depth is the profile now — it always held the
 * progress, the badges and the history, and it now holds the highlights and
 * the notes as well, so having two names for it only meant two half-pages.
 *
 * The route stays alive rather than 404ing: it is in people's history, in
 * old links, and on anything anyone has added to their home screen.
 */
export default function MePage() {
  redirect("/depth");
}
