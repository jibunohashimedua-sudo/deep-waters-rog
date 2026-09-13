"use client";
import { useEffect, useMemo, useState } from "react";

/**
 * The picker that opens when the reader taps "Share as image".
 *
 * Three orientations along the top (square, portrait, story), four
 * backgrounds under them (plain, sounding, plumb, tide) plus a random
 * option, a live scaled preview of the current combination, and a
 * "Share" button that fetches the full-resolution image and hands it to
 * the native share sheet — or downloads it, on a device that has no
 * share sheet.
 *
 * The preview is drawn client-side in the same tokens the OG endpoint
 * uses, scaled to a small width, so the picker feels instant. The
 * export is always at full resolution; the preview never leaves the
 * browser. The reader's last choice is remembered under
 * `dw_share_orient` and `dw_share_bg` so a second share doesn't ask them
 * to pick again.
 */

const ORIENT_KEY = "dw_share_orient";
const BG_KEY = "dw_share_bg";

type Orient = "square" | "portrait" | "story";
type Background = "plain" | "sounding" | "plumb" | "tide" | "random";

const ORIENT_LABEL: Record<Orient, string> = {
  square: "Square",
  portrait: "Portrait",
  story: "Story"
};

const ORIENT_SUB: Record<Orient, string> = {
  square: "1080 × 1080",
  portrait: "1080 × 1350",
  story: "1080 × 1920"
};

const ORIENT_ASPECT: Record<Orient, number> = {
  square: 1,
  portrait: 1080 / 1350,
  story: 1080 / 1920
};

const BACKGROUND_LABEL: Record<Background, string> = {
  plain: "Plain",
  sounding: "Sounding",
  plumb: "Plumb",
  tide: "Tide",
  random: "Random"
};

const BACKGROUND_OPTIONS: Background[] = ["plain", "sounding", "plumb", "tide", "random"];

type Props = {
  open: boolean;
  reference: string;
  verseText: string;
  dayNumber?: number;
  onClose: () => void;
  /** How the sheet reports what it did back to the reader. */
  onToast: (message: string) => void;
  /** So the same "verse sat unchanged" cleanup happens as before. */
  onShared?: () => void;
};

