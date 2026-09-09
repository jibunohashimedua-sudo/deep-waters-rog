"use client";
import { useEffect, useRef, useState } from "react";

/**
 * A select, as a bottom sheet.
 *
 * A native <select> opens whatever the platform feels like opening — a
 * wheel on iOS, a floating list on Android, a dropdown with the system
 * accent colour on a desktop — and none of them can be made to match
 * anything else here. This one is a sheet like every other sheet in the
 * app: square, opaque, hairline-separated rows, and the current option
 * marked with a violet rule down its left edge.
 *
 * The native element stays, visually hidden, holding the name and value
 * so a form submits exactly as it did and a screen reader gets a select.
 * The sheet drives it and dispatches a real change event, so callers that
 * listen for onChange keep working untouched.
 */
export type SelectOption = { value: string; label: string; group?: string };

export default function SelectSheet({
  value,
  options,
  onChange,
  label,
  name,
  disabled,
  className = ""
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Named for the sheet's heading and the trigger's accessible name. */
  label: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const native = useRef<HTMLSelectElement>(null);
  const current = options.find((o) => o.value === value);

  // Escape closes, and the page underneath doesn't scroll while it's up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  function pick(next: string) {
    setOpen(false);
    if (next === value) return;
    if (native.current) native.current.value = next;
    onChange(next);
  }

  const groups = options.some((o) => o.group);

  return (
    <>
      {/* The real control. Keyboard users and screen readers get a select;
          everyone else gets the sheet. */}
      <select
        ref={native}
        name={name}
        value={value}
        disabled={disabled}
        aria-label={label}
        className="control-native"
        onChange={(e) => onChange(e.target.value)}
        tabIndex={-1}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}. ${current?.label ?? "Choose"}.`}
        className={`select-trigger ${className}`}
      >
        <span className="truncate">{current?.label ?? "Choose"}</span>
        <span className="meta" aria-hidden>
          &#9662;
        </span>
      </button>

      <div
        className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close"
          onClick={() => setOpen(false)}
          className={`sheet-backdrop absolute inset-0 transition-opacity duration-[250ms] ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className={`sheet ${open ? "translate-y-0" : "translate-y-full"}`}
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <p className="meta px-6 pt-6 pb-3">{label}</p>
          <div>
            {options.map((o, i) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => pick(o.value)}
                className="option-row"
              >
                <span className="flex-1">{o.label}</span>
                {groups && o.group && (
                  <span className="meta">{o.group}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
