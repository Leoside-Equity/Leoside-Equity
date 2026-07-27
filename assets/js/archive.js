/* ==========================================================================
   Leoside Equity — archive page: search, filter, sort, group by month
   ========================================================================== */
Boot.start('reports', function () {
  'use strict';

  const params  = new URLSearchParams(location.search);
  const qEl     = document.getElementById('q');
  const sectorEl = document.getElementById('sector');
  const ratingEl = document.getElementById('rating');
  const sortEl  = document.getElementById('sort');
  const countEl = document.getElementById('count');
  const outEl   = document.getElementById('results');
  const segBtns = Array.prototype.slice.call(document.querySelectorAll('.seg [data-market]'));

  const state = {
    q: params.get('q') || '',
    market: params.get('market') || 'all',
    sector: params.get('sector') || 'all',
    rating: 'all',
    sort: 'new'
  };

  /* Sector list is derived from the data so new reports need no config. */
  const sectors = Array.from(new Set(REPORTS.map(function (r) { return r.sector; }))).sort();
  sectorEl.innerHTML = '<option value="all">All sectors</option>' +
    sectors.map(function (s) { return '<option value="' + LS.esc(s) + '">' + LS.esc(s) + '</option>'; }).join('');

  qEl.value = state.q;
  sectorEl.value = state.sector;
  syncSeg();

  function syncSeg() {
    segBtns.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.market === state.market));
    });
  }

  function matches(r) {
    if (state.market !== 'all' && r.market !== state.market) return false;
    if (state.sector !== 'all' && r.sector !== state.sector) return false;
    if (state.rating !== 'all' && r.rating !== state.rating) return false;
    if (state.q) {
      const hay = (r.title + ' ' + r.company + ' ' + r.ticker + ' ' + r.sector + ' ' + r.standfirst).toLowerCase();
      if (hay.indexOf(state.q.toLowerCase().trim()) === -1) return false;
    }
    return true;
  }

  /* Returning 0 for equal dates matters. A comparator that answers "a first"
     both ways round is inconsistent, and the sort is then free to shuffle
     reports that share a date. Answering 0 keeps them in the order the
     database sent, which is newest written first within the day. */
  function sorted(list) {
    const copy = list.slice();
    if (state.sort === 'old') {
      copy.sort(function (a, b) { return a.date === b.date ? 0 : (a.date < b.date ? -1 : 1); });
    } else if (state.sort === 'az') {
      copy.sort(function (a, b) { return a.company.localeCompare(b.company); });
    } else {
      copy.sort(function (a, b) { return a.date === b.date ? 0 : (a.date < b.date ? 1 : -1); });
    }
    return copy;
  }

  function render() {
    const list = sorted(REPORTS.filter(matches));
    countEl.textContent = list.length + (list.length === 1 ? ' report' : ' reports');

    if (!REPORTS.length) {
      outEl.innerHTML = '<div class="empty"><h3>No reports yet</h3>' +
        '<p>Nothing has been published yet. Every report that goes out will be listed here, ' +
        'searchable by company, market, sector and valuation stance.</p>' +
        '<a class="btn btn--ghost btn--sm" href="index.html">Back to the home page</a></div>';
      return;
    }

    if (!list.length) {
      outEl.innerHTML = '<div class="empty"><h3>Nothing matches that yet</h3>' +
        '<p>Try a different company, or clear the filters to see everything.</p>' +
        '<button class="btn btn--ghost btn--sm" id="clearAll">Clear all filters</button></div>';
      document.getElementById('clearAll').addEventListener('click', function () {
        state.q = ''; state.market = 'all'; state.sector = 'all'; state.rating = 'all';
        qEl.value = ''; sectorEl.value = 'all'; ratingEl.value = 'all';
        syncSeg(); render();
      });
      return;
    }

    /* Group into month blocks when sorted by date, otherwise a flat list. */
    if (state.sort === 'az') {
      outEl.innerHTML = '<div class="rlist">' + list.map(Cards.row).join('') + '</div>';
      return;
    }

    const groups = [];
    let currentKey = null;
    list.forEach(function (r) {
      const key = r.date.slice(0, 7);
      if (key !== currentKey) { groups.push({ key: key, date: r.date, items: [] }); currentKey = key; }
      groups[groups.length - 1].items.push(r);
    });

    outEl.innerHTML = groups.map(function (g) {
      const inCount = g.items.filter(function (r) { return r.market === 'IN'; }).length;
      const usCount = g.items.length - inCount;
      return '<section style="margin-bottom:2.8rem">' +
        '<div class="section-head" style="margin-bottom:.4rem;align-items:center">' +
          '<h2 style="font-size:1.4rem">' + LS.fmtDate(g.date, 'monthYear') + '</h2>' +
          '<p class="small muted">' + inCount + ' India · ' + usCount + ' United States</p>' +
        '</div>' +
        '<div class="rlist">' + g.items.map(Cards.row).join('') + '</div>' +
      '</section>';
    }).join('');
  }

  /* --------------------------------------------------------------- events */
  let timer;
  qEl.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { state.q = qEl.value; render(); }, 140);
  });
  segBtns.forEach(function (b) {
    b.addEventListener('click', function () { state.market = b.dataset.market; syncSeg(); render(); });
  });
  sectorEl.addEventListener('change', function () { state.sector = sectorEl.value; render(); });
  ratingEl.addEventListener('change', function () { state.rating = ratingEl.value; render(); });
  sortEl.addEventListener('change', function () { state.sort = sortEl.value; render(); });

  render();

  /* ------------------------------------------------------- admin deleting
     Delegated, so it keeps working after every re-render. Two step: the first
     click arms the button, the second one within five seconds does it. That
     is deliberate. Deleting a report cannot be undone from here. */
  let armed = null;
  let armedTimer = null;

  function disarm() {
    if (armed) { armed.removeAttribute('data-armed'); armed.textContent = 'Delete'; }
    armed = null;
    clearTimeout(armedTimer);
  }

  outEl.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-delete]');
    if (!btn) { disarm(); return; }
    e.preventDefault();
    e.stopPropagation();

    const id = btn.getAttribute('data-delete');
    const user = Auth.current();
    if (!user || !user.isAdmin) return;

    if (armed !== btn) {
      disarm();
      armed = btn;
      btn.setAttribute('data-armed', 'true');
      btn.textContent = 'Confirm delete';
      armedTimer = setTimeout(disarm, 5000);
      return;
    }

    disarm();
    btn.disabled = true;
    btn.textContent = 'Deleting…';

    Data.deleteReport(id).then(function (res) {
      if (!res.ok) {
        btn.disabled = false;
        btn.textContent = 'Delete';
        window.alert('Could not delete that report.\n\n' + res.error);
        return;
      }
      render();
    });
  });

  /* The archive itself stays open to everyone. The reports inside it do not. */
  const gateNote = document.getElementById('archiveGateNote');
  if (gateNote && !Auth.current() && REPORTS.length) {
    gateNote.innerHTML = LS.icon('lock') +
      '<span>You can browse and search every report while signed out. ' +
      'Opening a report in full needs a free account. ' +
      '<a class="link" href="signup.html">Create one</a> or ' +
      '<a class="link" href="signin.html">sign in</a>.</span>';
    gateNote.hidden = false;
    gateNote.style.marginBottom = '1.6rem';
  }

  /* Only nudge signed out visitors toward an account. */
  const cta = document.getElementById('archiveCta');
  if (cta) {
    if (Auth.current()) {
      cta.parentNode.removeChild(cta);
    } else {
      cta.innerHTML = '<div class="wrap">' +
        '<p class="eyebrow eyebrow--plain" style="justify-content:center">Full access</p>' +
        '<h2>The reports are free, they just need an account</h2>' +
        '<p>Signed out you get the summary of each report. Sign in and every one of them opens in full.</p>' +
        '<div class="row"><a class="btn btn--lg" href="signup.html">Create a free account</a>' +
        '<a class="btn btn--on-ink btn--lg" href="signin.html">Sign in</a></div></div>';
    }
  }
});
