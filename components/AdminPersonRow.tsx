"use client";
import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export type AdminAction = {
  label: string;
  onSelect: () => void | Promise<void>;
  /** Sits apart from the rest and reads as what it is. One per menu. */
  destructive?: boolean;
  /** Shown under the label in the sheet, where a word isn't enough. */
  hint?: string;
};

type Props = {
  name: string;
  /** Shown beneath the account name, never instead of it. */
  nickname?: string | null;
  photoUrl?: string | null;
  /** "Admin", "Elite", "Leader", "Pending" — short, and rare. */
  badges?: { label: string; tone?: "accent" | "warning" }[];
  /** The one mono line under the name: dates, counts, whatever this list
      is actually about. Falsy entries are dropped, so a caller can pass a
      conditional without composing the string itself. */
  meta?: (string | false | null | undefined)[];
  actions?: AdminAction[];
};

/**
 * One person, in an admin list.
 *
 * Every admin list had its own copy of this and every copy was a flex row
 * with the name, two dates and four text buttons in it. On a phone that
 * wrapped into four ragged lines of different heights, and on the longest
 * name in the church the Remove link went off the right-hand edge.
 *
 * So: one component, and a shape that cannot do that.
 *
 *   - A three-column grid — portrait, text, one button — rather than a
 *     flex row of six things. The middle column is the only one that can
 *     grow, and it has min-width: 0 on it, which is what actually lets
 *     the name truncate instead of pushing the button off the screen.
 *   - Every row the same height, because the text column is always
 *     exactly two lines: the name, and one mono line under it.
 *   - The actions are not on the row. They are behind one overflow
 *     button, in a sheet, where they have room for full words and where
 *     the destructive one can sit apart from the others instead of
 *     being one more small link in a row of small links.
 *
 * Wide screens get the same component. There is no second layout to
 * drift: the row is already a row, it simply has more space in it.
 */
export default function AdminPersonRow({
  name,
  nickname,
  photoUrl,
  badges = [],
  meta = [],
  actions = []
}: Props) {
  const [open, setOpen] = useState(false);
  const lines = meta.filter(Boolean) as string[];

  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const ordinary = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  async function run(action: AdminAction) {
    setOpen(false);
    await action.onSelect();
  }

  return (
    <>
      <div className="admin-row">
        <Avatar name={name} photoUrl={photoUrl} size="md" decorative />

        <div className="admin-row-text">
          <p className="admin-row-name">
            <span className="admin-row-name-text">{name}</span>
            {badges.map((b) => (
              <span
                key={b.label}
                className="admin-badge"
                data-tone={b.tone ?? "accent"}
              >
                {b.label}
              </span>
            ))}
          </p>
          {/* One mono line, always, whatever is on it — which is what
              keeps every row the same height. The nickname leads it when
              there is one: the account name is the heading above, and
              this says what the church calls them. Both, always, and in
              that order. */}
          <p className="admin-row-meta">
            {nickname && (
              <>
                <span className="admin-row-nickname">{nickname}</span>
                {lines.length > 0 && "  ·  "}
              </>
            )}
            {lines.join("  ·  ")}
          </p>
        </div>

        {actions.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={`Actions for ${name}`}
            className="admin-row-more"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <circle cx="12" cy="6" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="18" r="1.6" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50" role="presentation">
          <button
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="sheet-backdrop absolute inset-0"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Actions for ${name}`}
            className="admin-sheet"
          >
            <div className="admin-sheet-head">
              <Avatar name={name} photoUrl={photoUrl} size="md" decorative />
              <span className="min-w-0">
                <span className="admin-sheet-name">{name}</span>
                {nickname && (
                  <span className="admin-row-meta block">Goes by {nickname}</span>
                )}
              </span>
            </div>

            {ordinary.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => run(a)}
                className="admin-sheet-item"
              >
                <span>{a.label}</span>
                {a.hint && <span className="admin-row-meta block">{a.hint}</span>}
              </button>
            ))}

            {destructive.length > 0 && (
              <div className="admin-sheet-danger">
                {destructive.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={() => run(a)}
                    className="admin-sheet-item admin-sheet-item-danger"
                  >
                    <span>{a.label}</span>
                    {a.hint && <span className="admin-row-meta block">{a.hint}</span>}
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="admin-sheet-item admin-sheet-cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
