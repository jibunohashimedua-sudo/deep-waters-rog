"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";

export type NoteRow = {
  id: string;
  book: string;
  /** "PSALM 42:7" — already uppercased for the mono line. */
  reference: string;
  /** What the reader wrote. */
  body: string;
  /** ISO date it was first written — an edit is a note whose updated_at
      has moved past this. */
  createdAt: string;
  /** ISO date of the last edit. */
  updatedAt: string;
  /** Opens the chapter at the verse. */
  href: string;
};

const PAGE = 40;

/** How long a delete stays armed before it disarms itself. */
const ARM_MS = 4000;

/**
 * Every note you have written, newest first.
 *
 * The same treatment as the highlights list — hairline-separated rows, the
 * reference in mono, the date in mono — with one difference that matters:
 * the body is set in the interface sans, not the reading serif, because a
 * note is something you wrote and the serif is reserved for scripture.
 *
 * Notes are private. They are never surfaced to the community, and the RLS
 * on verse_notes is select/insert/update/delete on auth.uid() = user_id, so
 * that is enforced at the database and not only by this page asking nicely.
 */
export default function NotesView({ rows }: { rows: NoteRow[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // A note can be changed and it can be let go of, here as well as in the
  // reader. Local copies of the rows so an edit shows immediately; the
  // server page is the source of truth on the next visit.
  const [local, setLocal] = useState<Record<string, { body: string; updatedAt: string }>>({});
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  async function saveEdit(id: string) {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/verse-note", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, body })
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setErr(friendlyError(j.error));
      return;
    }
    setLocal((prev) => ({ ...prev, [id]: { body, updatedAt: new Date().toISOString() } }));
    setEditing(null);
    setDraft("");
  }

  async function remove(id: string) {
    setBusy(true);
    setErr(null);
    const { error } = await supabase.from("verse_notes").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setErr(friendlyError(error.message));
      return;
    }
    setGone((prev) => new Set(prev).add(id));
    if (editing === id) {
      setEditing(null);
      setDraft("");
    }
  }

  const shown = useMemo(
    () =>
      rows
        .filter((r) => !gone.has(r.id))
        .map((r) =>
          local[r.id] ? { ...r, body: local[r.id].body, updatedAt: local[r.id].updatedAt } : r
        ),
    [rows, gone, local]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shown;
    return shown.filter(
      (r) =>
        r.body.toLowerCase().includes(q) || r.reference.toLowerCase().includes(q)
    );
  }, [shown, query]);

  useEffect(() => setVisible(PAGE), [query]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible((v) => (v >= filtered.length ? v : v + PAGE));
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  if (shown.length === 0) {
    return (
      <div className="mt-10">
        <p className="font-serif text-[19px] leading-[1.6] text-rog-ink">
          No notes yet.
        </p>
        <p className="mt-3 text-[13.5px] leading-5 text-rog-muted max-w-[34rem]">
          While you&rsquo;re reading, tap a verse and choose Note. What you
          write stays private to you.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <label htmlFor="note-search" className="sr-only">
        Search your notes
      </label>
      <input
        id="note-search"
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search"
        className="chip !min-h-[44px] w-full px-4 !text-[13.5px] border"
      />

      <p className="kicker mt-5">
        {filtered.length} {filtered.length === 1 ? "note" : "notes"}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-8 font-serif text-[17px] text-rog-muted">
          Nothing here matches that.
        </p>
      ) : (
        <ul className="mark-list mt-5">
          {filtered.slice(0, visible).map((r) => {
            const edited =
              new Date(r.updatedAt).getTime() - new Date(r.createdAt).getTime() > 1500;
            return (
              <li key={r.id} className="mark-row">
                {editing === r.id ? (
                  <>
                    <span className="kicker kicker-strong block">{r.reference}</span>
                    <label htmlFor={`note-edit-${r.id}`} className="sr-only">
                      Your note
                    </label>
                    <textarea
                      id={`note-edit-${r.id}`}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                      enterKeyHint="done"
                      className="bench-textarea"
                    />
                    <div className="bench-row-actions">
                      <button
                        type="button"
                        className="bench-act"
                        onClick={() => {
                          setEditing(null);
                          setDraft("");
                        }}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="bench-act"
                        onClick={() => saveEdit(r.id)}
                        disabled={busy || !draft.trim()}
                      >
                        Update note
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link href={r.href} className="block">
                      <span className="kicker kicker-strong block">{r.reference}</span>
                      <span className="mark-note selectable block mt-2">{r.body}</span>
                      <span className="kicker block mt-2">
                        {edited ? "Edited " : ""}
                        {new Date(r.updatedAt).toLocaleDateString("en-GB")}
                      </span>
                    </Link>
                    <div className="bench-row-actions">
                      <button
                        type="button"
                        className="bench-act"
                        onClick={() => {
                          setArmed(null);
                          setEditing(r.id);
                          setDraft(r.body);
                        }}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="bench-act"
                        data-danger={armed === r.id ? "true" : undefined}
                        onClick={() => {
                          if (armed === r.id) remove(r.id);
                          else setArmed(r.id);
                        }}
                        disabled={busy}
                      >
                        {armed === r.id ? "Tap again to delete" : "Delete"}
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {err && <p className="mt-4 text-xs text-danger">{err}</p>}

      <div ref={sentinel} aria-hidden className="h-px" />
    </div>
  );
}
