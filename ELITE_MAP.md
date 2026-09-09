# ELITE_MAP.md — Deep Waters Elite and the Pastors Dashboard

Read-only discovery pass over everything added since Elite work began. File
paths, table names, route names, policy names and row counts are all real
and were read off the repo and the live database. Written 2026-09-09.

**Scope.** `APP_MAP.md` (written 2026-09-08, last commit to touch it
`d716d50`) documents the app as it stood *before* Elite. This file documents
only what came after. The boundary is exact: `274cb99` is the last pre-Elite
commit, `51bd520` is "Deep Waters Elite: gated study layer for pastoral
users". Everything below is the delta `274cb99..HEAD`.

Nothing in the main app is re-documented. Where a pre-existing table or
component is named it is only because Elite or Pulse reads it.

**No files were modified in this pass.** This document is the only thing
created.

---

## 1. Scope and stack additions

### New dependencies
**None.** `git diff 274cb99..HEAD -- package.json package-lock.json` is
empty. Elite and Pulse are built entirely on what was already installed:
`@supabase/ssr`, `@supabase/supabase-js`, Next 14.2.15, React 18.3.1,
Tailwind. No charting library (the fall-away curve is hand-drawn SVG), no
state manager, no date library, no editor library.

The import scripts under `scripts/` run on Node with `@supabase/supabase-js`
only — no new dev dependency either. `scripts/import-strongs.mjs` and
`import-word-study.mjs` parse XML and CrossWire module text with hand-written
parsers rather than pulling in an XML library.

### New environment variables
**None.** The only two `process.env` reads across every new file are
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, both pre-existing
and both only in `scripts/lib-db.mjs`. Neither Elite nor Pulse reads an
environment variable at runtime in the app itself.

### New build, deploy or runtime config
- **None in the app.** No `vercel.json` was added. No new `runtime = "edge"`
  declarations. No `export const dynamic` / `revalidate` / `fetchCache` in
  any new page — `/pulse`, `/sermons` and `/sermons/[id]` are dynamic by
  default because they read cookies through the Supabase server client.
- **`.gitignore`** gained one entry: `scripts/.data/`, the downloaded study
  corpora. They are large and not ours to redistribute.
- **`scripts/README.md`** is new and is the operational runbook: fetch the
  datasets, run two migrations, then import. It also carries the licence
  table (see §6).

---

## 2. Routes and pages

### New routes

| Route | File | Component | Auth check | `is_pastoral` gate | Renders | Touches |
|---|---|---|---|---|---|---|
| `/pulse` | [app/pulse/page.tsx](app/pulse/page.tsx) | Server | `requirePastoral()` | Yes — first line of the function | Church Pulse: four numbers, "Check on these", Cohorts, "Where people fall away", "Prayers waiting" | RPCs `pulse_numbers`, `pulse_check_on`, `pulse_cohorts`, `pulse_curve`, `pulse_prayers` |
| `/sermons` | [app/sermons/page.tsx](app/sermons/page.tsx) | Server | `requirePastoral()` | Yes | The pastor's own sermons, newest first, plus a "New sermon" button | `sermons` (own rows, `.limit(200)`) |
| `/sermons/[id]` | [app/sermons/[id]/page.tsx](app/sermons/[id]/page.tsx) | Server, wraps a client editor | `requirePastoral()` + `.eq("user_id", userId)` + `notFound()` | Yes | One sermon open for editing | `sermons` |

**The Bench is not a route.** It is a layer mounted inside the existing
reading screens — `/read` and `/bible/[book]/[chapter]` (and `/[verse]`) —
by `ScriptureReader`. There is no URL for it and no navigation to it.

### New layout files
**None.** `git diff --name-status` returns no new `layout.tsx` anywhere.
Both new page trees use the root layout. (`lib/useBenchLayout.ts` is a hook
about viewport size, not a Next.js layout.)

### New API routes

| Endpoint | Method | Purpose | Inputs | Output | Auth check | Role check |
|---|---|---|---|---|---|---|
| `/api/pulse/care` | GET | One person's activity facts plus their care log | `?user=<uuid>` | `{ok, person, log[]}` | `supabase.auth.getUser()` | `profiles.is_pastoral !== true` → **404** |
| `/api/pulse/care` | POST | Append a care-log entry | `{subject_user_id, kind: "reached_out"\|"note", body?}` | `{ok, entry}` | same | same, plus `subject_user_id === userId` → 400 |

Notes on the route ([app/api/pulse/care/route.ts](app/api/pulse/care/route.ts)):
- The gate returns 404, never 403 — a 403 would confirm there is something
  there. See §5 for where that promise does and does not hold.
- `body` is capped by `capText(body, CARE_NOTE_MAX)` (2000), the app's
  existing limits mechanism; `CARE_NOTE_MAX` is the one constant added to
  `lib/limits.ts`.
- The log read is two plain queries — rows, then author names — merged in
  code. That is the codebase's standing habit after HTTP 300s from ambiguous
  PostgREST relationships.
- `.limit(100)` on the log read; `.limit(authorIds.length)` on the names.

No other API route was added. `/api/prayer` (pre-existing) gained one
optional field, `needs_pastor`, sent only when true.

---

## 3. Elite study tool — the Bench

One component, one set of state, four arrangements. Opened from a seventh
chip on the verse toolbar ("Bench", violet border) which is rendered only
when the flag is on. It is a layer over the chapter, never a page.

### 3.1 Panel types (the seven lenses + the notepad)

Defined once in [lib/bench.ts](lib/bench.ts) as `LENSES`, so the sheet, the
split column and the desk rack all describe the same seven things in the same
order. Each carries a `label`, a `source` string printed at the foot of the
pane, and an optional `takesWord` flag.

| Lens | Component | Shows | Reads from |
|---|---|---|---|
| **Translations** | [BenchTranslations.tsx](components/BenchTranslations.tsx) | The pinned verse in every edition the app carries, 6 at a time then "Show more" | `/api/bible/verse-text` via `useParallelRows` — the same fetcher and the same `bible_cache` the Compare sheet uses |
| **Words** | [BenchWords.tsx](components/BenchWords.tsx) | Every tagged word of the verse with its Strong's number, lemma, transliteration and definition | `verse_words` + `strongs_entries` |
| **Word study** | [BenchWordStudy.tsx](components/BenchWordStudy.tsx) | Keil & Delitzsch (OT) and A. T. Robertson (NT) on the passage containing the verse | `word_study_entries` |
| **Concordance** | [BenchConcordance.tsx](components/BenchConcordance.tsx) | Every other verse using the chosen Strong's number, with the tagged phrase marked, 12 at a time; total count stated up front | `verse_words` (count + page) then `kjv_verses` for the text |
| **Cross refs** | [BenchCrossRefs.tsx](components/BenchCrossRefs.tsx) | Up to 14 references, strongest first, each with its verse text | `cross_refs` then `kjv_verses` |
| **Commentary** | [BenchCommentary.tsx](components/BenchCommentary.tsx) | Matthew Henry on the passage span containing the verse | `commentary_entries` |
| **The house** | [BenchHouse.tsx](components/BenchHouse.tsx) | What this church wrote about this passage — reflection text and amen count, **no names, no portraits, no links** | `community_feed` view, `.limit(40)` |
| *(Notepad)* | [BenchNotepad.tsx](components/BenchNotepad.tsx) | The pastor's own verse notes on this span, editable and deletable, with a composer | `verse_notes` — the **pre-existing** table, unchanged |

