# ELITE_EXCELLENCE_AUDIT.md — Elite and Pulse

Read-only excellence audit of Deep Waters Elite (the Bench, the sermon
workspace, the pastoral notepad) and the Pastors Dashboard (Church Pulse,
the care log, pastoral gating). Written 2026-09-09. **No code was changed
to produce this file.**

## Documents read before starting

| Document | Status |
|---|---|
| `APP_MAP.md` | Read — pre-Elite app. Out of scope except where Elite reads it. |
| `EXCELLENCE_AUDIT.md` | Read — scroll / keyboard / performance pass. Its findings are fixed and out of scope. |
| `STRESS_AUDIT.md` | Read — 37 findings across three tiers plus 18 confirmed clean. Out of scope. |
| `ELITE_MAP.md` | Read — the discovery pass this audit tests against. |
| Hardening fix log | Read — commit `80c9018`, 8 groups (length caps, rollback, JSON-for-API, cohort re-join, cohort save honesty). |
| Robustness fix log | Read — commit `9b7db0a`, 4 groups (fetch timeouts, calendar-day timezone maths, cache shape check, click-time PDF signing). |

**Note on the fix logs.** There are no `.md` fix logs in the repo. The two
prior passes are recorded as commit bodies — `80c9018` (Hardening) and
`9b7db0a` (Robustness). I read both in full, plus `0a75385` (Polish) and
`d716d50` (Excellence) for completeness, since the last of those is what
wrote `EXCELLENCE_AUDIT.md`.

Everything fixed in those four passes is out of scope. Everything specific
to the pre-Elite app is out of scope. What follows is only what is new.

---

## Summary

| Tier | Count | Meaning |
|---|---|---|
| **P0** | **0** | Nothing in Elite or Pulse breaks scroll, and nothing opens the keyboard unasked. |
| **P1** | 3 | Visible on Elite/Pulse pages. |
| **P2** | 9 | Cleanup. |
| ✓ | 24 | Confirmed clean. |

**Read this one first.** The most serious finding in the audit is **P1‑A —
Stack mode never releases past the first lens.** It is tagged P1 because
the P0 definition for this pass is scroll and keyboard, and it is neither.
Under a correctness rubric it is a P0: four of the seven lenses tell the
pastor "no data for this verse" when they have never been asked. It is
reachable from the Stack toggle on any phone in portrait.

---

# Group 1 — Scroll and layout in the Bench

## Scroll containers, by mode

There is **one scroll container in the Bench**: `.bench-body`
([globals.css:2113](app/globals.css:2113)) — `flex: 1 1 auto`,
`min-height: 0`, `overflow-y: auto`, `overscroll-behavior: contain`,
`-webkit-overflow-scrolling: touch`. Everything else in the column
(`.bench-head`, `.bench-rail`, `.bench-tabs`, `.bench-dock`) is
`flex: 0 0 auto` and does not scroll vertically. Two strips scroll
horizontally on their own: `.bench-rail` and `.bench-tabs`, both
`overflow-x: auto`.

| Mode | Body locked? | What scrolls |
|---|---|---|
| `sheet` | **Yes** — `useLockBodyScroll(open && sheet)` ([BenchLayer.tsx:136](components/BenchLayer.tsx:136)) | `.bench-body` only. `overscroll-behavior: contain` stops chaining to the locked page. **Works.** |
| `split` | No | Reader scrolls behind; `.bench-body` scrolls independently. **Works.** |
| `desk` | No | Reader scrolls behind; `.bench-body` scrolls, with the rack and the notepad **sharing it**. |
| `wide` | No | Same as desk, rack in two columns. |

**Sheet mode inner scroll under a locked body: confirmed working.** The
lock is `overflow: hidden` on `body`; `.bench-body` is a separate scroller
with `overscroll-behavior: contain`, which is a stronger containment than
any pre-Elite sheet has.

**Split mode: confirmed working.** The body is deliberately not locked, and
`html[data-bench="beside"] body { padding-right: min(420px, 46vw) }`
narrows the reader so the fixed Bench does not cover text. I checked all
three width pairs and they match exactly: split `min(420px,46vw)`, desk
`min(760px,62vw)`, wide `min(1040px,66vw)` — the Bench width and the body
padding are the same expression in each case, so there is no sliver of
text under the panel and no dead gutter beside it.

### P2‑A — The notepad column does not scroll independently of the rack
- **Where.** [globals.css:2136](app/globals.css:2136) `.bench-notes-col
  { position: sticky; top: 0 }` inside
  [globals.css:2121](app/globals.css:2121)
  `.bench[data-mode="desk"] .bench-body { display: grid; grid-template-columns: minmax(0,1fr) 300px }`.
- **What actually happens.** The rack and the notepad are two grid children
  of the single `.bench-body` scroller. The notepad is sticky-pinned to the
  top of that scroller, so it stays in view while the rack scrolls past it.
  It is **not** a second scroll container.
- **Answering the question directly:** no, they do not scroll
  independently. The behaviour is coherent — the notepad stays visible,
  which is what a notepad on a study desk should do — and no content
  becomes unreachable, because when the notepad is taller than the
  scrollport `position: sticky` stops engaging and it scrolls normally.
- **Where it reads oddly.** With many notes on one verse and few open
  panels, the row height is set by the notepad, so the rack's short column
  sits at the top of a tall empty area. And `.bench-body` has
  `padding: 14px 16px 8px` while the sticky offset is `top: 0`, so the
  pinned notepad rides over that 14px of padding rather than resting
  below it.
- **Not fixing.** Recorded because the map claimed nothing about this and
  the question was asked explicitly.

