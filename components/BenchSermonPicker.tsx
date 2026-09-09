"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { comparePickOrder, sermonTitle } from "@/lib/sermons";
import NewSermonButton from "./NewSermonButton";

type Row = {
  id: string;
  title: string | null;
  status: string | null;
  updated_at: string;
};

/**
 * Which sermon does this verse belong to?
 *
 * "To sermon" used to fire the verse at whichever draft had been touched
 * most recently, with no choice and no way to know where it had gone —
 * and if the only draft had been preached, it silently started a new one
 * named after the verse. Both of those were the same missing thing: a
 * preacher working on three sermons has an answer in mind, and the app
 * never asked.
 *
 * So it asks. Drafts first, most recently touched at the top, preached
 * ones below, and "New sermon" at the bottom for when the answer is none
 * of them. The rule about a preached sermon starting a fresh draft is
 * gone: it existed because there was no choice, and now there is.
 *
 * The list is a plain own-rows select — RLS is the whole guard on it, and
 * it names its columns so a sermon's whole body is not shipped to draw a
 * list of titles.
 */
export default function BenchSermonPicker({
  userId,
  onPick,
  onClose
}: {
  userId: string;
  /** Appends the verse. Resolves with nothing; the sheet closes and the
      caller confirms by name. */
  onPick: (sermon: { id: string; title: string }) => void | Promise<void>;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data, error: err } = await supabase
        .from("sermons")
        .select("id, title, status, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      if (err) {
        setError(friendlyError(err.message));
        setRows([]);
        return;
      }
      setRows([...((data ?? []) as Row[])].sort(comparePickOrder));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="sermon-pick-layer">
      <button
        aria-label="Close"
        onClick={onClose}
        className="sheet-backdrop absolute inset-0"
      />
      <div role="dialog" aria-modal="true" aria-label="Add to a sermon" className="sermon-pick">
        <p className="meta sermon-pick-head">Add to a sermon</p>

        {rows === null ? (
          <p className="sermon-pick-empty">Looking…</p>
        ) : rows.length === 0 ? (
          <p className="sermon-pick-empty">No sermons yet.</p>
        ) : (
          <ul className="sermon-pick-list">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="sermon-pick-item"
                  onClick={() => onPick({ id: r.id, title: sermonTitle(r.title) })}
                >
                  <span className="sermon-pick-title">{sermonTitle(r.title)}</span>
                  {r.status === "preached" && (
                    <span className="meta sermon-pick-status">Preached</span>
                  )}
                  {r.status === "archived" && (
                    <span className="meta sermon-pick-status">Archived</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="sermon-pick-empty text-danger">{error}</p>}

        <div className="sermon-pick-foot">
          <NewSermonButton
            variant="row"
            label="New sermon"
            onCreated={(id, title) => onPick({ id, title })}
          />
        </div>
      </div>
    </div>
  );
}
