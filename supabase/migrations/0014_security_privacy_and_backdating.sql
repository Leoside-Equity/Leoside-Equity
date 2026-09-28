-- ===========================================================================
-- Leoside Equity: 0014 security, privacy and backdated publishing
-- ---------------------------------------------------------------------------
-- Paste the whole file into the Supabase SQL Editor and run it once, after
-- every earlier migration and after supabase/scheduled_publishing.sql.
-- Every step checks the current state first, so running it twice is harmless.
-- Nothing here deletes a report or an account.
--
--   1. Closes a privilege escalation: any signed in member could set
--      profiles.is_admin = true on their own row from the browser console.
--   2. Tightens table privileges so the public API can only do what the site
--      needs, and pins search_path on older helper functions.
--   3. Records the age check and terms acceptance on each profile, and makes
--      the full text of a report depend on the age check being done.
--   4. Lets an admin publish under any past date. Past and today go live now;
--      a future date is still scheduled for 06:00 India time on the day.
--   5. Adds author, position disclosure and correction fields to reports.
--   6. Server side rate limits on every write a member can make.
--   7. First party error logging, kept for 30 days, readable by admins only.
--   8. export_my_data() so a member can download everything held about them.
--   9. Indexes for the queries the site actually runs.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 0. A schema the public API never exposes. Supabase only serves the schemas
--    listed under Settings > API > Exposed schemas, which is public by default.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
-- Usage lets trigger functions resolve names in here. No table in this schema
-- carries any grant, so usage alone reads and writes nothing.
grant usage on schema private to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 1. Profiles: the privilege escalation fix
--
-- Migration 0001 ran `revoke update (is_admin) on profiles from authenticated`,
-- meaning to stop members promoting themselves. Postgres ignores a column
-- revoke while a table wide grant exists, and Supabase grants UPDATE on every
-- public table by default (0006 then granted it again explicitly). Combined
-- with the "update own profile" policy, this worked from any browser console:
--
--   SB.from('profiles').update({ is_admin: true }).eq('id', myId)
--
-- The table grant is replaced by a column grant naming only what the account
-- page edits, and a trigger refuses the protected columns as a second lock.
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar             text;
alter table public.profiles add column if not exists age_band           text;
alter table public.profiles add column if not exists guardian_confirmed boolean not null default false;
alter table public.profiles add column if not exists age_confirmed_at   timestamptz;
alter table public.profiles add column if not exists terms_version      text;
alter table public.profiles add column if not exists terms_accepted_at  timestamptz;
alter table public.profiles add column if not exists signup_source      jsonb;

revoke all on public.profiles from anon;
revoke insert, update, delete, truncate, references, trigger on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (name, market, avatar) on public.profiles to authenticated;

create or replace function public.guard_profile_columns()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- current_user is the API role for a request from the site, and the
  -- function owner inside a security definer function such as
  -- confirm_age_and_terms(), which is allowed to set the age fields.
  if current_user in ('anon', 'authenticated') then
    if new.id                 is distinct from old.id
    or new.is_admin           is distinct from old.is_admin
    or new.age_band           is distinct from old.age_band
    or new.guardian_confirmed is distinct from old.guardian_confirmed
    or new.age_confirmed_at   is distinct from old.age_confirmed_at
    or new.terms_version      is distinct from old.terms_version
    or new.terms_accepted_at  is distinct from old.terms_accepted_at
    or new.signup_source      is distinct from old.signup_source
    or new.created_at         is distinct from old.created_at then
      raise exception 'That field cannot be changed from the site.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_columns on public.profiles;
create trigger profiles_guard_columns
  before update on public.profiles
  for each row execute function public.guard_profile_columns();

