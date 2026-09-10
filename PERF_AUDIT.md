# PERF_AUDIT.md — Deep Waters, Elite and Pulse

A performance and responsiveness pass over the whole app. Written against
the app as it stands at `bf390a4`, not as the earlier maps describe it.

**Every claim in this document is backed by a number, a file path, or a
build manifest entry.** Where something could not be measured it says so in
those words, and says why.

## Documents read before starting

| Document | Written at | Status |
|---|---|---|
| `APP_MAP.md` | `d716d50`, 2026-09-08 | Read in full. Historical baseline. |
| `EXCELLENCE_AUDIT.md` | `d716d50`, 2026-09-08 | Read in full. Its four fixes are shipped. |
| `STRESS_AUDIT.md` | `80c9018`, 2026-09-08 | Read in full. 37 findings, 3 tiers. |
| `ELITE_MAP.md` | `1b3d50c`, 2026-09-09 | Read in full. |
| `ELITE_EXCELLENCE_AUDIT.md` | `c4ae552`, 2026-09-09 | Read in full. |
| Fix log `80c9018` | Hardening pass | Read — 8 groups. |
| Fix log `9b7db0a` | Robustness pass | Read — 4 groups. |
| Fix log `f98822d` | Prayer RLS | Read. |

---

# Part 0 — The delta

## How much has changed

`c4ae552..HEAD` is **24 commits, 177 files, +13,705 / −3,114 lines**,
excluding `public/`. That is roughly the size of the Elite build itself,
laid on top of it. The maps above describe an app that no longer exists in
several important places.

Measured with `git diff --stat c4ae552..HEAD -- . ':!public'`.

## Routes: what the maps do not have

`next build` at `bf390a4` emits **73 route entries**. These are new since
`ELITE_MAP.md`:

