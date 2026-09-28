# Supabase setup and security checklist

Project: `https://karzpemgpmrlaaflghpk.supabase.co`. The publishable key in `assets/js/config.js` is public by design. The `service_role` key and the database password must never appear in any file in this folder.

## 1. Run the migrations (do this first)

In the Supabase dashboard, open SQL Editor, paste each file whole and run it. On an existing project, only step 1d is new.

1. a. `migrations/0001` to `0010`, in order (already done on the live project).
   b. `apply_now.sql` (covers 0011 to 0013).
   c. `fix_publish.sql`, then `scheduled_publishing.sql`.
   d. **`migrations/0014_security_privacy_and_backdating.sql`**. Required. It closes two live security holes:
      - Any signed in member can currently make themselves an admin from the browser console, because a column level `revoke` cannot override Supabase's table level `UPDATE` grant.
      - The `reports` table currently answers direct API reads, so anyone with the public key can fetch the full text of every report, including drafts, without an account.

   It also adds backdated publishing, the age and terms records, author and disclosure fields, rate limits, the error log and data export.

The last query in 0014 prints a row of checks. Every column should read `true`.

**Check it yourself afterwards.** In a private browser window on the site, open the console and run:

```js
await SB.from('reports').select('id, body').limit(1)             // must return an error or []
await SB.rpc('get_report', { p_id: 'an-existing-report-id' })     // locked: true, a preview, no body
```

Signed in as a normal member:

```js
await SB.from('profiles').update({ is_admin: true }).eq('id', (await SB.auth.getUser()).data.user.id)
// must fail with a permission error
```

## 2. Authentication settings

Authentication > Providers > Email:

- Confirm email: **on**.
- Minimum password length: **10** (the site asks for 10).
- Leaked password protection: **on** (checks new passwords against known breaches).
- Secure email change: **on**.

Authentication > Rate Limits: the defaults are sensible. Keep sign in, sign up and password reset limits low (for example 30 sign ups per hour per IP).

Authentication > Attack Protection: consider turning on CAPTCHA (hCaptcha or Cloudflare Turnstile) if sign up abuse appears. It needs a small front end change and a privacy policy update, because the CAPTCHA provider then receives visitor data.

Authentication > URL Configuration: Site URL `https://leosideequity.com`, redirect URLs `https://leosideequity.com/**` and `http://localhost:5173/**`.

Authentication > Email Templates: paste the files from `supabase/email-templates/` into Confirm signup, Reset password, Change email address and Magic link, with the subject line written at the top of each file. Each explains why it was sent and how to stop all email (delete the account). They are account messages, not marketing, so no newsletter style unsubscribe applies.

For more than a handful of sign ups a day, set up custom SMTP (Authentication > SMTP, for example Resend or Postmark). Supabase's built in sender is heavily rate limited. **If you do, name that provider in section 8 of `privacy.html`.**

## 3. Make yourself an admin

After 0014, members can no longer set this themselves. In Table Editor > profiles, set `is_admin` to `true` on your row, then sign out and in again.

## 4. Account and billing security

These are dashboard settings no code can change. Do them now:

- **Two factor authentication** on your Supabase account (Account > Security), on the hosting account (Netlify, Vercel or Cloudflare), on the domain registrar, and on the Google account that owns the OAuth client.
- **Spend cap** on (Organization > Billing). It is on by default on the Pro plan; leave it on so a traffic spike cannot run up a bill.
- **Network restrictions** (Project Settings > Database > Network Restrictions): allow direct database connections only from your own IP. The website never connects to the database directly, only through the API, so this blocks nothing the site needs.
- **SSL enforcement** for direct database connections (Project Settings > Database): on.
- **Security Advisor** (Advisors > Security): run it after 0014 and fix anything it lists.

## 5. Backups and a restore test

The free plan has no automatic backups. Pro keeps daily backups for seven days, with point in time recovery as an add on.

To take your own backup and prove it restores (needs the database password from Project Settings > Database, which must never be committed):

```bash
npx supabase db dump --db-url "$DATABASE_URL" -f backup-schema.sql
npx supabase db dump --db-url "$DATABASE_URL" -f backup-data.sql --data-only
```

Restore test: create a second, empty Supabase project, run both files against its connection string with `psql`, then point a local copy of `config.js` at it and confirm reports open. Do this once now and again every few months.

## 6. Uptime monitoring

Add free monitors in UptimeRobot or Better Stack for:

- `https://leosideequity.com/`, expecting status 200 and the text "Leoside Equity".
- `https://karzpemgpmrlaaflghpk.supabase.co/rest/v1/rpc/list_reports` as a POST with header `apikey: <publishable key>` and body `{}`, expecting 200.

Errors readers hit in their browsers appear under Dashboard > Error log for admins. They are kept for 30 days.

## 7. Performance at scale

- Connection pooling is built in: the API goes through Supabase's pooler, so there is nothing to configure for the website.
- Indexes for every query the site runs are created by 0014.
- The report list is cached in each browser for two minutes, so moving between pages does not refetch it.
- Past a few thousand reports, move `list_reports()` to a static `reports.json` written by the build, so the archive is served from the CDN.
