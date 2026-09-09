"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Mark from "@/components/Mark";
import { friendlyError } from "@/lib/errors";
import { humanDate } from "@/lib/dates";
import { sermonTitle, type SermonBlock, type SermonStatus } from "@/lib/sermons";

type Props = {
  id: string;
  title: string;
  passage: string | null;
  status: SermonStatus;
  preachedOn: string | null;
  blocks: SermonBlock[];
};

/**
 * The page a sermon is preached from.
 *
 * Everything here follows from that one sentence. It is read standing up,
 * at arm's length, on a phone held in one hand or an iPad on a lectern,
 * by somebody who is talking at the same time. So:
 *
 *   - The body is Literata, large, with a generous measure and leading.
 *     It is set larger than anything else in the app, because everything
 *     else in the app is read at reading distance and this is not.
 *   - Scripture does not look like a note. Mid-sentence, the eye has to
 *     land on the words to be read aloud without hunting, so a scripture
 *     block carries a rule down its edge and the reference above it in
 *     mono, and nothing else in the body does.
 *   - Headings break the flow, hard.
 *   - There is nothing to press in the body. No inline edit, no drag
 *     handle, no delete. A fat finger mid-sermon cannot change anything,
 *     because there is nothing there to change.
 *
 * It honours the reader's text size setting, so a preacher who has
 * already told the app he wants scripture bigger does not have to say it
 * twice — the sizes below are multiples of the same --reading-size the
 * Bible reader uses.
 *
 * And it holds the screen awake. A phone that sleeps in the middle of a
 * sermon is the single worst thing this page could do; the Wake Lock API
 * is not everywhere, so it is tried and forgotten about where it isn't.
 */
export default function SermonReader({
  id,
  title,
  passage,
  status,
  preachedOn,
  blocks
}: Props) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ------------------------------------------------------------- wake lock
  //
  // Requested on mount and released on leave. Re-requested when the tab
  // comes back, because the browser drops the lock whenever the page is
  // hidden and does not hand it back on its own — without that, glancing
  // at a message mid-sermon would let the screen sleep for the rest of it.
  //
  // Every path is wrapped: Safari before 16.4 has no navigator.wakeLock at
  // all, and a browser that has it still rejects the request on a page
  // that is not visible. Neither is worth a word to the preacher.
  const lockRef = useRef<any>(null);

  useEffect(() => {
    const nav: any = typeof navigator !== "undefined" ? navigator : null;
    if (!nav?.wakeLock?.request) return;

    let dropped = false;

    const acquire = async () => {
      if (dropped || document.visibilityState !== "visible") return;
      try {
        lockRef.current = await nav.wakeLock.request("screen");
      } catch {
        /* refused, unsupported, or the page lost focus mid-request */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      dropped = true;
      document.removeEventListener("visibilitychange", onVisibility);
      try {
        lockRef.current?.release?.();
      } catch {
        /* already gone with the page */
      }
      lockRef.current = null;
    };
  }, []);

  // ------------------------------------------------------------- actions

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sermon/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(friendlyError(j.error));
        return;
      }
      router.refresh();
    } catch (e: any) {
      setError(friendlyError(e?.message));
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sermon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `${sermonTitle(title)} (copy)`,
          passage_ref: passage,
          blocks
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.id) {
        setError(friendlyError(j.error));
        return;
      }
      // Into the copy's editor: a duplicate exists to be changed.
      router.push(`/sermons/${j.id}/edit`);
    } catch (e: any) {
      setError(friendlyError(e?.message));
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function remove() {
    setMenuOpen(false);
    if (!window.confirm(`Delete "${sermonTitle(title)}"? This cannot be undone.`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/sermon/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(friendlyError(j.error));
        setBusy(false);
        return;
      }
      router.push("/sermons");
    } catch (e: any) {
      setError(friendlyError(e?.message));
      setBusy(false);
    }
  }

  const dateLine = preachedOn ? humanDate(preachedOn) : null;

  return (
    <article className="sermon-read">
      {/* The header. Printed too — see the print rules in globals.css —
          which is why the mark and the title live in one block rather
          than being assembled by the page around them. */}
      <header className="sermon-read-head">
        <div className="sermon-read-brand">
          <Mark size={20} />
          <span className="sermon-read-wordmark">Deep Waters</span>
        </div>

        <div className="sermon-read-menu no-print">
          <Link href="/sermons" className="sermon-read-back">
            Sermons
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Sermon actions"
            className="sermon-read-dots"
            disabled={busy}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="6" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="12" cy="18" r="1.7" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <button
                className="sermon-menu-scrim"
                aria-label="Close"
                onClick={() => setMenuOpen(false)}
              />
              <div role="menu" className="sermon-menu">
                <Link
                  role="menuitem"
                  href={`/sermons/${id}/edit`}
                  className="sermon-menu-item"
                >
                  Edit
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  className="sermon-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    window.print();
                  }}
                >
                  Share as PDF
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="sermon-menu-item"
                  onClick={duplicate}
                >
                  Duplicate
                </button>
                <button
                  role="menuitem"
                  type="button"
                  className="sermon-menu-item"
                  onClick={() =>
                    patch(
                      status === "preached"
                        ? { status: "draft" }
                        : {
                            status: "preached",
                            // Preaching it today is the overwhelmingly
                            // likely case, and a date already set is not
                            // overwritten.
                            ...(preachedOn
                              ? {}
                              : { preached_on: new Date().toISOString().slice(0, 10) })
                          }
                    )
                  }
                >
                  {status === "preached" ? "Mark as not preached" : "Mark as preached"}
                </button>
                <div className="sermon-menu-danger">
                  <button
                    role="menuitem"
                    type="button"
                    className="sermon-menu-item sermon-menu-item-danger"
                    onClick={remove}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      <h1 className="sermon-read-title">{sermonTitle(title)}</h1>
      {(passage || dateLine) && (
        <p className="sermon-read-meta">
          {[passage, dateLine].filter(Boolean).join("  ·  ")}
        </p>
      )}

      {error && <p className="mt-4 text-sm text-danger no-print">{error}</p>}

      {blocks.length === 0 ? (
        <div className="empty mt-10 no-print">
          <p>Nothing in this sermon yet.</p>
          <Link href={`/sermons/${id}/edit`} className="btn-secondary mt-4">
            Start writing
          </Link>
        </div>
      ) : (
        <div className="sermon-read-body">
          {blocks.map((b) => {
            if (b.kind === "heading") {
              return (
                <h2 key={b.id} className="sermon-read-heading">
                  {b.text}
                </h2>
              );
            }
            if (b.kind === "scripture") {
              return (
                <div key={b.id} className="sermon-read-scripture">
                  {b.reference && (
                    <p className="sermon-read-ref">{b.reference}</p>
                  )}
                  <p className="sermon-read-verse">{b.text}</p>
                </div>
              );
            }
            return (
              <p key={b.id} className="sermon-read-note">
                {b.text}
              </p>
            );
          })}
        </div>
      )}
    </article>
  );
}
