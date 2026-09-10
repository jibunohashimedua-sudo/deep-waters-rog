import type { Profile } from "@/lib/auth";

/**
 * The profile, handed from middleware to the render that follows it.
 *
 * Middleware already fetches the current user's profile on every protected
 * request — it has to, to know whether onboarding is finished and whether
 * this is the private member. Then the page fetched it again, and on
 * /today the page fetched it a third time. Three round trips to Supabase
 * for one row that had not changed in between.
 *
 * So middleware puts what it read onto the request it forwards, and the
 * render reads it from there. Same row, same request, same freshness —
 * middleware runs at the start of the very request the page renders.
 *
 * Trust: the value is only ever read from a header middleware sets, and
 * middleware deletes any inbound copy of that header before it does
 * anything else — including on the public-path early return, where it
 * never sets one. A client cannot put a profile here.
 *
 * Encoding is base64 because a name or a bio can hold any character and a
 * header field cannot.
 */
export const PROFILE_HEADER = "x-dw-profile";

/** What middleware sends when the account is signed in and has no profile
    row yet. Distinct from "middleware did not run", which is no header at
    all and means the reader falls back to asking Supabase itself. */
export const NO_PROFILE = "-";

export function encodeProfile(profile: unknown): string {
  return Buffer.from(JSON.stringify(profile), "utf8").toString("base64");
}

export type ForwardedProfile =
  | { kind: "profile"; profile: Profile }
  | { kind: "none" }
  | { kind: "absent" };

/** Read the forwarded profile off the current request's headers. */
export function forwardedProfile(headerValue: string | null): ForwardedProfile {
  if (!headerValue) return { kind: "absent" };
  if (headerValue === NO_PROFILE) return { kind: "none" };
  try {
    const json = Buffer.from(headerValue, "base64").toString("utf8");
    const profile = JSON.parse(json) as Profile;
    // A profile with no id is not a profile. Fall back rather than trust it.
    if (!profile || typeof profile.id !== "string") return { kind: "absent" };
    return { kind: "profile", profile };
  } catch {
    return { kind: "absent" };
  }
}
