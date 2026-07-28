-- ===========================================================================
-- 0013  A report belongs to a country
-- ---------------------------------------------------------------------------
-- 0011 split the week into four slots and stored the slot on the report:
-- IN_MACRO, US, UK, IN_SECTOR. That turned out to be the wrong thing to store.
--
-- The slot is a fact about the calendar, not about the report. Storing it
-- froze every Sunday into "the whole market" and every Saturday into "one
-- sector", so writing something different on a given day meant either lying in
-- the data or not writing it. It also pushed the distinction into the reader's
-- face on every card and tag, where it did not belong.
--
-- So the column now holds a country, which is the part that is actually true
-- and stable: IN, US, UK. What shape a report takes is visible from reading
-- it, and any day is free to be whatever it needs to be.
--
-- The valuation columns become optional at the same time. A note on a whole
-- market or a sector is an argument about direction, not a number against a
-- share price, so rating, target, last_price and horizon are left empty there
-- and the report page omits the block rather than printing dashes.
--
-- Safe to run more than once.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. reports.market: three countries
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

-- Both Indian slots were India all along, so nothing is lost collapsing them.
update public.reports set market = 'IN' where market in ('IN_MACRO', 'IN_SECTOR');

alter table public.reports
  add constraint reports_market_check
  check (market in ('IN', 'US', 'UK'));


-- ---------------------------------------------------------------------------
-- 2. The valuation columns are optional
--
-- rating already allowed null after 0011. target, last_price and horizon are
-- widened to accept the empty string the form now sends for India, which they
-- do already as free text; this block only clears anything left behind on
-- rows that have just become unpriced.
-- ---------------------------------------------------------------------------
update public.reports
   set rating     = null,
       target     = '',
       last_price = '',
       horizon    = ''
 where market = 'IN';


-- ---------------------------------------------------------------------------
-- 3. profiles.avatar
--
-- Repeated from 0012 so a project that has not run it yet is not left with a
-- broken account page. "Could not find the 'avatar' column of 'profiles' in
-- the schema cache" is what PostgREST says when this has been missed.
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


-- PostgREST caches the table shape. Without this the new column stays
-- invisible to the API until the project restarts on its own.
notify pgrst, 'reload schema';


-- ---------------------------------------------------------------------------
-- Check it worked
--
--   select market, count(*) from public.reports group by 1;
--     -> only IN, US or UK
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'profiles'
--      and column_name = 'avatar';
--     -> one row
-- ---------------------------------------------------------------------------