### P2‑B — The grab bar promises a drag that does not exist
- **Where.** [BenchLayer.tsx](components/BenchLayer.tsx) `.bench-grab`, and
  [VerseToolbar.tsx:89](components/VerseToolbar.tsx:89) `.verse-grab`.
- **What.** Both are `<button onClick={…}>` with a 40×4 rounded bar inside.
  There is **no drag implementation anywhere in the Bench** — a whole-tree
  search for `onTouchStart` / `touchmove` / `onPointerDown` / `onDrag`
  across every Bench and Pulse component returns nothing.
- **Gesture conflict with the reader below: none, because there is no
  gesture.** A vertical swipe starting on the grab bar does nothing; the
  page behind is locked in sheet mode so it does not scroll either. The
  tap target is a correct 44px minimum.
- **The finding is the affordance, not a bug.** A grabber is the platform's
  word for "drag me". It taps to collapse and that is all it does. Either
  implement the drag or use a control that does not look like a handle.

## Body-lock leaks

**Fully clean, and Elite is what cleaned it.** `lib/useLockBodyScroll.ts`
is the counted hook that `EXCELLENCE_AUDIT.md` filed as a P2 ("Two open
sheets can leak a locked body") and deferred. It arrived with Elite, and
the migration is complete:

- Eight components use it: `BenchLayer`, `PulseCheckOn`, `MoreSheet`,
  `VerseNoteSheet`, `CompareSheet`, `DayPicker`, `ReferencePicker`,
  `TranslationSwitcher`.
- `grep -rn "body.style.overflow" components app` returns **nothing**
  outside the hook. No component still captures and restores on its own,
  so the A-opens/B-opens/A-closes race that motivated the hook cannot
  happen any more.

Every mount site pairs correctly:

| Site | Lock condition | Release paths checked |
|---|---|---|
| `BenchLayer:136` | `open && sheet` | Collapse (`phase → "collapsed"` makes `open` false), close (`selected` empties → `benchPhase` → `"closed"`), unmount when `anchor` goes null, mode change out of sheet (rotate/fold/resize), route change. All release. |
| `PulseCheckOn:88` | `row !== null` | See below. |

**Route change.** Neither surface navigates from inside itself — there is
no `<Link>` and no `router.push` anywhere in the Bench or in the Pulse
person sheet — so the only way out is a control that clears state or a
navigation that unmounts the tree. React runs effect cleanup on unmount in
both cases. **No path found that leaves the counter positive.**

### P2‑C — The lock makes `body` a scroll container, against a documented decision
- **Where.** `lib/useLockBodyScroll.ts` sets
  `document.body.style.overflow = "hidden"`, against the explicit note at
  [globals.css:186-195](app/globals.css:186) which chose
  `overflow-x: clip` over `hidden` precisely because *"`overflow-x: hidden`
  on body makes body a scroll container in its own right (the other axis
  computes to `auto`), and once it is one, every `position: sticky` inside
  it measures itself against body instead of the window."*
- **Live impact: none.** The two sticky consumers are safe by accident of
  timing. `.bench-notes-col` only exists in desk/wide, where the body is
  never locked. `.reading-header` is behind a sheet on a page that cannot
  scroll while the lock is held, so sticky not engaging is invisible.
  Restore is correct — the inline shorthand is removed and `clip` applies
  again.
- **Why it is worth writing down.** It is latent. The next sheet that locks
  the body on a page with a visible sticky element will regress silently,
  and the reasoning that would explain it is 1,900 lines away in the
  stylesheet. `overflowY = "hidden"` would hold the page still without
  creating the scroll container.

## Sticky headers inside Bench panes

**Nothing to fix.** The rack panel headers
([BenchLayer.tsx](components/BenchLayer.tsx), `.bench-panel-head`) are
**not sticky** — they are plain flex rows. The only sticky element in the
Bench is `.bench-notes-col`, and its ancestor chain is
`.bench-notes-col → .bench-body (overflow-y: auto — the scroll container,
which is what sticky needs) → .bench (position: fixed, no overflow set)`.
No `overflow: hidden` parent anywhere in that chain, so sticky engages
correctly. Confirmed by reading every rule that matches `.bench`.

## Rotation, fold, Split View drag

The map's claim is that state survives because CSS switches modes rather
than swapping components. **That is true of the component tree** — one
`BenchLayer`, `data-mode` on the root, no conditional mounting per mode, so
a rotation is a re-render and the pinned verse, the chosen word, the open
panels and the half-written note in the composer all persist.

But three effects do act on a mode change, and one of them produces a
state with no visible control:

1. [BenchLayer.tsx:296](components/BenchLayer.tsx:296) —
   `if (mode !== "split") setNotesTab(false)`. **A deliberate reset**, and
   documented: outside split the notepad is not a tab, so leaving the tab
   selected would land you on a layout with no active lens. Correct.
2. [BenchLayer.tsx:302](components/BenchLayer.tsx:302) — on entering a rack
   mode, the active lens is prepended to `panels` if missing. **An
   addition, not a reset.** Correct, and documented.
3. `stack` is untouched by any mode change — see P2‑D.

### P2‑D — `stack` survives into a mode whose control for it does not exist
- **Reproduce.** Phone portrait (`sheet`). Tap **Stack**. Rotate to
  landscape → `modeForViewport` returns `split` (the height rule: any
  window under 500px tall is split). Now:
  - The One/Stack toggle is gone — it renders under `{sheet && …}` in the
    dock, and this is no longer sheet mode.
  - The body still renders the stacked branch, because the render is
    `rack ? … : notesTab ? … : stack ? <stack> : <single lens>` and `stack`
    is still true.
  - **No tab appears selected**, because every tab's `data-on` is
    `!notesTab && !stack && activeLens === l.id`.
- **What the pastor sees.** A stacked list of all seven lens headings, an
  unselected tab strip above it, and nothing on screen that explains the
  state or offers a way back to it.
- **Recoverable?** Yes — tapping any tab calls `setStack(false)`. So it is
  confusing rather than trapping.
- **Compounding.** In this state the Stack fetch chain is also running in a
  420px column. See P1‑A, which makes that chain wrong as well as narrow.

## The Pulse person sheet — body scroll on every close path

**Confirmed clean on all four paths.** `useLockBodyScroll(open)` at
[PulseCheckOn.tsx:88](components/PulseCheckOn.tsx:88) where
`open = row !== null`, and the parent holds `row` in `useState`:

| Path | Mechanism | Result |
|---|---|---|
| Backdrop tap | `onClick={onClose}` ([:169](components/PulseCheckOn.tsx:169)) → `setOpen(null)` in the parent | `open` false → cleanup → unlock ✓ |
| Escape | keydown listener ([:93](components/PulseCheckOn.tsx:93)), registered only while open, removed in cleanup | ✓ |
| Close button | [:306](components/PulseCheckOn.tsx:306) → same `onClose` | ✓ |
| Back button / navigation | The sheet is not a route, so back leaves `/pulse` entirely and unmounts `PulseCheckOn`; the hook's cleanup runs on unmount | ✓ |

There is no `<Link>` and no `router.push` inside the sheet, so there is no
path that navigates while leaving the lock held.

### P2‑E — The Pulse sheet lacks the overscroll containment the Bench has
- **Where.** [PulseCheckOn.tsx:179](components/PulseCheckOn.tsx:179) —
  `max-h-[85vh] overflow-y-auto` on `.bottom-glass`, and `.bottom-glass`
  ([globals.css](app/globals.css)) sets only `background` and
  `border-top`. No `overscroll-behavior`.
- **Why it matters.** The Bench sets `overscroll-behavior: contain` on both
  `.bench` and `.bench-body`. The Pulse sheet inherits the pre-Elite sheet
  pattern instead, which relies on the body lock alone. On iOS the body
  lock is imperfect, and a flick past the end of a long care log can chain
  to the page behind.
- **Scope note.** This is the pattern every pre-Elite sheet uses, so it is
  inherited rather than introduced. Flagged because Pulse is new code that
  could have taken the stronger of the two available patterns, and the
  stronger one is in the same codebase.

---

# Group 2 — Keyboard and input on Elite and Pulse

## No keyboard opens unasked — confirmed clean

A whole-tree search across every Bench component, `PulseCheckOn`,
`SermonEditor`, `NewSermonButton`, `MoreSheetPastoralRows`, `app/pulse` and
`app/sermons` for `autoFocus` and `.focus()` returns **nothing**. The rule
`EXCELLENCE_AUDIT.md` established when it removed the `VerseNoteSheet`
autofocus has been held throughout Elite and Pulse.

Two places deserve credit rather than a finding:

- **The Bench's Note action does not focus the field.** [BenchNotepad.tsx](components/BenchNotepad.tsx)
  scrolls the composer into view on `focusSignal` and stops there, with the
  reason written in the file: *"a keyboard that opens because a panel
  scrolled is a keyboard nobody asked for."*
- **The Pulse care composer does not exist until asked for.** The textarea
  is inside `{composing && …}`, and `composing` starts false. Opening the
  person sheet renders **no text input at all** — so the question "does
  opening the sheet pull up the keyboard" has a stronger answer than "no":
  there is nothing there that could. The keyboard needs two deliberate
  taps (Add a note → the field).

## Every input and textarea in Elite and Pulse

| Field | File | `type` | `enterKeyHint` | `maxLength` | Server cap |
|---|---|---|---|---|---|
| Bench note composer | [BenchNotepad.tsx:128](components/BenchNotepad.tsx:128) | textarea | `done` ✓ | — | ✓ `VERSE_NOTE_MAX` via `/api/verse-note` |
| Care note composer | [PulseCheckOn.tsx:254](components/PulseCheckOn.tsx:254) | textarea | `done` ✓ | `.slice(0, CARE_NOTE_MAX)` ✓ | ✓ `capText` in the route |
| Sermon title | [SermonEditor.tsx:118](components/SermonEditor.tsx:118) | **missing** | **missing** | **missing** | **none** |
| Sermon passage | [SermonEditor.tsx:129](components/SermonEditor.tsx:129) | **missing** | **missing** | **missing** | **none** |
| Sermon block body | [SermonEditor.tsx:180](components/SermonEditor.tsx:180) | textarea | **missing** | **missing** | **none** |
| Sermon status | [SermonEditor.tsx:142](components/SermonEditor.tsx:142) | `<select>` | n/a | n/a | check constraint |
| Preached on | [SermonEditor.tsx:157](components/SermonEditor.tsx:157) | `date` ✓ | n/a | n/a | column type |

There is **no inline search anywhere in the Bench** — the word rail, the
lens tabs and the panel chips are all buttons.

### P2‑F — The sermon workspace missed the keyboard-hint sweep
- **The established pattern**, from the hardening pass and confirmed clean
  in `STRESS_AUDIT.md`, is visible at
  [AnnouncementForm.tsx:55](components/AnnouncementForm.tsx:55) and
  [CohortSettingsForm.tsx:84](components/CohortSettingsForm.tsx:84):
  `type="text"` + `enterKeyHint="next"` + `maxLength={CONST}` where the
  constant comes from `lib/limits.ts`.
- **The sermon editor has none of the three** on its title, passage or
  block fields. It was written after the sweep, so nothing regressed — the
  sweep simply never reached it.
- **Visible effect.** On iOS the title and passage fields get a generic
  "return" key rather than "next"/"done", and the browser may offer
  unrelated autofill on an unlabelled `<input>` with no `autoComplete`.
  Small, but it is the one place in the app where a text field does not
  follow the house pattern.

### P2‑G — The sermon workspace writes past `lib/limits.ts` entirely
- **Where.** [SermonEditor.tsx:73](components/SermonEditor.tsx:73) writes
  `title`, `passage_ref` and the whole `blocks` array straight to Supabase
  from the client. [NewSermonButton.tsx:18](components/NewSermonButton.tsx:18)
  and [BenchLayer.tsx:516-548](components/BenchLayer.tsx:516) do the same.
  There is no `/api/sermon` route.
- **Why this is a finding and not a preference.** The hardening pass moved
  *every* user-input write off the client for exactly this reason —
  `/api/me`, `/api/testimonial` and `/api/verse-note` were all created in
  that pass so `PROFILE_NAME_MAX`, `TESTIMONY_MAX` and `VERSE_NOTE_MAX`
  could be enforced server-side. `STRESS_AUDIT.md` T1‑A is nine findings
  saying the same thing nine ways. The sermon workspace reintroduces the
  pattern in new code: three uncapped text fields and an uncapped jsonb
  array, written directly by the browser.
- **Reachable today.** Paste a long document into one block, or hold a key
  in the title. Nothing refuses it. `blocks` is `jsonb` with no size limit.
- **Blast radius is narrower than T1‑A was.** RLS is own-rows-only, so a
  bloated sermon is only ever rendered back to its own author — no feed,
  no cross-user layout break. That is why this is P2 and not higher. It
  does feed P1‑C below.
- **Care log, by contrast, is clean.** `grep 'from("care_log")'` returns
  only [route.ts:52](app/api/pulse/care/route.ts:52) and
  [route.ts:131](app/api/pulse/care/route.ts:131) — server-side, in the API
  route, capped by `capText`. **No client-side direct write to `care_log`
  anywhere.**

---

# Group 3 — Performance on Elite and Pulse

## Bundle sizes after the pre-audit fixes

Clean `rm -rf .next && next build`:

| Route | Page size | First Load JS | Over 200 kB? |
|---|---|---|---|
| `/pulse` | 3.8 kB | **179 kB** | no |
| `/sermons` | 1.36 kB | **177 kB** | no |
| `/sermons/[id]` | 2.59 kB | **178 kB** | no |
| `/read` | 1.81 kB | **194 kB** | no |
| `/bible/[book]/[chapter]` | 384 B | **192 kB** | no |
| `/bible/[book]/[chapter]/[verse]` | 384 B | **192 kB** | no |
| Shared by all | — | 87.3 kB | — |
| Middleware | — | 85.9 kB | — |

**No route is over 200 kB.** For the record, the pre-audit dynamic-import
pass moved `/read` from 201 kB to 194 kB and
`/bible/[book]/[chapter]` from 200 kB to 192 kB — both were over the line
before it, and both are the routes a member loads.

## The Bench's dynamic import — confirmed clean

`BenchLayer` is `dynamic(() => import("./BenchLayer"), { ssr: false })` at
[ScriptureReader.tsx:42](components/ScriptureReader.tsx:42), rendered under
`{showBench && anchor && …}`. `showBench = isPastoral && !suppressBench &&
!licensed`; `anchor` is the first selected verse. So the chunk is requested
**the first time a pastoral reader selects a verse** — one selection ahead
of the tap on the Bench chip, which is the right moment: it is warm when
asked for, and never fetched for a member. Verified against
`.next/app-build-manifest.json`: the chunk carrying `bench-rail`,
`Sermon prep` and the lens names is listed for **no page**.

## Lens fetch gating

`lensVisible` ([BenchLayer.tsx:176](components/BenchLayer.tsx:176)) is
correct as written: `!open → false`, rack → `panels.includes(id)`,
`notesTab → false`, `!stack → activeLens === id`, else the stack ordering.
On a Bench opened in sheet mode with the default `activeLens:
"translations"`, only the Translations lens is live — `wantsWords` is
false, so the 400-row `verse_words` query and the Strong's lookup behind it
never fire. **Confirmed: no lens fetches on Bench open unless its panel is
visible in the current layout** — with the exception in P2‑H.

### P1‑A — Stack mode never releases past the first lens
- **The claim under test.** *"In Stack mode every lens is on screen at
  once, and `active` is handed to them one at a time as each finishes, so a
  stacked Bench fills in from the top rather than firing seven queries at
  the same moment."* (`lib/useStudyLens.ts`, and the same claim in
  `ELITE_MAP.md` §3.2.)
