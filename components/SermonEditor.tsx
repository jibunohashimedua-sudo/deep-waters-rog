"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import type { SermonBlock } from "@/lib/sermons";

type Props = {
  id: string;
  initialTitle: string;
  initialPassage: string;
  initialBlocks: SermonBlock[];
  initialStatus: string;
  initialPreachedOn: string;
};

/** How long a delete stays armed. Same promise the Bench's notes make. */
const ARM_MS = 4000;

/**
 * One sermon: a title, a passage, and an ordered list of blocks.
 *
 * Deliberately small. No export, no sharing, no collaborators, no rich text
 * — a sermon in this app is a place to put what you found while you were
 * reading, and everything past that is a different piece of work.
 */
export default function SermonEditor({
  id,
  initialTitle,
  initialPassage,
  initialBlocks,
  initialStatus,
  initialPreachedOn
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(initialTitle);
  const [passage, setPassage] = useState(initialPassage);
  const [blocks, setBlocks] = useState<SermonBlock[]>(initialBlocks);
  const [status, setStatus] = useState(initialStatus);
  const [preachedOn, setPreachedOn] = useState(initialPreachedOn);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [armedSermon, setArmedSermon] = useState(false);

  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);

  useEffect(() => {
    if (!armedSermon) return;
    const t = window.setTimeout(() => setArmedSermon(false), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armedSermon]);

  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    []
  );

  const save = useCallback(async () => {
    setState("saving");
    setErr(null);
    const { error } = await supabase
      .from("sermons")
      .update({
        title,
        passage_ref: passage.trim() || null,
        blocks,
        status,
        preached_on: preachedOn.trim() || null
      })
      .eq("id", id);
    if (error) {
      setState("idle");
      setErr(friendlyError(error.message));
      return;
    }
    setState("saved");
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setState("idle"), 2200);
    router.refresh();
  }, [supabase, id, title, passage, blocks, status, preachedOn, router]);

  async function deleteSermon() {
    const { error } = await supabase.from("sermons").delete().eq("id", id);
    if (error) {
      setErr(friendlyError(error.message));
      return;
    }
    router.push("/sermons");
  }

  function move(i: number, to: number) {
    setBlocks((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[to]] = [next[to], next[i]];
      return next;
    });
  }

  return (
    <>
      <p className="kicker">Elite · Sermon</p>

      <label htmlFor="sermon-title" className="sr-only">
        Title
      </label>
      <input
        id="sermon-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="mt-3 w-full border border-rog-line bg-transparent px-4 py-3 font-serif text-[22px] text-rog-ink focus:border-rog-purple focus:outline-none"
      />

      <label htmlFor="sermon-passage" className="kicker mt-6 block">
        Passage
      </label>
      <input
        id="sermon-passage"
        value={passage}
        onChange={(e) => setPassage(e.target.value)}
        placeholder="e.g. Psalm 42:1–5"
        className="mt-2 w-full border border-rog-line bg-transparent px-4 py-3 font-serif text-[15px] focus:border-rog-purple focus:outline-none"
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <div>
          <label htmlFor="sermon-status" className="kicker block">
            Status
          </label>
          <select
            id="sermon-status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-2 border border-rog-line bg-transparent px-4 py-2.5 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="preached">Preached</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label htmlFor="sermon-date" className="kicker block">
            Preached on
          </label>
          <input
            id="sermon-date"
            type="date"
            value={preachedOn}
            onChange={(e) => setPreachedOn(e.target.value)}
            className="mt-2 border border-rog-line bg-transparent px-4 py-2.5 text-sm"
          />
        </div>
      </div>

      <p className="kicker mt-10">
        {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
      </p>

      <ul className="mark-list mt-4">
        {blocks.map((b, i) => (
          <li key={b.id} className="mark-row">
            {b.reference && (
              <span className="kicker kicker-strong block">{b.reference}</span>
            )}
            <label htmlFor={`block-${b.id}`} className="sr-only">
              Block text
            </label>
            <textarea
              id={`block-${b.id}`}
              value={b.text}
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x))
                )
              }
              rows={b.kind === "verse" ? 3 : 5}
              className={`mt-2 w-full border border-rog-line bg-transparent px-4 py-3 text-[15px] leading-relaxed focus:border-rog-purple focus:outline-none ${
                b.kind === "verse" ? "font-serif" : ""
              }`}
            />
            <div className="mt-2 flex gap-4 text-xs">
              <button
                type="button"
                className="text-rog-muted"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
              >
                Move up
              </button>
              <button
                type="button"
                className="text-rog-muted"
                disabled={i === blocks.length - 1}
                onClick={() => move(i, i + 1)}
              >
                Move down
              </button>
              <button
                type="button"
                className={armed === b.id ? "text-danger font-semibold" : "text-rog-muted"}
                onClick={() => {
                  if (armed === b.id) {
                    setBlocks((prev) => prev.filter((x) => x.id !== b.id));
                    setArmed(null);
                  } else {
                    setArmed(b.id);
                  }
                }}
              >
                {armed === b.id ? "Tap again to delete" : "Delete"}
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="btn-secondary mt-6"
        onClick={() =>
          setBlocks((prev) => [
            ...prev,
            {
              id:
                typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : `b-${Date.now()}`,
              kind: "text",
              text: ""
            }
          ])
        }
      >
        Add a block
      </button>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={save}
          disabled={state === "saving"}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </button>
      </div>

      {err && <p className="mt-3 text-xs text-danger">{err}</p>}

      <div className="mt-8 flex justify-center">
        <button
          type="button"
          className={armedSermon ? "text-xs text-danger font-semibold" : "text-xs text-rog-muted"}
          onClick={() => {
            if (armedSermon) deleteSermon();
            else setArmedSermon(true);
          }}
        >
          {armedSermon ? "Tap again to delete this sermon" : "Delete this sermon"}
        </button>
      </div>
    </>
  );
}
