/* ==========================================================================
   Leoside Equity: a single report
   --------------------------------------------------------------------------
   The page never decides how much of a report to show. It renders what
   Data.getReport() returns: a preview with locked true, or the full body.
   In Supabase mode that decision is made by get_report() in the database.
   ========================================================================== */

Boot.start('reports', function () {
  'use strict';

  const id = new URLSearchParams(location.search).get('id');
  const head = document.getElementById('articleHead');
  const body = document.getElementById('articleBody');
  const aside = document.getElementById('articleAside');

  if (!id) return notFound('No report was named in the link.');

  return Data.getReport(id).then(function (report) {
    if (!report) return notFound();
    render(report);
  }).catch(function (err) {
    console.error('[Leoside] report did not load:', err);
    notFound('The report did not load. Check your connection and try again.', true);
  });

  function setMeta(name, value, attr) {
    let el = document.querySelector('meta[' + (attr || 'name') + '="' + name + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr || 'name', name); document.head.appendChild(el); }
    el.setAttribute('content', value);
  }

  function notFound(message, retry) {
    document.title = 'Report not found · ' + SITE.name;
    setMeta('robots', 'noindex');
    head.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="reports.html">Reports</a></li><li aria-current="page">Not found</li></ol></nav>' +
      '<h1>' + (message ? 'Report unavailable' : (REPORTS.length ? 'Report not found' : 'Nothing published yet')) + '</h1>' +
      '<p class="lede">' + LS.esc(message || (REPORTS.length
        ? 'That link does not match any published report. It may have been renamed or withdrawn.'
        : 'Once reports start going out, every one of them will be readable here.')) + '</p>' +
      '<div class="row" style="margin-top:24px">' +
        (retry ? '<button class="btn" type="button" id="retryReport">Try again</button>' : '') +
        '<a class="btn' + (retry ? ' btn--ghost' : '') + '" href="reports.html">All reports</a></div>';
    body.innerHTML = '';
    aside.innerHTML = '';
    const r = document.getElementById('retryReport');
    if (r) r.addEventListener('click', function () { location.reload(); });
  }

  function stat(label, value) {
    return '<div class="keystat"><dt class="label">' + LS.esc(label) + '</dt><dd>' + LS.esc(value || 'Not stated') + '</dd></div>';
  }

  function render(report) {
    const user = Auth.current();
    const unlocked = !report.locked;
    const m = LS.market(report.market);
    const priced = LS.hasValuation(report.market);
    const url = SITE.url + '/report.html?id=' + encodeURIComponent(report.id);
    const author = report.author || (SITE.name + ' research desk');
    const updated = report.updatedAt && report.updatedAt.slice(0, 10) > report.date ? report.updatedAt.slice(0, 10) : null;

    /* --------------------------------------------------------- head tags */
    document.title = report.ticker + ': ' + report.title + ' · ' + SITE.name;
    setMeta('description', report.standfirst || '');
    setMeta('og:title', report.title, 'property');
    setMeta('og:description', report.standfirst || '', 'property');
    setMeta('og:url', url, 'property');
    setMeta('og:type', 'article', 'property');
    setMeta('twitter:title', report.title);
    setMeta('twitter:description', report.standfirst || '');
    let canon = document.querySelector('link[rel="canonical"]');
    if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
    canon.href = url;
    if (report.isPublished === false) setMeta('robots', 'noindex');

    const ld = document.createElement('script');
    ld.type = 'application/ld+json';
    ld.textContent = JSON.stringify([{
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: String(report.title).slice(0, 110),
      description: report.standfirst,
      datePublished: report.publishedAt || report.date,
      dateModified: report.updatedAt || report.publishedAt || report.date,
      author: report.author ? { '@type': 'Person', name: report.author } : { '@type': 'Organization', name: SITE.name, url: SITE.url },
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: { '@type': 'ImageObject', url: SITE.url + '/assets/img/icon-512.png' } },
      mainEntityOfPage: url,
      image: SITE.url + '/assets/img/og-image.png',
      articleSection: m.name,
      about: report.company,
      isAccessibleForFree: false,
      inLanguage: 'en'
    }, {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
        { '@type': 'ListItem', position: 2, name: 'Reports', item: SITE.url + '/reports.html' },
        { '@type': 'ListItem', position: 3, name: m.name, item: SITE.url + '/reports.html?region=' + m.code },
        { '@type': 'ListItem', position: 4, name: report.ticker, item: url }
      ]
    }]).replace(/</g, '\\u003c');
    document.head.appendChild(ld);

    /* -------------------------------------------------------------- head */
    head.innerHTML =
      '<nav class="crumbs" aria-label="Breadcrumb"><ol>' +
        '<li><a href="/">Home</a></li><li><a href="reports.html">Reports</a></li>' +
        '<li><a href="reports.html?region=' + m.code + '">' + LS.esc(m.name) + '</a></li>' +
        '<li aria-current="page">' + LS.esc(report.ticker) + '</li></ol></nav>' +
      (report.isPublished === false
        ? '<div class="notice notice--brass">' + LS.icon('info') + '<span>This report is a draft or is scheduled. Only admins can see it.</span></div>' : '') +
      (report.correction
        ? '<div class="notice notice--info" role="note">' + LS.icon('info') + '<span><strong>Correction' +
            (report.correctedAt ? ', ' + LS.fmtDate(report.correctedAt.slice(0, 10), 'medium') : '') + '.</strong> ' + LS.esc(report.correction) + '</span></div>' : '') +
      '<div class="article-tags">' + LS.marketTag(report.market) + (priced ? LS.ratingTag(report.rating) : '') +
        '<span class="tag tag--plain">' + LS.esc(report.sector || 'General') + '</span></div>' +
      '<h1>' + LS.esc(report.title) + '</h1>' +
      '<p class="lede">' + LS.esc(report.standfirst || '') + '</p>' +
      '<div class="byline">' +
        '<span>By <strong>' + LS.esc(author) + '</strong></span>' +
        '<span>' + LS.esc(report.company) + (report.exchange ? ', ' + LS.esc(report.exchange) : '') + ': <strong>' + LS.esc(report.ticker) + '</strong></span>' +
        '<span><time datetime="' + LS.esc(report.date) + '">' + LS.fmtDate(report.date) + '</time></span>' +
        (updated ? '<span class="updated">Updated <time datetime="' + updated + '">' + LS.fmtDate(updated, 'medium') + '</time></span>' : '') +
        '<span>' + (report.readMins || 1) + ' min read, ' + LS.wordCount(report).toLocaleString() + ' words</span>' +
        '<span class="byline__actions">' +
          (user ? '<button class="btn btn--ghost btn--sm" id="saveBtn" type="button"></button>' : '') +
          '<button class="btn btn--ghost btn--sm" type="button" data-copy-url data-copied="Link to this report copied.">' + LS.icon('link') + 'Copy link</button>' +
          (unlocked ? '<button class="btn btn--ghost btn--sm" type="button" data-print>' + LS.icon('print') + 'Print</button>' : '') +
        '</span>' +
      '</div>' +
      (priced
        ? '<dl class="keystats">' +
            stat('Valuation stance', report.rating) + stat('Fair value band', report.target) +
            stat('Last price at writing', report.last) + stat('Horizon', report.horizon) + stat('Market', m.name) +
          '</dl>'
        : '');

    /* -------------------------------------------------------------- body */
    const disclosure =
      '<section class="disclosure" aria-labelledby="discTitle">' +
        '<h2 id="discTitle">Disclosures</h2>' +
        '<p><strong>Who wrote this.</strong> ' + LS.esc(author) + ', ' + LS.esc(SITE.name) + '. Leoside Equity is an independent publisher and is not authorised or registered by SEBI, the SEC, FINRA, the FCA or any other regulator.</p>' +
        '<p><strong>Dates.</strong> Filed under ' + LS.fmtDate(report.date) + (report.publishedAt ? ', first published ' + new Date(report.publishedAt).toUTCString().replace(' GMT', ' UTC') : '') + '. Prices and figures are as of the time of writing and are not updated.</p>' +
        '<p><strong>Not advice.</strong> This is general commentary for education. It is not personal advice and not an offer or recommendation to buy or sell any security. ' +
          (priced
            ? 'A valuation stance compares the price with our own estimate of value on the date of writing: Undervalued does not mean buy and Overvalued does not mean sell. A fair value band is a model estimate, not a price forecast. '
            : 'Views on a market or a sector are opinions about many businesses at once, not predictions or signals to act. ') +
          'Figures come from public filings and sources we believe reliable but do not audit. You can lose all of the money you invest. Read the full <a class="link" href="disclaimer.html">research disclaimer</a>.</p>' +
        '<p class="print-only">' + LS.esc(url) + '</p>' +
      '</section>';

    if (unlocked) {
      body.innerHTML = '<div class="prose" id="prose">' +
        (report.body || []).map(function (section, i) {
          return (section.h ? '<h2 id="s' + (i + 1) + '">' + LS.esc(section.h) + '</h2>' : '') +
            (section.p || []).map(function (t) { return '<p>' + LS.esc(t) + '</p>'; }).join('');
        }).join('') +
      '</div>' + disclosure;
      Auth.recordRead(report.id);
    } else {
      const next = encodeURIComponent('report.html?id=' + report.id);
      const age = report.reason === 'age';
      body.innerHTML =
        '<div class="gate-wrap"><div class="prose"><p>' + LS.esc(report.preview || '') + '</p></div></div>' +
        '<section class="gate" aria-labelledby="gateTitle">' +
          (age
            ? '<h2 id="gateTitle">One question before you read</h2>' +
              '<p>Your account has not answered the age question yet. Answer it once and every report opens in full.</p>' +
              '<div class="gate__actions"><button class="btn btn--lg" type="button" id="gateAge">Answer now</button></div>'
            : '<h2 id="gateTitle">Sign in to read the rest</h2>' +
              '<p>The full report is free with an account, as is every other report in the archive.</p>' +
              '<div class="gate__actions">' +
                '<a class="btn btn--lg" href="signup.html?next=' + next + '">Create a free account</a>' +
                '<a class="btn btn--ghost btn--lg" href="signin.html?next=' + next + '">Sign in</a>' +
              '</div>' +
              '<p class="gate__facts">No payment details are asked for. You can delete the account, and everything attached to it, from your dashboard at any time.</p>') +
        '</section>' + disclosure;
      const ageBtn = document.getElementById('gateAge');
      if (ageBtn) ageBtn.addEventListener('click', function () { location.reload(); });
    }

    /* ------------------------------------------------------------- aside */
    const sameMarket = REPORTS.filter(function (r) { return LS.market(r.market).code === m.code && r.id !== report.id; }).slice(0, 4);
    const recent = REPORTS.filter(function (r) { return r.id !== report.id && sameMarket.indexOf(r) === -1; }).slice(0, 4);
    const sections = (report.body || []).map(function (s, i) { return s.h ? { id: 's' + (i + 1), h: s.h } : null; }).filter(Boolean);

    aside.innerHTML =
      (unlocked && sections.length
        ? '<nav class="aside-block" aria-labelledby="tocTitle"><h2 id="tocTitle">In this report</h2><div class="toc">' +
            sections.map(function (s) { return '<a href="#' + s.id + '">' + LS.esc(s.h) + '</a>'; }).join('') +
          '</div></nav>'
        : '') +
      (sameMarket.length
        ? '<section class="aside-block" aria-labelledby="moreTitle"><h2 id="moreTitle">More ' + LS.esc(m.name) + '</h2><ul>' + sameMarket.map(Cards.mini).join('') + '</ul></section>' : '') +
      (recent.length
        ? '<section class="aside-block" aria-labelledby="recentTitle"><h2 id="recentTitle">Recently published</h2><ul>' + recent.map(Cards.mini).join('') + '</ul></section>' : '') +
      '<section class="aside-block"><h2>About the research</h2><ul>' +
        '<li><a href="method.html">How a report is put together</a></li>' +
        '<li><a href="disclaimer.html">What a valuation stance means</a></li>' +
      '</ul></section>';

    /* ------------------------------------------------------ save button */
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
      const paint = function (on) {
        on = typeof on === 'boolean' ? on : Auth.isSaved(report.id);
        saveBtn.innerHTML = LS.icon(on ? 'bookmarkFill' : 'bookmark') + (on ? 'Saved' : 'Save');
        saveBtn.setAttribute('aria-pressed', String(on));
      };
      paint();
      saveBtn.addEventListener('click', function () {
        if (saveBtn.disabled) return;
        saveBtn.disabled = true;
        Auth.verifySession().then(function (u) {
          if (!u) {
            location.href = 'signin.html?next=' + encodeURIComponent('report.html?id=' + report.id);
            return;
          }
          return Auth.toggleSave(report.id).then(function (res) {
            saveBtn.disabled = false;
            paint(res.saved);
            if (!res.ok) LS.toast(res.error || 'Your saved list could not be updated.', 'err');
            else LS.toast(res.saved ? 'Saved to your dashboard.' : 'Removed from your saved reports.');
          });
        }).catch(function () {
          saveBtn.disabled = false;
          paint();
          LS.toast('Something went wrong. Please try again.', 'err');
        });
      });
    }

    /* ----------------------------------------------------- prev and next */
    const index = REPORTS.findIndex(function (r) { return r.id === report.id; });
    const newer = index > 0 ? REPORTS[index - 1] : null;
    const older = index !== -1 ? REPORTS[index + 1] : null;
    const nav = document.getElementById('prevNext');
    if (nav && (newer || older)) {
      nav.innerHTML = '<div class="prevnext">' +
        (older ? '<a href="' + LS.reportUrl(older.id) + '"><span class="label">Older report</span><span class="t">' + LS.esc(older.title) + '</span></a>' : '<span></span>') +
        (newer ? '<a class="n" href="' + LS.reportUrl(newer.id) + '"><span class="label">Newer report</span><span class="t">' + LS.esc(newer.title) + '</span></a>' : '') +
      '</div>';
    }
  }
});