- **What the code does.** `stackReady` starts at 0
  ([BenchLayer.tsx:170](components/BenchLayer.tsx:170)) and is advanced
  only by `onSettled: stack ? advanceStack : undefined`, which is passed to
  five `useStudyLens` calls — words ([:197](components/BenchLayer.tsx:197)),
  concordance ([:241](components/BenchLayer.tsx:241)), crossRefs
  ([:252](components/BenchLayer.tsx:252)), wordStudy
  ([:260](components/BenchLayer.tsx:260)) and commentary
  ([:268](components/BenchLayer.tsx:268)).
- **The break.** In stack mode `lensVisible(id)` is
  `LENSES.findIndex(l => l.id === id) <= stackReady`. With `stackReady = 0`
  the only visible lens is index 0, which is **`translations`** — and
  Translations is not a `useStudyLens`. It runs through `useParallelRows`,
  which has no `onSettled` and never calls `advanceStack`. Index 1
  (`words`) is therefore never visible, never fetches, never settles, and
  never advances the counter. **`stackReady` is 0 forever.**
- **What the pastor sees.** All seven panes render (the stack branch maps
  `LENSES` unconditionally), but four of them are handed `data: null,
  loading: false` and render their empty state as a statement of fact:
  - Words → *"No tagged words for this verse."*
  - Word study → *"No word study on this verse."*
  - Cross refs → *"No cross references for this verse."*
  - Commentary → *"No commentary on this passage."*
  Concordance shows *"Choose a word from the rail above"* with no rail,
  because the rail is built from the words that never loaded. Only
  Translations and The house work, because both are gated by their own
  `wantsTranslations` / `wantsHouse` flags rather than by `lensVisible`.
