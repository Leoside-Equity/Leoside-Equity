-- ===========================================================================
-- Leoside Equity: scheduled publishing
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL Editor, after apply_now.sql and
-- fix_publish.sql. It changes no existing data and is safe to re-run.
--
-- Three rules, enforced in the database rather than only in the browser, so
-- they hold however the API is called:
--
--   Past date      rejected outright. No backdating.
--   Today          publishes immediately.
--   Future date    saved as a scheduled draft, live at 06:00 on that day.
--
-- How "live at 06:00" works without a cron job
-- --------------------------------------------
-- There is no scheduler here and nothing needs to run at six in the morning.
-- A new column, go_live_at, holds the moment a report becomes readable, and
-- every read compares it against now(). At 05:59 the report is invisible; at
-- 06:01 the same row is returned, because the comparison moved, not the data.
--
-- That is deliberate: a scheduler that has to fire is a scheduler that can
-- fail to fire, and a report that silently did not publish is worse than one
-- that publishes a moment late.
--
--   go_live_at IS NULL   an ordinary draft, invisible until published
--   go_live_at > now()   scheduled, still a draft, editable and deletable
--   go_live_at <= now()  live
--
-- 06:00 is Asia/Kolkata. Stored as timestamptz, so it is a real instant and
-- reads correctly for a reader anywhere in the world.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
alter table public.reports add column if not exists go_live_at timestamptz;

-- Anything already published stays published. Backfilled to its own
-- publication date so the new visibility rule agrees with the old one.
update public.reports
   set go_live_at = coalesce(published_at, (published_on::timestamp at time zone 'Asia/Kolkata'))
 where is_published and go_live_at is null;

-- The reports page and the archive both read in this order, so an index on it
-- keeps the common query cheap as the archive grows.
create index if not exists reports_go_live_idx
  on public.reports (go_live_at desc nulls last);


