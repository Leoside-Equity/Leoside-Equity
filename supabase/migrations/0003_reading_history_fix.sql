-- ===========================================================================
-- Leoside Equity — repair reading_history
--
-- Run this in the SQL Editor. Safe to re-run.
--
-- Why: querying the API for public.reading_history comes back with
--
--     Could not find the table 'public.reading_history' in the schema cache
--
-- while saved_reports and profiles from the same migration answer fine. So
-- either that one statement in 0001 did not commit, or PostgREST never picked
-- it up. This recreates it if missing, makes sure the grants are there, and
-- forces a schema reload.
--
-- The knock on effect was worse than a missing history list. The browser
-- loaded saved reports and reading history together, so the failure on this
-- table was blanking the saved list too, which is why the bookmark button
-- looked like it never remembered anything. The client now isolates the two,
-- but the table still needs to exist.
-- ===========================================================================

create table if not exists public.reading_history (
  user_id   uuid not null references auth.users on delete cascade,
  report_id text not null references public.reports on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (user_id, report_id)
);

alter table public.reading_history enable row level security;

drop policy if exists "own reading history" on public.reading_history;
create policy "own reading history" on public.reading_history
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Belt and braces. Supabase normally applies these to new tables in public
-- automatically, but this table clearly missed something the first time.
grant select, insert, update, delete on public.reading_history to authenticated;
grant select, insert, update, delete on public.saved_reports   to authenticated;

notify pgrst, 'reload schema';

-- Check it worked. Both should come back true.
select
  to_regclass('public.reading_history') is not null                      as history_table_exists,
  has_table_privilege('authenticated', 'public.reading_history', 'INSERT') as authenticated_can_write;
