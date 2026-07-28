-- ===========================================================================
-- 0011  The new publishing week, and the end of the email digest
-- ---------------------------------------------------------------------------
-- Two changes, both of which the front end already assumes.
--
-- 1. The week is no longer two slots. It is four:
--
--      Sunday              IN_MACRO    the Indian market as a whole
--      Monday to Wednesday US          one US listed company a day
--      Thursday, Friday    UK          one London listed company a day
--      Saturday            IN_SECTOR   one Indian sector
--
--    reports.market carried a check constraint allowing only 'IN' and 'US',
--    so publishing anything under the new week would be rejected outright.
--    profiles.market carried its own list and never knew about the UK.
--
-- 2. The daily email is gone. digest_opt_in is a column nobody can set from
--    the site any more, so it is dropped rather than left to rot as a field
--    that reads true for every account and means nothing.
--
-- Safe to run more than once.
--
-- One ordering warning. Migrations 0004 through 0008 each rebuild admin_stats()
-- with a digest_opt_in count in it, and 0006 ends with a verification select
-- over the same column. This file drops that column, so re-running any of them
-- afterwards will fail or reinstate a broken admin_stats(). If you ever need to
-- re-apply an earlier migration, run this one again immediately after.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. reports.market: allow the four slots
--
-- The constraint is dropped by name and by discovery, because a project that
-- was set up by pasting 0001 into the SQL editor may have it under either the
-- default name or one Postgres generated.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.reports'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%market%'
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
    raise notice 'Dropped old market constraint %', c.conname;
  end loop;
end $$;

-- Existing rows first: a constraint cannot be added over data that breaks it.
--
-- Old 'IN' reports were single Indian companies, and there is no Indian single
-- company slot in the new week. IN_SECTOR is the closest honest home for them,
-- and they are visibly mislabelled afterwards rather than silently wrong. If
-- you would rather delete them, do that before running this.
update public.reports set market = 'IN_SECTOR' where market = 'IN';
update public.reports set market = 'US'        where market = 'US';

alter table public.reports
  add constraint reports_market_check
  check (market in ('IN_MACRO', 'US', 'UK', 'IN_SECTOR'));


-- ---------------------------------------------------------------------------
-- 2. reports.rating: match the valuation stances the site actually offers
--
-- 0001 allowed Buy / Accumulate / Hold / Reduce, which the site stopped using
-- when it moved from recommendations to valuation stances. Saying "Buy" is
-- advice; saying "Undervalued" is an observation about price, which is the
-- whole reason for the change. Anything already stored under the old wording
-- is mapped across rather than blocked.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.reports'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%rating%'
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
    raise notice 'Dropped old rating constraint %', c.conname;
  end loop;
end $$;

update public.reports set rating = 'Undervalued'   where rating in ('Buy', 'Accumulate');
update public.reports set rating = 'Fairly valued' where rating = 'Hold';
update public.reports set rating = 'Overvalued'    where rating = 'Reduce';

alter table public.reports
  add constraint reports_rating_check
  check (rating is null or rating in ('Undervalued', 'Fairly valued', 'Overvalued'));


-- ---------------------------------------------------------------------------
-- 3. profiles.market: add the United Kingdom
--
-- This is the reader's "which market do you follow most" preference, so the
-- values are regions rather than slots. Both Indian slots are one answer.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%market%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_market_check
  check (market in ('both', 'IN', 'US', 'UK'));


-- ---------------------------------------------------------------------------
-- 4. Drop the email digest
--
-- The signup form and the account page both lost their opt in some time ago,
-- so every row reads the default and the column records a decision nobody was
-- ever asked to make. The functions that counted it are rebuilt below without
-- it, then the column goes.
--
-- Order matters: site_stats and admin_stats are recreated first, because
-- dropping a column out from under a function that selects it leaves the
-- function broken until something replaces it.
-- ---------------------------------------------------------------------------

-- The signup trigger stops writing a column that is about to disappear.
-- Otherwise every new signup would fail the moment the column goes.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, market)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''),
             split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'market', ''), 'both')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- This is 0008's admin_stats with two edits and nothing else: digest_optin is
-- gone, and market_uk is added. Every other key the dashboard reads is kept,
-- so the Audience and Reports panels carry on working unchanged.
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
    -- Region preferences. 'UK' is new, so it reads zero until people pick it.
    'market_in',         (select count(*) from public.profiles where market = 'IN'),
    'market_us',         (select count(*) from public.profiles where market = 'US'),
    'market_uk',         (select count(*) from public.profiles where market = 'UK'),
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

-- Now the column has no readers left.
alter table public.profiles drop column if exists digest_opt_in;

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Check it worked
--
--   select market, count(*) from public.reports group by 1;
--     -> only IN_MACRO, US, UK or IN_SECTOR
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles';
--     -> no digest_opt_in
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.reports'::regclass and contype = 'c';
--     -> reports_market_check and reports_rating_check, with the new lists
-- ---------------------------------------------------------------------------
