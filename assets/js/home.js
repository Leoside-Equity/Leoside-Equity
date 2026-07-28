/* ==========================================================================
   Leoside Equity — home page
   ========================================================================== */
Boot.start('index', function () {
  'use strict';

  const latest = REPORTS[0];
  const signedIn = !!Auth.current();

  /* ------------------------------------------------------- hero call to action */
  const cta = document.getElementById('heroCta');
  if (cta) {
    cta.innerHTML = latest
      ? '<a class="btn btn--lg" href="' + LS.reportUrl(latest.id) + '">Read the latest report</a>' +
        (signedIn
          ? '<a class="btn btn--on-ink btn--lg" href="reports.html">Browse all reports</a>'
          : '<a class="btn btn--on-ink btn--lg" href="signup.html">Create a free account</a>')
      : (signedIn
          ? '<a class="btn btn--lg" href="about.html">How this works</a>' +
            '<a class="btn btn--on-ink btn--lg" href="method.html">Our research method</a>'
          : '<a class="btn btn--lg" href="signup.html">Create a free account</a>' +
            '<a class="btn btn--on-ink btn--lg" href="about.html">How this works</a>');
  }

  const note = document.getElementById('heroNote');
  if (note) {
    note.innerHTML = signedIn
      ? LS.icon('check') + '<span>You are signed in. Every report opens in full.</span>'
      : LS.icon('lock') + '<span>Sign in to read the full report. It is free.</span>';
  }

  /* ------------------------------------------------------------ hero stats */
  const stats = document.getElementById('heroStats');
  if (stats) {
    /* Counted from the schedule rather than typed in, so the numbers cannot
       drift out of step with the week the site actually publishes. */
    const regions = {};
    for (let i = 0; i < 7; i++) regions[LS.market(SITE.schedule[i]).region] = true;

    const items = [];
    if (REPORTS.length) items.push([REPORTS.length, 'Reports published', true]);
    items.push([Object.keys(regions).length, 'Markets covered', true]);
    items.push([7, 'Reports a week', true]);
    items.push(['Free', 'Now and always', false]);
    stats.innerHTML = items.map(function (i) {
      return '<div class="hero__stat"><span class="n' + (i[2] ? ' tnum' : '') + '">' + i[0] + '</span>' +
        '<span class="l">' + i[1] + '</span></div>';
    }).join('');
  }

  /* --------------------------------------------------- today's report card */
  const feature = document.getElementById('heroFeature');
  if (feature) {
    if (latest) {
      /* Always "latest" rather than "today's". Some days carry two reports and
         some carry none, so the newest one is the honest thing to name. */
      feature.innerHTML =
        '<span class="kicker">Latest report</span>' +
        '<div class="row" style="gap:.5rem;margin-bottom:.9rem">' +
          LS.marketTag(latest.market) + LS.ratingTag(latest.rating) +
        '</div>' +
        '<h3><a href="' + LS.reportUrl(latest.id) + '">' + LS.esc(latest.title) + '</a></h3>' +
        '<p>' + LS.esc(latest.standfirst) + '</p>' +
        '<div class="ticker-line"><span>' + LS.esc(latest.company) + '</span><b>' + LS.esc(latest.ticker) + '</b></div>' +
        '<div class="ticker-line"><span>Fair value band</span><b>' + LS.esc(latest.target) + '</b></div>' +
        '<div class="ticker-line"><span>Published</span><b>' + LS.fmtDate(latest.date, 'short') + '</b></div>' +
        '<a class="btn btn--block" style="margin-top:1.1rem" href="' + LS.reportUrl(latest.id) + '">' +
          'Open the report ' + LS.icon('arrow') + '</a>';
    } else {
      const m = LS.market(LS.marketForToday());
      feature.innerHTML =
        '<span class="kicker">Coming soon</span>' +
        '<h3>The first report is on its way</h3>' +
        '<p>Nothing has been published yet. Create a free account now and every report will be open to you from day one.</p>' +
        '<div class="ticker-line"><span>Today covers</span><b>' + LS.esc(m.name) + '</b></div>' +
        '<div class="ticker-line"><span>Publishing</span><b>Seven days a week</b></div>' +
        '<div class="ticker-line"><span>Cost</span><b>Free</b></div>' +
        '<a class="btn btn--block" style="margin-top:1.1rem" href="' +
          (signedIn ? 'dashboard.html' : 'signup.html') + '">' +
          (signedIn ? 'Go to your dashboard ' : 'Create a free account ') + LS.icon('arrow') + '</a>';
    }
  }

  /* --------------------------------------------------------- recent grid */
  const sub = document.getElementById('latestSub');
  if (sub && !REPORTS.length) sub.textContent = 'Please sit tight, the first report is on its way.';

  const grid = document.getElementById('latestGrid');
  if (grid) {
    grid.innerHTML = REPORTS.length
      ? REPORTS.slice(0, 6).map(Cards.card).join('')
      : '';
    if (!REPORTS.length) {
      grid.outerHTML = '<div class="empty"><h3>No reports published yet</h3>' +
        '<p>Reports appear here from the first publishing day, newest first.</p>' +
        '<a class="btn btn--ghost btn--sm" href="reports.html">See all reports</a></div>';
    }
  }

  /* ------------------------------------------------------------ bottom cta
     Someone already signed in has nothing to do with a sign up button, so the
     buttons go and the message stays. */
  const ctaButtons = document.getElementById('ctaButtons');
  if (ctaButtons && signedIn) ctaButtons.remove();

  /* ---------------------------------------------------------------- week
     One card per country, in the order the week meets them. The cards stack
     as the page scrolls: each is sticky at a slightly lower offset than the
     one before, so the card above stays visible as a stub behind it.

     Everything is read from SITE.schedule and REGIONS, so rewriting the week
     in data.js rewrites this section. Nothing here names a day or a country.

     This is the one place on the site where the shape of a market's week is
     spelled out. Everywhere else a report is simply Indian, American or
     British, which leaves any given day free to be whatever it needs to be. */
  const todayIdx = new Date().getDay();
  const cards = document.getElementById('weekCards');

  if (cards) {
    const todayMarket = LS.market(SITE.schedule[todayIdx]).code;

    cards.innerHTML = REGION_ORDER.map(function (code, i) {
      const r = REGIONS[code];

      /* A market with one entry has already said its days in the eyebrow, so
         the row would only repeat them. A market with several, which is India
         and its two different weekend jobs, needs them called out. */
      const rows = r.days.length > 1
        ? '<dl class="weekcard__days">' + r.days.map(function (d) {
            return '<div><dt>' + LS.esc(d[0]) + '</dt><dd>' + LS.esc(d[1]) + '</dd></div>';
          }).join('') + '</dl>'
        : '<p class="weekcard__body">' + LS.esc(r.days[0][1]) + '</p>';

      return '<article class="weekcard weekcard--' + r.slug + '" style="--i:' + i + '">' +
        '<div class="weekcard__top">' +
          '<span class="weekcard__n">' + String(i + 1).padStart(2, '0') + '</span>' +
          (code === todayMarket ? '<span class="weekcard__today">Today</span>' : '') +
        '</div>' +
        '<p class="weekcard__when">' + LS.esc(r.dayLabel) + '</p>' +
        '<h3 class="weekcard__where">' + LS.esc(r.name) + '</h3>' +
        rows +
        '<p class="weekcard__foot"><strong>' + r.count +
          (r.count === 1 ? ' report' : ' reports') + ' a week</strong>' +
          '<span>' + LS.esc(r.venues) + '</span></p>' +
      '</article>';
    }).join('');
  }
});
