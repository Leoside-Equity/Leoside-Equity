-- ===========================================================================
-- 0012  Profile photos, and following more than one market
-- ---------------------------------------------------------------------------
-- Two changes to public.profiles.
--
-- 1. market becomes a set rather than a single choice. A reader can follow the
--    United States and the United Kingdom without caring for India, which the
--    old one-of-three constraint made impossible to say.
--
--    Stored as a sorted comma separated string: 'IN', 'IN,UK', 'IN,UK,US'.
--    Sorted on the way in so the value is canonical and 'UK,IN' cannot exist
--    alongside 'IN,UK' and split the counts in two. One text column carries
--    three flags without the table growing a boolean per country.
--
-- 2. avatar holds an optional profile photo, inline, as a data URI.
--
--    The browser crops it square and scales it to 256px before saving, which
--    lands around 10 to 20 kB. A storage bucket would mean a second set of
--    access rules to get right, and public buckets are an easy way to leak
--    things by accident. For an image this small the column is the smaller
--    surface. A generous cap is enforced below so nobody can park a megabyte
--    of base64 in a profile row.
--
-- Safe to run more than once.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. market: any combination of IN, UK and US
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

-- Existing values first. 'both' was the old way of saying everything, and a
-- single code becomes a set of one. Anything unrecognised or empty is treated
-- as no preference expressed, which means everything rather than nothing.
update public.profiles set market = 'IN,UK,US'
 where market is null or market not in ('IN', 'UK', 'US');

alter table public.profiles alter column market set default 'IN,UK,US';

-- Seven combinations of three markets, each in sorted order. Spelling them out
-- beats a regex here: it rejects duplicates like 'IN,IN' and wrong ordering,
-- both of which a pattern match would happily let through.
alter table public.profiles
  add constraint profiles_market_check
  check (market in (
    'IN', 'UK', 'US',
    'IN,UK', 'IN,US', 'UK,US',
    'IN,UK,US'
  ));


-- ---------------------------------------------------------------------------
-- 2. avatar: an optional inline profile photo
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar text;

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass
                    and conname = 'profiles_avatar_check') then
    -- Must be an inline image data URI, and no larger than roughly 512 kB of
    -- base64. The client writes about 20 kB, so this only ever catches
    -- somebody calling the API directly.
    alter table public.profiles
      add constraint profiles_avatar_check
      check (
        avatar is null
        or (avatar like 'data:image/%' and length(avatar) <= 700000)
      );
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 3. The signup trigger writes the new default
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_market text;
begin
  -- Whatever the sign up form sent, reduced to a value the constraint accepts.
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
-- 4. admin_stats counts a market as followed if it appears in the set
--
-- The counts now overlap, because somebody following two markets is counted in
-- both. That is the honest reading of the question "how many readers follow
-- India" and the dashboard labels it as such.
--
-- position() rather than like '%IN%' by habit; none of IN, UK or US is a
-- substring of another, so either works, but this stays correct if a fourth
-- market is ever added with a two letter code that overlaps.
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

notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Check it worked
--
--   select market, count(*) from public.profiles group by 1;
--     -> only sorted combinations of IN, UK and US
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar';
--     -> one row
-- ---------------------------------------------------------------------------
