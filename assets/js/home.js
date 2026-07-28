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
        '<div class="ticker-line"><span>Today\'s format</span><b>' + LS.esc(LS.coverage(m.code).label) + '</b></div>' +
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

  /* ------------------------------------------------------------ week map
     The ribbon and the cards below it are both built from SITE.schedule, so
     rewriting the week in data.js rewrites this whole section. Nothing here
     names a day or a market directly. */
  const todayIdx = new Date().getDay();

  /* The seven day ribbon. One column per day, carrying nothing but the day and
     a colour: the cards underneath say which colour is which country, so
     repeating it seven times only added noise. */
  const ribbon = document.getElementById('weekRibbon');
  if (ribbon) {
    ribbon.innerHTML = LS.DAYS_S.map(function (label, i) {
      const m = LS.market(SITE.schedule[i]);
      const today = i === todayIdx;
      return '<div class="weekribbon__day weekribbon__day--' + m.slug + (today ? ' weekribbon__day--today' : '') + '"' +
        ' title="' + LS.esc(LS.DAYS[i] + ' · ' + m.regionName) + '">' +
        '<span class="weekribbon__d">' + label + '</span>' +
      '</div>';
    }).join('');
  }

  /* One card per country, in the order the week meets them, not one per slot.
     Three cards rather than four is the honest shape: there are three markets,
     and India happening twice at the weekend is a detail of the calendar. Each
     card is a country, its days, and one line. Nothing else. */
  const cards = document.getElementById('weekCards');
  if (cards) {
    const order = Object.keys(REGIONS).sort(function (a, b) {
      return REGIONS[a].startDay - REGIONS[b].startDay;
    });
    const todayRegion = LS.market(SITE.schedule[todayIdx]).region;

    cards.innerHTML = order.map(function (code) {
      const r = REGIONS[code];
      return '<article class="cadence__card cadence__card--' + r.slug +
        (code === todayRegion ? ' cadence__card--today' : '') + '">' +
        '<p class="cadence__when">' + LS.esc(r.dayLabel) + '</p>' +
        '<h3 class="cadence__where">' + LS.esc(r.name) + '</h3>' +
        '<p class="cadence__meta">' + LS.esc(r.detail) + '</p>' +
      '</article>';
    }).join('');
  }
});
