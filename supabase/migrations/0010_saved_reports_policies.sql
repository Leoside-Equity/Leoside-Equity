-- ===========================================================================
-- Leoside Equity — repair the saved_reports and reading_history policies
--
-- RUN THIS WHOLE FILE. Safe to re-run.
--
-- THE SYMPTOM
--
-- Save a report, remove it, then try to save it again and nothing happens.
--
-- THE CAUSE
--
-- Row level security filters rows, it does not reject statements. A write that
-- no policy permits therefore comes back successful having touched zero rows.
-- The browser had no way to tell that apart from a write that worked.
--
-- So if saved_reports carried a policy for SELECT and INSERT but not for
-- UPDATE and DELETE, this happened:
--
--   save    -> INSERT allowed          -> row created
--   remove  -> UPDATE silently ignored -> row still there, browser thinks it went
--   save    -> INSERT hits the existing row, and the ON CONFLICT DO UPDATE half
--              is an UPDATE, which is still not allowed -> nothing happens
--
-- The site now checks how many rows came back and says so instead of pretending.
-- This file gives the table the complete set of policies so it does not come up.
--
-- Note the shape of the rule: every policy is scoped to auth.uid() = user_id,
-- so a reader can only ever see and change their own saved list. Nobody gains
-- access to anybody else's.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. saved_reports
-- ---------------------------------------------------------------------------
alter table public.saved_reports enable row level security;

-- Clear out whatever combination is currently there, including the names used
-- by earlier migrations, so the set below is the whole story.
do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'saved_reports'
  loop
    execute format('drop policy %I on public.saved_reports', p.policyname);
  end loop;
end $$;

create policy "read own saved reports" on public.saved_reports
  for select to authenticated
  using (auth.uid() = user_id);

create policy "add own saved reports" on public.saved_reports
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "change own saved reports" on public.saved_reports
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "remove own saved reports" on public.saved_reports
  for delete to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_reports to authenticated;

-- The upsert targets this constraint by name. Without it, ON CONFLICT has
-- nothing to match and every re-save fails as a duplicate key.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.saved_reports'::regclass
       and contype in ('u', 'p')
       and array_length(conkey, 1) = 2
  ) then
    alter table public.saved_reports
      add constraint saved_reports_user_id_report_id_key unique (user_id, report_id);
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. reading_history, same treatment for the same reason.
-- ---------------------------------------------------------------------------
alter table public.reading_history enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'reading_history'
  loop
    execute format('drop policy %I on public.reading_history', p.policyname);
  end loop;
end $$;

create policy "read own reading history" on public.reading_history
  for select to authenticated using (auth.uid() = user_id);

create policy "add own reading history" on public.reading_history
  for insert to authenticated with check (auth.uid() = user_id);

create policy "change own reading history" on public.reading_history
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "remove own reading history" on public.reading_history
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.reading_history to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.reading_history'::regclass
       and contype in ('u', 'p')
       and array_length(conkey, 1) = 2
  ) then
    alter table public.reading_history
      add constraint reading_history_user_id_report_id_key unique (user_id, report_id);
  end if;
end $$;

notify pgrst, 'reload schema';


-- ===========================================================================
-- CHECKS. Both counts must be 4: select, insert, update, delete.
-- ===========================================================================
select
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'saved_reports')    as saved_reports_policies,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'reading_history')  as reading_history_policies,
  (select exists (select 1 from pg_constraint
                   where conrelid = 'public.saved_reports'::regclass
                     and contype in ('u','p') and array_length(conkey,1) = 2))
                                                                    as saved_unique_pair;

-- And the four verbs are all present by name.
select tablename, cmd, policyname
  from pg_policies
 where schemaname = 'public' and tablename in ('saved_reports','reading_history')
 order by tablename, cmd;
