/* ==========================================================================
   Leoside Equity: publishing screen
   --------------------------------------------------------------------------
   Writes through public.upsert_report(), which checks profiles.is_admin in
   the database before touching anything. Hiding this page is a convenience;
   the permission is enforced on the server.

   Dates:
     past     publishes now, filed under the date chosen
     today    publishes now
     future   held as a scheduled draft, live at 06:00 India time on the day
   ========================================================================== */

Boot.start('admin', function () {
  'use strict';

  const meta = document.getElementById('adminMeta');
  const bodyEl = document.getElementById('adminBody');
  const denied = document.getElementById('adminDenied');
  const form = document.getElementById('publishForm');
  const secWrap = document.getElementById('sections');
  const note = document.getElementById('adminNote');

  const user = Auth.current();
  if (!Auth.live) { meta.textContent = 'Publishing needs the Supabase backend.'; denied.hidden = false; return; }
  if (!user) { Auth.requireAuth(); return; }
  if (!user.isAdmin) { meta.textContent = 'Signed in as ' + user.email + '.'; denied.hidden = false; return; }

  meta.textContent = 'Signed in as ' + user.email + '. Reports save straight to the live site.';
  bodyEl.hidden = false;

  /* ------------------------------------------------------------ sections */
  let secCount = 0;
  function addSection(heading, text) {
    const n = ++secCount;
    const block = document.createElement('fieldset');
    block.className = 'panel';
    block.innerHTML =
      '<div class="panel__head"><legend class="flabel" style="margin:0">Section</legend>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-remove>Remove</button></div>' +
      '<div class="panel__body">' +
        '<div class="form-group"><label for="sh' + n + '">Heading</label>' +
          '<input class="input" id="sh' + n + '" data-heading type="text" maxlength="200" autocomplete="off" data-lpignore="true" placeholder="What the business sells"></div>' +
        '<div class="form-group" style="margin-bottom:0"><label for="sp' + n + '">Paragraphs</label>' +
          '<textarea class="input" id="sp' + n + '" data-text rows="7" autocomplete="off" data-lpignore="true" placeholder="Separate paragraphs with a blank line."></textarea></div>' +
      '</div>';
    block.querySelector('[data-heading]').value = heading || '';
    block.querySelector('[data-text]').value = text || '';
    block.querySelector('[data-remove]').addEventListener('click', function () {
      block.remove(); renumber(); tally(); touched();
      if (!secWrap.children.length) addSection();
    });
    block.querySelector('[data-text]').addEventListener('input', tally);
    secWrap.appendChild(block);
    renumber();
    tally();
  }
  function renumber() {
    Array.prototype.forEach.call(secWrap.children, function (b, i) { b.querySelector('legend').textContent = 'Section ' + (i + 1); });
  }
  function collect() {
    return Array.prototype.map.call(secWrap.children, function (b) {
      return {
        h: b.querySelector('[data-heading]').value.trim(),
        p: b.querySelector('[data-text]').value.split(/\n\s*\n/).map(function (s) { return s.trim().replace(/\s*\n\s*/g, ' '); }).filter(Boolean)
      };
    }).filter(function (s) { return s.h || s.p.length; });
  }
  function tally() {
    const words = collect().map(function (s) { return s.p.join(' '); }).join(' ').split(/\s+/).filter(Boolean).length;
    document.getElementById('wordTally').textContent = words.toLocaleString() + ' words. Signed out readers see the first ' + SITE.freeWords + '.';
  }
  document.getElementById('addSection').addEventListener('click', function () { addSection(); touched(); });

  /* -------------------------------------------------------------- market */
  const dateEl = document.getElementById('f-date');
  const marketEl = document.getElementById('f-market');
  const marketHint = document.getElementById('marketHint');
  const valuationBlock = document.getElementById('valuationBlock');

  marketEl.innerHTML = REGION_ORDER.map(function (code) {
    return '<option value="' + code + '">' + LS.esc(REGIONS[code].name) + '</option>';
  }).join('');

  const PLACEHOLDERS = {
    US: { ticker: 'AAPL', company: 'Apple Inc.', exchange: 'Nasdaq', sector: 'Technology' },
    UK: { ticker: 'SHEL', company: 'Shell plc', exchange: 'LSE', sector: 'Energy' },
    IN: { ticker: 'NIFTY 50', company: 'The Indian equity market', exchange: 'NSE', sector: 'Index' }
  };

  function paintMarket() {
    const code = marketEl.value;
    const priced = LS.hasValuation(code);
    const hint = PLACEHOLDERS[code] || PLACEHOLDERS.US;
    valuationBlock.hidden = !priced;
    valuationBlock.querySelectorAll('input, select').forEach(function (el) { el.disabled = !priced; });
    ['ticker', 'company', 'exchange', 'sector'].forEach(function (k) { document.getElementById('f-' + k).placeholder = hint[k]; });
    document.getElementById('indiaRule').hidden = code !== 'IN';

    if (!dateEl.value) { marketHint.textContent = ''; return; }
    const usual = LS.marketForDate(dateEl.value);
    marketHint.textContent = code === usual
      ? LS.fmtDate(dateEl.value, 'short') + ' is normally a ' + LS.market(usual).name + ' day.'
      : LS.fmtDate(dateEl.value, 'short') + ' is normally a ' + LS.market(usual).name + ' day. Publishing as ' + LS.market(code).name + ' anyway.';
  }

  /* ---------------------------------------------------------------- date */
  function todayISO() { return LS.toISO(new Date()); }
  function dateState() {
    const v = dateEl.value;
    if (!v) return 'empty';
    const t = todayISO();
    return v < t ? 'past' : v === t ? 'today' : 'future';
  }
  const dateHint = document.getElementById('dateHint');
  function paintDate() {
    const s = dateState();
    if (s === 'future') {
      dateHint.className = 'hint hint--scheduled';
      dateHint.innerHTML = LS.icon('clock') + '<span>Scheduled. It waits in drafts and goes live at <strong>6:00 am India time on ' +
        LS.esc(LS.fmtDate(dateEl.value, 'short')) + '</strong>. You can edit or delete it until then.</span>';
    } else if (s === 'past') {
      dateHint.className = 'hint hint--past';
      dateHint.innerHTML = LS.icon('calendar') + '<span>Backdated. Publishing puts it live now, filed under <strong>' +
        LS.esc(LS.fmtDate(dateEl.value, 'medium')) + '</strong> in the archive.</span>';
    } else if (s === 'today') {
      dateHint.className = 'hint hint--now';
      dateHint.innerHTML = LS.icon('check') + '<span>Publishing puts this live straight away.</span>';
    } else {
      dateHint.className = 'hint'; dateHint.textContent = '';
    }
    paintButtons();
  }
  dateEl.addEventListener('change', function () { paintDate(); paintMarket(); });
  dateEl.addEventListener('input', paintDate);
  marketEl.addEventListener('change', paintMarket);

  /* ------------------------------------------------------- what is loaded */
  let rows = [];
  let editingId = '';

  function editingRow() { return rows.find(function (r) { return r.id === editingId; }) || null; }

  function syncUrl() {
    const url = new URL(location.href);
    if (editingId) url.searchParams.set('edit', editingId); else url.searchParams.delete('edit');
    history.replaceState(null, '', url.pathname + url.search);
  }

  function paintEditingBar() {
    const editing = editingRow();
    const bar = document.getElementById('editingBar');
    document.getElementById('adminTitle').textContent = editing ? 'Edit report' : 'Publish a report';
    if (!editing) { bar.hidden = true; return; }
    bar.innerHTML = LS.icon('doc') + '<span>Editing <strong>' + LS.esc(editing.title) + '</strong> (' + LS.esc(editing.id) + ')' +
      (editing.is_published ? '' : ', a draft') + '. <a class="link" href="admin.html">Start a new report instead</a></span>';
    bar.hidden = false;
  }

  const FIELDS = ['f-date', 'f-market', 'f-ticker', 'f-exchange', 'f-sector', 'f-company', 'f-title', 'f-standfirst',
                  'f-rating', 'f-target', 'f-last', 'f-horizon'];

  function resetForm() {
    form.reset();
    editingId = '';
    secWrap.innerHTML = '';
    addSection();
    dateEl.value = todayISO();
    marketEl.value = LS.marketForDate(dateEl.value);
    document.getElementById('f-horizon').value = '12 months';
    document.getElementById('f-rating').value = 'Fairly valued';
    syncUrl(); paintDate(); paintMarket(); paintEditingBar(); tally(); paintAdvice();
    markClean();
  }

  function loadInto(row) {
    if (!row) { resetForm(); return; }
    editingId = row.id;
    dateEl.value = row.published_on;
    marketEl.value = LS.market(row.market || LS.marketForDate(row.published_on)).code;
    ['ticker', 'exchange', 'sector', 'company', 'title', 'standfirst', 'target', 'horizon'].forEach(function (k) {
      document.getElementById('f-' + k).value = row[k] || '';
    });
    document.getElementById('f-last').value = row.last_price || '';
    if (!row.horizon) document.getElementById('f-horizon').value = '12 months';
    const stance = document.getElementById('f-rating');
    if (row.rating && !Array.prototype.some.call(stance.options, function (o) { return o.value === row.rating; })) {
      const legacy = document.createElement('option');
      legacy.value = row.rating; legacy.textContent = row.rating + ' (retired)';
      stance.appendChild(legacy);
    }
    stance.value = row.rating || 'Fairly valued';
    secWrap.innerHTML = '';
    (row.body || []).forEach(function (s) { addSection(s.h, (s.p || []).join('\n\n')); });
    if (!secWrap.children.length) addSection();
    syncUrl(); paintDate(); paintMarket(); paintEditingBar(); tally(); paintAdvice();
    markClean();
  }

  const draftBtn = document.getElementById('draftBtn');
  const publishBtn = document.getElementById('publishBtn');
  const saveHint = document.getElementById('saveHint');
  function paintButtons() {
    const editing = editingRow();
    const live = !!(editing && editing.is_published);
    const future = dateState() === 'future';
    draftBtn.textContent = live ? 'Save changes' : 'Save draft';
    publishBtn.textContent = live ? 'Save and view' : future ? 'Schedule report' : 'Publish report';
    saveHint.textContent = editing
      ? (live ? 'This report is live. Saving keeps it live.' : 'This is a draft. Save draft keeps it hidden until you publish.')
      : (future ? 'Schedule holds it in drafts until 6:00 am on the day. Save draft keeps it hidden with no date attached.'
                : 'Publish makes it live now. Save draft keeps it hidden.');
  }

  document.getElementById('newReport').addEventListener('click', function () {
    const go = function () { clearAutosave(); resetForm(); note.hidden = true; };
    if (!dirty) { go(); return; }
    LS.confirm({ title: 'Clear the form?', body: 'What you have typed and not saved will be lost.', confirm: 'Clear it', danger: true })
      .then(function (yes) { if (yes) go(); });
  });

  /* ------------------------------------------------------------ autosave
     Unsaved typing is kept on this device only, cleared once it reaches the
     database. Separate from a saved draft, which lives in Supabase. */
  const AUTOSAVE_KEY = 'leoside.admin.autosave';
  let autosaveTimer = null;
  let dirty = false;
  function markClean() { dirty = false; }
  function snapshot() {
    const values = {};
    FIELDS.forEach(function (id) { values[id] = document.getElementById(id).value; });
    return { at: Date.now(), editingId: editingId, values: values, sections: collect() };
  }
  function hasContent(s) {
    if (!s || !s.values) return false;
    const typed = ['f-ticker', 'f-company', 'f-title', 'f-standfirst', 'f-target', 'f-last', 'f-sector', 'f-exchange']
      .some(function (id) { return (s.values[id] || '').trim(); });
    return typed || (s.sections || []).some(function (x) { return (x.h || '').trim() || (x.p || []).length; });
  }
  function writeAutosave() {
    if (!dirty) return;
    try {
      const s = snapshot();
      if (!hasContent(s)) { localStorage.removeItem(AUTOSAVE_KEY); return; }
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function clearAutosave() {
    markClean();
    clearTimeout(autosaveTimer);
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
    document.getElementById('autosaveBar').hidden = true;
  }
  function readAutosave() {
    try { const s = JSON.parse(localStorage.getItem(AUTOSAVE_KEY)); return hasContent(s) ? s : null; } catch (e) { return null; }
  }
  function applyAutosave(s) {
    dirty = true;
    editingId = s.editingId || '';
    FIELDS.forEach(function (id) { if (s.values[id] !== undefined) document.getElementById(id).value = s.values[id]; });
    secWrap.innerHTML = '';
    (s.sections || []).forEach(function (x) { addSection(x.h, (x.p || []).join('\n\n')); });
    if (!secWrap.children.length) addSection();
    syncUrl(); paintDate(); paintMarket(); paintEditingBar(); tally(); paintAdvice();
  }
  function showAutosaveBar(s) {
    const bar = document.getElementById('autosaveBar');
    const mins = Math.round((Date.now() - s.at) / 60000);
    const ago = mins < 1 ? 'less than a minute ago' : mins < 60 ? mins + (mins === 1 ? ' minute ago' : ' minutes ago') : new Date(s.at).toLocaleString();
    bar.innerHTML = LS.icon('check') + '<span>Restored what you had typed ' + ago + '. It is not saved to the site yet. ' +
      '<button class="btn btn--quiet btn--sm" type="button" id="discardAutosave">Discard it</button></span>';
    bar.hidden = false;
    document.getElementById('discardAutosave').addEventListener('click', function () { clearAutosave(); resetForm(); });
  }
  function touched() {
    dirty = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(writeAutosave, 400);
  }
  form.addEventListener('input', touched);
  form.addEventListener('change', touched);
  window.addEventListener('beforeunload', function (e) {
    writeAutosave();
    if (dirty) { e.preventDefault(); e.returnValue = ''; }
  });

  /* --------------------------------------------------------- draft list */
  const draftList = document.getElementById('draftList');
  function drafts() { return rows.filter(function (r) { return !r.is_published; }); }
  function goLiveLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return LS.fmtDate(LS.toISO(d), 'short') + ' at ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  function paintDrafts() {
    const list = drafts();
    if (!list.length) {
      draftList.innerHTML = '<li><div class="dl-row muted small">No drafts. Anything saved without publishing, or scheduled for a later day, waits here.</div></li>';
      return;
    }
    draftList.innerHTML = list.map(function (r) {
      const scheduled = !!r.go_live_at && new Date(r.go_live_at) > new Date();
      return '<li><div class="dl-row" style="flex-wrap:wrap">' +
        '<span style="min-width:0;flex:1 1 240px"><span class="t">' + LS.esc(r.title) + (scheduled ? ' <span class="tag tag--brass">Scheduled</span>' : '') + '</span>' +
        '<span class="m">' + LS.esc(r.ticker) + ' · ' + LS.fmtDate(r.published_on, 'medium') + ' · ' + LS.esc(LS.market(r.market).name) +
          (scheduled ? ' · goes live ' + LS.esc(goLiveLabel(r.go_live_at)) : '') + '</span></span>' +
        '<span class="r">' +
          '<a class="btn btn--ghost btn--sm" href="admin.html?edit=' + encodeURIComponent(r.id) + '">Edit</a>' +
          '<a class="btn btn--ghost btn--sm" href="' + LS.reportUrl(r.id) + '">Preview</a>' +
          '<button class="btn btn--sm" type="button" data-publish="' + LS.esc(r.id) + '">' + (scheduled ? 'Publish now' : 'Publish') + '</button>' +
          '<button class="btn btn--danger btn--sm" type="button" data-delete="' + LS.esc(r.id) + '">Delete</button>' +
        '</span></div></li>';
    }).join('');
  }

  draftList.addEventListener('click', function (e) {
    const pub = e.target.closest('[data-publish]');
    if (pub) { publishDraft(pub.getAttribute('data-publish'), pub); return; }
    const del = e.target.closest('[data-delete]');
    if (!del) return;
    const id = del.getAttribute('data-delete');
    const row = rows.find(function (r) { return r.id === id; });
    LS.confirm({ title: 'Delete this draft?', body: '"' + (row ? row.title : id) + '" will be deleted. This cannot be undone.', confirm: 'Delete draft', danger: true })
      .then(function (yes) {
        if (!yes) return;
        del.disabled = true; del.classList.add('is-busy');
        Data.deleteReport(id).then(function (res) {
          if (!res.ok) { del.disabled = false; del.classList.remove('is-busy'); say('Could not delete that draft. ' + LS.esc(res.error), false); return; }
          rows = rows.filter(function (r) { return r.id !== id; });
          if (editingId === id) resetForm();
          paintDrafts(); paintEditingBar();
          LS.toast('Draft deleted.');
        });
      });
  });

  /* Publishing from the list keeps the report's own date, past or present.
     A scheduled report published early is moved to today, because sending
     its future date back would simply schedule it again. */
  function publishDraft(id, btn) {
    const row = rows.find(function (r) { return r.id === id; });
    if (!row) return;
    const date = row.published_on > todayISO() ? todayISO() : row.published_on;
    btn.disabled = true; btn.classList.add('is-busy');
    const p = {
      id: row.id, published_on: date, market: row.market, ticker: row.ticker, company: row.company,
      exchange: row.exchange, sector: row.sector, read_mins: String(row.read_mins || 1), title: row.title,
      standfirst: row.standfirst, body: row.body, author: row.author, disclosure: row.disclosure,
      correction: row.correction, is_published: true
    };
    if (LS.hasValuation(row.market)) { p.rating = row.rating; p.target = row.target; p.last_price = row.last_price; p.horizon = row.horizon; }
    Promise.resolve(SB.rpc('upsert_report', { p: p })).then(function (res) {
      btn.disabled = false; btn.classList.remove('is-busy');
      if (res.error) { fail(res.error); return; }
      row.is_published = true; row.published_on = date;
      Data.clearCache();
      paintDrafts(); paintButtons(); paintEditingBar();
      say('Published <strong>' + LS.esc(id) + '</strong>. <a class="link" href="' + LS.reportUrl(id) + '">Open it</a>.', true);
    }).catch(function (err) { btn.disabled = false; btn.classList.remove('is-busy'); fail(err); });
  }

  function loadRows() {
    return Promise.resolve(SB.rpc('admin_list_reports')).then(function (res) {
      rows = res.error ? [] : (res.data || []);
      if (res.error) say('Could not load drafts. ' + LS.esc(res.error.message), false);
      paintDrafts();
    });
  }

  loadRows().then(function () {
    const wanted = new URLSearchParams(location.search).get('edit');
    const row = wanted ? rows.find(function (r) { return r.id === wanted; }) : null;
    const snap = readAutosave();
    if (row) {
      if (snap && snap.editingId === row.id) { applyAutosave(snap); showAutosaveBar(snap); } else loadInto(row);
      return;
    }
    if (wanted) { resetForm(); say('No report matches <strong>' + LS.esc(wanted) + '</strong>. Starting a new one.', false); return; }
    if (snap && !snap.editingId) { applyAutosave(snap); showAutosaveBar(snap); return; }
    resetForm();
  });

  /* ---------------------------------------------------------------- save */
  function slug(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'report';
  }
  /* A new report must never overwrite an existing one that happens to share
     a ticker and a date. */
  function freshId(base) {
    let id = base, n = 2;
    while (rows.some(function (r) { return r.id === id; }) || REPORTS.some(function (r) { return r.id === id; })) id = base + '-' + (n++);
    return id;
  }

  /* ------------------------------------------- wording that reads as advice
     A headline or standfirst that tells readers to act ("buy", "buying
     opportunity", "upside", "must own") reads as a personal recommendation,
     and a disclaimer lower down does not undo that. The wording is flagged
     as it is typed, and publishing asks once more. Descriptive uses such
     as "sell-off" and "buyback" are left alone. */
  function adviceRules() {
    return [
      [/\bbuy(s|ing)?\b(?![- ]?backs?\b)/i, 'buy'],
      [/\bsell(s|ing)?\b(?![- ]?offs?\b)(?![- ]side\b)/i, 'sell'],
      [/\bupside\b/i, 'upside'],
      [/\bopportunit(y|ies)\b/i, 'opportunity'],
      [/\b(must|should) (own|buy|sell|hold)\b/i, 'must or should own'],
      [/\b(strong buy|top pick|no[- ]brainer|can'?t miss|sure thing|guaranteed?|risk[- ]free|bargain)\b/i, 'promotional phrasing'],
      [/\bprice target\b/i, 'price target'],
      [/\d+(\.\d+)?\s?%\s?(upside|gains?|returns?|rally|rise)\b/i, 'a percentage gain']
    ];
  }
  function adviceWords() {
    const text = document.getElementById('f-title').value + ' ' + document.getElementById('f-standfirst').value;
    return adviceRules().filter(function (a) { return a[0].test(text); }).map(function (a) { return a[1]; });
  }
  function paintAdvice() {
    let warn = document.getElementById('adviceWarn');
    if (!warn) {
      warn = document.createElement('div');
      warn.className = 'notice notice--brass';
      warn.id = 'adviceWarn';
      warn.setAttribute('role', 'status');
      document.getElementById('f-standfirst').closest('.form-group').appendChild(warn);
    }
    const hits = adviceWords();
    warn.hidden = !hits.length;
    warn.innerHTML = hits.length
      ? LS.icon('alert') + '<span><strong>This reads as advice to act:</strong> ' + LS.esc(hits.join(', ')) +
        '. State the argument instead, for example "Diageo\'s price assumes the payout cut is permanent". Wording that tells readers to buy or sell can be treated as a personal recommendation, whatever the disclaimer says.</span>'
      : '';
  }
  document.getElementById('f-title').addEventListener('input', LS.debounce(paintAdvice, 250));
  document.getElementById('f-standfirst').addEventListener('input', LS.debounce(paintAdvice, 250));
  let saving = false;
  function save(intent, wordingChecked) {
    if (saving) return;
    if (!form.reportValidity()) return;
    const body = collect();
    if (!body.length) { fail('Add at least one section with some text before saving.'); return; }
    const hits = intent === 'publish' && !wordingChecked ? adviceWords() : [];
    if (hits.length) {
      paintAdvice();
      LS.confirm({
        title: 'The wording reads as advice',
        body: 'The headline or standfirst uses: ' + hits.join(', ') + '. Leoside Equity publishes general commentary, and wording that tells readers to buy or sell undercuts that. Publish it as written anyway?',
        confirm: 'Publish as written',
        cancel: 'Change the wording'
      }).then(function (yes) {
        if (yes) save(intent, true);
        else document.getElementById('f-title').focus();
      });
      return;
    }

    const editing = editingRow();
    const isPublished = intent === 'publish' ? true : !!(editing && editing.is_published);
    const date = dateEl.value;
    const ticker = document.getElementById('f-ticker').value.trim().toUpperCase();
    const words = body.map(function (s) { return s.p.join(' '); }).join(' ').split(/\s+/).filter(Boolean).length;

    const payload = {
      id: editingId || freshId(slug(ticker) + '-' + date),
      published_on: date,
      market: marketEl.value,
      ticker: ticker,
      company: document.getElementById('f-company').value.trim(),
      exchange: document.getElementById('f-exchange').value.trim(),
      sector: document.getElementById('f-sector').value.trim(),
      read_mins: String(Math.max(1, Math.round(words / 220))),
      title: document.getElementById('f-title').value.trim(),
      standfirst: document.getElementById('f-standfirst').value.trim(),
      /* Not edited on this page any more. Whatever an older report already
         holds in these is sent back unchanged, so saving never wipes it. */
      author: (editing && editing.author) || '',
      disclosure: (editing && editing.disclosure) || '',
      correction: (editing && editing.correction) || '',
      body: body,
      is_published: isPublished
    };
    if (LS.hasValuation(marketEl.value)) {
      payload.rating = document.getElementById('f-rating').value;
      payload.target = document.getElementById('f-target').value.trim();
      payload.last_price = document.getElementById('f-last').value.trim();
      payload.horizon = document.getElementById('f-horizon').value.trim();
    }

    saving = true;
    const pressed = intent === 'publish' ? publishBtn : draftBtn;
    draftBtn.disabled = publishBtn.disabled = true;
    pressed.classList.add('is-busy');
    const done = function () { saving = false; draftBtn.disabled = publishBtn.disabled = false; pressed.classList.remove('is-busy'); };

    Promise.resolve(SB.rpc('upsert_report', { p: payload })).then(function (res) {
      done();
      if (res.error) { fail(res.error); return; }
      const reportId = idFromResponse(res.data, payload.id);
      const saved = Object.assign({}, payload, { id: reportId, body: body, last_price: payload.last_price });
      const at = rows.findIndex(function (r) { return r.id === reportId; });
      if (at === -1) rows.unshift(saved); else rows[at] = Object.assign(rows[at], saved);
      clearAutosave();
      Data.clearCache();

      const scheduled = intent === 'publish' && date > todayISO();
      if (intent === 'publish' && !scheduled) {
        location.href = LS.reportUrl(reportId);
        return;
      }
      resetForm();
      let message;
      if (scheduled) {
        message = 'Scheduled <strong>' + LS.esc(reportId) + '</strong>. It goes live at 6:00 am India time on ' + LS.esc(LS.fmtDate(date, 'medium')) + ' and waits in drafts below until then.';
      } else if (isPublished) {
        message = 'Saved changes to <strong>' + LS.esc(reportId) + '</strong>, which stays live. <a class="link" href="' + LS.reportUrl(reportId) + '">Open it</a>.';
      } else {
        message = 'Saved <strong>' + LS.esc(reportId) + '</strong> to drafts below. Nothing has been published.';
      }
      say(message, true);
      loadRows();
    }).catch(function (err) { done(); fail(err); });
  }
  draftBtn.addEventListener('click', function () { save('draft'); });
  publishBtn.addEventListener('click', function () { save('publish'); });

  const CONSTRAINT_HELP = {
    reports_rating_check: 'The database restricts the valuation stance to an older list. Run supabase/apply_now.sql.',
    reports_market_check: 'The database expects old market codes. Run supabase/apply_now.sql.'
  };
  function fail(err) {
    const raw = typeof err === 'string' ? err : (err && (err.message || err.details || err.hint)) || 'Unknown error';
    const hit = Object.keys(CONSTRAINT_HELP).find(function (k) { return String(raw).indexOf(k) !== -1; });
    const message = hit ? CONSTRAINT_HELP[hit] + ' (' + raw + ')' : raw;
    console.error('[Leoside] save failed', err);
    say('Could not save. ' + LS.esc(message), false);
  }

  /* upsert_report returns text; older versions of it returned other shapes. */
  function idFromResponse(data, fallback) {
    let v = Array.isArray(data) ? data[0] : data;
    if (v && typeof v === 'object') v = v.upsert_report || v.id || v.report_id || null;
    if (typeof v === 'string' && v.trim()) return v.trim();
    return fallback;
  }

  function say(html, ok) {
    note.className = 'notice notice--' + (ok ? 'ok' : 'err');
    note.setAttribute('role', ok ? 'status' : 'alert');
    note.innerHTML = LS.icon(ok ? 'check' : 'alert') + '<span>' + html + '</span>';
    note.hidden = false;
    note.scrollIntoView({ block: 'nearest' });
  }
});