| Route | Kind | First Load JS | Note |
|---|---|---|---|
| `/read/[day]/[slot]` | dynamic page | **197 kB** | Replaces the one-long-scroll `/read`. One chapter per URL. |
| `/preferences` | dynamic page | 183 kB | Reading / appearance / community / notification settings. |
| `/private` | dynamic page | 176 kB | The private member's owner view. |
| `/private/[id]` | dynamic page | 176 kB | One private member. |
| `/sources` | dynamic page | 176 kB | Dataset attribution. Public (in middleware's allow-list). |
| `/finished` | dynamic page | 176 kB | Day 91+ state. |
| `/admin/figures/[metric]` | dynamic page | 178 kB | Who completed / who has not, with export. |
| `/sermons/[id]/edit` | dynamic page | 187 kB | Editor split out of the read view. |
| `/api/bible/chapter` | route handler | — | Whole chapter as verse-wrapped HTML, for the second pane. |
| `/api/preferences` | route handler | — | |
| `/api/sermon`, `/api/sermon/[id]` | route handlers | — | Sermon writes moved off the client (closes `P2‑G`). |
| `/api/plan/restart` | route handler | — | |

`/read` is now a 164 B redirect shim (87.5 kB) rather than the 194 kB page
the Elite audit measured.

## Database: what the maps do not have

Five migrations landed after `ELITE_MAP.md` was written:

| Migration | What it did |
|---|---|
| `2026_09_16_retire_badges_trigger.sql` | Drops the `award_badges` trigger. |
| `2026_09_17_private_members.sql` | **991 lines.** Private access: `can_see_user()`, restrictive `hide_private_users` SELECT policies on **21 tables** plus `care_log`, and every view and every `pulse_*` function re-declared with the filter written in. |
| `2026_09_18_nicknames_and_preferences.sql` | `profiles.nickname`, a **generated stored** `display_name`, 12 preference columns with check constraints, and `leaderboard` / `community_feed` / `finishers` rebuilt to report `display_name`. |
| `2026_09_19_close_anonymous_reads.sql` | Tightens anonymous read paths. |
| `2026_09_20_sermon_blocks.sql` | Sermon block storage. |
| `2026_09_21_exposition_entries.sql` | `exposition_entries` (the renamed Word study lens). |

New columns on `profiles` since the maps: `is_private`, `private_owner_id`,
`nickname`, `display_name` (generated), plus the preference set
(`book_layout`, `text_size`, `reading_font`, `line_spacing`, `theme`,
`show_on_leaderboard`, and others).

**`display_name` is `generated always as (…) stored`.** The brief flagged a
computed `display_name` in a view as a likely hiding place for a sequential
scan. It is not computed in the view — it is a stored column on `profiles`,
written at row-write time. The views select it like any other column. That
particular risk does not exist here.

## Client surfaces: what the maps do not have

| Surface | File | Lines |
|---|---|---|
| Parallel Bible (two panes, link, swap) | `components/ParallelBible.tsx` | 573 |
| Reader pane (the shared scroller) | `components/ReaderPane.tsx` | 304 |
| Chapter pager + read tracker | `components/ChapterPager.tsx` | 260 |
| Bench divider (drag the split) | `components/BenchDivider.tsx` | 161 |
| Bench split maths | `lib/benchSplit.ts` | 200 |
| Second text lens | `components/BenchSecondText.tsx` | 177 |
| Preferences form / apply / nudge | `components/Preferences*.tsx` | 762 |
| Plumb line (reading progress rule) | `components/PlumbLine.tsx` | 155 |
| Admin figure lists + export | `components/AdminFigureList.tsx`, `lib/adminFigures.ts` | 391 |
| Parallel plumbing | `lib/parallel.ts`, `lib/parallelVerse.ts`, `lib/parallelUi.tsx` | 440 |

`components/ChapterReadTracker.tsx` (254 lines) and
`components/ChapterTicker.tsx` (222 lines) are **gone** — chapter reads are
no longer a control the reader operates. `app/globals.css` has grown to
**5,244 lines** (`ELITE_MAP.md` recorded 2,581).

## Corrections to the earlier maps

Things the maps state that are no longer true, or were never true:

1. **`/read` is not a reading page.** It is a redirect to
   `/read/[day]/[slot]`. `APP_MAP.md` §2 and `ELITE_EXCELLENCE_AUDIT.md`
   Group 3 both measure it as the reader.
2. **Chapter ticking is gone.** `STRESS_AUDIT.md` T1‑E (the three-tap race
   on `ChapterTicker`) describes a component that no longer exists. The
   `/api/chapter-read` endpoint is still there and is now driven by
   `ChapterPager`'s observer, not by a tick box.
3. **`BenchWordStudy` is `BenchExposition`.** Renamed at `e94a5bd`.
4. **Sermon writes are no longer client-side.** `ELITE_EXCELLENCE_AUDIT.md`
   P2‑G is closed: `/api/sermon` and `/api/sermon/[id]` exist.
5. **The `badges` trigger is retired** (`8542787`), so `APP_MAP.md` §5
   "Triggers" over-lists by one.
6. **The repo cannot rebuild the database from scratch.** Replaying
   `supabase/schema.sql` then every file in `supabase/migrations/` in
   filename order onto an empty Postgres 17 leaves three failures:
   - `2026_09_07_highlight_colour_names.sql` and `…_part_two.sql` both fail
     with `relation "public.highlights" does not exist` — they are dated
     `09_07` but `highlights` is not created until `2026_09_09`. The result
     is a live `highlights_colour_check` of
     `('amber','mint','sky','rose','lavender')` while the app writes
     `'shoal' | 'current' | 'coral' | 'fathom' | 'silt'`. **Every highlight
     write on a freshly-built project would fail.**
   - `2026_09_10_chapter_reads_STEP2_views.sql` fails with `syntax error at
     or near "add"`. This is the duplicate migration `APP_MAP.md` Open
     Question 2 already asked about.
   Not a performance finding. Recorded because it was found while building
   the measurement rig and because it makes the repo's claim to be the
   source of truth false.

## The measurement rig

Production carries **28 profiles, 12 completions, 123 chapter_reads, 182
highlights, 14 verse_notes, 6 comments, 2 cohorts, 29 notifications**
(read live via PostgREST with `Prefer: count=exact`). Nothing measured
against that data would say anything about how the app behaves at church
scale, and timings against it are dominated by network round-trip.

So the database work in this document was measured against a **local
PostgreSQL 17** with the repo's own schema and every migration applied,
seeded to **500 members** with a plan-shaped history. That is the only way
to run `EXPLAIN (ANALYZE, BUFFERS)` and to compare a query with a policy in
force against the same query without it.

No production row was written at any point in this audit.

---

# Part 1 — Private access

The brief asked for this as a number rather than an impression. Here it is,
and there is a second finding underneath it that matters more than the
speed.

## P0 — `can_see_user()` returns **true** to a caller with no session

**This is a privacy failure, found while measuring the cost of the privacy
layer.** It is not a performance finding and it is the most serious thing
in this document.

`public.can_see_user(target)` as written in
[2026_09_17_private_members.sql:212](supabase/migrations/2026_09_17_private_members.sql:212):

```sql
select coalesce(
  (select not p.is_private
       or auth.uid() = p.id
       or auth.uid() = coalesce(p.private_owner_id, <zero uuid>)
   from public.profiles p where p.id = target),
  true)
```

With no session `auth.uid()` is NULL. For a private member the three
disjuncts evaluate to `false OR NULL OR NULL`, which is **NULL**, not
false. The subquery returns a row whose value is NULL, and
`coalesce(NULL, true)` is **true**.

The `coalesce(…, true)` is correct and necessary — it is what makes the
function safe to drop onto a nullable column — but it cannot tell "no
profile row exists" apart from "the row exists and the comparison was
unknown".

**Measured on a local copy of this schema at 500 members, one member marked
private:**

| Caller | `can_see_user` | rows in `community_feed` | rows in `leaderboard` |
|---|---|---|---|
| the private member himself | true | 9 | 1 |
| his owner | true | 9 | 1 |
| another ordinary member | **false** | **0** | **0** |
| **anonymous, no session** | **true** | **9** | **1** |

**Confirmed live on production**, with the `anon` key that ships inside
every client bundle:

```
GET /rest/v1/leaderboard?select=*&user_id=eq.<the private member>
  -> 200, content-range 0-0/1
```

`community_feed`, `leaderboard`, `cohort_members` and `cohort_summary` all
return `200` to the anon key — `/c/[slug]` is a public page and needs them.
So the promise inverted: **every signed-in member of the church was
correctly blocked, and any stranger could read the row.**

The private member has one row on production today and no reflections, so
what was exposed is the leaderboard row — name, days completed, streak —
rather than anything he has written. The mechanism, not the blast radius,
is the finding.

**Fixed** in [2026_09_22_private_access_cost.sql](supabase/migrations/2026_09_22_private_access_cost.sql)
§1 by comparing with `is not distinct from` rather than `=`, so an absent
session matches nothing instead of matching unknowably. The
`coalesce(…, true)` for a genuinely missing row is kept.

**Verified**: 16 probes across four callers and four views, before and
after. Thirteen are byte-identical. The three that changed are all the
anonymous caller, and all three move from "sees the private member" to
"does not":

| Caller / view | Before | After |
|---|---|---|
| anon / `community_feed` | 15378 rows, 9 his | 15369 rows, **0 his** |
| anon / `leaderboard` | 500 rows, 1 his | 499 rows, **0 his** |
| anon / `cohort_summary` | member_count sums to 500 | sums to **499** |

The anonymous caller now sees exactly what an ordinary member sees.

## P1 — The policy cost: 10.09 microseconds, 18,505 times

`can_see_user()` is `security definer`. **A security definer function is
never inlined by the planner**, so every call is a full function call with
its own executor setup, and `auth.uid()` inside it parses JSON out of a GUC
on each one.

Measured at 500 members / 18,505 completions:

| | Median |
|---|---|
| `select count(*) from completions` | 128.0 ms |
| `… where can_see_user(user_id)` | 314.8 ms → **10.09 µs per call** |
| `… where user_id is distinct from auth.uid()` | 241.5 ms (`auth.uid()` alone is 6.1 µs per call) |
| `… where <predicate on the joined profiles row>` | 194.4 ms |
| `… where <anti-join against private profiles>` | **127.1 ms — free** |

### Is it re-evaluated per row, and is it `stable`?

Both questions from the brief, answered:

- **It is marked `stable`**, correctly. `is_pastoral_user()` is `sql stable`
  too.
- **`stable` does not help here.** It licenses the planner to reuse a
  result within one statement *for the same arguments*. The argument is a
  different `user_id` on every row, so **it is re-evaluated once per row**,
  18,505 times for one feed query.
- **Its own plan is fine.** The body is a primary-key lookup on
  `profiles`, and `profiles_pkey` serves it. There is no missing index.
  The cost is the call, not the lookup.

### What it costs the hot paths

Measured with the app's own query text, before and after:

| The query the app actually sends | Before | After | Change |
|---|---|---|---|
| `CommunityFeed.load()` — `community_feed` limit 100 | **115.3 ms** | **11.8 ms** | −103.5 ms, **9.8×** |
| `LeaderboardView.load()` — `leaderboard` where days>0 limit 200 | **157.0 ms** | **49.3 ms** | −107.6 ms, **3.2×** |
| `FinishersView.load()` — `finishers` limit 500 | 21.1 ms | 20.6 ms | — |
| `CommunityFeed` — `verse_of_the_day` | 0.4 ms | 0.1 ms | — |
| `CohortsView` — `cohort_summary` | 7.6 ms | 7.3 ms | — |

And measured against the shape the brief asked for — the same query with
the filter and without it:

| | With filter | Without filter | Cost of private access |
|---|---|---|---|
| `community_feed`, first 30 | 213.9 ms | 70.3 ms | **+143.6 ms (204%)** |
| `leaderboard`, first 100 | 184.9 ms | 42.0 ms | **+142.9 ms (340%)** |
| `finishers` | 28.2 ms | 24.5 ms | +3.8 ms (15%) |
| `cohort_summary` | 10.3 ms | 7.3 ms | +3.0 ms (41%) |

**So the answer to "what is private access costing" is: it was costing the
feed 144 ms and the leaderboard 143 ms per load at 500 members. After the
fix it costs the feed 11.8 ms in total — the filter is now cheaper than the
query it protects, and both views are faster with private access than they
used to be without it.**

### On the restrictive policies themselves

The 21 `hide_private_users` policies were measured separately by dropping
them inside a transaction that was then rolled back:

| Query | With policy | Without | Cost |
|---|---|---|---|
| notifications page, own, 50 | 0.20 ms | 0.03 ms | +0.17 ms |
| chapter_reads for one day | 0.01 ms | 0.01 ms | 0 |
| completions for `/day` and `/depth` | 0.09 ms | 0.02 ms | +0.06 ms |
| highlights for `/depth` | 0.01 ms | 0.01 ms | 0 |
| prayer wall, open, 100 | 5.40 ms | 1.15 ms | **+4.25 ms (369%)** |

Every one of these is filtered to `user_id = <me>` except the prayer wall,
and that is the whole story: when a query already narrows to one person the
policy is asked a handful of times and costs nothing. **The policies are
left exactly as they are.** Only the views, which asked per row across
everybody, were rewritten.

### How the fix works, and why it is not a weakening

`can_see_user(t)` is, by definition,

> NOT ( t is private AND the caller is not t AND the caller is not t's owner )

There are 500 people and 18,505 completions, and the answer depends only on
the person. So the two hot views ask once per person, as a `NOT EXISTS`
against the private set, which Postgres hashes once and anti-joins.
`profiles_private_owner_idx` — partial, `where is_private` — is exactly the
index for it and already existed.

No policy was dropped. No grant changed. No filter was removed: the
`leaderboard`'s redundant second filter in the `completed` CTE was **kept**,
because defence in depth was the point of writing it twice and in this
shape it is free.

## Not fixed, and why

**The `pulse_*` aggregation cost is still deferred.** `ELITE_MAP.md` §9 and
its open question 6 defer this to 500 members, and `pulse_member_activity`
is still recomputed three to four times per `/pulse` render. That is a
separate piece of work with a different shape (a materialised view or one
combined RPC) and it is measured in Part 5 below rather than fixed here.

**The migration has to be run by hand.** There is no SQL-execution path
from this machine to the live project — no `psql`, no Supabase CLI, and the
service-role key reaches PostgREST but not DDL. `2026_09_22_private_access_cost.sql`
must be pasted into the Supabase SQL editor, as `f98822d` records doing for
the prayer-wall policy. **No application code depends on it**, so the deploy
is safe in either order — but the anonymous-read hole stays open until it is
run.

---

# Part 2 — The React version

**`package.json` says React 18.3.1, and React 18.3.1 is what ships. There
is no React 19 anywhere in this project.** The premise in the brief does
not hold, and it matters because it was the stated cause of a bug.

Evidence, in order of how conclusive it is:

| Check | Result |
|---|---|
| `node_modules/react/package.json` | **18.3.1** |
| `node_modules/react-dom/package.json` | **18.3.1** |
| `React.version` read out of `react.production.min.js` | **18.3.1** |
| `package-lock.json` `node_modules/react` | pinned **18.3.1**, with an integrity hash |
| Every `react/package.json` in the tree | one copy only, 18.3.1 |
| Version strings in the built client chunks | `"18.3.1"`, twice; no `"19.` anywhere |
| `next@14.2.15` peer requirement | `react: ^18.2.0` — React 19 would be a peer conflict |

Vercel installs from `package-lock.json`, which pins 18.3.1 with an
integrity hash, so production gets the same.

## And the identity-comparison claim is not how React works, in 18 or 19

The comments at [ScriptureReader.tsx:243](components/ScriptureReader.tsx:243)
and [:1075](components/ScriptureReader.tsx:1075) say React "compares that
prop by object identity rather than by the string inside it". Read out of
the installed `react-dom` ([react-dom.development.js:10085](node_modules/react-dom/cjs/react-dom.development.js)):

```js
var lastHtml = lastProp ? lastProp[HTML$1] : undefined;
if (nextHtml != null) {
  if (lastHtml !== nextHtml) {
    (updatePayload = updatePayload || []).push(propKey, nextHtml);
  }
}
```

React compares the **HTML string**. A fresh wrapper object around an
unchanged string produces no update. So the wholesale re-injection the
comment describes — and which was really observed, with a MutationObserver
— had some other cause: a changed HTML string, or a remount.

**Nothing is changed here.** The `useMemo` that was added is still worth
having (it keeps the prop object stable, which is good hygiene and costs
nothing), and the idempotent repaint pass beneath it is correct defensive
work. Only the diagnosis in the comments is wrong, and rewriting a comment
to say "we never established why" would be less useful than leaving the
record of what was observed. Flagged here so nobody plans around a React 19
that is not there.

## The `dangerouslySetInnerHTML` sweep

Four call sites in the whole app:

| Site | Shape | Verdict |
|---|---|---|
| [app/layout.tsx:120](app/layout.tsx:120) | theme script, module-level constant | Stable string. Fine. |
| [app/layout.tsx:121](app/layout.tsx:121) | timezone-cookie script, module-level constant | Stable string. Fine. |
| [ScriptureReader.tsx:1118](components/ScriptureReader.tsx:1118) | `chapterHtml[i]`, memoised on `chapters` | Correct. |
| — | the parallel panes | **None.** `ParallelBible` and `ReaderPane` render through `ScriptureReader`, so they inherit the memoised path. |

`grep -rn 'dangerouslySetInnerHTML' app components lib` returns those four
lines and two comments. **The new parallel panes and the Bench lenses
introduce no new injection sites at all** — the Bench renders text through
React nodes.

---

# Part 3 — Cold load and the request path

## Bundle, after this pass

`next build`, clean, at `dc46aa3`:

| | |
|---|---|
| First Load JS shared by all | **87.3 kB** |
| Middleware | **86.2 kB** (was 85.9 kB at the Elite audit; +0.3 kB for the forwarded profile) |
| Largest routes | `/bible/[book]/[chapter]` and `…/[verse]` **200 kB**, `/read/[day]/[slot]` **197 kB**, `/community` 185 kB, `/preferences` 183 kB, `/depth` 182 kB, `/day/[n]` 181 kB |
| Smallest signed-in route | `/today` **87.5 kB** — it is a redirect and carries nothing |

**Two routes are at 200 kB.** `ELITE_EXCELLENCE_AUDIT.md` recorded
`/bible/[book]/[chapter]` at 192 kB; it has grown 8 kB since, and it is the
route a member lands on from the Bible tab. Nothing in this pass moved it.
Named here as the one bundle number worth watching.

## Round trips before first paint — measured

Measured with a local stand-in for Supabase that answers like PostgREST and
counts every request, driven by a real signed-in session cookie. Median of
five runs. This isolates the count, which is the thing that can be fixed;
it does not model network distance.

| Route | Before | After | |
|---|---|---|---|
| `/today` | 4 | **2** | and the redirect target pays its own, so a tap on Today was 11 and is now 7 |
| `/day/[n]` | 7 | **5** | |
| `/depth` | 11 | **9** | |
| `/bible` | 4 | **2** | |
| `/bible/[book]` | 5 | **3** | |
| `/bible/[book]/[chapter]` | 4 | **2** | |
| `/read/[day]/[slot]` | 4 | **2** | |
| `/preferences` | 4 | **2** | |
| `/pulse` | 9 | **7** | |
| `/sermons` | 5 | **3** | |
| `/admin` | 13 | **11** | |
| `/admin/users` | 5 | **3** | |
| `/announcements` | 6 | **4** | |
| `/rhapsody` | 5 | **3** | |
| `/finished` | 6 | **4** | |

A Supabase round trip measured from this machine: **`/auth/v1/user` p50 62 ms,
p95 411 ms; `/rest/v1/profiles` p50 60 ms, p95 291 ms** (n=20 each). From a
Vercel function beside the database it is far less. The count is the
measured fact; the milliseconds depend on where the function runs.

### What the critical path for `/today` was, and is

Before — every arrow is a network round trip, in series:

```
tap Today
  → middleware getUser  → middleware profiles
  → page getUser        → page profiles(start_date)
  → 307 /day/83
  → middleware getUser  → middleware profiles
  → page getUser        → page profiles ‖ completions
  → rhapsody_days
  → chapter_reads
  → paint
  … then Nav, on the client: getUser → profiles → notifications count
```

After:

```
tap Today
  → middleware getUser  → middleware profiles      (the row is forwarded)
  → 307 /day/83                                    (no network on /today at all)
  → middleware getUser  → middleware profiles
  → completions ‖ chapter_reads
  → rhapsody_days
  → paint
  … then Nav: notifications count only
```

**Eleven server round trips to seven, and three client round trips to one.**

## Preferences applied before paint — measured, and already right

The brief asked what this costs the critical path. **Nothing.**
[lib/readingAttrs.ts](lib/readingAttrs.ts) is a pure function over the
profile row the page has already fetched; `/read/[day]/[slot]` and
`ChapterView` spread its result straight onto the reading surface. There is
no query for preferences and never was — it is already folded into an
existing fetch, which is exactly what the brief asked for.

The half that was *not* free is appearance: `PreferencesApply` is rendered
by `Nav`, which was a client component fetching its own profile. That is
what made the theme and text-size settle a beat after paint. Handing Nav
the server's row (Part 3 above) closes it — the preferences now apply in
the first frame on every server-rendered page.

## The splash overlay

`.dw-launch` is confirmed **not** blocking interaction. The
`pointer-events: none` fix from `EXCELLENCE_AUDIT.md` is in place, and the
overlay is gone from the DOM by the time the day view is interactive — a
runtime probe on `/day/83` found no `.dw-launch` element at all, with
first-contentful-paint at 196 ms and DOM-content-loaded at 30 ms.

## Middleware

- **The public-route early return is intact** and is now the first thing
  the function does. `/`, `/welcome`, `/login`, `/signup`, `/forgot-password`,
  `/reset-password`, `/auth/*`, `/api/og*`, `/c/*` and `/sources` are served
  without touching Supabase. Verified live on the local build: `/`,
  `/sources` and `/welcome` return 200 with zero Supabase requests.
- **What it costs a protected route:** one `getUser()` plus one `profiles`
  row. That was already two round trips and still is — but they are now the
  *only* two, because the render downstream reuses them.
- The 4-second `Promise.race` timeout from `9b7db0a` is unchanged.

## `useEffect` fetches on mount, before paint

Swept. The list, and what happens to each:

| Component | Fetched on mount | Now |
|---|---|---|
| `Nav` | `getUser`, `profiles`, unread count | **unread count only**, where the page has a profile |
| `CommunityFeed` | feed, cohorts, verse-of-the-day, own role, own cohorts — **5** | unchanged; `/community` is a client page with no server profile to hand down |
| `LeaderboardView` | leaderboard, cohorts, own cohorts — 3 | unchanged |
| `PrayerWall`, `FinishersView`, `CohortsView`, `NotificationsPage` | 1 each | unchanged |
| `MoreSheet` | profile + completions | unchanged, and it only mounts when the sheet opens |

`/community` making five client round trips before it can draw is the
largest remaining item of this kind. It is not fixed in this pass — see
Part 6.

---

# Part 4 — Tap responsiveness

The user's chief complaint, and the part of this audit with the clearest
cause.

## The 300 ms

The viewport meta is correct: `width=device-width, initial-scale=1,
maximum-scale=1, viewport-fit=cover` ([app/layout.tsx:66](app/layout.tsx:66)).

**But `touch-action: manipulation` appeared nowhere in the app.** Measured
in a real browser at 375 px on `/day/[n]`: **all 125 interactive elements
computed `touch-action: auto`.** The only `touch-action` in 5,244 lines of
CSS was `none`, on the Bench divider.

iOS Safari has ignored `maximum-scale=1` since iOS 10 — deliberately, so a
reader can always zoom — so double-tap-to-zoom stays live, and Safari waits
roughly 300 ms after a tap on an element it might have to zoom in case a
second tap is coming. For that 300 ms the app has done nothing visible.
That is precisely the reported symptom.

**Fixed** in `dc46aa3`: `touch-action: manipulation` on links, buttons,
inputs, selects, textareas, summaries, labels and anything carrying a
button/tab/switch role. Panning and pinch-zoom are untouched; only the
double-tap wait goes. The Bench divider keeps `touch-action: none` — it is
a class selector and wins over the element list, and a drag handle must not
pan.

**This is judgement, not measurement, on the size of the win.** The 300 ms
is Safari's documented behaviour and the `auto` computed value is measured;
the resulting improvement on a real iPhone is not something this machine
can time.

## Tap targets, hit-tested rather than guessed

Measured by hit-testing outward from each element's centre, so the
`.tap-target` `::after` helper is counted (a `getBoundingClientRect()`
sweep alone over-reports by a mile).

**Already correct:** `.verse-action` 44, `.bench-act` 44, `.bench-more` 44,
`.bench-primary` 44, `.bench-action` 44, `.chapter-pager-next` 48,
`.book-row` 52, `.hl-swatch` 46×44, bottom-nav tabs 75×54, the day-picker
*button* 83×40 box hit-testing at 59×44 via `.tap-target`, and the Alerts
bell (51×30 box) and avatar (32×32 box) both hit-testing at 44 for the same
reason. Thirteen chrome controls at or over 44.

**Fixed:** `.chip` was `min-height: 34px`. Chips are the filters — Feed /
Prayer / Leaderboard / Finishers / Cohorts, then Everyone / My cohorts —
sitting in a row where a near miss lands on the neighbour. A transparent
`::after` now takes the touch area to 44 px without moving a pixel of the
pill.

**Found and deliberately not fixed:** the day picker's **90 cells are
33 × 33 px** at 375 px, in a ten-column grid with 1 px rules between them
([DayPicker.tsx:94](components/DayPicker.tsx:94), `grid-cols-10 gap-px`,
`aspect-square`). Ten columns of 375 px cannot produce 44 px cells, and
there is no dead space to grow into — the cells already tile the full
width. The fixes available are fewer columns or non-square cells, and both
are decisions about how the picker looks. **The rules for this pass say no
design system changes, so this is reported rather than changed.** It is the
single most likely place in the app for a mis-tap.

Three small chrome controls are also under 44 and are left alone as
low-frequency: the "Deep Waters" wordmark (191×22), and "Adjust your start
date" / "Dismiss" (both 14 px tall) inside the one-time timezone notice,
which self-retires.

## Buttons that wait for the network

Swept every `async` click handler that awaits before it changes any state.
Eight, and **none of them is on the everyday path**: cohort settings
delete, copy-link, copy-verse, copy-all-highlights, sign out, report,
and two testimonial admin controls. Amen, comment, delete-comment, pray,
mark-answered and delete were all fixed in `80c9018` with optimistic state
and rollback — **confirmed no regression**; the pattern is still there.

## What a tap on a verse actually costs

Measured in a real browser on a 176-verse chapter (Psalm 119's size), on a
desktop-class CPU, from synthetic click to the selection attribute
appearing in the DOM:

| | |
|---|---|
| Median | **21.9 ms** |
| Worst of four | **32.9 ms** |
| Taps over one 16.7 ms frame | **3 of 4** |

On a 45-verse chapter the same measurement gave 4.2 ms and 32.3 ms.

The repaint pass itself is not the cost — the attribute wipe over all 176
verses measured **0.1 ms median, 1.6 ms worst**. The time is React
re-rendering `ScriptureReader` and its children. On a mid-range Android,
roughly four times slower, 21.9 ms median becomes something near 90 ms, and
that is *before* Safari's 300 ms. Together they are a complete explanation
of "the app freezes for a moment, then responds" and "sometimes a tap needs
a second attempt".

**Not fixed in this pass.** Splitting the reader so a selection does not
re-render the chapter is a real refactor of a 1,100-line component, and
doing it at the end of a performance pass without a way to measure the
result on a phone is how regressions ship. The `touch-action` fix removes
the far larger term. Recorded with its number so the next pass has a target.

---

# Part 5 — Scroll, the database, and the specific pages

## Frame rate: not measured, and why

**The automation browser available here does not run `requestAnimationFrame`
while its pane is hidden**, so every frame-rate probe returned zero frames.
Rather than report a number I did not take, here is what was measured
instead, on `/community` with 100 feed cards and a 38,043 px page:

| | |
|---|---|
| DOM nodes | 2,085 (21 per card) |
| **Forced style + layout** | **5.2 ms median, 8.4 ms worst** |
| `content-visibility: auto` in use | **0 elements** |
| Images without intrinsic size | 0 (there are no `<img>` on this page; `Avatar` falls back to initials) |

A single forced layout costing 5.2 ms is a third of a 16.7 ms frame on a
desktop. Anything that reads layout during a scroll pays it.

### `content-visibility: auto` — tried, measured, and rejected

The brief asks for it on off-screen chunks. I applied
`article { content-visibility: auto; contain-intrinsic-size: auto 380px }`
to the feed at runtime and measured the same forced layout again:

| | Median | Worst |
|---|---|---|
| Without | 5.7 ms | 9.9 ms |
| **With `content-visibility`** | **50.7 ms** | **647.9 ms** |

Nine times worse, and the page height moved by 4,652 px. The probe forces a
full layout, which is the pathological case for skipped subtrees — so this
is not proof that `content-visibility` would hurt real scrolling. It is
proof that **I have no measurement showing it helps**, and the rule for this
pass is measure or do not claim. **Not shipped.**

## The parallel-pane alignment — confirmed already correct

The brief called this a prime jank suspect. Reading
[ParallelBible.tsx:264](components/ParallelBible.tsx:264): the scroll
handler does nothing but reset a timeout. The alignment work runs once,
`ALIGN_SETTLE_MS` after scrolling stops, never during it. It also refuses
to move a pane that has a finger on it, and it goes quiet for
`ALIGN_QUIET_MS` after it moves one so the two panes cannot chase each
other.

That is the right shape, and it is why there was nothing to fix. The
remaining cost is the settle itself — one `querySelectorAll('[data-verse]')`
and a `getBoundingClientRect()` per verse until the anchor is found — which
is a single layout flush after the scroll has already stopped.

## The chapter read tracker — confirmed clean

[ChapterPager.tsx:87](components/ChapterPager.tsx:87). The
`IntersectionObserver` watches one element, the last verse. The cleanup
disconnects the observer, clears the interval and removes all five
listeners, and the effect is keyed `[book, chapter]` so each chapter gets
its own clock and its own end. **Nothing accumulates when moving quickly
through chapters.** The file's own comment explains the choice of an
observer over a scroll listener, and it is the right one.

## Indexes: none missing

Every hot-path query was run through `EXPLAIN (ANALYZE)` on the 500-member
copy, as the `authenticated` role with a real JWT, and checked for
sequential scans:

| Query | Plan | Time |
|---|---|---|
| completions by user (`/day`, `/depth`) | index | 0.45 ms |
| chapter_reads for one day (`/day`) | index | 0.32 ms |
| chapter_reads all days (`/depth`) | index | 1.47 ms |
| highlights by user (`/depth`) | index | 0.75 ms |
| verse_notes by user (`/depth`) | index | 0.28 ms |
| unread notification count (Nav) | index | 0.51 ms |
| notifications page | index | 5.31 ms |
| highlights for one chapter (reader) | index | 0.01 ms |
| prayer wall, open | index | 3.45 ms |
| comments for one completion | index | 0.07 ms |

**No sequential scan on any hot path. No index is missing, and none was
added** — the brief permits adding one only where a query provably needs it,
and none does.

## The three rebuilt views behind nicknames

The brief's suspicion was that a computed `display_name` in a view hides a
sequential scan. It does not: `display_name` is
`generated always as (coalesce(nullif(btrim(nickname), ''), name)) stored`
— a stored column on `profiles`, written at row-write time. The views select
it like any other column.

The real cost in those views was `can_see_user()`, and that is Part 1.

## `/pulse` — five RPCs, each timed

At 500 members and 18,505 completions, median of five runs each, as a
pastoral user:

| RPC | Before this pass | After | |
|---|---|---|---|
| `pulse_numbers` | 21 ms | 23 ms | — |
| `pulse_check_on` | **101 ms** | **36 ms** | 2.8× — it joins `public.leaderboard` |
| `pulse_cohorts` | 21 ms | 21 ms | — |
| `pulse_curve` | 11 ms | 11 ms | — |
| `pulse_prayers` | 1 ms | 1 ms | — |
| `pulse_person` (the sheet) | 1 ms | 1 ms | — |

**No RPC is anywhere near 500 ms.** They are issued in one `Promise.all`, so
the page waits for the slowest: **36 ms, down from 101 ms.** The improvement
is a knock-on from the leaderboard view rewrite, not separate work.

This also answers `ELITE_MAP.md` open question 6, which deferred the Pulse
aggregation cost "to 500 members": measured at exactly 500 members, it does
not need revisiting. `pulse_member_activity` is still recomputed three to
four times per render and `pulse_curve` still materialises 90 × the
membership — both are still true, and both are cheap enough that changing
them now would be work without a number behind it.

## `/community`

The feed's own query, `community_feed limit 100`, went **115.3 ms → 11.8 ms**
(Part 1). The page then makes **five client round trips before it can draw**:
the feed, the cohort list, verse-of-the-day, the viewer's role, and the
viewer's cohorts. That is the largest remaining round-trip count in the app
and it is not fixed — see Part 6.

## `/depth`

Six queries, and they are correctly in **one** `Promise.all` — no waterfall.
`STRESS_AUDIT.md` T2-D's concern was volume rather than shape, and the shape
is right.

**Three of those six are unbounded**: `highlights`, `verse_notes` and
`chapter_reads` carry no `.limit()`. At a power user's scale that is 500+
highlights, 200+ notes and up to 1,170 tick rows fetched and serialised on
every visit.

**I could not measure it.** `/depth` reads `cohort_members` with a PostgREST
embed (`cohorts(id, slug, name, start_date)`) that the local stand-in could
not reproduce faithfully; the route threw
`TypeError: Cannot read properties of undefined (reading 'slug')` and served
an error page, so the four library-size runs I did (20/10, 100/50, 500/200,
1500/600) all measured an error page and are worthless. **No cap was added,
because adding one without a measurement would be guessing at a number that
changes what a reader can see.** Recorded as the clearest target for the
next pass.

## `/bible` and `/api/bible/chapter`

`/bible` is 2 round trips after this pass (was 4); `/bible/[book]` 3 (was 5);
`/bible/[book]/[chapter]` 2 (was 4). The new `/api/bible/chapter` endpoint
is a thin wrapper over the same `fetchChapter` the server render uses, so it
rides the existing `bible_cache` and the in-flight coalescing from
`1e3e691`; a repeated reference change is a cache hit, not an API.Bible call.

## Server components forced dynamic by cookies

`todayForCurrentRequest()` reads the `dw_tz` cookie, which makes every page
that calls it dynamic. That is **not scope creep** — it is the fix from
`9b7db0a` for the timezone bug that showed west-of-UTC readers the wrong
day, and the day number cannot be right without it.

It also costs nothing extra now: every page that calls it is already dynamic
because it reads the session cookie through the Supabase server client.
There is no route in the signed-in app that could have been static and is
not. **Preferences do not add to this** — they arrive on the profile row, not
from a cookie.

## Realtime — confirmed clean, no regression

Four channels, unchanged since `APP_MAP.md` §8, each with a `Math.random()`
suffix and each removed in its effect's cleanup:
[Nav.tsx:159](components/Nav.tsx:159),
[PrayerWall.tsx:125](components/PrayerWall.tsx:125),
[LeaderboardView.tsx:76](components/LeaderboardView.tsx:76),
[CommunityFeed.tsx:101](components/CommunityFeed.tsx:101). Elite and Pulse
still open none. No double-mount, no re-subscribe on render.

## `.limit()` on every list query

Re-verified. One was missing: `CohortsView` read `cohort_summary` with no
cap, the only list surface without one. **Capped at 200**, matching the
`FinishersView` precedent from the excellence pass. Invisible at two
cohorts.

## Columns fetched but not rendered

Two deliberate `select("*")` calls remain, both on `profiles` and both
documented in place: middleware and `Nav`. The comment gives the reason — a
named column list 400s in the window between a deploy and a migration, and
that 400 reads as "no profile", which would send the whole church back
through onboarding. That trade is correct and is left alone. Now that
middleware's row is forwarded rather than re-fetched, the app pays for it
once per request instead of three times.

---

# Part 6 — What shipped, what did not

## The three biggest wins, by measured improvement

**1. The community feed: 115.3 ms → 11.8 ms (9.8×).**
`can_see_user()` was called once per candidate completion — 18,505 times for
one feed load at 500 members, at 10.09 µs a call. It now asks once per
person. Same rows for every signed-in caller, verified across 16 probes.

**2. A tap on Today: 11 server round trips → 7, and 3 client → 1.**
The profile was being fetched three times per request — middleware, page,
then Nav on the client. Middleware now forwards the row it already paid for.
Every server-rendered page in the app drops two round trips; `/today`
reaches its redirect without touching the network at all.

**3. The leaderboard: 157.0 ms → 49.3 ms (3.2×), and `pulse_check_on`
101 ms → 36 ms (2.8×)** as a knock-on, because it joins that view.

## What private access is actually costing

**Before: 143.6 ms on the feed and 142.9 ms on the leaderboard, per load, at
500 members.** That is the number the brief asked for, measured as the same
query with the filter and without it.

**After: 11.8 ms for the whole feed query, filter included.** The filter now
costs less than the query it protects, and both views are faster with
private access than they used to be without it. Nothing was weakened: no
policy dropped, no grant changed, and the leaderboard's redundant
second filter deliberately kept.

And the privacy layer is now doing what it promised, which it was not: a
caller with no session could read the private member's row through
`community_feed`, `leaderboard`, `cohort_members` and `cohort_summary`,
confirmed live against production with the public anon key.

## The user will feel this

For the pastor testing, in the order they will notice:

1. **Taps land first time.** The 300 ms iOS double-tap wait is gone from
   every button and link in the app.
2. **The filter chips on People are easier to hit** — same pills, 44 px of
   target instead of 34.
3. **Tapping Today is quicker**, and noticeably so on a slow connection: it
   was four network round trips deep before the redirect even fired, and is
   now none.
4. **The People tab and the Depth tab arrive faster** — the feed query alone
   is roughly ten times quicker, and every page saves two round trips.
5. **The bottom bar no longer changes shape after the page appears**, and
   the reading preferences no longer flash — both settle in the first frame.
6. **Church Pulse loads in about a third of the time** it did.

## Found and not fixed

| What | Why not |
|---|---|
| **The day picker's 90 cells are 33 × 33 px.** The most likely mis-tap in the app. | Ten columns of 375 px cannot give 44 px cells and there is no dead space to grow into. Every fix is a design change, and the rules for this pass forbid one. Yours to call. |
| **A verse tap costs 21.9 ms median on a long chapter** (3 of 4 taps over one frame) | The cost is React re-rendering an 1,100-line component. Splitting it is a real refactor, and doing it at the end of a performance pass with no way to measure the result on a phone is how regressions ship. |
| **`/depth` has three unbounded queries** — `highlights`, `verse_notes`, `chapter_reads` | Could not be measured: the local stand-in could not reproduce the `cohort_members` → `cohorts` PostgREST embed, so `/depth` served an error page and all four library-size runs are worthless. A cap without a measurement is a guess at a number that changes what a reader can see. |
| **`/community` makes five client round trips before it can draw** | It is a static client page with no server profile to hand down. Fixing it means making it a server component, which is a structural change to the busiest screen in the app — too much to land unmeasured at the end of this pass. |
| **`content-visibility: auto` on the feed** | Tried and measured: **9× worse** (5.7 → 50.7 ms). Not shipped. |
| **Two routes at 200 kB first-load JS** (`/bible/[book]/[chapter]` and `…/[verse]`) | Up 8 kB since the Elite audit. Nothing in this pass touched it; named so it is watched. |
| **Frame rate on any list** | The automation browser here does not run `requestAnimationFrame` while its pane is hidden. Every probe returned zero frames. Measured the determinants instead — DOM size, forced-layout cost, scroll-handler shape. |
| **`pulse_member_activity` recomputed 3–4× per render; `pulse_curve` materialises 90 × the membership** | Both still true. Both measured at 500 members and cheap (36 ms for the slowest RPC). Changing them now would be work with no number behind it. |
| **The signup trigger costs 9.3 ms and grows with the church** | `private_member_seed_trigger` runs `apply_private_member_seeds()` per inserted profile, joining `auth.users` on `lower(email)` with no index for it. Measured: 9.6 ms with the trigger, 0.2 ms without, at 400 auth users. It fires once per signup, never on a read, so it is not a hot path. Recorded, not fixed. |
| **The repo cannot rebuild the database from scratch** | Three migrations fail on a clean replay, and one of them leaves `highlights_colour_check` accepting the old colour names while the app writes the new ones. Not a performance finding; found while building the rig. Details in Part 0. |

## The one thing that needs a human

**`supabase/migrations/2026_09_22_private_access_cost.sql` has to be pasted
into the Supabase SQL editor.** There is no SQL-execution path from here to
the live project — no `psql`, no Supabase CLI, and the service-role key
reaches PostgREST but not DDL. `f98822d` records doing exactly this by hand
for the prayer-wall policy.

No application code depends on it, so the deploy is safe in either order.
But **the anonymous-read hole stays open until it is run**, and the feed and
leaderboard keep their old cost until it is too.

## Rules honoured

- No schema change but the one migration, and it adds no table, column or
  index — it replaces a function body and two view bodies, with the output
  proved identical for every signed-in caller.
- No RLS policy weakened. The 21 restrictive policies are untouched; the one
  function change makes the guarantee stricter, not looser.
- No design system change. The day-picker finding is reported rather than
  fixed for exactly this reason.
- No new dependencies. `package.json` is untouched.
- No feature removed. The one `.limit()` added is a safety cap at 200 on a
  list that holds two.
- `next build` clean, `next lint` clean.
