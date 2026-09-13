-- ============================================================
-- Deep Waters — devotional highlights & notes
--
-- The scripture-highlight tables anchor every mark to (book, chapter,
-- verse) — three integers Postgres knows are stable because scripture
-- itself is. Devotional prose has no such anchor: the text is what it is,
-- and if a re-extract corrects a paragraph break or a missed word every
-- old highlight would silently shift onto the wrong words.
--
-- These two tables anchor by structure AND by content:
--   * date        — the article, stable
--   * section     — 'verse' | 'body' | 'prayer', the parser's own labels
--   * block       — 0-indexed paragraph inside the section
--   * offset/len  — position within the block, at time of save
--   * quote       — the exact text
--   * prefix/suffix — 64 chars either side, for recovery
--
-- The client-side placement ladder in lib/devotionalHighlights.ts walks
-- these five levels in order and only accepts a match when it is unique,
-- so a highlight of "in Christ" that appears four times in a paragraph
-- never lands on the wrong one — it lands on the one where the
-- surrounding 137 characters match, or nowhere.
--
-- range_id groups the rows a cross-paragraph selection produces so the
-- toolbar can act on the whole selection at once.
--
-- Colour reuses the scripture-highlight palette so the app has one colour
-- system, not two. Same CHECK.
--
-- RLS is own-only, same policies shape as public.highlights.
--
-- ------------------------------------------------------------
-- HOW TO RUN
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Idempotent and self-verifying — safe to re-run.
-- ============================================================

-- ---------- HIGHLIGHTS ----------
create table if not exists public.devotional_highlights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  range_id    uuid not null,
  date        date not null,
  section     text not null check (section in ('verse','body','prayer')),
  block       int  not null check (block >= 0),
  "offset"    int  not null check ("offset" >= 0),
  length      int  not null check (length >= 1),
  quote       text not null,
  prefix      text,
  suffix      text,
  colour      text not null check (colour in ('shoal','current','coral','beacon','fathom','silt')),
  created_at  timestamptz not null default now()
);

create index if not exists devotional_highlights_user_date_idx
  on public.devotional_highlights(user_id, date);
create index if not exists devotional_highlights_range_idx
  on public.devotional_highlights(range_id);

alter table public.devotional_highlights enable row level security;

drop policy if exists "devo_hl_select_own" on public.devotional_highlights;
drop policy if exists "devo_hl_insert_own" on public.devotional_highlights;
drop policy if exists "devo_hl_update_own" on public.devotional_highlights;
drop policy if exists "devo_hl_delete_own" on public.devotional_highlights;

create policy "devo_hl_select_own" on public.devotional_highlights
  for select using (auth.uid() = user_id);
create policy "devo_hl_insert_own" on public.devotional_highlights
  for insert with check (auth.uid() = user_id);
create policy "devo_hl_update_own" on public.devotional_highlights
  for update using (auth.uid() = user_id);
create policy "devo_hl_delete_own" on public.devotional_highlights
  for delete using (auth.uid() = user_id);

-- ---------- NOTES ----------
create table if not exists public.devotional_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  date        date not null,
  section     text not null check (section in ('verse','body','prayer')),
  block       int  not null check (block >= 0),
  "offset"    int  not null check ("offset" >= 0),
  length      int  not null check (length >= 1),
  quote       text not null,
  prefix      text,
  suffix      text,
  body        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists devotional_notes_user_date_idx
  on public.devotional_notes(user_id, date);
create index if not exists devotional_notes_user_recent_idx
  on public.devotional_notes(user_id, updated_at desc);

create or replace function public.touch_devotional_notes()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_devotional_notes_trigger on public.devotional_notes;
create trigger touch_devotional_notes_trigger
  before update on public.devotional_notes
  for each row execute function public.touch_devotional_notes();

alter table public.devotional_notes enable row level security;

drop policy if exists "devo_note_select_own" on public.devotional_notes;
drop policy if exists "devo_note_insert_own" on public.devotional_notes;
drop policy if exists "devo_note_update_own" on public.devotional_notes;
drop policy if exists "devo_note_delete_own" on public.devotional_notes;

create policy "devo_note_select_own" on public.devotional_notes
  for select using (auth.uid() = user_id);
create policy "devo_note_insert_own" on public.devotional_notes
  for insert with check (auth.uid() = user_id);
create policy "devo_note_update_own" on public.devotional_notes
  for update using (auth.uid() = user_id);
create policy "devo_note_delete_own" on public.devotional_notes
  for delete using (auth.uid() = user_id);

-- ---------- Self-check ----------
do $$
declare
  hl_ok boolean := false;
  note_ok boolean := false;
begin
  begin
    insert into public.devotional_highlights
      (user_id, range_id, date, section, block, "offset", length, quote, prefix, suffix, colour)
    values
      ('00000000-0000-0000-0000-000000000000',
       gen_random_uuid(), current_date, 'body', 0, 0, 9, 'in Christ', '', '', 'beacon');
  exception
    when foreign_key_violation then hl_ok := true;
    when check_violation       then hl_ok := false;
    when others                then hl_ok := false;
  end;

  begin
    insert into public.devotional_notes
      (user_id, date, section, block, "offset", length, quote, prefix, suffix, body)
    values
      ('00000000-0000-0000-0000-000000000000',
       current_date, 'body', 0, 0, 9, 'in Christ', '', '', 'a note');
  exception
    when foreign_key_violation then note_ok := true;
    when check_violation       then note_ok := false;
    when others                then note_ok := false;
  end;

  if hl_ok and note_ok then
    raise notice 'Done. devotional_highlights and devotional_notes are ready — CHECK constraints permit the palette + all three sections.';
  else
    raise exception
      'Rule did not settle as expected (hl_ok=%, note_ok=%). Nothing left behind; re-run.',
      hl_ok, note_ok;
  end if;
end
$$;
