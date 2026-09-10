"use client";
import { kvGet, kvSet } from "./db";
import { readPreferences, type Preferences } from "@/lib/preferences";
import { DEFAULT_BIBLE_ID } from "@/lib/translations";

/**
 * The few facts about the reader the offline screens cannot work without.
 *
 * Deliberately a short list, and deliberately not "the profile row". A
 * profile carries an email address, a role, a bio, a photo URL and whatever
 * else a migration adds next; none of that is needed to draw a chapter, and
 * storing a whole row on a phone because four fields of it were useful is
 * how a store ends up holding more than anybody meant it to.
 *
 * What is here, and why each one:
 *
 *   start_date  — the plan's day number is a function of it. Without it the
 *                 offline day view cannot say which day is today, and the
 *                 reading screen cannot tell "recording this" from "reading
 *                 ahead, which is not mine to record".
 *   preferred_bible_id — which translation to look for in the chapter store.
 *   preferences — text size, spacing, font, verse numbers, so scripture is
 *                 the right size in a tunnel. Same set the head script
 *                 mirrors into localStorage; kept here too so the offline
 *                 screens can read them without parsing that.
 *   name        — the greeting on the day view, and nothing else.
 *
 * Refreshed on every signed-in page, because Nav has the row already. Never
 * fetched for its own sake.
 */

const KEY = "me";

export type CachedMe = {
  userId: string;
  name: string;
  startDate: string | null;
  bibleId: string;
  isPastoral: boolean;
  prefs: Preferences;
  at: number;
};

export async function rememberMe(
  userId: string,
  profile: Record<string, unknown> | null | undefined
): Promise<void> {
  if (!profile) return;
  await kvSet<CachedMe>(KEY, {
    userId,
    name: typeof profile.name === "string" ? profile.name : "",
    startDate: typeof profile.start_date === "string" ? profile.start_date : null,
    bibleId:
      typeof profile.preferred_bible_id === "string" && profile.preferred_bible_id
        ? profile.preferred_bible_id
        : DEFAULT_BIBLE_ID,
    isPastoral: profile.is_pastoral === true,
    prefs: readPreferences(profile),
    at: Date.now()
  });
}

export async function cachedMe(): Promise<CachedMe | null> {
  return kvGet<CachedMe>(KEY);
}