- **Why this is the worst finding in the audit.** These are not blank
  panes. They are four confident, false negatives on a study tool, on a
  passage that may have a hundred cross references. A pastor checking
  whether Matthew Henry wrote on a verse gets "No commentary on this
  passage" and moves on.
- **Reachability.** The Stack toggle is in the sheet dock — any phone in
  portrait. And per P2‑D the state survives a rotation into split, where
  the toggle that created it is not even visible.
- **Shape of a fix** (not applied): start the chain rather than waiting for
  it — give `useParallelRows` an `onSettled`, or seed `stackReady` from the
  index of the first `useStudyLens` lens, or advance once on mount.

### P2‑H — Two lenses fetch while the Notes tab is showing
- **Where.** [BenchLayer.tsx:362](components/BenchLayer.tsx:362)
  `wantsTranslations = rack ? panels.includes("translations") : stack ||
  activeLens === "translations"` and
  [:380](components/BenchLayer.tsx:380) `wantsHouse` in the same shape.
- **The gap.** Both are hand-written parallels of `lensVisible` that omit
  its `if (notesTab) return false` clause. In split mode with the Notes tab
  selected, `lensVisible` is false for all seven lenses — but
  `wantsTranslations` is still true if `activeLens` is `translations`
  (the default), so `useParallelRows` stays active.
