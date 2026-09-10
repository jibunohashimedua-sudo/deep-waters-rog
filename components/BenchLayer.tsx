"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/errors";
import { formatVerseReference, type VerseNote } from "@/lib/highlights";
import { planDayForChapter } from "@/lib/plan";
import {
  TRANSLATIONS,
  translationById,
  DEFAULT_BIBLE_ID,
  type Translation
} from "@/lib/translations";
import { useParallelRows } from "@/lib/parallelVerse";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useBenchLayout } from "@/lib/useBenchLayout";
import {
  LENSES,
  LENS_BY_ID,
  PRESETS,
  STACK_SEED,
  isRackMode,
  isSheetMode,
  type LensId
} from "@/lib/bench";
import {
  fetchCommentary, fetchConcordance, fetchCrossRefs,
  fetchStrongsEntries, fetchTaggedWords, fetchExposition,
  type CommentaryEntry, type ConcordanceHit, type CrossRef,
  type ExpositionEntry, type StrongsEntry, type TaggedWord
} from "@/lib/studyData";
import { useStudyLens } from "@/lib/useStudyLens";
import { newBlockId } from "@/lib/sermons";
import { scrollPaneTo } from "@/lib/scrollPane";
import BenchPinned from "./BenchPinned";
import BenchWordRail from "./BenchWordRail";
import BenchLensBody, { type LensData } from "./BenchLensBody";
import BenchPaneBoundary from "./BenchPaneBoundary";
import BenchNotepad from "./BenchNotepad";
import type { HouseRow } from "./BenchHouse";
import BenchSermonPicker from "./BenchSermonPicker";
import BenchDivider from "./BenchDivider";
import {
  BENCH_WIDTH_VAR, DEFAULT_FRACTION, NOTES_BESIDE_MIN_PX, RACK_TWO_MIN_PX,
  openingFraction,
  readStoredFraction, widthFor, writeStoredFraction
} from "@/lib/benchSplit";
import BenchSecondText, {
  SECOND_TEXT_MAX_VERSES, type SecondPassage
} from "./BenchSecondText";
import ReferencePicker from "./ReferencePicker";
import { bookByName, bookBySlug } from "@/lib/bibleBooks";
import { fetchParallelVerse, type ParallelRow } from "@/lib/parallelVerse";

export type BenchPhase = "closed" | "open" | "collapsed";

type Props = {
  phase: BenchPhase;
  userId: string;
  /** The pinned verse — book, chapter and the run of verses selected. */
  book: string;
  chapter: number;
  spanStart: number;
  spanEnd: number;
  verses: number[];
  /** "Psalm 42:3,7" — the honest reference, runs collapsed and gaps kept. */
  reference: string;
  /** The verses' own words, read off the page. */
  text: string;
  dayNumber: number;
  testament: "ot" | "nt";
  translationId: string;
  /** Every note the reader has on the chapters on screen. */
  notes: VerseNote[];
  /** The second window's passage, owned by ScriptureReader so it outlives
      a re-pin. See the note there. */
  second: SecondPassage | null;
  onSecondChange: (next: SecondPassage | null) => void;
  secondCapped: string | null;
  onSecondCappedChange: (message: string | null) => void;
  onCreateNote: (
    body: string,
    verseText: string,
    at?: { book: string; chapter: number; verseStart: number; verseEnd: number }
  ) => Promise<boolean>;
  onUpdateNote: (id: string, body: string) => Promise<boolean>;
  onDeleteNote: (id: string) => Promise<boolean>;
  /** One tap on the handle: back to the verse toolbar, selection kept. */
  onCollapse: () => void;
  onToast: (message: string) => void;
};

/** How many translations the lens carries before "Show more". */
const FIRST_BATCH = 6;
const MORE_STEP = 6;

/** The most reflections the house lens will ask for. */
const HOUSE_LIMIT = 40;

/** How many concordance verses arrive at a time. Some numbers run to
    thousands, so the lens states the count and pages through them. */
const CONCORDANCE_PAGE = 12;

/** How many cross references the lens shows, strongest first. */
const CROSSREF_LIMIT = 14;

/** Stable empties, so "no data yet" isn't a new object every render. */
const EMPTY_WORDS: TaggedWord[] = [];
const EMPTY_ENTRIES = new Map<string, StrongsEntry>();

/** How long "Added" stays on the sermon button before it goes back. */
const ADDED_MS = 2600;

/**
 * The Bench.
 *
 * One component, one set of state, four arrangements. The arrangement is
 * chosen on the CSS viewport and applied in CSS off `data-mode`, so a
 * rotation, a fold, or a Split View window dragged wider is a re-render and
 * never a remount: the pinned verse, the active lens, the open panels, the
 * chosen word and — the one that would actually hurt — the half-written
 * note in the composer all stay exactly where they were.
 *
 * Everything the panes show is held here and handed down. That is what
 * makes the above true, and it is also what stops a lens re-fetching every
 * time the window changes shape.
 */