export default function ShareCardSheet({
  open,
  reference,
  verseText,
  dayNumber,
  onClose,
  onToast,
  onShared
}: Props) {
  const [orient, setOrient] = useState<Orient>("portrait");
  const [bg, setBg] = useState<Background>("plain");
  const [sharing, setSharing] = useState(false);

  // Remembered last choices. Read once when the sheet mounts; every
  // subsequent change writes back.
  useEffect(() => {
    if (!open) return;
    try {
      const savedOrient = localStorage.getItem(ORIENT_KEY);
      if (savedOrient === "square" || savedOrient === "portrait" || savedOrient === "story") {
        setOrient(savedOrient);
      }
      const savedBg = localStorage.getItem(BG_KEY) as Background | null;
      if (savedBg && BACKGROUND_OPTIONS.includes(savedBg)) {
        setBg(savedBg);
      }
    } catch {
      // localStorage disabled — the defaults are fine.
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(ORIENT_KEY, orient);
    } catch {
      // Ignore.
    }
  }, [orient, open]);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(BG_KEY, bg);
    } catch {
      // Ignore.
    }
  }, [bg, open]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function share() {
    setSharing(true);
    onToast("Building your card…");
    try {
      const params = new URLSearchParams({
        ref: reference,
        text: verseText,
        orient,
        bg
      });
      if (dayNumber) params.set("day", String(dayNumber));
      const res = await fetch(`/api/og/verse?${params.toString()}`);
      if (!res.ok) throw new Error(`card responded ${res.status}`);
      const blob = await res.blob();
      const file = new File(
        [blob],
        `deep-waters-${reference.replace(/[^\w]+/g, "-")}-${orient}.png`,
        { type: "image/png" }
      );
      const nav: any = navigator;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({ files: [file], text: reference });
          onToast("");
          onShared?.();
          onClose();
          return;
        } catch {
          // Fall through to a download.
        }
      }
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      onToast("Card downloaded.");
      onShared?.();
      onClose();
    } catch (err) {
      console.error("[deep-waters] share card:", err);
      onToast("Couldn't build the card. Try again.");
    } finally {
      setSharing(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="Share as image"
    >
      {/* Dim behind the sheet. Tap it to dismiss. */}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onClose}
        className="sheet-backdrop"
        style={{ position: "absolute", inset: 0, border: 0, cursor: "pointer" }}
      />

      <div
        className="share-sheet"
        role="document"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--bg)",
          borderTop: "1px solid var(--line)",
          padding: "20px 20px calc(env(safe-area-inset-bottom) + 20px)"
        }}
      >
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
          <p className="meta">Share as image</p>

          <p
            className="mt-2 text-[13px] leading-5"
            style={{ color: "var(--muted)" }}
          >
            {reference}
          </p>

          {/* Live preview, drawn in the same tokens as the OG endpoint. */}
          <div className="mt-4" style={{ display: "flex", justifyContent: "center" }}>
            <SharePreview
              orient={orient}
              bg={bg === "random" ? "sounding" : bg}
              reference={reference}
              text={verseText}
              dayNumber={dayNumber}
              isRandom={bg === "random"}
            />
          </div>

          {/* Orientation */}
          <fieldset style={{ marginTop: 20, border: 0, padding: 0 }}>
            <legend className="meta" style={{ padding: 0 }}>Shape</legend>
            <div
              role="radiogroup"
              aria-label="Shape"
              style={{
                marginTop: 8,
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8
              }}
            >
              {(["square", "portrait", "story"] as Orient[]).map((o) => (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={orient === o}
                  onClick={() => setOrient(o)}
                  className={`share-picker-tile ${orient === o ? "is-on" : ""}`}
                >
                  <span style={{ display: "block" }}>{ORIENT_LABEL[o]}</span>
                  <span
                    className="meta"
                    style={{ display: "block", marginTop: 4, color: "var(--muted)" }}
                  >
                    {ORIENT_SUB[o]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {/* Background */}
          <fieldset style={{ marginTop: 16, border: 0, padding: 0 }}>
            <legend className="meta" style={{ padding: 0 }}>Background</legend>
            <div
              role="radiogroup"
              aria-label="Background"
              style={{
                marginTop: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 8
              }}
            >
              {BACKGROUND_OPTIONS.map((b) => (
                <button
                  key={b}
                  type="button"
                  role="radio"
                  aria-checked={bg === b}
                  onClick={() => setBg(b)}
                  className={`share-picker-chip ${bg === b ? "is-on" : ""}`}
                >
                  {BACKGROUND_LABEL[b]}
                </button>
              ))}
            </div>
          </fieldset>

          <div style={{ marginTop: 20, display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              className="chapter-pager-prev"
              style={{ flex: 1, justifyContent: "center" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={share}
              disabled={sharing}
              className="chapter-pager-next"
              style={{ flex: 1.6, justifyContent: "center", opacity: sharing ? 0.6 : 1 }}
            >
              {sharing ? "Building…" : "Share"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A scaled-down preview of the card the OG endpoint will produce. Same
 * tokens, same layout heuristics — it isn't a fetch. Scales from a
 * fixed 1080-wide design to a smaller display width via CSS transform,
 * so nothing has to recompute per shape.
 */
function SharePreview({
  orient,
  bg,
  reference,
  text,
  dayNumber,
  isRandom
}: {
  orient: Orient;
  bg: Exclude<Background, "random">;
  reference: string;
  text: string;
  dayNumber?: number;
  isRandom: boolean;
}) {
  const spec = useMemo(() => PREVIEW_SPECS[orient], [orient]);
  const displayWidth = 240;
  const scale = displayWidth / spec.w;

  const verse = useMemo(() => fitVerseForPreview(text, spec), [text, spec]);

  const depth = dayNumber && dayNumber > 0 ? Math.min(1, dayNumber / 90) : undefined;
  const ref = reference.replace(/\s+/g, " ").trim().toUpperCase();

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          width: displayWidth,
          height: displayWidth * (spec.h / spec.w),
          overflow: "hidden",
          background: "#0C0A18"
        }}
      >
        <div
          style={{
            width: spec.w,
            height: spec.h,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "relative",
            display: "flex",
            background: "#0C0A18",
            color: "#E9E6F2",
            fontFamily: "var(--font-serif), serif"
          }}
        >
          <PreviewBackground bg={bg} spec={spec} />
          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              width: spec.w,
              height: spec.h,
              padding: `${spec.padT}px ${spec.padH}px ${spec.padB}px`
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: verse.size, lineHeight: spec.verseLineHeight }}>
                {verse.text}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: spec.refSize,
                  letterSpacing: "0.13em",
                  color: "#8B87A3",
                  marginTop: spec.refMarginTop
                }}
              >
                {ref || "DEEP WATERS"}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spec.footerGap,
                borderTop: "1px solid #262239",
                paddingTop: spec.footerRulePad
              }}
            >
              <PreviewMark depth={depth} scale={spec.footerBarScale} />
              <div
                style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: spec.footerWordSize,
                  letterSpacing: "0.13em",
                  color: "#8B87A3"
                }}
              >
                DEEP WATERS
              </div>
            </div>
          </div>
        </div>
      </div>
      {isRandom && (
        <p
          className="meta"
          style={{
            marginTop: 8,
            color: "var(--muted)",
            textAlign: "center"
          }}
        >
          Random — a background is picked when the card is built
        </p>
      )}
    </div>
  );
}

/** Preview specs mirror the server spec closely enough that what the
    reader sees is what the exported image looks like. Kept as a local
    copy so the preview never depends on server code. */
