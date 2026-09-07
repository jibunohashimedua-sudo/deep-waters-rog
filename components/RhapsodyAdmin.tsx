"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  addMonths,
  dayOfMonth,
  datesInMonth,
  monthLabel,
  weekdayShort
} from "@/lib/rhapsody";

export type Edition = {
  id: string;
  month: string;
  title: string;
  file_path: string;
};

export type DayRow = {
  date: string;
  title: string | null;
  page_number: number;
};

type Draft = { title: string; page: string };

export default function RhapsodyAdmin({
  month,
  editions,
  days,
  userId
}: {
  month: string;
  editions: Edition[];
  days: DayRow[];
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const dates = useMemo(() => datesInMonth(month), [month]);
  const edition = editions.find((e) => e.month === month) ?? null;

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const seed: Record<string, Draft> = {};
    for (const d of dates) seed[d] = { title: "", page: "" };
    for (const d of days) {
      seed[d.date] = { title: d.title ?? "", page: String(d.page_number ?? "") };
    }
    return seed;
  });

  const [uploadTitle, setUploadTitle] = useState(monthLabel(month));
  const [uploadMonth, setUploadMonth] = useState(month.slice(0, 7));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [startPage, setStartPage] = useState("1");
  const [pagesPer, setPagesPer] = useState("1");
  const [titleList, setTitleList] = useState("");

  const missing = dates.filter((d) => !drafts[d]?.page.trim());

  function say(message: string) {
    setErr(null);
    setMsg(message);
  }
  function fail(message: string) {
    setMsg(null);
    setErr(message);
  }

  /** Upload a PDF into the private bucket and record the edition. */
  async function upload(file: File, forMonth: string, title: string, replacing?: Edition) {
    const ym = forMonth.slice(0, 7);
    // A fresh filename each time, so a replaced PDF can never be served
    // from a cached copy of the old one.
    const path = `${ym}/rhapsody-${ym}-${Date.now()}.pdf`;

    const { error: upErr } = await supabase.storage
      .from("rhapsody")
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (upErr) return fail(`Upload failed: ${upErr.message}`);

    const { error: rowErr } = await supabase.from("rhapsody_editions").upsert(
      {
        month: `${ym}-01`,
        title: title.trim() || monthLabel(`${ym}-01`),
        file_path: path,
        uploaded_by: userId
      },
      { onConflict: "month" }
    );
    if (rowErr) {
      // Don't leave an orphan file behind if the record didn't save.
      await supabase.storage.from("rhapsody").remove([path]);
      return fail(`Saved the file but couldn't record it: ${rowErr.message}`);
    }

    // Old file is only removed once the new one is safely recorded.
    if (replacing?.file_path && replacing.file_path !== path) {
      const { error: rmErr } = await supabase.storage
        .from("rhapsody")
        .remove([replacing.file_path]);
      if (rmErr) console.warn("[deep-waters] old rhapsody file kept:", rmErr.message);
    }

    say(replacing ? "Replaced." : "Uploaded.");
    router.refresh();
  }

  async function onUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return fail("Choose a PDF first.");
    if (file.type !== "application/pdf") return fail("That file isn't a PDF.");
    if (!/^\d{4}-\d{2}$/.test(uploadMonth)) return fail("Set the month first, like 2026-09.");
    setBusy("upload");
    // Uploading over a month that already has an edition is a replace: the
    // record is upserted on `month`, so the old file has to go with it.
    const existing = editions.find((e) => e.month === `${uploadMonth}-01`) ?? undefined;
    await upload(file, `${uploadMonth}-01`, uploadTitle, existing);
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const [replacingId, setReplacingId] = useState<string | null>(null);
  async function onReplace(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const target = editions.find((x) => x.id === replacingId);
    e.target.value = "";
    if (!file || !target) return;
    if (file.type !== "application/pdf") return fail("That file isn't a PDF.");
    setBusy(`replace-${target.id}`);
    await upload(file, target.month, target.title, target);
    setBusy(null);
    setReplacingId(null);
  }

  async function onDelete(ed: Edition) {
    if (
      !confirm(
        `Delete ${ed.title}? The PDF and every date mapped to it will be removed.`
      )
    )
      return;
    setBusy(`delete-${ed.id}`);
    const { error: rmErr } = await supabase.storage.from("rhapsody").remove([ed.file_path]);
    if (rmErr) console.warn("[deep-waters] rhapsody file remove:", rmErr.message);
    const { error } = await supabase.from("rhapsody_editions").delete().eq("id", ed.id);
    setBusy(null);
    if (error) return fail(`Couldn't delete: ${error.message}`);
    say("Deleted.");
    router.refresh();
  }

  /** One article per day from a starting page — the 30-rows-in-one-action helper. */
  function quickFill() {
    const start = parseInt(startPage, 10);
    const step = parseInt(pagesPer, 10);
    if (!Number.isInteger(start) || start < 1) return fail("Start page must be 1 or more.");
    if (!Number.isInteger(step) || step < 1) return fail("Pages per article must be 1 or more.");
    const titles = titleList
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    setDrafts((prev) => {
      const next = { ...prev };
      dates.forEach((d, i) => {
        next[d] = {
          title: titles[i] ?? next[d]?.title ?? "",
          page: String(start + i * step)
        };
      });
      return next;
    });
    say("Filled in. Check the pages that look off, then save.");
  }

  function clearAll() {
    setDrafts(() => {
      const next: Record<string, Draft> = {};
      for (const d of dates) next[d] = { title: "", page: "" };
      return next;
    });
    say("Cleared. Nothing is saved until you press Save.");
  }

  async function saveMapping() {
    if (!edition) return fail("Upload this month's PDF first.");
    setBusy("save");

    const toSave: {
      date: string;
      edition_id: string;
      title: string | null;
      page_number: number;
    }[] = [];
    const toClear: string[] = [];

    for (const d of dates) {
      const draft = drafts[d];
      const page = parseInt((draft?.page ?? "").trim(), 10);
      if (Number.isInteger(page) && page >= 1) {
        toSave.push({
          date: d,
          edition_id: edition.id,
          title: draft.title.trim() || null,
          page_number: page
        });
      } else if (draft?.page.trim() || days.some((x) => x.date === d)) {
        // Blank or nonsense page: the date goes back to having no article.
        toClear.push(d);
      }
    }

    if (toSave.length) {
      const { error } = await supabase
        .from("rhapsody_days")
        .upsert(toSave, { onConflict: "date" });
      if (error) {
        setBusy(null);
        return fail(`Couldn't save: ${error.message}`);
      }
    }
    if (toClear.length) {
      const { error } = await supabase.from("rhapsody_days").delete().in("date", toClear);
      if (error) {
        setBusy(null);
        return fail(`Saved, but couldn't clear the blank dates: ${error.message}`);
      }
    }

    setBusy(null);
    say(`Saved ${toSave.length} date${toSave.length === 1 ? "" : "s"}.`);
    router.refresh();
  }

  const monthInput = (
    <div className="flex items-center gap-2 text-sm">
      <a href={`/admin/rhapsody?m=${addMonths(month, -1)}`} className="btn-secondary px-4 py-2">
        &larr;
      </a>
      <span className="font-semibold text-rog-ink">{monthLabel(month)}</span>
      <a href={`/admin/rhapsody?m=${addMonths(month, 1)}`} className="btn-secondary px-4 py-2">
        &rarr;
      </a>
    </div>
  );

  return (
    <div className="space-y-6">
      {(msg || err) && (
        <p
          className={`text-sm text-center ${err ? "text-danger" : "text-rog-purple"}`}
        >
          {err ?? msg}
        </p>
      )}

      {/* ---------- Upload ---------- */}
      <form onSubmit={onUpload} className="card space-y-4">
        <div>
          <p className="kicker">Monthly PDF</p>
          <p className="mt-1 text-sm text-rog-muted">
            Stored privately. Members only ever see it through a short-lived link.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="min-w-0">
            <label className="block text-sm font-medium mb-1">Month</label>
            {/* iOS Safari has no month picker and shows a plain box, so the
                placeholder spells out the shape it expects. */}
            <input
              type="month"
              value={uploadMonth}
              placeholder="2026-09"
              pattern="\d{4}-\d{2}"
              onChange={(e) => {
                setUploadMonth(e.target.value);
                if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                  setUploadTitle(monthLabel(`${e.target.value}-01`));
                }
              }}
              className="w-full rounded-full border border-rog-line px-5 py-2.5 focus:border-rog-purple focus:outline-none"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="September 2026"
              className="w-full rounded-full border border-rog-line px-5 py-2.5 focus:border-rog-purple focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PDF file</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="w-full text-sm rounded-2xl border border-rog-line px-4 py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-rog-purple file:px-4 file:py-1.5 file:text-white file:text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={busy === "upload"}
          className="btn-primary w-full disabled:opacity-50"
        >
          {busy === "upload" ? "Uploading..." : "Upload edition"}
        </button>
      </form>

      {/* ---------- Existing editions ---------- */}
      <section className="card">
        <p className="kicker">Editions</p>
        {editions.length === 0 ? (
          <div className="empty-state">
            <p className="empty-body">No editions yet.</p>
            <p className="empty-hint">Upload this month&rsquo;s PDF above to begin.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {editions.map((e) => (
              <li
                key={e.id}
                className="surface-soft flex flex-wrap items-center gap-3 !py-3 !px-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-rog-ink truncate">{e.title}</p>
                  <p className="text-[11px] text-rog-muted truncate">{monthLabel(e.month)}</p>
                </div>
                <a
                  href={`/admin/rhapsody?m=${e.month}`}
                  className="text-xs font-semibold text-rog-purple"
                >
                  Map dates
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setReplacingId(e.id);
                    replaceRef.current?.click();
                  }}
                  disabled={busy === `replace-${e.id}`}
                  className="text-xs font-semibold text-rog-purple disabled:opacity-50"
                >
                  {busy === `replace-${e.id}` ? "Replacing..." : "Replace"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(e)}
                  disabled={busy === `delete-${e.id}`}
                  className="text-xs font-semibold text-danger disabled:opacity-50"
                >
                  {busy === `delete-${e.id}` ? "Deleting..." : "Delete"}
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={replaceRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onReplace}
          className="hidden"
        />
      </section>

      {/* ---------- Mapping ---------- */}
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="kicker">Dates</p>
          {monthInput}
        </div>

        {!edition ? (
          <div className="empty-state">
            <p className="empty-body">No PDF for {monthLabel(month)} yet.</p>
            <p className="empty-hint">Upload it above, then come back to map the dates.</p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-rog-muted">
              {missing.length === 0 ? (
                <>Every date in {monthLabel(month)} has an article.</>
              ) : (
                <>
                  <span className="font-semibold text-rog-ink">
                    {missing.length} date{missing.length === 1 ? "" : "s"} with no article:
                  </span>{" "}
                  {missing.map((d) => dayOfMonth(d)).join(", ")}
                </>
              )}
            </p>

            {/* Quick fill */}
            <div className="surface-soft mt-4 space-y-3">
              <p className="text-sm font-semibold text-rog-ink">Quick fill</p>
              <p className="text-xs text-rog-muted">
                One article a day, running through the PDF from a starting page.
                Fills the whole month, then you fix any that are off.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="block text-xs text-rog-muted mb-1">Day 1 starts on page</label>
                  <input
                    inputMode="numeric"
                    value={startPage}
                    onChange={(e) => setStartPage(e.target.value)}
                    className="w-full rounded-full border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs text-rog-muted mb-1">Pages per article</label>
                  <input
                    inputMode="numeric"
                    value={pagesPer}
                    onChange={(e) => setPagesPer(e.target.value)}
                    className="w-full rounded-full border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-rog-muted mb-1">
                  Titles, one per line (optional &mdash; first line is the 1st of the month)
                </label>
                <textarea
                  value={titleList}
                  onChange={(e) => setTitleList(e.target.value)}
                  rows={4}
                  placeholder={"The Name That Rules Heaven And Earth\nFulfil Your Purpose To His Glory\n..."}
                  className="w-full rounded-2xl border border-rog-line px-4 py-2.5 text-sm focus:border-rog-purple focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={quickFill} className="btn-secondary px-5 py-2 text-sm">
                  Fill the month
                </button>
                <button type="button" onClick={clearAll} className="btn-secondary px-5 py-2 text-sm">
                  Clear all
                </button>
              </div>
            </div>

            {/* Per-date rows */}
            <ul className="mt-4 space-y-2">
              {dates.map((d) => {
                const draft = drafts[d] ?? { title: "", page: "" };
                const set = !!draft.page.trim();
                return (
                  <li key={d} className="flex items-center gap-2">
                    <div
                      className={`w-11 shrink-0 rounded-2xl py-2 text-center leading-tight ${
                        set ? "bg-rog-purple text-white" : "bg-rog-cream text-rog-muted"
                      }`}
                    >
                      <span className="block text-sm font-bold">{dayOfMonth(d)}</span>
                      <span className="block text-[9px] uppercase tracking-wider opacity-80">
                        {weekdayShort(d)}
                      </span>
                    </div>
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [d]: { ...draft, title: e.target.value } }))
                      }
                      placeholder="Article title"
                      className="flex-1 min-w-0 rounded-full border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
                    />
                    <input
                      value={draft.page}
                      onChange={(e) =>
                        setDrafts((p) => ({ ...p, [d]: { ...draft, page: e.target.value } }))
                      }
                      inputMode="numeric"
                      placeholder="pg"
                      aria-label={`Page number for ${d}`}
                      className="w-16 shrink-0 rounded-full border border-rog-line px-3 py-2 text-sm text-center focus:border-rog-purple focus:outline-none"
                    />
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={saveMapping}
              disabled={busy === "save"}
              className="btn-primary w-full mt-6 disabled:opacity-50"
            >
              {busy === "save" ? "Saving..." : `Save ${monthLabel(month)}`}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