export default function BenchLayer(props: Props) {
  const {
    phase,
    userId,
    book,
    chapter,
    spanStart,
    spanEnd,
    verses,
    reference,
    text,
    dayNumber,
    testament,
    translationId,
    notes,
    second,
    onSecondChange,
    secondCapped,
    onSecondCappedChange,
    onCreateNote,
    onUpdateNote,
    onDeleteNote,
    onCollapse,
    onToast
  } = props;

  const open = phase === "open";
  const supabase = useMemo(() => createClient(), []);
  /** The Bench's own scroller. Only this element is ever scrolled. */
  const bodyRef = useRef<HTMLDivElement>(null);
  const { mode, segments } = useBenchLayout();
  const rack = isRackMode(mode);
  const sheet = isSheetMode(mode);

  // The sheet sits over the chapter, so the page behind it is held still.
  // The column layouts leave the reader scrollable beside them, which is
  // the whole point of a column.
  useLockBodyScroll(open && sheet);

  // ------------------------------------------------------------- state
  // All of it here, above every layout. See the note on the component.
  const [activeLens, setActiveLens] = useState<LensId>("translations");
  const [stack, setStack] = useState(false);
  const [notesTab, setNotesTab] = useState(false);
  const [panels, setPanels] = useState<LensId[]>(PRESETS[0].panels);
  const [activeWordKey, setActiveWordKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [focusSignal, setFocusSignal] = useState(0);
  // Bumped whenever a word is chosen, from the rail or from the Words
  // lens. The effect below reads it and brings that word's entry up to the
  // top of the pane.
  const [wordScrollSignal, setWordScrollSignal] = useState(0);
  const [shown, setShown] = useState(FIRST_BATCH);
  /** The sermon a verse just went into, for the inline confirmation. */
  const [sermonAdded, setSermonAdded] = useState<string | null>(null);

  // ------------------------------------------------- the second window
  // The passage itself is owned by ScriptureReader, one level up. This
  // panel only mounts while a verse is pinned, and moving the pin empties
  // the selection for a moment — so state kept here would be thrown away
  // by the very gesture the window exists to survive.
  const [secondVerseCount, setSecondVerseCount] = useState<number | null>(null);
  const [secondPickerOpen, setSecondPickerOpen] = useState(false);

  /** Set while the composer is writing about the second window rather than
      the pinned verse. Null means the note belongs to the pinned verse. */
  const [noteTarget, setNoteTarget] = useState<{
    book: string; chapter: number; verseStart: number; verseEnd: number;
    reference: string; text: string;
  } | null>(null);
  const [sermonState, setSermonState] = useState<"idle" | "saving" | "added">(
    "idle"
  );


  const bookSlug = bookByName(book)?.slug ?? null;
  const abbr = bookByName(book)?.abbr ?? null;
  const planDay = planDayForChapter(book, chapter)?.day ?? null;

  const passageKey = `${book}|${chapter}|${spanStart}|${spanEnd}`;

  // ------------------------------------------------------- the study data
  // Which lenses are on screen. In tabs that is one lens; in a rack it is
  // every open panel; in Stack it is all of them, and `stackReady` lets
  // them in one at a time so a stacked Bench fills from the top rather
  // than firing every query at once.
  const [stackReady, setStackReady] = useState(STACK_SEED);
  useEffect(() => {
    setStackReady(STACK_SEED);
  }, [passageKey, stack]);
  const advanceStack = useCallback(() => setStackReady((n) => n + 1), []);

  const lensVisible = useCallback(
    (id: LensId) => {
      if (!open) return false;
      if (rack) return panels.includes(id);
      if (notesTab) return false;
      if (!stack) return activeLens === id;
      const order = LENSES.findIndex((l) => l.id === id);
      return order <= stackReady;
    },
    [open, rack, panels, notesTab, stack, activeLens, stackReady]
  );

  // Words. The rail is built from this, so it loads whenever any lens that
  // uses a word is on screen.
  const wantsWords =
    lensVisible("words") || lensVisible("exposition") || lensVisible("concordance");

  const wordsLens = useStudyLens<{ words: TaggedWord[]; entries: Map<string, StrongsEntry> }>({
    active: wantsWords,
    key: passageKey,
    onError: onToast,
    onSettled: stack ? advanceStack : undefined,
    load: async () => {
      const words = await fetchTaggedWords(book, chapter, spanStart, spanEnd);
      const ids = Array.from(new Set(words.flatMap((w) => w.strongsIds)));
      const entries = await fetchStrongsEntries(ids);
      return { words, entries };
    }
  });

  // Memoised: both are read by effects below, and a fresh [] or Map on
  // every render would re-enter them on every render.
  const taggedWords = useMemo(
    () => wordsLens.data?.words ?? EMPTY_WORDS,
    [wordsLens.data]
  );
  const strongsEntries = useMemo(
    () => wordsLens.data?.entries ?? EMPTY_ENTRIES,
    [wordsLens.data]
  );

  // One word is always the word, once there are words to choose from.
  useEffect(() => {
    if (taggedWords.length === 0) return;
    setActiveWordKey((k) =>
      k !== null && taggedWords.some((w) => `${w.verse}|${w.wordIndex}` === k)
        ? k
        : `${taggedWords[0].verse}|${taggedWords[0].wordIndex}`
    );
  }, [taggedWords]);

  const activeTagged =
    taggedWords.find((w) => `${w.verse}|${w.wordIndex}` === activeWordKey) ?? null;
  const activeStrongsId = activeTagged?.strongsIds[0] ?? null;

  // Concordance. Paged, and only for the word actually chosen.
  const [concordancePage, setConcordancePage] = useState(1);
  useEffect(() => {
    setConcordancePage(1);
  }, [activeStrongsId, passageKey]);

  const concordance = useStudyLens<{ total: number; hits: ConcordanceHit[] }>({
    active: lensVisible("concordance") && !!activeStrongsId,
    key: `${activeStrongsId}|${passageKey}|${concordancePage}`,
    onError: onToast,
    onSettled: stack ? advanceStack : undefined,
    load: () =>
      fetchConcordance(activeStrongsId!, 0, CONCORDANCE_PAGE * concordancePage, {
        book, chapter, verse: spanStart
      })
  });

  const crossRefs = useStudyLens<CrossRef[]>({
    active: lensVisible("crossrefs"),
    key: passageKey,
    onError: onToast,
    onSettled: stack ? advanceStack : undefined,
    load: () => fetchCrossRefs(book, chapter, spanStart, CROSSREF_LIMIT)
  });

  const exposition = useStudyLens<ExpositionEntry[]>({
    active: lensVisible("exposition"),
    key: passageKey,
    onError: onToast,
    onSettled: stack ? advanceStack : undefined,
    load: () => fetchExposition(book, chapter, spanStart)
  });

  // The passage itself, through the same fetcher Compare and the
  // Translations lens use. Keyed on the passage and the edition, so
  // changing either reloads and coming back to the tab does not.
  const secondKey = second
    ? `${second.bookSlug}|${second.chapter}|${second.start}|${second.end}|${second.bibleId}`
    : "none";
  const secondText = useStudyLens<ParallelRow>({
    active: lensVisible("secondtext") && second !== null,
    key: secondKey,
    onError: onToast,
    onSettled: stack ? advanceStack : undefined,
    load: () =>
      fetchParallelVerse({
        bookSlug: second!.bookSlug,
        chapter: second!.chapter,
        start: second!.start,
        end: second!.end,
        bibleId: second!.bibleId
      })
  });

  /**
   * Put a passage in the second window.
   *
   * The one place the four-verse ceiling is enforced, so it holds however
   * the passage arrived — the picker, the range control, or a tap on a
   * cross reference, which is where over-long ranges actually come from.
   * A range that is cut says so rather than quietly showing less than was
   * asked for.
   */
  const openSecond = useCallback(
    (ref: {
      bookSlug: string; book: string; chapter: number;
      start: number; end?: number; bibleId?: string;
    }) => {
      const wanted = Math.max(ref.end ?? ref.start, ref.start);
      const capped = Math.min(wanted, ref.start + SECOND_TEXT_MAX_VERSES - 1);
      onSecondCappedChange(
        wanted > capped
          ? `That range is ${wanted - ref.start + 1} verses. This window holds ${SECOND_TEXT_MAX_VERSES}, so it is showing ${ref.book} ${ref.chapter}:${ref.start}–${capped}.`
          : null
      );
      onSecondChange({
        bookSlug: ref.bookSlug,
        book: ref.book,
        chapter: ref.chapter,
        start: ref.start,
        end: capped,
        // The edition he last chose for this window stays chosen. It is
        // his window, and it does not follow the reader's translation.
        bibleId: ref.bibleId ?? second?.bibleId ?? translationId
      });
    },
    [second, onSecondChange, onSecondCappedChange, translationId]
  );

  // How many verses the chapter has, for the range control. Asked once per
  // chapter, and only once there is a passage to ask about.
  const secondBookSlug = second?.bookSlug ?? null;
  const secondChapter = second?.chapter ?? null;
  useEffect(() => {
    if (!secondBookSlug || !secondChapter) { setSecondVerseCount(null); return; }
    let cancelled = false;
    setSecondVerseCount(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/bible/verse-count?book=${encodeURIComponent(secondBookSlug)}&chapter=${secondChapter}`
        );
        const j = await res.json();
        if (!cancelled && Number.isFinite(j?.count)) setSecondVerseCount(j.count);
      } catch {
        /* The control simply offers the four it can always offer. */
      }
    })();
    return () => { cancelled = true; };
  }, [secondBookSlug, secondChapter]);

  const commentary = useStudyLens<CommentaryEntry[]>({
    active: lensVisible("commentary"),
    key: passageKey,
    onError: onToast,
    onSettled: stack ? advanceStack : undefined,
    load: () => fetchCommentary(book, chapter, spanStart)
  });

  // A new verse is a new question. The lens you were in stays — that is
  // continuity — but the word you had chosen belonged to the old verse.
  useEffect(() => {
    setShown(FIRST_BATCH);
    setEditingId(null);
    setSermonState("idle");
  }, [passageKey]);

  // Escape closes the Bench back to the toolbar, the same as the handle.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCollapse();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCollapse]);

  // NOTES is a tab in Split alone — the column is tall and narrow, and a
  // notepad under seven lenses would be a long way down. In the sheet the
  // notepad already follows the lens, and in a rack it has its own column,
  // so leaving the tab selected on the way out of Split would land you on a
  // layout with no active lens at all.
  useEffect(() => {
    if (mode !== "split") setNotesTab(false);
  }, [mode]);

  // Stack is the sheet's own idea, and the One/Stack toggle that turns it
  // off lives in the sheet dock. Carried into Split by a rotation it left
  // the reader looking at seven stacked lenses, no tab marked as chosen,
  // and no control anywhere on screen that explained the state or undid
  // it. ELITE_EXCELLENCE_AUDIT P2-D.
  useEffect(() => {
    if (mode !== "sheet") setStack(false);
  }, [mode]);

  // In a rack every panel is on screen, so the lens you were reading has to
  // be one of them or switching layout would lose your place.
  useEffect(() => {
    if (!rack) return;
    setPanels((prev) => (prev.includes(activeLens) ? prev : [activeLens, ...prev]));
  }, [rack, activeLens]);

  // Bring the chosen word's entry to the top of the pane.
  //
  // Two frames: the first lets the lens render whatever the new word
  // changed, the second measures a layout that has settled. In Stack the
  // entry is inside the Words block, so the same query finds it and the
  // pane lands on it there. Where the pane has no entry for a word at all
  // — the Concordance and Exposition are wholly about the chosen word —
  // the pane goes to its own top instead, which is where the new content
  // begins.
  useEffect(() => {
    if (wordScrollSignal === 0 || !open) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        const pane = bodyRef.current;
        if (!pane) return;
        const entry = activeWordKey
          ? pane.querySelector<HTMLElement>(`[data-word-key="${CSS.escape(activeWordKey)}"]`)
          : null;
        scrollPaneTo(pane, entry);
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [wordScrollSignal, activeWordKey, open]);

  // ------------------------------------------------------------- the split
  //
  // One number: the Bench's share of the window. It is written to a single
  // CSS property, and every rule that used to carry a hard-coded width now
  // reads that property — the Bench's own width, the padding that keeps
  // the reader clear of it, and the right edge of the verse toolbar.
  const [fraction, setFraction] = useState<number>(DEFAULT_FRACTION[mode]);

  // What was left last time, for this layout on this device. Read after
  // mount so the server and the first paint agree. Nothing remembered means
  // the opening width, which respects a comfortable reader rather than the
  // floor the divider can be dragged to.
  useEffect(() => {
    setFraction(
      readStoredFraction(mode) ?? openingFraction(mode, window.innerWidth)
    );
  }, [mode]);

  const applyWidth = useCallback((f: number) => {
    const px = widthFor(f, window.innerWidth);
    const root = document.documentElement;
    root.style.setProperty(BENCH_WIDTH_VAR, `${px}px`);
    // What the Bench has room for, decided from the same number and
    // written as plain attributes so the rearranging keeps up with the
    // finger without React re-rendering for it.
    root.dataset.benchNarrow = px < NOTES_BESIDE_MIN_PX ? "true" : "false";
    root.dataset.benchRackTwo = px >= RACK_TWO_MIN_PX ? "true" : "false";
  }, []);

  const commitWidth = useCallback(
    (f: number) => {
      setFraction(f);
      applyWidth(f);
      writeStoredFraction(mode, f);
    },
    [applyWidth, mode]
  );

  // Keep the width honest as the window changes: a rotation or a Split
  // View drag can put a pane under its floor, and clamping happens inside
  // widthFor so the divider simply stops rather than collapsing a pane.
  useEffect(() => {
    if (!open || sheet) return;
    applyWidth(fraction);
    const onResize = () => applyWidth(fraction);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, sheet, fraction, applyWidth]);

  // The reader column gets out of the way of a Bench that is a column.
  // Done on <html> with a width variable rather than by re-rendering the
  // page, so the chapter's scroll position is untouched.
  useEffect(() => {
    const root = document.documentElement;
    if (open && !sheet) {
      root.dataset.bench = segments === "vertical" ? "below" : "beside";
      root.dataset.benchMode = mode;
    } else {
      delete root.dataset.bench;
      delete root.dataset.benchMode;
    }
    return () => {
      delete root.dataset.bench;
      delete root.dataset.benchMode;
    };
  }, [open, sheet, mode, segments]);

  // -------------------------------------------------------- translations
  const ordered: Translation[] = useMemo(() => {
    const current = translationById(translationId || DEFAULT_BIBLE_ID);
    return [current, ...TRANSLATIONS.filter((t) => t.id !== current.id)];
  }, [translationId]);
  const visibleTranslations = useMemo(
    () => ordered.slice(0, shown),
    [ordered, shown]
  );

  // lensVisible, not a hand-written parallel of it. These two were copies
  // that had drifted: both omitted its `notesTab` clause, so Translations
  // and The house went on fetching behind the Notes tab in Split.
  // ELITE_EXCELLENCE_AUDIT P2-H. One predicate now, so they cannot drift
  // again.
  const wantsTranslations = lensVisible("translations");

  const rows = useParallelRows({
    // lensVisible already answers "is the Bench open"; the extra `open`
    // here was saying it twice.
    active: wantsTranslations,
    bookSlug,
    chapter,
    start: spanStart,
    end: spanEnd,
    visible: visibleTranslations,
    // The first lens in the stack reports that it has settled, so the
    // reveal has a starter at both ends of the chain. See STACK_SEED.
    onSettled: stack ? advanceStack : undefined
  });

  // ------------------------------------------------------------- the house
  const [houseRows, setHouseRows] = useState<HouseRow[] | null>(null);
  const [houseLoading, setHouseLoading] = useState(false);
  const houseFor = useRef<string | null>(null);

  const wantsHouse = lensVisible("house");

  useEffect(() => {
    if (!wantsHouse) return;
    if (houseFor.current === passageKey) return;
    houseFor.current = passageKey;

    let cancelled = false;
    setHouseLoading(true);
    setHouseRows(null);

    (async () => {
      // community_feed *is* the feed: the view only carries completions with
      // a reflection actually written, from approved members. A reflection
      // left blank to stay private is not in it, and no verse note ever is.
      // The privacy filter is therefore the query itself, which is where it
      // has to be.
      const names = Array.from(new Set([book, abbr].filter(Boolean) as string[]));
      const clauses = names.flatMap((n) => [
        `verse_reference.ilike."${n} ${chapter}:%"`,
        `verse_reference.ilike."${n} ${chapter}"`
      ]);

      const { data, error } = await supabase
        .from("community_feed")
        .select("id, day_number, verse_reference, reflection, amen_count")
        .or(clauses.join(","))
        .order("completed_at", { ascending: false })
        .limit(HOUSE_LIMIT);

      if (cancelled) return;
      setHouseLoading(false);
      if (error) {
        houseFor.current = null;
        onToast(friendlyError(error.message));
        return;
      }

      // Narrowing from the chapter down to these verses. This is relevance,
      // not privacy — everything in `data` was already public — and it has
      // to happen here because a free-typed reference like "Psalm 42:3–5"
      // is a string to Postgres and a range to us.
      const chosen = new Set(verses);
      const rowsForVerse = (data ?? []).filter((r) => {
        const ref = (r as { verse_reference: string | null }).verse_reference;
        const span = versesIn(ref);
        if (!span) return true; // "Psalm 42" — the whole chapter, so yes.
        for (let v = span.start; v <= span.end; v++) {
          if (chosen.has(v)) return true;
        }
        return false;
      });

      setHouseRows(
        rowsForVerse.map((r) => {
          const row = r as {
            id: string;
            day_number: number;
            verse_reference: string | null;
            reflection: string;
            amen_count: number | null;
          };
          return {
            id: row.id,
            day: row.day_number,
            reference: row.verse_reference,
            reflection: row.reflection,
            amens: Number(row.amen_count ?? 0)
          };
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [wantsHouse, passageKey, book, abbr, chapter, verses, supabase, onToast]);

  // --------------------------------------------------------------- notes
  const notesHere = useMemo(
    () =>
      notes
        .filter(
          (n) =>
            n.book === book &&
            n.chapter === chapter &&
            n.verse_start <= spanEnd &&
            n.verse_end >= spanStart
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ),
    [notes, book, chapter, spanStart, spanEnd]
  );

  const saveNote = useCallback(async () => {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    // noteTarget set means the composer was opened from the second window,
    // and the note is filed against that passage. Unset means the pinned
    // verse, which is every other way into the composer.
    const ok = editingId
      ? await onUpdateNote(editingId, body)
      : noteTarget
        ? await onCreateNote(body, noteTarget.text, {
            book: noteTarget.book,
            chapter: noteTarget.chapter,
            verseStart: noteTarget.verseStart,
            verseEnd: noteTarget.verseEnd
          })
        : await onCreateNote(body, text);
    setSaving(false);
    if (!ok) return;
    setDraft("");
    setEditingId(null);
    setNoteTarget(null);
  }, [draft, editingId, noteTarget, onCreateNote, onUpdateNote, text]);

  const removeNote = useCallback(
    async (id: string) => {
      setSaving(true);
      const ok = await onDeleteNote(id);
      setSaving(false);
      if (ok && editingId === id) {
        setEditingId(null);
        setDraft("");
      }
    },
    [editingId, onDeleteNote]
  );

  // ------------------------------------------------------------- sermons
  //
  // "To sermon" opens a picker rather than guessing. See
  // components/BenchSermonPicker for why.
  // Which passage the picker was opened for. Not a boolean: the dock's
  // To sermon means the pinned verse and the second window's means the
  // passage in that window, and carrying the answer here — rather than
  // reading it off whatever is pinned when the picker closes — is what
  // keeps the two references from crossing.
  const [sermonTarget, setSermonTarget] =
    useState<{ reference: string; text: string } | null>(null);

  const addToSermon = useCallback(
    async (sermon: { id: string; title: string }) => {
      const target = sermonTarget;
      setSermonTarget(null);
      if (!target) return;
      setSermonState("saving");

      const block = {
        id: newBlockId(),
        kind: "scripture" as const,
        reference: target.reference,
        text: target.text
      };

      // Read the sermon's blocks so the verse lands at the end of them.
      // A plain own-rows select; RLS is the whole guard. The write goes
      // through /api/sermon so the caps in lib/limits.ts are enforced
      // server-side, the way every other write path in this app is.
      const { data: row, error: readErr } = await supabase
        .from("sermons")
        .select("blocks")
        .eq("id", sermon.id)
        .eq("user_id", userId)
        .maybeSingle();

      if (readErr) {
        setSermonState("idle");
        onToast(friendlyError(readErr.message));
        return;
      }

      try {
        const res = await fetch(`/api/sermon/${sermon.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            blocks: [...(Array.isArray(row?.blocks) ? row!.blocks : []), block]
          })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setSermonState("idle");
          onToast(friendlyError(j.error));
          return;
        }
      } catch (e: any) {
        setSermonState("idle");
        onToast(friendlyError(e?.message));
        return;
      }

      // Named, so the preacher knows where it went without leaving the
      // verse to go and look.
      setSermonAdded(sermon.title);
      setSermonState("added");
    },
    [sermonTarget, supabase, userId, onToast]
  );

  useEffect(() => {
    if (sermonState !== "added") return;
    const t = window.setTimeout(() => {
      setSermonState("idle");
      setSermonAdded(null);
    }, ADDED_MS);
    return () => window.clearTimeout(t);
  }, [sermonState]);

  // ------------------------------------------- the second window's actions
  //
  // Each one names the second passage explicitly. None of them reads the
  // pinned verse, which is the whole discipline of this window.
  const secondReference = second
    ? formatVerseReference(second.book, second.chapter, second.start, second.end)
    : "";
  const secondBody =
    secondText.data?.status === "ready" ? secondText.data.text : "";

  const copySecond = useCallback(async () => {
    if (!secondBody) return;
    try {
      await navigator.clipboard.writeText(`“${secondBody}” — ${secondReference}`);
      onToast("Copied.");
    } catch {
      onToast("Couldn’t copy. Try again.");
    }
  }, [secondBody, secondReference, onToast]);

  const noteOnSecond = useCallback(() => {
    if (!second) return;
    // The composer is the Bench's own, but what it writes is filed against
    // this window's passage, not the pinned verse.
    setNoteTarget({
      book: second.book,
      chapter: second.chapter,
      verseStart: second.start,
      verseEnd: second.end,
      reference: secondReference,
      text: secondBody
    });
    setNotesTab(true);
    setStack(false);
    setFocusSignal((n) => n + 1);
  }, [second, secondReference, secondBody]);

  // -------------------------------------------------------------- render
  if (phase === "closed") return null;

  // Collapsed: the Bench is down and the six-chip toolbar is back. Nothing
  // of the Bench is on screen — the handle that closes the rest of the way
  // lives on the toolbar itself, so there is one grab handle, not two.
  if (phase === "collapsed") return null;

  const lensData: LensData = {
    visibleTranslations,
    rows,
    bookSlug,
    canShowMore: shown < ordered.length,
    onShowMore: () => setShown((n) => Math.min(n + MORE_STEP, ordered.length)),
    houseRows,
    houseLoading,
    planDay,
    taggedWords,
    wordsLoading: wordsLens.loading,
    strongsEntries,
    activeWordKey,
    activeWord: activeTagged?.word ?? null,
    activeStrongsId,
    concordanceTotal: concordance.data?.total ?? 0,
    concordanceHits: concordance.data?.hits ?? [],
    concordanceLoading: concordance.loading,
    concordanceMore:
      (concordance.data?.total ?? 0) > CONCORDANCE_PAGE * concordancePage,
    onConcordanceMore: () => setConcordancePage((n) => n + 1),
    crossRefs: crossRefs.data,
    crossRefsLoading: crossRefs.loading,
    exposition: exposition.data,
    expositionLoading: exposition.loading,
    commentary: commentary.data,
    commentaryLoading: commentary.loading,
    verse: spanStart,
    userId,
    second,
    secondRow: secondText.data,
    secondVerseCount,
    secondCapped,
    secondSermonState: sermonState,
    secondSermonAdded: sermonAdded,
    onOpenSecondPicker: () => setSecondPickerOpen(true),
    onSecondTranslation: (bibleId: string) =>
      onSecondChange(second ? { ...second, bibleId } : second),
    onSecondEnd: (end: number) =>
      onSecondChange(second ? { ...second, end: Math.max(end, second.start) } : second),
    onClearSecond: () => {
      onSecondChange(null);
      onSecondCappedChange(null);
    },
    onCopySecond: copySecond,
    onNoteSecond: noteOnSecond,
    onSecondToSermon: () => {
      if (!second || !secondBody) return;
      setSermonTarget({ reference: secondReference, text: secondBody });
    },
    // A cross reference is a passage he can sit with rather than a line of
    // text: tapping one opens it here, and never moves the pinned verse.
    onOpenCrossRef: (r: CrossRef) => {
      const bk = bookByName(r.target_book);
      if (!bk) return;
      openSecond({
        bookSlug: bk.slug,
        book: r.target_book,
        chapter: r.target_chapter,
        start: r.target_verse_start,
        end: r.target_verse_end
      });
      if (rack) {
        setPanels((prev) => (prev.includes("secondtext") ? prev : [...prev, "secondtext"]));
      } else {
        setActiveLens("secondtext");
        setNotesTab(false);
      }
    },
    onPickWord: (w: TaggedWord) => {
      setActiveWordKey(`${w.verse}|${w.wordIndex}`);
      setWordScrollSignal((n) => n + 1);
    }
  };

  const railWanted =
    taggedWords.length > 0 &&
    (rack
      ? panels.some((p) => LENS_BY_ID.get(p)?.takesWord)
      : stack || LENS_BY_ID.get(activeLens)?.takesWord === true);

  const notepad = (
    <BenchNotepad
      notes={notesHere}
      draft={draft}
      onDraftChange={setDraft}
      editingId={editingId}
      onEdit={(n) => {
        setNoteTarget(null);
        setEditingId(n.id);
        setDraft(n.body);
        setNotesTab(true);
        setFocusSignal((n2) => n2 + 1);
      }}
      onCancelEdit={() => {
        setEditingId(null);
        setDraft("");
        setNoteTarget(null);
      }}
      writingAbout={noteTarget?.reference ?? null}
      onWriteAboutPinned={() => setNoteTarget(null)}
      onSave={saveNote}
      onDelete={removeNote}
      saving={saving}
      focusSignal={focusSignal}
    />
  );

  return (
    <div
      className="bench"
      data-mode={mode}
      data-segments={segments}
      data-verse-sheet
      role="dialog"
      aria-modal={sheet ? "true" : undefined}
      aria-label={`The Bench, ${reference}`}
    >
      {/* The one divider. There is no second one anywhere inside the
          Bench: everything in there reflows on the width it is given
          instead. */}
      {!sheet && (
        <BenchDivider
          fraction={fraction}
          onPreview={applyWidth}
          onCommit={commitWidth}
        />
      )}

      {/* The grab handle. One tap collapses the Bench back to the toolbar;
          it never goes straight to closed, because the verse you selected
          is still selected and closing it would be answering a question
          nobody asked. Sheet only — a column has a close control instead. */}
      {sheet && (
        <button
          type="button"
          className="bench-grab"
          onClick={onCollapse}
          aria-label="Collapse the Bench"
        >
          <span className="bench-grab-bar" aria-hidden />
        </button>
      )}

      <div className="bench-head">
        <BenchPinned reference={reference.toUpperCase()} text={text} />
        {!sheet && (
          <button
            type="button"
            className="bench-close"
            onClick={onCollapse}
            aria-label="Close the Bench"
          >
            Close
          </button>
        )}
      </div>

      {railWanted && (
        <BenchWordRail
          words={taggedWords}
          activeKey={activeWordKey}
          onPick={(w) => {
            // A radio, not a checkbox: one word is always the word. Tapping
            // the one already chosen used to unchoose it, which left the
            // three word lenses with nothing to be about.
            setActiveWordKey(`${w.verse}|${w.wordIndex}`);
            setWordScrollSignal((n) => n + 1);
            // Aim the two lenses the rail is for, without moving anyone
            // away from a lens that has nothing to do with a word.
            if (!rack && !stack && !LENS_BY_ID.get(activeLens)?.takesWord) {
              setActiveLens("exposition");
            }
          }}
        />
      )}

      {/* Tabs, in the two column-less layouts. In Split the notepad joins
          them as an eighth tab, because the column is tall and narrow and a
          notepad below seven lenses would be a long way down. */}
      {!rack && (
        <div className="bench-tabs no-scrollbar" role="tablist" aria-label="Lenses">
          {LENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={!notesTab && !stack && activeLens === l.id}
              className="bench-tab"
              data-on={!notesTab && !stack && activeLens === l.id ? "true" : undefined}
              onClick={() => {
                setActiveLens(l.id);
                setNotesTab(false);
                setStack(false);
              }}
            >
              {l.label}
            </button>
          ))}
          {mode === "split" && (
            <button
              type="button"
              role="tab"
              aria-selected={notesTab}
              className="bench-tab"
              data-on={notesTab ? "true" : undefined}
              onClick={() => setNotesTab(true)}
            >
              Notes
            </button>
          )}
        </div>
      )}

      {/* The rack. Every panel at once, each with its own header and its own
          source line, closable and reorderable.

          The lens row underneath the presets lists all seven, always, and
          marks the ones that are open. It used to be a "Closed" list that
          only held the lenses you did not have open — so pressing one made
          it disappear from under your finger, which is both a control that
          runs away and, worse, a node React had already detached by the
          time the document heard the click. See the note in
          ScriptureReader's outside-click handler. */}
      {rack && (
        <>
          {/* Two rows, two kinds of control, and they used to be told apart
              only by what they happened to say. A mode sets the whole rack
              at once; a lens is one panel on or off. The labels say which
              is which, so the rows read as different instruments rather
              than as one long row of chips that wrapped. */}
          <div className="bench-control-row">
            <p className="meta bench-row-label" id="bench-mode-label">Mode</p>
            <div className="bench-presets" role="group" aria-labelledby="bench-mode-label">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="bench-preset"
                onClick={() => {
                  setPanels(p.panels);
                  setActiveLens(p.panels[0]);
                }}
              >
                {p.label}
              </button>
            ))}
            </div>
          </div>

          <div className="bench-control-row">
            <p className="meta bench-row-label" id="bench-lenses-label">Lenses</p>
            <div className="bench-presets" role="group" aria-labelledby="bench-lenses-label">
            {LENSES.map((l) => {
              const on = panels.includes(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  className="bench-preset"
                  data-on={on ? "true" : undefined}
                  aria-pressed={on}
                  onClick={() =>
                    setPanels((prev) =>
                      prev.includes(l.id)
                        ? prev.filter((x) => x !== l.id)
                        : [...prev, l.id]
                    )
                  }
                >
                  {l.label}
                </button>
              );
            })}
            </div>
          </div>
        </>
      )}

      <div className="bench-body" ref={bodyRef}>
        {rack ? (
          <>
            <div className="bench-rack">
              {panels.map((id, i) => {
                const meta = LENS_BY_ID.get(id);
                if (!meta) return null;
                return (
                  <section key={id} className="bench-panel">
                    <header className="bench-panel-head">
                      <span className="meta meta-strong">{meta.label}</span>
                      <span className="bench-panel-controls">
                        <button
                          type="button"
                          className="bench-act"
                          aria-label={`Move ${meta.label} earlier`}
                          disabled={i === 0}
                          onClick={() => setPanels((p) => swap(p, i, i - 1))}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="bench-act"
                          aria-label={`Move ${meta.label} later`}
                          disabled={i === panels.length - 1}
                          onClick={() => setPanels((p) => swap(p, i, i + 1))}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="bench-act"
                          aria-label={`Close ${meta.label}`}
                          onClick={() =>
                            setPanels((p) => p.filter((x) => x !== id))
                          }
                        >
                          ×
                        </button>
                      </span>
                    </header>
                    <BenchPaneBoundary label={meta.label}>
                      <BenchLensBody lens={id} data={lensData} />
                    </BenchPaneBoundary>
                  </section>
                );
              })}
            </div>

            <div className="bench-notes-col">
              <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-rog-ink">Notes</h2>
              {notepad}
            </div>
          </>
        ) : notesTab ? (
          notepad
        ) : stack ? (
          <div className="bench-stack">
            {LENSES.map((l) => (
              <section key={l.id} className="bench-stack-section">
                <p className="meta meta-strong">{l.label}</p>
                <BenchPaneBoundary label={l.label}>
                  <BenchLensBody lens={l.id} data={lensData} />
                </BenchPaneBoundary>
              </section>
            ))}
            {notepad}
          </div>
        ) : (
          <>
            <BenchPaneBoundary label={LENS_BY_ID.get(activeLens)?.label ?? "Lens"}>
              <BenchLensBody lens={activeLens} data={lensData} />
            </BenchPaneBoundary>
            {/* In the sheet the notepad follows the lens, which is the
                reading order the Bench is written in. In Split it has its
                own tab, so it isn't repeated here. */}
            {sheet && notepad}
          </>
        )}

        {/* Room to scroll past the end.
            Without it the last word in the rail can never reach the top of
            the pane: the scroller is already at its limit, so the browser
            clamps and the entry sits wherever it fell. This is empty space
            below the last entry, and only while a word lens is open. */}
        {railWanted && <div className="bench-scroll-tail" aria-hidden />}
      </div>

      <div className="bench-dock">
        {sheet && (
          <div className="bench-toggle" role="group" aria-label="Lens view">
            <button
              type="button"
              className="bench-toggle-btn"
              data-on={!stack ? "true" : undefined}
              aria-pressed={!stack}
              onClick={() => {
                setStack(false);
                setNotesTab(false);
              }}
            >
              One
            </button>
            <button
              type="button"
              className="bench-toggle-btn"
              data-on={stack ? "true" : undefined}
              aria-pressed={stack}
              onClick={() => {
                setStack(true);
                setNotesTab(false);
              }}
            >
              Stack
            </button>
          </div>
        )}

        <div className="bench-dock-actions">
          <button
            type="button"
            className="bench-action"
            onClick={() => {
              // In Split the notepad is a tab, so Note means "go there". In
              // the sheet and in a rack it is already on screen, so Note
              // means "bring it into view" — and in neither case does it
              // put the cursor in the field. A keyboard that opens because
              // a panel scrolled is a keyboard nobody asked for.
              if (mode === "split") setNotesTab(true);
              setStack(false);
              setNoteTarget(null);
              setFocusSignal((n) => n + 1);
            }}
          >
            Note
          </button>
          <button
            type="button"
            className="bench-action"
            data-on={sermonState === "added" ? "true" : undefined}
            disabled={sermonState === "saving"}
            onClick={() =>
              setSermonTarget({
                reference: formatVerseReference(book, chapter, spanStart, spanEnd),
                text
              })
            }
          >
            {sermonState === "added" && sermonAdded
              ? `Added to ${sermonAdded}`
              : sermonState === "saving"
                ? "Adding…"
                : "To sermon"}
          </button>
        </div>
      </div>

      {sermonTarget && (
        <BenchSermonPicker
          userId={userId}
          onPick={addToSermon}
          onClose={() => setSermonTarget(null)}
        />
      )}

      {/* The app's own picker, taking the choice rather than navigating to
          it. It sits above the Bench, and the counted body-scroll lock
          handles the two sheets being open at once. */}
      <ReferencePicker
        open={secondPickerOpen}
        onClose={() => setSecondPickerOpen(false)}
        bookSlug={second?.bookSlug ?? null}
        chapter={second?.chapter ?? null}
        onPick={(ref) => {
          const bk = bookBySlug(ref.bookSlug);
          if (!bk) return;
          openSecond({
            bookSlug: ref.bookSlug,
            book: bk.name,
            chapter: ref.chapter,
            start: ref.verse ?? 1
          });
          setSecondPickerOpen(false);
        }}
      />
    </div>
  );
}

/** Move one panel past its neighbour. */
function swap<T>(list: T[], a: number, b: number): T[] {
  if (b < 0 || b >= list.length) return list;
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

/**
 * The verses a free-typed reference is claiming — "Psalm 42:3–5" is 3 to 5,
 * "Psalm 42" is the whole chapter and returns null.
 */
function versesIn(reference: string | null): { start: number; end: number } | null {
  if (!reference) return null;
  const m = reference.match(/:\s*(\d+)\s*(?:[-–—]\s*(\d+))?/);
  if (!m) return null;
  const start = Number.parseInt(m[1], 10);
  if (!Number.isFinite(start)) return null;
  const end = m[2] ? Number.parseInt(m[2], 10) : start;
  return { start, end: Number.isFinite(end) ? end : start };
}
