# OFFLINE.md — Deep Waters without a signal

Written against the app at `7639678`, after `PERF_AUDIT.md`. What was built,
what the brief got wrong, what is deliberately not done, and what could not be
verified from here.

---

## Part 0 — Where the brief was out of date

The brief for this work predates several rewrites. Four of its instructions
described an app that no longer exists.

**1. "Add a web app manifest."** Already there. `public/manifest.json` carries
the name, scope, `start_url`, theme colours and a maskable icon, and
`app/layout.tsx` wires it up with `apple-touch-icon` and
`appleWebApp.statusBarStyle`. The only thing added was a stable `id`.

**2. "Validate the content type and size before caching a font."** No longer
applicable. `app/layout.tsx` self-hosts IBM Plex Sans, IBM Plex Mono and
Literata through `next/font/google`; they are emitted at build time under
`/_next/static/media/` with content hashes. There is no font host at run time
and no response to validate. The guard would have protected against a risk
that was designed out.

**3. "One caching layer must serve both `bible_cache` and
`/api/bible/chapter`."** Not possible, and not desirable.

`bible_cache` is a **Postgres table** read with the service-role key inside the
server function (`lib/bible.ts:105`), and the in-flight map is a plain JS `Map`
in that same process (`lib/bible.ts:78`). Neither exists in the browser.
Neither can serve a phone in aeroplane mode. Their job is protecting the shared
API.Bible rate limit, which is a different job from offline reading. **Both are
untouched.**

What is real is that two paths reach chapter text **in the browser** — the
server render, and `fetchParallelChapter()` → `/api/bible/chapter` — and they
already shared one layer: the module-scope `chapterCache` in
`lib/parallelVerse.ts`. That is the layer this work extended. No second store
was built.

**4. Preferences.** Half-solved already: `theme` and `book_layout` were
mirrored to `localStorage` and applied before paint. Text size, line spacing,
reading font and verse numbers were not — they rode on the profile row from the
server, so offline they fell back to defaults. That half is now mirrored the
same way.

---

## Part 1 — What was built

### The service worker — `public/sw.js`

Hand-written, ~230 lines, no build plugin, no new dependency. Workbox's value
is a precache manifest and revisioning; every asset here is already
content-hashed and immutable and the fonts are local, so there was nothing for
it to do that four rules do not. Buying it would have meant a plugin wrapping
the compiler — the likeliest way to quietly undo the performance pass.

Four rules, in order:

| Request | Treatment |
|---|---|
| Anything not `GET` | Untouched. Passed straight through. |
| `/_next/static/*` | Cache-first, for ever. Content-hashed, so never revalidated. Covers the fonts. |
| Icons, manifest, logos | Cache-first, refreshed in the background. |
| A navigation | Network. **Never cached.** On failure, the `/offline` shell answers at the URL that was asked for. |
| Everything else — RSC, `/api/*`, Supabase | Not handled at all. Exactly as before this worker existed. |

**Nothing personalised is ever written to a cache.** No document carrying a
name, no RSC payload, no API response. The only things in Cache Storage are
content-hashed assets and one impersonal shell. That is what makes the sign-out
purge trustworthy: there is nothing for it to miss, because nothing personal
was ever put there.

### `/offline` — the shell

A `force-static` route with no cookies and no queries, prerendered once and
byte-identical for every member. It is on the middleware's public list because
the worker fetches it with `credentials: "omit"` — behind the login check it
would redirect, and the worker would cache the login page as the offline page.

It renders the **same** `ScriptureReader` and `ChapterPager` the server-rendered
pages render, fed from IndexedDB instead of from a server. Not a second reading
surface: highlighting, note-writing and chapter recording all work there because
it is the same components doing them.

### The chapter store

`seedChapter()` — already called with every server-rendered chapter — now also
writes to IndexedDB. `fetchParallelChapter()` looks in IndexedDB before the
network and on network failure. `cachedChapter()` stays synchronous, because
`ReaderPane` calls it during render.

`/read/[day]/[slot]` never rendered `ParallelBible`, so it never seeded
anything; `/bible/[book]/[chapter]` only seeded once a second pane mounted.
`ChapterKeep` closes both gaps, and warms the rest of today and all of tomorrow
after paint, one chapter at a time with a pause between.

