/* ==========================================================================
   Leoside Equity: pages that are mostly text
   --------------------------------------------------------------------------
   About, method, the legal pages, accessibility, copyright and not found.
   The page key comes from <body data-page>. Anything marked data-email
   becomes a link to the contact address, so the address lives in one place
   (SITE.email in data.js).
   ========================================================================== */
Boot.start(document.body.getAttribute('data-page') || '', function () {
  'use strict';

  document.querySelectorAll('[data-email]').forEach(function (a) {
    a.href = LS.mailHref(a.getAttribute('data-email') || '');
    if (!a.textContent.trim() || a.hasAttribute('data-email-text')) a.textContent = SITE.email;
  });

  /* The publishing week on the about page, read from the schedule so it can
     never describe a week the site no longer runs. */
  const week = document.getElementById('aboutWeek');
  if (week) {
    week.innerHTML = '<table class="ruled stack"><thead><tr><th scope="col">Market</th><th scope="col">Days</th><th scope="col">Reports a week</th><th scope="col">Venues</th></tr></thead><tbody>' +
      REGION_ORDER.map(function (code) {
        const r = REGIONS[code];
        return '<tr><th scope="row" data-label="Market"><span class="tag tag--' + r.slug + '">' + LS.esc(r.name) + '</span></th>' +
          '<td data-label="Days">' + LS.esc(r.dayLabel) + '</td><td class="tnum" data-label="Reports a week">' + r.count + '</td>' +
          '<td data-label="Venues">' + LS.esc(r.venues) + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* Signed in readers are not offered an account they already have. */
  if (Auth.current()) {
    document.querySelectorAll('[data-guest-only]').forEach(function (el) { el.remove(); });
  }

  /* The not found page offers a search with the mistyped address filled in. */
  const nfSearch = document.getElementById('nfSearch');
  if (nfSearch) {
    nfSearch.addEventListener('click', function () { LS.openSearch(); });
    const path = location.pathname.replace(/\.html$/, '').split('/').filter(Boolean).pop() || '';
    const guess = decodeURIComponent(path).replace(/[-_]+/g, ' ').trim();
    const hint = document.getElementById('nfPath');
    if (hint) hint.textContent = location.pathname;
    if (guess) {
      const hits = REPORTS.filter(function (r) {
        return (r.title + ' ' + r.ticker + ' ' + r.company).toLowerCase().indexOf(guess.toLowerCase()) !== -1;
      }).slice(0, 5);
      const box = document.getElementById('nfHits');
      if (box && hits.length) {
        box.innerHTML = '<h2 class="label">Reports that might be what you wanted</h2><ul class="rlist">' + hits.map(Cards.item).join('') + '</ul>';
      }
    }
  }
});
