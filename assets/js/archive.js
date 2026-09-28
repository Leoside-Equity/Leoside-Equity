/* ==========================================================================
   Leoside Equity: the archive. Search, filters, sort, month groups, pages.
   The filters are mirrored into the address, so a filtered view can be
   bookmarked or shared.
   ========================================================================== */
Boot.start('reports', function () {
  'use strict';

  const PER_PAGE = 20;
  const params = new URLSearchParams(location.search);
  const qEl = document.getElementById('q');
  const sectorEl = document.getElementById('sector');
  const ratingEl = document.getElementById('rating');
  const sortEl = document.getElementById('sort');
  const countEl = document.getElementById('count');
  const outEl = document.getElementById('results');
  const segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg [data-region]'));

  function legacyRegion(code) {
    if (!code) return '';
    return REGIONS[code] ? code : LS.market(code).code;
  }

  const state = {
    q: params.get('q') || '',
    region: params.get('region') || legacyRegion(params.get('market')) || 'all',
    sector: params.get('sector') || 'all',
    rating: params.get('stance') || 'all',
    sort: params.get('sort') || 'new',
    page: Math.max(1, parseInt(params.get('page'), 10) || 1)
  };
  if (state.region !== 'all' && !REGIONS[state.region]) state.region = 'all';
  if (['new', 'old', 'az'].indexOf(state.sort) === -1) state.sort = 'new';

  const sectors = Array.from(new Set(REPORTS.map(function (r) { return r.sector; }).filter(Boolean))).sort();
  sectorEl.innerHTML = '<option value="all">All sectors</option>' +
    sectors.map(function (s) { return '<option value="' + LS.esc(s) + '">' + LS.esc(s) + '</option>'; }).join('');
  if (state.sector !== 'all' && sectors.indexOf(state.sector) === -1) state.sector = 'all';

  qEl.value = state.q;
  sectorEl.value = state.sector;
  ratingEl.value = state.rating;
  sortEl.value = state.sort;
  syncSeg();

  function syncSeg() {
    segBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.region === state.region)); });
  }

  function syncUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set('q', state.q);
    if (state.region !== 'all') p.set('region', state.region);
    if (state.sector !== 'all') p.set('sector', state.sector);
    if (state.rating !== 'all') p.set('stance', state.rating);
    if (state.sort !== 'new') p.set('sort', state.sort);
    if (state.page > 1) p.set('page', state.page);
    const q = p.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : ''));
  }

  function matches(r) {
    if (state.region !== 'all' && LS.market(r.market).code !== state.region) return false;
    if (state.sector !== 'all' && r.sector !== state.sector) return false;
    if (state.rating !== 'all' && r.rating !== state.rating) return false;
    if (state.q) {
      const hay = [r.title, r.company, r.ticker, r.sector, r.standfirst].join(' ').toLowerCase();
      const terms = state.q.toLowerCase().trim().split(/\s+/);
      for (let i = 0; i < terms.length; i++) if (hay.indexOf(terms[i]) === -1) return false;
    }
    return true;
  }

  /* Equal dates return 0, keeping the database's order within a day. */
  function sorted(list) {
    const copy = list.slice();
    if (state.sort === 'old') copy.sort(function (a, b) { return a.date === b.date ? 0 : (a.date < b.date ? -1 : 1); });
    else if (state.sort === 'az') copy.sort(function (a, b) { return String(a.company).localeCompare(String(b.company)); });
    else copy.sort(function (a, b) { return a.date === b.date ? 0 : (a.date < b.date ? 1 : -1); });
    return copy;
  }

  function render(scroll) {
    const list = sorted(REPORTS.filter(matches));
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
    countEl.textContent = list.length + (list.length === 1 ? ' report' : ' reports');
    syncUrl();

    if (!REPORTS.length) {
      outEl.innerHTML = '<div class="empty"><h2>No reports yet</h2>' +
        '<p>Nothing has been published yet. Every report will be listed here, searchable by company, market, sector and valuation stance.</p>' +
        '<a class="btn btn--ghost" href="method.html">How reports are written</a></div>';
      return;
    }
    if (!list.length) {
      outEl.innerHTML = '<div class="empty"><h2>Nothing matches</h2>' +
        '<p>Try a different company or ticker, or clear the filters to see everything.</p>' +
        '<button class="btn btn--ghost" type="button" id="clearAll">Clear all filters</button></div>';
      document.getElementById('clearAll').addEventListener('click', function () {
        state.q = ''; state.region = 'all'; state.sector = 'all'; state.rating = 'all'; state.page = 1;
        qEl.value = ''; sectorEl.value = 'all'; ratingEl.value = 'all';
        syncSeg(); render();
        qEl.focus();
      });
      return;
    }

    let html;
    if (state.sort === 'az') {
      html = '<div>' + slice.map(Cards.row).join('') + '</div>';
    } else {
      const groups = [];
      let key = null;
      slice.forEach(function (r) {
        const k = r.date.slice(0, 7);
        if (k !== key) { groups.push({ date: r.date, items: [] }); key = k; }
        groups[groups.length - 1].items.push(r);
      });
      html = groups.map(function (g) {
        const tally = {};
        g.items.forEach(function (r) { const c = LS.market(r.market).code; tally[c] = (tally[c] || 0) + 1; });
        const breakdown = REGION_ORDER.filter(function (c) { return tally[c]; })
          .map(function (c) { return tally[c] + ' ' + REGIONS[c].name; }).join(', ');
        return '<section class="month" aria-label="' + LS.fmtDate(g.date, 'monthYear') + '">' +
          '<div class="month__head"><h2>' + LS.fmtDate(g.date, 'monthYear') + '</h2><span class="label">' + LS.esc(breakdown) + '</span></div>' +
          g.items.map(Cards.row).join('') +
        '</section>';
      }).join('');
    }

    outEl.innerHTML = html + (pages > 1 ? pager(pages, list.length) : '');
    if (scroll) outEl.scrollIntoView({ block: 'start', behavior: LS.reducedMotion() ? 'auto' : 'smooth' });
  }

  function pager(pages, total) {
    const from = (state.page - 1) * PER_PAGE + 1;
    const to = Math.min(total, state.page * PER_PAGE);
    let buttons = '';
    for (let i = 1; i <= pages; i++) {
      if (pages > 9 && i !== 1 && i !== pages && Math.abs(i - state.page) > 2) {
        if (i === 2 || i === pages - 1) buttons += '<span class="muted" aria-hidden="true">…</span>';
        continue;
      }
      buttons += '<button type="button" data-page="' + i + '"' + (i === state.page ? ' aria-current="page"' : '') + ' aria-label="Page ' + i + '">' + i + '</button>';
    }
    return '<nav class="pager" aria-label="Pages">' +
      '<span class="label">' + from + ' to ' + to + ' of ' + total + '</span>' +
      '<div class="pager__pages">' +
        '<button type="button" data-page="' + (state.page - 1) + '"' + (state.page === 1 ? ' disabled' : '') + ' aria-label="Previous page">Prev</button>' +
        buttons +
        '<button type="button" data-page="' + (state.page + 1) + '"' + (state.page === pages ? ' disabled' : '') + ' aria-label="Next page">Next</button>' +
      '</div></nav>';
  }

  /* --------------------------------------------------------------- events */
  qEl.addEventListener('input', LS.debounce(function () { state.q = qEl.value; state.page = 1; render(); }, 160));
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () { state.region = b.dataset.region; state.page = 1; syncSeg(); render(); });
  });
  sectorEl.addEventListener('change', function () { state.sector = sectorEl.value; state.page = 1; render(); });
  ratingEl.addEventListener('change', function () { state.rating = ratingEl.value; state.page = 1; render(); });
  sortEl.addEventListener('change', function () { state.sort = sortEl.value; state.page = 1; render(); });

  outEl.addEventListener('click', function (e) {
    const pageBtn = e.target.closest('[data-page]');
    if (pageBtn && !pageBtn.disabled) {
      state.page = +pageBtn.getAttribute('data-page');
      render(true);
      return;
    }
    const del = e.target.closest('[data-delete]');
    if (!del) return;
    e.preventDefault();
    const user = Auth.current();
    if (!user || !user.isAdmin) return;
    const id = del.getAttribute('data-delete');
    LS.confirm({
      title: 'Delete this report?',
      body: '"' + del.getAttribute('data-title') + '" will be removed from the site for every reader, along with its saves and reading history. This cannot be undone.',
      confirm: 'Delete report', danger: true
    }).then(function (yes) {
      if (!yes) return;
      del.disabled = true;
      del.classList.add('is-busy');
      Data.deleteReport(id).then(function (res) {
        if (!res.ok) {
          del.disabled = false;
          del.classList.remove('is-busy');
          LS.toast('Could not delete that report. ' + res.error, 'err');
          return;
        }
        LS.toast('Report deleted.');
        render();
      });
    });
  });

  render();

  const gateNote = document.getElementById('archiveGateNote');
  if (gateNote && !Auth.current() && REPORTS.length) {
    gateNote.innerHTML = LS.icon('lock') + '<span>You can browse and search every report while signed out. Reading one in full needs a free account: ' +
      '<a class="link" href="signup.html">create one</a> or <a class="link" href="signin.html">sign in</a>.</span>';
    gateNote.hidden = false;
  }

  /* Signed in readers are not offered an account; the ink base that held
     the offer goes with it. */
  const band = document.getElementById('joinBand');
  if (band && Auth.current()) {
    const base = band.closest('.base');
    band.remove();
    if (base && !base.querySelector('section')) base.remove();
  }
});