Keyed `bibleId|bookSlug|chapter`, so two panes in two translations are two rows
and neither evicts the other.

### The write queue

Chapter reads, highlights, verse notes and reflections written with no signal go
into IndexedDB and are replayed oldest-first, serially, on the `online` event,
on mount and on visibility change.

**Nothing is ever silently dropped.** A refusal is kept and shown with its
reason; a network failure is kept and retried; only a deliberate tap discards
one. Every kind is safe to send twice:

| Kind | Why a repeat is safe |
|---|---|
| `chapter-read` | `mode: "mark"` can only add; 23505 already treated as success. |
| `verse-note-add` | Carries a client uuid; the endpoint now returns the existing row on a PK collision. |
| `verse-note-edit` | An update to a fixed body. |
| `reflection` | Upserts on `(user_id, day_number)`. |
| `highlight-add` | Client uuid; 23505 is success. |
| `highlight-remove` | Deleting nothing is not an error. |

Highlights and notes now carry client-generated uuids from the moment they
appear on screen. That is what lets a highlight made offline be removed offline,
and what makes every replay idempotent. A highlight made and removed offline has
its queued insert **withdrawn** rather than followed by a delete.

### Everything else

- **Preferences** mirrored to `localStorage` and applied by the head script
  before paint.
- **Marks** written through to IndexedDB on a clean load, read from it when the
  network is gone. One function (`loadVerseMarks`), both callers.
- **Full Bible download** — `/api/bible/bulk`, 25 chapters a request, batched,
  paced, resumable, cancellable, quota-aware, with a delete that removes only
  what the download put there.
- **Offline bar** in `Nav` and in the shell, with the count of what is waiting.
- **Composers disabled** where posting cannot work; the reflection is queued
  instead, because it is the reader's own words.

---

## Part 2 — The API.Bible budget

A whole Bible is 1,189 chapters. Chapters in `bible_cache` cost nothing
upstream, but a cold download is over a thousand live fetches against a
rate-limited key **the whole church shares**. Two or three members starting a
download the same evening could spend the day's quota between them, and
everyone else would open their reading to "We've hit today's limit."

So `/api/bible/bulk` spends cache hits freely and live fetches only up to a
ceiling, measured across the whole church over a rolling day by counting
`bible_cache` rows with a recent `fetched_at`. **No new table and no counter to
keep in step** — every live fetch already writes such a row, so counting them is
counting the spend. Above the ceiling the batch returns what is cached, says
`paused`, and the download picks up tomorrow.

`BIBLE_DAILY_FETCH_BUDGET` overrides the default of 3,000.

---

## Part 3 — Privacy, and the one thing a cache cannot do

Closed:

- Nothing personalised is in Cache Storage at all.
- The IndexedDB store records whose it is; arriving as anybody else deletes it
  **before a single row is read**. That is the guard that actually holds, because
  sign-out is not guaranteed to run — a phone can be force-quit.
- Sign out deletes the database, the mirrored preferences and every `dw-*`
  cache, and waits for it before dropping the session. Verified: three caches,
  one database and two localStorage keys, all gone.
- The cached community screens store **display text only** — a name and a body.
  No ids, no profile rows, no avatars, no cohort membership. A stale copy can
  show an out-of-date sentence; it cannot be a directory.
- They are **replaced whole** on every successful load, so a member who has gone
  private is gone from the cache the first moment there is any signal.
- Expired at 24 hours, and always shown under a visible "Last updated 08:42".

**Not closed, and it cannot be:** a phone that has been offline since before a
member went private can still show that member in its cached feed, for up to 24
hours. A device with no connection cannot be told something. The only airtight
option was not caching those screens at all, which was put to the pastor as a
choice; this is the option he took, knowing the cost.

---

## Part 4 — Measurements

`next build` clean, `next lint` clean.

| | Before (`7639678`) | After | |
|---|---|---|---|
| First Load JS shared by all | 87.3 kB | **87.5 kB** | +0.2 |
| Middleware | 86.2 kB | **86.2 kB** | unchanged |
| `/bible/[book]/[chapter]` | 200 kB | **206 kB** | +6 |
| `/read/[day]/[slot]` | 197 kB | **203 kB** | +6 |
| `/community` | 185 kB | **188 kB** | +3 |
| `/day/[n]` | 181 kB | **185 kB** | +4 |
| `/preferences` | 183 kB | **185 kB** | +2 |
| `/offline` | — | **189 kB** | new, static |

