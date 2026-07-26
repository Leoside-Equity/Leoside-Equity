/* ==========================================================================
   Leoside Equity — member dashboard
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
            '<span class="sq sq--' + r.market.toLowerCase() + '"></span>' +
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
        '<p>' + LS.fmtDate(todayISO) + '. Today is a <strong>' + MARKETS[todayCode].name + '</strong> day.</p></div>' +
      '</div>' +

      '<div class="stat-row">' +
        statCard('Reports available', REPORTS.length, 'across both markets') +
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
              '<span class="tag tag--' + todayCode.toLowerCase() + '"><span class="dot"></span>' +
              MARKETS[todayCode].short + ' today</span></div>' +
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
                  '<span class="m">' + LS.esc(r.ticker) + ' · ' + MARKETS[r.market].short + ' · ' +
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
          '<div class="stat-row">' +
            statBlock('Total accounts', s.readers_total, 'all time') +
            statBlock('New this week', s.readers_week, 'last seven days') +
            statBlock('Confirmed email', s.readers_confirmed, 'of ' + num(s.readers_total) + ' accounts') +
            statBlock('Daily email opt in', s.digest_optin, 'want the report by email') +
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

          '<div class="panel"><div class="panel__head"><h3>Which market readers pick</h3></div>' +
            '<div class="panel__body"><div class="stat-row" style="margin:0">' +
              statBlock('Both markets', s.market_both, 'want everything') +
              statBlock('India', s.market_in, 'Sunday to Wednesday') +
              statBlock('United States', s.market_us, 'Thursday to Saturday') +
            '</div>' +
            '<p class="muted small" style="margin:1rem 0 0">This is what people chose at signup. ' +
            'A heavy lean one way is worth knowing before you plan the week.</p>' +
            '</div></div>';
      });
    }, 0);

    return host;
  }

  function viewDay(date) {
    const items = (byDate[date] || []);
    const code = LS.marketForDate(date);
    if (!items.length) {
      return head(LS.fmtDate(date), 'Scheduled coverage: ' + MARKETS[code].name + '.') +
        '<div class="empty"><h3>Nothing published on this date</h3><p>Pick another day from the list on the left.</p></div>';
    }
    return head(LS.fmtDate(date), 'Scheduled coverage: ' + MARKETS[code].name + '. ' +
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
          '<div class="form-group"><label for="acName">Name</label>' +
            '<input class="input" id="acName" type="text" value="' + LS.esc(user.name) + '"></div>' +
          '<div class="form-group"><label for="acEmail">Email address</label>' +
            '<input class="input" id="acEmail" type="email" value="' + LS.esc(user.email) + '" disabled>' +
            '<div class="hint">Changing the address on an account is not supported yet. Write in if you need it moved.</div></div>' +
          '<div class="form-group"><label for="acMarket">Market you follow most</label>' +
            '<select class="select" id="acMarket">' +
              '<option value="both"' + (user.market === 'both' ? ' selected' : '') + '>Both markets</option>' +
              '<option value="IN"' + (user.market === 'IN' ? ' selected' : '') + '>Mostly India</option>' +
              '<option value="US"' + (user.market === 'US' ? ' selected' : '') + '>Mostly United States</option>' +
            '</select></div>' +
          '<div class="form-group"><label class="check">' +
            '<input type="checkbox" id="acDigest"' + (user.digestOptIn ? ' checked' : '') + '>' +
            '<span>Email me the day\'s report</span></label></div>' +
          '<button class="btn" id="acSave">Save changes</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel">' +
        '<div class="panel__head"><h3>Session</h3></div>' +
        '<div class="panel__body">' +
          '<p class="muted small">Member since ' + LS.fmtDate(user.joined.slice(0, 10)) + '.</p>' +
          '<div class="row"><button class="btn btn--ghost" id="acSignOut">' + LS.icon('logout') + 'Sign out</button></div>' +
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
    const saveBtn = document.getElementById('acSave');
    saveBtn.addEventListener('click', function () {
      saveBtn.disabled = true;
      Auth.update({
        name: document.getElementById('acName').value.trim() || user.name,
        market: document.getElementById('acMarket').value,
        digestOptIn: document.getElementById('acDigest').checked
      }).then(function (res) {
        saveBtn.disabled = false;
        const note = document.getElementById('savedNote');
        if (res && res.ok) {
          note.className = 'notice notice--ok';
          note.innerHTML = LS.icon('check') + '<span>Saved.</span>';
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
