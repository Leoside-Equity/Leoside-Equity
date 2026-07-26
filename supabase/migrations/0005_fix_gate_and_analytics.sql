-- ===========================================================================
-- Leoside Equity — restore the sign in gate, then add analytics
--
-- RUN THIS WHOLE FILE IN THE SUPABASE SQL EDITOR. Safe to re-run.
--
-- This replaces the previous attempt. Read this bit before you run it, because
-- the first change is a security fix rather than a feature.
--
-- WHAT WENT WRONG
--
-- The previous version declared both functions as
--
--     returns setof public.reports
--
-- and public.reports contains the body column. PostgREST hands back whatever
-- the function returns, so list_reports() was serving the complete text of
-- every published report to anonymous visitors, and get_report() the same for
-- a single one. The 90 word preview was not being bypassed, it simply was not
-- happening. Anyone could read the entire archive without an account.
--
-- A function that returns the whole row can never gate anything. The fix is to
-- return only the columns the caller is allowed to have, which is what the
-- versions below do: metadata for the listing, and for a single report either
-- the preview or the body depending on who is asking.
--
-- THREE SMALLER PROBLEMS, ALSO FIXED HERE
--
--   * The parameter was named report_id. The site calls get_report({ p_id }),
--     so it could not find the function at all. That is the "missing function"
--     you were seeing.
--
--   * A status column was added with default 'published', but the app writes
--     is_published. Every row therefore got status = 'published' regardless of
--     its real state, so filtering on status would have kept leaking drafts.
--     That column holds no real information and is dropped below.
--
--   * Ordering was created_at first, which lifts an old report to the top of
--     the archive the moment you edit it. Publishing date leads, created_at
--     only breaks ties within the same day.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Remove the status column.
--
-- It was created with a default, so every existing row reads 'published'
-- whether or not it actually is. There is nothing worth keeping and nothing to
-- back fill from: is_published is the column the publishing form writes and
-- the one everything below trusts.
-- ---------------------------------------------------------------------------
alter table public.reports drop column if exists status;


-- ---------------------------------------------------------------------------
-- 2. Archive listing. Metadata only. No body, ever.
-- ---------------------------------------------------------------------------
drop function if exists public.list_reports();

create function public.list_reports()
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
-- 3. One report. Preview for signed out, body for signed in, nothing at all
--    for a draft unless you are an admin previewing your own work.
--
--    The parameter must stay named p_id. That is what the site sends.
-- ---------------------------------------------------------------------------
drop function if exists public.get_report(text);

create function public.get_report(p_id text)
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
-- 4. The preview the gate hands out.
--
-- If the preview column is empty the gate shows nothing, so make sure the
-- column and its trigger exist and back fill anything already saved.
-- ---------------------------------------------------------------------------
alter table public.reports add column if not exists preview    text;
alter table public.reports add column if not exists word_count int;

create or replace function public.set_preview()
returns trigger language plpgsql as $$
declare
  full_text text;
  words     text[];
  limit_n   int := 90;   -- keep in step with SITE.freeWords in data.js
begin
  select string_agg(p, ' ')
    into full_text
    from jsonb_array_elements(new.body) section,
         jsonb_array_elements_text(section->'p') p;

  words := string_to_array(coalesce(full_text, ''), ' ');
  new.word_count := coalesce(array_length(words, 1), 0);
  new.preview := array_to_string(words[1:limit_n], ' ')
    || case when new.word_count > limit_n then U&'\2026' else '' end;
  return new;
end $$;

drop trigger if exists reports_set_preview on public.reports;
create trigger reports_set_preview
  before insert or update on public.reports
  for each row execute function public.set_preview();

-- Recompute for rows saved before the trigger existed.
update public.reports set body = body;


-- ---------------------------------------------------------------------------
-- 5. Admin listing. Full rows here is correct: it is admin only and the
--    editor needs the body to load a report for editing.
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
-- 6. Analytics for the admin dashboard.
--
-- reading_history holds one row per reader per report, so these totals count
-- distinct people opening distinct reports. 100 readers getting through 3
-- reports each is 300. Re-opening updates the timestamp instead of adding a
-- row, so refreshing cannot inflate anything.
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


-- ---------------------------------------------------------------------------
-- 7. Admins may delete and read reports directly. Everyone else cannot touch
--    this table at all and goes through the functions above.
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists "admins delete reports" on public.reports;
create policy "admins delete reports" on public.reports
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));


notify pgrst, 'reload schema';


-- ===========================================================================
-- CHECKS. All four must come back as stated.
-- ===========================================================================
select
  -- must be 0: no draft may appear in the public listing
  (select count(*) from public.list_reports() l
     join public.reports r on r.id = l.id where r.is_published = false) as drafts_leaking,

  -- must be false: the listing must not carry report bodies
  (select exists (
     select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'reports' and column_name = 'body'
   ) and (
     select count(*) from information_schema.routines
      where routine_schema = 'public' and routine_name = 'list_reports'
        and data_type = 'record'
   ) = 0) as listing_returns_whole_row,

  -- must be p_id: anything else and the site cannot call it
  (select pg_get_function_arguments(p.oid)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_report') as get_report_args,

  -- must be 0: every published report needs preview text for the gate
  (select count(*) from public.reports
    where is_published and (preview is null or preview = '')) as reports_missing_preview;
