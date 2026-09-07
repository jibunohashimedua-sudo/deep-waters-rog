/**
 * Translate any error string into human copy that helps.
 *
 * Deep Waters never shows the user database-speak (Supabase RLS
 * violations, PostgREST errors, raw Fetch messages). Every user-
 * facing error passes through here and comes out as a short line
 * that says what happened and what to do.
 */
export function friendlyError(msg?: string | null): string {
  if (msg) {
    // Keep the raw message accessible in the dev console for debugging.
    // eslint-disable-next-line no-console
    console.warn("[deep-waters] raw error:", msg);
  }
  const lower = (msg ?? "").toLowerCase();

  if (!msg) {
    return "Something didn't work. Try again in a moment.";
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed")
  ) {
    return "Can't reach the app right now. Check your connection.";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Too many tries in a moment. Wait a bit and try again.";
  }
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("jwt")
  ) {
    return "That didn't go through. Sign out and back in, then try again.";
  }
  if (lower.includes("invalid email") || lower.includes("valid email")) {
    return "That email didn't look right. Check it and try again.";
  }
  if (lower.includes("email") && lower.includes("not found")) {
    return "We don't have an account for that email. Sign up first.";
  }

  return "Something didn't work. Try again in a moment.";
}
