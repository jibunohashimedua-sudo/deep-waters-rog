"use client";
import { useMemo, useState } from "react";
import Avatar from "./Avatar";
import { humanDate } from "@/lib/dates";
import type { FigurePerson, FigureResult } from "@/lib/adminFigures";

type Sort = "name" | "recent" | "cohort";

/**
 * The people behind a figure, both halves of it.
 *
 * Everything here is done in the browser — searching, sorting, filtering,
 * the export — because the whole church fits in one query and a round
 * trip per keystroke would be slower and no more correct. The rows
 * arrived already filtered by row-level security, so there is nothing
 * here that the admin was not allowed to be sent.
 *
 * The account name is the heading and the nickname sits under it. That
 * is the opposite of everywhere members see each other, and it is the
 * point: this list exists so somebody can ring the right person.
 */
export default function AdminFigureList({ figure }: { figure: FigureResult }) {
  const [tab, setTab] = useState<"didnt" | "did">("didnt");
  const [query, setQuery] = useState("");
  const [cohort, setCohort] = useState<string>("all");
  const [sort, setSort] = useState<Sort>("name");

  const source = tab === "did" ? figure.did : figure.didnt;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = source.filter((p) => {
      if (cohort === "none" && p.cohortId) return false;
      if (cohort !== "all" && cohort !== "none" && p.cohortId !== cohort) return false;
      if (!q) return true;
      // Both names, because an admin may only know one of them.
      return (
        p.name.toLowerCase().includes(q) ||
        (p.nickname ?? "").toLowerCase().includes(q) ||
        (p.cohortName ?? "").toLowerCase().includes(q)
      );
    });
    out = [...out].sort((a, b) => {
      if (sort === "recent") {
        // Most recent first on the "did" list. On the "didn't" list
        // nobody has a time, so it falls back to the name.
        if (a.at && b.at) return b.at.localeCompare(a.at);
        if (a.at) return -1;
        if (b.at) return 1;
      }
      if (sort === "cohort") {
        const c = (a.cohortName ?? "~").localeCompare(b.cohortName ?? "~");
        if (c !== 0) return c;
      }
      return a.name.localeCompare(b.name);
    });
    return out;
  }, [source, query, cohort, sort]);

  function exportCsv() {
    const header = ["Name", "Known as", "Cohort", "Day", "Completed"];
    const lines = [header, ...rows.map(rowToCsv)]
      .map((cells) => cells.map(csvCell).join(","))
      .join("\r\n");
    // A BOM, so Excel opens it as UTF-8 rather than mangling every name
    // with an accent in it — which in this church is a lot of them.
    const blob = new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deep-waters-${figure.key}-${tab}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-8">
      <div className="segmented" role="group" aria-label="Which list">
        <button
          type="button"
          aria-pressed={tab === "didnt"}
          onClick={() => setTab("didnt")}
          className="segmented-option"
        >
          {figure.didntLabel} ({figure.didnt.length})
        </button>
        <button
          type="button"
          aria-pressed={tab === "did"}
          onClick={() => setTab("did")}
          className="segmented-option"
        >
          {figure.didLabel} ({figure.did.length})
        </button>
      </div>

      <div className="admin-filters mt-4">
        <label className="admin-filter-grow">
          <span className="sr-only">Search by name or cohort</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a name or a cohort"
            autoComplete="off"
          />
        </label>
        <label className="admin-filter">
          <span className="sr-only">Cohort</span>
          <select value={cohort} onChange={(e) => setCohort(e.target.value)}>
            <option value="all">All cohorts</option>
            {figure.cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">No cohort</option>
          </select>
        </label>
        <label className="admin-filter">
          <span className="sr-only">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">By name</option>
            <option value="recent">Most recent</option>
            <option value="cohort">By cohort</option>
          </select>
        </label>
      </div>

      <div className="admin-figure-count mt-4">
        <span className="meta">
          {rows.length} {rows.length === 1 ? "person" : "people"}
        </span>
        <button
          type="button"
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="btn-secondary admin-export"
        >
          Export this list
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty mt-6">
          <p>Nobody in this list.</p>
        </div>
      ) : (
        <div className="admin-list mt-2">
          {rows.map((p) => (
            <div key={p.id} className="admin-row">
              <Avatar name={p.name} photoUrl={p.photoUrl} size="md" decorative />
              <div className="admin-row-text">
                <p className="admin-row-name">
                  <span className="admin-row-name-text">{p.name}</span>
                </p>
                {/* One mono line, same as every other admin row, so the
                    heights match down the list. */}
                <p className="admin-row-meta">
                  {p.nickname && (
                    <>
                      <span className="admin-row-nickname">{p.nickname}</span>
                      {"  ·  "}
                    </>
                  )}
                  {[
                    p.cohortName ?? "No cohort",
                    p.day !== null && `Day ${p.day}`,
                    p.at && humanDate(p.at)
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function rowToCsv(p: FigurePerson): string[] {
  return [
    p.name,
    p.nickname ?? "",
    p.cohortName ?? "",
    p.day === null ? "" : String(p.day),
    p.at ? humanDate(p.at) : ""
  ];
}

/** Quote anything that would break a cell, and double any quote inside
    it. A name with a comma in it should not become two columns. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
