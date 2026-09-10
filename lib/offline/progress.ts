"use client";
import { kvGet, kvSet } from "./db";

/**
 * Chapters recorded as read while there was no signal.
 *
 * A small, deliberately dumb list. It exists so the offline day view can
 * show the reader what they have just done — walk four chapters on the tube
 * and the day should say four, not nothing — and so the reading screen can
 * show "Read" on a chapter it recorded a moment ago.
 *
 * It is a *display* copy, not a second source of truth. The real record is
 * the row in chapter_reads that the queue is on its way to write, and the
 * moment the server has been told, the server's answer is what every screen
 * uses. Nothing here is ever counted towards a streak, a badge or a
 * leaderboard; those are the database's business and they stay there.
 */

const KEY = "progress:reads";

export type LocalRead = { day_number: number; book: string; chapter: number; at: number };

const idOf = (r: { day_number: number; book: string; chapter: number }) =>
  `${r.day_number}|${r.book}|${r.chapter}`;

export async function localReads(): Promise<LocalRead[]> {
  return (await kvGet<LocalRead[]>(KEY)) ?? [];
}

/** Note one. Writing the same chapter twice leaves one, which is the same
    thing the unique constraint on the table does. */
export async function noteLocalRead(
  read: Omit<LocalRead, "at">
): Promise<void> {
  const all = await localReads();
  if (all.some((r) => idOf(r) === idOf(read))) return;
  await kvSet(KEY, [...all, { ...read, at: Date.now() }]);
}

export async function hasLocalRead(
  read: Omit<LocalRead, "at">
): Promise<boolean> {
  return (await localReads()).some((r) => idOf(r) === idOf(read));
}

/** How many chapters of one day are noted here. The offline day view adds
    this to whatever the last server answer said. */
export async function localReadsForDay(day: number): Promise<LocalRead[]> {
  return (await localReads()).filter((r) => r.day_number === day);
}
