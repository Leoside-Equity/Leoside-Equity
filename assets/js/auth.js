/* ==========================================================================
   Leoside Equity — account layer
   --------------------------------------------------------------------------
   Two backends behind one interface, chosen by CONFIG.USE_SUPABASE.

     false  local mode. Accounts live in localStorage. No server. Good for
            working on the design, useless as security.
     true   Supabase mode. Real accounts, real sessions, and the report gate
            enforced in the database rather than in the browser.

   Everything the rest of the site calls is unchanged and still synchronous
   (current, saved, history and so on). That works because the session and the
   two small user lists are fetched once at boot and cached in memory. Wait for
   Auth.ready before reading any of them; Boot.start in store.js does that for
   you, so no page has to think about it.
   ========================================================================== */

const Auth = (function () {
  'use strict';

  const LIVE = !!(typeof CONFIG !== 'undefined' && CONFIG.USE_SUPABASE && typeof SB !== 'undefined' && SB);

  const K_USERS   = 'leoside.users';
  const K_SESSION = 'leoside.session';
  const K_SAVED   = 'leoside.saved';
  const K_HISTORY = 'leoside.history';

  /* In memory caches, filled during boot and kept in step after that. */
  let cachedUser    = null;
  let cachedSaved   = [];
  let cachedHistory = [];

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  /* Local mode only. Never reaches production; Supabase hashes properly. */
  function digest(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return 'd' + (h >>> 0).toString(36);
  }

  function normalise(email) { return String(email || '').trim().toLowerCase(); }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalise(email));
  }

  /* 0 to 4, drives the strength meter on the sign up form. */
  function passwordScore(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  /* Local mode stand in for profiles.is_admin. See CONFIG.developerEmails.
     Deliberately not consulted in live mode: there the database decides, and
     the UI has to agree with it or you get buttons that refuse to work. */
  function isDeveloperEmail(email) {
    const list = (typeof CONFIG !== 'undefined' && CONFIG.developerEmails) || [];
    const target = normalise(email);
    return list.some(function (e) { return String(e).trim().toLowerCase() === target; });
  }

  function initials(user) {
    if (!user) return '?';
    const source = (user.name || user.email || '').trim();
    const bits = source.split(/[\s.@_-]+/).filter(Boolean);
    if (!bits.length) return '?';
    return (bits[0][0] + (bits[1] ? bits[1][0] : '')).toUpperCase();
  }

  /* ======================================================================
     Local mode
     ====================================================================== */
  const Local = {
    users: function () { return read(K_USERS, {}); },

    shape: function (record) {
      if (!record) return null;
      return {
        id: record.email,
        email: record.email,
        name: record.name,
        market: record.market,
        digestOptIn: record.digestOptIn,
        joined: record.joined,
        isAdmin: isDeveloperEmail(record.email)
      };
    },

    boot: function () {
      const session = read(K_SESSION, null);
      cachedUser = session && session.email ? Local.shape(Local.users()[session.email]) : null;
      cachedSaved = cachedUser ? read(K_SAVED + ':' + cachedUser.email, []) : [];
      cachedHistory = cachedUser ? read(K_HISTORY + ':' + cachedUser.email, []) : [];
      return Promise.resolve();
    },

    signUp: function (d) {
      const email = normalise(d.email);
      const all = Local.users();
      if (all[email]) {
        return Promise.resolve({ ok: false, field: 'email', error: 'An account already exists for this address. Try signing in.' });
      }
      all[email] = {
        email: email, name: String(d.name).trim(), pw: digest(String(d.password)),
        market: d.market || 'both', digestOptIn: d.digestOptIn !== false,
        joined: new Date().toISOString()
      };
      write(K_USERS, all);
      write(K_SESSION, { email: email, since: Date.now() });
      cachedUser = Local.shape(all[email]);
      cachedSaved = []; cachedHistory = [];
      return Promise.resolve({ ok: true, user: cachedUser, needsConfirmation: false });
    },

    signIn: function (email, password) {
      const key = normalise(email);
      const record = Local.users()[key];
      if (!record || record.pw !== digest(String(password || ''))) {
        return Promise.resolve({ ok: false, field: 'password', error: 'We could not match that email and password.' });
      }
      write(K_SESSION, { email: key, since: Date.now() });
      cachedUser = Local.shape(record);
      cachedSaved = read(K_SAVED + ':' + key, []);
      cachedHistory = read(K_HISTORY + ':' + key, []);
      return Promise.resolve({ ok: true, user: cachedUser });
    },

    signOut: function () {
      try { localStorage.removeItem(K_SESSION); } catch (e) {}
      cachedUser = null; cachedSaved = []; cachedHistory = [];
      return Promise.resolve();
    },

    update: function (changes) {
      if (!cachedUser) return Promise.resolve({ ok: false });
      const all = Local.users();
      Object.assign(all[cachedUser.email], changes);
      write(K_USERS, all);
      cachedUser = Local.shape(all[cachedUser.email]);
      return Promise.resolve({ ok: true, user: cachedUser });
    },

    persistSaved: function () {
      if (cachedUser) write(K_SAVED + ':' + cachedUser.email, cachedSaved);
      return Promise.resolve({ ok: true });
    },
    persistHistory: function () {
      if (cachedUser) write(K_HISTORY + ':' + cachedUser.email, cachedHistory);
      return Promise.resolve({ ok: true });
    }
  };

  /* ======================================================================
     Supabase mode
     ====================================================================== */
  const Live = {
    shape: function (user, profile) {
      if (!user) return null;
      const meta = user.user_metadata || {};
      return {
        id: user.id,
        email: user.email,
        name: (profile && profile.name) || meta.name || meta.full_name || (user.email || '').split('@')[0],
        market: (profile && profile.market) || meta.market || 'both',
        digestOptIn: profile ? profile.digest_opt_in : meta.digest_opt_in !== false,
        joined: user.created_at,
        isAdmin: !!(profile && profile.is_admin)
      };
    },

    loadUser: function (user) {
      if (!user) { cachedUser = null; return Promise.resolve(); }
      return SB.from('profiles').select('*').eq('id', user.id).maybeSingle()
        .then(function (res) { cachedUser = Live.shape(user, res.data); })
        .catch(function () { cachedUser = Live.shape(user, null); });
    },

    /* Loaded independently on purpose. These used to share one Promise.all
       with a single catch, so a failure on either table wiped both caches.
       That is how a missing reading_history table ended up making saved
       reports look like they were never stored. */
    loadLists: function () {
      if (!cachedUser) { cachedSaved = []; cachedHistory = []; return Promise.resolve(); }

      /* Neither removed_at nor saved_at is guaranteed to exist yet, and a
         missing column fails the whole select, which would empty the saved
         list for no good reason. Step down through the variants until one
         answers. */
      const savedQ = Promise.resolve(
        SB.from('saved_reports').select('report_id')
          .is('removed_at', null).order('saved_at', { ascending: false })
      ).then(function (r) {
        if (!r.error) return r;
        return Promise.resolve(SB.from('saved_reports').select('report_id').is('removed_at', null));
      }).then(function (r) {
        if (!r.error) return r;
        return Promise.resolve(SB.from('saved_reports').select('report_id').order('saved_at', { ascending: false }));
      }).then(function (r) {
        if (!r.error) return r;
        return Promise.resolve(SB.from('saved_reports').select('report_id'));
      }).then(function (r) {
        if (r.error) throw r.error;
        cachedSaved = (r.data || []).map(function (x) { return x.report_id; });
      }).catch(function (e) {
        cachedSaved = [];
        console.warn('[Leoside] could not load saved reports:', (e && e.message) || e);
      });

      const historyQ = SB.from('reading_history')
        .select('report_id, read_at').order('read_at', { ascending: false }).limit(40)
        .then(function (r) {
          if (r.error) throw r.error;
          cachedHistory = (r.data || []).map(function (x) {
            return { id: x.report_id, at: new Date(x.read_at).getTime() };
          });
        })
        .catch(function (e) {
          cachedHistory = [];
          console.warn('[Leoside] could not load reading history:', (e && e.message) || e);
        });

      return Promise.all([savedQ, historyQ]);
    },

    boot: function () {
      return SB.auth.getSession()
        .then(function (res) {
          const session = res.data && res.data.session;
          return Live.loadUser(session ? session.user : null);
        })
        .then(Live.loadLists)
        .then(function () {
          /* Keep the cache honest if the session changes in another tab. */
          SB.auth.onAuthStateChange(function (event, session) {
            if (event === 'SIGNED_OUT') { cachedUser = null; cachedSaved = []; cachedHistory = []; }
          });
        });
    },

    signUp: function (d) {
      return SB.auth.signUp({
        email: normalise(d.email),
        password: String(d.password),
        options: {
          emailRedirectTo: CONFIG.redirectTo(),
          data: { name: String(d.name).trim(), market: d.market || 'both', digest_opt_in: d.digestOptIn !== false }
        }
      }).then(function (res) {
        if (res.error) {
          const msg = res.error.message || 'We could not create that account.';
          return { ok: false, field: /pass/i.test(msg) ? 'password' : 'email', error: msg };
        }
        /* With email confirmation on, there is no session until they click
           the link. Tell the caller so it can say so instead of redirecting. */
        if (!res.data.session) {
          return { ok: true, user: null, needsConfirmation: true };
        }
        return Live.loadUser(res.data.user).then(Live.loadLists).then(function () {
          return { ok: true, user: cachedUser, needsConfirmation: false };
        });
      });
    },

    signIn: function (email, password) {
      return SB.auth.signInWithPassword({ email: normalise(email), password: String(password || '') })
        .then(function (res) {
          if (res.error) {
            return { ok: false, field: 'password', error: 'We could not match that email and password.' };
          }
          return Live.loadUser(res.data.user).then(Live.loadLists).then(function () {
            return { ok: true, user: cachedUser };
          });
        });
    },

    signOut: function () {
      cachedUser = null; cachedSaved = []; cachedHistory = [];
      return SB.auth.signOut();
    },

    update: function (changes) {
      if (!cachedUser) return Promise.resolve({ ok: false });
      const row = {};
      if (changes.name !== undefined) row.name = changes.name;
      if (changes.market !== undefined) row.market = changes.market;
      if (changes.digestOptIn !== undefined) row.digest_opt_in = changes.digestOptIn;
      return SB.from('profiles').update(row).eq('id', cachedUser.id)
        .then(function (res) {
          if (res.error) return { ok: false, error: res.error.message };
          Object.assign(cachedUser, changes);
          return { ok: true, user: cachedUser };
        });
    },

    /* Resolves to { ok } or { ok: false, error }. Nothing is swallowed here
       any more: the caller needs to know so it can put the button back.

       onConflict is required, not optional. Without it supabase-js resolves an
       upsert against the table's PRIMARY KEY. This table is keyed on a
       separate id column with a UNIQUE constraint across (user_id, report_id),
       so a plain upsert looks like a fresh insert, reaches the unique index
       and fails with

         duplicate key value violates unique constraint
         saved_reports_user_id_report_id_key

       Naming the conflict target turns that into the merge it was meant to be.
       A 23505 slipping through anyway still means the row is present, which is
       the end state we wanted, so it counts as success rather than an error. */
    persistSaved: function (id, added) {
      if (!cachedUser) return Promise.resolve({ ok: false, error: 'You are not signed in.' });

      /* Removing a save stamps removed_at rather than deleting the row, so the
         metrics screen can still tell "nobody saved this" apart from "people
         saved it and then dropped it". Re-saving clears the stamp and reuses
         the same row, which is why nobody is ever counted twice.

         That column only exists once migration 0007 has been run, so both
         paths fall back to the older behaviour if it is not there yet. Saving
         a report is not something that should break waiting on a migration. */
      const noColumn = function (err) {
        return !!(err && /removed_at/i.test(err.message || ''));
      };

      const attempt = added
        ? Promise.resolve(SB.from('saved_reports').upsert(
            { user_id: cachedUser.id, report_id: id, removed_at: null },
            { onConflict: 'user_id,report_id' }
          )).then(function (res) {
            if (res && res.error && noColumn(res.error)) {
              return SB.from('saved_reports').upsert(
                { user_id: cachedUser.id, report_id: id },
                { onConflict: 'user_id,report_id' }
              );
            }
            return res;
          })
        : Promise.resolve(SB.from('saved_reports')
            .update({ removed_at: new Date().toISOString() })
            .eq('user_id', cachedUser.id).eq('report_id', id)
          ).then(function (res) {
            if (res && res.error && noColumn(res.error)) {
              return SB.from('saved_reports').delete()
                .eq('user_id', cachedUser.id).eq('report_id', id);
            }
            return res;
          });

      return Promise.resolve(attempt).then(function (res) {
        if (res && res.error) {
          /* The row already being there is the outcome we wanted anyway. */
          if (added && res.error.code === '23505') return { ok: true };
          return { ok: false, error: res.error.message };
        }
        return { ok: true };
      }).catch(function (e) {
        return { ok: false, error: (e && e.message) || 'Network error.' };
      });
    },

    /* Reading history is a nice to have. If the table is missing or the write
       fails, log it and carry on rather than breaking the page. */
    persistHistory: function (id) {
      if (!cachedUser) return Promise.resolve({ ok: false });
      return Promise.resolve(
        SB.from('reading_history').upsert(
          { user_id: cachedUser.id, report_id: id, read_at: new Date().toISOString() },
          { onConflict: 'user_id,report_id' }
        )
      ).then(function (res) {
        if (res && res.error && res.error.code === '23505') return { ok: true };
        if (res && res.error) {
          console.warn('[Leoside] could not record reading history:', res.error.message);
          return { ok: false, error: res.error.message };
        }
        return { ok: true };
      }).catch(function (e) {
        console.warn('[Leoside] could not record reading history:', (e && e.message) || e);
        return { ok: false };
      });
    }
  };

  const Backend = LIVE ? Live : Local;

  /* ======================================================================
     Public interface. Identical in both modes.
     ====================================================================== */

  const ready = Backend.boot().catch(function (err) {
    console.error('[Leoside] auth boot failed', err);
  });

  function current() { return cachedUser; }

  function signUp(details) {
    const name = String(details.name || '').trim();
    const pw = String(details.password || '');
    if (!name) return Promise.resolve({ ok: false, field: 'name', error: 'Please tell us what to call you.' });
    if (!validEmail(details.email)) return Promise.resolve({ ok: false, field: 'email', error: 'That does not look like a valid email address.' });
    if (pw.length < 8) return Promise.resolve({ ok: false, field: 'password', error: 'Use at least 8 characters.' });
    if (!details.agreed) return Promise.resolve({ ok: false, field: 'terms', error: 'Please accept the terms and the privacy policy.' });
    return Backend.signUp(details);
  }

  function signIn(email, password) { return Backend.signIn(email, password); }
  function signOut() { return Backend.signOut(); }
  function update(changes) { return Backend.update(changes); }

  /* Google is the only social provider on the site. */
  function signInWithGoogle() {
    if (!LIVE) {
      return Promise.resolve({ ok: false, error: 'Google sign in switches on once the backend is connected. Use the email form for now.' });
    }
    return SB.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: CONFIG.redirectTo() }
    }).then(function (res) {
      return res.error ? { ok: false, error: res.error.message } : { ok: true };
    });
  }

  /* Saved list and history read from cache, so callers stay synchronous. */
  function saved() { return cachedSaved.slice(); }
  function isSaved(id) { return cachedSaved.indexOf(id) !== -1; }

  /* Resolves to { ok, saved, error }. `saved` is the state the cache actually
     ended up in, so the caller can paint from it without guessing. The cache
     updates immediately for a responsive button and rolls back if the write
     fails, so the icon never claims something the database did not do. */
  function toggleSave(id) {
    const at = cachedSaved.indexOf(id);
    const added = at === -1;
    if (added) cachedSaved.unshift(id); else cachedSaved.splice(at, 1);

    const write = LIVE ? Live.persistSaved(id, added) : Local.persistSaved();

    return Promise.resolve(write).then(function (res) {
      if (res && res.ok === false) {
        const now = cachedSaved.indexOf(id);
        if (added && now !== -1) cachedSaved.splice(now, 1);
        else if (!added && now === -1) cachedSaved.unshift(id);
        return { ok: false, saved: cachedSaved.indexOf(id) !== -1, error: res.error };
      }
      return { ok: true, saved: added };
    });
  }

  /* Confirms with the server that the session is real, rather than trusting a
     cache that may have gone stale in another tab. Never throws: getUser()
     rejects outright when there is no session, which is a normal state here,
     not an error worth propagating. */
  function verifySession() {
    if (!LIVE) return Promise.resolve(cachedUser);
    return Promise.resolve(SB.auth.getUser())
      .then(function (res) {
        if (!res || res.error || !res.data || !res.data.user) { cachedUser = null; return null; }
        return cachedUser;
      })
      .catch(function () { return null; });
  }

  function history() { return cachedHistory.slice(); }

  function recordRead(id) {
    if (!cachedUser) return;
    cachedHistory = cachedHistory.filter(function (h) { return h.id !== id; });
    cachedHistory.unshift({ id: id, at: Date.now() });
    cachedHistory = cachedHistory.slice(0, 40);
    if (LIVE) Live.persistHistory(id); else Local.persistHistory();
  }

  /* Send a signed out visitor to sign in, remembering where they were. */
  function requireAuth() {
    if (cachedUser) return true;
    const next = location.pathname.split('/').pop() + location.search + location.hash;
    location.replace('signin.html?next=' + encodeURIComponent(next));
    return false;
  }

  return {
    ready: ready, live: LIVE,
    signUp: signUp, signIn: signIn, signInWithGoogle: signInWithGoogle,
    signOut: signOut, current: current, update: update,
    initials: initials, validEmail: validEmail, passwordScore: passwordScore,
    saved: saved, isSaved: isSaved, toggleSave: toggleSave, verifySession: verifySession,
    history: history, recordRead: recordRead, requireAuth: requireAuth
  };
})();
