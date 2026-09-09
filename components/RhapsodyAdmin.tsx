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
  verse_text: string | null;
  body: string | null;
  prayer: string | null;
  prayer_label: string | null;
};

type Draft = {
  title: string;
  page: string;
  verse: string;
  body: string;
  prayer: string;
  prayerLabel: string;
};

const EMPTY: Draft = { title: "", page: "", verse: "", body: "", prayer: "", prayerLabel: "PRAYER" };

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
    for (const d of dates) seed[d] = { ...EMPTY };
    for (const d of days) {
      seed[d.date] = {
        title: d.title ?? "",
        page: String(d.page_number ?? ""),
        verse: d.verse_text ?? "",
        body: d.body ?? "",
        prayer: d.prayer ?? "",
        prayerLabel: d.prayer_label ?? "PRAYER"
      };
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
  const [open, setOpen] = useState<string | null>(null);

  const missing = dates.filter((d) => !drafts[d]?.page.trim());
  const noText = dates.filter((d) => drafts[d]?.page.trim() && !drafts[d]?.body.trim());

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
    // Blank lines are kept, not dropped: line 5 is always the 5th of the
    // month, and an empty one means "leave that day's title alone".
    const titles = titleList.trim() ? titleList.split("\n").map((t) => t.trim()) : [];
    setDrafts((prev) => {
      const next = { ...prev };
      dates.forEach((d, i) => {
        const prev = next[d] ?? EMPTY;
        next[d] = { ...prev, title: titles[i] || prev.title, page: String(start + i * step) };
      });
      return next;
    });
    say("Filled in. Check the pages that look off, then save.");
  }

  function clearAll() {
    setDrafts(() => {
      const next: Record<string, Draft> = {};
      for (const d of dates) next[d] = { ...EMPTY };
      return next;
    });
    say("Cleared. Nothing is saved until you press Save.");
  }

  /** Read this month's articles straight out of the PDF and fill them in. */
  async function pullText() {
    if (!edition) return fail("Upload this month's PDF first.");
    const ask = dates
      .map((d) => ({ date: d, page: parseInt((drafts[d]?.page ?? "").trim(), 10) }))
      .filter((x) => Number.isInteger(x.page) && x.page >= 1);
    if (!ask.length) return fail("Set the page numbers first — Quick fill does the whole month.");

    setBusy("extract");
    let json: {
      articles?: Record<string, { title: string; verse: string; body: string; prayer: string; prayerLabel: string }>;
      error?: string;
    } = {};
    let ok = false;
    try {
      const res = await fetch("/api/admin/rhapsody/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edition_id: edition.id,
          pages_per: parseInt(pagesPer, 10) || 1,
          days: ask
        })
      });
      json = await res.json();
      ok = res.ok;
    } catch (e) {
      json = { error: e instanceof Error ? e.message : "no answer from the server" };
    }
    setBusy(null);
    if (!ok) return fail(`Couldn't read the PDF: ${json.error ?? "something went wrong"}`);

    const articles = json.articles ?? {};
    setDrafts((prev) => {
      const next = { ...prev };
      for (const [date, a] of Object.entries(articles)) {
        const cur = next[date] ?? EMPTY;
        next[date] = {
          ...cur,
          title: a.title?.trim() || cur.title,
          verse: a.verse ?? "",
          body: a.body ?? "",
          prayer: a.prayer ?? "",
          prayerLabel: a.prayerLabel || "PRAYER"
        };
      }
      return next;
    });
    const n = Object.keys(articles).length;
    say(`Read ${n} day${n === 1 ? "" : "s"} out of the PDF. Look over a few, then save.`);
  }

  async function saveMapping() {
    if (!edition) return fail("Upload this month's PDF first.");
    setBusy("save");

    const toSave: {
      date: string;
      edition_id: string;
      title: string | null;
      page_number: number;
      verse_text: string | null;
      body: string | null;
      prayer: string | null;
      prayer_label: string | null;
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
          page_number: page,
          verse_text: draft.verse.trim() || null,
          body: draft.body.trim() || null,
          prayer: draft.prayer.trim() || null,
          prayer_label: draft.prayer.trim() ? draft.prayerLabel || "PRAYER" : null
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
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Monthly PDF</h2>
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
              className="w-full border border-rog-line px-4 py-2.5 text-left focus:border-rog-purple focus:outline-none"
            />
          </div>
          <div className="min-w-0">
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              enterKeyHint="done"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              placeholder="September 2026"
              className="w-full border border-rog-line px-4 py-2.5 text-left focus:border-rog-purple focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PDF file</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="w-full text-sm border border-rog-line px-4 py-2.5 file:mr-3 file:rounded-full file:border-0 file:bg-rog-purple file:px-4 file:py-1.5 file:text-white file:text-sm"
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
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Editions</h2>
        {editions.length === 0 ? (
          <div className="empty">
            <p>No editions yet.</p>
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
          <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Dates</h2>
          {monthInput}
        </div>

        {!edition ? (
          <div className="empty">
            <p>No PDF for {monthLabel(month)} yet.</p>
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

            {noText.length > 0 && (
              <p className="mt-2 text-sm text-rog-muted">
                <span className="font-semibold text-rog-ink">
                  {noText.length} with a page but no text yet:
                </span>{" "}
                {noText.map((d) => dayOfMonth(d)).join(", ")}
              </p>
            )}

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
                    pattern="[0-9]*"
                    enterKeyHint="next"
                    value={startPage}
                    onChange={(e) => setStartPage(e.target.value)}
                    className="w-full border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs text-rog-muted mb-1">Pages per article</label>
                  <input
                    inputMode="numeric"
                    pattern="[0-9]*"
                    enterKeyHint="done"
                    value={pagesPer}
                    onChange={(e) => setPagesPer(e.target.value)}
                    className="w-full border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
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
                  enterKeyHint="enter"
                  placeholder={"The Name That Rules Heaven And Earth\nFulfil Your Purpose To His Glory\n..."}
                  className="w-full border border-rog-line px-4 py-2.5 text-sm focus:border-rog-purple focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={quickFill} className="btn-secondary px-5 py-2 text-sm">
                  Fill the month
                </button>
                <button
                  type="button"
                  onClick={pullText}
                  disabled={busy === "extract"}
                  className="btn-secondary px-5 py-2 text-sm disabled:opacity-50"
                >
                  {busy === "extract" ? "Reading the PDF..." : "Get the text from the PDF"}
                </button>
                <button type="button" onClick={clearAll} className="btn-secondary px-5 py-2 text-sm">
                  Clear all
                </button>
              </div>
            </div>

            {/* Per-date rows */}
            <ul className="mt-4 space-y-2">
              {dates.map((d) => {
                const draft = drafts[d] ?? EMPTY;
                const set = !!draft.page.trim();
                const hasText = !!draft.body.trim();
                const edit = (patch: Partial<Draft>) =>
                  setDrafts((prev) => ({ ...prev, [d]: { ...draft, ...patch } }));
                return (
                  <li key={d} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-11 shrink-0  py-2 text-center leading-tight ${
                          set ? "bg-rog-purple text-white" : "bg-rog-cream text-rog-muted"
                        }`}
                      >
                        <span className="block text-sm font-bold">{dayOfMonth(d)}</span>
                        <span className="block text-[9px] uppercase tracking-wider opacity-80">
                          {weekdayShort(d)}
                        </span>
                      </div>
                      <input
                        type="text"
                        enterKeyHint="next"
                        value={draft.title}
                        onChange={(e) => edit({ title: e.target.value })}
                        placeholder="Article title"
                        className="flex-1 min-w-0 border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
                      />
                      <input
                        value={draft.page}
                        onChange={(e) => edit({ page: e.target.value })}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        enterKeyHint="done"
                        placeholder="pg"
                        aria-label={`Page number for ${d}`}
                        className="w-16 shrink-0 border border-rog-line px-3 py-2 text-sm text-center focus:border-rog-purple focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setOpen(open === d ? null : d)}
                        aria-expanded={open === d}
                        aria-label={`Article text for ${d}`}
                        title={hasText ? "Article text is in \u2014 tap to read or edit" : "No article text yet"}
                        className={`w-9 h-9 shrink-0 rounded-full text-xs font-bold ${
                          hasText ? "bg-rog-cream text-rog-purple" : "bg-rog-cream text-rog-muted"
                        }`}
                      >
                        {hasText ? "\u2713" : "\u2026"}
                      </button>
                    </div>

                    {open === d && (
                      <div className="card space-y-3">
                        <div>
                          <label className="block text-xs text-rog-muted mb-1">Opening scripture</label>
                          <textarea
                            value={draft.verse}
                            onChange={(e) => edit({ verse: e.target.value })}
                            rows={3}
                            enterKeyHint="next"
                            className="w-full border border-rog-line px-4 py-2.5 text-sm focus:border-rog-purple focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-rog-muted mb-1">
                            The article &mdash; leave a blank line between paragraphs
                          </label>
                          <textarea
                            value={draft.body}
                            onChange={(e) => edit({ body: e.target.value })}
                            rows={12}
                            enterKeyHint="enter"
                            className="w-full border border-rog-line px-4 py-2.5 text-sm leading-relaxed focus:border-rog-purple focus:outline-none"
                          />
                          <p className="mt-1 text-xs text-rog-muted">{draft.body.length} characters</p>
                        </div>
                        <div className="grid sm:grid-cols-[8rem,1fr] gap-2">
                          <div className="min-w-0">
                            <label className="block text-xs text-rog-muted mb-1">Heading</label>
                            <input
                              type="text"
                              autoCapitalize="characters"
                              enterKeyHint="next"
                              value={draft.prayerLabel}
                              onChange={(e) => edit({ prayerLabel: e.target.value })}
                              placeholder="PRAYER"
                              className="w-full border border-rog-line px-4 py-2 text-sm focus:border-rog-purple focus:outline-none"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="block text-xs text-rog-muted mb-1">Prayer or confession</label>
                            <textarea
                              value={draft.prayer}
                              onChange={(e) => edit({ prayer: e.target.value })}
                              rows={4}
                              enterKeyHint="done"
                              className="w-full border border-rog-line px-4 py-2.5 text-sm focus:border-rog-purple focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}
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
