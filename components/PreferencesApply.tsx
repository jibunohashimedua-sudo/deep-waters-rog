"use client";
import { useEffect } from "react";
import { readBookLayout, writeBookLayout } from "@/lib/bookLayout";
import { DEFAULT_PREFERENCES, type Preferences } from "@/lib/preferences";
import { PREFS_KEY } from "@/lib/offline/session";

/**
 * Carry a setting the browser already held up into the database, once.
 *
 * Fire and forget, and guarded so a page that re-renders doesn't send it
 * twice. If it fails the browser keeps its value and the next load tries
 * again, which is the right way round: the reader's choice survives, and
 * the worst case is that it stays local a little longer.
 */
const adopted = new Set<string>();
function adoptOnce(key: string, value: string) {
  if (adopted.has(key)) return;
  adopted.add(key);
  void fetch("/api/preferences", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value })
  }).catch(() => adopted.delete(key));
}

/**
 * Puts a person's preferences onto the page, wherever they are signed in.
 *
 * The reading routes already set the type settings on the server, so the
 * screen that matters paints right the first time. This is for everywhere
 * else, and for the case the server can't cover: a member who changed a
 * setting on their phone and then opened the app on an iPad, where the
 * browser's own copy is stale or missing.
 *
 * It also reconciles the two settings that are cached in the browser.
 * The theme has to be in localStorage because the script in the document
 * head reads it before React exists — that is what stops a dark-mode
 * reader getting a white flash on every page load — and the book list is
 * read on first paint for the same reason. The database is the truth;
 * this is the moment the cache is told.
 *
 * Renders nothing.
 */
export default function PreferencesApply({ prefs }: { prefs: Preferences }) {
  useEffect(() => {
    const el = document.documentElement;
    el.dataset.textSize = prefs.text_size;
    el.dataset.lineSpacing = prefs.line_spacing;
    el.dataset.readingFont = prefs.reading_font;
    el.dataset.verseNumbers = prefs.verse_numbers ? "on" : "off";
  }, [prefs.text_size, prefs.line_spacing, prefs.reading_font, prefs.verse_numbers]);

  // The mirror the head script reads before paint, so these four survive a
  // journey with no signal. Written on every render the server has given us
  // a profile for, which is every signed-in page — so the copy is refreshed
  // whenever the database has had a chance to speak, and is stale by exactly
  // as long as the reader has been offline.
  //
  // Written after the effect above rather than instead of it: this is the
  // *next* load's problem being solved, and this load is already correct.
  useEffect(() => {
    try {
      localStorage.setItem(
        PREFS_KEY,
        JSON.stringify({
          text_size: prefs.text_size,
          line_spacing: prefs.line_spacing,
          reading_font: prefs.reading_font,
          verse_numbers: prefs.verse_numbers,
          book_layout: prefs.book_layout,
          theme: prefs.theme
        })
      );
    } catch {
      // Private mode, or a full disk. The app is correct on this load and
      // will be correct on the next one too as long as there is a network.
    }
  }, [
    prefs.text_size,
    prefs.line_spacing,
    prefs.reading_font,
    prefs.verse_numbers,
    prefs.book_layout,
    prefs.theme
  ]);

  useEffect(() => {
    const cached = readBookLayout();
    // The database is the truth, with one exception: the day it is still
    // at its default, it has never been set, and a choice already in the
    // browser is older and realer than a default. See adoptOnce below.
    if (cached !== prefs.book_layout && prefs.book_layout === DEFAULT_PREFERENCES.book_layout) {
      adoptOnce("book_layout", cached);
      return;
    }
    writeBookLayout(prefs.book_layout);
  }, [prefs.book_layout]);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      // Private mode. The theme still applies below; it just won't be
      // remembered before the next paint.
    }
    const cached: Preferences["theme"] =
      stored === "dark" || stored === "light" ? stored : "system";
    if (cached === prefs.theme) return;

    // A theme chosen before the database had a column for it.
    //
    // Everyone who was using the app before this screen existed has their
    // theme in the browser and nowhere else, and every one of their
    // profiles now says "system" because that is the column default.
    // Letting the database win here would flip every dark-mode reader
    // back to following their phone the next time they opened the app —
    // a setting they chose, silently undone by a migration.
    //
    // So when the database is still at the default and the browser holds
    // a real choice, the choice wins and is written up. It is only ever
    // the default that gets overruled: someone who has actually picked
    // "follow device" on this screen has no stored value to conflict
    // with, because picking it clears the key.
    if (prefs.theme === DEFAULT_PREFERENCES.theme && cached !== "system") {
      adoptOnce("theme", cached);
      return;
    }

    try {
      if (prefs.theme === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", prefs.theme);
    } catch {
      /* see above */
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.dataset.theme =
      prefs.theme === "system" ? (prefersDark ? "dark" : "light") : prefs.theme;
  }, [prefs.theme]);

  // "Follow device" has to keep following it. Without this, choosing
  // system and then walking into the evening leaves the app in whichever
  // mode it happened to be in when the page loaded.
  useEffect(() => {
    if (prefs.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      document.documentElement.dataset.theme = e.matches ? "dark" : "light";
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [prefs.theme]);

  return null;
}