- **Cost.** Changing the verse selection while sitting on the Notes tab in
  split mode empties the row map and issues **six `/api/bible/verse-text`
  requests** for a pane nobody is looking at. Bounded (six, then cached per
  passage) and narrow (split mode + Notes tab + a verse change), which is
  why it is P2 and not P1.
- **Also worth noting:** these two flags exist *because* Translations and
  House are not `useStudyLens` consumers — the same asymmetry that causes
  P1‑A. One gating predicate would close both.

## Round trips in the study lenses — confirmed clean

**No lens does one-fetch-per-reference anywhere.** I traced every path in
`lib/studyData.ts`:

- `fetchConcordance` → one `verse_words` query with `count: "exact"` and a
  `.range()` page, then **one** `fetchVerseTexts` for the whole page.
- `fetchCrossRefs` → one `cross_refs` query, then **one** `fetchVerseTexts`
  for all targets.
- `fetchVerseTexts` is the shared batched path and is written against
  exactly this failure: PostgREST has no tuple `IN`, so it builds an `OR`
  of `and(book.eq.…,chapter.eq.…)` clauses over the distinct chapters and
  filters the verses in code — *"A page of twelve references touches at
  most twelve chapters, and this is one request rather than twelve."*
- `fetchTaggedWords` → one query; `fetchStrongsEntries` → one `.in()`.

So each of these lenses is a **two-request waterfall**, never an N+1. The
waterfall is inherent (you cannot ask for the texts before you know the
references) and both halves are bounded by `.limit()` / `.range()`.

The one place with a request per item is `useParallelRows` — one
`/api/bible/verse-text` per translation, six on open. That is deliberate
and pre-Elite: it is lifted unchanged out of `CompareSheet` so each line
loads and fails independently, and it rides the server-side `bible_cache`.
Not a finding.

## Pulse — confirmed clean

- **No waterfall.** [app/pulse/page.tsx:53](app/pulse/page.tsx:53) issues
  all five RPCs in a single `Promise.all`. Nothing on the page awaits
  another query's result.
- **Every list query carries a `.limit()`**: `pulse_check_on` 40,
  `pulse_cohorts` 60, `pulse_curve` 90, `pulse_prayers` 20 — passed both as
  an RPC parameter and chained on the PostgREST call, and clamped again
  inside each function with `limit greatest(1, least(p_limit, 200))`.
- **The person sheet fetches on open, not up front.** The `useEffect` in
  `PersonSheet` is keyed on `userId`, which is `row?.user_id ?? null`, so
  `GET /api/pulse/care?user=…` fires only when a name is tapped. The list
  itself carries no per-person payload beyond the seven `CheckOnRow`
  fields.
- **The dashboard render performs no write, and cannot.** All six
  `pulse_*` functions are declared `stable`
  (`2026_09_14_church_pulse.sql`), and Postgres refuses to execute
  `INSERT` / `UPDATE` / `DELETE` inside a non-`VOLATILE` function. This is
  a guarantee from the engine, not a promise from the code — the dashboard
  could not write on render even if someone added a statement to it.
  `is_pastoral_user()` is likewise `sql stable`.
- Aggregation cost is deferred per your answer to open question #6
  ("revisit at 500 members") and is not re-raised here.

