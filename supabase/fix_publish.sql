-- ===========================================================================
-- Leoside Equity: make publishing impossible to break on the valuation fields
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL Editor. It replaces one function and
-- changes no data. Safe to run more than once.
--
-- The problem it fixes
-- --------------------
-- Publishing kept failing with:
--
--     new row for relation "reports" violates check constraint
--     "reports_rating_check"
--
-- even though the constraint already allows NULL. That means a rating was
-- arriving that is not one of the three stances: a value left over from an
-- older build of the publishing form, a cached copy of the page, an autosaved
-- draft, or a report edited from a time when the wording was different.
--
-- Chasing that through the browser is the wrong place to fix it. The rating is
-- a cosmetic label on a report, so it should never be the reason a piece of
-- writing cannot be saved. This makes upsert_report responsible for handing
-- the table a value the table will accept:
--
--   * a market with no share price behind it stores no valuation at all
--   * a stance that is not one of the three is stored as nothing
--
-- Nothing is silently mangled: a valid stance is stored exactly as sent. The
-- only values that change are ones the database would otherwise have refused
-- outright, taking the whole report down with them.
-- ===========================================================================

create or replace function public.upsert_report(p jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_is_admin  boolean;
  v_market    text;
  v_rating    text;
  v_target    text;
  v_last      text;
  v_horizon   text;
  -- Markets that carry a valuation. Kept here rather than read from another
  -- table so this function has no new dependency.
  v_priced    boolean;
begin
  select pr.is_admin into v_is_admin
    from public.profiles pr
   where pr.id = auth.uid();

  if not coalesce(v_is_admin, false) then
    raise exception 'Not authorised to publish';
  end if;

  v_market := p->>'market';
  v_priced := v_market in ('US', 'UK');

  v_rating  := nullif(p->>'rating', '');
  v_target  := nullif(p->>'target', '');
  v_last    := nullif(p->>'last_price', '');
  v_horizon := nullif(p->>'horizon', '');

  -- A note on a whole market or a sector is an argument about direction, not a
  -- number against a share price. Anything sent for one is dropped.
  if not v_priced then
    v_rating  := null;
    v_target  := null;
    v_last    := null;
    v_horizon := null;
  end if;

  -- Any stance the table would reject becomes no stance, rather than an error
  -- that loses the report.
  if v_rating is not null
     and v_rating not in ('Undervalued', 'Fairly valued', 'Overvalued') then
    raise notice 'Dropping unrecognised valuation stance %', v_rating;
    v_rating := null;
  end if;

  insert into public.reports (
    id, published_on, market, ticker, company, exchange, sector, rating,
    target, last_price, horizon, read_mins, title, standfirst, body, is_published
  ) values (
    p->>'id',
    (p->>'published_on')::date,
    v_market,
    p->>'ticker',
    p->>'company',
    nullif(p->>'exchange', ''),
    nullif(p->>'sector', ''),
    v_rating,
    v_target,
    v_last,
    v_horizon,
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

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Check it worked: publish an Indian report from admin.html. It should save.
-- Afterwards, this should show a null rating against it.
--
--   select id, market, rating, target, last_price, horizon
--     from public.reports order by published_on desc limit 5;
-- ---------------------------------------------------------------------------
