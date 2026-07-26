-- ===========================================================================
-- Leoside Equity — hide drafts, fix "latest", add admin analytics
--
-- Run this in the SQL Editor after 0003. Safe to re-run.
--
-- Three things:
--
--   1. Drafts were reaching the archive and, worse, readers. Both list_reports
--      and get_report are redefined here so an unpublished report is invisible
--      to everyone except an admin previewing their own work. This has to be
--      fixed in SQL: filtering in the browser would be decoration, since
--      anyone can call the API directly with the public key.
--
--   2. "Latest" was wrong when two reports shared a date. Ordering was
--      published_on desc, id desc, so it fell back to alphabetical order by id
--      rather than to when the report was actually written. Now it breaks ties
--      on created_at, so the second report you publish on a given day is the
--      one that shows as latest.
--
--   3. Two new admin only functions for the analytics dashboard.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Archive listing. Published only, newest genuinely first.
-- ---------------------------------------------------------------------------
create or replace function public.list_reports()
returns table (
  id text, published_on date, market text, ticker text, company text,
  exchange text, sector text, rating text, target text, last_price text,
  horizon text, read_mins int, title text, standfirst text, word_count int
)
language sql stable security definer set search_path = public as $$
  select r.id, r.published_on, r.market, r.ticker, r.company, r.exchange,
         r.sector, r.rating, r.target, r.last_price, r.horizon, r.read_mins,
         r.title, r.standfirst, r.word_count
    from public.reports r
   where r.is_published = true
   order by r.published_on desc, r.created_at desc, r.id desc;
$$;


-- ---------------------------------------------------------------------------
-- 2. Single report. A draft returns null unless the caller is an admin.
-- ---------------------------------------------------------------------------
create or replace function public.get_report(p_id text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r       public.reports;
  result  jsonb;
  v_admin boolean := false;
begin
  if auth.uid() is not null then
    select coalesce(p.is_admin, false) into v_admin
      from public.profiles p where p.id = auth.uid();
  end if;

  select * into r from public.reports where id = p_id;
  if not found then return null; end if;

  -- An unpublished report does not exist as far as readers are concerned.
  if not r.is_published and not coalesce(v_admin, false) then
    return null;
  end if;

  result := to_jsonb(r) - 'body' - 'preview' - 'is_published';
  result := result || jsonb_build_object('is_published', r.is_published);

  if auth.uid() is null then
    result := result || jsonb_build_object('locked', true, 'preview', r.preview);
  else
    result := result || jsonb_build_object('locked', false, 'body', r.body);
  end if;

  return result;
end $$;

grant execute on function public.list_reports()   to anon, authenticated;
grant execute on function public.get_report(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. Admin listing, same tie break so the editor agrees with the site.
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
     order by published_on desc, created_at desc, id desc;
end $$;

grant execute on function public.admin_list_reports() to authenticated;


-- ---------------------------------------------------------------------------
-- 4. Headline analytics.
--
-- A note on what "read" means here. reading_history holds one row per reader
-- per report, so the totals count distinct people opening distinct reports.
-- 100 readers opening 3 reports each is 300, which is what you asked for.
-- Re-opening the same report by the same person updates the timestamp rather
-- than adding a row, so nobody can inflate a number by refreshing.
--
-- This is report opens, not raw page views. Counting anonymous visits to the
-- home page needs an analytics provider; Cloudflare Web Analytics is free and
-- cookieless if you want that later.
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
    'saves_total',       (select count(*) from public.saved_reports),
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


-- ---------------------------------------------------------------------------
-- 5. Per report metrics.
-- ---------------------------------------------------------------------------
create or replace function public.admin_report_metrics()
returns table (
  id text, title text, ticker text, company text, market text,
  published_on date, is_published boolean, word_count int, read_mins int,
  reads bigint, saves bigint, last_read timestamptz
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
           (select count(*) from public.saved_reports  s where s.report_id = r.id),
           (select max(h2.read_at) from public.reading_history h2 where h2.report_id = r.id)
      from public.reports r
     order by r.published_on desc, r.created_at desc;
end $$;

grant execute on function public.admin_report_metrics() to authenticated;

notify pgrst, 'reload schema';

-- Check: this must return 0. Anything above zero means a draft is still
-- reachable through the public listing.
select count(*) as drafts_leaking_into_archive
  from public.list_reports() l
  join public.reports r on r.id = l.id
 where r.is_published = false;