-- ---------------------------------------------------------------------------
-- 2. Publishing
--
-- upsert_report now decides for itself what the date means, so the rules
-- cannot be bypassed by calling the API directly with a crafted payload.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_report(p jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin   boolean;
  v_market     text;
  v_rating     text;
  v_target     text;
  v_last       text;
  v_horizon    text;
  v_priced     boolean;
  v_date       date;
  v_today      date;
  v_wants_live boolean;
  v_live_at    timestamptz;
  v_published  boolean;
begin
  select pr.is_admin into v_is_admin
    from public.profiles pr
   where pr.id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorised to publish';
  end if;

  v_date  := (p->>'published_on')::date;
  -- "Today" from the desk's point of view, not the server's. Without the zone
  -- an editor in India publishing at 01:00 would be told the date is in the
  -- past, because it is still yesterday in UTC.
  v_today := (now() at time zone 'Asia/Kolkata')::date;

  -- Rule 3: no backdating, ever.
  if v_date < v_today then
    raise exception 'Cannot publish into the past. % is before today (%).', v_date, v_today
      using hint = 'Pick today or a later date.';
  end if;

  v_wants_live := coalesce((p->>'is_published')::boolean, false);

  if not v_wants_live then
    -- Saved as a draft with no date attached to it.
    v_published := false;
    v_live_at   := null;
  elsif v_date > v_today then
    -- Rule 1: future date. Held as a draft until 06:00 on the day.
    v_published := false;
    v_live_at   := (v_date + time '06:00') at time zone 'Asia/Kolkata';
  else
    -- Rule 2: today. Live now, no six o'clock delay.
    v_published := true;
    v_live_at   := now();
  end if;

  v_market := p->>'market';
  v_priced := v_market in ('US', 'UK');

  v_rating  := nullif(p->>'rating', '');
  v_target  := nullif(p->>'target', '');
  v_last    := nullif(p->>'last_price', '');
  v_horizon := nullif(p->>'horizon', '');

  if not v_priced then
    v_rating := null; v_target := null; v_last := null; v_horizon := null;
  end if;

  if v_rating is not null
     and v_rating not in ('Undervalued', 'Fairly valued', 'Overvalued') then
    v_rating := null;
  end if;

  insert into public.reports (
    id, published_on, market, ticker, company, exchange, sector, rating,
    target, last_price, horizon, read_mins, title, standfirst, body,
    is_published, go_live_at
  ) values (
    p->>'id', v_date, v_market, p->>'ticker', p->>'company',
    nullif(p->>'exchange', ''), nullif(p->>'sector', ''),
    v_rating, v_target, v_last, v_horizon,
    nullif(p->>'read_mins', '')::int,
    p->>'title', p->>'standfirst', p->'body',
    v_published, v_live_at
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
    go_live_at   = excluded.go_live_at;

  return p->>'id';
end $$;

grant execute on function public.upsert_report(jsonb) to authenticated;


-- ---------------------------------------------------------------------------
-- 3. Reading
--
-- One condition, written once, used by both readers' functions: a report is
-- live if it was published outright, or if its scheduled moment has passed.
-- ---------------------------------------------------------------------------
-- STABLE, not IMMUTABLE. It reads now(), so its result changes between
-- statements. Marking it immutable would licence Postgres to evaluate it once
-- and reuse the answer, which is precisely the thing that must not happen to
-- a check whose whole job is to notice that six o'clock has passed.
create or replace function public.is_live(p_published boolean, p_go_live timestamptz)
returns boolean
language sql stable parallel safe as $$
  select coalesce(p_published, false)
      or (p_go_live is not null and p_go_live <= now());
$$;

-- Dropped rather than replaced. Postgres refuses to change the shape of a
-- function's result with CREATE OR REPLACE, and this one already returns a
-- published_at column, so replacing it in place fails with
-- "cannot change return type of existing function".
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
         r.title, r.standfirst, r.word_count,
         -- A scheduled report goes live without anything writing to
         -- published_at, so the moment it was released is go_live_at. The
         -- front end gets one timestamp either way and does not need to know
         -- which route the report took.
         coalesce(r.published_at, r.go_live_at) as published_at
    from public.reports r
   where public.is_live(r.is_published, r.go_live_at)
   order by r.published_on desc,
            coalesce(r.published_at, r.go_live_at) desc nulls last,
            r.created_at desc,
            r.id desc;
$$;

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

  -- A scheduled report does not exist as far as readers are concerned, in
  -- exactly the same way a draft does not. An admin can still open it to
  -- check it before it goes out.
  if not public.is_live(r.is_published, r.go_live_at) and not coalesce(v_admin, false) then
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

grant execute on function public.is_live(boolean, timestamptz) to anon, authenticated;
grant execute on function public.list_reports()   to anon, authenticated;
grant execute on function public.get_report(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4. The editor's list
--
-- Scheduled reports sit in the drafts list, soonest first, so what is about to
-- go out is at the top of the queue rather than buried by publication date.
-- ---------------------------------------------------------------------------
-- Also dropped first. It returns `setof public.reports`, and adding go_live_at
-- to that table changed the row type, which CREATE OR REPLACE will not accept
-- for the same reason as above.
drop function if exists public.admin_list_reports();

create function public.admin_list_reports()
returns setof public.reports
language plpgsql stable security definer set search_path = public as $$
declare v_admin boolean;
begin
  select p.is_admin into v_admin from public.profiles p where p.id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'Not authorised'; end if;
  return query
    select * from public.reports r
     -- Anything still waiting comes first, soonest out at the top. Everything
     -- already dealt with falls in behind, newest first.
     order by (r.go_live_at is not null and r.go_live_at > now()) desc,
              case when r.go_live_at > now() then r.go_live_at end asc,
              r.published_on desc,
              r.published_at desc nulls last,
              r.created_at desc,
              r.id desc;
end $$;

grant execute on function public.admin_list_reports() to authenticated;

notify pgrst, 'reload schema';


-- ===========================================================================
-- Check it worked
--
--   -- Nothing scheduled should appear here until its moment passes.
--   select id, published_on, is_published, go_live_at,
--          public.is_live(is_published, go_live_at) as live
--     from public.reports order by published_on desc;
--
--   -- Should raise "Cannot publish into the past".
--   select public.upsert_report(jsonb_build_object(
--     'id','backdate-test','published_on','2020-01-01','market','US',
--     'ticker','X','company','X','title','X','standfirst','X',
--     'body','[]'::jsonb,'read_mins','1','is_published',true));
-- ===========================================================================
