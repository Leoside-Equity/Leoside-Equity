/* ==========================================================================
   Leoside Equity: backend configuration
   --------------------------------------------------------------------------
   The URL and the key below are PUBLIC by design. Supabase's publishable key
   identifies the project and nothing more: what it can reach is decided by
   the row level security policies and security definer functions in
   supabase/migrations. It is safe in the browser and in a public repository.

   NEVER put the service_role key or any secret key in this file, or anywhere
   under this folder. Those bypass every rule in the database.
   ========================================================================== */

const CONFIG = {

  /* true talks to Supabase. false runs entirely on localStorage, for working
     on the design offline. */
  USE_SUPABASE: true,

  SUPABASE_URL: 'https://karzpemgpmrlaaflghpk.supabase.co',
  SUPABASE_KEY: 'sb_publishable_A496gz-WGtCnxR4Ktsevpw_egDN_ogQ',

  /* The canonical address of the live site. Used for canonical links, share
     links, structured data and the addresses in email templates. */
  SITE_URL: 'https://leosideequity.com',

  /* Where Google sign in and email confirmation return to. Follows whatever
     origin the page is served from, so it works locally and live. Supabase
     only honours addresses listed under Authentication > URL Configuration. */
  redirectTo: function () { return location.origin + '/dashboard.html'; },

  /* Every request to Supabase gives up after this long, so a stalled network
     turns into a clear error and a retry button instead of a spinner. */
  REQUEST_TIMEOUT_MS: 15000,

  /* Detailed error text (migration names, database messages) is shown only to
     admins. Readers get a plain sentence. Set true while developing. */
  DEBUG: false,

  /* Local mode only: these addresses count as admins because there is no
     profiles table. They grant nothing on the live site, where the database
     column profiles.is_admin is the only thing that matters. */
  developerEmails: [],

  adminOnlyDashboard: false
};

/* ------------------------------------------------------------------ session
   "Keep me signed in" decides where the session lives. Ticked, it is kept in
   localStorage and survives closing the browser. Unticked, it goes in
   sessionStorage and ends with the tab. The flag itself is the only thing
   written unconditionally. */
const SessionStore = (function () {
  const FLAG = 'leoside.remember';
  function remember() {
    try { return localStorage.getItem(FLAG) !== '0'; } catch (e) { return true; }
  }
  function setRemember(on) {
    try { localStorage.setItem(FLAG, on ? '1' : '0'); } catch (e) {}
  }
  function pick() {
    try { return remember() ? localStorage : sessionStorage; } catch (e) { return null; }
  }
  const storage = {
    getItem: function (k) {
      try { return sessionStorage.getItem(k) || localStorage.getItem(k); } catch (e) { return null; }
    },
    setItem: function (k, v) {
      const s = pick();
      if (!s) return;
      try {
        s.setItem(k, v);
        (s === localStorage ? sessionStorage : localStorage).removeItem(k);
      } catch (e) {}
    },
    removeItem: function (k) {
      try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) {}
    }
  };
  return { storage: storage, remember: remember, setRemember: setRemember };
})();

/* A fetch that aborts after CONFIG.REQUEST_TIMEOUT_MS. */
function timedFetch(input, init) {
  const ctrl = new AbortController();
  const timer = setTimeout(function () { ctrl.abort(); }, CONFIG.REQUEST_TIMEOUT_MS);
  const opts = Object.assign({}, init || {});
  if (opts.signal) {
    opts.signal.addEventListener('abort', function () { ctrl.abort(); });
  }
  opts.signal = ctrl.signal;
  return fetch(input, opts).finally(function () { clearTimeout(timer); });
}

/* One shared client for the whole site, created only when switched on. */
const SB = (function () {
  if (!CONFIG.USE_SUPABASE) return null;
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[Leoside] supabase-js did not load.');
    return null;
  }
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: SessionStore.storage
    },
    global: { fetch: timedFetch }
  });
})();
