/* ==========================================================================
   Leoside Equity: home page
   ========================================================================== */
Boot.start('index', function () {
  'use strict';

  const user = Auth.current();
  const esc = LS.esc;

  /* ------------------------------------------------------- market sessions
     Regular hours only, read in each exchange's own time zone through the
     browser's Intl support, so daylight saving is handled for us. Holidays
     and early closes are not known here, and the page says so. */
  function localParts(tz) {
    const parts = {};
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
    const hh = (+parts.hour) % 24, mm = +parts.minute;
    return { wd: parts.weekday, mins: hh * 60 + mm, text: String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') };
  }
  function toMins(hhmm) { const p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function session(ex) {
    const t = localParts(ex.tz);
    const weekend = t.wd === 'Sat' || t.wd === 'Sun';
    const from = toMins(ex.open), to = toMins(ex.close);
    const open = !weekend && t.mins >= from && t.mins < to;
    let state = open ? 'Open' : 'Closed';
    if (!open && !weekend && t.mins < from) state = 'Opens ' + ex.open;
    /* How far through today's session: 0 before the open, 1 after the close. */
    const done = weekend ? 0 : Math.max(0, Math.min(1, (t.mins - from) / (to - from)));
    return { time: t.text, open: open, state: state, done: done };
  }

  /* A strip that scrolls sideways on its own. It moves only when there is
     enough to fill it, stops for a pointer or keyboard focus, and carries a
     pause button (WCAG 2.2.2). The copies that make the loop seamless are
     hidden from screen readers and from the tab order. */
  function marquee(root, items, pxPerSecond, label) {
    const track = root.querySelector('.reel__track');
    const view = track.parentElement;
    const setClass = 'reel__set';
    track.innerHTML = '';
    const first = document.createElement('div');
    first.className = setClass;
    first.innerHTML = items.join('');
    track.appendChild(first);
    /* A short list is repeated inside the first run until it is wider than
       the screen, so the strip always fills and always moves. The repeats
       are for the eye only. */
    const once = first.getBoundingClientRect().width;
    if (once > 0 && once < view.clientWidth * 1.1) {
      const extra = Math.ceil((view.clientWidth * 1.1) / once) - 1;
      for (let k = 0; k < extra; k++) {
        const wrap = document.createElement('div');
        wrap.innerHTML = items.join('');
        Array.prototype.slice.call(wrap.children).forEach(function (el) {
          el.setAttribute('aria-hidden', 'true');
          if (el.tagName === 'A') el.setAttribute('tabindex', '-1');
          first.appendChild(el);
        });
      }
    }
    const lap = first.getBoundingClientRect().width;
    if (lap < view.clientWidth * 0.9) return;
    const copies = Math.max(2, Math.ceil((view.clientWidth * 2) / lap) + 1);
    for (let n = 1; n < copies; n++) {
      const c = first.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.querySelectorAll('a').forEach(function (a) { a.setAttribute('tabindex', '-1'); });
      track.appendChild(c);
    }
    track.style.setProperty('--lap', lap + 'px');
    track.style.setProperty('--lap-time', Math.max(20, Math.round(lap / pxPerSecond)) + 's');
    if (LS.reducedMotion()) return;
    root.classList.add('is-moving');
    const btn = root.querySelector('.reel__ctl');
    if (!btn) return;
    const paint = function () {
      const paused = root.classList.contains('is-paused');
      btn.innerHTML = LS.icon(paused ? 'play' : 'pause') + '<span>' + (paused ? 'Play' : 'Pause') + '</span>';
      btn.setAttribute('aria-label', (paused ? 'Resume ' : 'Pause ') + label);
      btn.setAttribute('aria-pressed', String(paused));
    };
    btn.hidden = false;
    btn.addEventListener('click', function () { root.classList.toggle('is-paused'); paint(); });
    paint();
  }

  /* "NIKE Inc. (Class B common stock)" reads as "NIKE Inc." in display type. */
  function shortName(name) {
    return String(name || '').replace(/\s*\([^)]*\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /* --------------------------------------------------------------- hero */
  const cta = document.getElementById('heroCta');
  function paintCta() {
    if (!cta) return;
    const latest = REPORTS[0];
    cta.innerHTML =
      (latest ? '<a class="btn btn--lg" href="' + LS.reportUrl(latest.id) + '">Read the latest report</a>'
              : '<a class="btn btn--lg" href="reports.html">Read the reports</a>') +
      (user ? '<a class="btn btn--ghost btn--lg" href="dashboard.html">Your dashboard</a>'
            : '<a class="btn btn--ghost btn--lg" href="signup.html">Create a free account</a>');
  }
  paintCta();

  const todayIso = LS.toISO(new Date());
  const todayMarket = LS.market(LS.marketForToday());

  /* What a day's report covers ("One company", "One sector" or "The whole
     market"), read from the market's focus in data.js. */
  function focusOf(d) {
    const f = LS.market(SITE.schedule[d.getDay()]).focus;
    return typeof f === 'string' ? f : (f && f[d.getDay()]) || '';
  }

  /* ------------------------------------------------------------ dateline
     Today's market beside the newest report, under the buttons. */
  const dlToday = document.getElementById('dlToday');
  if (dlToday) {
    const focus = focusOf(new Date());
    dlToday.innerHTML = LS.marketTag(todayMarket.code) + (focus ? '<small>' + esc(focus) + '</small>' : '');
  }
  const dlLatest = document.getElementById('dlLatest');
  function paintDateline() {
    if (!dlLatest) return;
    const latest = REPORTS[0];
    dlLatest.innerHTML = latest
      ? '<a href="' + LS.reportUrl(latest.id) + '">' + esc(shortName(latest.company) || latest.ticker) + '</a>' +
        '<small><time datetime="' + esc(latest.date) + '">' + LS.fmtDate(latest.date, 'medium') + '</time></small>'
      : '<span class="muted">The first is being written</span>';
  }
  paintDateline();
  /* -------------------------------------------------------------- clocks
     Pressing an exchange turns the globe to it. */
  let globe = null;
  const clocks = document.getElementById('clocks');
  function paintClocks() {
    if (!clocks) return;
    const buttons = clocks.querySelectorAll('.clock');
    REGION_ORDER.forEach(function (code, i) {
      const btn = buttons[i];
      if (!btn) return;
      const s = session(REGIONS[code].exchange);
      btn.querySelector('.clock__time').textContent = s.time;
      const state = btn.querySelector('.clock__state');
      state.textContent = s.state;
      state.classList.toggle('is-open', s.open);
    });
  }
  if (clocks) {
    const buttons = clocks.querySelectorAll('.clock');
    REGION_ORDER.forEach(function (code, i) {
      const btn = buttons[i];
      if (!btn) return;
      btn.classList.toggle('is-focus', code === todayMarket.code);
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.toggle('is-focus', b === btn); });
        if (globe) globe.turnTo(REGIONS[code].exchange.lon);
      });
    });
    paintClocks();
    setInterval(paintClocks, 30000);
  }

  const stage = document.getElementById('globeStage');
  if (stage && typeof Globe !== 'undefined') {
    globe = Globe.mount(stage, {
      focusLon: (REGIONS[todayMarket.code] || REGIONS.US).exchange.lon,
      focusLat: 24,
      markers: REGION_ORDER.map(function (code) {
        const ex = REGIONS[code].exchange;
        return {
          label: ex.short, lat: ex.lat, lon: ex.lon,
          isOpen: function () { return session(ex).open; },
          time: function () { return session(ex).time; }
        };
      })
    });
    const fb = document.getElementById('globeFallback');
    if (fb) fb.remove();
  }

  /* --------------------------------------------------------- lead story */

  /* The report's own summary, one sentence a point. A closing line that
     only points onwards ("Here is why...") is left out, since the book
     already leads to the report. */
  function points(text, max) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    const out = [];
    const re = /[.!?](?=\s+["'‘“(]?[A-Z0-9])/g;
    let start = 0, m;
    while ((m = re.exec(s))) { out.push(s.slice(start, m.index + 1).trim()); start = m.index + 1; }
    if (s.slice(start).trim()) out.push(s.slice(start).trim());
    return out.filter(function (p) { return p && !/^(here is|here's|this is why|below,? we|we explain|we show)\b/i.test(p); }).slice(0, max);
  }

  /* The figures that head the report page: for a company, the stance and
     the numbers behind it; for a market or sector report, what it covers. */
  function figures(r) {
    const m = LS.market(r.market);
    const list = LS.hasValuation(r.market)
      ? [['Stance', r.rating], ['Fair value band', r.target], ['Price at writing', r.last], ['Horizon', r.horizon]]
      : [['Market', m.name], ['Sector', r.sector], ['Exchanges', r.exchange || m.venues], ['Length', (r.readMins || 1) + ' minute read']];
    return list.filter(function (f) { return f[1]; });
  }

  function cover(r) {
    const m = LS.market(r.market);
    const figs = figures(r);
    const pts = points(r.standfirst, 3);
    const words = LS.wordCount(r);
    return '<a class="cover" href="' + LS.reportUrl(r.id) + '" tabindex="-1" aria-hidden="true">' +
      '<div class="book" id="book">' +
        '<span class="book__back"></span><span class="book__top"></span><span class="book__edge"></span>' +
        '<div class="book__page">' +
          '<div class="bp__head"><span>In brief</span><b>' + esc(r.ticker) + '</b></div>' +
          (figs.length ? '<dl class="bp__figs">' + figs.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' : '') +
          (pts.length ? '<ul class="bp__points">' + pts.map(function (p) { return '<li><span>' + esc(p) + '</span></li>'; }).join('') + '</ul>' : '') +
          '<p class="bp__foot">As at ' + LS.fmtDate(r.date, 'medium') + '. General commentary, not investment advice.</p>' +
        '</div>' +
        '<div class="book__lid">' +
          '<div class="book__face book__face--' + m.slug + '">' +
            '<span class="book__mast"><img src="/assets/img/logo-64.webp" alt="" width="32" height="32" decoding="async">Leoside Equity</span>' +
            '<span class="book__kind">' + esc(m.name) + '</span>' +
            '<span class="book__tk">' + esc(r.ticker) + '</span>' +
            '<span class="book__co">' + esc(shortName(r.company)) + '</span>' +
            '<span class="book__foot"><span>' + esc(r.exchange || m.venues) + '</span><span>' + LS.fmtDate(r.date, 'medium') + '</span></span>' +
          '</div>' +
          '<div class="book__inside">' +
            '<span class="book__mast"><img src="/assets/img/logo-64.webp" alt="" width="32" height="32" decoding="async">Leoside Equity</span>' +
            '<span class="bi__label">Research note</span>' +
            '<span class="bi__title">' + esc(r.title) + '</span>' +
            '<dl class="bi__meta">' +
              '<div><dt>Market</dt><dd>' + esc(m.name) + '</dd></div>' +
              (r.sector ? '<div><dt>Sector</dt><dd>' + esc(r.sector) + '</dd></div>' : '') +
              '<div><dt>Filed</dt><dd>' + LS.fmtDate(r.date, 'medium') + '</dd></div>' +
              '<div><dt>Length</dt><dd>' + (r.readMins || 1) + ' min' + (words ? ', ' + words.toLocaleString('en-GB') + ' words' : '') + '</dd></div>' +
            '</dl>' +
          '</div>' +
        '</div>' +
      '</div></a>';
  }


  const lead = document.getElementById('lead');
  function paintLead() {
    if (!lead) return;
    const latest = REPORTS[0];
    if (!latest) {
      lead.innerHTML =
        '<div class="empty empty--flat"><h3>The first report is being written</h3>' +
        '<p>Nothing has been published yet. When it is, the newest report appears here and in the archive, newest first.</p>' +
        '<a class="btn btn--ghost" href="reports.html">Open the archive</a></div>';
    } else {
      const priced = LS.hasValuation(latest.market);
      lead.innerHTML =
        '<div class="feature">' +
          '<article>' +
            '<div class="feature__meta">' + LS.marketTag(latest.market) +
              '<time datetime="' + esc(latest.date) + '">' + LS.fmtDate(latest.date) + '</time>' +
              (priced ? LS.ratingTag(latest.rating) : '') + '</div>' +
            '<h3><a href="' + LS.reportUrl(latest.id) + '">' + esc(latest.title) + '</a></h3>' +
            '<p class="feature__stand">' + esc(latest.standfirst) + '</p>' +
            '<ul class="feature__facts">' +
              '<li><b>' + esc(shortName(latest.company)) + '</b></li>' +
              '<li>' + esc((latest.exchange ? latest.exchange + ': ' : '') + latest.ticker) + '</li>' +
              '<li>' + (latest.readMins || 1) + ' minute read</li>' +
            '</ul>' +
            '<p class="feature__note">General commentary, not a recommendation to buy or sell.' +
              (priced ? ' A valuation stance describes the price on the date of writing.' : '') +
              ' <a class="link" href="disclaimer.html' + (priced ? '#ratings' : '') + '">Research disclaimer</a></p>' +
            /* The book is hidden from screen readers; its figures are not. */
            (figures(latest).length
              ? '<p class="sr-only">Key figures: ' + figures(latest).map(function (f) { return esc(f[0].toLowerCase() + ' ' + f[1]); }).join('; ') + '.</p>'
              : '') +
            '<div class="feature__actions">' +
              '<a class="btn btn--lg" href="' + LS.reportUrl(latest.id) + '">Read the report ' + LS.icon('arrow') + '</a>' +
            '</div>' +
          '</article>' +
          cover(latest) +
        '</div>';
    }
  }
  paintLead();
  /* ---------------------------------------------------------------- reel
     Every company covered, newest first, in display type. Until there are
     a few, it names the three exchange cities instead. */
  const reel = document.getElementById('reel');
  if (reel) {
    const seen = {};
    const companies = REPORTS.filter(function (r) {
      const key = String(r.ticker).toUpperCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    }).slice(0, 16);
    let items;
    if (companies.length >= 3) {
      items = companies.map(function (r) {
        return '<a class="reel__item reel__item--' + LS.market(r.market).slug + '" href="' + LS.reportUrl(r.id) + '">' +
          esc(shortName(r.company)) + '<span class="reel__tk">' + esc(r.ticker) + '</span></a>';
      });
    } else {
      reel.setAttribute('aria-label', 'The three exchanges covered');
      items = REGION_ORDER.map(function (code) {
        const r = REGIONS[code];
        return '<span class="reel__item reel__item--' + r.slug + '">' + esc(r.exchange.city) + '<span class="reel__tk">' + esc(r.exchange.short) + '</span></span>';
      });
    }
    marquee(reel, items, 42, 'the list of companies covered');
  }

  /* -------------------------------------------------------------- recent
     The four reports before the latest, as a stack of cards. Each card
     sticks a strip lower than the one before, so as the page scrolls the
     next card slides over it and leaves its date and market showing. */
  const recent = document.getElementById('recent');
  function paintRecent() {
    if (!recent) return;
    const more = REPORTS.slice(1, 5);
    recent.hidden = !more.length;
    recent.style.setProperty('--n', more.length);
    recent.innerHTML = more.map(Cards.card).join('');
    evenCards();
  }

  /* Every card is given the height of the tallest. With equal heights the
     margins in the stylesheet line up each card's lower limit, so at the end
     of the section the pile scrolls away in one piece, strips intact. */
  function evenCards() {
    if (!recent || recent.hidden) return;
    recent.style.removeProperty('--card-h');
    let tallest = 0;
    recent.querySelectorAll('.dcard').forEach(function (c) { tallest = Math.max(tallest, c.offsetHeight); });
    if (tallest) recent.style.setProperty('--card-h', tallest + 'px');
  }
  paintRecent();
  /* Heights change with the width of the list and with the fonts, so both
     set them again. Only a change of width counts, since evening the cards
     changes the list's own height. */
  if (recent && typeof ResizeObserver !== 'undefined') {
    let width = recent.clientWidth;
    new ResizeObserver(LS.debounce(function () {
      if (recent.clientWidth === width) return;
      width = recent.clientWidth;
      evenCards();
    }, 120)).observe(recent);
  } else {
    window.addEventListener('resize', LS.debounce(evenCards, 150));
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(evenCards);

  /* Keyboard focus on a card that the next one covers: scroll back until
     the card sits in its stuck place with the next one just below it. */
  if (recent) {
    recent.addEventListener('focusin', function (e) {
      const item = e.target.closest('.deck__item');
      const next = item && item.nextElementSibling;
      if (!next) return;
      requestAnimationFrame(function () {
        const a = item.getBoundingClientRect(), b = next.getBoundingClientRect();
        if (b.top >= a.bottom - 1) return;
        /* Where the card would sit if nothing stuck: the heights before it
           plus the space between them (a bottom margin and the negative top
           margin of the card after, which together make the gap). */
        let natural = 0;
        for (let el = recent.firstElementChild; el && el !== item; el = el.nextElementSibling) {
          natural += el.offsetHeight + parseFloat(getComputedStyle(el).marginBottom) +
            parseFloat(getComputedStyle(el.nextElementSibling).marginTop);
        }
        const stuckAt = parseFloat(getComputedStyle(item).top) || 0;
        const y = recent.getBoundingClientRect().top + window.scrollY + natural - stuckAt;
        window.scrollTo({ top: Math.max(0, y), behavior: 'auto' });
      });
    });
  }
  /* ---------------------------------------------------------------- week
     This week as a desk diary: each market over the days it owns, with its
     exchange hours; a line that fills as the week passes; and one column a
     day, carrying the report once it is filed. Built from SITE.schedule, so
     it can never disagree with it. */
  const weekEl = document.getElementById('week');
  let weekDays = [];
  function paintWeek() {
    if (!weekEl) return;
    const now = new Date();
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const days = [];
    for (let i = 0; i < 7; i++) days.push(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
    const byDate = {};
    REPORTS.forEach(function (r) { if (!byDate[r.date]) byDate[r.date] = r; });

    const range = document.getElementById('weekRange');
    if (range) {
      const a = days[0], b = days[6];
      range.textContent = a.getMonth() === b.getMonth()
        ? a.getDate() + ' to ' + b.getDate() + ' ' + LS.MONTHS[b.getMonth()] + ' ' + b.getFullYear()
        : a.getDate() + ' ' + LS.MONTHS[a.getMonth()] + (a.getFullYear() !== b.getFullYear() ? ' ' + a.getFullYear() : '') +
          ' to ' + b.getDate() + ' ' + LS.MONTHS[b.getMonth()] + ' ' + b.getFullYear();
    }

    weekDays = days;
    const groups = [];
    days.forEach(function (d, i) {
      const code = LS.market(SITE.schedule[d.getDay()]).code;
      const last = groups[groups.length - 1];
      if (last && last.code === code) last.span++;
      else groups.push({ code: code, start: i + 1, span: 1 });
    });
    /* With three markets, the middle one is centred on the week rather than
       set over its own first day, and the first is kept to the first two
       columns so the two names can never meet. */
    const heads = groups.map(function (g, i) {
      const r = REGIONS[g.code], ex = r.exchange;
      const centre = groups.length === 3 && i === 1;
      const place = centre ? 'grid-row:1;grid-column:1 / -1'
        : 'grid-row:1;grid-column:' + g.start + ' / span ' + (groups.length === 3 && i === 0 ? Math.min(g.span, 2) : g.span);
      return '<div class="week__mkt week__mkt--' + r.slug + (centre ? ' week__mkt--centre' : '') + '" style="' + place + '">' +
        '<a href="reports.html?region=' + g.code + '">' + esc(r.name) + '</a>' +
        '<small>' + esc(r.venues) + ', ' + esc(ex.open) + ' to ' + esc(ex.close) + ' ' + esc(ex.city) + ' time</small></div>';
    }).join('');

    const items = days.map(function (d, i) {
      const iso = LS.toISO(d);
      const today = iso === todayIso;
      const past = iso < todayIso;
      const r = REGIONS[LS.market(SITE.schedule[d.getDay()]).code];
      const rep = byDate[iso];
      const focus = focusOf(d);
      const month = i === 0 || d.getDate() === 1;
      const cls = 'wd wd--' + r.slug + (today ? ' is-today' : '') + (past ? ' is-past' : '') + (rep ? ' has-rep' : '');
      const style = '--fill:' + fill(i).toFixed(4) + (past && i < 6 ? ';--bridge:1' : '');
      return '<li class="' + cls + '" style="' + style + '"' + (today ? ' aria-current="date"' : '') + '>' +
        (today ? '<span class="wd__now" aria-hidden="true"></span>' : '') +
        '<div class="wd__panel">' +
          '<div class="wd__when" aria-hidden="true">' +
            '<span class="wd__dow"><span>' + LS.DAYS_S[d.getDay()] + '</span>' + (today ? '<span class="wd__flag">Today</span>' : '') + '</span>' +
            '<span class="wd__date">' + d.getDate() + (month ? '<small>' + LS.MONTHS_S[d.getMonth()] + '</small>' : '') + '</span>' +
          '</div>' +
          '<div class="wd__body">' +
            '<span class="sr-only">' + esc(LS.fmtDate(iso) + (today ? ', today' : '') + ', ' + r.name + (focus ? ', ' + focus.toLowerCase() : '')) + '.</span>' +
            '<span class="wd__mkt" aria-hidden="true">' + esc(r.name) + '</span>' +
            '<span class="wd__city" aria-hidden="true">' + esc(r.exchange.city) + '</span>' +
            (focus ? '<span class="wd__what" aria-hidden="true">' + esc(focus) + '</span>' : '') +
            (rep ? '<a class="wd__rep" href="' + LS.reportUrl(rep.id) + '"><b>' + esc(rep.ticker) + '</b><span>' + esc(rep.title) + '</span></a>' : '') +
          '</div>' +
        '</div></li>';
    }).join('');

    weekEl.innerHTML = '<div class="week__markets">' + heads + '</div>' +
      '<ol class="week__days" aria-label="This week, Monday to Sunday">' + items + '</ol>';
  }

  /* How much of a day has gone: 0 before it starts, 1 once it is over.
     The next midnight is built from the date, so a clock change that day
     is allowed for. */
  function fill(i) {
    const d = weekDays[i];
    const start = d.getTime(), end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const t = Date.now();
    return t <= start ? 0 : t >= end ? 1 : (t - start) / (end - start);
  }

  if (weekEl) {
    paintWeek();
    /* The line keeps up with the time of day while the page is open. */
    setInterval(function () {
      weekEl.querySelectorAll('.wd').forEach(function (li, i) { li.style.setProperty('--fill', fill(i).toFixed(4)); });
    }, 60000);
  }

  /* ------------------------------------------------------------- refresh
     An open page keeps up with the desk. The list of reports is fetched
     again every three minutes, and when the tab comes back into view after
     a minute or more away. If anything was published, edited or taken
     down, the latest report, the cards, the week and the links in the hero
     are drawn again. The moving strip of companies waits for the next
     visit, so it never jumps mid scroll. Nothing is redrawn while focus or
     the pointer is inside it; the next check picks the change up. */
  function signature() {
    return REPORTS.slice(0, 12).map(function (r) {
      return [r.id, r.date, r.title, r.standfirst, r.updatedAt || ''].join('\u0001');
    }).join('\u0002');
  }
  let shown = signature();
  let known = REPORTS.map(function (r) { return r.id; });
  let lastCheck = Date.now();
  let checking = false;

  function busy() {
    const a = document.activeElement;
    const zones = [lead, recent, cta, weekEl].filter(Boolean);
    return zones.some(function (z) { return (a && z.contains(a)) || z.matches(':hover'); });
  }

  function refresh() {
    if (checking || document.hidden || !navigator.onLine) return;
    checking = true;
    lastCheck = Date.now();
    Data.load(true).then(function () {
      const now = signature();
      if (now === shown || busy()) return;
      const fresh = REPORTS.filter(function (r) { return known.indexOf(r.id) === -1; })[0];
      shown = now;
      known = REPORTS.map(function (r) { return r.id; });
      paintCta(); paintDateline(); paintLead(); paintRecent(); paintWeek();
      if (fresh) LS.toast('New report published: ' + fresh.title);
    }).catch(function () {}).then(function () { checking = false; });
  }
  setInterval(refresh, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - lastCheck > 60 * 1000) refresh();
  });

  /* ------------------------------------------------------------ bottom */
  const band = document.getElementById('joinBand');
  if (band && user) band.remove();

  if (new URLSearchParams(location.search).get('deleted') === '1') {
    LS.toast('Your account and everything attached to it has been deleted.');
  }
});