The house lens's privacy filter is the query itself: `community_feed` only
carries completions with a reflection actually written, from approved
members. A reflection left blank to stay private cannot appear and no verse
note ever can. The comment in the file is explicit that the filter lives in
the query and not in the renderer on purpose.

Each pane is wrapped in [BenchPaneBoundary.tsx](components/BenchPaneBoundary.tsx),
a React error boundary — one lens throwing does not take the other six, the
Bench, or the verse selection with it. This is the app's only error boundary.

### 3.2 The verse-sync mechanism

**There is no sync bus and no shared store.** Sync is prop flow, and that is
worth stating plainly because "verse sync" implies more machinery than exists.

1. The pinned verse is `ScriptureReader`'s own `selected: SelKey[]` state —
   the verses the reader tapped in the chapter.
2. `ScriptureReader` derives `spanStart`, `spanEnd`, `verseNumbers`,
   `reference` and `benchText` (the words read off the DOM, and only while
   the Bench is open) and passes them to `<BenchLayer>` as props.
3. `BenchLayer` composes them into one string:
   `const passageKey = \`${book}|${chapter}|${spanStart}|${spanEnd}\``.
4. **Every lens's fetch is keyed on `passageKey`.** `useStudyLens` re-runs
   its query when the key changes and keeps the answer when it does not.
   `useParallelRows` empties its row map on a new passage key.

So panels do not talk to each other; they all read the same props. A new
verse selection is a new `passageKey` and every visible lens re-asks its own
question exactly once.

**Where sync state lives:** entirely in `ScriptureReader` (the selection) and
`BenchLayer` (everything derived). Nothing is in a context, a store, a URL
parameter, or storage.

**How panels opt in or out:**
- *Of the verse* — they cannot. Every lens is about the pinned verse.
- *Of fetching* — `lensVisible(id)` in `BenchLayer` is the whole gate. A lens
  that is not on screen never runs its query. In tabs that is one lens; in a
  rack it is the open panels; in Stack it is all seven, released one at a
  time by a `stackReady` counter so a stacked Bench fills from the top rather
  than firing seven queries at once.
- *Of the word* — `takesWord: true` in the lens definition. Words, Word study
  and Concordance take the chosen word; the word rail only appears when one
  of those is on screen. Choosing a word from a lens that is not about words
  moves you to Word study.

**Word sync** is a second, smaller channel: `activeWordKey`
(`"<verse>|<wordIndex>"`) in `BenchLayer`, set from either the rail or the
Words lens, plus a `wordScrollSignal` counter whose only job is to bring the
chosen word's entry to the top of the pane over two animation frames.

### 3.3 Panel layout system

Four modes, chosen from the **CSS viewport** and never from a user agent
([lib/bench.ts](lib/bench.ts) `modeForViewport`, measured by
[lib/useBenchLayout.ts](lib/useBenchLayout.ts) through `matchMedia`):

| Mode | Condition | Shape |
|---|---|---|
| `sheet` | < 600px wide **and** ≥ 500px tall | 86dvh sheet over the chapter |
| `split` | 600–1023px, **or** any width under 500px tall | `min(420px, 46vw)` column beside the reader |
| `desk` | ≥ 1024px | `min(760px, 62vw)` column: rack + notepad column |
| `wide` | ≥ 1500px | `min(1040px, 66vw)`, rack in two columns |

Folding phones are handled explicitly: `horizontal-viewport-segments: 2` /
`vertical-viewport-segments: 2` force `split` and put the boundary on the
seam using `env(viewport-segment-*)`.

Because the mode is applied in CSS off `data-mode` rather than by swapping
components, a rotation, a fold or a Split View drag is a re-render and never
a remount — the pinned verse, active lens, open panels, chosen word and the
half-written note in the composer all survive.

**Add / remove / rearrange** (rack modes only — `desk` and `wide`):
- Four presets: Sermon prep, Word study, Devotional, Everything
  (`PRESETS` in `lib/bench.ts`). Pressing one replaces the panel set.
- A row of all seven lens chips, each toggling that panel on or off. The row
  always lists all seven and marks the open ones — deliberately, because an
  earlier "Closed" list removed a chip from under the finger that pressed it.
- Per-panel header controls: `↑` move earlier, `↓` move later, `×` close.
- In sheet/split there are tabs instead, plus a One/Stack toggle in the
  sheet, and a Notes tab in split only.

**Is layout state persisted per user? No.** `panels`, `activeLens`, `stack`,
`notesTab`, `activeWordKey`, `shown` and `concordancePage` are all
`useState` in `BenchLayer`. They reset to `PRESETS[0].panels` (Sermon prep)
and `activeLens: "translations"` whenever the Bench unmounts — which happens
on closing the selection or leaving the reading screen. Nothing is written to
`localStorage`, a cookie, or a table. **Flagged in §9.**

### 3.4 The sermon workspace

**Data model** — table `public.sermons` ([2026_09_11 migration](supabase/migrations/2026_09_11_elite_pastoral_and_sermons.sql)),
shape mirrored in [lib/sermons.ts](lib/sermons.ts):

```
id uuid pk · user_id uuid → profiles (cascade) · title text default ''
passage_ref text · blocks jsonb default '[]' · status text check
('draft'|'preached'|'archived') default 'draft' · preached_on date
created_at timestamptz · updated_at timestamptz
```

A block is `{ id, kind: "verse" | "text", reference?, text }`. `readBlocks()`
validates the jsonb defensively — anything without a string `text` is
dropped, a missing `id` is generated.

**Autosave: there is none.** [SermonEditor.tsx](components/SermonEditor.tsx)
has an explicit **Save** button that writes title, passage, blocks, status
and `preached_on` in one `update`, then shows "Saved" for 2200ms and calls
`router.refresh()`. Typing is local state only. Leaving the page loses
unsaved edits, and nothing warns you. **Flagged in §9.**

**Versioning: there is none.** One row, updated in place. `updated_at` is
maintained by the `touch_sermons_trigger`. No history table, no revisions,
no undo beyond the browser's own in a single textarea.

**Deletion** is two-tap-armed (4000ms) both for a block and for the whole
sermon, matching the Bench notepad's promise. No modal.

**"To sermon" from the Bench** (`toSermon` in `BenchLayer`): reads the
author's most recently updated `status = 'draft'` row; if one exists it
appends a verse block, otherwise it inserts a new draft titled with the
passage reference. Button state cycles idle → "Adding…" → "Added to your
draft" (2600ms).

### 3.5 The pastoral notepad

**It is not a new table.** The Bench's notepad reads and writes
`public.verse_notes` — the same rows, the same RLS, the same
private-to-the-author rule the reader already had. Elite deliberately does
not keep a second set of notes.

- **Linkage:** per verse *span*, not per verse. `notesHere` filters
  `n.book === book && n.chapter === chapter && n.verse_start <= spanEnd &&
  n.verse_end >= spanStart` — any note overlapping the pinned span.