const PREVIEW_SPECS = {
  square: {
    w: 1080,
    h: 1080,
    padH: 88,
    padT: 88,
    padB: 76,
    maxChars: 380,
    verseBrackets: [
      [110, 72],
      [200, 60],
      [300, 48],
      [380, 40]
    ] as Array<[number, number]>,
    verseLineHeight: 1.44,
    refSize: 24,
    refMarginTop: 36,
    footerBarScale: 0.88,
    footerWordSize: 22,
    footerGap: 22,
    footerRulePad: 32
  },
  portrait: {
    w: 1080,
    h: 1350,
    padH: 88,
    padT: 88,
    padB: 80,
    maxChars: 560,
    verseBrackets: [
      [110, 72],
      [200, 60],
      [320, 50],
      [460, 42],
      [560, 36]
    ] as Array<[number, number]>,
    verseLineHeight: 1.44,
    refSize: 26,
    refMarginTop: 40,
    footerBarScale: 1,
    footerWordSize: 24,
    footerGap: 24,
    footerRulePad: 40
  },
  story: {
    w: 1080,
    h: 1920,
    padH: 96,
    padT: 240,
    padB: 220,
    maxChars: 700,
    verseBrackets: [
      [120, 80],
      [220, 68],
      [360, 58],
      [500, 50],
      [700, 42]
    ] as Array<[number, number]>,
    verseLineHeight: 1.48,
    refSize: 28,
    refMarginTop: 48,
    footerBarScale: 1.1,
    footerWordSize: 26,
    footerGap: 26,
    footerRulePad: 48
  }
} as const;

function fitVerseForPreview(text: string, spec: (typeof PREVIEW_SPECS)[Orient]) {
  const clean = text.replace(/\s+/g, " ").trim();
  let out = clean;
  if (clean.length > spec.maxChars) {
    const cut = clean.slice(0, spec.maxChars);
    const lastSpace = cut.lastIndexOf(" ");
    out = (lastSpace > spec.maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
  }
  const n = out.length;
  const bracket = spec.verseBrackets.find(([limit]) => n <= limit);
  const size = bracket ? bracket[1] : spec.verseBrackets[spec.verseBrackets.length - 1][1];
  return { text: out, size };
}

function PreviewMark({ depth, scale }: { depth?: number; scale: number }) {
  const bars = [72, 54, 36, 18].map((w) => ({ w: w * scale, h: 12 * scale }));
  const fill = depth === undefined ? null : Math.max(0, Math.min(1, depth));
  return (
    <div
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 * scale }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: b.w,
            height: b.h,
            borderRadius: b.h / 2,
            background: fill === null ? "#E9E6F2" : "#262239",
            overflow: "hidden"
          }}
        >
          {fill !== null && (
            <div
              style={{
                width: b.w * fill,
                height: b.h,
                borderRadius: b.h / 2,
                background: "#E9E6F2"
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function PreviewBackground({
  bg,
  spec
}: {
  bg: Exclude<Background, "random">;
  spec: (typeof PREVIEW_SPECS)[Orient];
}) {
  if (bg === "plain") return null;
  if (bg === "tide") {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, #171233 0%, #100C22 40%, #0C0A18 80%, #08061A 100%)"
        }}
      />
    );
  }
  if (bg === "sounding") {
    const inset = spec.padH;
    const y = spec.h >= 1600 ? Math.round(spec.padT * 0.42) : Math.round(spec.padT * 0.55);
    const runWidth = spec.w - inset * 2;
    const majorEvery = Math.round(runWidth / 8);
    return (
      <div style={{ position: "absolute", inset: 0 }}>
        <div
          style={{
            position: "absolute",
            left: inset,
            top: y,
            width: runWidth,
            height: 1,
            background: "#262239"
          }}
        />
        {Array.from({ length: 9 }).map((_, i) => {
          const isMajor = i % 2 === 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: inset + i * majorEvery,
                top: y,
                width: 1,
                height: isMajor ? 16 : 10,
                background: "#262239"
              }}
            />
          );
        })}
      </div>
    );
  }
  // plumb
  const x = Math.round(spec.padH * 0.42);
  const top = spec.padT;
  const bottom = spec.h - spec.padB;
  const runHeight = bottom - top;
  const marks = 6;
  const step = runHeight / (marks - 1);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top,
          width: 1,
          height: runHeight,
          background: "#262239"
        }}
      />
      {Array.from({ length: marks }).map((_, i) => {
        const isMajor = i === 0 || i === marks - 1 || i === Math.floor(marks / 2);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x - 6,
              top: top + Math.round(i * step),
              width: isMajor ? 14 : 8,
              height: 1,
              background: "#262239"
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: x - 3,
          top: top + runHeight - 8,
          width: 8,
          height: 8,
          background: "#A78BFF"
        }}
      />
    </div>
  );
}
