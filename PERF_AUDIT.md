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
