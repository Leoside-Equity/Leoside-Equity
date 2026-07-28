/* ==========================================================================
   Leoside Equity: shared report card and row templates
   ========================================================================== */

const Cards = (function () {
  'use strict';

  function lockFlag() {
    return Auth.current()
      ? ''
      : '<span class="rcard__lock">' + LS.icon('lock') + 'Preview</span>';
  }

  /* Grid card, used on the home page and the archive grid view. */
  function card(r) {
    return '<article class="rcard">' +
      '<div class="rcard__top">' +
        LS.marketTag(r.market) +
        '<span class="rcard__ticker">' + LS.esc(r.ticker) + '</span>' +
        '<span class="rcard__date tnum">' + LS.fmtDate(r.date, 'short') + '</span>' +
      '</div>' +
      '<h3><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) + '</a></h3>' +
      '<p class="rcard__excerpt">' + LS.esc(r.standfirst) + '</p>' +
      '<div class="rcard__foot">' +
        LS.ratingTag(r.rating) +
        '<span class="sep">·</span><span>' + LS.esc(r.sector) + '</span>' +
        lockFlag() +
      '</div>' +
    '</article>';
  }

  /* Wide row, used on the archive list view.

     This is a div rather than an anchor because admins get a delete button
     inside it, and a button nested in an anchor is invalid HTML that swallows
     its own clicks. The whole row still behaves like one link: the heading
     anchor carries a stretched ::after overlay, and the admin controls sit
     above it on the z axis. */
  function row(r) {
    const user = Auth.current();
    const isAdmin = !!(user && user.isAdmin);

    return '<div class="rrow" data-report="' + LS.esc(r.id) + '">' +
      '<div class="rrow__when"><b>' + LS.fmtDate(r.date, 'short') + '</b>' + LS.parseDate(r.date).getFullYear() + '</div>' +
      '<div>' +
        '<div class="row" style="gap:.5rem">' + LS.marketTag(r.market) +
          '<span class="rcard__ticker">' + LS.esc(r.ticker) + '</span>' +
          '<span class="muted small">' + LS.esc(r.company) + '</span>' +
        '</div>' +
        '<h3><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) + '</a></h3>' +
        '<p>' + LS.esc(r.standfirst) + '</p>' +
      '</div>' +
      '<div class="rrow__right">' + LS.ratingTag(r.rating) +
        (user
          ? '<span class="small muted">' + r.readMins + ' min read</span>'
          : '<span class="rcard__lock">' + LS.icon('lock') + 'Sign in to read</span>') +
        (isAdmin ? adminControls(r) : '') +
      '</div>' +
    '</div>';
  }

  /* Elevated controls. Rendered only for an admin, and backed by a row level
     security policy so the button cannot do anything for anyone else. */
  function adminControls(r) {
    return '<span class="rrow__admin">' +
      '<a class="btn btn--quiet btn--sm" href="admin.html?edit=' + encodeURIComponent(r.id) + '">Edit</a>' +
      '<button class="btn btn--danger btn--sm" type="button" data-delete="' + LS.esc(r.id) + '">Delete</button>' +
    '</span>';
  }

  /* Compact link used in sidebars. */
  function mini(r) {
    return '<li><a href="' + LS.reportUrl(r.id) + '">' + LS.esc(r.title) +
      '<span class="when">' + LS.fmtDate(r.date, 'short') + ' · ' + LS.esc(r.ticker) + '</span></a></li>';
  }

  return { card: card, row: row, mini: mini, adminControls: adminControls };
})();
