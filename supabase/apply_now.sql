-- ===========================================================================
-- Leoside Equity — bring the database up to date
-- ---------------------------------------------------------------------------
-- Paste the whole of this file into the Supabase SQL Editor and run it once.
--
-- This is migrations 0012 and 0013 rolled into a single script. It is fully
-- idempotent and it does not care which of the earlier migrations you have
-- already run: every step checks the current state before changing anything,
-- so running it twice does nothing the second time.
--
-- What it does:
--
--   1. reports.market becomes a country: IN, US or UK.
--      It used to hold a calendar slot (IN_MACRO on Sunday, IN_SECTOR on
--      Saturday), which froze what each day was allowed to contain. Both
--      Indian slots collapse to IN and nothing is lost.
--
--   2. reports.rating accepts the three valuation stances, or null.
--      Anything still stored under the old Buy / Hold / Reduce wording is
--      mapped across rather than blocked.
--
--   3. Indian reports have their valuation fields cleared.
--      A note on a whole market or a sector is an argument about direction,
--      not a number against a share price.
--
--   4. profiles.market becomes a set, so a reader can follow any combination
--      of the three markets rather than picking exactly one.
--
--   5. profiles.avatar is added, for profile photos.
--      This is the fix for "Could not find the 'avatar' column of 'profiles'
--      in the schema cache" on the account settings page.
--
--   6. digest_opt_in is dropped, and the signup trigger and admin_stats are
--      rebuilt without it.
--
-- Nothing here deletes a report or an account.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. reports.market: three countries
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.reports'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%market%'
  loop
    execute format('alter table public.reports drop constraint %I', c.conname);
    raise notice 'Dropped old market constraint %', c.conname;
  end loop;
end $$;

-- Both Indian slots were India all along.
update public.reports set market = 'IN' where market in ('IN_MACRO', 'IN_SECTOR');

-- Stop before adding the constraint if anything unexpected is in there, so the
-- failure names the offending rows instead of just refusing the constraint.
do $$
declare bad text;
begin
  select string_agg(distinct market, ', ') into bad
    from public.reports
   where market is null or market not in ('IN', 'US', 'UK');

  if bad is not null then
    raise exception
      'Cannot continue: public.reports contains unexpected market values (%). '
      'Run: select id, market from public.reports where market not in (''IN'',''US'',''UK''); '
      'then correct or delete those rows and run this script again.', bad;
  end if;
end $$;

alter table public.reports
  add constraint reports_market_check
  check (market in ('IN', 'US', 'UK'));


-- ---------------------------------------------------------------------------
-- 2. reports.rating: the three valuation stances, or nothing
--
-- Saying "Buy" is advice. Saying "Undervalued" is an observation about price,
-- which is the whole reason the wording changed.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
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
update public.reports set rating = null            where rating = '';

alter table public.reports
  add constraint reports_rating_check
  check (rating is null or rating in ('Undervalued', 'Fairly valued', 'Overvalued'));


-- ---------------------------------------------------------------------------
-- 3. Indian reports carry no valuation
-- ---------------------------------------------------------------------------
update public.reports
   set rating     = null,
       target     = '',
       last_price = '',
       horizon    = ''
 where market = 'IN'
   and (rating is not null or coalesce(target, '') <> ''
        or coalesce(last_price, '') <> '' or coalesce(horizon, '') <> '');


-- ---------------------------------------------------------------------------
-- 4. profiles.market: any combination of IN, UK and US
--
-- Stored as a sorted comma separated string: 'IN', 'IN,UK', 'IN,UK,US'.
-- Sorted on the way in so the value is canonical and 'UK,IN' cannot exist
-- alongside 'IN,UK' and split the counts in two. One text column carries three
-- flags without the table growing a boolean per country.
-- ---------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.profiles'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%market%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
end $$;

-- Rebuild every value into canonical form. 'both' was the old way of saying
-- everything and contains none of the three codes, so it falls through to the
-- full set, which is also what an empty or unrecognised value means: somebody
-- who has expressed no preference wants everything, not silence.
update public.profiles p
   set market = coalesce(
     nullif(
       array_to_string(
         array(
           select code
             from (values ('IN'), ('UK'), ('US')) as t(code)
            where p.market like '%' || code || '%'
            order by code
         ), ','
       ), ''
     ),
     'IN,UK,US'
   );

alter table public.profiles alter column market set default 'IN,UK,US';

-- Seven combinations, each in sorted order. Spelling them out beats a regex:
-- it rejects duplicates like 'IN,IN' and wrong ordering, both of which a
-- pattern match would happily let through.
alter table public.profiles
  add constraint profiles_market_check
  check (market in ('IN', 'UK', 'US',
                    'IN,UK', 'IN,US', 'UK,US',
                    'IN,UK,US'));


-- ---------------------------------------------------------------------------
-- 5. profiles.avatar: an optional inline profile photo
--
-- The browser crops it square and scales it to 256px before saving, which
-- lands around 10 to 20 kB. A storage bucket would mean a second set of access
-- rules to get right, and public buckets are an easy way to leak things by
-- accident. For an image this small the column is the smaller surface. The cap
-- below is generous and only ever catches somebody calling the API directly.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and conname = 'profiles_avatar_check') then
    alter table public.profiles
      add constraint profiles_avatar_check
      check (avatar is null
             or (avatar like 'data:image/%' and length(avatar) <= 700000));
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 6. The signup trigger
--
-- Stops writing digest_opt_in, which is about to be dropped, and normalises
-- whatever the sign up form sent into a value the constraint accepts.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_market text;
begin
  v_market := nullif(new.raw_user_meta_data->>'market', '');
  if v_market is null or v_market not in
     ('IN','UK','US','IN,UK','IN,US','UK,US','IN,UK,US') then
    v_market := 'IN,UK,US';
  end if;

  insert into public.profiles (id, name, market)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''),
             split_part(new.email, '@', 1)),
    v_market
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- 7. admin_stats
--
-- Unchanged from the version you are running except for the market counts. A
-- market now counts as followed if it appears anywhere in the reader's set, so
-- the three country figures OVERLAP: somebody following two markets is counted
-- in both, and the three will add up to more than your reader count. That is
-- the honest answer to "how many readers follow India", and the dashboard says
-- so underneath the numbers.
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
    'market_in',         (select count(*) from public.profiles where 'IN' = any(string_to_array(market, ','))),
    'market_us',         (select count(*) from public.profiles where 'US' = any(string_to_array(market, ','))),
    'market_uk',         (select count(*) from public.profiles where 'UK' = any(string_to_array(market, ','))),
    'market_all',        (select count(*) from public.profiles where market = 'IN,UK,US'),
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
-- 8. Drop the email digest column, now that nothing reads it
-- ---------------------------------------------------------------------------
alter table public.profiles drop column if exists digest_opt_in;


-- PostgREST caches the shape of every table. Without this the new avatar
-- column stays invisible to the API until the project restarts on its own,
-- and the account page keeps reporting it as missing.
notify pgrst, 'reload schema';


-- ===========================================================================
-- Check it worked. Run these four afterwards; all should come back clean.
-- ===========================================================================
--
--   -- Only IN, US or UK. No rows at all is also fine.
--   select market, count(*) from public.reports group by 1;
--
--   -- One row. This is the fix for the account page error.
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name = 'avatar';
--
--   -- No digest_opt_in in the list.
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--    order by column_name;
--
--   -- Only sorted combinations of IN, UK and US.
--   select market, count(*) from public.profiles group by 1;
--
-- ===========================================================================