- **RLS:** unchanged from the pre-Elite `2026_09_09_highlights_and_notes.sql`
  — all four verbs restricted to `auth.uid() = user_id`.
- **Writes** go through `createNote` / `updateNote` / `removeNote`, which
  were refactored *up* into `ScriptureReader` during Elite work so the note
  sheet and the Bench act on one implementation. Create and update go via
  `/api/verse-note` (server-side length cap); delete is a direct
  `supabase.from("verse_notes").delete()`.
- The composer's draft lives in `BenchLayer`, above the notepad, so a
  rotation or a fold does not lose half a sentence.
- The pane's own footer says "Private to you. Never shared to the feed."

### 3.6 Keyboard shortcuts

There is one, and it is not new vocabulary:

| Key | Where | Effect |
|---|---|---|
| `Escape` | `BenchLayer` (while open) | Collapse the Bench back to the verse toolbar, selection kept |
| `Escape` | `ScriptureReader` (pre-existing) | Clear the verse selection |
| `Escape` | Pulse person sheet | Close the sheet |

No shortcut for switching lenses, choosing a word, opening the Bench, saving
a note, or saving a sermon. No shortcut help surface.

### 3.7 Offline and caching behaviour

**No offline support at all.** There is no service worker anywhere in the
repo (`public/` holds no `sw.js`), no `localStorage`, no `sessionStorage`,
no IndexedDB, and Elite does not use the app's existing `lib/viewCache.ts`.

What caching exists is in-memory and per-mount:
- `useStudyLens` keeps one answer per `key` (`passageKey`, or
  `strongsId|passage|page` for the concordance) and will not re-fetch while
  the key is unchanged. A *failed* load clears the key so it can retry.
- `useParallelRows` keeps a `Map` of translation rows per passage, so
  reopening on a verse you already compared is instant.
- Server-side, the Translations lens rides the pre-existing `bible_cache`
  table because it goes through `/api/bible/verse-text`.

All of it is lost on unmount. Every study dataset query hits Supabase.

---

## 4. Pastors Dashboard (Church Pulse)

One server-rendered screen, top to bottom. Nothing on it is configurable —
no filters, no date pickers, no settings.

### 4.1 Widgets

| # | Widget | Shows | Reads | Cadence |
|---|---|---|---|---|
| 1 | **Four numbers** | Reading today · On track this week · Quiet 5+ days · New testimonies. Only the third carries the amber treatment. | `pulse_numbers(p_today, p_quiet_days)` | Server render |
| 2 | **Check on these** | A list of people, each with a name and one plain reason. Tapping opens a sheet. | `pulse_check_on(p_today, p_quiet_days, p_limit)`, `.limit(40)` | Server render; the sheet fetches on open |
| 3 | **Cohorts** | Every cohort with leader, "N of M reading", last activity date, and a 4px proportion bar. Quietest first. | `pulse_cohorts(p_today, p_limit)`, `.limit(60)` | Server render |
| 4 | **Where people fall away** | A single SVG line of completion by plan day, with the steepest fall marked in amber — or a written empty state | `pulse_curve(p_today)`, `.limit(90)` | Server render |
| 5 | **Prayers waiting** | Open prayers with no response, and prayers whose author asked for a pastor. Public prayer wall text. | `pulse_prayers(p_limit)`, `.limit(20)` | Server render |

The person sheet ([PulseCheckOn.tsx](components/PulseCheckOn.tsx)) shows last
read, quiet for, cohort, their leader, then the care log with "Mark reached
out" and "Add a note". It fetches `GET /api/pulse/care?user=…` on open — one
or two people get opened, not forty, so the data is not pre-loaded.

### 4.2 Congregation aggregations

All five aggregates are `SECURITY DEFINER` PL/pgSQL functions in
[2026_09_14_church_pulse.sql](supabase/migrations/2026_09_14_church_pulse.sql).
Four of them read one shared view, `public.pulse_member_activity`, which
carries **two timestamps per person and nothing else**:

- `last_read_at` = `greatest(max(completions.completed_at), max(chapter_reads.read_at))`
- `last_activity_at` = the same plus `max(comments.created_at)`,
  `max(reactions.created_at)`, `max(prayer_requests.created_at)`

| Aggregation | Grain | Tables |
|---|---|---|
| `reading_today` | one row per member → count | view |
| `on_track` | per member, over their own last 7 **plan days** | `profiles`, `completions` |
| `quiet` | per member, days since last activity | view |
| `new_testimonies` | 7-day window | `testimonials` |
| `pulse_check_on` | one row per member | view, `prayer_requests`, `prayer_prayed`, `leaderboard`, `cohorts`, `cohort_members` |
| `pulse_cohorts` | one row per cohort | `cohorts`, `cohort_members`, view |
| `pulse_curve` | one row per plan day 1–90 | `generate_series` × `profiles` × `completions` |
| `pulse_prayers` | one row per open prayer | `prayer_requests`, `prayer_prayed`, `profiles` |

**Anonymisation — read this carefully, because "anonymised" is the wrong
word for what this page does.**

Church Pulse is **deliberately not anonymised at the person level.** Naming
the person to check on is the entire feature; a pastoral care screen that
said "3 people are quiet" without saying who would be useless. Individual
members are named, photographed and opened in a sheet.

The guarantee is a different one, and it holds:

> **Activity only, never content.**

Confirmed by enumerating every column every RPC can return. Across all six
functions the return columns are: `uuid`s, `text` names (member, cohort,
leader), `text` photo URLs, `timestamptz`es, `boolean`s and `int`s — plus
exactly one text column carrying member-written words, `pulse_prayers.body`,
which is a prayer the author posted publicly to the prayer wall.

**No individual member *response* is exposed.** Specifically:
- No `completions.reflection` is selected anywhere on this page.
- No `verse_notes.body` is selected anywhere on this page.
- No `comments.body`, no `testimonials.body`, no `answered_note`.
- The `pulse_member_activity` view carries no text column at all except
  `name` and `photo_url`, so it *cannot* leak content — there is none in it.
- The React props serialised into the RSC payload for the client component
  are `CheckOnRow` only: `user_id, name, photo_url, kind, days_quiet,
  streak_before, cohort_name`.

The care log is the other text on the page, and it is pastor-written, not
member-written.

### 4.3 Cohort health

"Health" in this codebase is **two facts and no score**:

1. `read_this_week` / `member_count` — the count of distinct cohort members
   whose `last_read_at` falls in the last 7 days, over the member count.
   Rendered as "2 of 10 reading" and as a 4px bar.
2. `last_activity_at` — `max(last_activity_at)` across the cohort's members.
   This is the **sort key**: `order by max(a.last_activity_at) asc nulls
   first`, quietest first.

The bar is sonar green at or above `COHORT_HEALTHY_RATIO = 0.5`, Shoal amber
below it. There is no red, no rank number, no percentage beside a leader's
name, and cohorts are never ordered by performance. The section subhead says
so in words: "Quietest first. Not a ranking."

### 4.4 Admin actions accessible from Pulse

**None.** There is no announcement composer, no moderation control, no
approve/promote/remove, no report queue, and no link into `/admin`. The only
write the page can perform is a `care_log` insert, through
`POST /api/pulse/care`, permitted to pastoral users only.

