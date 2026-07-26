-- ===========================================================================
-- Leoside Equity — let a reader delete their own account
--
-- RUN THIS WHOLE FILE IN THE SUPABASE SQL EDITOR. Safe to re-run.
--
-- WHY A DATABASE FUNCTION AND NOT JUST THE CLIENT
--
-- Supabase exposes user deletion only through auth.admin.deleteUser(), which
-- requires the service_role key. That key bypasses every row level security
-- rule you have, so it can never go into front end code: anyone who opened
-- the page source would be able to delete any account on the site, read every
-- report, and rewrite the database.
--
-- The function below is the safe equivalent. It is security definer, so it
-- runs with the rights needed to touch auth.users, but it reads auth.uid()
-- from the caller's signed token and deletes only that row. There is no
-- parameter, so there is nothing to tamper with: a caller cannot ask it to
-- delete somebody else.
--
-- WHAT GETS WIPED
--
-- Deleting the auth.users row cascades through the foreign keys, so the
-- profile, the saved list and the reading history all go with it. Section 1
-- makes sure those cascades are actually in place, because a foreign key
-- created without ON DELETE CASCADE would instead block the delete.
--
-- Reports are deliberately NOT deleted. They have no owner column and they
-- are the site's content, not the reader's data. An admin removing their own
-- account does not take the published work down with them.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Make sure every table that points at a user cascades on delete.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.conname, c.conrelid::regclass as tbl
      from pg_constraint c
      join pg_class f on f.oid = c.confrelid
      join pg_namespace fn on fn.oid = f.relnamespace
     where c.contype = 'f'
       and fn.nspname = 'auth'
       and f.relname  = 'users'
       and c.confdeltype <> 'c'                    -- 'c' = cascade
       and c.conrelid::regclass::text in
           ('public.profiles', 'public.saved_reports', 'public.reading_history')
  loop
    raise notice 'Rebuilding % on % to cascade', r.conname, r.tbl;
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;

-- Re-add anything the loop dropped, plus anything that was never there.
do $$
begin
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.profiles'::regclass and contype = 'f') then
    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.saved_reports'::regclass
                    and contype = 'f' and conname like '%user_id%') then
    alter table public.saved_reports
      add constraint saved_reports_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.reading_history'::regclass
                    and contype = 'f' and conname like '%user_id%') then
    alter table public.reading_history
      add constraint reading_history_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- 2. The deletion function.
-- ---------------------------------------------------------------------------
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_is_admin    boolean;
  v_admin_count integer;
begin
  if v_uid is null then
    raise exception 'You are not signed in.';
  end if;

  -- Losing the last admin would leave nobody able to publish or moderate, and
  -- there is no way back in through the site to fix it.
  select coalesce(p.is_admin, false) into v_is_admin
    from public.profiles p where p.id = v_uid;

  if coalesce(v_is_admin, false) then
    select count(*) into v_admin_count from public.profiles where is_admin;
    if v_admin_count <= 1 then
      raise exception 'This is the only admin account. Make another account an admin before deleting this one.';
    end if;
  end if;

  -- Explicit deletes first so this still wipes cleanly even if a cascade is
  -- ever dropped from one of these tables by a later migration.
  delete from public.saved_reports   where user_id = v_uid;
  delete from public.reading_history where user_id = v_uid;
  delete from public.profiles        where id      = v_uid;

  -- Removing the auth row is what actually ends the account.
  delete from auth.users where id = v_uid;
end $$;

-- Postgres grants EXECUTE on new functions to PUBLIC by default, which would
-- let an anonymous caller reach it. It would fail on the auth.uid() check, but
-- there is no reason to expose it at all.
revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant  execute on function public.delete_own_account() to authenticated;

notify pgrst, 'reload schema';


-- ===========================================================================
-- CHECKS. All four must be true.
-- ===========================================================================
select
  (select exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public' and p.proname = 'delete_own_account'))
    as function_exists,

  (select has_function_privilege('authenticated', 'public.delete_own_account()', 'EXECUTE'))
    as authenticated_can_call,

  (select not has_function_privilege('anon', 'public.delete_own_account()', 'EXECUTE'))
    as anon_cannot_call,

  (select count(*) = 0 from pg_constraint c
     join pg_class f on f.oid = c.confrelid
     join pg_namespace fn on fn.oid = f.relnamespace
    where c.contype = 'f' and fn.nspname = 'auth' and f.relname = 'users'
      and c.confdeltype <> 'c'
      and c.conrelid::regclass::text in
          ('public.profiles', 'public.saved_reports', 'public.reading_history'))
    as all_user_tables_cascade;
