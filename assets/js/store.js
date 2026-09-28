/* ==========================================================================
   Leoside Equity: report store and page boot
   --------------------------------------------------------------------------
   Data.load()      fills REPORTS. In Supabase mode it calls list_reports(),
                    which returns metadata only, never a report body. The
                    result is kept in sessionStorage for two minutes, so
                    moving between pages does not refetch the whole archive.
   Data.getReport() one report. The database decides preview or full text.
   Data.logError()  sends an uncaught error to the first party error log.
   Boot.start()     waits for the session and the data, mounts the page
                    chrome, then runs the page's own script.
   ========================================================================== */

const Data = (function () {
  'use strict';

  const LIVE = !!(typeof CONFIG !== 'undefined' && CONFIG.USE_SUPABASE && typeof SB !== 'undefined' && SB);
  const CACHE_KEY = 'leoside.reports.cache';
  const CACHE_MS = 2 * 60 * 1000;
  let loaded = null;

  /* Report text is shown without dashes. A range such as "12 - 15%" or
     "$195 - $245" reads "12 to 15%", and a dash set between words becomes a
     comma, and "9-11%" reads "9 to 11%". Hyphenated words ("sell-off",
     "2025-26") are left alone, and
     the stored text is never changed. */
  function plain(s) {
    if (typeof s !== 'string') return s;
    return s
      .replace(/(\d[\d,.]*%?)\s*(?:\s-\s|\s*[\u2013\u2014]\s*)\s*(?=[$\u00A3\u20AC\u20B9]?\s?\d)/g, '$1 to ')
      .replace(/(\d)-(\d[\d.]*%)/g, '$1 to $2')
      .replace(/\s+[\u2013\u2014-]\s+/g, ', ')
      .replace(/\s*[\u2013\u2014]\s*/g, ', ');
  }

  function fromRow(row) {
    return {
      id: row.id,
      date: row.published_on,
      market: row.market,
      ticker: row.ticker,
      company: plain(row.company),
      exchange: row.exchange,
      sector: plain(row.sector),
      rating: row.rating,
      target: plain(row.target),
      last: plain(row.last_price),
      horizon: plain(row.horizon),
      readMins: row.read_mins,
      title: plain(row.title),
      standfirst: plain(row.standfirst),
      wordCount: row.word_count,
      publishedAt: row.published_at || null,
      updatedAt: row.updated_at || null,
      author: row.author || null,
      disclosure: plain(row.disclosure) || null,
      correction: plain(row.correction) || null,
      correctedAt: row.corrected_at || null
    };
  }

  function readCache() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const hit = JSON.parse(raw);
      if (!hit || Date.now() - hit.at > CACHE_MS || !Array.isArray(hit.rows)) return null;
      return hit.rows;
    } catch (e) { return null; }
  }
  function writeCache(rows) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), rows: rows })); } catch (e) {}
  }
  function clearCache() {
    try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
  }

  function fill(rows) {
    REPORTS.length = 0;
    rows.forEach(function (row) { REPORTS.push(fromRow(row)); });
    return REPORTS;
  }

  function load(force) {
    if (loaded && !force) return loaded;
    if (!LIVE) { loaded = Promise.resolve(REPORTS); return loaded; }

    /* Admins always see the database as it is, since they are the ones
       changing it. Everyone else can use a copy up to two minutes old. */
    const user = typeof Auth !== 'undefined' && Auth.current();
    const cached = !force && !(user && user.isAdmin) ? readCache() : null;
    if (cached) { loaded = Promise.resolve(fill(cached)); return loaded; }

    loaded = Promise.resolve(SB.rpc('list_reports')).then(function (res) {
      if (res.error) throw res.error;
      const rows = res.data || [];
      writeCache(rows);
      return fill(rows);
    });
    loaded.catch(function () { loaded = null; });
    return loaded;
  }

  /* Resolves to a report carrying either `body` or `preview`, plus `locked`
     and, when locked, `reason` ('signin' or 'age'). */
  function getReport(id) {
    if (!LIVE) {
      const r = REPORTS.find(function (x) { return x.id === id; });
      if (!r) return Promise.resolve(null);
      const user = Auth.current();
      const reason = !user ? 'signin' : (user.ageConfirmed ? '' : 'age');
      const copy = Object.assign({}, r, {
        locked: !!reason, reason: reason,
        wordCount: LS.paragraphs(r).join(' ').split(/\s+/).filter(Boolean).length
      });
      if (reason) { delete copy.body; copy.preview = LS.preview(r); }
      return Promise.resolve(copy);
    }

    return Promise.resolve(SB.rpc('get_report', { p_id: id })).then(function (res) {
      if (res.error) throw res.error;
      if (!res.data) return null;
      const out = fromRow(res.data);
      out.locked = !!res.data.locked;
      out.reason = res.data.reason || (out.locked ? 'signin' : '');
      out.isPublished = res.data.is_published !== false;
      if (res.data.body) out.body = res.data.body.map(function (s) { return { h: plain(s.h), p: (s.p || []).map(plain) }; });
      if (res.data.preview) out.preview = plain(res.data.preview);
      return out;
    });
  }

  function forget(id) {
    const at = REPORTS.findIndex(function (r) { return r.id === id; });
    if (at !== -1) REPORTS.splice(at, 1);
    clearCache();
  }

  /* Admin only. .select('id') tells "deleted" apart from "RLS quietly
     refused", which returns success with no rows. */
  function deleteReport(id) {
    if (!id) return Promise.resolve({ ok: false, error: 'No report id given.' });
    if (!LIVE) { forget(id); return Promise.resolve({ ok: true, id: id }); }
    return Promise.resolve(SB.from('reports').delete().eq('id', id).select('id')).then(function (res) {
      if (res.error) return { ok: false, error: res.error.message };
      if (!res.data || !res.data.length) {
        return { ok: false, error: 'Nothing was deleted. This account may not be an admin, or migration 0002 has not been run.' };
      }
      forget(id);
      return { ok: true, id: id };
    }).catch(function (e) { return { ok: false, error: (e && e.message) || 'Network error.' }; });
  }

  /* --------------------------------------------------------- error log
     At most five reports per page view, and never about itself. */
  let sent = 0;
  function browserFamily() {
    const ua = navigator.userAgent;
    const m = ua.match(/(Edg|OPR|Firefox|Chrome|Version)\/(\d+)/);
    const name = !m ? 'Other' : m[1] === 'Edg' ? 'Edge' : m[1] === 'OPR' ? 'Opera' : m[1] === 'Version' ? 'Safari' : m[1];
    return name + (m ? ' ' + m[2] : '');
  }
  function logError(info) {
    if (!LIVE || sent >= 5) return;
    sent++;
    try {
      Promise.resolve(SB.rpc('log_client_error', { p: {
        page: location.pathname,
        message: String(info.message || '').slice(0, 500),
        source: String(info.source || '').replace(location.origin, '').slice(0, 200),
        line: info.line || null,
        browser: browserFamily()
      } })).catch(function () {});
    } catch (e) {}
  }

  return { load: load, getReport: getReport, deleteReport: deleteReport, clearCache: clearCache, logError: logError, live: LIVE };
})();