Every admin action in the app remains where `APP_MAP.md` describes it, under
`/admin/*` behind `requireAdmin()`. The one admin surface Elite touched is
`/admin/users`, which gained a **Grant Elite / Remove Elite** control
([UserAdminControls.tsx](components/UserAdminControls.tsx)) and an "Elite"
badge beside "Admin". Permission model: the client writes
`profiles.is_pastoral`, and the database's `guard_is_pastoral_trigger`
silently reverts the change if the caller is not `is_admin()`.

### 4.5 Refresh behaviour

**On-demand, per request, no polling and no realtime.**

- `/pulse` is a server component. It reads `cookies()` via
  `todayForCurrentRequest()`, which makes it dynamic; Next re-renders it on
  every navigation to it. There is no `revalidate`, no `unstable_cache`, no
  ISR.
- The five RPCs are issued in one `Promise.all` — one round trip each, in
  parallel.
- There is **no Supabase realtime subscription** anywhere in Pulse, and no
  `setInterval`. The page is as fresh as the last load; a pastor refreshes to
  see change.
- The only client-side data motion is the person sheet: it fetches on open,
  and a written care entry is pushed onto the local log immediately so what
  you just did is visible without a reload.

---

## 5. Gating and pastoral privacy

### 5.1 Where `is_pastoral` is defined

A **column**, not a role and not a separate table:

```sql
alter table public.profiles
  add column if not exists is_pastoral boolean not null default false;
```

(`2026_09_11_elite_pastoral_and_sermons.sql`.) It is orthogonal to
`profiles.role` — a member can be pastoral without being an admin and an
admin is not pastoral by default.

**What governs its value:** `guard_is_pastoral()`, a `SECURITY DEFINER`
`BEFORE UPDATE` trigger on `profiles`. `profiles_update_own_or_admin` lets a
member update their own row, which is right for a name and wrong for this,
and PostgREST has no column-level grant expressible through a policy. So the
column is guarded at the row: if `new.is_pastoral is distinct from
old.is_pastoral and not public.is_admin()`, the trigger carries the old value
forward. No error is raised — the flag simply does not move, and the fields
the member was actually editing still save.

### 5.2 Every place it is checked

| Layer | Where | Check |
|---|---|---|
| Type | `lib/auth.ts:14` | `is_pastoral?: boolean \| null` — optional, so a pre-migration row reads false |
| Helper | `lib/auth.ts:52` | `isPastoral(profile)` → `profile.is_pastoral === true` |
| Page guard | `lib/auth.ts:59` | `requirePastoral()` → `requireProfile()` then `redirect("/today")` |
| Page | `app/pulse/page.tsx:46` | `await requirePastoral()` — first statement |
| Page | `app/sermons/page.tsx:18` | `await requirePastoral()` |
| Page | `app/sermons/[id]/page.tsx:13` | `await requirePastoral()` + own-row filter + `notFound()` |
| API | `app/api/pulse/care/route.ts:40` | `profile?.is_pastoral !== true` → 404 |
| Server prop | `app/read/page.tsx:184` | `isPastoral={profile.is_pastoral === true}` |
| Server prop | `components/ChapterView.tsx:83` | same |
| Client render | `components/ScriptureReader.tsx:908` | `showBench = isPastoral && !suppressBench && !licensed` |
| Client render | `components/VerseToolbar.tsx` | `showBench &&` — the chip does not exist otherwise |
| Client render | `components/Nav.tsx:150` | Elite lockup replaces the standard one |
| Client render | `components/MoreSheet.tsx:226,231` | Church pulse row, Sermons row |
| Admin UI | `app/admin/users/page.tsx:70,86` | Elite badge, control props |
| Admin UI | `components/UserAdminControls.tsx:62` | Grant / Remove Elite |
| DB helper | `2026_09_14:32` | `public.is_pastoral_user()`, `SECURITY DEFINER`, `search_path = public` |
| RLS | `2026_09_14:81,86,94,97` | Four `care_log` policies |
| RPC guard | `2026_09_14:243,332,435,487,534,610` | `if not public.is_pastoral_user() then return; end if;` in all six functions |

**`middleware.ts` does not check the flag at all.** It only enforces
signed-in-ness and profile existence. Every pastoral decision is made in a
page guard, an API handler, or the database.

### 5.3 Does a non-pastoral member see evidence Elite or Pulse exists?

Taking the brief's four tests one at a time, with what was actually observed.

**Nav item — PASS.** The Church pulse and Sermons rows in `MoreSheet` are
inside `{isPastoral && …}`. There is no locked row, no greyed row, no badge.
The Bench chip on the verse toolbar is inside `{showBench && …}`. The Elite
lockup in the app bar only replaces the standard one when the flag is on.

**Leaked route name in the client bundle — FAIL.** This is a real leak and
it is evidenced, not theoretical. `MoreSheet`, `Nav` and `VerseToolbar` are
client components shipped to everyone, and `BenchLayer` is a **static**
import in `ScriptureReader` (`import BenchLayer from "./BenchLayer"`, not
`next/dynamic`). Reading `.next/app-build-manifest.json`:

- `static/chunks/8813-*.js` contains the strings `"Church pulse"`, `"/pulse"`
  and `"Sermons"`, and it is listed for **31 pages** including `/today`,
  `/depth`, `/community`, `/bible`, `/day/[n]` — i.e. every signed-in page.
- `static/chunks/6913-*.js` contains the whole Bench (`"bench-rail"`, the
  lens labels, the source strings) and is listed for `/read`,
  `/bible/[book]/[chapter]` and `/bible/[book]/[chapter]/[verse]` — so every
  reader downloads and parses the entire study layer, pastoral or not.

A member who opens devtools can read the words "Church pulse", the seven lens
names, and the `/pulse` and `/sermons` paths.

**403 vs 404 distinguishable — MIXED.**
- *Signed out:* verified against production. `/pulse`, `/sermons` and
  `/no-such-route` all return `307 → /login`. Indistinguishable. **PASS.**
- *Signed in, not pastoral:* `requirePastoral()` calls `redirect("/today")`,
  so `/pulse` returns a 307 to `/today` while a genuinely nonexistent path
  returns a 404. **Distinguishable.** (Read from source; not exercised with a
  member session — see §5.4 and Open Questions.)
- *`/api/pulse/care`:* returns `404 {"error":"Not found"}`. A nonexistent API
  path returns Next's HTML 404. The JSON body is a tell, though a faint one.
- *PostgREST, verified live with the anon key:*

  | Request | Response |
  |---|---|
  | `GET /rest/v1/care_log` | `200 []` |
  | `GET /rest/v1/no_such_table` | `404 PGRST205 "Could not find the table…"` |
  | `GET /rest/v1/sermons` | `200 []` |
  | `GET /rest/v1/verse_words`, `strongs_entries`, `word_study_entries` | `200 []` |
  | `POST /rest/v1/rpc/pulse_numbers` | `401 {"message":"permission denied for function pulse_numbers"}` |
  | `GET /rest/v1/pulse_member_activity` | `401 {"message":"permission denied for view pulse_member_activity"}` |

  So `care_log` and `sermons` are **disclosed as existing** (200 vs 404), and
  `pulse_numbers` and `pulse_member_activity` are disclosed **by name** in an
  error message.

