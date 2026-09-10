"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SelectSheet from "@/components/SelectSheet";
import { friendlyError } from "@/lib/errors";
import {
  SERMON_TITLE_MAX,
  SERMON_PASSAGE_MAX,
  SERMON_BLOCK_TEXT_MAX
} from "@/lib/limits";
import SermonScriptureInput from "@/components/SermonScriptureInput";
import { newBlockId, type SermonBlock, type SermonBlockKind } from "@/lib/sermons";

type Props = {
  id: string;
  initialTitle: string;
  initialPassage: string;
  initialBlocks: SermonBlock[];
  initialStatus: string;
  initialPreachedOn: string;
  /** The pastor's own translation, so a scripture added by reference
      arrives in the edition they read in. */
  translationId?: string | null;
};

/** How long a delete stays armed. Same promise the Bench's notes make. */
const ARM_MS = 4000;

/** How long the explicit Save button reads "Saved" before going back. */
const SAVED_FLASH_MS = 2200;

/** How long a pause in typing counts as "done for now". */
const AUTOSAVE_MS = 3000;

/**
 * One sermon: a title, a passage, and an ordered list of blocks.
 *
 * Deliberately small. No export, no sharing, no collaborators, no rich text
 * — a sermon in this app is a place to put what you found while you were
 * reading, and everything past that is a different piece of work.
 *
 * Two things changed in the excellence pass. Every write now goes through
 * /api/sermon, so the caps in lib/limits.ts are enforced server-side rather
 * than not at all (P2-G). And the editor autosaves three seconds after you
 * stop typing, with a beforeunload guard behind it, because this was the
 * one surface in the app where closing a tab lost work silently (P1-C).
 *
 * No autoFocus, here or anywhere: the keyboard opens when someone taps a
 * field and at no other time.
 */