**The +6 kB on the two reading routes is deliberate and cannot be lazy-loaded.**
It is the offline write path — the queue, the store, the marks. Code that has to
work with no network cannot sit behind a chunk that needs one to arrive. The
offline bar and the download panel *are* lazily loaded, which is where the
`/preferences` and `/community` savings came from.

Load timing, `/login`, median of 9 runs each, same machine, same build:

| | Without the worker | With it |
|---|---|---|
| DOMContentLoaded | 25 ms | **26 ms** |
| Load | 48 ms | **43 ms** |

The worker does not slow the cold path and modestly speeds the loaded one —
cache-first on immutable assets beats even the local HTTP cache. Registration is
deferred until after `load` and then until idle, so the visit that installs it
pays nothing.

**First contentful paint could not be measured, and this says so rather than
guessing.** The automation browser's window never becomes visible, and the Paint
Timing API does not fire for a hidden page. This is the same class of limitation
`PERF_AUDIT.md` recorded for `requestAnimationFrame`.

---

## Part 5 — Found, and NOT fixed

### Text size, line spacing and reading font do nothing to scripture

**Pre-existing, and it is not an offline bug — it is true online right now.**

`app/globals.css:583`:

```css
.bible-content .verse-text {
  font: 400 18px/31.3px var(--font-serif), …;
}
```

That `font` shorthand is more specific than the `--reading-size` /
`--reading-leading` variables the Preferences screen sets, and it also resets
`font-family`, which defeats `[data-reading-font="sans"]`. The words of
scripture live in `.verse-text`. So all three settings change the attribute on
the element and nothing else.

Measured: `<html data-text-size="xlarge">`, `--reading-size` resolves to `23px`,
`.verse-text` computes **`18px`**. Introduced by `114d87c` ("Scripture: hang the
verse numbers in the margin"). `git diff` confirms this pass only appended to
`globals.css`.

The fix is small and safe — `18px/31.3px` is exactly the medium/normal default
(18 × 1.74 = 31.32), so **nobody who has never changed a setting would see any
difference at all**. But `.verse-num` hardcodes the same `31.3px` to align the
number with the verse's first line, so it has to move with it, and that is
typography surgery on the app's most important surface. The brief says to say so
before making a change that risks what already works. **Reported, not fixed.**

### Still outstanding from the previous pass

`supabase/migrations/2026_09_22_private_access_cost.sql` has still not been run.
The anonymous-read hole on `leaderboard` is still open on production. Nothing in
this work depends on it.

---

## Part 6 — Verified, and not

Verified with the server genuinely stopped — a real outage, not a simulated
flag — in Chrome and in Safari on the iOS Simulator:

- The app opens and reads with the server dead; the URL stays where it was.
- Walking a day with Next records each chapter and the count rises.
- A refused write is kept and explained; a 5xx is kept and retried; a success
  deletes the item. Nothing lost in any case.
- The day view, the plan, and a chapter from the download all render offline.
- Rhapsody says the honest thing.
- Sign-out purge removes everything.
- Preferences attributes apply offline exactly as they do online.
- Online is unbroken: public routes 200, protected routes still 307 to `/login`,
  every `/api/*` still 401 signed out.

**Two bugs were found and fixed during this testing**, both from the iOS run:

1. A device with no cached profile sat on a permanent loading state — a blank
   page, which is the one outcome this whole feature exists to prevent. It now
   says what has happened.
2. The shell's own chunks were in the size-trimmed static cache, where they
   would have been the oldest entries and the first evicted — a blank offline
   page appearing weeks later. They now live in the untrimmed shell cache.

**Not verified, for want of a test account.** These need a signed-in session
against real data and could not be exercised from here:

- A highlight and a note written offline syncing to the real database.
- The parallel Bible in two translations, offline.
- The full Bible download end to end against API.Bible.
- A private member's absence from a cached feed with real rows in it.

The mechanisms behind all four were verified in isolation. The integration was
not. A test login would close it.