**Error message naming the feature — MIXED.** No user-facing error names
Elite or Pulse. But the PostgREST `permission denied for view
pulse_member_activity` above is a database error surfaced verbatim to any
caller, and it names the view.

### 5.4 Places the gating might leak — flagged, not fixed

1. **`BenchLayer` is statically imported.** The entire study layer — every
   lens component, every source string, `lib/studyData.ts` — ships to every
   reader on `/read` and `/bible/*`. `next/dynamic` behind `showBench` would
   remove it. *(File: `components/ScriptureReader.tsx:19`.)*
2. **`MoreSheet` strings ship to everyone.** "Church pulse", "/pulse",
   "Sermons" are in a chunk loaded on 31 pages.
3. **`/pulse` and `/sermons` redirect rather than 404 for a signed-in
   member**, which distinguishes them from a nonexistent route. This is
   deliberate — `requirePastoral` mirrors `requireAdmin` — and was raised and
   accepted in the session that built Pulse. Recording it here as the known
   trade-off, not as a new finding.
4. **`care_log` returns `200 []` rather than 404**, disclosing the table.
   Inherent to PostgREST + RLS; the row data is correctly protected.
5. **`pulse_member_activity` returns a 401 that names the view** to any
   caller including an authenticated member, because the migration revokes it
   from both `anon` and `authenticated`. The six RPCs do *not* have this
   problem — they are granted to `authenticated` and return `200 []`.
6. **Every Elite reference table is readable by any signed-in member.**
   `strongs_entries`, `kjv_verses`, `verse_words` (367,480 rows),
   `cross_refs` (344,756), `commentary_entries`, `word_study_entries` all
   carry `for select to authenticated using (true)`. This is a deliberate
   decision — the data is public-domain reference material and the Bench
   queries it from the browser — but it means a member can enumerate the
   Elite corpus and infer the feature.
7. **`sermons` RLS is own-rows-only, not pastoral-only.** A non-pastoral
   member could `INSERT` a sermon row via PostgREST. They could not reach
   `/sermons` to see it, and nobody else can read it, so the blast radius is
   a private row nobody will look at — but the table is not gated on the
   flag the way `care_log` is.
8. **`suppressBench` is a dead prop.** Declared and read in
   `ScriptureReader` but passed by no caller. The Rhapsody protection that
   matters is the hardcoded `pathname.startsWith("/rhapsody")` check beside
   it, which is the belt; `suppressBench` is braces nobody has fastened.
9. **`Nav` selects `profiles.*`** rather than a column list — a deliberate
   guard against a pre-migration 400, but it means the full profile row of
   the current user (including `is_pastoral`) is in the client payload on
   every page. That is the user's own row, so it is not a cross-user leak.
10. **`moreMatches()` in `lib/nav.tsx` lists `/sermons` but not `/pulse`.**
    Cosmetic — the More tab does not light up on `/pulse` — but it is also
    the only place a route name was added to a shared nav helper.

---

## 6. Database additions

### New tables