-- Shape checks. NOT VALID means they apply to every new write without
-- failing on a row that already exists.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_age_band_check') then
    alter table public.profiles add constraint profiles_age_band_check
      check (age_band is null or age_band in ('13-17', '18+'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_name_length_check') then
    alter table public.profiles add constraint profiles_name_length_check
      check (name is null or char_length(name) <= 120) not valid;
  end if;
  -- Profile photos: a small inline JPEG, PNG or WebP only. SVG is refused
  -- because it can carry script. The browser re-encodes every photo to a
  -- 256 pixel JPEG, which strips camera metadata such as GPS location.
  if exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_avatar_check') then
    alter table public.profiles drop constraint profiles_avatar_check;
  end if;
  alter table public.profiles add constraint profiles_avatar_check
    check (avatar is null or (length(avatar) <= 200000
           and avatar ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')) not valid;
end $$;


-- ---------------------------------------------------------------------------
-- 2. Least privilege everywhere else
-- ---------------------------------------------------------------------------
-- Reports are read only through list_reports() and get_report(). Admins keep
-- the select and delete their RLS policies allow; nobody writes directly.
revoke all on public.reports from anon;
revoke insert, update, truncate, references, trigger on public.reports from authenticated;
grant select, delete on public.reports to authenticated;

-- Members read and write only their own rows, enforced by RLS.
revoke all on public.saved_reports, public.reading_history from anon;
revoke truncate, references, trigger on public.saved_reports, public.reading_history from authenticated;
grant select, insert, update, delete on public.saved_reports, public.reading_history to authenticated;

alter table public.profiles        enable row level security;
alter table public.reports         enable row level security;
alter table public.saved_reports   enable row level security;
alter table public.reading_history enable row level security;

-- ---------------------------------------------------------------------------
-- 2b. Rebuild every row level security policy from a clean slate
--
-- A read-only check with the public key on 25 September 2026 found that
--   GET /rest/v1/reports?select=id,body
-- returned full report text to an anonymous caller. Some policy on reports
-- (or one added by hand in the dashboard) allowed it, which bypassed the
-- sign in gate and would also have exposed drafts and scheduled reports.
-- Rather than guess which, every policy on these four tables is dropped and
-- only the minimal set below is recreated.
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('reports', 'profiles', 'saved_reports', 'reading_history')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    raise notice 'Dropped policy % on %', p.policyname, p.tablename;
  end loop;
end $$;

-- Reports: nobody reads the table directly except admins. Readers go
-- through list_reports() and get_report(), which decide what to return.
create policy "admins read reports" on public.reports
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
create policy "admins delete reports" on public.reports
  for delete to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Profiles: a member sees and edits only their own row. Which columns they
-- may edit is limited by the column grant in section 1.
create policy "read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Saved reports and reading history: own rows only, for every operation.
create policy "own saved reports" on public.saved_reports
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own reading history" on public.reading_history
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Older helper functions were created without a fixed search_path, which the
-- Supabase security advisor flags. Pin it on whichever of them exist.
do $$
declare f text;
begin
  foreach f in array array['public.set_preview()', 'public.set_published_at()',
                           'public.is_live(boolean, timestamptz)']
  loop
    if to_regprocedure(f) is not null then
      execute format('alter function %s set search_path = public, pg_temp', f);
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Rate limiting
--
-- A sliding window per signed in member (or one shared bucket for anonymous
-- callers), counted in a table the API cannot reach. Requests from the SQL
-- editor carry no JWT and are never limited.
-- ---------------------------------------------------------------------------
create table if not exists private.rate_events (
  key    text        not null,
  bucket text        not null,
  at     timestamptz not null default now()
);
create index if not exists rate_events_lookup_idx on private.rate_events (key, bucket, at desc);
revoke all on private.rate_events from public, anon, authenticated;

create or replace function private.check_rate(p_bucket text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = private, pg_temp as $$
declare
  v_claims jsonb := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  v_role   text  := coalesce(v_claims->>'role', '');
  v_key    text;
  v_count  int;
begin
  if v_role not in ('anon', 'authenticated') then return; end if;
  v_key := coalesce(v_claims->>'sub', 'anon');

  select count(*) into v_count
    from private.rate_events
   where key = v_key and bucket = p_bucket and at > now() - p_window;

  if v_count >= p_max then
    raise exception 'Too many requests. Please wait a minute and try again.'
      using errcode = 'P0001', hint = 'rate_limited';
  end if;

  insert into private.rate_events (key, bucket) values (v_key, p_bucket);

  -- Keep the table small without a scheduler: roughly one call in fifty
  -- clears anything older than a day.
  if random() < 0.02 then
    delete from private.rate_events where at < now() - interval '1 day';
  end if;
end $$;

revoke all on function private.check_rate(text, int, interval) from public;
grant execute on function private.check_rate(text, int, interval) to anon, authenticated;

create or replace function public.rate_limit_writes()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  -- Only statements sent straight from the API are counted. Writes made by
  -- the database's own security definer functions run as their owner, and
  -- must not be throttled: delete_own_account() removing a long saved list
  -- would otherwise trip the limit and leave the account undeletable.
  if current_user in ('anon', 'authenticated') then
    perform private.check_rate(tg_argv[0], tg_argv[1]::int, tg_argv[2]::interval);
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists saved_reports_rate_limit on public.saved_reports;
create trigger saved_reports_rate_limit
  before insert or update or delete on public.saved_reports
  for each row execute function public.rate_limit_writes('save', '60', '1 minute');

drop trigger if exists reading_history_rate_limit on public.reading_history;
create trigger reading_history_rate_limit
  before insert or update on public.reading_history
  for each row execute function public.rate_limit_writes('read', '120', '1 minute');

drop trigger if exists profiles_rate_limit on public.profiles;
create trigger profiles_rate_limit
  before update on public.profiles
  for each row execute function public.rate_limit_writes('profile', '30', '10 minutes');


-- ---------------------------------------------------------------------------
-- 4. New accounts record the age check, the terms version and, only when the
--    visitor allowed analytics, where they arrived from.
--
-- The date of birth itself never reaches the server. The browser works out
-- the band and sends that alone.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_meta     jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_market   text;
  v_band     text;
  v_guardian boolean;
  v_terms    text;
  v_source   jsonb;
begin
  v_market := nullif(v_meta->>'market', '');
  if v_market is null or v_market not in
     ('IN','UK','US','IN,UK','IN,US','UK,US','IN,UK,US') then
    v_market := 'IN,UK,US';
  end if;

  v_band     := v_meta->>'age_band';
  v_guardian := coalesce(v_meta->>'guardian_ok', '') = 'true';
  if v_band is null or v_band not in ('13-17', '18+') or (v_band = '13-17' and not v_guardian) then
    v_band := null;
  end if;

  v_terms := left(nullif(btrim(coalesce(v_meta->>'terms_version', '')), ''), 20);

  if jsonb_typeof(v_meta->'utm') = 'object' then
    select jsonb_object_agg(key, left(value, 100)) into v_source
      from jsonb_each_text(v_meta->'utm')
     where key in ('utm_source', 'utm_medium', 'utm_campaign', 'utm_term',
                   'utm_content', 'referrer', 'landing');
  end if;

  insert into public.profiles (id, name, market, age_band, guardian_confirmed,
                               age_confirmed_at, terms_version, terms_accepted_at,
                               signup_source)
  values (
    new.id,
    left(coalesce(nullif(v_meta->>'name', ''), nullif(v_meta->>'full_name', ''),
                  split_part(new.email, '@', 1)), 120),
    v_market,
    v_band,
    coalesce(v_band = '13-17', false),
    case when v_band is not null then now() end,
    v_terms,
    case when v_terms is not null then now() end,
    v_source
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Google sign in skips the sign up form, so those members answer the same
-- two questions on first visit. Also used by anyone whose account predates
-- the check.
create or replace function public.confirm_age_and_terms(p_band text, p_guardian boolean, p_terms_version text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'You are not signed in.'; end if;
  perform private.check_rate('age', 10, interval '1 hour');

  if p_band is null or p_band not in ('13-17', '18+') then
    raise exception 'Unsupported age band.';
  end if;
  if p_band = '13-17' and not coalesce(p_guardian, false) then
    raise exception 'A parent or guardian must agree before someone aged 13 to 17 can hold an account.';
  end if;

  update public.profiles
     set age_band           = p_band,
         guardian_confirmed = (p_band = '13-17'),
         age_confirmed_at   = coalesce(age_confirmed_at, now()),
         terms_version      = left(coalesce(nullif(btrim(coalesce(p_terms_version, '')), ''), terms_version), 20),
         terms_accepted_at  = now()
   where id = v_uid;

  -- An account whose profile row was never created (it predates the sign up
  -- trigger, say) gets one now, so the answer is not lost.
  if not found then
    insert into public.profiles (id, name, age_band, guardian_confirmed, age_confirmed_at, terms_version, terms_accepted_at)
    select v_uid, left(split_part(u.email, '@', 1), 120), p_band, (p_band = '13-17'), now(),
           left(nullif(btrim(coalesce(p_terms_version, '')), ''), 20), now()
      from auth.users u where u.id = v_uid
    on conflict (id) do nothing;
  end if;
end $$;

revoke all on function public.confirm_age_and_terms(text, boolean, text) from public, anon;
grant execute on function public.confirm_age_and_terms(text, boolean, text) to authenticated;


-- ---------------------------------------------------------------------------
-- 5. Reports: author, disclosure, correction, scheduling column
-- ---------------------------------------------------------------------------
alter table public.reports add column if not exists author       text;
alter table public.reports add column if not exists disclosure   text;
alter table public.reports add column if not exists correction   text;
alter table public.reports add column if not exists corrected_at timestamptz;
alter table public.reports add column if not exists go_live_at   timestamptz;
alter table public.reports add column if not exists published_at timestamptz;

create or replace function public.is_live(p_published boolean, p_go_live timestamptz)
returns boolean language sql stable parallel safe set search_path = public, pg_temp as $$
  select coalesce(p_published, false) or (p_go_live is not null and p_go_live <= now());
$$;
grant execute on function public.is_live(boolean, timestamptz) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 6. Publishing, now accepting past dates
--
--   past date     live immediately, filed under the date chosen
--   today         live immediately
--   future date   scheduled draft, live at 06:00 Asia/Kolkata on the day
--
-- It also validates everything it stores, so a crafted API call cannot write
-- a malformed report.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_report(p jsonb)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_is_admin   boolean;
  v_id         text;
  v_old        public.reports;
  v_found      boolean;
  v_market     text;
  v_priced     boolean;
  v_rating     text;
  v_target     text;
  v_last       text;
  v_horizon    text;
  v_date       date;
  v_today      date;
  v_live       boolean;
  v_live_at    timestamptz;
  v_published  boolean;
  v_correction text;
  v_corr_at    timestamptz;
begin
  select pr.is_admin into v_is_admin from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorised to publish';
  end if;

  v_id := btrim(coalesce(p->>'id', ''));
  select * into v_old from public.reports where id = v_id;
  v_found := found;
  -- Existing ids are left alone so an old report can still be edited. New
  -- ones have to be safe to put in a URL.
  if not v_found and v_id !~ '^[a-z0-9][a-z0-9._-]{0,118}$' then
    raise exception 'A report id must be lowercase letters, numbers, dots and hyphens.';
  end if;

  begin
    v_date := (p->>'published_on')::date;
  exception when others then
    raise exception 'The publishing date is not a valid date.';
  end;
  v_today := (now() at time zone 'Asia/Kolkata')::date;
  if v_date is null then raise exception 'Choose a publishing date.'; end if;
  if v_date < date '1990-01-01' or v_date > v_today + 400 then
    raise exception 'The publishing date % is out of range.', v_date;
  end if;

  if coalesce(btrim(p->>'ticker'), '') = '' or coalesce(btrim(p->>'company'), '') = ''
  or coalesce(btrim(p->>'title'), '') = '' or coalesce(btrim(p->>'standfirst'), '') = '' then
    raise exception 'Ticker, subject, headline and standfirst are all required.';
  end if;
  if char_length(p->>'title') > 300 or char_length(p->>'standfirst') > 1500
  or char_length(p->>'ticker') > 40 or char_length(p->>'company') > 160 then
    raise exception 'One of the fields is longer than the site allows.';
  end if;
  if jsonb_typeof(p->'body') is distinct from 'array' then
    raise exception 'The report body must be a list of sections.';
  end if;

  v_market := p->>'market';
  if v_market is null or v_market not in ('IN', 'US', 'UK') then
    raise exception 'Market must be IN, US or UK.';
  end if;
  v_priced := v_market in ('US', 'UK');

  v_rating  := nullif(p->>'rating', '');
  v_target  := left(nullif(p->>'target', ''), 60);
  v_last    := left(nullif(p->>'last_price', ''), 60);
  v_horizon := left(nullif(p->>'horizon', ''), 60);
  if not v_priced then
    v_rating := null; v_target := null; v_last := null; v_horizon := null;
  end if;
  if v_rating is not null and v_rating not in ('Undervalued', 'Fairly valued', 'Overvalued') then
    v_rating := null;
  end if;

  v_live := coalesce(p->>'is_published', '') = 'true';
  if not v_live then
    v_published := false;
    v_live_at   := null;
  elsif v_date > v_today then
    v_published := false;
    v_live_at   := (v_date + time '06:00') at time zone 'Asia/Kolkata';
  else
    v_published := true;
    -- Re-saving a live report keeps the moment it first went out.
    v_live_at := case when v_found and v_old.is_published
                      then coalesce(v_old.go_live_at, now()) else now() end;
  end if;

  v_correction := left(nullif(btrim(coalesce(p->>'correction', '')), ''), 2000);
  v_corr_at := case
    when v_correction is null then null
    when v_found and v_old.correction is not distinct from v_correction then v_old.corrected_at
    else now()
  end;

  insert into public.reports (
    id, published_on, market, ticker, company, exchange, sector, rating,
    target, last_price, horizon, read_mins, title, standfirst, body,
    is_published, go_live_at, author, disclosure, correction, corrected_at
  ) values (
    v_id, v_date, v_market, btrim(p->>'ticker'), btrim(p->>'company'),
    left(nullif(btrim(coalesce(p->>'exchange', '')), ''), 80),
    left(nullif(btrim(coalesce(p->>'sector', '')), ''), 80),
    v_rating, v_target, v_last, v_horizon,
    case when (p->>'read_mins') ~ '^\d{1,3}$' then (p->>'read_mins')::int end,
    btrim(p->>'title'), btrim(p->>'standfirst'), p->'body',
    v_published, v_live_at,
    left(nullif(btrim(coalesce(p->>'author', '')), ''), 120),
    left(nullif(btrim(coalesce(p->>'disclosure', '')), ''), 600),
    v_correction, v_corr_at
  )
  on conflict (id) do update set
    published_on = excluded.published_on,
    market       = excluded.market,
    ticker       = excluded.ticker,
    company      = excluded.company,
    exchange     = excluded.exchange,
    sector       = excluded.sector,
    rating       = excluded.rating,
    target       = excluded.target,
    last_price   = excluded.last_price,
    horizon      = excluded.horizon,
    read_mins    = excluded.read_mins,
    title        = excluded.title,
    standfirst   = excluded.standfirst,
    body         = excluded.body,
    is_published = excluded.is_published,
    go_live_at   = excluded.go_live_at,
    author       = excluded.author,
    disclosure   = excluded.disclosure,
    correction   = excluded.correction,
    corrected_at = excluded.corrected_at;

  return v_id;
end $$;

revoke all on function public.upsert_report(jsonb) from public, anon;
grant execute on function public.upsert_report(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- 7. Reading
-- ---------------------------------------------------------------------------
drop function if exists public.list_reports();
create function public.list_reports()
returns table (
  id text, published_on date, market text, ticker text, company text,
  exchange text, sector text, rating text, target text, last_price text,
  horizon text, read_mins int, title text, standfirst text, word_count int,
  published_at timestamptz
)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.published_on, r.market, r.ticker, r.company, r.exchange,
         r.sector, r.rating, r.target, r.last_price, r.horizon, r.read_mins,
         r.title, r.standfirst, r.word_count,
         coalesce(r.published_at, r.go_live_at) as published_at
    from public.reports r
   where public.is_live(r.is_published, r.go_live_at)
   order by r.published_on desc,
            coalesce(r.published_at, r.go_live_at) desc nulls last,
            r.created_at desc,
            r.id desc;
$$;
grant execute on function public.list_reports() to anon, authenticated;

-- Signed out: the preview. Signed in but the age check not yet done: the
-- preview, with reason 'age' so the page can ask. Otherwise the full body.
drop function if exists public.get_report(text);
create function public.get_report(p_id text)
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  r        public.reports;
  result   jsonb;
  v_admin  boolean := false;
  v_age_ok boolean := false;
begin
  if auth.uid() is not null then
    select coalesce(p.is_admin, false), p.age_confirmed_at is not null
      into v_admin, v_age_ok
      from public.profiles p where p.id = auth.uid();
  end if;

  select * into r from public.reports where id = p_id;
  if not found then return null; end if;

  if not public.is_live(r.is_published, r.go_live_at) and not coalesce(v_admin, false) then
    return null;
  end if;

  result := to_jsonb(r) - 'body' - 'preview' - 'is_published';
  result := result || jsonb_build_object('is_published', r.is_published);

  if auth.uid() is null then
    result := result || jsonb_build_object('locked', true, 'reason', 'signin', 'preview', r.preview);
  elsif not coalesce(v_admin, false) and not coalesce(v_age_ok, false) then
    result := result || jsonb_build_object('locked', true, 'reason', 'age', 'preview', r.preview);
  else
    result := result || jsonb_build_object('locked', false, 'body', r.body);
  end if;

  return result;
end $$;
grant execute on function public.get_report(text) to anon, authenticated;

drop function if exists public.admin_list_reports();
create function public.admin_list_reports()
returns setof public.reports
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_admin boolean;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;
  return query
    select * from public.reports r
     order by (r.go_live_at is not null and r.go_live_at > now()) desc,
              case when r.go_live_at > now() then r.go_live_at end asc,
              r.published_on desc,
              r.published_at desc nulls last,
              r.created_at desc,
              r.id desc;
end $$;
revoke all on function public.admin_list_reports() from public, anon;
grant execute on function public.admin_list_reports() to authenticated;


-- ---------------------------------------------------------------------------
-- 8. Error logging
--
-- The browser reports uncaught errors here so faults on the live site are
-- visible. Stored: the page path without its query string, the message, the
-- file and line, and a browser family such as "Chrome 130". No IP address.
-- Deleted after 30 days.
-- ---------------------------------------------------------------------------
create table if not exists public.client_errors (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  user_id uuid references auth.users on delete cascade,
  page    text,
  message text,
  source  text,
  line    int,
  browser text
);
create index if not exists client_errors_at_idx on public.client_errors (at desc);
alter table public.client_errors enable row level security;
revoke all on public.client_errors from public, anon, authenticated;

create or replace function public.log_client_error(p jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform private.check_rate('error', 20, interval '1 minute');
  -- A ceiling across everyone, so a flood cannot fill the table.
  if (select count(*) from public.client_errors where at > now() - interval '1 minute') >= 300 then
    return;
  end if;
  insert into public.client_errors (user_id, page, message, source, line, browser)
  values (
    auth.uid(),
    left(p->>'page', 200),
    left(p->>'message', 500),
    left(p->>'source', 200),
    case when (p->>'line') ~ '^\d{1,7}$' then (p->>'line')::int end,
    left(p->>'browser', 60)
  );
  delete from public.client_errors where at < now() - interval '30 days';
end $$;
revoke all on function public.log_client_error(jsonb) from public;
grant execute on function public.log_client_error(jsonb) to anon, authenticated;

create or replace function public.admin_client_errors()
returns setof public.client_errors
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_admin boolean;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;
  return query select * from public.client_errors order by at desc limit 200;
end $$;
revoke all on function public.admin_client_errors() from public, anon;
grant execute on function public.admin_client_errors() to authenticated;


-- ---------------------------------------------------------------------------
-- 9. Access and portability: everything held about the caller, as JSON
-- ---------------------------------------------------------------------------
create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception 'You are not signed in.'; end if;
  perform private.check_rate('export', 10, interval '1 hour');

  select jsonb_build_object(
    'exported_at', now(),
    'account', (select jsonb_build_object(
                  'id', u.id, 'email', u.email, 'created_at', u.created_at,
                  'email_confirmed_at', u.email_confirmed_at,
                  'last_sign_in_at', u.last_sign_in_at,
                  'sign_in_providers', u.raw_app_meta_data->'providers')
                  from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'saved_reports', coalesce((select jsonb_agg(to_jsonb(s) - 'user_id')
                                 from public.saved_reports s where s.user_id = v_uid), '[]'::jsonb),
    'reading_history', coalesce((select jsonb_agg(to_jsonb(h) - 'user_id' order by h.read_at)
                                   from public.reading_history h where h.user_id = v_uid), '[]'::jsonb),
    'error_reports', coalesce((select jsonb_agg(to_jsonb(e) - 'user_id' order by e.at)
                                 from public.client_errors e where e.user_id = v_uid), '[]'::jsonb)
  ) into v_out;

  return v_out;
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;


-- ---------------------------------------------------------------------------
-- 10. Account deletion now also clears error reports and rate counters
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid         uuid := auth.uid();
  v_is_admin    boolean;
  v_admin_count integer;
begin
  if v_uid is null then raise exception 'You are not signed in.'; end if;

  select coalesce(p.is_admin, false) into v_is_admin from public.profiles p where p.id = v_uid;
  if coalesce(v_is_admin, false) then
    select count(*) into v_admin_count from public.profiles where is_admin;
    if v_admin_count <= 1 then
      raise exception 'This is the only admin account. Make another account an admin before deleting this one.';
    end if;
  end if;

  delete from public.saved_reports   where user_id = v_uid;
  delete from public.reading_history where user_id = v_uid;
  delete from public.client_errors   where user_id = v_uid;
  delete from private.rate_events    where key = v_uid::text;
  delete from public.profiles        where id = v_uid;
  -- Removing the auth row ends the account. Sessions, refresh tokens and
  -- linked Google identities cascade from it inside the auth schema.
  delete from auth.users where id = v_uid;
end $$;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;


-- ---------------------------------------------------------------------------
-- 11. Indexes for the queries the site runs
-- ---------------------------------------------------------------------------
alter table public.saved_reports add column if not exists removed_at timestamptz;

create index if not exists reading_history_user_recent_idx on public.reading_history (user_id, read_at desc);
create index if not exists reading_history_report_idx      on public.reading_history (report_id);
create index if not exists saved_reports_user_active_idx   on public.saved_reports (user_id) where removed_at is null;
create index if not exists reports_live_order_idx          on public.reports (published_on desc, published_at desc) where is_published;
create index if not exists profiles_admins_idx             on public.profiles (id) where is_admin;


notify pgrst, 'reload schema';


-- ===========================================================================
-- Checks. Run these afterwards; every row should say true.
-- ===========================================================================
select
  not has_table_privilege('authenticated', 'public.profiles', 'UPDATE')
    and has_column_privilege('authenticated', 'public.profiles', 'name', 'UPDATE')
    and not has_column_privilege('authenticated', 'public.profiles', 'is_admin', 'UPDATE')
    as members_cannot_set_is_admin,
  not has_table_privilege('anon', 'public.profiles', 'SELECT')        as anon_cannot_read_profiles,
  not has_table_privilege('anon', 'public.reports', 'SELECT')         as anon_cannot_read_reports,
  (select count(*) = 2 from pg_policies where schemaname = 'public' and tablename = 'reports'
     and policyname in ('admins read reports', 'admins delete reports'))
  and (select count(*) = 2 from pg_policies where schemaname = 'public' and tablename = 'reports')
    as reports_only_admin_policies,
  (select relrowsecurity from pg_class where oid = 'public.reports'::regclass) as reports_rls_on,
  not has_function_privilege('anon', 'public.export_my_data()', 'EXECUTE') as anon_cannot_export,
  to_regprocedure('public.confirm_age_and_terms(text, boolean, text)') is not null as age_check_ready,
  exists (select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'reports' and column_name = 'disclosure')
    as report_disclosure_ready;
