/* ==========================================================================
   Leoside Equity: member dashboard
   Sidebar: sections, then reports by month, week and day.
   Main area: a small hash router. #overview #saved #history #account #day=
   Admins get the site's numbers instead of a reading list.
   ========================================================================== */
Boot.start('dashboard', function () {
  'use strict';

  if (!Auth.requireAuth()) return;

  const user = Auth.current();
  const main = document.getElementById('main');
  const isAdmin = !!user.isAdmin;

  function paintUserCard() {
    const u = Auth.current() || user;
    document.getElementById('dashUser').innerHTML = LS.avatar(u, 'avatar--lg') +
      '<span style="min-width:0"><span class="name">' + LS.esc(LS.displayName(u)) + '</span>' +
      '<span class="mail">' + LS.esc(u.email) + '</span></span>';
  }
  paintUserCard();

  /* ------------------------------------------------------------ archive */
  const byDate = Object.create(null);
  REPORTS.forEach(function (r) { (byDate[r.date] = byDate[r.date] || []).push(r); });

  const months = [];
  const monthMap = Object.create(null);
  REPORTS.forEach(function (r) {
    const key = r.date.slice(0, 7);
    if (!monthMap[key]) { monthMap[key] = { key: key, sample: r.date, weeks: {}, count: 0 }; months.push(monthMap[key]); }
    const w = LS.weekOfMonth(r.date);
    (monthMap[key].weeks[w] = monthMap[key].weeks[w] || []).push(r);
    monthMap[key].count++;
  });
  months.sort(function (a, b) { return a.key === b.key ? 0 : (a.key < b.key ? 1 : -1); });
  const openMonth = months.length ? months[0].key : null;

  const SECTIONS = isAdmin ? [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'metrics', label: 'Report metrics', icon: 'doc' },
    { id: 'audience', label: 'Audience', icon: 'user' },
    { id: 'errors', label: 'Error log', icon: 'alert' },
    { id: 'account', label: 'Account and privacy', icon: 'settings' }
  ] : [
    { id: 'overview', label: 'Overview', icon: 'grid' },
    { id: 'saved', label: 'Saved reports', icon: 'bookmark' },
    { id: 'history', label: 'Reading history', icon: 'clock' },
    { id: 'account', label: 'Account and privacy', icon: 'settings' }
  ];

  function resolve(ids) {
    return ids.map(function (e) { return LS.byId(typeof e === 'string' ? e : e.id); }).filter(Boolean);
  }

  function paintSideNav(active) {
    document.getElementById('sideNav').innerHTML = SECTIONS.map(function (s) {
      const count = s.id === 'saved' ? resolve(Auth.saved()).length : s.id === 'history' ? resolve(Auth.history()).length : null;
      return '<a href="#' + s.id + '"' + (active === s.id ? ' class="is-active" aria-current="page"' : '') + '>' +
        LS.icon(s.icon) + s.label + (count ? '<span class="count">' + count + '</span>' : '') + '</a>';
    }).join('');
  }

  function paintTree(activeDate) {
    const wrap = document.getElementById('tree');
    if (!wrap) return;
    if (isAdmin) {
      const label = wrap.previousElementSibling;
      if (label && label.classList.contains('side-label')) label.remove();
      wrap.remove();
      return;
    }
    if (!months.length) {
      wrap.innerHTML = '<p class="small muted" style="padding:0 8px">Reports will be listed here by month, week and day once they are published.</p>';
      return;
    }
    wrap.innerHTML = months.map(function (m) {
      const expanded = m.key === openMonth || (activeDate && activeDate.slice(0, 7) === m.key);
      const weekKeys = Object.keys(m.weeks).sort(function (a, b) { return b - a; });
      return '<div class="tree__month">' +
        '<button class="tree__toggle" type="button" aria-expanded="' + expanded + '" aria-controls="tm-' + m.key + '" data-toggle="tm-' + m.key + '">' +
          '<span class="chev">' + LS.icon('chevron') + '</span>' + LS.fmtDate(m.sample, 'monthYear') + '<span class="count">' + m.count + '</span></button>' +
        '<div class="tree__weeks" id="tm-' + m.key + '"' + (expanded ? '' : ' hidden') + '>' +
          weekKeys.map(function (w) {
            const items = m.weeks[w].slice().sort(function (a, b) { return a.date === b.date ? 0 : (a.date < b.date ? 1 : -1); });
            const open = expanded && ((activeDate && items.some(function (r) { return r.date === activeDate; })) || (!activeDate && w === weekKeys[0]));
            const first = LS.parseDate(items[items.length - 1].date).getDate();
            const last = LS.parseDate(items[0].date).getDate();
            return '<button class="tree__week-toggle" type="button" aria-expanded="' + open + '" aria-controls="tw-' + m.key + '-' + w + '" data-toggle="tw-' + m.key + '-' + w + '">' +
                '<span class="chev">' + LS.icon('chevron') + '</span>Week ' + w + '<span class="range">' + (first === last ? first : first + ' to ' + last) + '</span></button>' +
              '<div class="tree__days" id="tw-' + m.key + '-' + w + '"' + (open ? '' : ' hidden') + '>' +
                items.map(function (r) {
                  return '<a class="tree__day' + (r.date === activeDate ? ' is-active' : '') + '" href="#day=' + r.date + '">' +
                    '<span class="sq sq--' + LS.market(r.market).slug + '" aria-hidden="true"></span>' + LS.fmtDate(r.date, 'day') +
                    '<span class="tk">' + LS.esc(r.ticker) + '</span></a>';
                }).join('') +
              '</div>';
          }).join('') +
        '</div></div>';
    }).join('');
  }

  document.getElementById('dashSide').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    const panel = document.getElementById(btn.getAttribute('data-toggle'));
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });

  /* --------------------------------------------------------------- views */
  function head(title, sub) {
    return '<div class="dash-hero"><h1>' + LS.esc(title) + '</h1><p>' + sub + '</p></div>';
  }

  function listItem(r, removable) {
    return '<li><div class="dl-row">' +
      '<a href="' + LS.reportUrl(r.id) + '" style="padding:0;flex:1;min-width:0"><span class="t">' + LS.esc(r.title) + '</span>' +
      '<span class="m">' + LS.esc(r.company) + ' · ' + LS.esc(r.ticker) + ' · ' + LS.fmtDate(r.date, 'medium') + '</span></a>' +
      '<span class="r">' + LS.marketTag(r.market) +
        (removable ? '<button class="btn btn--quiet btn--sm" type="button" data-unsave="' + LS.esc(r.id) + '" aria-label="Remove ' + LS.esc(r.title) + ' from saved">Remove</button>' : '') +
      '</span></div></li>';
  }

  function statBlock(label, value, sub) {
    const v = typeof value === 'number' ? value.toLocaleString() : (value == null ? '0' : value);
    return '<div class="stat"><div class="l">' + label + '</div><div class="v">' + v + '</div><div class="s">' + sub + '</div></div>';
  }

  function viewOverview() {
    const saved = resolve(Auth.saved());
    const history = resolve(Auth.history());
    const code = LS.marketForToday();
    const week = REPORTS.filter(function (r) { return (Date.now() - LS.parseDate(r.date).getTime()) < 7 * 864e5; });
    const unread = REPORTS.filter(function (r) { return !history.some(function (h) { return h.id === r.id; }); });
    return head('Your reading', LS.fmtDate(LS.toISO(new Date())) + '. Today covers <strong>' + LS.esc(LS.market(code).name) + '</strong>.') +
      '<div class="stat-row">' +
        statBlock('Reports available', REPORTS.length, 'across every market') +
        statBlock('Published this week', week.length, 'last seven days') +
        statBlock('Saved', saved.length, 'in your list') +
        statBlock('Not yet read', unread.length, 'in the archive') +
      '</div>' +
      (!REPORTS.length
        ? '<div class="empty"><h2>Nothing published yet</h2><p>Your account is ready. Reports will appear here, in the archive and in the list on the left as soon as they go out.</p>' +
          '<a class="btn btn--ghost" href="method.html">How reports are written</a></div>' : '') +
      (history.length ? '<section class="panel"><div class="panel__head"><h2>Continue reading</h2><a class="link small" href="#history">See all</a></div>' +
        '<ul class="dlist">' + history.slice(0, 4).map(function (r) { return listItem(r); }).join('') + '</ul></section>' : '') +
      (REPORTS.length ? '<section class="panel"><div class="panel__head"><h2>Recently published</h2><a class="link small" href="reports.html">All reports</a></div>' +
        '<ul class="dlist">' + REPORTS.slice(0, 6).map(function (r) { return listItem(r); }).join('') + '</ul></section>' : '');
  }

  function viewSaved() {
    const ids = Auth.saved();
    const saved = resolve(ids);
    const missing = ids.length - saved.length;
    return head('Saved reports', 'Anything you save while reading is kept here.') +
      (saved.length
        ? '<section class="panel"><ul class="dlist" id="savedList">' + saved.map(function (r) { return listItem(r, true); }).join('') + '</ul></section>' +
          (missing ? '<p class="muted small">' + missing + (missing === 1 ? ' saved report has' : ' saved reports have') + ' since been withdrawn and ' + (missing === 1 ? 'is' : 'are') + ' not shown.</p>' : '')
        : '<div class="empty"><h2>' + (missing ? 'Your saved reports have been withdrawn' : 'Nothing saved yet') + '</h2>' +
          '<p>' + (missing ? 'You saved ' + missing + ', but they are no longer published.' : 'Open any report and press Save beside the byline to keep it here.') + '</p>' +
          '<a class="btn btn--ghost" href="reports.html">Browse the reports</a></div>');
  }

  function viewHistory() {
    const history = resolve(Auth.history());
    return head('Reading history', 'The last forty reports you opened, most recent first.') +
      (history.length
        ? '<section class="panel"><ul class="dlist">' + history.map(function (r) { return listItem(r); }).join('') + '</ul></section>'
        : '<div class="empty"><h2>No reading history yet</h2><p>Open a report and it will appear here.</p><a class="btn btn--ghost" href="reports.html">Browse the reports</a></div>');
  }

  function viewDay(date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = LS.toISO(new Date());
    const items = byDate[date] || [];
    const sub = 'Scheduled coverage: ' + LS.esc(LS.market(LS.marketForDate(date)).name) + '.';
    return head(LS.fmtDate(date), sub + (items.length ? ' ' + items.length + (items.length === 1 ? ' report.' : ' reports.') : '')) +
      (items.length ? '<ol class="index">' + items.map(Cards.index).join('') + '</ol>'
        : '<div class="empty"><h2>Nothing published on this date</h2><p>Pick another day from the list.</p></div>');
  }

  /* ---------------------------------------------------------- admin views */
  function loadingRows() {
    return '<div class="stat-row">' + [1, 2, 3, 4].map(function () {
      return '<div class="stat"><span class="sk sk--line sk-w60"></span><span class="sk sk--title sk-w40"></span></div>';
    }).join('') + '</div>';
  }

  function adminError(err) {
    const msg = (err && (err.message || err)) || 'Unknown error';
    if (/not authori[sz]ed/i.test(msg)) {
      return '<div class="empty"><h2>This account is not an admin in the database</h2><p>profiles.is_admin is not true for ' + LS.esc(user.email) + '. Set it in the Supabase table editor, then sign out and back in.</p></div>';
    }
    const missing = /could not find the function/i.test(msg);
    return '<div class="empty"><h2>' + (missing ? 'This needs a database migration' : 'The numbers did not load') + '</h2>' +
      (missing ? '<p>Run the latest file in supabase/migrations in the Supabase SQL editor.</p>' : '') +
      '<p class="small"><code>' + LS.esc(msg) + '</code></p></div>';
  }

  function viewAdminOverview() {
    setTimeout(function () {
      Promise.resolve(SB.rpc('admin_stats')).then(function (res) {
        const el = document.getElementById('statsHost');
        if (!el) return;
        if (res.error) { el.innerHTML = adminError(res.error); return; }
        const s = res.data || {};
        el.innerHTML =
          '<div class="stat-row">' +
            statBlock('Reports published', s.reports_published, 'live on the site') +
            statBlock('Words published', s.words_published, 'across live reports') +
            statBlock('Opened today', s.reads_today, 'by signed in readers') +
            statBlock('Opened this week', s.reads_week, 'last seven days') +
          '</div><div class="stat-row">' +
            statBlock('Reads, all time', s.reads_total, 'each reader counted once per report') +
            statBlock('Accounts', s.readers_total, (s.readers_week || 0).toLocaleString() + ' joined this week') +
            statBlock('Saved now', s.saves_total, s.saves_ever !== undefined ? (s.saves_ever || 0).toLocaleString() + ' saved at some point' : 'across all reports') +
            statBlock('Drafts', s.reports_draft, 'not yet published') +
          '</div>' +
          '<section class="panel"><div class="panel__head"><h2>What these count</h2></div><div class="panel__body"><p class="small muted" style="margin:0">' +
            'Reads count each signed in reader opening each report once, so refreshing does not inflate them. Anonymous page views are not counted: the site runs no analytics tracker.</p></div></section>';
      }).catch(function (e) { const el = document.getElementById('statsHost'); if (el) el.innerHTML = adminError(e); });
    }, 0);
    return head('Overview', 'How the site is doing, straight from the database.') + '<div id="statsHost">' + loadingRows() + '</div>';
  }

  function viewAdminMetrics() {
    setTimeout(function () {
      Promise.resolve(SB.rpc('admin_report_metrics')).then(function (res) {
        const el = document.getElementById('metricsHost');
        if (!el) return;
        if (res.error) { el.innerHTML = adminError(res.error); return; }
        const list = res.data || [];
        if (!list.length) {
          el.innerHTML = '<div class="empty"><h2>Nothing to measure yet</h2><p>Publish a report and its numbers appear here.</p><a class="btn btn--ghost" href="admin.html">Write one</a></div>';
          return;
        }
        let shown = 25;
        const draw = function () {
          el.innerHTML = '<section class="panel"><div class="panel__body table-wrap">' +
            '<table class="metrics"><thead><tr><th scope="col">Report</th><th scope="col" class="n">Reads</th><th scope="col" class="n">Saved now</th><th scope="col" class="n">Words</th><th scope="col">Last opened</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
            list.slice(0, shown).map(function (r) {
              const now = r.saves_current !== undefined ? r.saves_current : r.saves;
              return '<tr><td><span class="t">' + LS.esc(r.title) + '</span><span class="m">' + LS.esc(r.ticker) + ' · ' +
                LS.esc(LS.market(r.market).name) + ' · ' + LS.fmtDate(r.published_on, 'medium') + (r.is_published ? '' : ' · draft') + '</span></td>' +
                '<td class="n">' + (r.reads || 0).toLocaleString() + '</td><td class="n">' + (now || 0).toLocaleString() + '</td>' +
                '<td class="n">' + (r.word_count || 0).toLocaleString() + '</td>' +
                '<td class="small muted">' + (r.last_read ? LS.fmtDate(String(r.last_read).slice(0, 10), 'medium') : 'Not yet') + '</td>' +
                '<td class="n">' + (r.is_published ? '<a class="btn btn--quiet btn--sm" href="' + LS.reportUrl(r.id) + '">View</a>'
                  : '<a class="btn btn--quiet btn--sm" href="admin.html?edit=' + encodeURIComponent(r.id) + '">Edit</a>') + '</td></tr>';
            }).join('') + '</tbody></table>' +
            (list.length > shown ? '<p style="margin:16px 0 0"><button class="btn btn--ghost btn--sm" type="button" id="moreMetrics">Show ' + Math.min(25, list.length - shown) + ' more</button></p>' : '') +
            '</div></section>';
          const more = document.getElementById('moreMetrics');
          if (more) more.addEventListener('click', function () { shown += 25; draw(); });
        };
        draw();
      }).catch(function (e) { const el = document.getElementById('metricsHost'); if (el) el.innerHTML = adminError(e); });
    }, 0);
    return head('Report metrics', 'Every report, newest first.') + '<div id="metricsHost">' + loadingRows() + '</div>';
  }

  function viewAudience() {
    setTimeout(function () {
      Promise.resolve(SB.rpc('admin_stats')).then(function (res) {
        const el = document.getElementById('audienceHost');
        if (!el) return;
        if (res.error) { el.innerHTML = adminError(res.error); return; }
        const s = res.data || {};
        const daily = s.signups_daily || [];
        const peak = daily.reduce(function (m, d) { return Math.max(m, d.n || 0); }, 1);
        el.innerHTML =
          '<div class="stat-row">' +
            statBlock('Accounts', s.readers_total, 'all time') +
            statBlock('New this week', s.readers_week, 'last seven days') +
            statBlock('Confirmed email', s.readers_confirmed, 'of ' + (s.readers_total || 0).toLocaleString()) +
            statBlock('Saved reports', s.saves_total, 'across all readers') +
          '</div>' +
          '<section class="panel"><div class="panel__head"><h2>Sign ups, last 14 days</h2></div><div class="panel__body">' +
            (daily.length ? '<div class="spark" role="img" aria-label="Sign ups per day, peak ' + peak + '">' + daily.map(function (d) {
                return '<span class="spark__bar" style="height:' + Math.max(4, Math.round((d.n / peak) * 100)) + '%" title="' + LS.esc(d.day) + ': ' + d.n + '"></span>';
              }).join('') + '</div>'
              : '<p class="small muted" style="margin:0">No sign ups in the last two weeks.</p>') +
          '</div></section>' +
          '<section class="panel"><div class="panel__head"><h2>Markets readers follow</h2></div><div class="panel__body">' +
            '<div class="stat-row" style="margin:0">' +
              statBlock(REGIONS.US.name, s.market_us, REGIONS.US.dayLabel) +
              statBlock(REGIONS.UK.name, s.market_uk, REGIONS.UK.dayLabel) +
              statBlock(REGIONS.IN.name, s.market_in, REGIONS.IN.dayLabel) +
              statBlock('All three', s.market_all, 'follow everything') +
            '</div><p class="small muted" style="margin:16px 0 0">Readers can follow several markets, so the first three overlap.</p>' +
          '</div></section>';
      }).catch(function (e) { const el = document.getElementById('audienceHost'); if (el) el.innerHTML = adminError(e); });
    }, 0);
    return head('Audience', 'Who has an account, and whether that is growing.') + '<div id="audienceHost">' + loadingRows() + '</div>';
  }

  function viewErrors() {
    setTimeout(function () {
      Promise.resolve(SB.rpc('admin_client_errors')).then(function (res) {
        const el = document.getElementById('errorsHost');
        if (!el) return;
        if (res.error) { el.innerHTML = adminError(res.error); return; }
        const list = res.data || [];
        el.innerHTML = list.length
          ? '<section class="panel"><div class="panel__body table-wrap"><table class="metrics"><thead><tr><th scope="col">When</th><th scope="col">Page</th><th scope="col">Message</th><th scope="col">Browser</th></tr></thead><tbody>' +
            list.map(function (e) {
              return '<tr><td class="small muted">' + LS.esc(new Date(e.at).toLocaleString()) + '</td><td><code>' + LS.esc(e.page || '') + '</code></td>' +
                '<td><span class="t">' + LS.esc(e.message || '') + '</span><span class="m">' + LS.esc((e.source || '') + (e.line ? ':' + e.line : '')) + '</span></td>' +
                '<td class="small muted">' + LS.esc(e.browser || '') + '</td></tr>';
            }).join('') + '</tbody></table></div></section>'
          : '<div class="empty"><h2>No errors recorded</h2><p>Uncaught errors from readers\' browsers appear here and are deleted after 30 days.</p></div>';
      }).catch(function (e) { const el = document.getElementById('errorsHost'); if (el) el.innerHTML = adminError(e); });
    }, 0);
    return head('Error log', 'Faults readers hit on the live site, newest first. Kept 30 days, no IP addresses.') + '<div id="errorsHost">' + loadingRows() + '</div>';
  }

  /* ------------------------------------------------------------- account */
  function viewAccount() {
    const u = Auth.current();
    return head('Account and privacy', Auth.live ? 'Changes save to your account.' : 'Stored on this device only in this build.') +
      '<section class="panel"><div class="panel__head"><h2>Your details</h2></div><div class="panel__body">' +
        '<div class="form-group"><span class="flabel">Profile photo</span>' +
          '<div class="avatar-edit"><span id="acAvatarPreview">' + LS.avatar(u, 'avatar--xl') + '</span>' +
            '<div class="avatar-edit__actions">' +
              '<label class="btn btn--ghost btn--sm" for="acAvatarFile">Choose a photo</label>' +
              '<input id="acAvatarFile" class="sr-only" type="file" accept="image/jpeg,image/png,image/webp">' +
              '<button class="btn btn--quiet btn--sm" type="button" id="acAvatarClear"' + (u.avatar ? '' : ' hidden') + '>Remove</button>' +
              '<p class="hint">JPEG, PNG or WebP up to 8 MB. It is cropped square and shrunk to 256 pixels in your browser, which also strips camera data such as location. Only you see it. Upload only a photo you have the right to use.</p>' +
            '</div></div>' +
          '<div class="notice notice--err" id="acAvatarErr" role="alert" hidden></div>' +
        '</div>' +
        '<div class="form-group"><label for="acName">Name</label>' +
          '<input class="input" id="acName" type="text" maxlength="120" autocomplete="name" value="' + LS.esc(u.name) + '">' +
          '<p class="hint">What the site calls you.</p></div>' +
        '<div class="form-group"><label for="acEmail">Email address</label>' +
          '<input class="input" id="acEmail" type="email" value="' + LS.esc(u.email) + '" disabled aria-describedby="acEmailHint">' +
          '<p class="hint" id="acEmailHint">To change the address on an account, write to ' + LS.mailLink(SITE.email, 'Change my email address', 'link') + '.</p></div>' +
        '<fieldset class="form-group"><legend class="flabel">Markets you follow</legend><div class="checkset" id="acMarkets">' +
          Auth.MARKET_CODES.map(function (code) {
            const on = Auth.marketList(u.market).indexOf(code) !== -1;
            return '<label class="checkset__item"><input type="checkbox" value="' + code + '"' + (on ? ' checked' : '') + '>' +
              '<span class="tag tag--' + REGIONS[code].slug + '">' + LS.esc(REGIONS[code].name) + '</span></label>';
          }).join('') +
        '</div><p class="hint">Only changes what is highlighted for you. Every report stays readable.</p></fieldset>' +
        '<div class="notice" id="savedNote" role="status" hidden></div>' +
        '<button class="btn" type="button" id="acSave">Save changes</button>' +
      '</div></section>' +

      '<section class="panel"><div class="panel__head"><h2>Sign in</h2></div><div class="panel__body">' +
        '<p class="small muted">Member since ' + (u.joined ? LS.fmtDate(String(u.joined).slice(0, 10)) : 'today') + '.</p>' +
        '<div class="row">' +
          '<button class="btn btn--ghost" type="button" id="acReset">' + LS.icon('mail') + 'Send a password reset link</button>' +
          '<button class="btn btn--ghost" type="button" data-signout>' + LS.icon('logout') + 'Sign out</button>' +
        '</div>' +
      '</div></section>' +

      '<section class="panel"><div class="panel__head"><h2>Your data</h2></div><div class="panel__body">' +
        '<p>You can take a copy of everything we hold about you, or delete it. See the <a class="link" href="privacy.html#rights">privacy policy</a> for what each covers.</p>' +
        '<div class="row">' +
          '<button class="btn btn--ghost" type="button" id="acExport">' + LS.icon('download') + 'Download my data</button>' +
          '<button class="btn btn--ghost" type="button" data-cookie-settings>Cookie settings</button>' +
        '</div>' +
        '<hr>' +
        '<h3>Delete your account</h3>' +
        '<p class="small">This permanently removes your sign in, your profile and photo, your saved reports, your reading history and any error reports linked to you. It cannot be undone. Published research is not affected.</p>' +
        '<button class="btn btn--danger" type="button" id="acDelete">Delete my account</button>' +
      '</div></section>';
  }

  /* --------------------------------------------------------------- router */
  function route() {
    const hash = (location.hash || '#overview').slice(1);
    let active = hash;
    let html;
    if (hash.indexOf('day=') === 0 && !isAdmin) {
      const date = decodeURIComponent(hash.slice(4));
      html = viewDay(date);
      active = null;
      paintTree(date);
    } else {
      if (!SECTIONS.some(function (s) { return s.id === hash; })) active = 'overview';
      html = isAdmin
        ? (active === 'metrics' ? viewAdminMetrics() : active === 'audience' ? viewAudience() : active === 'errors' ? viewErrors() : active === 'account' ? viewAccount() : viewAdminOverview())
        : (active === 'saved' ? viewSaved() : active === 'history' ? viewHistory() : active === 'account' ? viewAccount() : viewOverview());
      paintTree(null);
    }
    paintSideNav(active);
    main.innerHTML = html;
    const h1 = main.querySelector('h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); if (document.activeElement && document.activeElement !== document.body) h1.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
    if (active === 'account') wireAccount();
    if (active === 'saved') wireSaved();
    if (window.matchMedia('(max-width: 900px)').matches) collapseSide(true);
  }

  function wireSaved() {
    const list = document.getElementById('savedList');
    if (!list) return;
    list.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-unsave]');
      if (!btn) return;
      btn.disabled = true;
      btn.classList.add('is-busy');
      Auth.toggleSave(btn.getAttribute('data-unsave')).then(function (res) {
        if (!res.ok) {
          btn.disabled = false; btn.classList.remove('is-busy');
          LS.toast(res.error || 'That could not be removed.', 'err');
          return;
        }
        LS.toast('Removed from your saved reports.');
        route();
      });
    });
  }

  function wireAccount() {
    const MAX_PX = 256;
    const MAX_BYTES = 8 * 1024 * 1024;
    const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    let pendingAvatar;

    const fileInput = document.getElementById('acAvatarFile');
    const clearBtn = document.getElementById('acAvatarClear');
    const preview = document.getElementById('acAvatarPreview');
    const avatarErr = document.getElementById('acAvatarErr');

    function problem(msg) { avatarErr.innerHTML = LS.icon('alert') + '<span>' + LS.esc(msg) + '</span>'; avatarErr.hidden = false; }

    /* Decoded and redrawn in a canvas, so what is stored is always a fresh
       JPEG made here, never the uploaded bytes themselves. */
    function shrink(file) {
      return new Promise(function (resolve, reject) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('That file could not be read as an image.')); };
        img.onload = function () {
          URL.revokeObjectURL(url);
          if (img.width > 12000 || img.height > 12000) { reject(new Error('That image is too large. Use one under 12,000 pixels on each side.')); return; }
          const side = Math.min(img.width, img.height);
          const c = document.createElement('canvas');
          c.width = c.height = Math.min(side, MAX_PX);
          c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.85));
        };
        img.src = url;
      });
    }

    fileInput.addEventListener('change', function () {
      const file = fileInput.files && fileInput.files[0];
      avatarErr.hidden = true;
      if (!file) return;
      if (TYPES.indexOf(file.type) === -1) { problem('Choose a JPEG, PNG or WebP image.'); fileInput.value = ''; return; }
      if (file.size > MAX_BYTES) { problem('That image is over 8 MB. Choose a smaller one.'); fileInput.value = ''; return; }
      shrink(file).then(function (dataUrl) {
        pendingAvatar = dataUrl;
        preview.innerHTML = '<img class="avatar avatar--xl" src="' + dataUrl + '" alt="Your new photo, not saved yet" width="88" height="88">';
        clearBtn.hidden = false;
      }).catch(function (err) { problem(err.message); });
      fileInput.value = '';
    });

    clearBtn.addEventListener('click', function () {
      pendingAvatar = null;
      preview.innerHTML = LS.avatar({ name: user.name, email: user.email }, 'avatar--xl');
      clearBtn.hidden = true;
    });

    const saveBtn = document.getElementById('acSave');
    saveBtn.addEventListener('click', function () {
      const note = document.getElementById('savedNote');
      const name = document.getElementById('acName').value.trim();
      if (!name) { note.className = 'notice notice--err'; note.innerHTML = LS.icon('alert') + '<span>Your name cannot be empty.</span>'; note.hidden = false; return; }
      saveBtn.disabled = true;
      saveBtn.classList.add('is-busy');
      const changes = {
        name: name,
        market: Array.prototype.map.call(document.querySelectorAll('#acMarkets input:checked'), function (i) { return i.value; })
      };
      if (pendingAvatar !== undefined) changes.avatar = pendingAvatar;
      Auth.update(changes).then(function (res) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('is-busy');
        if (res && res.ok) {
          note.className = 'notice notice--ok';
          note.innerHTML = LS.icon('check') + '<span>Saved.</span>';
          pendingAvatar = undefined;
          LS.refreshAccount();
          paintUserCard();
        } else {
          note.className = 'notice notice--err';
          note.innerHTML = LS.icon('alert') + '<span>' + LS.esc((res && res.error) || 'That could not be saved.') + '</span>';
        }
        note.hidden = false;
      });
    });

    document.getElementById('acReset').addEventListener('click', function () {
      const btn = this;
      LS.confirm({ title: 'Send a reset link?', body: 'We will email a one time link to ' + user.email + '. You stay signed in here until you use it.', confirm: 'Send the link' })
        .then(function (yes) {
          if (!yes) return;
          btn.disabled = true;
          btn.classList.add('is-busy');
          Auth.sendPasswordReset().then(function (res) {
            btn.classList.remove('is-busy');
            btn.disabled = false;
            LS.toast(res.ok ? 'Reset link sent to ' + user.email + '. Check spam if it does not arrive.' : res.error, res.ok ? 'ok' : 'err');
          });
        });
    });

    document.getElementById('acExport').addEventListener('click', function () {
      const btn = this;
      btn.disabled = true;
      btn.classList.add('is-busy');
      Auth.exportData().then(function (res) {
        btn.disabled = false;
        btn.classList.remove('is-busy');
        if (!res.ok) { LS.toast(res.error, 'err'); return; }
        const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'leoside-my-data-' + LS.toISO(new Date()) + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        LS.toast('Your data has been downloaded as a JSON file.');
      });
    });

    document.getElementById('acDelete').addEventListener('click', function () {
      const btn = this;
      LS.confirm({
        title: 'Delete your account for good?',
        body: 'Your sign in, profile, photo, saved reports, reading history and linked error reports will be erased straight away. Download your data first if you want a copy. This cannot be undone.',
        confirm: 'Delete everything', cancel: 'Keep my account', danger: true,
        requireText: user.email
      }).then(function (yes) {
        if (!yes) return;
        btn.disabled = true;
        btn.classList.add('is-busy');
        Auth.deleteAccount().then(function (res) {
          if (!res.ok) {
            btn.disabled = false;
            btn.classList.remove('is-busy');
            LS.toast(res.error, 'err');
            return;
          }
          location.replace('/?deleted=1');
        });
      });
    });
  }

  /* ------------------------------------------------------ mobile sidebar
     Set up before the first route(), which collapses it on small screens. */
  const side = document.getElementById('dashSide');
  const toggle = document.getElementById('sideToggle');
  function collapseSide(on) {
    side.setAttribute('data-collapsed', String(on));
    toggle.setAttribute('aria-expanded', String(!on));
  }
  toggle.innerHTML = '<span>Dashboard menu</span>' + LS.icon('chevronDown');
  toggle.addEventListener('click', function () { collapseSide(side.getAttribute('data-collapsed') !== 'true'); });

  window.addEventListener('hashchange', route);
  route();
});
