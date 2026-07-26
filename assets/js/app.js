/* ==========================================================================
   Leoside Equity — shared shell: brand mark, header, footer, utilities
   Injects the chrome into every page so navigation lives in one file.
   ========================================================================== */

const LS = (function () {
  'use strict';

  /* ---------------------------------------------------------------- icons */
  const ICONS = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    bookmark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 4h12v17l-6-4-6 4z"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.6"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.2v.4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.2l3.2 2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.9 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.9H4a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 5.1 7.2L5 7.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/></svg>'
  };

  function icon(name) { return ICONS[name] || ''; }

  /* ------------------------------------------------------------ brand mark
     Front facing lion. The mane is a twenty point star, the muzzle is an
     upward chevron so the mark reads as a rising trend at small sizes.     */
  const MANE = '32,2 38.64,11.55 49.63,7.73 49.39,19.36 60.53,22.73 53.5,32 60.53,41.27 49.39,44.64 49.63,56.27 38.64,52.45 32,62 25.36,52.45 14.37,56.27 14.61,44.64 3.47,41.27 10.5,32 3.47,22.73 14.61,19.36 14.37,7.73 25.36,11.55';

  function mark(cls) {
    return (
      '<svg class="brand__mark ' + (cls || '') + '" viewBox="0 0 64 64" role="img" aria-label="Leoside Equity">' +
        '<g transform="translate(32 32) scale(.9) translate(-32 -32)">' +
          '<polygon class="mane" points="' + MANE + '" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>' +
          '<path class="face" d="M16.9 28.6C16.9 24.7 18 21.3 20 18.7L16.2 12.9c-.4-.7.3-1.5 1-1.2l8.6 3.3c1.9-.8 4-1.2 6.2-1.2s4.3.4 6.2 1.2l8.6-3.3c.7-.3 1.4.5 1 1.2L44 18.7c2 2.6 3.1 6 3.1 9.9 0 5.6-1.7 10.2-4.7 13.6-2.7 3-6.3 4.9-10.4 5.7-4.1-.8-7.7-2.7-10.4-5.7-3-3.4-4.7-8-4.7-13.6Z"/>' +
          '<path class="mane" d="M22.1 28.2c1.6-2.7 5.4-2.7 7 0-1.6 2.3-5.4 2.3-7 0ZM34.9 28.2c1.6-2.7 5.4-2.7 7 0-1.6 2.3-5.4 2.3-7 0Z" stroke="none"/>' +
          '<g class="ink" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M21.4 22.3 29.3 23.8M42.6 22.3 34.7 23.8" stroke-width="2.2"/>' +
            '<path d="M27 36.4 32 31l5 5.4" stroke-width="2.7"/>' +
            '<path d="M27.2 40.8c1.8 3 4 3 4.8.9.8 2.1 3 2.1 4.8-.9" stroke-width="1.9"/>' +
          '</g>' +
        '</g>' +
      '</svg>'
    );
  }

  function brand(href, sub) {
    return '<a class="brand" href="' + (href || 'index.html') + '">' + mark() +
      '<span><span class="brand__name">Leo<em>side</em> Equity</span>' +
      (sub === false ? '' : '<span class="brand__sub">The research desk</span>') +
      '</span></a>';
  }

  /* ------------------------------------------------------------- utilities */
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* Parse "YYYY-MM-DD" as a local date so the weekday never shifts by zone. */
  function parseDate(iso) {
    const p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(iso, style) {
    const d = parseDate(iso);
    if (style === 'short') return DAYS_S[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS_S[d.getMonth()];
    if (style === 'numeric') return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
    if (style === 'day') return DAYS_S[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0');
    if (style === 'monthYear') return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function marketForDate(iso) { return SITE.schedule[parseDate(iso).getDay()]; }
  function marketForToday() { return SITE.schedule[new Date().getDay()]; }
  function weekOfMonth(iso) { return Math.floor((parseDate(iso).getDate() - 1) / 7) + 1; }

  function reportUrl(id) { return 'report.html?id=' + encodeURIComponent(id); }
  function byId(id) { return REPORTS.find(function (r) { return r.id === id; }); }

  /* Flatten a report into plain paragraphs, used for excerpts and word counts. */
  function paragraphs(report) {
    const out = [];
    (report.body || []).forEach(function (s) {
      (s.p || []).forEach(function (t) { out.push(t); });
    });
    return out;
  }
  /* Supabase supplies word_count with the listing, so a locked report can
     still report its true length without shipping the text. Fall back to
     counting locally when the body is present. */
  function wordCount(report) {
    if (typeof report.wordCount === 'number') return report.wordCount;
    if (!report.body) return 0;
    return paragraphs(report).join(' ').split(/\s+/).filter(Boolean).length;
  }
  /* The free preview. Signed out visitors never receive more than this. */
  function preview(report, words) {
    const limit = words || SITE.freeWords;
    const all = paragraphs(report).join(' ').split(/\s+/).filter(Boolean);
    return all.slice(0, limit).join(' ') + (all.length > limit ? '…' : '');
  }
  function excerpt(report, words) {
    const all = (report.standfirst || '').split(/\s+/);
    return all.slice(0, words || 28).join(' ') + (all.length > (words || 28) ? '…' : '');
  }

  function marketTag(code) {
    const m = MARKETS[code];
    return '<span class="tag tag--' + code.toLowerCase() + '"><span class="dot"></span>' + m.short + '</span>';
  }
  function ratingTag(rating) {
    return '<span class="rating rating--' + rating.toLowerCase() + '">' + rating + '</span>';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  /* --------------------------------------------------------------- theming */
  function setTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    try { localStorage.setItem('leoside.theme', mode); } catch (e) {}
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.innerHTML = mode === 'dark' ? icon('sun') : icon('moon');
      btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }
  function currentTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }

  /* ---------------------------------------------------------------- header */
  function navLinks(page, user) {
    const signedIn = !!user;
    const isAdmin = !!(user && user.isAdmin);
    const dashboardForAll = !(typeof CONFIG !== 'undefined' && CONFIG.adminOnlyDashboard);

    const items = [
      { href: 'index.html',   label: 'Latest',  key: 'index' },
      { href: 'reports.html', label: 'Reports', key: 'reports' }
    ];

    /* The member dashboard belongs to every signed in reader. Admin does not. */
    if (signedIn && (dashboardForAll || isAdmin)) {
      items.push({ href: 'dashboard.html', label: 'Dashboard', key: 'dashboard' });
    }
    if (isAdmin) {
      items.push({ href: 'admin.html', label: 'Admin', key: 'admin', admin: true });
    }
    items.push({ href: 'about.html', label: 'About', key: 'about' });

    let html = items.map(function (i) {
      return '<a href="' + i.href + '"' + (i.key === page ? ' aria-current="page"' : '') +
        (i.admin ? ' class="nav-admin"' : '') + '>' + i.label + '</a>';
    }).join('');
    /* On the narrowest screens the header buttons are hidden, so the same two
       actions live at the bottom of the menu instead. */
    if (!signedIn) {
      html += '<a class="nav-auth" href="signin.html">Sign in</a>' +
              '<a class="nav-auth" href="signup.html">Create a free account</a>';
    }
    return html;
  }

  function mountHeader(page) {
    const host = document.getElementById('siteHeader');
    if (!host) return;
    const user = Auth.current();
    const right = user
      ? '<button class="user-pill" id="userPill" aria-haspopup="true" aria-expanded="false">' +
          '<span class="avatar">' + esc(Auth.initials(user)) + '</span>' +
          '<span class="user-pill__mail">' + esc(user.email) + '</span>' +
        '</button>'
      : '<a class="btn btn--ghost btn--sm" href="signin.html">Sign in</a>' +
        '<a class="btn btn--sm" href="signup.html">Create free account</a>';

    host.className = 'site-header';
    host.innerHTML =
      '<div class="wrap site-header__bar">' +
        brand('index.html') +
        '<nav class="site-nav" id="siteNav" aria-label="Primary">' + navLinks(page, user) + '</nav>' +
        '<div class="site-header__actions">' +
          '<button class="icon-btn" id="themeToggle" aria-label="Switch theme"></button>' +
          right +
          '<button class="icon-btn nav-toggle" id="navToggle" aria-label="Open menu" aria-expanded="false">' + icon('menu') + '</button>' +
        '</div>' +
      '</div>' +
      (user ? userMenu(user) : '');

    setTheme(currentTheme());
    wireHeader(!!user);
  }

  function userMenu(user) {
    return '<div class="menu" id="userMenu" hidden role="menu">' +
      '<div class="menu__head">' +
        '<div class="name">' + esc(user.name || 'Member') +
          (user.isAdmin ? ' <span class="tag tag--brass" style="margin-left:.35rem">Admin</span>' : '') + '</div>' +
        '<div class="mail">' + esc(user.email) + '</div>' +
      '</div>' +
      (user.isAdmin ? '<a href="admin.html" role="menuitem">' + icon('doc') + 'Publish a report</a>' : '') +
      '<a href="dashboard.html" role="menuitem">' + icon('grid') + 'Dashboard</a>' +
      '<a href="dashboard.html#saved" role="menuitem">' + icon('bookmark') + 'Saved reports</a>' +
      '<a href="dashboard.html#account" role="menuitem">' + icon('settings') + 'Account settings</a>' +
      '<button type="button" id="signOutBtn" role="menuitem">' + icon('logout') + 'Sign out</button>' +
    '</div>';
  }

  function wireHeader(signedIn) {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', function () {
      setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });

    const navBtn = document.getElementById('navToggle');
    const nav = document.getElementById('siteNav');
    if (navBtn && nav) {
      const sync = function () {
        const mobile = window.matchMedia('(max-width: 780px)').matches;
        if (!mobile) { nav.hidden = false; navBtn.setAttribute('aria-expanded', 'false'); navBtn.innerHTML = icon('menu'); }
        else if (navBtn.getAttribute('aria-expanded') !== 'true') { nav.hidden = true; }
      };
      sync();
      window.addEventListener('resize', sync);
      navBtn.addEventListener('click', function () {
        const open = navBtn.getAttribute('aria-expanded') === 'true';
        navBtn.setAttribute('aria-expanded', String(!open));
        nav.hidden = open;
        navBtn.innerHTML = open ? icon('menu') : icon('close');
      });
    }

    if (signedIn) {
      const pill = document.getElementById('userPill');
      const menu = document.getElementById('userMenu');
      if (pill && menu) {
        pill.addEventListener('click', function (e) {
          e.stopPropagation();
          const open = !menu.hidden;
          menu.hidden = open;
          pill.setAttribute('aria-expanded', String(!open));
        });
        document.addEventListener('click', function (e) {
          if (!menu.hidden && !menu.contains(e.target)) { menu.hidden = true; pill.setAttribute('aria-expanded', 'false'); }
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menu.hidden = true; });
      }
      const out = document.getElementById('signOutBtn');
      if (out) out.addEventListener('click', function () { Auth.signOut(); location.href = 'index.html'; });
    }
  }

  /* ------------------------------------------------- publishing day strip */
  /* The week always runs Sunday to Saturday. Which chip is marked as today,
     and the date printed alongside it, come from new Date(), which is the
     reader's own device clock and timezone. Nothing here is hard coded and
     nothing needs updating by hand once the site is live. */
  function scheduleStrip() {
    const now = new Date();
    const todayIdx = now.getDay();          // 0 = Sunday through 6 = Saturday

    let dots = '';
    for (let i = 0; i < 7; i++) {
      const code = SITE.schedule[i];
      dots += '<span class="daydot daydot--' + code.toLowerCase() + (i === todayIdx ? ' daydot--today' : '') + '"' +
        ' title="' + DAYS[i] + ' · ' + MARKETS[code].name + '">' +
        '<span class="sq"></span>' + DAYS_S[i] + '</span>';
    }

    const m = MARKETS[SITE.schedule[todayIdx]];
    const today = DAYS[todayIdx] + ' ' + now.getDate() + ' ' + MONTHS_S[now.getMonth()] + ' ' + now.getFullYear();

    return '<div class="schedule-strip"><div class="wrap schedule-strip__inner">' +
      '<span class="schedule-strip__label">Publishing calendar</span>' +
      '<div class="daydots">' + dots + '</div>' +
      '<span class="schedule-strip__today">' + today + ' &nbsp;·&nbsp; Today covers <b>' + m.name + '</b></span>' +
    '</div></div>';
  }
  function mountSchedule() {
    const host = document.getElementById('scheduleStrip');
    if (host) host.outerHTML = scheduleStrip();
  }

  /* ---------------------------------------------------------------- footer */
  function mountFooter() {
    const host = document.getElementById('siteFooter');
    if (!host) return;
    const year = new Date().getFullYear();
    host.className = 'site-footer on-ink';
    host.innerHTML =
      '<div class="wrap">' +
        '<div class="footer-grid">' +
          '<div class="footer-about">' +
            brand('index.html') +
            '<p>A written research report every day. Indian markets Sunday through Wednesday, United States markets Thursday through Saturday.</p>' +
          '</div>' +
          '<div><h5>Research</h5><ul>' +
            '<li><a href="reports.html">All reports</a></li>' +
            '<li><a href="reports.html?market=IN">Indian coverage</a></li>' +
            '<li><a href="reports.html?market=US">US coverage</a></li>' +
            '<li><a href="method.html">Our research method</a></li>' +
          '</ul></div>' +
          '<div><h5>Account</h5><ul>' +
            '<li><a href="signup.html">Create free account</a></li>' +
            '<li><a href="signin.html">Sign in</a></li>' +
            '<li><a href="dashboard.html">Your dashboard</a></li>' +
            '<li><a href="about.html">About Leoside</a></li>' +
          '</ul></div>' +
          '<div><h5>Legal</h5><ul>' +
            '<li><a href="terms.html">Terms of service</a></li>' +
            '<li><a href="privacy.html">Privacy policy</a></li>' +
            '<li><a href="disclaimer.html">Research disclaimer</a></li>' +
            '<li><a href="mailto:' + SITE.email + '">' + SITE.email + '</a></li>' +
          '</ul></div>' +
        '</div>' +
        '<div class="footer-legal">' +
          '<b>Important.</b> Leoside Equity publishes general market commentary and educational analysis. Nothing on this site is personalised investment advice, an offer to buy or sell any security, or a recommendation tailored to your circumstances. We are not a registered investment adviser or research analyst in any jurisdiction. Markets carry risk, including the risk of losing the full amount invested. Do your own research and speak to a licensed professional before acting on anything you read here.' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>&copy; ' + year + ' ' + SITE.name + '. All rights reserved.</span>' +
          '<span><a href="terms.html">Terms</a> &nbsp;·&nbsp; <a href="privacy.html">Privacy</a> &nbsp;·&nbsp; <a href="disclaimer.html">Disclaimer</a></span>' +
        '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------ page setup */
  /* ------------------------------------------------------- cookie banner
     Everything this site stores is strictly necessary: the sign in session,
     the light or dark choice, and the saved reports list. There is no
     advertising, no analytics and no third party tracker, so there is nothing
     here that could be switched off and still leave a working site. That is
     why declining ends in a stop screen rather than a reduced experience:
     without somewhere to keep a session there is no signing in, and without
     signing in there are no reports to read.

     Where the answer is kept, and why the two differ:

       Accepted while signed in  -> localStorage. Permanent. Never asked again
                                    on this browser, which is what an account
                                    holder should expect.
       Accepted while signed out -> sessionStorage. Asked again next visit,
                                    since there is no account to attach a
                                    lasting preference to.
       Declined                  -> sessionStorage only. Never written to
                                    long term storage, because writing a
                                    permanent record for somebody who just
                                    refused permanent records is not on. */
  const COOKIE_KEY = 'leoside.cookies';

  function cookieChoice() {
    try {
      if (localStorage.getItem(COOKIE_KEY) === 'accepted') return 'accepted';
      return sessionStorage.getItem(COOKIE_KEY);
    } catch (e) {
      /* Storage blocked entirely. Nothing to ask about and nothing to store. */
      return 'unavailable';
    }
  }

  function rememberChoice(choice, signedIn) {
    try {
      if (choice === 'accepted' && signedIn) localStorage.setItem(COOKIE_KEY, 'accepted');
      sessionStorage.setItem(COOKIE_KEY, choice);
    } catch (e) {}
  }

  function showCookieStop() {
    const stop = document.createElement('div');
    stop.className = 'cookie-stop';
    stop.setAttribute('role', 'dialog');
    stop.setAttribute('aria-modal', 'true');
    stop.setAttribute('aria-label', 'Storage required');
    stop.innerHTML =
      '<div class="cookie-stop__card">' +
        '<h2>Leoside Equity needs browser storage</h2>' +
        '<p>We only store what the site cannot run without: your sign in session, ' +
        'your light or dark preference, and the reports you save. There is no advertising, ' +
        'no analytics and no third party tracking, and nothing is ever sold or shared.</p>' +
        '<p>Because a sign in has to be remembered somewhere, there is no version of the ' +
        'site that works without it. You can read what we store, and why, in the ' +
        '<a class="link" href="privacy.html">privacy policy</a>.</p>' +
        '<div class="cookie-stop__actions">' +
          '<button class="btn btn--lg" type="button" id="cookieReconsider">Accept and continue</button>' +
          '<a class="btn btn--quiet btn--lg" href="https://www.google.com">Leave the site</a>' +
        '</div>' +
      '</div>';

    document.body.appendChild(stop);
    document.documentElement.style.overflow = 'hidden';

    stop.querySelector('#cookieReconsider').addEventListener('click', function () {
      rememberChoice('accepted', !!(typeof Auth !== 'undefined' && Auth.current && Auth.current()));
      document.documentElement.style.overflow = '';
      stop.remove();
    });
  }

  function mountCookieBanner() {
    const choice = cookieChoice();
    if (choice === 'accepted' || choice === 'unavailable') return;
    if (choice === 'declined') { showCookieStop(); return; }

    const signedIn = !!(typeof Auth !== 'undefined' && Auth.current && Auth.current());

    const bar = document.createElement('div');
    bar.className = 'cookie-bar';
    bar.setAttribute('role', 'dialog');
    bar.setAttribute('aria-live', 'polite');
    bar.setAttribute('aria-label', 'Cookie notice');
    bar.innerHTML =
      '<div class="cookie-bar__inner">' +
        '<p class="cookie-bar__text">' +
          'We use a small amount of browser storage to keep you signed in, remember your ' +
          'theme and hold your saved reports. No advertising, no analytics, no tracking, ' +
          'and nothing sold on. See the <a class="link" href="privacy.html">privacy policy</a>.' +
        '</p>' +
        '<div class="cookie-bar__actions">' +
          '<button class="btn btn--sm" type="button" id="cookieAccept">Accept and continue</button>' +
          '<button class="btn btn--quiet btn--sm" type="button" id="cookieDecline">Decline</button>' +
        '</div>' +
      '</div>';

    /* Appending is all that is needed. The bar's resting position is on
       screen, so there is no state it can get stuck in. */
    document.body.appendChild(bar);

    function close() {
      bar.setAttribute('data-dismissed', 'true');
      setTimeout(function () { bar.remove(); }, 220);
    }

    bar.querySelector('#cookieAccept').addEventListener('click', function () {
      rememberChoice('accepted', signedIn);
      close();
    });

    bar.querySelector('#cookieDecline').addEventListener('click', function () {
      rememberChoice('declined', signedIn);
      close();
      showCookieStop();
    });
  }

  function init(page) {
    mountHeader(page);
    mountSchedule();
    mountFooter();
    mountCookieBanner();
  }

  return {
    icon: icon, mark: mark, brand: brand,
    MONTHS: MONTHS, MONTHS_S: MONTHS_S, DAYS: DAYS, DAYS_S: DAYS_S,
    parseDate: parseDate, toISO: toISO, fmtDate: fmtDate,
    marketForDate: marketForDate, marketForToday: marketForToday, weekOfMonth: weekOfMonth,
    reportUrl: reportUrl, byId: byId,
    paragraphs: paragraphs, wordCount: wordCount, preview: preview, excerpt: excerpt,
    marketTag: marketTag, ratingTag: ratingTag, esc: esc, paragraphs: paragraphs,
    setTheme: setTheme, currentTheme: currentTheme,
    scheduleStrip: scheduleStrip, init: init
  };
})();

/* Restore the saved theme before first paint where possible. */
(function () {
  try {
    const saved = localStorage.getItem('leoside.theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
