"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { isReadingRoute } from "@/lib/routes";
import { usePathname } from "next/navigation";

/** Remembered in the browser as well as on the profile. The write to the
    profile is what makes it stick across devices; this is what stops it
    reappearing on the next page load if that write fails, or if the
    column hasn't been migrated yet. Either way: shown once. */
const SEEN_KEY = "dw:prefsIntroSeen";

/**
 * One quiet pointer at Preferences, for people who were already here.
 *
 * Somebody who has been reading for six weeks will not go looking for a
 * screen that did not exist yesterday, so they are told once. Once is the
 * whole design:
 *
 *   - It is a strip at the foot of the screen, not a modal. Nothing is
 *     behind it, nothing is waiting on it, and the reading carries on
 *     underneath.
 *   - It never appears on a reading screen. A page of scripture is the
 *     one place in this app that gets to be only itself.
 *   - Dismissing it and following it both count as done. It is written to
 *     the profile, so it is done on every device, and to the browser, so
 *     it is done even if that write fails.
 */
export default function PreferencesNudge({ onDone }: { onDone: () => void }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);

  // Mounted hidden and revealed after a beat: arriving in the same frame
  // as the page makes it feel like part of the page, which is exactly
  // what it is not.
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(SEEN_KEY) === "1";
    } catch {
      /* private mode — the profile flag still carries it */
    }
    if (dismissed) {
      onDone();
      return;
    }
    const id = window.setTimeout(() => setHidden(false), 1200);
    return () => window.clearTimeout(id);
  }, [onDone]);

  function done() {
    setHidden(true);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* see above */
    }
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "prefs_intro_seen", value: true }),
      keepalive: true
    }).catch(() => {
      // The browser already remembers. Nothing to tell anybody.
    });
    onDone();
  }

  if (hidden || isReadingRoute(pathname)) return null;

  return (
    <div className="prefs-nudge" role="status">
      <p className="prefs-nudge-text">
        You can choose the name people see you by, and how scripture is set
        on the page.
      </p>
      <div className="prefs-nudge-actions">
        <Link href="/preferences" onClick={done} className="prefs-nudge-go">
          Open Preferences
        </Link>
        <button type="button" onClick={done} className="prefs-nudge-dismiss">
          Not now
        </button>
      </div>
    </div>
  );
}
