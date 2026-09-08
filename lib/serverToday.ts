import { cookies } from "next/headers";
import { todayISOForUser } from "./dates";

/**
 * "Today", in the current viewer's timezone, from a server component or
 * an API route. Reads the `dw_tz` cookie set by the tiny inline script
 * in `app/layout.tsx`. Falls back to UTC when the cookie is missing —
 * that's how the first paint of a fresh session behaves, and the /today
 * banner (see `TimezoneNotice`) tells the reader about a possible ± 1 day
 * shift and links to `/me/edit` to fix their start date if needed.
 */
export function todayForCurrentRequest(): string {
  const tz = cookies().get("dw_tz")?.value ?? null;
  return todayISOForUser(tz);
}

/** The cookie value directly, if the caller wants to thread it through. */
export function tzForCurrentRequest(): string | null {
  return cookies().get("dw_tz")?.value ?? null;
}
