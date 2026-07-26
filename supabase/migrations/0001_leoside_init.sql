-- ===========================================================================
-- Leoside Equity — initial schema
--
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- It is written to be safe to re-run.
--
-- The important idea: the reports table has row level security switched on
-- with NO policies, so nothing can read it directly, not even with the
-- publishable key in hand. The only way in is through the two security
-- definer functions at the bottom, and those decide how much to hand back
-- based on whether the caller is signed in. That is the real gate.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Profiles. One row per account, created automatically on sign up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  name          text,
  market        text not null default 'both' check (market in ('both', 'IN', 'US')),
  digest_opt_in boolean not null default true,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Members may edit their own name and preferences but must never be able to
-- promote themselves. Flip is_admin by hand in the table editor instead.
revoke update (is_admin) on public.profiles from authenticated;

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


-- ---------------------------------------------------------------------------
-- 2. Reports.
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id           text primary key,
  published_on date not null,
  market       text not null check (market in ('IN', 'US')),
  ticker       text not null,
  company      text not null,
  exchange     text,
  sector       text,
  rating       text check (rating in ('Buy', 'Accumulate', 'Hold', 'Reduce')),
  target       text,
  last_price   text,
  horizon      text,
  read_mins    int,
  title        text not null,
  standfirst   text not null,
  body         jsonb not null,
  preview      text,
  word_count   int,
  is_published boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists reports_published_idx
  on public.reports (is_published, published_on desc);

-- Locked by design. No select policy exists, so PostgREST cannot read this
-- table with the public key. Do not add one.
alter table public.reports enable row level security;


-- The signed out preview is generated here rather than in the browser, so the
-- rest of the report never leaves the database for an anonymous request.
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
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists reports_set_preview on public.reports;
create trigger reports_set_preview
  before insert or update on public.reports
  for each row execute function public.set_preview();


-- ---------------------------------------------------------------------------
-- 3. Reading list and history.
-- ---------------------------------------------------------------------------
create table if not exists public.saved_reports (
  user_id   uuid not null references auth.users on delete cascade,
  report_id text not null references public.reports on delete cascade,
  saved_at  timestamptz not null default now(),
  primary key (user_id, report_id)
);

alter table public.saved_reports enable row level security;
drop policy if exists "own saved reports" on public.saved_reports;
create policy "own saved reports" on public.saved_reports
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.reading_history (
  user_id   uuid not null references auth.users on delete cascade,
  report_id text not null references public.reports on delete cascade,
  read_at   timestamptz not null default now(),
  primary key (user_id, report_id)
);

alter table public.reading_history enable row level security;
drop policy if exists "own reading history" on public.reading_history;
create policy "own reading history" on public.reading_history
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 4. The gate. These two functions are the only way to read a report.
-- ---------------------------------------------------------------------------

-- Archive listing. Metadata only. Never returns body or preview, so this is
-- safe to serve to anyone, signed in or not.
create or replace function public.list_reports()
returns table (
  id text, published_on date, market text, ticker text, company text,
  exchange text, sector text, rating text, target text, last_price text,
  horizon text, read_mins int, title text, standfirst text, word_count int
)
language sql stable security definer set search_path = public as $$
  select id, published_on, market, ticker, company, exchange, sector,
         rating, target, last_price, horizon, read_mins, title,
         standfirst, word_count
    from public.reports
   where is_published = true
   order by published_on desc, id desc;
$$;

-- A single report. Signed out callers get the 90 word preview and nothing
-- else. Signed in callers get the full body. auth.uid() comes from a signed
-- JWT, so a browser cannot fake its way past this.
create or replace function public.get_report(p_id text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r      public.reports;
  result jsonb;
begin
  select * into r
    from public.reports
   where id = p_id and is_published = true;

  if not found then
    return null;
  end if;

  result := to_jsonb(r) - 'body' - 'preview' - 'is_published';

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
-- 5. Publishing. Admin only, used by admin.html.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_report(p jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select pr.is_admin into v_is_admin
    from public.profiles pr
   where pr.id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorised to publish';
  end if;

  insert into public.reports (
    id, published_on, market, ticker, company, exchange, sector, rating,
    target, last_price, horizon, read_mins, title, standfirst, body, is_published
  ) values (
    p->>'id',
    (p->>'published_on')::date,
    p->>'market',
    p->>'ticker',
    p->>'company',
    nullif(p->>'exchange', ''),
    nullif(p->>'sector', ''),
    nullif(p->>'rating', ''),
    nullif(p->>'target', ''),
    nullif(p->>'last_price', ''),
    nullif(p->>'horizon', ''),
    nullif(p->>'read_mins', '')::int,
    p->>'title',
    p->>'standfirst',
    p->'body',
    coalesce((p->>'is_published')::boolean, false)
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
    is_published = excluded.is_published;

  return p->>'id';
end $$;

grant execute on function public.upsert_report(jsonb) to authenticated;

-- Lets admin.html load a draft back for editing, including unpublished ones.
create or replace function public.admin_list_reports()
returns setof public.reports
language plpgsql stable security definer set search_path = public as $$
declare v_is_admin boolean;
begin
  select pr.is_admin into v_is_admin from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorised';
  end if;
  return query select * from public.reports order by published_on desc;
end $$;

grant execute on function public.admin_list_reports() to authenticated;
