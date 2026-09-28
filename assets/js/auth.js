/* ==========================================================================
   Leoside Equity: accounts
   --------------------------------------------------------------------------
   Two backends behind one interface, chosen by CONFIG.USE_SUPABASE.

     false  local mode. Accounts in localStorage, for design work only.
     true   Supabase. Real accounts, and the report gate enforced in the
            database, not in the browser.

   Reads (current, saved, history) stay synchronous because the session and
   the two small lists are fetched once at boot and cached. Wait for
   Auth.ready first; Boot.start in store.js does that for every page.
   ========================================================================== */

const Auth = (function () {
  'use strict';

  const LIVE = !!(typeof CONFIG !== 'undefined' && CONFIG.USE_SUPABASE && typeof SB !== 'undefined' && SB);

  const K_USERS   = 'leoside.users';
  const K_SESSION = 'leoside.session';
  const K_SAVED   = 'leoside.saved';
  const K_HISTORY = 'leoside.history';

  const MIN_PASSWORD = 10;
  const MAX_NAME = 120;

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

  function normalise(email) { return String(email || '').trim().toLowerCase(); }

  function validEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normalise(email)) && normalise(email).length <= 254;
  }

  /* 0 to 4, for the strength meter. Length counts for more than variety. */
  function passwordScore(pw) {
    if (!pw) return 0;
    let s = 0;
    if (pw.length >= MIN_PASSWORD) s++;
    if (pw.length >= 14) s++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return Math.min(s, 4);
  }

  /* ------------------------------------------------------------ market set
     Stored canonically as a sorted comma separated string: 'IN,UK,US'. */
  const MARKET_CODES = ['IN', 'UK', 'US'];
  function normaliseMarkets(value) {
    if (Array.isArray(value)) value = value.join(',');
    const raw = String(value || '').trim();
    if (!raw || raw === 'both' || raw === 'all') return MARKET_CODES.join(',');
    const picked = MARKET_CODES.filter(function (code) {
      return raw.split(',').some(function (part) { return part.trim().toUpperCase() === code; });
    });
    return picked.length ? picked.join(',') : MARKET_CODES.join(',');
  }
  function marketList(value) { return normaliseMarkets(value).split(','); }

  /* ------------------------------------------------------------ age check
     The browser works out a band from the date of birth and only the band
     leaves the page. 'under' never reaches the server at all. */
  function ageFrom(y, m, d) {
    const now = new Date();
    let age = now.getFullYear() - y;
    const beforeBirthday = (now.getMonth() + 1 < m) || (now.getMonth() + 1 === m && now.getDate() < d);
    if (beforeBirthday) age--;
    return age;
  }
  function ageBand(birth) {
    if (!birth || !birth.y || !birth.m || !birth.d) return null;
    const probe = new Date(birth.y, birth.m - 1, birth.d);
    if (probe.getMonth() !== birth.m - 1 || probe.getDate() !== birth.d || probe > new Date()) return null;
    const age = ageFrom(birth.y, birth.m, birth.d);
    if (age < SITE.minAge) return 'under';
    if (age < SITE.adultAge) return '13-17';
    return '18+';
  }

  function initials(user) {
    if (!user) return '?';
    const bits = String(user.name || user.email || '').trim().split(/[\s.@_-]+/).filter(Boolean);
    if (!bits.length) return '?';
    return (bits[0][0] + (bits[1] ? bits[1][0] : '')).toUpperCase();
  }

  /* Error text for readers. Database detail is kept for admins and DEBUG. */
  function friendly(message, fallback) {
    const msg = String(message || '');
    if (/rate_limited|too many requests/i.test(msg)) return 'Too many requests. Please wait a minute and try again.';
    if (/failed to fetch|network|abort/i.test(msg)) return 'We could not reach the server. Check your connection and try again.';
    if ((cachedUser && cachedUser.isAdmin) || (typeof CONFIG !== 'undefined' && CONFIG.DEBUG)) return msg || fallback;
    return fallback;
  }

  /* ======================================================================
     Local mode. Passwords are hashed with PBKDF2 (SHA-256, 150,000 rounds,
     random salt) through the browser's WebCrypto API, so even the offline
     build never keeps anything reversible.
     ====================================================================== */
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function pbkdf2(password, saltHex) {
    const enc = new TextEncoder();
    const salt = new Uint8Array(saltHex.match(/../g).map(function (h) { return parseInt(h, 16); }));
    return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
      .then(function (key) {
        return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: 150000 }, key, 256);
      })
      .then(hex);
  }
  function newSalt() { return hex(crypto.getRandomValues(new Uint8Array(16))); }

  const Local = {
    users: function () { return read(K_USERS, {}); },

    shape: function (r) {
      if (!r) return null;
      return {
        id: r.email, email: r.email, name: r.name,
        market: normaliseMarkets(r.market), avatar: r.avatar || null,
        joined: r.joined, isAdmin: false,
        ageBand: r.ageBand || null, ageConfirmed: !!r.ageBand, termsVersion: r.termsVersion || null
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
      const salt = newSalt();
      return pbkdf2(String(d.password), salt).then(function (hash) {
        all[email] = {
          email: email, name: String(d.name).trim().slice(0, MAX_NAME), salt: salt, hash: hash,
          market: normaliseMarkets(d.market), joined: new Date().toISOString(),
          ageBand: d.ageBand, termsVersion: SITE.termsVersion
        };
        write(K_USERS, all);
        write(K_SESSION, { email: email, since: Date.now() });
        cachedUser = Local.shape(all[email]);
        cachedSaved = []; cachedHistory = [];
        return { ok: true, user: cachedUser, needsConfirmation: false };
      });
    },

    signIn: function (email, password) {
      const key = normalise(email);
      const record = Local.users()[key];
      const fail = { ok: false, field: 'password', error: 'We could not match that email and password.' };
      if (!record || !record.salt) return Promise.resolve(fail);
      return pbkdf2(String(password || ''), record.salt).then(function (hash) {
        if (hash !== record.hash) return fail;
        write(K_SESSION, { email: key, since: Date.now() });
        cachedUser = Local.shape(record);
        cachedSaved = read(K_SAVED + ':' + key, []);
        cachedHistory = read(K_HISTORY + ':' + key, []);
        return { ok: true, user: cachedUser };
      });
    },

    signOut: function () {
      try { localStorage.removeItem(K_SESSION); } catch (e) {}
      cachedUser = null; cachedSaved = []; cachedHistory = [];
      return Promise.resolve();
    },

    update: function (changes) {
      if (!cachedUser) return Promise.resolve({ ok: false });
      const all = Local.users();
      const patch = {};
      if (changes.name !== undefined) patch.name = String(changes.name).trim().slice(0, MAX_NAME);
      if (changes.market !== undefined) patch.market = normaliseMarkets(changes.market);
      if (changes.avatar !== undefined) patch.avatar = changes.avatar;
      Object.assign(all[cachedUser.email], patch);
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
        market: normaliseMarkets((profile && profile.market) || meta.market),
        avatar: (profile && profile.avatar) || null,
        joined: user.created_at,
        isAdmin: !!(profile && profile.is_admin),
        ageBand: (profile && profile.age_band) || null,
        /* Older projects without migration 0014 have no such column; treat
           those as confirmed so nobody is stuck behind a question the
           database cannot record. */
        ageConfirmed: !profile || !('age_confirmed_at' in profile) || !!profile.age_confirmed_at,
        termsVersion: (profile && profile.terms_version) || null
      };
    },

    loadUser: function (user) {
      if (!user) { cachedUser = null; return Promise.resolve(); }
      return Promise.resolve(SB.from('profiles').select('*').eq('id', user.id).maybeSingle())
        .then(function (res) { cachedUser = Live.shape(user, res && res.data); })
        .catch(function () { cachedUser = Live.shape(user, null); });
    },

    /* The two lists load independently, so a failure in one cannot empty the
       other. */
    loadLists: function () {
      if (!cachedUser) { cachedSaved = []; cachedHistory = []; return Promise.resolve(); }

      const savedQ = Promise.resolve(
        SB.from('saved_reports').select('report_id')
          .is('removed_at', null).order('saved_at', { ascending: false })
      ).then(function (r) {
        if (r.error) throw r.error;
        cachedSaved = (r.data || []).map(function (x) { return x.report_id; });
      }).catch(function (e) {
        cachedSaved = [];
        console.warn('[Leoside] saved reports did not load:', (e && e.message) || e);
      });

      const historyQ = Promise.resolve(
        SB.from('reading_history').select('report_id, read_at')
          .order('read_at', { ascending: false }).limit(40)
      ).then(function (r) {
        if (r.error) throw r.error;
        cachedHistory = (r.data || []).map(function (x) {
          return { id: x.report_id, at: new Date(x.read_at).getTime() };
        });
      }).catch(function (e) {
        cachedHistory = [];
        console.warn('[Leoside] reading history did not load:', (e && e.message) || e);
      });

      return Promise.all([savedQ, historyQ]);
    },

    boot: function () {
      return Promise.resolve(SB.auth.getSession())
        .then(function (res) {
          const session = res && res.data && res.data.session;
          return Live.loadUser(session ? session.user : null);
        })
        .then(Live.loadLists)
        .then(function () {
          SB.auth.onAuthStateChange(function (event) {
            if (event === 'SIGNED_OUT') { cachedUser = null; cachedSaved = []; cachedHistory = []; }
          });
        });
    },

    signUp: function (d) {
      const meta = {
        name: String(d.name).trim().slice(0, MAX_NAME),
        market: normaliseMarkets(d.market),
        age_band: d.ageBand,
        guardian_ok: d.ageBand === '13-17' ? 'true' : 'false',
        terms_version: SITE.termsVersion
      };
      if (d.utm) meta.utm = d.utm;

      return Promise.resolve(SB.auth.signUp({
        email: normalise(d.email),
        password: String(d.password),
        options: { emailRedirectTo: CONFIG.redirectTo(), data: meta }
      })).then(function (res) {
        if (res.error) {
          const msg = res.error.message || '';
          if (/password/i.test(msg)) return { ok: false, field: 'password', error: msg };
          if (/registered|exists/i.test(msg)) return { ok: false, field: 'email', error: 'An account already exists for this address. Try signing in.' };
          return { ok: false, field: 'email', error: friendly(msg, 'We could not create that account. Please try again.') };
        }
        if (!res.data.session) return { ok: true, user: null, needsConfirmation: true };
        return Live.loadUser(res.data.user).then(Live.loadLists).then(function () {
          return { ok: true, user: cachedUser, needsConfirmation: false };
        });
      });
    },

    signIn: function (email, password) {
      return Promise.resolve(SB.auth.signInWithPassword({ email: normalise(email), password: String(password || '') }))
        .then(function (res) {
          if (res.error) {
            const msg = res.error.message || '';
            if (/rate|too many/i.test(msg)) return { ok: false, field: 'password', error: 'Too many attempts. Please wait a few minutes and try again.' };
            if (/confirm/i.test(msg)) return { ok: false, field: 'email', error: 'Please confirm your email address first. The link is in the message we sent when you signed up.' };
            return { ok: false, field: 'password', error: 'We could not match that email and password.' };
          }
          return Live.loadUser(res.data.user).then(Live.loadLists).then(function () {
            return { ok: true, user: cachedUser };
          });
        });
    },

    signOut: function () {
      cachedUser = null; cachedSaved = []; cachedHistory = [];
      return Promise.resolve(SB.auth.signOut()).catch(function () {});
    },

    update: function (changes) {
      if (!cachedUser) return Promise.resolve({ ok: false, error: 'You are not signed in.' });
      const row = {};
      if (changes.name !== undefined) row.name = String(changes.name).trim().slice(0, MAX_NAME);
      if (changes.market !== undefined) row.market = normaliseMarkets(changes.market);
      if (changes.avatar !== undefined) row.avatar = changes.avatar;

      return Promise.resolve(SB.from('profiles').update(row).eq('id', cachedUser.id).select('id'))
        .then(function (res) {
          if (res.error) return { ok: false, error: friendly(res.error.message, 'We could not save that. Please try again.') };
          Object.assign(cachedUser, row);
          return { ok: true, user: cachedUser };
        })
        .catch(function (e) { return { ok: false, error: friendly(e && e.message, 'We could not save that. Please try again.') }; });
    },

    /* Asks for the affected rows back, because row level security filters
       rather than refuses: a write it blocks returns success having changed
       nothing, and only the empty result shows it. */
    persistSaved: function (id, added) {
      if (!cachedUser) return Promise.resolve({ ok: false, error: 'You are not signed in.' });
      const attempt = added
        ? SB.from('saved_reports').upsert(
            { user_id: cachedUser.id, report_id: id, removed_at: null },
            { onConflict: 'user_id,report_id' }).select('report_id')
        : SB.from('saved_reports').update({ removed_at: new Date().toISOString() })
            .eq('user_id', cachedUser.id).eq('report_id', id).select('report_id');

      return Promise.resolve(attempt).then(function (res) {
        if (res && res.error) {
          if (added && res.error.code === '23505') return { ok: true };
          return { ok: false, error: friendly(res.error.message, 'Your saved list could not be updated. Please try again.') };
        }
        if (res && Array.isArray(res.data) && res.data.length === 0) {
          return { ok: false, error: friendly('Row level security blocked the change (migration 0010).', 'Your saved list could not be updated. Please try again.') };
        }
        return { ok: true };
      }).catch(function (e) {
        return { ok: false, error: friendly(e && e.message, 'Your saved list could not be updated. Please try again.') };
      });
    },

    /* Reading history is a convenience; a failed write is logged, not shown. */
    persistHistory: function (id) {
      if (!cachedUser) return Promise.resolve({ ok: false });
      return Promise.resolve(
        SB.from('reading_history').upsert(
          { user_id: cachedUser.id, report_id: id, read_at: new Date().toISOString() },
          { onConflict: 'user_id,report_id' })
      ).then(function (res) {
        if (res && res.error && res.error.code !== '23505') {
          console.warn('[Leoside] reading history not recorded:', res.error.message);
        }
        return { ok: true };
      }).catch(function () { return { ok: false }; });
    }
  };

  const Backend = LIVE ? Live : Local;

  /* ======================================================================
     Public interface, identical in both modes
     ====================================================================== */
  const ready = Backend.boot().catch(function (err) {
    console.error('[Leoside] session did not load', err);
  });

  function current() { return cachedUser; }

  function signUp(details) {
    const name = String(details.name || '').trim();
    const pw = String(details.password || '');
    if (!name) return Promise.resolve({ ok: false, field: 'name', error: 'Please tell us what to call you.' });
    if (name.length > MAX_NAME) return Promise.resolve({ ok: false, field: 'name', error: 'That name is longer than ' + MAX_NAME + ' characters.' });
    if (!validEmail(details.email)) return Promise.resolve({ ok: false, field: 'email', error: 'That does not look like a valid email address.' });
    if (pw.length < MIN_PASSWORD) return Promise.resolve({ ok: false, field: 'password', error: 'Use at least ' + MIN_PASSWORD + ' characters.' });
    if (pw.length > 72) return Promise.resolve({ ok: false, field: 'password', error: 'Use 72 characters or fewer.' });
    if (details.ageBand !== '18+' && details.ageBand !== '13-17') {
      return Promise.resolve({ ok: false, field: 'dob', error: 'Enter your date of birth.' });
    }
    if (details.ageBand === '13-17' && !details.guardian) {
      return Promise.resolve({ ok: false, field: 'guardian', error: 'A parent or guardian needs to agree before you can create an account.' });
    }
    if (!details.agreed) return Promise.resolve({ ok: false, field: 'terms', error: 'Please accept the terms and the privacy policy.' });
    SessionStore.setRemember(true);
    return Backend.signUp(details);
  }

  function signIn(email, password, remember) {
    SessionStore.setRemember(remember !== false);
    return Backend.signIn(email, password);
  }
  function signOut() { return Backend.signOut(); }
  function update(changes) { return Backend.update(changes); }

  function signInWithGoogle() {
    if (!LIVE) return Promise.resolve({ ok: false, error: 'Google sign in needs the backend, which is off in this build.' });
    SessionStore.setRemember(true);
    return Promise.resolve(SB.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: CONFIG.redirectTo() } }))
      .then(function (res) { return res.error ? { ok: false, error: friendly(res.error.message, 'Google sign in did not start. Please try again.') } : { ok: true }; });
  }

  /* For members who arrived through Google or signed up before the check. */
  function confirmAgeAndTerms(band, guardian) {
    if (!cachedUser) return Promise.resolve({ ok: false, error: 'You are not signed in.' });
    if (!LIVE) {
      const all = Local.users();
      all[cachedUser.email].ageBand = band;
      all[cachedUser.email].termsVersion = SITE.termsVersion;
      write(K_USERS, all);
      cachedUser = Local.shape(all[cachedUser.email]);
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve(SB.rpc('confirm_age_and_terms', {
      p_band: band, p_guardian: !!guardian, p_terms_version: SITE.termsVersion
    })).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error.message, 'That could not be saved. Please try again.') };
      cachedUser.ageBand = band;
      cachedUser.ageConfirmed = true;
      cachedUser.termsVersion = SITE.termsVersion;
      return { ok: true };
    }).catch(function (e) { return { ok: false, error: friendly(e && e.message, 'That could not be saved. Please try again.') }; });
  }

  function saved() { return cachedSaved.slice(); }
  function isSaved(id) { return cachedSaved.indexOf(id) !== -1; }

  /* The cache moves first so the button responds at once, and moves back if
     the write fails, so the icon never claims something that did not happen. */
  let saving = false;
  function toggleSave(id) {
    if (saving) return Promise.resolve({ ok: false, saved: isSaved(id), error: 'Still saving the last change.' });
    saving = true;
    const at = cachedSaved.indexOf(id);
    const added = at === -1;
    if (added) cachedSaved.unshift(id); else cachedSaved.splice(at, 1);

    const write_ = LIVE ? Live.persistSaved(id, added) : Local.persistSaved();
    return Promise.resolve(write_).then(function (res) {
      saving = false;
      if (res && res.ok === false) {
        const now = cachedSaved.indexOf(id);
        if (added && now !== -1) cachedSaved.splice(now, 1);
        else if (!added && now === -1) cachedSaved.unshift(id);
        return { ok: false, saved: cachedSaved.indexOf(id) !== -1, error: res.error };
      }
      return { ok: true, saved: added };
    });
  }

  /* reset.html is where the link lands: it holds the recovery session and
     asks for the new password. */
  function sendPasswordReset(address) {
    const email = normalise(address || (cachedUser && cachedUser.email));
    if (!validEmail(email)) return Promise.resolve({ ok: false, error: 'That does not look like a valid email address.' });
    if (!LIVE) return Promise.resolve({ ok: false, error: 'Password resets need the backend, which is off in this build.' });
    return Promise.resolve(SB.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/reset.html' }))
      .then(function (res) {
        return res && res.error ? { ok: false, error: friendly(res.error.message, 'The reset email could not be sent. Please try again in a minute.') } : { ok: true };
      })
      .catch(function (e) { return { ok: false, error: friendly(e && e.message, 'The reset email could not be sent.') }; });
  }

  /* Deletes the account and everything attached to it: profile, photo, saved
     list, reading history and error reports, then the sign in itself. Goes
     through a database function that can only ever delete the caller. */
  function deleteAccount() {
    if (!cachedUser) return Promise.resolve({ ok: false, error: 'You are not signed in.' });
    if (!LIVE) {
      const all = Local.users();
      delete all[cachedUser.email];
      write(K_USERS, all);
      try {
        localStorage.removeItem(K_SAVED + ':' + cachedUser.email);
        localStorage.removeItem(K_HISTORY + ':' + cachedUser.email);
      } catch (e) {}
      return Local.signOut().then(function () { return { ok: true }; });
    }
    return Promise.resolve(SB.rpc('delete_own_account')).then(function (res) {
      if (res && res.error) return { ok: false, error: friendly(res.error.message, 'Your account could not be deleted. Please try again, or write to us and we will do it by hand.') };
      cachedUser = null; cachedSaved = []; cachedHistory = [];
      clearLocalTraces();
      return Promise.resolve(SB.auth.signOut()).then(function () { return { ok: true }; }, function () { return { ok: true }; });
    }).catch(function (e) {
      return { ok: false, error: friendly(e && e.message, 'Your account could not be deleted. Please try again.') };
    });
  }

  /* What this browser holds that belongs to an account, cleared on deletion. */
  function clearLocalTraces() {
    try {
      ['leoside.admin.autosave', 'leoside.utm', 'leoside.reports.cache'].forEach(function (k) {
        localStorage.removeItem(k); sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }

  /* Everything held about the member, as a JSON file they can keep. */
  function exportData() {
    if (!cachedUser) return Promise.resolve({ ok: false, error: 'You are not signed in.' });
    if (!LIVE) {
      const u = Local.users()[cachedUser.email] || {};
      const copy = Object.assign({}, u); delete copy.hash; delete copy.salt;
      return Promise.resolve({ ok: true, data: {
        exported_at: new Date().toISOString(), account: copy,
        saved_reports: cachedSaved, reading_history: cachedHistory
      } });
    }
    return Promise.resolve(SB.rpc('export_my_data')).then(function (res) {
      if (res.error) return { ok: false, error: friendly(res.error.message, 'The export could not be prepared. Please try again.') };
      return { ok: true, data: res.data };
    }).catch(function (e) { return { ok: false, error: friendly(e && e.message, 'The export could not be prepared.') }; });
  }

  /* Confirms with the server that the session is still valid. Never throws. */
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

  function requireAuth() {
    if (cachedUser) return true;
    const next = location.pathname.split('/').pop() + location.search + location.hash;
    location.replace('signin.html?next=' + encodeURIComponent(next));
    return false;
  }

  return {
    ready: ready, live: LIVE, MIN_PASSWORD: MIN_PASSWORD,
    signUp: signUp, signIn: signIn, signInWithGoogle: signInWithGoogle,
    signOut: signOut, current: current, update: update,
    confirmAgeAndTerms: confirmAgeAndTerms, ageBand: ageBand,
    initials: initials, validEmail: validEmail, passwordScore: passwordScore,
    MARKET_CODES: MARKET_CODES, normaliseMarkets: normaliseMarkets, marketList: marketList,
    saved: saved, isSaved: isSaved, toggleSave: toggleSave, verifySession: verifySession,
    sendPasswordReset: sendPasswordReset, deleteAccount: deleteAccount, exportData: exportData,
    history: history, recordRead: recordRead, requireAuth: requireAuth, friendly: friendly
  };
})();
