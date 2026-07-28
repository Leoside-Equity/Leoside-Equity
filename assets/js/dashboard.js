/* ==========================================================================
   Leoside Equity: member dashboard
   Sidebar: month and year, then week, then individual publishing dates.
   Main area is a small hash router: #overview #saved #history #account #day=…
   ========================================================================== */
Boot.start('dashboard', function () {
  'use strict';

  /* Signed out visitors get bounced to sign in and returned here afterwards. */
  if (!Auth.requireAuth()) return;

  const user = Auth.current();
  const main = document.getElementById('main');

  /* ------------------------------------------------------------ user card */
  document.getElementById('dashUser').innerHTML =
    '<span class="avatar avatar--lg">' + LS.esc(Auth.initials(user)) + '</span>' +
    '<span style="min-width:0"><span class="name">' + LS.esc(user.name) + '</span>' +
    '<span class="mail">' + LS.esc(user.email) + '</span></span>';

  /* --------------------------------------------------------- archive index */
  const byDate = {};
  REPORTS.forEach(function (r) {
    (byDate[r.date] = byDate[r.date] || []).push(r);
  });

  /* months -> weeks -> dates, newest first throughout */
  const months = [];
  const monthMap = {};
  REPORTS.forEach(function (r) {
    const mKey = r.date.slice(0, 7);
    if (!monthMap[mKey]) {
      monthMap[mKey] = { key: mKey, sample: r.date, weeks: {}, count: 0 };
      months.push(monthMap[mKey]);
    }
    const m = monthMap[mKey];
    const w = LS.weekOfMonth(r.date);
    (m.weeks[w] = m.weeks[w] || []).push(r);
    m.count++;
  });
  months.sort(function (a, b) { return a.key === b.key ? 0 : (a.key < b.key ? 1 : -1); });

  const openMonth = months.length ? months[0].key : null;

  /* ------------------------------------------------------------- side nav
     Two entirely different dashboards behind one URL. A reader gets their own
     library. An admin gets the numbers, because a reading list of their own
     writing is not much use to them. */
  const isAdmin = !!user.isAdmin;

  const SECTIONS = isAdmin ? [
    { id: 'overview', label: 'Overview',         icon: 'grid' },
    { id: 'metrics',  label: 'Report metrics',   icon: 'doc' },
    { id: 'audience', label: 'Audience',         icon: 'user' },
    { id: 'account',  label: 'Account settings', icon: 'settings' }
  ] : [
    { id: 'overview', label: 'Overview',         icon: 'grid' },
    { id: 'saved',    label: 'Saved reports',    icon: 'bookmark' },
    { id: 'history',  label: 'Reading history',  icon: 'clock' },
    { id: 'account',  label: 'Account settings', icon: 'settings' }
  ];

  function paintSideNav(active) {
    document.getElementById('sideNav').innerHTML = SECTIONS.map(function (s) {
      const count = s.id === 'saved' ? resolve(Auth.saved()).length
                  : s.id === 'history' ? resolve(Auth.history()).length : null;
      return '<a href="#' + s.id + '" class="' + (active === s.id ? 'is-active' : '') + '">' +
        LS.icon(s.icon) + s.label +
        (count ? '<span class="count">' + count + '</span>' : '') + '</a>';
    }).join('');
  }

  /* ----------------------------------------------------------------- tree */
  function paintTree(activeDate) {
    /* Browsing by date is a reader's tool. An admin has the editor for that.
       Guarded because route() runs this on every navigation and the element is
       only there to remove once. */
    if (isAdmin) {
      const wrap = document.getElementById('tree');
      if (!wrap) return;
      const label = wrap.previousElementSibling;
      if (label && label.classList.contains('side-label')) label.remove();
      wrap.remove();
      return;
    }
    if (!months.length) {
      document.getElementById('tree').innerHTML =
        '<p class="small muted" style="padding:.4rem .6rem 0;line-height:1.5">' +
        'Once reports start going out they will be listed here by month, week and day.</p>';
      return;
    }
    document.getElementById('tree').innerHTML = months.map(function (m) {
      const expanded = m.key === openMonth || (activeDate && activeDate.slice(0, 7) === m.key);
      const weekKeys = Object.keys(m.weeks).sort(function (a, b) { return b - a; });

      const weeksHtml = weekKeys.map(function (w) {
        const items = m.weeks[w].slice().sort(function (a, b) {
          return a.date === b.date ? 0 : (a.date < b.date ? 1 : -1);
        });
        const wExpanded = expanded && (
          (activeDate && items.some(function (r) { return r.date === activeDate; })) ||
          (!activeDate && w === weekKeys[0])
        );
        const firstDay = LS.parseDate(items[items.length - 1].date).getDate();
        const lastDay = LS.parseDate(items[0].date).getDate();
        const range = firstDay === lastDay ? String(firstDay) : firstDay + ' to ' + lastDay;

        const daysHtml = items.map(function (r) {
          return '<a class="tree__day' + (r.date === activeDate ? ' is-active' : '') + '" href="#day=' + r.date + '">' +
            '<span class="sq sq--' + LS.market(r.market).slug + '"></span>' +
            LS.fmtDate(r.date, 'day') +
            '<span class="tk">' + LS.esc(r.ticker) + '</span></a>';
        }).join('');

        return '<div class="tree__week">' +
          '<button class="tree__week-toggle" type="button" aria-expanded="' + wExpanded + '" data-week="' + m.key + '-' + w + '">' +
            '<span class="chev">' + LS.icon('chevron') + '</span>Week ' + w +
            '<span class="range">' + range + '</span>' +
          '</button>' +
          '<div class="tree__days" data-week-panel="' + m.key + '-' + w + '"' + (wExpanded ? '' : ' hidden') + '>' + daysHtml + '</div>' +
        '</div>';
      }).join('');

      return '<div class="tree__month">' +
        '<button class="tree__toggle" type="button" aria-expanded="' + expanded + '" data-month="' + m.key + '">' +
          '<span class="chev">' + LS.icon('chevron') + '</span>' + LS.fmtDate(m.sample, 'monthYear') +
          '<span class="count">' + m.count + '</span>' +
        '</button>' +
        '<div class="tree__weeks" data-month-panel="' + m.key + '"' + (expanded ? '' : ' hidden') + '>' + weeksHtml + '</div>' +
      '</div>';
    }).join('');

    wireTree();
  }

  function wireTree() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-month]'), function (btn) {
      btn.addEventListener('click', function () {
        const panel = document.querySelector('[data-month-panel="' + btn.dataset.month + '"]');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-week]'), function (btn) {
      btn.addEventListener('click', function () {
        const panel = document.querySelector('[data-week-panel="' + btn.dataset.week + '"]');
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        panel.hidden = open;
      });
    });
  }

  /* ---------------------------------------------------------------- views */
  /* Same row, plus a way back out of the list. The row is a div rather than an
     anchor so the remove button is not nested inside a link. */
  function savedListItem(r) {
    return '<li><div style="display:flex;align-items:center;gap:.9rem;padding:.95rem 1.35rem">' +
      '<a href="' + LS.reportUrl(r.id) + '" style="min-width:0;flex:1">' +
        '<span class="t">' + LS.esc(r.title) + '</span>' +
        '<span class="m">' + LS.esc(r.company) + ' · ' + LS.esc(r.ticker) + ' · ' + LS.fmtDate(r.date, 'short') + '</span>' +
      '</a>' +
      '<span class="r" style="display:inline-flex;gap:.5rem;align-items:center">' +
        LS.marketTag(r.market) +
        '<button class="btn btn--quiet btn--sm" type="button" data-unsave="' + LS.esc(r.id) + '" ' +
          'title="Remove from saved" aria-label="Remove ' + LS.esc(r.title) + ' from saved">' +
          LS.icon('close') + 'Remove</button>' +
      '</span>' +
    '</div></li>';
  }

  function reportListItem(r) {
    return '<li><a href="' + LS.reportUrl(r.id) + '">' +
      '<span style="min-width:0"><span class="t">' + LS.esc(r.title) + '</span>' +
      '<span class="m">' + LS.esc(r.company) + ' · ' + LS.esc(r.ticker) + ' · ' + LS.fmtDate(r.date, 'short') + '</span></span>' +
      '<span class="r">' + LS.marketTag(r.market) + '</span></a></li>';
  }

  /* Saved lists and reading history hold ids. A report can be withdrawn or
     renamed, so always resolve through the live data and drop what is gone. */
  function resolve(ids) {
    return ids.map(function (entry) {
      return LS.byId(typeof entry === 'string' ? entry : entry.id);
    }).filter(Boolean);
  }

  function viewOverview() {
    const saved = resolve(Auth.saved());
    const history = resolve(Auth.history());
    const latest = REPORTS[0];
    const todayISO = LS.toISO(new Date());
    const todayCode = LS.marketForToday();
    const thisWeek = REPORTS.filter(function (r) {
      return (Date.now() - LS.parseDate(r.date).getTime()) < 7 * 864e5;
    });
    const unread = REPORTS.filter(function (r) {
      return !history.some(function (h) { return h.id === r.id; });
    });
    const read = history.slice(0, 4);

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    /* No "open the latest report" button here. The home page already leads
       with it, and repeating it just adds a second front door. */
    return '<div class="dash-hero">' +
        '<div><h1>' + greeting + ', ' + LS.esc((user.name || '').split(' ')[0]) + '</h1>' +
        '<p>' + LS.fmtDate(todayISO) + '. Today is a <strong>' +
        LS.esc(LS.market(todayCode).name) + '</strong> day.</p></div>' +
      '</div>' +

      '<div class="stat-row">' +
        statCard('Reports available', REPORTS.length, 'across every market') +
        statCard('Published this week', thisWeek.length, 'last seven days') +
        statCard('Saved', saved.length, 'in your list') +
        statCard('Not yet read', unread.length, 'waiting for you') +
      '</div>' +

      /* No Latest report panel. The home page leads with it, and a second copy
         of the same card here was just another front door to the same place.
         Recently published below covers it, newest first. */
      (!REPORTS.length
        ? '<div class="panel">' +
            '<div class="panel__head"><h3>Nothing published yet</h3>' +
              '<span class="tag tag--' + LS.market(todayCode).slug + '"><span class="dot"></span>' +
              LS.esc(LS.market(todayCode).name) + ' today</span></div>' +
            '<div class="panel__body">' +
              '<p class="muted" style="margin-bottom:1.1rem">Your account is ready. The moment reports start going out they will ' +
              'appear here, on the reports page, and in the month by month list on the left.</p>' +
              '<a class="btn btn--sm btn--ghost" href="method.html">See how the research is done</a>' +
            '</div>' +
          '</div>'
        : '') +

      (read.length ? '<div class="panel">' +
        '<div class="panel__head"><h3>Continue reading</h3><a class="link small" href="#history">See all</a></div>' +
        '<div class="panel__body panel__body--flush"><ul class="dlist">' +
          read.map(reportListItem).join('') +
        '</ul></div></div>' : '') +

      (REPORTS.length ? '<div class="panel">' +
        '<div class="panel__head"><h3>Recently published</h3><a class="link small" href="reports.html">All reports</a></div>' +
        '<div class="panel__body panel__body--flush"><ul class="dlist">' +
          REPORTS.slice(0, 6).map(reportListItem).join('') +
        '</ul></div>' +
      '</div>' : '');
  }

  function statCard(label, value, sub) {
    return '<div class="stat"><div class="l">' + label + '</div><div class="v">' + value + '</div><div class="s">' + sub + '</div></div>';
  }

  function viewSaved() {
    const ids = Auth.saved();
    const saved = resolve(ids);

    /* An id in the list that does not resolve means the report has since been
       unpublished or deleted. Say so rather than showing "nothing saved",
       which looks identical to the bookmark never having worked. */
    const missing = ids.length - saved.length;

    return head('Saved reports', 'Anything you bookmark while reading shows up here.') +
      (saved.length
        ? '<div class="panel"><div class="panel__body panel__body--flush"><ul class="dlist" id="savedList">' +
            saved.map(savedListItem).join('') + '</ul></div></div>' +
          (missing ? '<p class="muted small" style="margin-top:1rem">' + missing +
            (missing === 1 ? ' saved report is' : ' saved reports are') +
            ' no longer available and are not shown.</p>' : '')
        : (missing
            ? '<div class="empty"><h3>Your saved reports are no longer available</h3>' +
              '<p>You have ' + missing + ' bookmarked, but they have since been unpublished or removed.</p>' +
              '<a class="btn btn--ghost btn--sm" href="reports.html">Browse all reports</a></div>'
            : '<div class="empty"><h3>Nothing saved yet</h3><p>Open any report and use the Save button in the header to keep it here.</p>' +
              '<a class="btn btn--ghost btn--sm" href="reports.html">Browse all reports</a></div>'));
  }

  function viewHistory() {
    const history = resolve(Auth.history());
    return head('Reading history', 'The last forty reports you opened, most recent first.') +
      (history.length
        ? '<div class="panel"><div class="panel__body panel__body--flush"><ul class="dlist">' +
            history.map(reportListItem).join('') +
          '</ul></div></div>'
        : '<div class="empty"><h3>No reading history yet</h3><p>Open a report and it will appear here.</p>' +
          '<a class="btn btn--ghost btn--sm" href="reports.html">Browse all reports</a></div>');
  }

  /* ======================================================================
     Admin views. Every number comes from a security definer function that
     checks is_admin in the database, so none of this is reachable by
     hiding or unhiding things in the browser.
     ====================================================================== */

  function num(n) {
    return typeof n === 'number' ? n.toLocaleString() : (n || '0');
  }

  function statBlock(label, value, sub) {
    return '<div class="stat"><div class="l">' + label + '</div>' +
      '<div class="v">' + num(value) + '</div><div class="s">' + sub + '</div></div>';
  }

  /* Three different reasons the numbers might not load, and they need three
     different answers. Saying "run the migration" when the real problem is a
     permission flag just sends you round in circles. */
  function migrationNeeded(err) {
    const msg = (err && (err.message || err)) || 'Unknown error';

    if (/not authorised/i.test(msg)) {
      return '<div class="empty">' +
        '<h3>This account is not marked as an admin</h3>' +
        '<p>The analytics functions check <strong>profiles.is_admin</strong> in the database, and it is not ' +
        'true for <strong>' + LS.esc(user.email) + '</strong>. Open the Supabase table editor, find your row in ' +
        '<strong>profiles</strong>, set <strong>is_admin</strong> to true, then sign out and back in so the ' +
        'flag reloads.</p></div>';
    }

    /* The raw message is always shown. A missing function and a missing column
       inside a function that does exist both say "does not exist", and hiding
       that behind friendly text sends you off to re-run a migration you have
       already run. */
    const looksMissing = /could not find the function/i.test(msg);

    return '<div class="empty">' +
      '<h3>' + (looksMissing ? 'Analytics are not set up yet' : 'Could not load the numbers') + '</h3>' +
      (looksMissing
        ? '<p>Run <strong>supabase/migrations/0005_fix_gate_and_analytics.sql</strong> in the Supabase SQL editor.</p>'
        : '') +
      '<p style="margin-top:.8rem"><strong>Database said:</strong></p>' +
      '<p style="font-family:ui-monospace,monospace;font-size:.85rem;color:var(--neg);' +
      'background:var(--bg-sunken);padding:.9rem 1.1rem;border-radius:8px;text-align:left;' +
      'overflow-wrap:anywhere">' + LS.esc(msg) + '</p></div>';
  }

  function viewAdminOverview() {
    const host = head('Overview', 'How the site is doing. Figures update as readers use it.') +
      '<div id="statsHost"><p class="muted">Loading the numbers…</p></div>';

    setTimeout(function () {
      SB.rpc('admin_stats').then(function (res) {
        const el = document.getElementById('statsHost');
        if (!el) return;
        if (res.error) { el.innerHTML = migrationNeeded(res.error); return; }
        const s = res.data || {};

        el.innerHTML =
          '<div class="stat-row">' +
            statBlock('Reports published', s.reports_published, 'live on the site') +
            statBlock('Words written', s.words_published, 'across published reports') +
            statBlock('Reports opened today', s.reads_today, 'by signed in readers') +
            statBlock('Opened this week', s.reads_week, 'last seven days') +
          '</div>' +

          '<div class="stat-row">' +
            statBlock('Total reads', s.reads_total, 'every reader, every report') +
            statBlock('Readers', s.readers_total, num(s.readers_week) + ' joined this week') +
            statBlock('Saved right now', s.saves_total,
              s.saves_ever !== undefined
                ? num(s.saves_ever) + ' saved at some point'
                : 'bookmarks across all reports') +
            statBlock('Drafts waiting', s.reports_draft, 'not published yet') +
          '</div>' +

          '<div class="panel"><div class="panel__head"><h3>What these count</h3></div>' +
            '<div class="panel__body"><p class="muted small" style="margin:0">' +
            '<strong>Total reads</strong> counts each reader opening each report once. A hundred readers ' +
            'getting through three reports each is three hundred, and refreshing the same page again does ' +
            'not inflate it. These are report opens by signed in readers, not raw page views: counting ' +
            'anonymous visits needs an analytics provider, and Cloudflare Web Analytics is free and cookieless ' +
            'if you want that later.</p></div></div>' +

          (s.reports_published
            ? '<div class="panel"><div class="panel__head"><h3>Average per published report</h3></div>' +
              '<div class="panel__body"><div class="stat-row" style="margin:0">' +
                statBlock('Words', Math.round((s.words_published || 0) / s.reports_published), 'per report') +
                statBlock('Reads', Math.round((s.reads_total || 0) / s.reports_published), 'per report') +
                statBlock('Saves', Math.round((s.saves_total || 0) / s.reports_published), 'per report') +
              '</div></div></div>'
            : '');
      });
    }, 0);

    return host;
  }

  function viewAdminMetrics() {
    const host = head('Report metrics', 'How each report is doing. Sorted newest first.') +
      '<div id="metricsHost"><p class="muted">Loading…</p></div>';

    setTimeout(function () {
      SB.rpc('admin_report_metrics').then(function (res) {
        const el = document.getElementById('metricsHost');
        if (!el) return;
        if (res.error) { el.innerHTML = migrationNeeded(res.error); return; }

        const list = res.data || [];
        if (!list.length) {
          el.innerHTML = '<div class="empty"><h3>Nothing to measure yet</h3>' +
            '<p>Publish a report and its numbers will appear here.</p>' +
            '<a class="btn btn--ghost btn--sm" href="admin.html">Write one</a></div>';
          return;
        }

        const best = list.reduce(function (a, b) { return (b.reads || 0) > (a.reads || 0) ? b : a; }, list[0]);

        /* Two save columns only make sense once the database keeps removed
           saves. Before that they would show the same number twice, which
           reads as broken rather than as "not tracked yet". */
        const tracksHistory = list[0].saves_total !== undefined && list[0].saves_current !== undefined;

        el.innerHTML =
          (best && best.reads
            ? '<div class="panel"><div class="panel__head"><h3>Most read</h3>' +
              '<span class="tag tag--brass">' + num(best.reads) + ' reads</span></div>' +
              '<div class="panel__body"><h3 style="margin-bottom:.3rem">' +
              '<a href="' + LS.reportUrl(best.id) + '">' + LS.esc(best.title) + '</a></h3>' +
              '<p class="muted small" style="margin:0">' + LS.esc(best.ticker) + ' · ' +
              LS.fmtDate(best.published_on, 'short') + '</p></div></div>'
            : '') +
          (tracksHistory ? '' :
            '<div class="notice notice--info" style="margin-bottom:1.2rem">' + LS.icon('info') +
            '<span>Saves show the current count only. To also see how many readers saved a report and ' +
            'later removed it, run <strong>supabase/migrations/0008_publish_order_and_saves.sql</strong>. ' +
            'Until then removing a save deletes the record, so there is no history to count.</span></div>') +
          '<div class="panel"><div class="panel__body" style="overflow-x:auto">' +
            '<table class="metrics"><thead><tr>' +
              '<th>Report</th><th class="n">Reads</th>' +
              (tracksHistory
                ? '<th class="n" title="Currently in someone\'s saved list">Saved now</th>' +
                  '<th class="n" title="Everyone who has ever saved it, counted once each">Saved ever</th>'
                : '<th class="n" title="Currently in someone\'s saved list">Saved</th>') +
              '<th class="n">Words</th><th>Last opened</th><th></th>' +
            '</tr></thead><tbody>' +
            list.map(function (r) {
              const now = r.saves_current !== undefined ? r.saves_current : r.saves;
              const ever = r.saves_total !== undefined ? r.saves_total : r.saves;
              const dropped = (ever || 0) - (now || 0);
              return '<tr>' +
                '<td><span class="t">' + LS.esc(r.title) + '</span>' +
                  '<span class="m">' + LS.esc(r.ticker) + ' · ' + LS.esc(LS.market(r.market).name) + ' · ' +
                  LS.fmtDate(r.published_on, 'short') +
                  (r.is_published ? '' : ' · <strong>draft</strong>') + '</span></td>' +
                '<td class="n tnum">' + num(r.reads) + '</td>' +
                '<td class="n tnum">' + num(now) + '</td>' +
                (tracksHistory
                  ? '<td class="n tnum">' + num(ever) +
                    (dropped > 0 ? '<span class="m">' + dropped + ' removed</span>' : '') + '</td>'
                  : '') +
                '<td class="n tnum">' + num(r.word_count) + '</td>' +
                '<td class="muted small">' + (r.last_read
                  ? LS.fmtDate(String(r.last_read).slice(0, 10), 'short') : 'Not yet') + '</td>' +
                '<td class="n">' + (r.is_published
                  ? '<a class="btn btn--quiet btn--sm" href="' + LS.reportUrl(r.id) + '">View</a>'
                  : '<a class="btn btn--quiet btn--sm" href="admin.html?edit=' +
                    encodeURIComponent(r.id) + '">Edit</a>') + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody></table></div></div>';
      });
    }, 0);

    return host;
  }

  /* The third slot. Readers matter more to a publisher than a reading list of
     their own work: it is the one number that tells you whether any of this is
     landing, and the one thing you cannot reconstruct from the reports table. */
  function viewAudience() {
    const host = head('Audience', 'Who is reading, and whether that number is going up.') +
      '<div id="audienceHost"><p class="muted">Loading…</p></div>';

    setTimeout(function () {
      SB.rpc('admin_stats').then(function (res) {
        const el = document.getElementById('audienceHost');
        if (!el) return;
        if (res.error) { el.innerHTML = migrationNeeded(res.error); return; }
        const s = res.data || {};

        const daily = s.signups_daily || [];
        const peak = daily.reduce(function (m, d) { return Math.max(m, d.n || 0); }, 1);

        el.innerHTML =
          /* No digest figure. There is no email digest and no mailing list;
             migration 0011 dropped the column that used to record an opt in
             nobody was ever asked for. */
          '<div class="stat-row">' +
            statBlock('Total accounts', s.readers_total, 'all time') +
            statBlock('New this week', s.readers_week, 'last seven days') +
            statBlock('Confirmed email', s.readers_confirmed, 'of ' + num(s.readers_total) + ' accounts') +
            statBlock('Saved reports', s.saves_total, 'held across all readers') +
          '</div>' +

          '<div class="panel"><div class="panel__head"><h3>Signups, last 14 days</h3></div>' +
            '<div class="panel__body">' +
            (daily.length
              ? '<div class="spark">' + daily.map(function (d) {
                  return '<span class="spark__bar" style="height:' +
                    Math.max(4, Math.round((d.n / peak) * 100)) + '%" title="' +
                    LS.esc(d.day) + ': ' + d.n + '"></span>';
                }).join('') + '</div>' +
                '<p class="muted small" style="margin:.8rem 0 0">Peak day: ' + num(peak) + '.</p>'
              : '<p class="muted small" style="margin:0">No signups in the last two weeks.</p>') +
            '</div></div>' +

          '<div class="panel"><div class="panel__head"><h3>Which markets readers follow</h3></div>' +
            '<div class="panel__body"><div class="stat-row" style="margin:0">' +
              statBlock(REGIONS.US.name, s.market_us, REGIONS.US.dayLabel) +
              statBlock(REGIONS.UK.name, s.market_uk, REGIONS.UK.dayLabel) +
              statBlock(REGIONS.IN.name, s.market_in, REGIONS.IN.dayLabel) +
              statBlock('All three', s.market_all, 'follow everything') +
            '</div>' +
            '<p class="muted small" style="margin:1rem 0 0">Readers can follow any combination, so the ' +
            'first three overlap and will add up to more than your reader count. A heavy lean one way is ' +
            'worth knowing before you plan the week.</p>' +
            '</div></div>';
      });
    }, 0);

    return host;
  }

  function viewDay(date) {
    const items = (byDate[date] || []);
    const m = LS.market(LS.marketForDate(date));
    const scheduled = 'Scheduled coverage: ' + m.name + '.';
    if (!items.length) {
      return head(LS.fmtDate(date), scheduled) +
        '<div class="empty"><h3>Nothing published on this date</h3><p>Pick another day from the list on the left.</p></div>';
    }
    return head(LS.fmtDate(date), scheduled + ' ' +
        items.length + (items.length === 1 ? ' report' : ' reports') + ' published.') +
      '<div class="card-grid">' + items.map(Cards.card).join('') + '</div>';
  }

  function viewAccount() {
    return head('Account settings', Auth.live
      ? 'Changes here are saved to your account.'
      : 'Everything here is stored on this device until the backend is connected.') +
      '<div class="panel">' +
        '<div class="panel__head"><h3>Your details</h3></div>' +
        '<div class="panel__body">' +
          '<div class="notice notice--ok" id="savedNote" hidden></div>' +

          /* Picture first: it is the one setting with something to look at. */
          '<div class="form-group">' +
            '<span class="label">Profile photo</span>' +
            '<div class="avatar-edit">' +
              '<span id="acAvatarPreview">' + LS.avatar(user, 'avatar--xl') + '</span>' +
              '<div class="avatar-edit__actions">' +
                '<label class="btn btn--ghost btn--sm" for="acAvatarFile">Choose a photo</label>' +
                '<input id="acAvatarFile" type="file" accept="image/*" hidden>' +
                '<button class="btn btn--quiet btn--sm" type="button" id="acAvatarClear"' +
                  (user.avatar ? '' : ' hidden') + '>Remove</button>' +
                '<p class="hint" style="margin:.1rem 0 0">Square works best. Anything larger is scaled down to 256 pixels before it is saved.</p>' +
              '</div>' +
            '</div>' +
            '<div class="notice notice--err" id="acAvatarErr" hidden></div>' +
          '</div>' +

          '<div class="form-group"><label for="acName">Name</label>' +
            '<input class="input" id="acName" type="text" value="' + LS.esc(user.name) + '">' +
            '<div class="hint">This is what we call you around the site.</div></div>' +
          '<div class="form-group"><label for="acEmail">Email address</label>' +
            '<input class="input" id="acEmail" type="email" value="' + LS.esc(user.email) + '" disabled>' +
            '<div class="hint">Changing the address on an account is not supported yet. Write in if you need it moved.</div></div>' +
          '<div class="form-group">' +
            '<span class="label">Markets you follow</span>' +
            '<div class="checkset" id="acMarkets" role="group" aria-label="Markets you follow">' +
              Auth.MARKET_CODES.map(function (code) {
                const on = Auth.marketList(user.market).indexOf(code) !== -1;
                return '<label class="checkset__item">' +
                  '<input type="checkbox" value="' + code + '"' + (on ? ' checked' : '') + '>' +
                  '<span class="checkset__dot checkset__dot--' + REGIONS[code].slug + '"></span>' +
                  '<span>' + LS.esc(REGIONS[code].name) + '</span>' +
                '</label>';
              }).join('') +
            '</div>' +
            '<div class="hint">Pick as many as you like. This only shapes what we highlight for you.</div></div>' +
          '<button class="btn" id="acSave">Save changes</button>' +
        '</div>' +
      '</div>' +

      '<div class="panel">' +
        '<div class="panel__head"><h3>Session</h3></div>' +
        '<div class="panel__body">' +
          '<p class="muted small">Member since ' + LS.fmtDate(user.joined.slice(0, 10)) + '.</p>' +
          '<div class="notice notice--ok" id="acResetNote" hidden></div>' +
          '<div class="row" style="gap:.7rem;flex-wrap:wrap">' +
            '<button class="btn btn--ghost" id="acSignOut">' + LS.icon('logout') + 'Sign out</button>' +
            '<button class="btn btn--ghost" id="acReset">' + LS.icon('mail') + 'Reset password</button>' +
            '<button class="btn btn--danger" id="acDelete">' + LS.icon('close') + 'Delete account</button>' +
          '</div>' +
          '<p class="hint" style="margin-top:.9rem">Resetting sends a link to your email address. ' +
          'You stay signed in here until you use it.</p>' +
        '</div>' +
      '</div>' +

      /* Kept in its own panel, closed by default, and it asks you to type the
         address out. Deleting an account cannot be undone. */
      '<div class="panel" id="acDangerPanel" hidden>' +
        '<div class="panel__head"><h3>Delete your account</h3></div>' +
        '<div class="panel__body">' +
          '<div class="notice notice--err">' + LS.icon('alert') +
            '<span>This removes your account, your saved reports and your reading history. ' +
            'It cannot be undone and we cannot get any of it back for you. ' +
            'The reports themselves stay on the site.</span></div>' +
          '<div class="form-group"><label for="acDeleteEmail">Type <strong>' + LS.esc(user.email) +
            '</strong> to confirm</label>' +
            '<input class="input" id="acDeleteEmail" type="email" autocomplete="off" ' +
              'placeholder="' + LS.esc(user.email) + '"></div>' +
          '<div class="notice notice--err" id="acDeleteError" hidden></div>' +
          '<div class="row" style="gap:.7rem;flex-wrap:wrap">' +
            '<button class="btn btn--danger" id="acDeleteGo" disabled>Permanently delete my account</button>' +
            '<button class="btn btn--quiet" id="acDeleteCancel">Cancel</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function head(title, sub) {
    return '<div class="dash-hero"><div><h1>' + LS.esc(title) + '</h1><p>' + sub + '</p></div></div>';
  }

  /* --------------------------------------------------------------- router */
  function route() {
    const hash = (location.hash || '#overview').slice(1);
    let active = hash;
    let html;

    if (hash.indexOf('day=') === 0 && !isAdmin) {
      const date = hash.slice(4);
      html = viewDay(date);
      active = null;
      paintTree(date);
    } else {
      if (!SECTIONS.some(function (s) { return s.id === hash; })) active = 'overview';
      if (isAdmin) {
        html = active === 'metrics'  ? viewAdminMetrics()
             : active === 'audience' ? viewAudience()
             : active === 'account'  ? viewAccount()
             : viewAdminOverview();
      } else {
        html = active === 'saved'   ? viewSaved()
             : active === 'history' ? viewHistory()
             : active === 'account' ? viewAccount()
             : viewOverview();
      }
      paintTree(null);
    }

    paintSideNav(active);
    main.innerHTML = html;
    main.scrollIntoView({ block: 'start', behavior: 'auto' });

    if (active === 'account') wireAccount();
    if (active === 'saved') wireSaved();
  }

  /* Remove from the saved list, straight from the row. */
  function wireSaved() {
    const list = document.getElementById('savedList');
    if (!list) return;
    list.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-unsave]');
      if (!btn) return;
      e.preventDefault();
      const id = btn.getAttribute('data-unsave');
      btn.disabled = true;
      btn.innerHTML = 'Removing…';
      Promise.resolve(Auth.toggleSave(id)).then(function (res) {
        if (!res.ok) {
          btn.disabled = false;
          btn.innerHTML = LS.icon('close') + 'Remove';
          window.alert('Could not remove that report.\n\n' + res.error);
          return;
        }
        route();   /* repaint the list and the sidebar count */
      });
    });
  }

  function wireAccount() {
    /* ---------------------------------------------------- profile photo
       Scaled to 256px and stored inline on the profile row rather than in a
       storage bucket. A bucket means a second set of access rules to get
       right for an image that is only ever a few kilobytes once resized, and
       one text column carries it with no extra surface to secure.

       Everything happens in a canvas on the reader's own machine; the file
       itself is never uploaded anywhere. */
    const MAX_PX = 256;
    const MAX_SRC_BYTES = 8 * 1024 * 1024;
    let pendingAvatar;                 /* undefined = untouched, null = remove */

    const fileInput = document.getElementById('acAvatarFile');
    const clearBtn  = document.getElementById('acAvatarClear');
    const preview   = document.getElementById('acAvatarPreview');
    const avatarErr = document.getElementById('acAvatarErr');

    function avatarProblem(message) {
      avatarErr.innerHTML = LS.icon('alert') + '<span>' + LS.esc(message) + '</span>';
      avatarErr.hidden = false;
    }

    function shrink(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onerror = function () { reject(new Error('That file could not be read.')); };
        reader.onload = function () {
          const img = new Image();
          img.onerror = function () { reject(new Error('That does not look like an image we can read.')); };
          img.onload = function () {
            /* Centre crop to a square first, so a wide photo is not squashed
               into the circle it is about to be displayed in. */
            const side = Math.min(img.width, img.height);
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = Math.min(side, MAX_PX);
            canvas.getContext('2d').drawImage(
              img,
              (img.width - side) / 2, (img.height - side) / 2, side, side,
              0, 0, canvas.width, canvas.height
            );
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (fileInput) fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      avatarErr.hidden = true;
      if (!file) return;

      if (!/^image\//.test(file.type)) { avatarProblem('Choose an image file.'); return; }
      if (file.size > MAX_SRC_BYTES) { avatarProblem('That image is over 8 MB. Pick a smaller one.'); return; }

      shrink(file).then(function (dataUrl) {
        pendingAvatar = dataUrl;
        preview.innerHTML = '<img class="avatar avatar--xl avatar--img" src="' + dataUrl + '" alt="">';
        clearBtn.hidden = false;
      }).catch(function (err) {
        avatarProblem(err.message || 'That image could not be processed.');
      });
      /* Reset so choosing the same file twice still fires a change event. */
      fileInput.value = '';
    });

    if (clearBtn) clearBtn.addEventListener('click', function () {
      pendingAvatar = null;
      avatarErr.hidden = true;
      preview.innerHTML = LS.avatar({ name: user.name, email: user.email }, 'avatar--xl');
      clearBtn.hidden = true;
    });

    const saveBtn = document.getElementById('acSave');
    saveBtn.addEventListener('click', function () {
      saveBtn.disabled = true;

      const changes = {
        name: document.getElementById('acName').value.trim() || user.name,
        market: Array.prototype.map.call(
          document.querySelectorAll('#acMarkets input:checked'),
          function (i) { return i.value; })
      };
      /* Only send the picture when it actually changed, so saving a name does
         not rewrite an image that is already there. */
      if (pendingAvatar !== undefined) changes.avatar = pendingAvatar;

      Auth.update(changes).then(function (res) {
        saveBtn.disabled = false;
        const note = document.getElementById('savedNote');
        if (res && res.ok) {
          /* A partial save is a success with a caveat, not a failure: the name
             and markets went in and only the photo did not. */
          note.className = res.partial ? 'notice notice--info' : 'notice notice--ok';
          note.innerHTML = LS.icon(res.partial ? 'info' : 'check') +
            '<span>' + LS.esc(res.partial ? res.error : 'Saved.') + '</span>';
          /* The header carries the name and the picture, so it has to be
             redrawn or it keeps showing what things used to be. */
          pendingAvatar = undefined;
          LS.init('dashboard');
        } else {
          note.className = 'notice notice--err';
          note.innerHTML = LS.icon('alert') + '<span>' + LS.esc((res && res.error) || 'We could not save that.') + '</span>';
        }
        note.hidden = false;
      });
    });
    document.getElementById('acSignOut').addEventListener('click', function () {
      Promise.resolve(Auth.signOut()).then(function () { location.href = 'index.html'; });
    });

    /* ------------------------------------------------------ reset password
       Two steps on purpose. The address is already known here so there is no
       typo to worry about, but a single stray click should not spend an email
       from a limited allowance. The first click shows which address it will
       go to, the second sends it. */
    const resetBtn = document.getElementById('acReset');
    const resetNote = document.getElementById('acResetNote');
    let resetArmed = false;
    let resetTimer = null;
    const resetLabel = resetBtn.innerHTML;

    function disarmReset() {
      resetArmed = false;
      clearTimeout(resetTimer);
      resetBtn.innerHTML = resetLabel;
      resetBtn.classList.remove('btn--armed');
    }

    resetBtn.addEventListener('click', function () {
      if (!resetArmed) {
        resetArmed = true;
        resetBtn.classList.add('btn--armed');
        resetBtn.innerHTML = LS.icon('mail') + 'Send link to ' + LS.esc(user.email) + '?';
        resetTimer = setTimeout(disarmReset, 6000);
        return;
      }

      disarmReset();
      resetBtn.disabled = true;
      resetBtn.innerHTML = 'Sending…';

      Promise.resolve(Auth.sendPasswordReset()).then(function (res) {
        resetBtn.disabled = false;
        resetBtn.innerHTML = resetLabel;
        resetNote.className = 'notice notice--' + (res.ok ? 'ok' : 'err');
        resetNote.innerHTML = (res.ok ? LS.icon('check') : LS.icon('alert')) +
          '<span>' + (res.ok
            ? 'Reset link sent to <strong>' + LS.esc(user.email) + '</strong>. It opens a page where you choose the new password. Check the spam folder if it does not arrive.'
            : LS.esc(res.error)) + '</span>';
        resetNote.hidden = false;
      });
    });

    /* ------------------------------------------------------ delete account */
    const dangerPanel = document.getElementById('acDangerPanel');
    const deleteBtn   = document.getElementById('acDelete');
    const emailInput  = document.getElementById('acDeleteEmail');
    const confirmBtn  = document.getElementById('acDeleteGo');
    const cancelBtn   = document.getElementById('acDeleteCancel');
    const deleteError = document.getElementById('acDeleteError');

    deleteBtn.addEventListener('click', function () {
      dangerPanel.hidden = false;
      dangerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
      emailInput.focus();
    });

    cancelBtn.addEventListener('click', function () {
      dangerPanel.hidden = true;
      emailInput.value = '';
      confirmBtn.disabled = true;
      deleteError.hidden = true;
    });

    /* The button stays dead until the address matches exactly. */
    emailInput.addEventListener('input', function () {
      confirmBtn.disabled =
        emailInput.value.trim().toLowerCase() !== String(user.email).trim().toLowerCase();
    });

    confirmBtn.addEventListener('click', function () {
      if (confirmBtn.disabled) return;
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting…';
      deleteError.hidden = true;

      Promise.resolve(Auth.deleteAccount()).then(function (res) {
        if (!res.ok) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Permanently delete my account';
          deleteError.innerHTML = LS.icon('alert') + '<span>' + LS.esc(res.error) + '</span>';
          deleteError.hidden = false;
          return;
        }
        /* Gone. Send them out to a page that does not need a session. */
        location.replace('index.html?deleted=1');
      });
    });
  }

  window.addEventListener('hashchange', route);
  route();

  /* ------------------------------------------------------ mobile sidebar */
  const side = document.getElementById('dashSide');
  const toggle = document.getElementById('sideToggle');
  toggle.innerHTML = '<span>Dashboard menu</span>' + LS.icon('chevronDown');
  toggle.addEventListener('click', function () {
    const collapsed = side.getAttribute('data-collapsed') === 'true';
    side.setAttribute('data-collapsed', String(!collapsed));
    toggle.setAttribute('aria-expanded', String(collapsed));
  });
  if (window.matchMedia('(max-width: 900px)').matches) {
    side.setAttribute('data-collapsed', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  }
});
