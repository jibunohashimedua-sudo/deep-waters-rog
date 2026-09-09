"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { friendlyError } from "@/lib/errors";
import { SERMON_TITLE_MAX } from "@/lib/limits";

/**
 * Starts a sermon. It asks for a title and nothing else.
 *
 * It used to create an empty draft and drop you straight into the editor
 * with an "Untitled" at the top, which meant the list filled up with
 * sermons nobody could tell apart. A title is the one thing a sermon
 * cannot be identified without, and it is the one thing the preacher
 * already knows when they start.
 *
 * Scriptures come afterwards — from the editor's reference box or from
 * the Bench. Nothing here asks for a passage.
 *
 * Through /api/sermon rather than straight at the table, so the caps in
 * lib/limits.ts are the only thing that decides how big a sermon may be.
 */
export default function NewSermonButton({
  /** Rendered as a plain row rather than a button, for the Bench picker
      where it is the last item in a list. */
  variant = "button",
  label = "New sermon",
  /** When set, the new sermon is created and handed back rather than
      opened — the Bench needs it to add a verse and stay where it is. */
  onCreated
}: {
  variant?: "button" | "row";
  label?: string;
  onCreated?: (id: string, title: string) => void | Promise<void>;
} = {}) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focused only once the field has been asked for — a keyboard that
  // opens because a page loaded is a keyboard nobody asked for, but one
  // that opens when you have just pressed "New sermon" is the point.
  useEffect(() => {
    if (asking) inputRef.current?.focus();
  }, [asking]);

  async function create() {
    const name = title.trim();
    if (!name) {
      setErr("A sermon needs a title.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/sermon", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: name })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.id) {
        setErr(friendlyError(j.error));
        return;
      }
      if (onCreated) {
        await onCreated(j.id, name);
        setAsking(false);
        setTitle("");
        return;
      }
      // Straight into the editor: a sermon with a title and nothing in
      // it is a sermon somebody is about to write.
      router.push(`/sermons/${j.id}/edit`);
    } catch (e: any) {
      setErr(friendlyError(e?.message));
    } finally {
      setBusy(false);
    }
  }

  if (!asking) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setAsking(true)}
          className={variant === "row" ? "sermon-pick-new" : "btn-primary"}
        >
          {label}
        </button>
      </div>
    );
  }

  return (
    <div className="sermon-new">
      <label htmlFor="new-sermon-title" className="meta block">
        What is it called?
      </label>
      <div className="sermon-new-row mt-2">
        <input
          ref={inputRef}
          id="new-sermon-title"
          type="text"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={SERMON_TITLE_MAX}
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void create();
            }
            if (e.key === "Escape") {
              setAsking(false);
              setTitle("");
              setErr(null);
            }
          }}
          placeholder="Deep Calls to Deep"
          disabled={busy}
        />
        <button
          type="button"
          onClick={create}
          disabled={busy || !title.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          setAsking(false);
          setTitle("");
          setErr(null);
        }}
        className="meta mt-3"
      >
        Cancel
      </button>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
