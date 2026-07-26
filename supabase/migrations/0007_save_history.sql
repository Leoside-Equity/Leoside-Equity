-- ===========================================================================
-- Leoside Equity — keep a record of saves that were later removed
--
-- RUN THIS WHOLE FILE. Safe to re-run.
--
-- The problem. Unsaving a report deleted the row, so the moment a reader
-- changed their mind the fact that they had ever saved it was gone. "Saves"
-- on the metrics screen was therefore only ever a snapshot of right now, and
-- there was no way to tell a report nobody saved from one that fifty people
-- saved and then dropped.
--
-- The fix is a soft delete. Removing a save stamps removed_at instead of
-- deleting the row, so:
--
--   current saves = rows where removed_at is null
--   total saves   = every row, ever
--
-- The unique constraint on (user_id, report_id) is what stops the same person
-- being counted twice. Saving, removing and saving again reuses the one row
-- and clears removed_at, so total stays at one for that reader.
-- ===========================================================================

alter table public.saved_reports add column if not exists removed_at timestamptz;

-- Anything already in the table is a live save, so leave removed_at null.
create index if not exists saved_reports_active_idx
  on public.saved_reports (report_id) where removed_at is null;


-- ---------------------------------------------------------------------------
-- Metrics now report both figures.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_report_metrics();

create function public.admin_report_metrics()
returns table (
  id text, title text, ticker text, company text, market text,
  published_on date, is_published boolean, word_count int, read_mins int,
  reads bigint, saves_current bigint, saves_total bigint, last_read timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;

  return query
    select r.id, r.title, r.ticker, r.company, r.market, r.published_on,
           r.is_published, r.word_count, r.read_mins,
           (select count(*) from public.reading_history h where h.report_id = r.id),
           (select count(*) from public.saved_reports s
             where s.report_id = r.id and s.removed_at is null),
           (select count(*) from public.saved_reports s
             where s.report_id = r.id),
           (select max(h2.read_at) from public.reading_history h2 where h2.report_id = r.id)
      from public.reports r
     order by r.published_on desc, r.created_at desc;
end $$;

grant execute on function public.admin_report_metrics() to authenticated;


-- Headline figure counts live saves only, so it matches what readers hold.
create or replace function public.admin_stats()
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean; result jsonb;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;

  select jsonb_build_object(
    'reports_published', (select count(*) from public.reports where is_published),
    'reports_draft',     (select count(*) from public.reports where not is_published),
    'words_published',   (select coalesce(sum(word_count), 0) from public.reports where is_published),
    'words_all',         (select coalesce(sum(word_count), 0) from public.reports),
    'reads_total',       (select count(*) from public.reading_history),
    'reads_today',       (select count(*) from public.reading_history where read_at >= date_trunc('day', now())),
    'reads_week',        (select count(*) from public.reading_history where read_at >= now() - interval '7 days'),
    'readers_total',     (select count(*) from auth.users),
    'readers_week',      (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'readers_confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'saves_total',       (select count(*) from public.saved_reports where removed_at is null),
    'saves_ever',        (select count(*) from public.saved_reports),
    'digest_optin',      (select count(*) from public.profiles where digest_opt_in),
    'market_in',         (select count(*) from public.profiles where market = 'IN'),
    'market_us',         (select count(*) from public.profiles where market = 'US'),
    'market_both',       (select count(*) from public.profiles where market = 'both'),
    'signups_daily',     (select coalesce(jsonb_agg(d order by d->>'day'), '[]'::jsonb)
                            from (
                              select jsonb_build_object(
                                       'day', to_char(date_trunc('day', created_at), 'YYYY-MM-DD'),
                                       'n',   count(*)
                                     ) as d
                                from auth.users
                               where created_at >= now() - interval '14 days'
                               group by date_trunc('day', created_at)
                            ) s)
  ) into result;

  return result;
end $$;

grant execute on function public.admin_stats() to authenticated;

notify pgrst, 'reload schema';

-- Check. removed_at must exist, and total must never be below current.
select
  (select exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'saved_reports'
                     and column_name = 'removed_at'))                       as removed_at_exists,
  (select count(*) from public.saved_reports where removed_at is null)      as saves_current,
  (select count(*) from public.saved_reports)                              as saves_total;