### P1‑B — `/sermons` reads every block of every sermon to print a count
- **Where.** [app/sermons/page.tsx:23](app/sermons/page.tsx:23) —
  `.select("*")` over up to 200 rows, then
  [:60](app/sermons/page.tsx:60) `const blocks = readBlocks(s.blocks)` per
  row, used only for `blocks.length`.
- **What is transferred.** The full `blocks` jsonb of every sermon the
  pastor has ever written, to render a title, a passage, a status, a date
  and a number. The list shows no block text at all.
- **Compounded by P2‑G.** Blocks are uncapped, so a pastor who pastes long
  passages into their sermons makes their own list page slower every time
  they write one. Two hundred sermons at a few kB of blocks each is a
  multi-megabyte payload for a page that renders none of it.
- **Shape of a fix** (not applied): select the columns the list actually
  renders, and get the count from `jsonb_array_length(blocks)` as a
  generated column or in a view — not by shipping the array.

### P1‑C — `/sermons/[id]` has no unsaved-changes guard on an uncapped editor
- Recorded as P1 rather than P2 because it is the one place in Elite where
  the *user loses work*, which reads as worse than slowness.
- [SermonEditor.tsx](components/SermonEditor.tsx) holds title, passage,
  blocks, status and date in local state and writes only on the **Save**
  button. There is no debounce, no `beforeunload`, and no route-change
  interception. Navigating away — including by tapping the Bench's app bar,
  or the browser back gesture — discards everything typed since the last
  Save, silently.
- Your answer to open question #4 assigns the fix (3-second debounced
  autosave plus a `beforeunload` guard) to the hardening pass. Listed here
  so the audit is complete, not to re-open the decision.

---

# Group 4 — Pastoral privacy gating

## Client bundle sweep

Rebuilt clean and cross-referenced every hit against
`.next/app-build-manifest.json`. **Feature names are out of the member's
bundle, with two exceptions.**

| String | Chunk | Pages that load it |
|---|---|---|
| `Church pulse` | `1900.*` | **on-demand only** ✓ |
| `Sermons` (the More row label) | `1900.*` | **on-demand only** ✓ |
| `Sermon prep` | `2217.*` | **on-demand only** ✓ |
| `bench-rail` | `2217.*` | **on-demand only** ✓ |
| `Word study`, `Concordance`, `Cross refs`, `The house` | `2217.*` | **on-demand only** ✓ |
| `/pulse` | `1900.*` + `/pulse` page chunk | **on-demand only** ✓ |
| **`Bench`** | **`1319-*`** | **`/read`, `/bible/[book]/[chapter]`, `/bible/[book]/[chapter]/[verse]`** ✗ |
| **`/sermons`** | **`8813-*`** | **31 pages** ✗ |

### P2‑I — The word "Bench" ships to every reader
- **Where.** [VerseToolbar.tsx:147](components/VerseToolbar.tsx:147). The
  chip label is a literal inside `{showBench && …}`, and `VerseToolbar` is
  a static import in `ScriptureReader`, so the string is in the reader's
  chunk for every member.
- **Extracted from the built chunk verbatim:**
  `{type:"button",className:"verse-action","data-elite":"true",onClick:b,children:"Bench"}`
- So a member reading `/read` has, in their own bundle, both the feature's
  name and a `data-elite` marker naming the product tier.
- The dynamic-import fix applied to `BenchLayer` does not reach this,
  because the *chip* must render for a pastoral reader before the Bench
  exists. Closing it means moving the chip itself behind the same boundary
  (a lazily-imported `<BenchChip>`), or rendering the label from a value
  that only arrives with the pastoral payload.

### P2‑J — `moreMatches()` still names `/sermons` in the 31-page chunk
- **Where.** [lib/nav.tsx:126](lib/nav.tsx:126) —
  `pathname.startsWith("/sermons")`. Extracted from `8813-*` verbatim:
  `e.startsWith("/announcements")||e.startsWith("/testimonials")||e.startsWith("/sermons")||e.startsWith("/admin")`
- `lib/nav.tsx` is imported by both `Nav` and `BottomNav`, so this string
  is on every signed-in page.
- **Flagging an interaction, not just the leak.** Your answer to open
  question #10 is to add `/pulse` to this same function in the polish pass.
  That one-line fix would put a second pastoral route name into this exact
  chunk, on all 31 pages — partially undoing the pre-audit pass. The two
  should be decided together: either `moreMatches` stops naming pastoral
  routes in shared code, or #10 is dropped.

## PostgREST disclosure surface — unchanged

Re-probed live against production with the anon key. Every response is
identical to the discovery pass:

| Request | Response | Verdict |
|---|---|---|
| `GET /rest/v1/care_log` | `200 []` | **Unchanged.** Existence disclosed, contents protected. |
| `GET /rest/v1/sermons` | `200 []` | **Unchanged.** Same. |
| `GET /rest/v1/no_such_table` | `404 PGRST205` | The contrast that makes the above a disclosure. |
| `GET /rest/v1/pulse_member_activity` | `401 "permission denied for view pulse_member_activity"` | **Unchanged.** Named 401, per open question #11 — schema pass. |
| `POST /rest/v1/rpc/pulse_numbers` | `401 "permission denied for function pulse_numbers"` | Unchanged. Anon only; `authenticated` is granted EXECUTE and receives `200 []`. |
| Same for `pulse_check_on`, `pulse_cohorts`, `pulse_curve`, `pulse_prayers` | `401`, named | Unchanged. |

On `care_log` specifically: the SELECT policy is
`is_pastoral_user() and subject_user_id <> auth.uid()`. For anon,
`auth.uid()` is null so `is_pastoral_user()` returns false; for a signed-in
non-pastoral member the same predicate is false. **Both receive a
byte-identical `200 []`** — the response does not distinguish a member from
a stranger, which is the correct shape.

