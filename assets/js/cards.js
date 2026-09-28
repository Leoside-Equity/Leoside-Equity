/* ==========================================================================
   Leoside Equity: report templates shared between pages
   ========================================================================== */

const Cards = (function () {
  'use strict';

  function time(r, style) {
    return '<time datetime="' + LS.esc(r.date) + '">' + LS.fmtDate(r.date, style || 'medium') + '</time>';
  }

  /* One ruled row of a report index. The headline link is stretched over the
     whole row, so there is one link per report, not three. The date and the
     market on the left, what the report is about beside them. */
  function index(r) {
    return '<li class="index__row">' +
      '<div class="index__when"><time datetime="' + LS.esc(r.date) + '"><b>' + LS.fmtDate(r.date, 'short') + '</b> ' + LS.parseDate(r.date).getFullYear() + '</time>' +
        LS.marketTag(r.market) + '</div>' +
      '<div class="index__body"><h3><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) + '</a></h3>' +
        '<p>' + LS.esc(r.standfirst) + '</p></div>' +
      LS.icon('arrow').replace('<svg ', '<svg class="index__go" ') +
    '</li>';
  }

  /* A card in the home page's stack. The top strip (date, market, ticker)
     is the part that stays in view once the next card slides over it, so
     each card can still be told apart and clicked. One link per card, as in
     the index. */
  function card(r) {
    const m = LS.market(r.market);
    const co = String(r.company || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
    return '<li class="deck__item"><article class="dcard dcard--' + m.slug + '">' +
      '<div class="dcard__strip">' +
        '<time datetime="' + LS.esc(r.date) + '"><b>' + LS.fmtDate(r.date, 'short') + '</b> ' + LS.parseDate(r.date).getFullYear() + '</time>' +
        LS.marketTag(r.market) +
        '<span class="dcard__tk">' + LS.esc((r.exchange ? r.exchange + ': ' : '') + r.ticker) + '</span>' +
      '</div>' +
      '<div class="dcard__body">' +
        '<h3><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) + '</a></h3>' +
        '<p>' + LS.esc(r.standfirst) + '</p>' +
      '</div>' +
      '<div class="dcard__foot">' +
        '<span>' + (co ? '<b>' + LS.esc(co) + '</b>' : '') + '<span>' + (r.readMins || 1) + ' minute read</span></span>' +
        '<span class="dcard__go" aria-hidden="true">Read the report' + LS.icon('arrow') + '</span>' +
      '</div>' +
    '</article></li>';
  }

  /* A ruled list entry, used on the not found page. */
  function item(r) {
    return '<li><article class="ritem">' +
      '<div class="ritem__meta">' + LS.marketTag(r.market) + '<span class="tk">' + LS.esc(r.ticker) + '</span>' + time(r, 'short') + '</div>' +
      '<h3><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) + '</a></h3>' +
      '<p>' + LS.esc(r.standfirst) + '</p>' +
    '</article></li>';
  }

  /* An archive row. A div rather than a link because admins get buttons in
     it, and a button inside a link is invalid and swallows its own clicks. */
  function row(r) {
    const user = Auth.current();
    const isAdmin = !!(user && user.isAdmin);
    return '<article class="rrow" data-report="' + LS.esc(r.id) + '">' +
      '<div class="rrow__when"><b>' + LS.fmtDate(r.date, 'short') + '</b>' + LS.parseDate(r.date).getFullYear() + '</div>' +
      '<div>' +
        '<div class="row">' + LS.marketTag(r.market) +
          '<span class="rcard__ticker">' + LS.esc(r.ticker) + '</span>' +
          '<span class="muted small">' + LS.esc(r.company) + '</span>' +
        '</div>' +
        '<h3><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) + '</a></h3>' +
        '<p>' + LS.esc(r.standfirst) + '</p>' +
      '</div>' +
      '<div class="rrow__right">' + LS.ratingTag(r.rating) +
        (user ? '<span class="small muted">' + (r.readMins || 1) + ' min read</span>'
              : '<span class="rcard__lock">Sign in to read</span>') +
        (isAdmin ? adminControls(r) : '') +
      '</div>' +
    '</article>';
  }

  function adminControls(r) {
    return '<span class="rrow__admin">' +
      '<a class="btn btn--ghost btn--sm" href="admin.html?edit=' + encodeURIComponent(r.id) + '">Edit</a>' +
      '<button class="btn btn--danger btn--sm" type="button" data-delete="' + LS.esc(r.id) + '" data-title="' + LS.esc(r.title) + '">Delete</button>' +
    '</span>';
  }

  function mini(r) {
    return '<li><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) +
      '<span class="when">' + LS.fmtDate(r.date, 'short') + ' · ' + LS.esc(r.ticker) + '</span></a></li>';
  }

  return { index: index, card: card, item: item, row: row, mini: mini, adminControls: adminControls };
})();
