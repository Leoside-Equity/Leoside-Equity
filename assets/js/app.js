/* ==========================================================================
   Leoside Equity: the shell shared by every page
   --------------------------------------------------------------------------
   Header, mobile menu, footer, search, cookie choice, dialogs, toasts, the
   floating contact and back to top buttons, reading progress, copy buttons,
   the age check for members who signed in with Google, and error reporting.
   Also the date, market and formatting helpers every page uses.
   ========================================================================== */

const LS = (function () {
  'use strict';

  /* ---------------------------------------------------------------- icons
     Drawn for this site: square line ends and mitred corners, one weight. */
  const P = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true" focusable="false">';
  const ICONS = {
    menu: P + '<path d="M4 7h16M4 12h16M4 17h16"/></svg>',
    close: P + '<path d="M6 6l12 12M18 6L6 18"/></svg>',
    search: P + '<circle cx="10.5" cy="10.5" r="6"/><path d="M15.5 15.5l4.5 4.5"/></svg>',
    sun: P + '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    moon: P + '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>',
    lock: P + '<path d="M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    arrow: P + '<path d="M4 12h15M14 7l5 5-5 5"/></svg>',
    up: P + '<path d="M12 20V5M7 10l5-5 5 5"/></svg>',
    chevron: P + '<path d="M9 6l6 6-6 6"/></svg>',
    chevronDown: P + '<path d="M6 9l6 6 6-6"/></svg>',
    user: P + '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.5 4-6.5 8-6.5s7 2 8 6.5"/></svg>',
    logout: P + '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/></svg>',
    bookmark: P + '<path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
    bookmarkFill: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter" aria-hidden="true" focusable="false"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>',
    doc: P + '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h5"/></svg>',
    grid: P + '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></svg>',
    settings: P + '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><path d="M13 5h4v4h-4zM7 15h4v4H7z"/></svg>',
    clock: P + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    calendar: P + '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/></svg>',
    mail: P + '<path d="M3 5h18v14H3z"/><path d="M3 6l9 7 9-7"/></svg>',
    alert: P + '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.5"/></svg>',
    info: P + '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
    check: P + '<path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    download: P + '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/></svg>',
    share: P + '<path d="M12 15V4M8 8l4-4 4 4M5 12v8h14v-8"/></svg>',
    print: P + '<path d="M7 9V3h10v6M5 17H3V9h18v8h-2M7 14h10v7H7z"/></svg>',
    link: P + '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    copy: P + '<path d="M8 8h12v12H8z"/><path d="M16 8V4H4v12h4"/></svg>',
    chat: P + '<path d="M4 5h16v11H9l-5 4z"/></svg>',
    pause: P + '<path d="M8 5v14M16 5v14"/></svg>',
    play: P + '<path d="M7 5l12 7-12 7z"/></svg>'
  };
  function icon(name) { return ICONS[name] || ''; }

  /* ------------------------------------------------------------ the mark
     The company's own lion artwork. Scaled copies keep a 32 pixel mark from
     downloading the full file; logo.png is the original. On light surfaces
     it sits on a small ink tile, because the pale gold washes out on cream. */
  function mark(cls) {
    return '<span class="brand__mark ' + (cls || '') + '" aria-hidden="true">' +
      '<img src="/assets/img/logo-64.webp" srcset="/assets/img/logo-64.webp 1x, /assets/img/logo-128.webp 2x" ' +
      'alt="" width="32" height="32" decoding="async"></span>';
  }

  /* The name is set in two colours, "side" in gold, with the desk's line
     under it. The link's label reads the name once for screen readers. */
  function brand(href) {
    return '<a class="brand" href="' + (href || '/') + '" aria-label="Leoside Equity, home">' + mark() +
      '<span class="brand__text"><span class="brand__name">Leo<span class="brand__split">side</span> Equity</span>' +
      '<span class="brand__tag">The research desk</span></span></a>';
  }

  /* ------------------------------------------------------------ utilities */
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const DAYS_S = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  /* "YYYY-MM-DD" as local midnight, so the weekday never shifts by zone. */
  function parseDate(iso) {
    const p = String(iso).slice(0, 10).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function toISO(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(iso, style) {
    const d = parseDate(iso);
    if (isNaN(d)) return '';
    if (style === 'short') return DAYS_S[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_S[d.getMonth()];
    if (style === 'medium') return d.getDate() + ' ' + MONTHS_S[d.getMonth()] + ' ' + d.getFullYear();
    if (style === 'day') return DAYS_S[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0');
    if (style === 'monthYear') return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function marketForDate(iso) { return SITE.schedule[parseDate(iso).getDay()]; }
  function marketForToday() { return SITE.schedule[new Date().getDay()]; }
  function weekOfMonth(iso) { return Math.floor((parseDate(iso).getDate() - 1) / 7) + 1; }

  /* Old slot codes map onto their country; anything else unknown falls back
     to Sunday's market and says so once in the console. */
  const LEGACY = { IN_MACRO: 'IN', IN_SECTOR: 'IN' };
  const warned = {};
  function market(code) {
    if (REGIONS[code]) return REGIONS[code];
    if (LEGACY[code] && REGIONS[LEGACY[code]]) return REGIONS[LEGACY[code]];
    if (!warned[code]) { warned[code] = true; console.warn('[Leoside] unknown market code "' + code + '"'); }
    return REGIONS[SITE.schedule[0]];
  }
  function hasValuation(code) { return !!market(code).valuation; }

  function reportUrl(id) { return 'report.html?id=' + encodeURIComponent(id); }
  function byId(id) { return REPORTS.find(function (r) { return r.id === id; }); }

  function paragraphs(report) {
    const out = [];
    (report.body || []).forEach(function (s) { (s.p || []).forEach(function (t) { out.push(t); }); });
    return out;
  }
  function wordCount(report) {
    if (typeof report.wordCount === 'number') return report.wordCount;
    if (!report.body) return 0;
    return paragraphs(report).join(' ').split(/\s+/).filter(Boolean).length;
  }
  function preview(report, words) {
    const limit = words || SITE.freeWords;
    const all = paragraphs(report).join(' ').split(/\s+/).filter(Boolean);
    return all.slice(0, limit).join(' ') + (all.length > limit ? '…' : '');
  }

  function marketTag(code) {
    const m = market(code);
    return '<span class="tag tag--' + m.slug + '">' + esc(m.name) + '</span>';
  }
  function ratingTag(rating) {
    const label = String(rating || '').trim();
    if (!label) return '';
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return '<span class="rating rating--' + slug + '" title="Valuation stance: how the market price compared with our estimate of value when this was written. Not a recommendation to buy or sell.">' +
      esc(label) + '</span>';
  }

  function mailHref(subject) {
    return 'mailto:' + SITE.email + (subject ? '?subject=' + encodeURIComponent(subject) : '');
  }
  function mailLink(label, subject, cls) {
    return '<a' + (cls ? ' class="' + cls + '"' : '') + ' href="' + mailHref(subject) + '">' + esc(label || SITE.email) + '</a>';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function reducedMotion() {
    return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* Clipboard with a selection based fallback for insecure contexts. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }
  function legacyCopy(text) {
    try {
      const f = document.createElement('textarea');
      f.value = text; f.setAttribute('readonly', '');
      f.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(f); f.select();
      const ok = document.execCommand('copy');
      f.remove();
      return ok;
    } catch (e) { return false; }
  }

  /* --------------------------------------------------------------- theme */
  function currentTheme() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  /* Saved only when someone presses the switch. Until then the site keeps
     following the system setting, including when it changes at sunset. */
  function setTheme(mode, remember) {
    document.documentElement.setAttribute('data-theme', mode);
    if (remember) { try { localStorage.setItem('leoside.theme', mode); } catch (e) {} }
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.innerHTML = mode === 'dark' ? icon('sun') : icon('moon');
      btn.setAttribute('aria-label', mode === 'dark' ? 'Use the light theme' : 'Use the dark theme');
      btn.setAttribute('aria-pressed', String(mode === 'dark'));
    });
    /* The browser's own toolbar follows the page colour of the chosen theme,
       not the system one, once someone has picked. */
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute('content', mode === 'dark' ? '#08090B' : '#F6F4EF');
    });
  }

  /* -------------------------------------------------------------- header */
  let pageKey = '';

  function navItems(user) {
    const items = [
      { href: '/',   label: 'Latest',  key: 'index' },
      { href: 'reports.html', label: 'Reports', key: 'reports' },
      { href: 'method.html',  label: 'Method',  key: 'method' },
      { href: 'about.html',   label: 'About',   key: 'about' }
    ];
    const everyone = !(typeof CONFIG !== 'undefined' && CONFIG.adminOnlyDashboard);
    if (user && (everyone || user.isAdmin)) items.push({ href: 'dashboard.html', label: 'Dashboard', key: 'dashboard' });
    if (user && user.isAdmin) items.push({ href: 'admin.html', label: 'Publish', key: 'admin', admin: true });
    return items;
  }

  function navLinks(user) {
    return navItems(user).map(function (i) {
      return '<a href="' + i.href + '"' + (i.key === pageKey ? ' aria-current="page"' : '') +
        (i.admin ? ' class="nav-admin"' : '') + '>' + i.label + '</a>';
    }).join('');
  }

  function displayName(user) {
    const name = String((user && user.name) || '').trim();
    if (name) return name;
    return String((user && user.email) || '').split('@')[0] || 'Member';
  }

  /* Only an inline JPEG, PNG or WebP data URI is ever drawn as a photo. */
  function avatar(user, cls) {
    const src = user && user.avatar;
    if (src && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(src)) {
      return '<img class="avatar ' + (cls || '') + '" src="' + src + '" alt="" width="30" height="30">';
    }
    return '<span class="avatar ' + (cls || '') + '" aria-hidden="true">' + esc(Auth.initials(user)) + '</span>';
  }

  function accountHtml(user) {
    if (!user) {
      return '<a class="btn btn--ghost btn--sm" href="signin.html">Sign in</a>' +
             '<a class="btn btn--sm" href="signup.html">Create account</a>';
    }
    return '<button class="account-btn" type="button" id="accountBtn" aria-haspopup="menu" aria-expanded="false" aria-controls="accountMenu">' +
        avatar(user) + '<span class="account-btn__name">' + esc(displayName(user)) + '</span>' +
        '<span class="sr-only">, account menu</span></button>' +
      '<div class="menu" id="accountMenu" role="menu" hidden>' +
        '<div class="menu__head"><div class="name">' + esc(displayName(user)) + '</div><div class="mail">' + esc(user.email) + '</div></div>' +
        (user.isAdmin ? '<a href="admin.html" role="menuitem">' + icon('doc') + 'Publish a report</a>' : '') +
        '<a href="dashboard.html" role="menuitem">' + icon('grid') + 'Dashboard</a>' +
        (user.isAdmin ? '' : '<a href="dashboard.html#saved" role="menuitem">' + icon('bookmark') + 'Saved reports</a>') +
        '<a href="dashboard.html#account" role="menuitem">' + icon('settings') + 'Account and privacy</a>' +
        '<button type="button" role="menuitem" data-signout>' + icon('logout') + 'Sign out</button>' +
      '</div>';
  }

  function mountHeader() {
    const host = document.getElementById('siteHeader');
    if (!host) return;
    const user = Auth.current();
    host.className = 'site-header';
    host.innerHTML =
      '<div class="wrap site-header__bar">' +
        brand('/') +
        '<nav class="site-nav" aria-label="Primary">' + navLinks(user) + '</nav>' +
        '<div class="site-header__actions">' +
          '<button class="search-btn" type="button" data-search aria-keyshortcuts="/ Control+K" aria-label="Search reports and pages">' +
            icon('search') + '<span>Search</span><kbd aria-hidden="true">/</kbd></button>' +
          '<button class="icon-btn" type="button" data-theme-toggle></button>' +
          '<span id="accountSlot" class="site-header__account">' + accountHtml(user) + '</span>' +
          '<button class="icon-btn nav-toggle" type="button" id="navToggle" aria-expanded="false" aria-controls="sheet" aria-label="Open the menu">' + icon('menu') + '</button>' +
        '</div>' +
      '</div>' +
      '<div class="sheet" id="sheet" hidden>' + sheetHtml(user) + '</div>';
    setTheme(currentTheme());
    wireAccount();
  }

  function sheetHtml(user) {
    return '<nav aria-label="Menu">' + navLinks(user) + '</nav>' +
      '<div class="sheet__minor">' +
        '<a href="about.html#faq">Questions</a><a href="privacy.html#cookies">Cookies</a>' +
        '<a href="accessibility.html">Accessibility</a><a href="' + mailHref('Hello') + '">Contact</a>' +
        '<a href="terms.html">Terms</a><a href="privacy.html">Privacy</a>' +
        '<a href="disclaimer.html">Disclaimer</a><a href="copyright.html">Copyright</a>' +
      '</div>' +
      '<div class="sheet__actions">' +
        (user
          ? '<a class="btn btn--ghost" href="dashboard.html#account">Account</a><button class="btn btn--ghost" type="button" data-signout>Sign out</button>'
          : '<a class="btn" href="signup.html">Create a free account</a><a class="btn btn--ghost" href="signin.html">Sign in</a>') +
        '<button class="icon-btn" type="button" data-theme-toggle></button>' +
      '</div>';
  }

  /* Re-renders only the parts that depend on who is signed in, so a name or
     photo change shows at once without re-mounting the page. */
  function refreshAccount() {
    const user = Auth.current();
    const slot = document.getElementById('accountSlot');
    if (slot) slot.innerHTML = accountHtml(user);
    const sheet = document.getElementById('sheet');
    if (sheet) sheet.innerHTML = sheetHtml(user);
    setTheme(currentTheme());
    wireAccount();
  }

  function wireAccount() {
    const btn = document.getElementById('accountBtn');
    const menu = document.getElementById('accountMenu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      if (open) { const first = menu.querySelector('[role="menuitem"]'); if (first) first.focus(); }
    });
    menu.addEventListener('keydown', function (e) {
      const items = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
      const at = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(at + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(at - 1 + items.length) % items.length].focus(); }
      if (e.key === 'Escape') { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
    });
  }

  function closeMenus() {
    const menu = document.getElementById('accountMenu');
    const btn = document.getElementById('accountBtn');
    if (menu && !menu.hidden) { menu.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); }
  }

  function setSheet(open) {
    const sheet = document.getElementById('sheet');
    const toggle = document.getElementById('navToggle');
    if (!sheet || !toggle) return;
    sheet.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close the menu' : 'Open the menu');
    toggle.innerHTML = open ? icon('close') : icon('menu');
    document.body.classList.toggle('sheet-open', open);
  }

  /* One set of document level listeners for the life of the page. */
  function wireGlobal() {
    document.addEventListener('click', function (e) {
      const t = e.target;
      if (t.closest('[data-theme-toggle]')) { setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true); return; }
      if (t.closest('#navToggle')) { setSheet(document.getElementById('sheet').hidden); return; }
      if (t.closest('[data-search]')) { e.preventDefault(); openSearch(); return; }
      if (t.closest('[data-signout]')) { signOutFlow(); return; }
      if (t.closest('[data-cookie-settings]')) { e.preventDefault(); showConsent(true); return; }
      if (t.closest('[data-print]')) { window.print(); return; }
      const copyBtn = t.closest('[data-copy], [data-copy-url]');
      if (copyBtn) {
        const text = copyBtn.hasAttribute('data-copy-url') ? location.href.split('#')[0] : copyBtn.getAttribute('data-copy');
        copyText(text).then(function (ok) {
          toast(ok ? (copyBtn.getAttribute('data-copied') || 'Copied to the clipboard.') : 'Copying was blocked. Select the text and copy it by hand.', ok ? 'ok' : 'err');
        });
        return;
      }
      if (t.closest('#sheet a')) { setSheet(false); }
      if (!t.closest('#accountMenu')) closeMenus();
    });

    document.addEventListener('keydown', function (e) {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName) ||
        (document.activeElement && document.activeElement.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) { e.preventDefault(); openSearch(); return; }
      if (e.key === '/' && !typing && !document.querySelector('dialog[open]')) { e.preventDefault(); openSearch(); return; }
      if (e.key === 'Escape') {
        closeMenus();
        const sheet = document.getElementById('sheet');
        if (sheet && !sheet.hidden) { setSheet(false); document.getElementById('navToggle').focus(); }
        const panel = document.getElementById('contactPanel');
        if (panel && !panel.hidden) toggleContact(false);
      }
    });

    const wide = window.matchMedia('(min-width: 901px)');
    const onWide = function () { if (wide.matches) setSheet(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);

    /* Follow the system theme live, unless the reader has picked one. */
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = function () {
      let saved = null;
      try { saved = localStorage.getItem('leoside.theme'); } catch (e) {}
      if (saved !== 'light' && saved !== 'dark') setTheme(dark.matches ? 'dark' : 'light');
    };
    if (dark.addEventListener) dark.addEventListener('change', onScheme); else if (dark.addListener) dark.addListener(onScheme);
  }

  function signOutFlow() {
    confirmDialog({
      title: 'Sign out?',
      body: 'You can sign back in at any time. Nothing you have saved is lost.',
      confirm: 'Sign out'
    }).then(function (yes) {
      if (!yes) return;
      Promise.resolve(Auth.signOut()).then(function () { location.href = '/'; });
    });
  }

  /* -------------------------------------------------------------- footer */
  function mountFooter() {
    const host = document.getElementById('siteFooter');
    if (!host) return;
    const year = new Date().getFullYear();
    const user = Auth.current();
    host.className = 'site-footer';
    host.innerHTML =
      '<div class="wrap">' +
        '<div class="footer-grid">' +
          '<div class="footer-about">' + brand('/') +
            '<p>' + esc(SITE.tagline) + ' Free to read with an account.</p>' +
            '<p id="installSlot"></p>' +
          '</div>' +
          '<nav aria-label="Research"><h2>Research</h2><ul>' +
            '<li><a href="reports.html">All reports</a></li>' +
            '<li><a href="reports.html?region=US">United States</a></li>' +
            '<li><a href="reports.html?region=UK">United Kingdom</a></li>' +
            '<li><a href="reports.html?region=IN">India</a></li>' +
            '<li><a href="method.html">Research method</a></li>' +
          '</ul></nav>' +
          '<nav aria-label="Company"><h2>Leoside</h2><ul>' +
            '<li><a href="about.html">About</a></li>' +
            '<li><a href="about.html#faq">Questions</a></li>' +
            '<li><a href="' + mailHref('Hello') + '">Contact</a></li>' +
            '<li><a href="accessibility.html">Accessibility statement</a></li>' +
            '<li>' + (user ? '<a href="dashboard.html">Your dashboard</a>' : '<a href="signup.html">Create a free account</a>') + '</li>' +
          '</ul></nav>' +
          '<nav aria-label="Legal"><h2>Legal</h2><ul>' +
            '<li><a href="terms.html">Terms of service</a></li>' +
            '<li><a href="privacy.html">Privacy policy</a></li>' +
            '<li><button class="linklike" type="button" data-cookie-settings>Cookie settings</button></li>' +
            '<li><a href="disclaimer.html">Research disclaimer</a></li>' +
            '<li><a href="copyright.html">Copyright and takedown</a></li>' +
          '</ul></nav>' +
        '</div>' +
        '<p class="footer-legal"><strong>Not investment advice.</strong> Leoside Equity publishes general commentary and educational analysis. Nothing here is a personal recommendation or an offer to buy or sell any security. Leoside Equity is not registered with SEBI, the SEC, FINRA or the FCA. You can lose money investing, including all of it. Read the <a href="disclaimer.html">research disclaimer</a>.</p>' +
        '<div class="footer-bottom">' +
          '<span>&copy; ' + year + ' ' + esc(SITE.name) + '. All rights reserved.</span>' +
          '<span><a href="' + mailHref('Hello') + '">' + esc(SITE.email) + '</a></span>' +
        '</div>' +
      '</div>';
  }

  /* -------------------------------------------------------------- search
     Searches every published report's headline, company, ticker, sector and
     summary, plus the site's own pages. Nothing leaves the browser. */
  const PAGES = [
    ['Latest research', '/', 'home newest report week markets'],
    ['All reports', 'reports.html', 'archive filter search sector market'],
    ['Research method', 'method.html', 'how research is done framework valuation moat catalyst'],
    ['About Leoside Equity', 'about.html', 'about questions faq who contact'],
    ['Questions and answers', 'about.html#faq', 'faq advice registered positions share republish'],
    ['Accessibility statement', 'accessibility.html', 'accessibility wcag screen reader keyboard'],
    ['Terms of service', 'terms.html', 'terms legal agreement rules account'],
    ['Privacy policy', 'privacy.html', 'privacy data gdpr dpdp cookies delete export supabase'],
    ['Research disclaimer', 'disclaimer.html', 'disclaimer not advice risk valuation stance'],
    ['Copyright and takedown', 'copyright.html', 'copyright dmca takedown notice'],
    ['Create a free account', 'signup.html', 'sign up register join'],
    ['Sign in', 'signin.html', 'login log in password'],
    ['Your dashboard', 'dashboard.html', 'saved history account settings delete export']
  ];

  let searchDlg = null;
  function openSearch() {
    if (!searchDlg) {
      searchDlg = document.createElement('dialog');
      searchDlg.className = 'dlg search';
      searchDlg.setAttribute('aria-label', 'Search');
      searchDlg.innerHTML =
        '<div class="search__bar">' + icon('search') +
          '<label class="sr-only" for="searchInput">Search reports and pages</label>' +
          '<input id="searchInput" type="search" autocomplete="off" spellcheck="false" placeholder="Company, ticker, sector or page" role="combobox" aria-expanded="true" aria-controls="searchResults" aria-autocomplete="list">' +
          '<button class="icon-btn" type="button" data-close aria-label="Close search">' + icon('close') + '</button>' +
        '</div>' +
        '<ul class="search__results" id="searchResults" role="listbox" aria-label="Results"></ul>' +
        '<p class="search__foot" aria-hidden="true"><span><kbd>&uarr;</kbd> <kbd>&darr;</kbd> to move</span><span><kbd>Enter</kbd> to open</span><span><kbd>Esc</kbd> to close</span></p>' +
        '<p class="sr-only" role="status" id="searchStatus"></p>';
      document.body.appendChild(searchDlg);
      const input = searchDlg.querySelector('input');
      const list = searchDlg.querySelector('#searchResults');
      let sel = -1;
      const render = debounce(function () { sel = -1; list.innerHTML = searchResults(input.value); announce(); }, 90);
      function announce() {
        const n = list.querySelectorAll('a').length;
        document.getElementById('searchStatus').textContent = input.value.trim() ? n + (n === 1 ? ' result' : ' results') : '';
      }
      function move(d) {
        const links = list.querySelectorAll('a');
        if (!links.length) return;
        sel = (sel + d + links.length) % links.length;
        links.forEach(function (a, i) { a.setAttribute('aria-selected', String(i === sel)); });
        links[sel].scrollIntoView({ block: 'nearest' });
        input.setAttribute('aria-activedescendant', links[sel].id);
      }
      input.addEventListener('input', render);
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter') {
          const links = list.querySelectorAll('a');
          const target = links[sel >= 0 ? sel : 0];
          if (target) { e.preventDefault(); location.href = target.getAttribute('href'); }
        }
        /* A search field eats the first Escape to clear itself. One press
           should close the dialog. */
        else if (e.key === 'Escape') { e.preventDefault(); searchDlg.close(); }
      });
      searchDlg.addEventListener('click', function (e) {
        if (e.target === searchDlg || e.target.closest('[data-close]')) searchDlg.close();
      });
      searchDlg.addEventListener('close', function () {
        if (searchDlg.opener && searchDlg.opener.focus && document.contains(searchDlg.opener)) searchDlg.opener.focus();
      });
    }
    const input = searchDlg.querySelector('input');
    searchDlg.querySelector('#searchResults').innerHTML = searchResults(input.value);
    if (!searchDlg.open) {
      searchDlg.opener = document.activeElement;
      searchDlg.showModal();
    }
    input.focus();
    input.select();
  }

  function searchResults(q) {
    const query = String(q || '').trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean);
    function score(hay, title) {
      let s = 0;
      for (let i = 0; i < terms.length; i++) {
        if (hay.indexOf(terms[i]) === -1) return 0;
        s += title.indexOf(terms[i]) !== -1 ? 3 : 1;
      }
      return s;
    }
    let reports, pages;
    if (!terms.length) {
      reports = REPORTS.slice(0, 5);
      pages = PAGES.slice(0, 4);
    } else {
      reports = REPORTS.map(function (r) {
        const hay = [r.title, r.company, r.ticker, r.sector, r.standfirst, market(r.market).name].join(' ').toLowerCase();
        return { r: r, s: score(hay, (r.title + ' ' + r.ticker + ' ' + r.company).toLowerCase()) };
      }).filter(function (x) { return x.s; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8).map(function (x) { return x.r; });
      pages = PAGES.filter(function (p) { return score((p[0] + ' ' + p[2]).toLowerCase(), p[0].toLowerCase()); }).slice(0, 5);
    }
    let n = 0;
    let html = '';
    if (reports.length) {
      html += '<li class="search__group label" role="presentation">' + (terms.length ? 'Reports' : 'Latest reports') + '</li>' +
        reports.map(function (r) {
          return '<li role="presentation"><a id="sr' + (n++) + '" role="option" aria-selected="false" href="' + reportUrl(r.id) + '">' +
            '<span class="t">' + esc(r.title) + '</span><span class="m">' + esc(r.ticker) + ' · ' + esc(market(r.market).name) + ' · ' + fmtDate(r.date, 'medium') + '</span></a></li>';
        }).join('');
    }
    if (pages.length) {
      html += '<li class="search__group label" role="presentation">Pages</li>' +
        pages.map(function (p) {
          return '<li role="presentation"><a id="sr' + (n++) + '" role="option" aria-selected="false" href="' + p[1] + '"><span class="t">' + esc(p[0]) + '</span></a></li>';
        }).join('');
    }
    if (!html) {
      html = '<li class="search__empty" role="presentation">Nothing matches "' + esc(q) + '". Try a ticker such as AAPL, a sector, or a market.</li>';
    }
    return html;
  }

  /* ------------------------------------------------------- dialogs, toasts */
  /* Resolves true or false. With requireText the confirm button stays off
     until that exact text is typed. */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      const back = document.activeElement;
      const d = document.createElement('dialog');
      d.className = 'dlg';
      d.setAttribute('aria-labelledby', 'dlgTitle');
      d.setAttribute('aria-describedby', 'dlgBody');
      d.innerHTML =
        '<div class="dlg__body">' +
          '<h2 id="dlgTitle">' + esc(opts.title) + '</h2>' +
          '<div id="dlgBody"><p>' + esc(opts.body || '') + '</p></div>' +
          (opts.requireText
            ? '<div class="form-group"><label for="dlgType">Type <strong>' + esc(opts.requireText) + '</strong> to confirm</label>' +
              '<input class="input" id="dlgType" autocomplete="off" spellcheck="false"></div>'
            : '') +
          '<div class="dlg__actions">' +
            '<button class="btn btn--ghost" type="button" value="cancel">' + esc(opts.cancel || 'Cancel') + '</button>' +
            '<button class="btn' + (opts.danger ? ' btn--danger' : '') + '" type="button" value="ok"' + (opts.requireText ? ' disabled' : '') + '>' + esc(opts.confirm || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(d);
      const ok = d.querySelector('button[value="ok"]');
      const typed = d.querySelector('#dlgType');
      if (typed) typed.addEventListener('input', function () {
        ok.disabled = typed.value.trim().toLowerCase() !== String(opts.requireText).trim().toLowerCase();
      });
      let answer = false;
      d.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (b && b.value === 'ok' && !b.disabled) { answer = true; d.close(); }
        else if (b && b.value === 'cancel') d.close();
        else if (e.target === d) d.close();
      });
      d.addEventListener('close', function () {
        d.remove();
        if (back && back.focus) back.focus();
        resolve(answer);
      });
      d.showModal();
      (typed || d.querySelector('button[value="cancel"]')).focus();
    });
  }

  function toast(message, type, action) {
    let host = document.getElementById('toasts');
    if (!host) {
      host = document.createElement('div');
      host.id = 'toasts'; host.className = 'toasts';
      host.setAttribute('role', 'status'); host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast' + (type === 'err' ? ' toast--err' : '');
    el.innerHTML = icon(type === 'err' ? 'alert' : 'check') + '<span>' + esc(message) + '</span>' +
      (action ? '<button type="button">' + esc(action.label) + '</button>' : '');
    if (action) el.querySelector('button').addEventListener('click', function () { el.remove(); action.fn(); });
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, type === 'err' ? 9000 : 4200);
  }

  /* ------------------------------------------------------ cookie choice
     Essential storage (sign in, theme, this choice) needs no consent. The one
     optional thing is remembering which campaign link brought someone here,
     so it is attached to their account if they sign up. That waits for a
     yes. A Global Privacy Control signal counts as a no, and no banner is
     shown to someone who has sent one. */
  const CONSENT_KEY = 'leoside.consent';
  const UTM_KEY = 'leoside.utm';
  let pendingUtm = null;

  function consent() {
    try { return JSON.parse(localStorage.getItem(CONSENT_KEY)); } catch (e) { return null; }
  }
  function setConsent(analytics, via) {
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ v: 1, analytics: !!analytics, via: via || 'banner', at: new Date().toISOString() })); } catch (e) {}
    if (analytics) { if (pendingUtm) storeUtm(pendingUtm); }
    else { try { localStorage.removeItem(UTM_KEY); } catch (e) {} }
  }
  function gpc() { return navigator.globalPrivacyControl === true; }

  function captureUtm() {
    const params = new URLSearchParams(location.search);
    const keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    const found = {};
    keys.forEach(function (k) { const v = params.get(k); if (v) found[k] = v.slice(0, 100); });
    if (!Object.keys(found).length) return;
    let ref = '';
    try { if (document.referrer) { const h = new URL(document.referrer).hostname; if (h !== location.hostname) ref = h; } } catch (e) {}
    if (ref) found.referrer = ref;
    found.landing = location.pathname.slice(0, 100);
    pendingUtm = found;
    const c = consent();
    if (c && c.analytics) storeUtm(found);
    /* Tidy the address bar so the tracking codes are not copied along with
       the link when someone shares it. */
    keys.forEach(function (k) { params.delete(k); });
    const q = params.toString();
    try { history.replaceState(history.state, '', location.pathname + (q ? '?' + q : '') + location.hash); } catch (e) {}
  }
  function storeUtm(obj) {
    try {
      if (localStorage.getItem(UTM_KEY)) return;   /* first touch wins */
      localStorage.setItem(UTM_KEY, JSON.stringify({ at: Date.now(), v: obj }));
    } catch (e) {}
  }
  /* What to attach to a new account, or null. Expires after 30 days. */
  function utm() {
    const c = consent();
    if (!c || !c.analytics) return null;
    try {
      const raw = JSON.parse(localStorage.getItem(UTM_KEY));
      if (!raw || Date.now() - raw.at > 30 * 864e5) return null;
      return raw.v;
    } catch (e) { return null; }
  }

  function showConsent(force) {
    const existing = document.getElementById('consent');
    if (existing) existing.remove();
    const c = consent();
    if (!force) {
      if (c) return;
      if (gpc()) { setConsent(false, 'gpc'); return; }
    }
    let storageOk = true;
    try { localStorage.setItem('leoside.probe', '1'); localStorage.removeItem('leoside.probe'); } catch (e) { storageOk = false; }
    if (!storageOk) return;

    const box = document.createElement('section');
    box.className = 'consent';
    box.id = 'consent';
    box.setAttribute('aria-labelledby', 'consentTitle');
    box.innerHTML =
      '<h2 id="consentTitle">Cookies and storage</h2>' +
      '<p>We keep only what the site needs to work: your sign in, your theme and this choice.</p>' +
      '<p>May we also note which campaign link brought you here? It is kept with your account if you sign up. No advertising, no tracking across sites. ' +
        (gpc() ? '<strong>Your browser sent a Global Privacy Control signal, so this is off.</strong> ' : '') +
        '<a class="link" href="privacy.html#cookies">What we store</a>.</p>' +
      (c ? '<p class="small muted">Current choice: ' + (c.analytics ? 'campaign details allowed' : 'essential only') + '.</p>' : '') +
      '<div class="consent__actions">' +
        '<button class="btn btn--ghost" type="button" data-consent="no">Essential only</button>' +
        '<button class="btn btn--ghost" type="button" data-consent="yes"' + (gpc() ? ' disabled' : '') + '>Allow campaign details</button>' +
      '</div>';
    document.body.appendChild(box);
    box.addEventListener('click', function (e) {
      const b = e.target.closest('[data-consent]');
      if (!b) return;
      setConsent(b.getAttribute('data-consent') === 'yes' && !gpc(), 'banner');
      box.remove();
      toast('Your choice is saved. Change it any time from Cookie settings in the footer.');
      mountIosHint();
    });
    if (force) box.querySelector('button').focus();
  }

  /* ------------------------------------------------------ floating actions */
  function mountFab() {
    if (document.getElementById('fab') || document.body.hasAttribute('data-no-fab')) return;
    const fab = document.createElement('div');
    fab.className = 'fab';
    fab.id = 'fab';
    fab.innerHTML =
      '<div class="fab__panel" id="contactPanel" hidden role="region" aria-labelledby="contactTitle">' +
        '<h2 id="contactTitle">Contact Leoside</h2>' +
        '<p>Questions, corrections and requests about your data all go to one address, and every message is read.</p>' +
        '<div class="copyline"><code>' + esc(SITE.email) + '</code>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-copy="' + esc(SITE.email) + '" data-copied="Email address copied.">' + icon('copy') + 'Copy</button></div>' +
        '<ul>' +
          '<li><a href="' + mailHref('Correction') + '">Report a correction <span aria-hidden="true">' + icon('arrow').replace('<svg ', '<svg width="16" height="16" ') + '</span></a></li>' +
          '<li><a href="' + mailHref('Privacy request') + '">Privacy or data request <span aria-hidden="true">' + icon('arrow').replace('<svg ', '<svg width="16" height="16" ') + '</span></a></li>' +
          '<li><a href="' + mailHref('Accessibility') + '">Accessibility problem <span aria-hidden="true">' + icon('arrow').replace('<svg ', '<svg width="16" height="16" ') + '</span></a></li>' +
          '<li><a href="copyright.html">Copyright notice <span aria-hidden="true">' + icon('arrow').replace('<svg ', '<svg width="16" height="16" ') + '</span></a></li>' +
        '</ul>' +
      '</div>' +
      '<button class="fab__btn fab__btn--icon" type="button" id="toTop" hidden aria-label="Back to top">' + icon('up') + '</button>' +
      '<button class="fab__btn" type="button" id="contactBtn" aria-expanded="false" aria-controls="contactPanel" aria-label="Contact Leoside">' + icon('chat') + '<span>Contact</span></button>';
    document.body.appendChild(fab);

    document.getElementById('contactBtn').addEventListener('click', function () {
      toggleContact(document.getElementById('contactPanel').hidden);
    });
    const top = document.getElementById('toTop');
    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      const target = document.querySelector('.site-header .brand') || document.body;
      target.focus({ preventScroll: true });
    });
    /* Both buttons wait until reading has started, so they never sit on
       the hero or a page head. */
    const onScroll = function () {
      top.hidden = window.scrollY < 700;
      const panel = document.getElementById('contactPanel');
      const long = document.documentElement.scrollHeight > window.innerHeight + 600;
      fab.classList.toggle('is-away', long && window.scrollY < 420 && (!panel || panel.hidden));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    document.addEventListener('click', function (e) {
      const panel = document.getElementById('contactPanel');
      if (panel && !panel.hidden && !e.target.closest('#fab')) toggleContact(false);
    });
  }
  function toggleContact(open) {
    const panel = document.getElementById('contactPanel');
    const btn = document.getElementById('contactBtn');
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('button, a').focus();
  }

  /* ----------------------------------------------------- reading progress
     A gold line that fills along the header's hairline as the page is
     read. Every page has it; it is drawn with a transform, so scrolling
     never triggers layout. */
  function mountProgress() {
    const header = document.getElementById('siteHeader');
    if (!header || header.querySelector('.progress')) return;
    const bar = document.createElement('div');
    bar.className = 'progress';
    bar.setAttribute('aria-hidden', 'true');
    header.appendChild(bar);
    let raf = 0;
    const paint = function () {
      raf = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - doc.clientHeight;
      bar.style.setProperty('--read', (max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0).toFixed(4));
    };
    const queue = function () { if (!raf) raf = requestAnimationFrame(paint); };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    paint();
  }

  /* ----------------------------------------------- long document helpers
     The table of contents marks the section being read. Each entry is also
     a direct link to its section, for anyone who wants to share one. */
  function enhanceDocs() {
    /* The current section is the last heading that has passed a line a
       third of the way down the screen, worked out from positions on each
       scroll frame, so jumping straight to a section marks it correctly. */
    const links = Array.prototype.slice.call(document.querySelectorAll('.doc-toc a[href^="#"], .toc a[href^="#"]'));
    const pairs = links.map(function (a) { return [a, document.getElementById(a.getAttribute('href').slice(1))]; })
      .filter(function (p) { return p[1]; });
    if (!pairs.length) return;
    let raf = 0, current = null;
    function mark() {
      raf = 0;
      const line = window.innerHeight / 3;
      let hit = null;
      for (let i = 0; i < pairs.length; i++) {
        if (pairs[i][1].getBoundingClientRect().top <= line) hit = pairs[i][0]; else break;
      }
      if (hit === current) return;
      if (current) { current.classList.remove('is-current'); current.removeAttribute('aria-current'); }
      if (hit) { hit.classList.add('is-current'); hit.setAttribute('aria-current', 'location'); }
      current = hit;
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(mark); }, { passive: true });
    mark();
  }

  /* --------------------------------------------------------- age check
     Members who signed in with Google never saw the sign up form, so they
     answer here once. Someone under 13 has their account deleted at once. */
  const AGE_EXEMPT = { signin: 1, signup: 1, reset: 1, terms: 1, privacy: 1, disclaimer: 1, accessibility: 1, copyright: 1, notfound: 1 };
  function ageGate() {
    const user = Auth.current();
    if (!user || user.ageConfirmed || AGE_EXEMPT[pageKey]) return;

    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.setAttribute('aria-labelledby', 'ageTitle');
    d.innerHTML =
      '<form class="dlg__body" id="ageForm" novalidate>' +
        '<h2 id="ageTitle">One question before you read</h2>' +
        '<p>Accounts are for people aged ' + SITE.minAge + ' or over, and anyone under ' + SITE.adultAge + ' needs a parent or guardian to agree. Your date of birth is used for this check only and is not stored.</p>' +
        dobFields('age') +
        '<div class="form-group" id="age-g-guardian" hidden><label class="check"><input type="checkbox" id="ageGuardian"><span>A parent or guardian has read the terms and agrees to me holding an account.</span></label></div>' +
        '<div class="form-group" id="age-g-terms"><label class="check"><input type="checkbox" id="ageTerms"><span>I agree to the <a class="link" href="terms.html" target="_blank" rel="noopener">terms of service</a> and have read the <a class="link" href="privacy.html" target="_blank" rel="noopener">privacy policy</a>.</span></label></div>' +
        '<div class="notice notice--err" id="ageErr" role="alert" hidden></div>' +
        '<div class="dlg__actions">' +
          '<button class="btn btn--ghost" type="button" data-signout-now>Sign out instead</button>' +
          '<button class="btn" type="submit">Continue</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(d);
    d.addEventListener('cancel', function (e) { e.preventDefault(); });
    wireDob('age', function (band) {
      d.querySelector('#age-g-guardian').hidden = band !== '13-17';
    });
    d.querySelector('[data-signout-now]').addEventListener('click', function () {
      Promise.resolve(Auth.signOut()).then(function () { location.href = '/'; });
    });
    d.querySelector('#ageForm').addEventListener('submit', function (e) {
      e.preventDefault();
      const err = d.querySelector('#ageErr');
      const band = Auth.ageBand(readDob('age'));
      const show = function (m) { err.innerHTML = icon('alert') + '<span>' + esc(m) + '</span>'; err.hidden = false; };
      if (!band) return show('Enter a real date of birth.');
      if (band === 'under') {
        const btn = d.querySelector('button[type="submit"]');
        btn.classList.add('is-busy');
        Auth.deleteAccount().then(function () {
          try { localStorage.setItem('leoside.age_block', String(Date.now())); } catch (e2) {}
          location.href = 'signup.html?under=1';
        });
        return;
      }
      if (band === '13-17' && !d.querySelector('#ageGuardian').checked) return show('A parent or guardian needs to agree first.');
      if (!d.querySelector('#ageTerms').checked) return show('Please agree to the terms to continue.');
      const btn = d.querySelector('button[type="submit"]');
      btn.classList.add('is-busy'); btn.disabled = true;
      Auth.confirmAgeAndTerms(band, band === '13-17').then(function (res) {
        if (!res.ok) { btn.classList.remove('is-busy'); btn.disabled = false; return show(res.error); }
        location.reload();
      });
    });
    d.showModal();
  }

  /* Day, month and year selects. No field shows which answer passes. */
  function dobFields(prefix, groupId) {
    const y = new Date().getFullYear();
    let days = '<option value="">Day</option>';
    for (let i = 1; i <= 31; i++) days += '<option value="' + i + '">' + i + '</option>';
    let months = '<option value="">Month</option>';
    MONTHS.forEach(function (m, i) { months += '<option value="' + (i + 1) + '">' + m + '</option>'; });
    let years = '<option value="">Year</option>';
    for (let i = y; i >= y - 110; i--) years += '<option value="' + i + '">' + i + '</option>';
    return '<fieldset class="form-group" id="' + (groupId || prefix + '-g-dob') + '"><legend class="flabel">Date of birth</legend>' +
      '<div class="dob">' +
        '<select class="select" id="' + prefix + 'Day" aria-label="Day" autocomplete="bday-day">' + days + '</select>' +
        '<select class="select" id="' + prefix + 'Month" aria-label="Month" autocomplete="bday-month">' + months + '</select>' +
        '<select class="select" id="' + prefix + 'Year" aria-label="Year" autocomplete="bday-year">' + years + '</select>' +
      '</div><div class="err">Enter your date of birth.</div></fieldset>';
  }
  function readDob(prefix) {
    return {
      d: +document.getElementById(prefix + 'Day').value,
      m: +document.getElementById(prefix + 'Month').value,
      y: +document.getElementById(prefix + 'Year').value
    };
  }
  function wireDob(prefix, onBand) {
    ['Day', 'Month', 'Year'].forEach(function (part) {
      document.getElementById(prefix + part).addEventListener('change', function () {
        onBand(Auth.ageBand(readDob(prefix)));
      });
    });
  }

  /* ------------------------------------------------------ mail fallback
     When a mailto link reaches no mail program, the page stays focused. If
     it still is a moment later, offer the address another way. The link
     itself is never intercepted. */
  function mountMailFallback() {
    let timer = null;
    document.addEventListener('click', function (e) {
      const link = e.target.closest && e.target.closest('a[href^="mailto:"]');
      if (!link || e.defaultPrevented) return;
      const href = link.getAttribute('href').replace(/^mailto:/, '');
      const address = href.split('?')[0];
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (document.visibilityState === 'visible' && document.hasFocus()) showMailToast(address);
      }, 1400);
    });
    window.addEventListener('blur', function () { clearTimeout(timer); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') clearTimeout(timer); });
  }
  function showMailToast(address) {
    const old = document.getElementById('mailToast');
    if (old) old.remove();
    const box = document.createElement('div');
    box.className = 'mailtoast';
    box.id = 'mailToast';
    box.setAttribute('role', 'status');
    box.innerHTML = '<strong>No mail program opened</strong>' +
      '<p>This device has nothing set up for email links. Copy the address and write from whichever email service you use.</p>' +
      '<div class="copyline"><code>' + esc(address) + '</code>' +
      '<button class="btn btn--sm" type="button" data-copy="' + esc(address) + '" data-copied="Email address copied.">Copy</button></div>' +
      '<div class="row"><button class="btn btn--quiet btn--sm" type="button" data-dismiss>Close</button></div>';
    document.body.appendChild(box);
    box.querySelector('[data-dismiss]').addEventListener('click', function () { box.remove(); });
  }

  /* --------------------------------------------------------------- install */
  function isStandalone() {
    return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  function isIos() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function mountInstall() {
    const slot = document.getElementById('installSlot');
    if (!slot || isStandalone()) return;
    slot.innerHTML = '<button class="btn btn--ghost btn--sm" type="button" id="installBtn">' + icon('download') + 'Install the app</button>';
    document.getElementById('installBtn').addEventListener('click', function () {
      const prompt = window.__leosideInstall;
      if (prompt) {
        prompt.prompt();
        Promise.resolve(prompt.userChoice).then(function () { window.__leosideInstall = null; });
        return;
      }
      showInstallHelp();
    });
    window.addEventListener('appinstalled', function () { slot.innerHTML = ''; });
  }
  function showInstallHelp() {
    const ua = navigator.userAgent;
    let title = 'Install Leoside Equity', steps = [], note = '';
    if (isIos()) {
      steps = ['Tap the Share button at the bottom of Safari', 'Choose "Add to Home Screen"', 'Tap Add'];
    } else if (/Android/.test(ua)) {
      steps = ['Open the menu at the top right of Chrome', 'Choose "Install app" or "Add to Home screen"', 'Confirm'];
      note = 'Private tabs cannot install apps. Use a normal tab.';
    } else if (/Firefox/.test(ua)) {
      note = 'Firefox on a computer does not install web apps. Chrome, Edge and Safari do.';
    } else {
      steps = ['Look for the install icon at the right end of the address bar', 'Or open the browser menu and choose "Install page as app"', 'Confirm'];
      note = 'Private windows cannot install apps. If there is no icon in a normal window, the app may already be installed.';
    }
    const d = document.createElement('dialog');
    d.className = 'dlg';
    d.setAttribute('aria-labelledby', 'instTitle');
    d.innerHTML = '<div class="dlg__body"><h2 id="instTitle">' + esc(title) + '</h2>' +
      (steps.length ? '<ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' : '') +
      (note ? '<p>' + esc(note) + '</p>' : '') +
      '<p class="small muted">The app is this website in its own window. You stay signed in and everything you save stays on your account.</p>' +
      '<div class="dlg__actions"><button class="btn" type="button" value="ok">Done</button></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function (e) { if (e.target.closest('button') || e.target === d) d.close(); });
    d.addEventListener('close', function () { d.remove(); });
    d.showModal();
  }

  /* iOS gives no install prompt of its own, so it is mentioned once, after
     the cookie choice so the two never stack up. */
  const IOS_KEY = 'leoside.ios_install_hint';
  function mountIosHint() {
    if (!isIos() || isStandalone() || !consent()) return;
    try { if (localStorage.getItem(IOS_KEY)) return; localStorage.setItem(IOS_KEY, 'shown'); } catch (e) { return; }
    toast('Add Leoside to your home screen from the Share menu in Safari.', 'ok');
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function (err) {
        console.warn('[Leoside] service worker did not register:', err && err.message);
      });
    });
  }

  /* ---------------------------------------------------- error reporting */
  function watchErrors() {
    window.addEventListener('error', function (e) {
      if (!e || !e.message || /ResizeObserver/.test(e.message)) return;
      /* Only errors from this site's own files. Extensions add their own. */
      if (e.filename && e.filename.indexOf(location.origin) !== 0) return;
      Data.logError({ message: e.message, source: e.filename, line: e.lineno });
    });
    window.addEventListener('unhandledrejection', function (e) {
      const r = e && e.reason;
      Data.logError({ message: 'promise: ' + ((r && r.message) || String(r)).slice(0, 300) });
    });
  }

  /* ---------------------------------------------------------------- init */
  let started = false;
  function init(page) {
    pageKey = page || '';
    if (started) { refreshAccount(); return; }
    started = true;
    wireGlobal();
    mountHeader();
    mountFooter();
    mountFab();
    mountProgress();
    mountInstall();
    mountMailFallback();
    captureUtm();
    if (!document.getElementById('consent')) showConsent(false);
    mountIosHint();
    registerWorker();
    watchErrors();
    ageGate();
  }

  /* Runs after each page has drawn its own content. */
  function afterRender() { enhanceDocs(); }

  /* The cookie banner needs nothing from the network, so it goes up as soon
     as this script runs instead of waiting for the session and the reports. */
  if (document.body) showConsent(false);

  return {
    icon: icon, mark: mark, brand: brand, esc: esc, debounce: debounce, reducedMotion: reducedMotion,
    MONTHS: MONTHS, MONTHS_S: MONTHS_S, DAYS: DAYS, DAYS_S: DAYS_S,
    parseDate: parseDate, toISO: toISO, fmtDate: fmtDate,
    marketForDate: marketForDate, marketForToday: marketForToday, weekOfMonth: weekOfMonth,
    market: market, hasValuation: hasValuation,
    displayName: displayName, avatar: avatar,
    mailHref: mailHref, mailLink: mailLink, copyText: copyText,
    reportUrl: reportUrl, byId: byId,
    paragraphs: paragraphs, wordCount: wordCount, preview: preview,
    marketTag: marketTag, ratingTag: ratingTag,
    setTheme: setTheme, currentTheme: currentTheme,
    confirm: confirmDialog, toast: toast, utm: utm, consent: consent,
    dobFields: dobFields, readDob: readDob, wireDob: wireDob,
    refreshAccount: refreshAccount, openSearch: openSearch,
    init: init, afterRender: afterRender
  };
})();