## Elite reference tables — unchanged, accepted

| Table | Anon | Signed-in member | Rows live |
|---|---|---|---|
| `strongs_entries` | `200 []` | readable | 19,521 |
| `verse_words` | `200 []` | readable | 367,480 |
| `kjv_verses` | `200 []` | readable | 31,102 |
| `cross_refs` | `200 []` | readable | 344,756 |
| `commentary_entries` | `200 []` | readable | 4,823 |
| `word_study_entries` | `200 []` | readable | 15,753 |

All six carry `for select to authenticated using (true)` and no write
policy. Anon gets `200 []` because the policy is scoped `to authenticated`;
any signed-in member gets rows. **Unchanged since the discovery pass and
accepted** — this is public-domain reference data the Bench queries from
the browser, and the alternative (proxying 367k rows through a pastoral-only
RPC) would trade a weak inference for real latency. Recorded so the
acceptance is on the record rather than assumed.

## Route responses for a non-pastoral member

- **Signed out**, verified live: `/pulse`, `/sermons` and
  `/no-such-route` all return `307 → /login`. Indistinguishable.
- **Signed in, not pastoral:** `requirePastoral()` →
  `redirect("/today")` at [lib/auth.ts:61](lib/auth.ts:61), reached first
  in all three pages ([pulse:46](app/pulse/page.tsx:46),
  [sermons:18](app/sermons/page.tsx:18),
  [sermons/[id]:13](app/sermons/[id]/page.tsx:13)). The 307 to `/today`
  still fires and **no route leaks a 403 or any other response.**
  `/sermons/[id]` additionally filters `.eq("user_id", userId)` and calls
  `notFound()`, so even a pastoral user cannot read another's sermon.
- **Not exercised with a live member session** — I have no member password
  and would not create a test account in production to get one. This is
  read from source, where the control flow is unambiguous: `redirect()`
  throws before any query runs.

## Where `is_pastoral` values appear in client payloads

- **Own row: yes, unchanged.** [Nav.tsx:52](components/Nav.tsx:52) selects
  `profiles.*` for the current user — deliberately, to survive the window
  between a deploy and a migration — so the viewer's own `is_pastoral`
  is in the payload on every page. Not a cross-user leak.
- **Another user's value: once, and only for admins.**
  [app/admin/users/page.tsx:86](app/admin/users/page.tsx:86) passes
  `isPastoral={u.is_pastoral === true}` into `<UserAdminControls>`, so that
  boolean is serialised into the RSC payload of `/admin/users` for every
  listed member. The page is behind `requireAdmin()` and renders an "Elite"
  badge from the same value, so the payload discloses nothing the screen
  does not. **This is the only such site**, and it is deliberate.
- **Nowhere else.** I checked every surface that carries other people's
  rows: `community_feed`, `leaderboard`, `finishers`, `cohort_summary` and
  all six `pulse_*` RPCs. None returns `is_pastoral`, and the
  `pulse_member_activity` view does not carry the column at all.

---

# Group 5 — Middleware and API gating

## `middleware.ts` — confirmed clean

`grep -n "pastoral\|pulse\|sermon\|Bench" middleware.ts` returns
**nothing**. The middleware still enforces only signed-in-ness and profile
existence. Every pastoral decision is made in a page guard
(`requirePastoral`), an API handler (`pastoralUser`), or the database
(`is_pastoral_user()` in six RPC guards and four RLS policies). Unchanged
and correct.

## `pastoralUser()` vs `requirePastoral()` — one real divergence

Not fixing, per your instruction. Comparing semantics line by line:

| | `requirePastoral` → `requireProfile` | `pastoralUser()` |
|---|---|---|
| Session | `getUser()`; none → `redirect("/login")` | `getUser()`; none → `null` → 404 |
| Profile query | `.from("profiles").select("*").eq("id", user.id).maybeSingle()` | **identical** |
| Flag test | `profile.is_pastoral === true` | `profile?.is_pastoral !== true` — **same predicate** |
| No profile row | `redirect("/onboarding")` | `null` → 404 |
| **Lookup error** | **`console.error` then `throw`** — deliberately, so a transient blip is not mistaken for "no profile" | **discarded** — destructures `{ data: profile }` only |

The first two divergences are unreachable in practice and correct by
design: the middleware already returns JSON `401 {"error":"unauthorized"}`
and `401 {"error":"profile-missing"}` for `/api/*` (hardening pass, group
3), so neither state ever reaches `pastoralUser()`. A redirect would be
wrong from an API route in any case.

### P2‑K — The API route discards the profile lookup error
- **Where.** [app/api/pulse/care/route.ts:35](app/api/pulse/care/route.ts:35)
  — `const { data: profile } = await supabase.from("profiles")…`. No
  `error` binding, no check.
- **Why `requireProfile` does the opposite.** The comment at
  [lib/auth.ts:38-45](lib/auth.ts:38) is explicit: *"Distinguish 'this
  account has no profile yet' from 'the lookup failed'. Treating them the
  same sent established members back through onboarding on any transient
  Supabase blip. A real fetch failure should surface, not quietly rewrite
  where someone is in the app."*
- **The divergence in practice.** During a Supabase blip, a pastor
  refreshing `/pulse` gets *"Could not load your profile. Refresh to try
  again."* — correct and actionable. The same pastor tapping a name on a
  page that is already loaded gets **`404 {"error":"Not found"}`**, which
  `friendlyError` renders as a not-found. The route tells them their own
  care log does not exist.
