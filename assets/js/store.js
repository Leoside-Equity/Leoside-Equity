/* ==========================================================================
   Leoside Equity — report store and page boot
   --------------------------------------------------------------------------
   Data.load()      fills the REPORTS array. In local mode it is already full
                    from data.js; in Supabase mode it calls list_reports(),
                    which returns metadata only and never a report body.

   Data.getReport() fetches one report. In Supabase mode this is get_report(),
                    which returns { locked: true, preview } for a signed out
                    caller and { locked: false, body } for a signed in one.
                    The decision happens in the database, not here.

   Boot.start()     waits for the session and the data, mounts the chrome,
                    then runs the page. Every page script goes through it.
   ========================================================================== */

const Data = (function () {
  'use strict';

  const LIVE = !!(typeof CONFIG !== 'undefined' && CONFIG.USE_SUPABASE && typeof SB !== 'undefined' && SB);
  let loaded = null;

  /* Database columns are snake_case, the front end is camelCase. */
  function fromRow(row) {
    return {
      id: row.id,
      date: row.published_on,
      market: row.market,
      ticker: row.ticker,
      company: row.company,
      exchange: row.exchange,
      sector: row.sector,
      rating: row.rating,
      target: row.target,
      last: row.last_price,
      horizon: row.horizon,
      readMins: row.read_mins,
      title: row.title,
      standfirst: row.standfirst,
      wordCount: row.word_count,
      /* When it actually went live, as opposed to `date`, which is the date
         chosen for it. The database already orders by this; carrying it here
         keeps the ordering inspectable and available if a view wants it. */
      publishedAt: row.published_at || null
    };
  }

  function load() {
    if (loaded) return loaded;

    if (!LIVE) { loaded = Promise.resolve(REPORTS); return loaded; }

    loaded = SB.rpc('list_reports').then(function (res) {
      if (res.error) throw res.error;
      /* Replace the contents in place so REPORTS stays the same const array
         that every other file already holds a reference to. */
      REPORTS.length = 0;
      (res.data || []).forEach(function (row) { REPORTS.push(fromRow(row)); });
      return REPORTS;
    });
    return loaded;
  }

  /* Resolves to a report with either `body` or `preview`, plus `locked`. */
  function getReport(id) {
    if (!LIVE) {
      const r = REPORTS.find(function (x) { return x.id === id; });
      if (!r) return Promise.resolve(null);
      const unlocked = !!Auth.current();
      /* Work out the true length before the body is dropped, so a locked
         report can still say how long it is. Supabase sends word_count with
         the listing for exactly the same reason. */
      const copy = Object.assign({}, r, {
        locked: !unlocked,
        wordCount: LS.paragraphs(r).join(' ').split(/\s+/).filter(Boolean).length
      });
      if (!unlocked) { delete copy.body; copy.preview = LS.preview(r); }
      return Promise.resolve(copy);
    }

    return SB.rpc('get_report', { p_id: id }).then(function (res) {
      if (res.error) throw res.error;
      if (!res.data) return null;
      const out = fromRow(res.data);
      out.locked = !!res.data.locked;
      if (res.data.body) out.body = res.data.body;
      if (res.data.preview) out.preview = res.data.preview;
      return out;
    });
  }

  function forget(id) {
    let at = -1;
    REPORTS.forEach(function (r, i) { if (r.id === id) at = i; });
    if (at !== -1) REPORTS.splice(at, 1);
  }

  /* Admin only. Resolves to { ok, id } or { ok: false, error }.

     The `.select('id')` matters. Row level security filters rows rather than
     rejecting the statement, so a delete the caller is not allowed to make
     comes back with no error and zero rows touched. Asking for the deleted
     row back is the only way to tell "removed it" from "silently did
     nothing", and the second case almost always means this account is not an
     admin or migration 0002 has not been run. */
  function deleteReport(id) {
    if (!id) return Promise.resolve({ ok: false, error: 'No report id given.' });

    if (!LIVE) {
      forget(id);
      return Promise.resolve({ ok: true, id: id });
    }

    return SB.from('reports').delete().eq('id', id).select('id')
      .then(function (res) {
        if (res.error) return { ok: false, error: res.error.message };
        if (!res.data || !res.data.length) {
          return {
            ok: false,
            error: 'Nothing was deleted. Either this account is not an admin, or ' +
                   'supabase/migrations/0002_admin_delete.sql has not been run yet.'
          };
        }
        forget(id);
        return { ok: true, id: id };
      });
  }

  return { load: load, getReport: getReport, deleteReport: deleteReport, live: LIVE };
})();


const Boot = (function () {
  'use strict';

  function fail(err) {
    console.error('[Leoside] boot failed', err);
    const main = document.getElementById('main');
    if (!main) return;
    main.innerHTML =
      '<div class="wrap wrap--tight" style="padding:5rem 24px">' +
        '<div class="empty">' +
          '<h3>We could not load the research just now</h3>' +
          '<p>This is usually a connection problem. Please refresh in a moment.</p>' +
          '<a class="btn btn--ghost btn--sm" href="index.html">Back to the home page</a>' +
        '</div>' +
      '</div>';
  }

  /* Wait for the session, then the reports, then mount and run the page. */
  function start(pageKey, render) {
    return Auth.ready
      .then(function () { return Data.load(); })
      .then(function () {
        LS.init(pageKey);
        if (typeof render === 'function') return render();
      })
      .catch(function (err) {
        try { LS.init(pageKey); } catch (e) {}
        fail(err);
      });
  }

  return { start: start };
})();
