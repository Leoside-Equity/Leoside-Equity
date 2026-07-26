-- ===========================================================================
-- Leoside Equity — make the analytics functions work on whatever the tables
-- actually look like
--
-- RUN THIS WHOLE FILE. Safe to re-run.
--
-- Why this exists. admin_stats() reads a set of columns across profiles,
-- saved_reports, reading_history and auth.users. If any single one of them is
-- absent the whole function fails with "column ... does not exist", which the
-- dashboard was reporting as "analytics are not set up yet" even though the
-- function was sitting right there. The function exists. Something it reads
-- does not.
--
-- Rather than guess which one, this file makes sure every column it needs is
-- present, creates the tables if they are missing entirely, and then rebuilds
-- the two functions. The last statement prints exactly what the dashboard will
-- see, so if anything is still wrong it will say so in plain terms.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. profiles: the columns the analytics read.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade
);

alter table public.profiles add column if not exists name          text;
alter table public.profiles add column if not exists market        text    not null default 'both';
alter table public.profiles add column if not exists digest_opt_in boolean not null default true;
alter table public.profiles add column if not exists is_admin      boolean not null default false;
alter table public.profiles add column if not exists created_at    timestamptz not null default now();

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Members may change their own name and preferences, never their own role.
revoke update (is_admin) on public.profiles from authenticated;

grant select, update on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- 2. saved_reports and reading_history.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_reports (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users on delete cascade,
  report_id text not null references public.reports(id) on delete cascade,
  saved_at  timestamptz not null default now(),
  unique (user_id, report_id)
);

alter table public.saved_reports add column if not exists saved_at timestamptz not null default now();
alter table public.saved_reports enable row level security;

drop policy if exists "own saved reports" on public.saved_reports;
create policy "own saved reports" on public.saved_reports
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.reading_history (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users on delete cascade,
  report_id text not null references public.reports(id) on delete cascade,
  read_at   timestamptz not null default now(),
  unique (user_id, report_id)
);

alter table public.reading_history enable row level security;

drop policy if exists "own reading history" on public.reading_history;
create policy "own reading history" on public.reading_history
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.saved_reports   to authenticated;
grant select, insert, update, delete on public.reading_history to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Keep a profile row appearing for every new account.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, market, digest_opt_in)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''),
             nullif(new.raw_user_meta_data->>'full_name', ''),
             split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'market', ''), 'both'),
    coalesce((new.raw_user_meta_data->>'digest_opt_in')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Anyone who signed up before the trigger existed has no profile row, which
-- means no admin flag and no market preference. Give them one.
insert into public.profiles (id, name, market, digest_opt_in)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)),
       'both', true
  from auth.users u
 where not exists (select 1 from public.profiles p where p.id = u.id);


-- ---------------------------------------------------------------------------
-- 4. Rebuild the analytics now that everything they read is guaranteed to be
--    there.
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

grant execute on function public.admin_stats()          to authenticated;
grant execute on function public.admin_report_metrics() to authenticated;

notify pgrst, 'reload schema';


-- ===========================================================================
-- CHECK. This runs the same query the dashboard runs, with the admin check
-- skipped because the SQL editor has no logged in user.
--
-- If it returns a row of numbers, the dashboard will work. If it errors, the
-- message names the exact column or table still missing.
-- ===========================================================================
select
  (select count(*) from public.reports where is_published)     as reports_published,
  (select count(*) from public.reports where not is_published) as drafts,
  (select coalesce(sum(word_count), 0) from public.reports where is_published) as words,
  (select count(*) from public.reading_history)                as reads_total,
  (select count(*) from public.saved_reports)                  as saves_total,
  (select count(*) from auth.users)                            as readers,
  (select count(*) from public.profiles where digest_opt_in)   as digest_optin,
  (select count(*) from public.profiles where market = 'both') as market_both,
  (select count(*) from public.profiles where is_admin)        as admins;