- **So: the re-implementation does not match `requirePastoral` exactly.**
  The flag test and the profile query are identical; the error handling is
  inverted. The `getPastoralUser()` extraction the map proposed would close
  it by construction.

---

# Confirmed clean

Things I would have flagged, checked, and found correct. Listed so the
audit is complete and so none of them is "fixed" later by someone reading
only the findings.

**Scroll and layout**
1. `.bench-body` is the single Bench scroller in all four modes, correctly
   sized with `flex: 1 1 auto` + `min-height: 0` — the pair that stops a
   flex child from refusing to shrink.
2. Sheet-mode inner scroll works under the body lock, with
   `overscroll-behavior: contain` on both `.bench` and `.bench-body`.
3. Split-mode reader scrolls independently; the Bench width and the body
   padding-right are the same expression in all three column modes, so no
   text hides under the panel.
4. No sticky pane headers exist, so none can break; the one sticky element
   has a clean ancestor chain with no `overflow: hidden`.
5. The body-lock migration is complete — eight surfaces on the counted
   hook, zero components still capturing `body.style.overflow` themselves.
   `EXCELLENCE_AUDIT.md`'s deferred P2 is closed.
6. No mount site can leave the lock counter positive: no `<Link>` and no
   `router.push` inside the Bench or the Pulse sheet, so every exit is a
   state change or an unmount, and both run cleanup.
7. The Pulse person sheet restores body scroll on all four close paths
   (backdrop, Escape, Close button, navigation).
8. `html[data-bench]` / `data-bench-mode` are set and deleted by an effect
   with correct cleanup; no path leaves the reader padded with no Bench.
9. Mode changes do not remount — one `BenchLayer`, `data-mode` in CSS — so
   the pinned verse, chosen word, open panels and half-written note all
   survive rotation, fold and a Split View drag.
10. Folding-phone handling reads `env(viewport-segment-*)` rather than
    assuming a hinge width, and forces `split` on either segment axis.

**Keyboard**
11. No `autoFocus` and no `.focus()` anywhere in Elite or Pulse.
12. The Bench's Note action scrolls the composer into view without focusing
    it, with the reason written in the file.
13. The Pulse care composer does not render until "Add a note" is tapped —
    opening the person sheet mounts no text input at all.
14. Both textareas that do exist carry `enterKeyHint="done"`.
15. The care note is capped on both sides — `.slice(0, CARE_NOTE_MAX)` on
    input and `capText` in the route.
16. The Bench notepad writes through `/api/verse-note`, so it inherits the
    hardening pass's `VERSE_NOTE_MAX` server cap.

**Performance**
17. No Elite or Pulse route exceeds 200 kB first-load JS.
18. The Bench chunk is requested only when a pastoral reader selects a
    verse, and is listed for no page in the build manifest.
19. No lens fetches on Bench open unless visible in the current layout
    (subject to P2‑H).
20. No study lens does one-fetch-per-reference; `fetchVerseTexts` batches
    by chapter with an `OR` of `and(…)` clauses, and says why in a comment.
21. Pulse issues five RPCs in one `Promise.all` — no waterfall.
22. Every Pulse list query carries a `.limit()`, three times over (client
    chain, RPC parameter, and a clamp inside each function).
23. The dashboard render cannot write: all six RPCs are `stable`, and
    Postgres refuses DML in a non-`VOLATILE` function.
24. `care_log` has no client-side write path — both writes are in the API
    route, behind the pastoral check and `capText`.

---

## Fix order, if these are taken in one pass

**P1 — Elite/Pulse visible**
1. **P1‑A** Stack mode never releases past lens 0 (four false "no data"
   panes). The most serious finding in this audit.
2. **P1‑B** `/sermons` ships every block of every sermon to print a count.
3. **P1‑C** `/sermons/[id]` loses unsaved work silently — already assigned
   to the hardening pass by your answer to open question #4.

**P2 — cleanup**
4. **P2‑G** Sermon writes bypass `lib/limits.ts` entirely (re-opens the
   `STRESS_AUDIT` T1‑A class in new code).
5. **P2‑I** The word "Bench" and `data-elite` ship to every reader.
6. **P2‑J** `moreMatches()` names `/sermons` on 31 pages — decide together
   with open question #10.
7. **P2‑K** The care API discards the profile lookup error, inverting
   `requireProfile`'s deliberate behaviour.
8. **P2‑D** `stack` survives into split mode with no control for it.
9. **P2‑H** Translations and House fetch behind the Notes tab.
10. **P2‑F** Sermon inputs missed the keyboard-hint sweep.
11. **P2‑C** The body lock makes `body` a scroll container, against a
    documented decision. Latent.
12. **P2‑E** The Pulse sheet lacks the `overscroll-behavior: contain` the
    Bench has.
13. **P2‑A** The notepad column is sticky-in-a-shared-scroller, not an
    independent scroller.
14. **P2‑B** The grab bar promises a drag that does not exist.

**Explicitly not raised**
- Pulse aggregation cost — deferred to 500 members per open question #6.
- The `pulse_member_activity` named 401 — schema pass per #11.
- `sermons` insert policy not gated on the flag — schema pass per #5.
- The `/pulse` redirect-not-404 trade-off — accepted per #13.
- Anything in `APP_MAP.md`, `EXCELLENCE_AUDIT.md` or `STRESS_AUDIT.md`
  that the hardening, robustness, polish or excellence passes already
  fixed.

---

*Read-only audit. No code, schema, or deployment was changed.
`ELITE_EXCELLENCE_AUDIT.md` is the only file created.*
