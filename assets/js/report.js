/* ==========================================================================
   Leoside Equity — single report page, including the sign in gate
   --------------------------------------------------------------------------
   The page never decides for itself how much of a report to show. It asks
   Data.getReport() and renders whatever comes back: a `preview` string with
   locked true, or a full `body` with locked false.

   In Supabase mode that decision is made by get_report() in the database,
   which reads auth.uid() from a signed token. Reading the JavaScript, calling
   the function directly, or editing localStorage gets a signed out visitor
   nothing but the preview.

   Note for anyone editing this file: do NOT reach for a bare `supabase`
   global or query `from('reports')` directly here. The client is `SB`, RLS
   blocks direct reads of that table by design, and the page markup is built
   by this script rather than sitting in report.html. Go through Data and Auth.
   ========================================================================== */

Boot.start('reports', function () {
  'use strict';

  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const head  = document.getElementById('articleHead');
  const body  = document.getElementById('articleBody');
  const aside = document.getElementById('articleAside');

  if (!id) return notFound('No report was named in the link.');

  return Data.getReport(id).then(function (report) {
    if (!report) return notFound();
    render(report);
  }).catch(function (err) {
    console.error('[Leoside] could not load report:', err);
    notFound('We could not load that report just now. Please refresh in a moment.');
  });

  /* ------------------------------------------------------------ not found */
  function notFound(message) {
    head.innerHTML = message
      ? '<h1>Report unavailable</h1><p class="lede">' + LS.esc(message) + '</p>' +
        '<a class="btn" href="reports.html">Back to all reports</a>'
      : (REPORTS.length
        ? '<h1>Report not found</h1><p class="lede">That link does not match any published report.</p>' +
          '<a class="btn" href="reports.html">Back to all reports</a>'
        : '<h1>Nothing published yet</h1>' +
          '<p class="lede">There are no reports yet. Once they start going out, every one of them will be readable here.</p>' +
          '<a class="btn" href="index.html">Back to the home page</a>');
  }

  /* --------------------------------------------------------------- render */
  function render(report) {
    const unlocked = !report.locked;

    document.title = report.ticker + ': ' + report.title + ' · ' + SITE.name;
    const metaTag = document.querySelector('meta[name="description"]');
    if (metaTag) metaTag.setAttribute('content', report.standfirst || '');

    /* -------------------------------------------------------------- head */
    head.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb">' +
        '<a href="index.html">Home</a><span>/</span>' +
        '<a href="reports.html">Reports</a><span>/</span>' +
        '<a href="reports.html?market=' + report.market + '">' + MARKETS[report.market].short + '</a><span>/</span>' +
        LS.esc(report.ticker) +
      '</nav>' +
      '<div class="row" style="gap:.5rem;margin-bottom:1.2rem">' +
        LS.marketTag(report.market) + LS.ratingTag(report.rating) +
        '<span class="tag tag--line">' + LS.esc(report.sector || 'Uncategorised') + '</span>' +
      '</div>' +
      '<h1>' + LS.esc(report.title) + '</h1>' +
      '<p class="lede">' + LS.esc(report.standfirst || '') + '</p>' +
      '<div class="article-meta">' +
        '<span>' + LS.esc(report.company) + ' · ' + LS.esc(report.exchange || '') +
          ': <strong>' + LS.esc(report.ticker) + '</strong></span>' +
        '<span class="sep">|</span><span>' + LS.fmtDate(report.date) + '</span>' +
        '<span class="sep">|</span><span>' + (report.readMins || 1) + ' min read</span>' +
        '<span class="sep">|</span><span>' + LS.wordCount(report) + ' words</span>' +
        /* Only a signed in reader has a saved list, so only they get the button. */
        (Auth.current()
          ? '<button class="btn btn--ghost btn--sm" id="saveBtn" type="button" style="margin-left:auto"></button>'
          : '') +
      '</div>' +
      '<div class="keystats">' +
        stat('Valuation stance', report.rating) +
        stat('Fair value band', report.target) +
        stat('Last close', report.last) +
        stat('Projected horizon', report.horizon) +
        stat('Market', MARKETS[report.market].short) +
      '</div>';

    /* -------------------------------------------------------------- body */
    const disclosure =
      '<div class="disclosure">' +
        '<b>Disclosure and disclaimer</b>' +
        'This report is general commentary produced for education and discussion. It is not personalised investment advice, ' +
        'not an offer or solicitation to buy or sell any security, and not a recommendation suited to your particular ' +
        'circumstances. A valuation stance describes how the current market price compares with our estimate of ' +
        'intrinsic value on the date of writing. It is an observation about price, not an instruction to transact: ' +
        'Undervalued does not mean buy, Overvalued does not mean sell, and neither says anything about whether a ' +
        'security is suitable for you. A fair value band is an estimate produced by a model, not a price forecast. ' +
        SITE.name + ' is not a registered investment adviser or research analyst. Figures are drawn from ' +
        'public filings and other sources believed to be reliable but are not guaranteed to be accurate or complete. ' +
        'A position may be held in any security mentioned, whether or not a disclosure appears here. ' +
        'Markets carry risk, including total loss of capital. ' +
        'Please read the full <a class="link" href="disclaimer.html">research disclaimer</a> before acting on anything here.' +
      '</div>';

    if (unlocked) {
      body.innerHTML = '<div class="prose" id="prose">' +
        (report.body || []).map(function (section, i) {
          return '<h2 id="s' + i + '">' + LS.esc(section.h) + '</h2>' +
            (section.p || []).map(function (t) { return '<p>' + LS.esc(t) + '</p>'; }).join('');
        }).join('') +
      '</div>' + disclosure;
      Auth.recordRead(report.id);
    } else {
      const next = encodeURIComponent('report.html?id=' + report.id);
      const opening = (report.body && report.body[0] && report.body[0].h) || 'Opening';
      body.innerHTML =
        '<div class="gate-wrap">' +
          '<div class="prose">' +
            '<h2>' + LS.esc(opening) + '</h2>' +
            '<p>' + LS.esc(report.preview || '') + '</p>' +
          '</div>' +
          '<div class="gate-fade"></div>' +
        '</div>' +
        '<div class="gate">' +
          '<div class="gate__icon">' + LS.icon('lock') + '</div>' +
          '<h3>Sign in to read the full report</h3>' +
          '<p>An account costs nothing and opens this report end to end, along with every other report.</p>' +
          '<div class="gate__actions">' +
            '<a class="btn btn--lg" href="signup.html?next=' + next + '">Create a free account</a>' +
            '<a class="btn btn--ghost btn--lg" href="signin.html?next=' + next + '">Sign in</a>' +
          '</div>' +
          '<div class="gate__perks">' +
            '<span>' + LS.icon('check') + 'No payment details</span>' +
            '<span>' + LS.icon('check') + 'Every report included</span>' +
            '<span>' + LS.icon('check') + 'Takes about thirty seconds</span>' +
          '</div>' +
        '</div>' + disclosure;
    }

    /* ------------------------------------------------------------- aside */
    const sameMarket = REPORTS.filter(function (r) {
      return r.market === report.market && r.id !== report.id;
    }).slice(0, 4);
    const alsoRead = REPORTS.filter(function (r) { return r.id !== report.id; }).slice(0, 4);

    aside.innerHTML =
      (unlocked && report.body
        ? '<div class="aside-card"><h4>In this report</h4><nav class="toc">' +
            report.body.map(function (s, i) { return '<a href="#s' + i + '">' + LS.esc(s.h) + '</a>'; }).join('') +
          '</nav></div>'
        : '<div class="aside-card"><h4>Free account</h4>' +
          '<p class="small muted" style="margin-bottom:1rem">Sign in to read the full report, keep a saved list, and get a dashboard organised by month and week.</p>' +
          '<a class="btn btn--sm btn--block" href="signup.html">Create an account</a></div>') +
      (sameMarket.length
        ? '<div class="aside-card"><h4>More ' + MARKETS[report.market].short + ' coverage</h4><ul>' +
            sameMarket.map(Cards.mini).join('') + '</ul></div>' : '') +
      (alsoRead.length
        ? '<div class="aside-card"><h4>Recently published</h4><ul>' +
            alsoRead.map(Cards.mini).join('') + '</ul></div>' : '') +
      '<div class="aside-card"><h4>Publishing calendar</h4>' +
        '<p class="small muted" style="margin:0">Indian market reports are written Sunday to Wednesday. ' +
        'United States market reports are written Thursday to Saturday. One report a day, seven days a week.</p></div>';

    /* ------------------------------------------------------ save button
       Absent for signed out visitors, so everything below is skipped. */
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) wireSave();

    function wireSave() {

    function paintSave(state) {
      const on = typeof state === 'boolean' ? state : Auth.isSaved(report.id);
      saveBtn.innerHTML = (on ? LS.icon('bookmarkFill') : LS.icon('bookmark')) + (on ? 'Saved ✓' : 'Save');
      saveBtn.setAttribute('aria-pressed', String(on));
      saveBtn.classList.toggle('is-saved', on);
    }
    paintSave();

    saveBtn.addEventListener('click', function () {
      if (saveBtn.disabled) return;
      saveBtn.disabled = true;

      try {
        /* Confirm with the server that the session is still real rather than
           trusting a cache that may have gone stale in another tab. */
        Auth.verifySession().then(function (user) {
          if (!user) {
            saveBtn.disabled = false;
            paintSave(false);
            window.alert('Please sign in to save reports');
            location.href = 'signin.html?next=' + encodeURIComponent('report.html?id=' + report.id);
            return;
          }

          saveBtn.innerHTML = LS.icon('bookmark') + 'Saving…';
          return Auth.toggleSave(report.id).then(function (res) {
            saveBtn.disabled = false;
            /* Paint from the state the cache actually reached, so a rejected
               write leaves the icon showing the truth rather than the wish. */
            paintSave(res.saved);
            if (!res.ok) {
              console.error('[Leoside] could not update saved reports:', res.error);
              window.alert('Could not update your saved list.\n\n' + res.error);
            }
          });
        }).catch(function (err) {
          saveBtn.disabled = false;
          paintSave();
          console.error('[Leoside] save button failed:', err);
          window.alert('Something went wrong updating your saved list. Please try again.');
        });
      } catch (err) {
        saveBtn.disabled = false;
        paintSave();
        console.error('[Leoside] save button threw:', err);
        window.alert('Something went wrong updating your saved list. Please try again.');
      }
    });

    }  /* end wireSave */

    /* -------------------------------------------------- prev and next */
    let index = -1;
    REPORTS.forEach(function (r, i) { if (r.id === report.id) index = i; });
    const newer = index > 0 ? REPORTS[index - 1] : null;
    const older = index !== -1 ? REPORTS[index + 1] : null;

    const nav = document.getElementById('prevNext');
    if (nav && (newer || older)) {
      nav.className = 'section';
      nav.style.paddingTop = '1rem';
      nav.innerHTML = '<div class="section-head"><div><p class="eyebrow eyebrow--plain">Keep reading</p>' +
        '<h2 style="font-size:1.5rem">Around this report</h2></div>' +
        '<a class="btn btn--ghost btn--sm" href="reports.html">All reports</a></div>' +
        '<div class="card-grid">' +
          (newer ? Cards.card(newer) : '') +
          (older ? Cards.card(older) : '') +
        '</div>';
    }

    /* ----------------------------------------------- reading progress */
    const bar = document.getElementById('readbar');
    if (bar) {
      const progress = function () {
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        bar.style.width = (max > 0 ? Math.min(100, (doc.scrollTop / max) * 100) : 0) + '%';
      };
      window.addEventListener('scroll', progress, { passive: true });
      window.addEventListener('resize', progress);
      progress();
    }
  }

  function stat(label, value) {
    return '<div class="keystat"><span class="l">' + label + '</span><span class="v">' +
      LS.esc(value || '—') + '</span></div>';
  }
});