**`public.sermons`** — `2026_09_11`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` |
| `user_id` | `uuid` | not null → `profiles(id)` **on delete cascade** |
| `title` | `text` | not null, `default ''` |
| `passage_ref` | `text` | nullable |
| `blocks` | `jsonb` | not null, `default '[]'` |
| `status` | `text` | not null, `default 'draft'`, check `in ('draft','preached','archived')` |
| `preached_on` | `date` | nullable |
| `created_at` / `updated_at` | `timestamptz` | not null, `default now()` |

Index: `sermons_user_idx (user_id, updated_at desc)`.
Trigger: `touch_sermons_trigger` BEFORE UPDATE → `touch_sermons()` sets `updated_at`.
**RLS in plain English:** you can read, write, change and delete only your own
sermons. Nobody else can — not other pastoral users, not admins, not the
community. A draft is somebody thinking out loud.

**`public.strongs_entries`** — `2026_09_12` · 19,521 rows live
`strongs_id text PK` ('G25', 'H430') · `language text` check `in ('greek','hebrew')` · `lemma text` · `transliteration text` · `definition text` · `source text not null`.
No secondary index — every read is by primary key.
**RLS:** any signed-in reader may read it; **nobody** may write it (there is
no INSERT/UPDATE/DELETE policy at all — the import scripts use the service
role, which bypasses RLS).

**`public.verse_words`** — `2026_09_12` · 367,480 rows live
`id bigint identity PK` · `book text` · `chapter int` · `verse int` · `word_index int` · `word_text text` · `strongs_id text` · `book_index smallint` (canonical 0–65, stored because ordering by book *name* is alphabetical).
Unique: `verse_words_unique (book, chapter, verse, word_index, strongs_id)` — a word carrying two Strong's numbers is two rows sharing a `word_index`.
Index: `verse_words_strongs_idx (strongs_id, book_index, chapter, verse)` — answers the concordance filter *and* supplies its order, so it never sorts.
**RLS:** read for signed-in, no writer.

**`public.kjv_verses`** — `2026_09_12` · 31,102 rows live
`book text` · `chapter int` · `verse int` · `text text` · `book_index smallint`. PK `(book, chapter, verse)`. No secondary index.
Added deliberately outside the original five: the concordance must mark the
word *in the returned text* and every cross reference comes *with its verse
text*, and without a local copy each row would be a separate API.Bible call.
**RLS:** read for signed-in, no writer.

**`public.cross_refs`** — `2026_09_12` · 344,756 rows live
`id bigint identity PK` · `book/chapter/verse` · `target_ref text` (as it reads: "Genesis 1:1-5") · `target_book/target_chapter/target_verse_start/target_verse_end` (the same reference in parts, so the lens need not parse a display string back apart) · `votes int default 0`.
Unique: `(book, chapter, verse, target_ref)`. Index: `cross_refs_ref_votes_idx (book, chapter, verse, votes desc)`.
**RLS:** read for signed-in, no writer.

**`public.commentary_entries`** — `2026_09_12` · 4,823 rows live
`id bigint identity PK` · `source text` · `book/chapter` · `verse_start/verse_end int` (Henry writes on spans) · `body text`.
Unique: `(source, book, chapter, verse_start, verse_end)`. Index: `commentary_entries_ref_idx (book, chapter)`.
**RLS:** read for signed-in, no writer.

**`public.vines_entries`** — created empty by `2026_09_12`, **dropped by
`2026_09_13`.** No edition of Vine's could be found under a clean licence.

**`public.word_study_entries`** — `2026_09_13` · 15,753 rows live
`id bigint identity PK` · `source text` ('keil_delitzsch' | 'robertson') · `book/chapter` · `verse_start/verse_end int` · `strongs_id text` (nullable, always null today; the column exists so a Strong's-keyed source can be added without another migration) · `body text`.
Unique: `(source, book, chapter, verse_start, verse_end)`.
Indexes: `word_study_entries_ref_idx (book, chapter)`; `word_study_entries_strongs_idx (strongs_id) where strongs_id is not null` — partial, so it costs nothing while every row is null.
**RLS:** read for signed-in, no writer.

**`public.care_log`** — `2026_09_14` · 0 rows live
`id uuid PK` · `subject_user_id uuid` not null → `profiles` cascade · `author_user_id uuid` not null → `profiles` cascade · `kind text` check `in ('reached_out','note')` · `body text` nullable · `created_at timestamptz` not null default now().
Index: `care_log_subject_idx (subject_user_id, created_at desc)`.
**RLS in plain English:**
- **Read:** only a pastoral user, and never about themselves
  (`is_pastoral_user() and subject_user_id <> auth.uid()`). The
  self-exclusion is there so the "never readable by the member it concerns"
  rule holds even when that member is themselves pastoral.
- **Write:** only a pastoral user, only as themselves
  (`auth.uid() = author_user_id`), and never about themselves.
- **Change / delete:** only your own entries. Someone else's entry is theirs.
- **Admins get nothing** unless they also carry the flag.

### Column added to an existing table
`public.prayer_requests.needs_pastor boolean not null default false`
(`2026_09_14`). Default false, so every prayer already on the wall reads
exactly as it did. Set by an opt-in checkbox on the prayer composer.

### New views
**`public.pulse_member_activity`** (`2026_09_14`) — one row per profile:
`user_id, name, photo_url, start_date, created_at, cohort_id, last_read_at,
last_activity_at`. Built from five `max()`-per-user subqueries LEFT JOINed to
`profiles`. `GREATEST` ignores NULLs in Postgres and returns NULL only when
every argument is NULL, which is exactly "never did anything".
`revoke all … from anon, authenticated` — only the definer functions read it.

### New functions

| Function | Kind | Purpose |
|---|---|---|
| `guard_is_pastoral()` | trigger fn, `SECURITY DEFINER` | Carries the old `is_pastoral` forward when a non-admin tries to move it |
| `touch_sermons()` | trigger fn | `updated_at = now()` |
| `is_pastoral_user()` | `sql stable SECURITY DEFINER`, `search_path = public` | The gate, in SQL. Shaped like `is_admin()` |
| `pulse_numbers(date, int)` | plpgsql, definer | The four numbers |
| `pulse_check_on(date, int, int)` | plpgsql, definer | The check-on list |
| `pulse_cohorts(date, int)` | plpgsql, definer | Cohorts, quietest first |
| `pulse_curve(date)` | plpgsql, definer | Completion by plan day 1–90 |
| `pulse_person(uuid, date)` | plpgsql, definer | One person's facts for the sheet |
| `pulse_prayers(int)` | plpgsql, definer | Waiting prayers |

All six `pulse_*` functions open with `if not public.is_pastoral_user() then
return; end if;` — zero rows, not an error. `EXECUTE` is revoked from
`public` and `anon` and granted to `authenticated`.

### New triggers
- `guard_is_pastoral_trigger` — BEFORE UPDATE on `profiles`
- `touch_sermons_trigger` — BEFORE UPDATE on `sermons`

### New indexes on pre-existing tables (all `2026_09_14`, for the quiet calculation)
`completions_user_completed_idx (user_id, completed_at desc)` ·
`chapter_reads_user_read_at_idx (user_id, read_at desc)` ·
`comments_user_created_idx (user_id, created_at desc)` ·
`reactions_user_created_idx (user_id, created_at desc)` ·
`prayer_requests_user_created_idx (user_id, created_at desc)`.
Each exists because the five pre-existing indexes on those tables all lead
with the wrong column for a per-user `max(timestamp)`.

### Migrations, in order

| File | What it did |
|---|---|
| `2026_09_11_elite_pastoral_and_sermons.sql` | Adds `profiles.is_pastoral` + its guard trigger; creates `sermons` with own-rows-only RLS and a touch trigger |
| `2026_09_12_study_datasets.sql` | Creates `strongs_entries`, `verse_words`, `kjv_verses`, `cross_refs`, `commentary_entries`, `vines_entries`; read-only RLS on all six |
| `2026_09_13_word_study.sql` | Creates `word_study_entries`; **drops `vines_entries`**; prints the database size |
| `2026_09_14_church_pulse.sql` | Creates `is_pastoral_user()`, `care_log` + 4 policies, `prayer_requests.needs_pastor`, 5 indexes, `pulse_member_activity`, and the six `pulse_*` RPCs with grants |

**Note on "additive only":** three of the four say so and are. `2026_09_13`
is not — it drops `vines_entries`. The table had never held a row, so nothing
was lost, but the claim is not uniform across the set.

### New storage buckets
**None.** The Elite brand assets are static files in `public/`, not storage
objects.

---

## 7. Realtime

**Neither Elite nor Pulse opens a Supabase realtime channel.** Grepping
`.channel(`, `postgres_changes` and `removeChannel` across every new file
returns nothing.

The four channels described in `APP_MAP.md` §8 (`Nav`, `PrayerWall`,
`LeaderboardView`, `CommunityFeed`) are unchanged and are the only ones in
the app. No table added by Elite or Pulse was added to the
`supabase_realtime` publication.

This is a design consequence worth stating: the Bench re-queries on a verse
change, and Church Pulse is as fresh as its last server render. Two pastors
working the same care list will not see each other's entries appear.

---

## 8. Design system

### Are Fathom tokens applied throughout?
**Yes.** Both surfaces are built from tokens already in `app/globals.css` —
`--accent` / `--accent-strong` for anything belonging to Elite, `--sonar` for
position and state only, `--hl-shoal-ground` / `--hl-shoal-rule` for care,
`--line`, `--bg`, `--text`, `--muted`, `--soft-bg`, and the three faces
`--font-sans` / `--font-mono` / `--font-serif`.

`app/globals.css` grew by **799 lines** (2581 total) in three new sections:
`DEEP WATERS ELITE` (L1785), `THE BENCH` (L1860), `CHURCH PULSE` (L2392).

### Shadows — PASS
Every `box-shadow` in the new CSS is an `inset` rule, never elevation:
- `inset 2px 0 0 var(--sonar)` on `.bench-pinned` and `.bench-row[data-on]`
- `inset 0 -2px 0 var(--sonar)` on `.bench-tab[data-on]`
- `inset 2px 0 0 var(--hl-shoal-rule)` on `.pulse-stat[data-care]`,
  `.pulse-row`, `.pulse-prayer[data-care]`, `.pulse-notice`
- `inset 3px 0 0` on `.pulse-row:hover`

This matches the pre-existing idiom (`.votd`, `.bench-pinned`). No drop
shadow, no elevation, anywhere.

### Backdrop filter — PASS
No `backdrop-filter` in either new section. The Bench sheet is opaque
(`background: var(--bg)`), not glass. The Pulse person sheet reuses the app's
existing `.bottom-glass` / `.sheet-backdrop` classes, whose blur was already
neutralised app-wide before Elite.

### Gradients — PASS
The word "gradient" appears twice in the new CSS and both are comments
promising there isn't one. `EliteLockup.tsx` documents the point explicitly:
the source SVG in `public/` has a two-stop gradient fill and Poppins
lettering, and the component deliberately reproduces only the geometry, in
`currentColor` and the app's own faces. The raw gradient PNG
(`deep-waters-elite-mark-gradient.png`) stays in `public/` unused by any
component.

### Rounded containers — PASS, with one deliberate exception
Every `border-radius: 999px` in the new CSS is on something you press:
`.verse-grab-bar`, `.bench-grab-bar`, `.bench-close`, `.bench-word`,
`.bench-preset`, `.bench-primary`, `.bench-action`, `.bench-toggle-btn`.
Every container is square: `.pulse-stats`, `.pulse-stat`, `.pulse-facts`,
`.pulse-bar`, `.bench-panel`, `.bench-row` all sit at `border-radius: 0` or
inherit it.

The exception: `.bench[data-mode="sheet"]` carries
`border-top-{left,right}-radius: 28px`, and the Pulse person sheet uses
`rounded-t-[28px]`. Both match the app's pre-existing bottom-sheet grammar
(`MoreSheet`, `VerseNoteSheet`, `CompareSheet`) exactly. Consistent rather
than a violation, but it is a rounded container and is recorded here.

### Green — PASS
`--sonar` appears in the new CSS four times and every one is position or
state, never decoration:
1. `.bench-pinned` — the 2px left rule, the same mark a selected verse wears
2. `.bench-tab[data-on]` — the active tab's 2px underline
3. `.bench-action[data-on]` — the "Added to your draft" confirmation
4. `.pulse-bar-fill` — the proportion of a cohort reading

No component uses raw Tailwind `text-green-*` / `bg-green-*` / `border-green-*`.

### Red
Church Pulse has **none**, deliberately — even its error line uses
`.pulse-notice`, which wears the Shoal amber treatment, because on that page
amber means "look at this" and a failed save is exactly that.

Elite does use the app's existing `--danger` in three places, all destructive
confirmations following the app's standing convention: `SermonEditor`'s armed
block delete and armed sermon delete, and the error line in `SermonEditor`
and `NewSermonButton`. Recorded rather than flagged — it is the app's
pre-existing danger vocabulary, unchanged.

### New tokens introduced
**None.** No new colour token, no new spacing token, no new typography rule.
Elite and Pulse introduce new *classes* built from existing variables, and
that is all. The `--sp-1..7` scale, the three font variables and the full
colour set are exactly as `APP_MAP.md` §9 describes them.

---

## 9. Known code smells spotted while reading

### Files over 500 lines
**One:** [components/BenchLayer.tsx](components/BenchLayer.tsx) — **972
lines.** It holds all Bench state, seven lens data hooks, the house query,
the note handlers, the sermon append, six effects, and four layout branches
in one render. The file's own header argues for keeping state in one place
(so a rotation is a re-render, not a remount), which is a real constraint —
but the *render* could plausibly split into `BenchTabs`, `BenchRack` and
`BenchDock` without touching that.

For scale, the pre-existing largest files are `ScriptureReader.tsx` (now
~1,050 after Elite's changes) and `RhapsodyAdmin.tsx` (661).

### Duplicated logic that should be shared
1. **The two-tap-armed delete.** `const ARM_MS = 4000` plus an identical
   arm/disarm `useEffect` appears **three times**: `BenchNotepad.tsx:23`,
   `SermonEditor.tsx:18`, `NotesView.tsx:26`. Same constant, same effect,
   same "Tap again to delete" copy. A `useArmedDelete()` hook is the obvious
   shape.
2. **The UUID fallback.** `typeof crypto !== "undefined" && "randomUUID" in
   crypto ? crypto.randomUUID() : \`b-${Date.now()}\`` is written out twice,
   in `BenchLayer.tsx` (`toSermon`) and `SermonEditor.tsx` ("Add a block").
3. **Reference parsing.** `BenchLayer.tsx`'s private `versesIn()` regex
   overlaps with `lib/reference.ts::parseReference` / `parseVerseSegment`.
   They are not identical — `versesIn` reads a free-typed string that may not
   resolve to a book — but two verse-range parsers in one codebase is worth a
   decision.
4. **The panel-swap helper.** `swap()` in `BenchLayer.tsx` and `move()` in
   `SermonEditor.tsx` are the same array reorder written twice.
5. **The cohort-name fallback** (primary cohort, else earliest membership) is
   written twice in SQL, once in `pulse_check_on`'s `cohort_of` CTE and once
   in `pulse_person`'s `mine` CTE. They were deliberately aligned so the list
   and the sheet agree — which is exactly the condition under which they
   should be one function.

### TODO / FIXME / commented-out
**None.** `grep -rn "TODO\|FIXME\|XXX\|HACK"` across every new file returns
nothing, matching the pre-Elite state `APP_MAP.md` §10 recorded.

### `any` types
**Two**, both idiomatic catch clauses in
[PulseCheckOn.tsx](components/PulseCheckOn.tsx) lines 121 and 152
(`catch (err: any)`), matching the pattern already used throughout
`PrayerWall`, `CommunityFeed` and `NewSermonButton`. No `as any` anywhere in
the new code, and no untyped Supabase row mapping — `lib/studyData.ts` and
`lib/pulse.ts` both declare explicit row types.

### N+1 and aggregation cost
None of these bite at 26 members and 2 cohorts. All of them are shape
problems that scale badly, and they are the reason this section exists.

1. **`pulse_member_activity` is recomputed per call, and four functions call
   it.** Each evaluation is five full `GROUP BY user_id` scans of
   `completions`, `chapter_reads`, `comments`, `reactions` and
   `prayer_requests`, unfiltered, LEFT JOINed to all of `profiles`. One page
   load runs `pulse_numbers`, `pulse_check_on`, `pulse_cohorts` and
   `pulse_person` — so the same five aggregations happen **three to four
   times per render**. A materialised view refreshed on a schedule, or one
   RPC returning all five results, would collapse that.
2. **`pulse_check_on`'s `cohort_of` CTE is unfiltered.** It computes a cohort
   name for *every* row of `profiles` — two correlated subqueries each —
   before the outer query throws away everyone who isn't on the list. At
   5,000 members that is 10,000 subqueries to label perhaps 40 names.
3. **`pulse_numbers`' `ontrack` CTE runs one correlated `count(*)` over
   `completions` per profile.** Genuine N+1 in SQL clothing; N is the whole
   membership.
4. **`pulse_curve` materialises `90 × profiles` rows.** `generate_series(1,90)
   CROSS JOIN public.profiles LEFT JOIN completions`, aggregated on every
   page load. 2,340 rows today; 450,000 at 5,000 members, for a chart that
   changes once a day.
5. **`pulse_cohorts` runs two scalar subqueries per cohort** for the leader
   name, plus a `count(distinct)` over the joined set.
6. **The Bench's study queries are sequential waterfalls, not N+1.**
   `fetchTaggedWords` → `fetchStrongsEntries`, `fetchConcordance` →
   `fetchVerseTexts`, `fetchCrossRefs` → `fetchVerseTexts` are each two round
   trips where one would do. `fetchVerseTexts` is explicitly written to avoid
   N+1 — it builds an `OR` of `and(book.eq,chapter.eq)` clauses so a page of
   twelve references is one request rather than twelve — and says so in a
   comment. Worth recording as *correct*, since it is the pattern an audit
   would otherwise flag.
7. **`useParallelRows` issues one `fetch` per translation** — six on open,
   six more per "Show more". Deliberate: each row must load and fail
   independently. Shared with `CompareSheet`, which has always done this.

### Other things spotted
- **`isPastoral` is an unused prop in `BottomNav`.** Declared in `Props`,
  destructured in the signature, referenced nowhere in the body. `Nav` passes
  it. Dead wiring, probably left from a tab that was considered and dropped.
- **`suppressBench` is a dead prop in `ScriptureReader`** — no caller passes
  it (see §5.4 item 8).
- **`moreMatches()` lists `/sermons` but not `/pulse`** (`lib/nav.tsx:126`),
  so the More tab does not highlight on Church Pulse.
- **`vines_entries` was created and dropped one migration apart.** Two
  migrations describing the same decision from opposite sides.
- **`sermons` and `care_log` both have 0 rows in production.** Neither
  feature has been used yet, so nothing here has been exercised against real
  data at any volume.
- **`SermonEditor` has no unsaved-changes guard.** No `beforeunload`, no
  route-change interception, and no autosave. Typing a sermon and navigating
  away loses it silently.
- **`app/api/pulse/care/route.ts` re-implements the pastoral check** rather
  than using `requirePastoral()`, because that helper redirects and an API
  route must not. Correct, but it is a second definition of the gate in
  TypeScript. A `getPastoralUser()` in `lib/auth.ts` returning `null` would
  make it one.

---

## 10. Repo shape delta

### New folders under `app/` and `components/`

```
app/
├── pulse/                       NEW
│   └── page.tsx
├── sermons/                     NEW
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
└── api/
    └── pulse/                   NEW
        └── care/
            └── route.ts

components/                      (no new subfolders — flat, as before)
├── BenchCommentary.tsx          NEW
├── BenchConcordance.tsx         NEW
├── BenchCrossRefs.tsx           NEW
├── BenchHouse.tsx               NEW
├── BenchLayer.tsx               NEW  (972 lines)
├── BenchLensBody.tsx            NEW
├── BenchNotepad.tsx             NEW
├── BenchPaneBoundary.tsx        NEW
├── BenchPinned.tsx              NEW
├── BenchTranslations.tsx        NEW
├── BenchWordRail.tsx            NEW
├── BenchWordStudy.tsx           NEW
├── BenchWords.tsx               NEW
├── EliteLockup.tsx              NEW
├── NewSermonButton.tsx          NEW
├── PulseCheckOn.tsx             NEW
├── PulseCurve.tsx               NEW
└── SermonEditor.tsx             NEW

lib/                             (no new subfolders)
├── bench.ts                     NEW   lens + layout vocabulary
├── parallelVerse.ts             NEW   shared with CompareSheet
├── pulse.ts                     NEW   QUIET_DAYS, row types, wording
├── scrollPane.ts                NEW   scroll one container, never the page
├── sermons.ts                   NEW   block shape + jsonb validation
├── studyData.ts                 NEW   the six study queries
├── useBenchLayout.ts            NEW   viewport → mode
├── useLockBodyScroll.ts         NEW   counted body lock
└── useStudyLens.ts              NEW   fetch-when-visible

scripts/                         NEW FOLDER (11 files)
supabase/migrations/             +4 files
public/                          +10 Elite brand assets
```

### Counts

| | |
|---|---|
| New files (excluding images) | **46** |
| New lines in those files | **6,289** |
| New brand assets in `public/` | 10 (2 SVG, 8 PNG) |
| Total insertions across the delta (new + modified, excluding `public/`) | **7,682** |
| Total deletions | **177** |
| Files modified but not created | 21 |
| New migrations | 4 |
| New tables | 8 created, 1 of them since dropped → **7 standing** |
| New RPCs | 6, plus 3 helper/trigger functions |
| `app/globals.css` growth | +799 lines (to 2,581) |

Largest new files: `BenchLayer.tsx` (972), `2026_09_14_church_pulse.sql`
(657), `PulseCheckOn.tsx` (314), `SermonEditor.tsx` (276), `lib/studyData.ts`
(256), `app/pulse/page.tsx` (254).

---

## Open questions for Ash

1. **The Bench ships to every reader.** `BenchLayer` is a static import in
   `ScriptureReader`, so a member downloads and parses the whole study layer
   on `/read` and `/bible/*`. Moving it behind `next/dynamic` keyed on
   `showBench` would remove both the payload and the strings. Do you want
   that before the audit, or is the bundle leak acceptable given the flag
   holds everywhere that matters?
2. **`MoreSheet` puts "Church pulse" and "/pulse" in a chunk on 31 pages.**
   Same question, smaller payload, and harder to fix — the sheet is one
   component with one conditional row. Split the pastoral rows into a lazily
   imported child?
3. **Bench layout is not persisted.** Every pastor starts on Sermon prep,
   Translations, every session. Should the panel set, order and active lens
   be written to `profiles` (a `bench_layout jsonb`) or left deliberately
   stateless?
4. **`SermonEditor` has no autosave and no unsaved-changes warning.** With
   `sermons` at 0 rows nobody has lost work yet. Autosave on a debounce, a
   `beforeunload` guard, or leave it explicit?
5. **`sermons` RLS is own-rows-only, not pastoral-gated.** A non-pastoral
   member can insert a row they will never see. Add `is_pastoral_user()` to
   the insert policy, or is own-rows enough?
6. **`pulse_member_activity` is recomputed three to four times per page
   load,** and `pulse_curve` materialises 90 × the membership. Both are free
   at 26 members. At what size do you want this revisited — and would you
   rather have a materialised view on a schedule, or one RPC returning the
   whole page?
7. **Robertson volumes 5 and 6 are © Broadman Press,** carried under the
   CrossWire module's free non-commercial distribution grant.
   `scripts/README.md` says plainly they must be removed if the app ever
   takes money. Is there a decision recorded anywhere outside that README —
   and should the two volumes be tagged in `word_study_entries` so they can
   be deleted with one statement?
8. **`2026_09_13` drops `vines_entries`,** which `2026_09_12` had just
   created. Worth collapsing into one migration for a fresh project, or leave
   the history honest?
9. **Two dead props:** `BottomNav.isPastoral` and
   `ScriptureReader.suppressBench`. Delete both, or was one of them the start
   of something (a pastoral tab; a per-surface Elite suppression) that is
   still planned?
10. **`moreMatches()` omits `/pulse`.** One-line fix; confirming it is an
    oversight rather than a decision that Pulse should not light the More tab.
11. **The `pulse_member_activity` 401 names the view** to any authenticated
    caller. Granting `select` to `authenticated` and adding a
    `security_barrier` / RLS-equivalent would trade one disclosure for
    another. Leave it?
12. **Neither `sermons` nor `care_log` has been used in production.** Do you
    want the audit to run against seeded data, and if so should that seed go
    in the repo?
13. **`/pulse` and `/sermons` redirect to `/today` for a signed-in
    non-pastoral member rather than returning 404.** Already raised and
    accepted once. Recording it here so the audit does not re-open it as new
    — unless you want `requirePastoral` changed, in which case both routes
    should change together.

---

*Generated by a read-only discovery pass over `274cb99..HEAD`. No source
file was modified. `ELITE_MAP.md` is the only file created.*
