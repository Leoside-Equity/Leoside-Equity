/* ==========================================================================
   Leoside Equity: backend configuration
   --------------------------------------------------------------------------
   Both keys below are PUBLIC, client side keys. They are meant to be visible
   in the browser and are safe in this file and in a public git repository.
   They only work in combination with the row level security rules and the
   security definer functions in supabase/migrations/0001_leoside_init.sql.

   NEVER put the service_role key or the secret key in this file. Those bypass
   every rule in the database. They belong in server side code only.
   ========================================================================== */

const CONFIG = {

  /* Migration has been run and the auth URLs are configured, so the site now
     talks to Supabase. Set this back to false to work offline on localStorage. */
  USE_SUPABASE: true,

  SUPABASE_URL: 'https://karzpemgpmrlaaflghpk.supabase.co',

  /* Current style publishable key. If your supabase-js build rejects it with
     an "Invalid API key" error, swap in SUPABASE_ANON_JWT below instead. */
  SUPABASE_KEY: 'sb_publishable_A496gz-WGtCnxR4Ktsevpw_egDN_ogQ',

  /* Legacy anon key. Same permissions, older format, accepted everywhere. */
  SUPABASE_ANON_JWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImthcnpwZW1ncG1ybGFhZmxnaHBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5ODIwMDIsImV4cCI6MjEwMDU1ODAwMn0.GNpiFwu0gEs3NwSFPWy1bOv3y-8w4xP1ECWZ3OOADu4',

  /* Where Google should send people back to after sign in. Leave as is and it
     follows whatever origin the site is served from, local or live. */
  redirectTo: function () { return location.origin + '/dashboard.html'; },

  /* ------------------------------------------------------------- roles ---
     LIVE MODE reads the role from profiles.is_admin in the database. That is
     the only thing the database will actually honour, so the admin UI follows
     it exactly and you never see a button that then refuses to work.

     LOCAL MODE has no profiles table, so these addresses stand in for it.
     Useful for working on the admin screens without a backend. They grant
     nothing on a live site. To make yourself an admin for real, set is_admin
     to true on your row in the profiles table. */
  developerEmails: ['utkarshskailash@gmail.com'],

  /* The member dashboard (saved reports, reading history, archive by date) is
     a feature for every signed in reader, so it stays in the nav for all of
     them. Set this to true if you would rather it were staff only. The Admin
     item is always restricted regardless. */
  adminOnlyDashboard: false
};

/* One shared client for the whole site, created only when it is switched on. */
const SB = (function () {
  if (!CONFIG.USE_SUPABASE) return null;
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Leoside] supabase-js did not load. Check the CDN script tag in the page head.');
    return null;
  }
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
})();
