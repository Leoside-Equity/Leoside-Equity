-- ===========================================================================
-- Leoside Equity — order by when a report went live, and keep save history
--
-- RUN THIS WHOLE FILE. It is the only one you need: it includes everything
-- 0007 did, so you can skip that one. Safe to re-run.
--
-- PROBLEM 1. Ordering used created_at as the tie break, which is when the row
-- was first written, in other words when you started the draft. So:
--
--   draft abc  ->  publish xyz  ->  publish abc
--
-- left abc below xyz forever, because abc was created first even though it
-- went live last. Draft time is not publish time.
--
-- The fix is a published_at column, stamped the moment is_published turns
-- true. Ordering uses that, so whichever report you actually pushed live most
-- recently is the latest one and sits at the top of the archive.
--
-- Note on which key leads. Sorting is published_on first, then published_at.
-- published_on is the date you choose for the report and the date readers see,
-- and the archive groups by month, so it has to lead or the month headings
-- would interleave. published_at then decides the order within a day, which is
-- exactly the case described above. If you would rather ignore your chosen
-- date entirely and sort purely by go live time, say so and I will swap the
-- two keys round.
--
-- PROBLEM 2. Unsaving deleted the row, so "saved ever" could never be counted.
-- removed_at makes it a soft delete instead.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. When each report actually went live.
-- ---------------------------------------------------------------------------
alter table public.reports add column if not exists published_at timestamptz;

-- Best guess for anything already published: fall back to when it was written.
update public.reports
   set published_at = coalesce(published_at, created_at, now())
 where is_published = true and published_at is null;

-- Stamp it on the false -> true transition, and on a re-publish, so the column
-- always means "last went live at". Unpublishing clears it, so a draft carries
-- no publish time and cannot outrank a live report.
create or replace function public.set_published_at()
returns trigger language plpgsql as $$
begin
  if new.is_published and (old is null or not old.is_published or new.published_at is null) then
    new.published_at := now();
  elsif not new.is_published then
    new.published_at := null;
  end if;
  return new;
end $$;

drop trigger if exists reports_set_published_at on public.reports;
create trigger reports_set_published_at
  before insert or update on public.reports
  for each row execute function public.set_published_at();


-- ---------------------------------------------------------------------------
-- 2. Save history. Removing a save stamps a time instead of deleting the row.
-- ---------------------------------------------------------------------------
alter table public.saved_reports add column if not exists removed_at timestamptz;

create index if not exists saved_reports_active_idx
  on public.saved_reports (report_id) where removed_at is null;


-- ---------------------------------------------------------------------------
-- 3. Archive listing. Published only, ordered by when it went live.
-- ---------------------------------------------------------------------------
drop function if exists public.list_reports();

create function public.list_reports()
returns table (
  id text, published_on date, market text, ticker text, company text,
  exchange text, sector text, rating text, target text, last_price text,
  horizon text, read_mins int, title text, standfirst text, word_count int,
  published_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select r.id, r.published_on, r.market, r.ticker, r.company, r.exchange,
         r.sector, r.rating, r.target, r.last_price, r.horizon, r.read_mins,
         r.title, r.standfirst, r.word_count, r.published_at
    from public.reports r
   where r.is_published = true
   order by r.published_on desc,
            r.published_at desc nulls last,
            r.created_at desc,
            r.id desc;
$$;

grant execute on function public.list_reports() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. Admin listing, same order so the editor agrees with the site. Drafts
--    have no published_at so they sort after live reports on the same date.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_reports()
returns setof public.reports
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;
  return query
    select * from public.reports
     order by published_on desc, published_at desc nulls last, created_at desc, id desc;
end $$;

grant execute on function public.admin_list_reports() to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Metrics with both save figures.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_report_metrics();

create function public.admin_report_metrics()
returns table (
  id text, title text, ticker text, company text, market text,
  published_on date, published_at timestamptz, is_published boolean,
  word_count int, read_mins int,
  reads bigint, saves_current bigint, saves_total bigint, last_read timestamptz
)
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;

  return query
    select r.id, r.title, r.ticker, r.company, r.market, r.published_on,
           r.published_at, r.is_published, r.word_count, r.read_mins,
           (select count(*) from public.reading_history h where h.report_id = r.id),
           (select count(*) from public.saved_reports s
             where s.report_id = r.id and s.removed_at is null),
           (select count(*) from public.saved_reports s where s.report_id = r.id),
           (select max(h2.read_at) from public.reading_history h2 where h2.report_id = r.id)
      from public.reports r
     order by r.published_on desc, r.published_at desc nulls last, r.created_at desc;
end $$;

grant execute on function public.admin_report_metrics() to authenticated;


-- ---------------------------------------------------------------------------
-- 6. Headline figures. saves_total is live saves, saves_ever includes removed.
-- ---------------------------------------------------------------------------
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


-- ===========================================================================
-- CHECKS
-- ===========================================================================
select
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='reports' and column_name='published_at'))
    as published_at_exists,
  (select exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='saved_reports' and column_name='removed_at'))
    as removed_at_exists,
  -- must be 0: every live report needs a publish time to sort by
  (select count(*) from public.reports where is_published and published_at is null)
    as published_without_timestamp,
  -- must be 0: a draft must not carry one
  (select count(*) from public.reports where not is_published and published_at is not null)
    as drafts_with_timestamp;

-- What the archive will now show, top first.
select id, ticker, published_on, published_at, is_published
  from public.reports
 order by is_published desc, published_on desc, published_at desc nulls last;
