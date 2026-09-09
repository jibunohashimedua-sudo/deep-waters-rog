"use client";
import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { friendlyError } from "@/lib/errors";
import { CARE_NOTE_MAX } from "@/lib/limits";
import {
  reasonFor,
  quietFor,
  shortDate,
  stamp,
  type CareEntry,
  type CheckOnRow,
  type PulsePerson
} from "@/lib/pulse";

/**
 * "Check on these" — the point of the page — and the sheet behind a name.
 *
 * The list is handed down from the server already ordered and already
 * limited. Nothing here re-sorts it and nothing here counts anything: a
 * row carries a name and one plain reason, and the reason was a
 * subtraction in SQL before it was a sentence in lib/pulse.ts.
 *
 * The sheet loads on open rather than up front, because a pastor opens
 * one or two of these, not forty.
 */
export default function PulseCheckOn({ rows }: { rows: CheckOnRow[] }) {
  const [open, setOpen] = useState<CheckOnRow | null>(null);

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-body">Nobody has gone quiet.</p>
        <p className="empty-hint">
          When someone has not been seen for a few days, their name will be
          here with the reason beside it.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="pulse-rows mt-4">
        {rows.map((r) => (
          <button
            key={r.user_id}
            type="button"
            onClick={() => setOpen(r)}
            className="pulse-row"
          >
            <Avatar name={r.name} photoUrl={r.photo_url} size="md" decorative className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="pulse-row-name">{r.name}</span>
              <span className="pulse-row-reason">{reasonFor(r)}</span>
            </span>
          </button>
        ))}
      </div>

      <PersonSheet row={open} onClose={() => setOpen(null)} />
    </>
  );
}

/**
 * One person: last read, quiet for, cohort, their leader, and the care
 * log. Activity and membership — never a word they wrote anywhere
 * private.
 */
function PersonSheet({ row, onClose }: { row: CheckOnRow | null; onClose: () => void }) {
  const open = row !== null;
  const [person, setPerson] = useState<PulsePerson | null>(null);
  const [log, setLog] = useState<CareEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState("");

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const userId = row?.user_id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setPerson(null);
    setLog([]);
    setError(null);
    setComposing(false);
    setDraft("");
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/pulse/care?user=${encodeURIComponent(userId)}`);
        const j = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(friendlyError(j.error));
        } else {
          setPerson(j.person);
          setLog(j.log ?? []);
        }
      } catch (err: any) {
        if (!cancelled) setError(friendlyError(err?.message));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const write = useCallback(
    async (kind: "reached_out" | "note", body?: string) => {
      if (!userId) return;
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/pulse/care", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ subject_user_id: userId, kind, body })
        });
        const j = await res.json();
        if (!res.ok) {
          setError(friendlyError(j.error));
          return false;
        }
        // Straight into the log, so what you just did is visible before
        // anything else has to happen.
        setLog((prev) => [j.entry as CareEntry, ...prev]);
        return true;
      } catch (err: any) {
        setError(friendlyError(err?.message));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={row ? `Care for ${row.name}` : "Care"}
        className={`bottom-glass absolute left-0 right-0 bottom-0 md:mx-auto md:max-w-md rounded-t-[28px] max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
      >
        <div className="pt-2 pb-2 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        {row && (
          <div className="px-5 pb-5">
            <div className="flex items-center gap-3">
              <Avatar name={row.name} photoUrl={row.photo_url} size="lg" decorative className="shrink-0" />
              <div className="min-w-0">
                <h2 className="text-[19px] font-medium text-rog-ink leading-tight truncate">
                  {row.name}
                </h2>
                <p className="meta mt-1">{reasonFor(row)}</p>
              </div>
            </div>

            <div className="pulse-facts mt-5">
              <div className="pulse-fact">
                <span className="meta">Last read</span>
                <span className="pulse-fact-value">
                  {loading ? "—" : shortDate(person?.last_read_at ?? null)}
                </span>
              </div>
              <div className="pulse-fact">
                <span className="meta">Quiet for</span>
                <span className="pulse-fact-value">
                  {loading ? "—" : quietFor(person?.days_quiet ?? row.days_quiet)}
                </span>
              </div>
              <div className="pulse-fact">
                <span className="meta">Cohort</span>
                <span className="pulse-fact-value">
                  {loading ? "—" : person?.cohort_name || "None"}
                </span>
              </div>
              <div className="pulse-fact">
                <span className="meta">Their leader</span>
                <span className="pulse-fact-value">
                  {loading ? "—" : person?.leader_name || "None"}
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => write("reached_out")}
                className="btn-primary flex-1 disabled:opacity-50"
              >
                Mark reached out
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setComposing((c) => !c)}
                className="btn-secondary flex-1 disabled:opacity-50"
              >
                {composing ? "Cancel note" : "Add a note"}
              </button>
            </div>

            {composing && (
              <div className="mt-4">
                <label htmlFor="dw-care-note" className="block text-sm font-medium text-rog-ink">
                  Note
                </label>
                <p className="mt-1 mb-2 text-xs text-rog-muted">
                  Seen by pastoral users only. Never by {row.name}.
                </p>
                <textarea
                  id="dw-care-note"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, CARE_NOTE_MAX))}
                  rows={4}
                  enterKeyHint="done"
                  placeholder="What was said, and what is next."
                  className="w-full border border-rog-line bg-white px-4 py-3 text-[15px] leading-relaxed focus:border-rog-purple focus:outline-none"
                />
                <button
                  type="button"
                  disabled={saving || !draft.trim()}
                  onClick={async () => {
                    const ok = await write("note", draft.trim());
                    if (ok) {
                      setDraft("");
                      setComposing(false);
                    }
                  }}
                  className="btn-primary w-full mt-3 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save note"}
                </button>
              </div>
            )}

            {/* No red on this page — see .pulse-notice. */}
            {error && <p className="pulse-notice">{error}</p>}

            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Care log</h2>
            {loading ? (
              <div className="mt-3" aria-busy="true">
                <div className="skeleton h-3 w-40" />
                <div className="skeleton h-3 w-56 mt-2" />
              </div>
            ) : log.length === 0 ? (
              <p className="mt-2 text-sm text-rog-muted">
                Nothing yet. The first person to reach out writes the first line.
              </p>
            ) : (
              <div className="mt-2">
                {log.map((e) => (
                  <div key={e.id} className="pulse-care-entry">
                    <p className="meta meta-strong">
                      {`${e.author_name}, ${stamp(e.created_at)}`}
                    </p>
                    {e.body && <p className="pulse-care-body">{e.body}</p>}
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={onClose} className="btn-secondary w-full mt-6">
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