export default function SermonEditor({
  id,
  initialTitle,
  initialPassage,
  initialBlocks,
  initialStatus,
  initialPreachedOn,
  translationId
}: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initialTitle);
  const [passage, setPassage] = useState(initialPassage);
  const [blocks, setBlocks] = useState<SermonBlock[]>(initialBlocks);
  const [status, setStatus] = useState(initialStatus);
  const [preachedOn, setPreachedOn] = useState(initialPreachedOn);

  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  /** True from the first edit until a save lands. Drives both the autosave
      and the leave-the-page warning; nothing else reads it. */
  const [dirty, setDirty] = useState(false);
  /** Set on any successful save. The muted line under the fields. */
  const [savedOnce, setSavedOnce] = useState(false);
  /** A block just added by the button, to be brought into view — not
      focused. Same rule the Bench notepad follows. */
  const [scrollToBlock, setScrollToBlock] = useState<string | null>(null);

  const savedTimer = useRef<number | null>(null);
  const firstRender = useRef(true);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(null), ARM_MS);
    return () => window.clearTimeout(t);
  }, [armed]);


  useEffect(
    () => () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    },
    []
  );

  // Any edit marks the sermon dirty. Skipped on the first render so
  // arriving on the page is not itself an edit.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setDirty(true);
  }, [title, passage, blocks, status, preachedOn]);

  const save = useCallback(
    async (explicit: boolean) => {
      if (explicit) setState("saving");
      setErr(null);
      try {
        const res = await fetch(`/api/sermon/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title,
            passage_ref: passage.trim() || null,
            blocks,
            status,
            preached_on: preachedOn.trim() || null
          })
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          // Nothing local is rolled back, because nothing local was
          // changed by this call — what is rolled back is the claim that
          // it saved. The edits stay on screen and the sermon stays
          // dirty, so the error line and the "Unsaved changes" note both
          // stand, the leave-the-page guard stays armed, and the next
          // edit (or the Save button) tries again. Deliberately not a
          // timed retry: a failing save that keeps firing on its own is
          // how you turn one outage into a hundred requests.
          if (explicit) setState("idle");
          setErr(
            j.error === "too_long"
              ? `That ${j.field === "blocks" ? "sermon has too many blocks" : `${j.field} is too long`}. Maximum ${j.max}.`
              : friendlyError(j.error)
          );
          return false;
        }
        setDirty(false);
        setSavedOnce(true);
        if (explicit) {
          setState("saved");
          if (savedTimer.current) window.clearTimeout(savedTimer.current);
          savedTimer.current = window.setTimeout(
            () => setState("idle"),
            SAVED_FLASH_MS
          );
          router.refresh();
        }
        return true;
      } catch (e: any) {
        if (explicit) setState("idle");
        setErr(friendlyError(e?.message));
        return false;
      }
    },
    [id, title, passage, blocks, status, preachedOn, router]
  );

  // Autosave: three seconds after the last change, and never while the
  // explicit Save is already in flight. A failure does not block anything
  // — the sermon stays dirty and the next pause tries again.
  useEffect(() => {
    if (!dirty || state === "saving") return;
    const t = window.setTimeout(() => {
      save(false);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [dirty, state, save]);

  // The leave-the-page warning, and only while there is something to lose.
  // Registered on dirty and removed on clean, so a saved sermon never asks
  // the question.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // A new block is brought into view. Not focused — a keyboard that opens
  // because a panel scrolled is a keyboard nobody asked for.
  useEffect(() => {
    if (!scrollToBlock) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-block-id="${CSS.escape(scrollToBlock)}"]`
    );
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setScrollToBlock(null);
  }, [scrollToBlock]);



  function addBlock(kind: SermonBlockKind, text = "", reference?: string) {
    const blockId = newBlockId();
    setBlocks((prev) => [
      ...prev,
      { id: blockId, kind, text, ...(reference ? { reference } : {}) }
    ]);
    setScrollToBlock(blockId);
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

      <label htmlFor="sermon-title" className="sr-only">
        Title
      </label>
      <input
        id="sermon-title"
        type="text"
        enterKeyHint="next"
        autoComplete="off"
        maxLength={SERMON_TITLE_MAX}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        className="mt-3 w-full border border-rog-line bg-transparent px-4 py-3 font-serif text-[22px] text-rog-ink focus:border-rog-purple focus:outline-none"
      />
      {/* Asked for, not assumed. A sermon with no name is findable by
          nobody, including the person who wrote it — and the answer is
          never to name it after its first verse. */}
      {!title.trim() && (
        <p className="meta mt-2">Give it a name so you can find it later.</p>
      )}

      <label htmlFor="sermon-passage" className="meta mt-6 block">
        Passage
      </label>
      <input
        id="sermon-passage"
        type="text"
        enterKeyHint="next"
        autoComplete="off"
        maxLength={SERMON_PASSAGE_MAX}
        value={passage}
        onChange={(e) => setPassage(e.target.value)}
        placeholder="e.g. Psalm 42:1–5"
        className="mt-2 w-full border border-rog-line bg-transparent px-4 py-3 font-serif text-[15px] focus:border-rog-purple focus:outline-none"
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <div>
          <label htmlFor="sermon-status" className="meta block">
            Status
          </label>
          <SelectSheet
            label="Status"
            value={status}
            onChange={setStatus}
            className="mt-2"
            options={[
              { value: "draft", label: "Draft" },
              { value: "preached", label: "Preached" },
              { value: "archived", label: "Archived" }
            ]}
          />
        </div>
        <div>
          <label htmlFor="sermon-date" className="meta block">
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

      <div className="sermon-blocks-head mt-10">
        <p className="meta">
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
        </p>
      </div>

      <ul className="sermon-blocks mt-4" ref={listRef}>
        {blocks.map((b, i) => (
          <li key={b.id} className="sermon-block" data-kind={b.kind} data-block-id={b.id}>
            <div className="sermon-block-head">
              <span className="meta meta-strong">
                {b.kind === "scripture"
                  ? b.reference || "Scripture"
                  : b.kind === "heading"
                    ? "Heading"
                    : "Note"}
              </span>
              <div className="sermon-block-tools">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                >
                  &uarr;
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === blocks.length - 1}
                  onClick={() => move(i, i + 1)}
                >
                  &darr;
                </button>
                <button
                  type="button"
                  className={armed === b.id ? "text-danger" : undefined}
                  onClick={() => {
                    if (armed === b.id) {
                      setBlocks((prev) => prev.filter((x) => x.id !== b.id));
                      setArmed(null);
                    } else {
                      setArmed(b.id);
                    }
                  }}
                >
                  {armed === b.id ? "Tap again" : "Remove"}
                </button>
              </div>
            </div>

            {/* A scripture's reference is editable too — the words may
                have been sent from the Bench with a range the preacher
                wants to widen, and retyping the whole verse to fix a
                colon would be absurd. */}
            {b.kind === "scripture" && (
              <>
                <label htmlFor={`ref-${b.id}`} className="sr-only">
                  Reference
                </label>
                <input
                  id={`ref-${b.id}`}
                  type="text"
                  autoComplete="off"
                  maxLength={SERMON_PASSAGE_MAX}
                  value={b.reference ?? ""}
                  placeholder="Reference"
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((x) =>
                        x.id === b.id ? { ...x, reference: e.target.value } : x
                      )
                    )
                  }
                  className="sermon-block-ref"
                />
              </>
            )}

            <label htmlFor={`block-${b.id}`} className="sr-only">
              {b.kind === "heading" ? "Heading" : "Text"}
            </label>
            <textarea
              id={`block-${b.id}`}
              enterKeyHint={b.kind === "heading" ? "done" : undefined}
              maxLength={SERMON_BLOCK_TEXT_MAX}
              value={b.text}
              placeholder={
                b.kind === "heading"
                  ? "A line to break the flow"
                  : b.kind === "scripture"
                    ? "The words"
                    : "What you want to say"
              }
              onChange={(e) =>
                setBlocks((prev) =>
                  prev.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x))
                )
              }
              rows={b.kind === "heading" ? 1 : b.kind === "scripture" ? 3 : 5}
              className="sermon-block-text"
            />
          </li>
        ))}
      </ul>

      {/* Adding. A scripture takes a reference and fetches its words; the
          other two are empty and waiting. */}
      <div className="sermon-add mt-6">
        <SermonScriptureInput
          translationId={translationId}
          onAdd={(reference, verseText) => addBlock("scripture", verseText, reference)}
        />
        <div className="sermon-add-row">
          <button type="button" className="btn-secondary" onClick={() => addBlock("heading")}>
            Add heading
          </button>
          <button type="button" className="btn-secondary" onClick={() => addBlock("note")}>
            Add note
          </button>
        </div>
      </div>

      <div className="mt-10 flex gap-3">
        <button
          type="button"
          onClick={() => save(true)}
          disabled={state === "saving"}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Save"}
        </button>
      </div>

      {/* The autosave's own voice. Quiet, and only once there is something
          true to say — it never claims a save that has not happened. */}
      <p className="meta mt-3">
        {dirty
          ? "Unsaved changes"
          : savedOnce
            ? "Saved a moment ago"
            : " "}
      </p>

      {err && <p className="mt-3 text-xs text-danger">{err}</p>}

      {/* Delete is not here. It belongs to the read view's menu, which
          is the page a sermon is opened from — two places to delete one
          sermon is one place too many, and the riskier of the two is the
          screen you are typing in. */}
      <div className="mt-8 flex justify-center">
        <Link href={`/sermons/${id}`} className="meta">
          Done editing
        </Link>
      </div>

    </>
  );
}
