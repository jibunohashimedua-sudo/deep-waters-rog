"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { translationById } from "@/lib/translations";
import {
  TOTAL_CHAPTERS,
  cancelDownload,
  deleteDownload,
  downloadSummary,
  formatBytes,
  readDownloadState,
  runDownload,
  type DownloadState
} from "@/lib/offline/download";
import { pendingItems, discardBlocked } from "@/lib/offline/queue";
import type { QueueItem } from "@/lib/offline/db";

/**
 * "Download for offline reading", and the small print that goes with it.
 *
 * Two things live here because they are the same question asked twice —
 * what is this app holding on my phone, and can I get rid of it. The
 * download is one answer and the queue of unsent writes is the other, and
 * both belong on the screen where somebody goes looking.
 *
 * The size is shown before and after, and it is always "about": every figure
 * a browser gives for storage is an estimate, and printing 4.83 MB would be
 * a precision nobody actually has.
 *
 * Fathom: the progress bar is a rule that fills, not a rounded capsule —
 * square, hairline, no shadow, the same drawn-scale idea as the plan gauge.
 */
export default function OfflineDownload({ translationId }: { translationId: string }) {
  const [state, setState] = useState<DownloadState | null>(null);
  const [summary, setSummary] = useState<{
    chapters: number;
    usage: number | null;
    quota: number | null;
  } | null>(null);
  const [waiting, setWaiting] = useState<QueueItem[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const [s, sum, q] = await Promise.all([
      readDownloadState(),
      downloadSummary(),
      pendingItems()
    ]);
    if (!mounted.current) return;
    setState(s);
    setSummary(sum);
    setWaiting(q);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const running = state?.status === "running";
  const done = state?.done ?? 0;
  const percent = Math.min(100, Math.round((done / TOTAL_CHAPTERS) * 100));
  const translation = translationById(translationId);

  async function start() {
    await runDownload(translationId, (s) => {
      if (mounted.current) setState(s);
    });
    await refresh();
  }

  async function remove() {
    setConfirmingDelete(false);
    await deleteDownload();
    await refresh();
  }

  return (
    <>
      <div className="prefs-block">
        <span className="prefs-label">Download for offline reading</span>
        <span className="prefs-hint">
          Keeps the whole of {translation.abbr} on this phone, so any chapter opens
          with no signal at all. About 5 MB. Chapters you have already read are
          saved anyway — this is for the rest.
        </span>

        {summary && (
          <p className="offline-stamp">
            {summary.chapters === 0
              ? "Nothing saved on this device yet."
              : `About ${summary.chapters.toLocaleString()} ${
                  summary.chapters === 1 ? "chapter" : "chapters"
                } saved on this device` +
                (summary.usage !== null ? `, using about ${formatBytes(summary.usage)}.` : ".")}
            {summary.quota !== null &&
              summary.usage !== null &&
              ` Your browser will allow about ${formatBytes(summary.quota)}.`}
          </p>
        )}

        {/* A rule that fills. Its width is the fraction, and the number
            beside it is the same fact in words for anyone who cannot see
            a two-pixel difference. */}
        {state && state.status !== "idle" && (
          <div className="mt-3">
            <div
              className="offline-progress"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={TOTAL_CHAPTERS}
              aria-valuenow={done}
              aria-label="Bible download"
            >
              <span className="offline-progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <p className="offline-stamp">
              {done.toLocaleString()} of {TOTAL_CHAPTERS.toLocaleString()} chapters
              {" · "}
              {percent}%
            </p>
          </div>
        )}

        {state?.message && <p className="offline-note mt-2">{state.message}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {running ? (
            <button type="button" onClick={() => cancelDownload()} className="btn-secondary">
              Stop
            </button>
          ) : (
            <button type="button" onClick={start} className="btn-secondary">
              {state && state.done > 0 && state.status !== "complete"
                ? "Continue downloading"
                : state?.status === "complete"
                  ? "Check for anything missing"
                  : "Download the Bible"}
            </button>
          )}

          {summary && summary.chapters > 0 && !running && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="btn-secondary"
            >
              Delete the download
            </button>
          )}
        </div>

        {confirmingDelete && (
          <div className="mt-3 surface-soft">
            <p className="text-sm text-rog-ink">
              This removes the downloaded chapters from this phone. Chapters you
              have actually opened stay, and so do all your highlights and notes.
              Nothing is removed from your account.
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={remove} className="btn-primary">
                Delete it
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="btn-secondary"
              >
                Keep it
              </button>
            </div>
          </div>
        )}
      </div>

      <WaitingToSync items={waiting} onChange={refresh} />
    </>
  );
}

/**
 * What is written but not yet sent.
 *
 * Almost always empty, and shows nothing when it is. It exists for the two
 * moments it matters: a reader who wants to know their note is safe, and a
 * reader whose write the server refused, who otherwise would never find out
 * why. Nothing here can be lost by accident — the only way an item leaves
 * this list unsent is a deliberate press on something that says so.
 */
function WaitingToSync({
  items,
  onChange
}: {
  items: QueueItem[];
  onChange: () => void;
}) {
  if (items.length === 0) return null;

  const blocked = items.filter((i) => i.blocked);
  const pending = items.filter((i) => !i.blocked);

  return (
    <div className="prefs-block" id="waiting">
      <span className="prefs-label">Waiting to sync</span>
      <span className="prefs-hint">
        Written on this phone and on their way to your account. They send
        themselves as soon as there is a connection.
      </span>

      {pending.length > 0 && (
        <p className="offline-stamp">
          {pending.length} {pending.length === 1 ? "change" : "changes"} waiting:{" "}
          {summarise(pending)}
        </p>
      )}

      {blocked.map((item) => (
        <div key={item.seq} className="surface-soft mt-3">
          <p className="text-sm text-rog-ink">
            <strong>{label(item.kind)}</strong> couldn&rsquo;t be saved. {item.blocked}
          </p>
          <p className="offline-stamp">
            Written {new Date(item.at).toLocaleString("en-GB")}. It stays here until
            you say otherwise — nothing is thrown away on your behalf.
          </p>
          <button
            type="button"
            onClick={async () => {
              if (item.seq == null) return;
              await discardBlocked(item.seq);
              onChange();
            }}
            className="btn-secondary mt-3"
          >
            Let this one go
          </button>
        </div>
      ))}
    </div>
  );
}

function label(kind: string): string {
  switch (kind) {
    case "chapter-read":
      return "A chapter you read";
    case "highlight-add":
      return "A highlight";
    case "highlight-remove":
      return "A highlight you removed";
    case "verse-note-add":
      return "A note";
    case "verse-note-edit":
      return "An edit to a note";
    case "verse-note-remove":
      return "A note you deleted";
    case "reflection":
      return "A reflection";
    default:
      return "Something you wrote";
  }
}

function summarise(items: QueueItem[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([kind, n]) => `${n} × ${label(kind).replace(/^An? /, "").toLowerCase()}`)
    .join(", ");
}
