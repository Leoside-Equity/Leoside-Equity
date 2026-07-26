-- ===========================================================================
-- Leoside Equity — admin delete
--
-- Run this in the SQL Editor after 0001. Safe to re-run.
--
-- Why this is needed: public.reports has row level security on with no
-- policies, so a client side
--
--     supabase.from('reports').delete().eq('id', reportId)
--
-- currently deletes nothing. It does not even error. RLS filters rows rather
-- than refusing the statement, so the call comes back "successful" having
-- touched zero rows, which is the worst possible failure mode.
--
-- The two policies below let an admin, and only an admin, delete a report and
-- read it back. Everyone else is unaffected: regular members still cannot
-- select from this table at all and still go through get_report(), so the
-- sign in gate is untouched.
-- ===========================================================================

-- Admins may delete any report.
drop policy if exists "admins delete reports" on public.reports;
create policy "admins delete reports" on public.reports
  for delete to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Admins may read reports directly. This is what makes
-- .delete().select('id') able to report back which row it removed, since
-- DELETE ... RETURNING needs select visibility. It also lets the publishing
-- screen list drafts without a separate function call.
--
-- Note for anyone reading this later: this does NOT open the gate. The policy
-- only passes for a profile with is_admin true. A normal signed in member
-- still gets zero rows from a direct select.
drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports
  for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Saved lists and reading history reference reports with on delete cascade,
-- so removing a report cleans those up on its own. Nothing else to do.

notify pgrst, 'reload schema';