const Boot = (function () {
  'use strict';

  function fail(err, pageKey, render) {
    console.error('[Leoside] page did not load', err);
    const main = document.getElementById('main');
    document.documentElement.classList.add('is-ready');
    if (!main) return;
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    main.innerHTML =
      '<div class="wrap wrap--narrow section">' +
        '<div class="empty" role="alert">' +
          '<h2>' + (offline ? 'You are offline' : 'The research did not load') + '</h2>' +
          '<p>' + (offline
            ? 'This page needs a connection. It will work again as soon as you are back online.'
            : 'The server did not answer in time. This is usually brief.') + '</p>' +
          '<div class="row" style="justify-content:center">' +
            '<button class="btn" type="button" id="bootRetry">Try again</button>' +
            '<a class="btn btn--ghost" href="/">Home page</a>' +
          '</div>' +
        '</div>' +
      '</div>';
    const retry = document.getElementById('bootRetry');
    if (retry) retry.addEventListener('click', function () {
      retry.classList.add('is-busy');
      Data.clearCache();
      location.reload();
    });
  }

  function start(pageKey, render) {
    return Auth.ready
      .then(function () { return Data.load(); })
      .then(function () {
        LS.init(pageKey);
        const out = typeof render === 'function' ? render() : null;
        return Promise.resolve(out).then(function () {
          document.documentElement.classList.add('is-ready');
          LS.afterRender();
        });
      })
      .catch(function (err) {
        try { LS.init(pageKey); } catch (e) {}
        Data.logError({ message: 'boot: ' + ((err && err.message) || err) });
        fail(err, pageKey, render);
      });
  }

  return { start: start };
})();
