# Connecting the backend

Fifteen minutes, start to finish. Do these in order.

Your project is already filled in at `assets/js/config.js`:

- **URL** `https://karzpemgpmrlaaflghpk.supabase.co`
- **Publishable key** `sb_publishable_A496gz-...`

Both are public client-side keys and are safe in the repo. The `service_role` / secret key is not, and must never appear in any file in this folder.

---

## 1. Run the migration

Supabase dashboard → **SQL Editor** → New query. Paste the whole of `supabase/migrations/0001_leoside_init.sql` and run it.

That creates the profiles, reports, saved and history tables, and the three functions that do the real work.

Then run every remaining file in `supabase/migrations/` **in numerical order**, `0002` through `0011`.

`0011` is not optional. It is the one that lets the new publishing week exist: until it runs, `reports.market` still carries a check constraint allowing only `IN` and `US`, and saving anything from `admin.html` under `IN_MACRO`, `UK` or `IN_SECTOR` will be rejected by the database with a constraint violation. It also drops `profiles.digest_opt_in`, since there is no mailing list.

> **Do not re-run `0004` through `0008` once `0011` has been applied.** Those files rebuild `admin_stats()` with a `digest_opt_in` count in it, and `0006` ends with a verification `select` over the same column. `0011` drops that column, so re-running an earlier file afterwards either fails outright or quietly reinstates a broken `admin_stats()` and takes the dashboard's Audience panel down with it. If you need to re-apply an earlier migration for some other reason, run `0011` again straight after it to put things back.

Each migration up to `0010` is individually safe to re-run in order; it is only the backwards jump across `0011` that bites.

**Check it worked.** In the same editor run:

```sql
select public.get_report('anything');
```

You should get `null`, not a permission error. Then:

```sql
select * from public.reports;
```

Empty table, no error. If instead you see "permission denied", the RLS setup is doing its job on the API but you are querying as the SQL editor's superuser, so this should still work. If it errors, re-run the migration.

## 2. Turn on email confirmation

Authentication → **Sign In / Providers** → Email. Leave "Confirm email" **on**. It costs one extra click for the reader and stops fake signups inflating your numbers.

This is the only email the site sends, alongside password resets and account notices. There is no digest and no mailing list, and the privacy policy and terms both state that plainly, so do not wire one up without changing them first.

Authentication → **URL Configuration**:

- Site URL: your live domain (use `http://localhost:5173` until you deploy)
- Redirect URLs: add both `http://localhost:5173/**` and `https://yourdomain.com/**`

## 3. Add Google sign in

1. Google Cloud Console → new project → **APIs & Services → OAuth consent screen**. External, fill in the app name and your support email.
2. **Credentials → Create credentials → OAuth client ID → Web application.**
3. Supabase → Authentication → Providers → Google. Copy the **Callback URL** shown there.
4. Paste that URL into Google's **Authorised redirect URIs**. Save.
5. Copy Google's Client ID and Client Secret back into Supabase. Enable the provider.

## 4. Flip the switch

In `assets/js/config.js`:

```js
USE_SUPABASE: true,
```

Reload the site. The header, the gate, sign up, sign in and the dashboard all now run against the database. Nothing else changes.

If the console shows `Invalid API key`, swap `SUPABASE_KEY` for `CONFIG.SUPABASE_ANON_JWT` on the line below it. Older builds of supabase-js do not recognise the newer publishable key format.

## 5. Make yourself an admin

Sign up on your own site with your real address and confirm the email. Then in Supabase → **Table Editor → profiles**, find your row and set `is_admin` to `true`.

Now `admin.html` works. That is your daily publishing screen: fill in the fields, paste each section, hit save. It writes through `upsert_report()`, which checks `is_admin` in the database, so the page being hidden is convenience and the actual permission is enforced server side.

## 6. Confirm the gate is real

This is the part worth testing properly, because it is the whole point.

1. Publish a report from `admin.html`.
2. Open it while signed in. Full text.
3. Open a private window, go to the same URL. You should see the standfirst, the key stats and 90 words, then the sign in card.
4. In that private window, open the console and run:

```js
await SB.rpc('get_report', { p_id: 'your-report-id' })
```

You should get `locked: true` and a `preview` field, with **no `body`**. That is the proof: someone calling the API directly with your public key still cannot read the report. If a `body` comes back, stop and re-check that `alter table public.reports enable row level security` ran and that you did not add a select policy.

---

## Tracking signups

Supabase → Authentication → Users shows the running total. For a daily chart, run this in the SQL editor:

```sql
select date_trunc('day', created_at)::date as day,
       count(*) as signups,
       sum(count(*)) over (order by date_trunc('day', created_at)) as running_total
  from auth.users
 group by 1
 order by 1 desc;
```

Deliberately not exposed as a view, because anything in the public schema is reachable through the API and `auth.users` should never be.

## What to do at scale

The free tier gives 50,000 monthly active users and 5 GB of egress. Auth is fine at that size; egress is the thing that bites first.

When you get busy, publish the archive listing as a static `reports.json` on your host instead of calling `list_reports()` on every page load. It is public metadata with no bodies in it, so it does not need the database, and moving it onto CDN bandwidth cuts Supabase traffic by roughly 80%. The gate keeps running through `get_report()`, which is the only call that actually needs to be there.
