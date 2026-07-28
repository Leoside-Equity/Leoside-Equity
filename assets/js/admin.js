/* ==========================================================================
   Leoside Equity — publishing screen
   --------------------------------------------------------------------------
   Writes through public.upsert_report(), which checks profiles.is_admin in
   the database before it touches anything. Hiding this page in the browser is
   convenience only; the real check is server side, so a curious visitor who
   opens admin.html directly gets a permission error rather than a form that
   works.
   ========================================================================== */

Boot.start('admin', function () {
  'use strict';

  const meta    = document.getElementById('adminMeta');
  const bodyEl  = document.getElementById('adminBody');
  const denied  = document.getElementById('adminDenied');
  const form    = document.getElementById('publishForm');
  const secWrap = document.getElementById('sections');
  const note    = document.getElementById('adminNote');

  const user = Auth.current();

  if (!Auth.live) {
    meta.textContent = 'Publishing needs the Supabase backend. Set USE_SUPABASE to true in assets/js/config.js once you have run the migration.';
    denied.hidden = false;
    return;
  }
  if (!user) { Auth.requireAuth(); return; }
  if (!user.isAdmin) {
    meta.textContent = 'Signed in as ' + user.email + '.';
    denied.hidden = false;
    return;
  }

  meta.textContent = 'Signed in as ' + user.email + '. Reports save straight to the live site.';
  bodyEl.hidden = false;

  /* ------------------------------------------------------------- sections */
  function addSection(heading, text) {
    const i = secWrap.children.length;
    const block = document.createElement('div');
    block.className = 'panel';
    block.innerHTML =
      '<div class="panel__head">' +
        '<h3>Section ' + (i + 1) + '</h3>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-remove>Remove</button>' +
      '</div>' +
      '<div class="panel__body">' +
        '<div class="form-group"><label>Heading</label>' +
          '<input class="input" data-heading type="text" autocomplete="off" ' +
            'data-lpignore="true" data-form-type="other" placeholder="The setup"></div>' +
        '<div class="form-group" style="margin-bottom:0"><label>Paragraphs</label>' +
          '<textarea class="input" data-text rows="7" autocomplete="off" ' +
            'data-lpignore="true" data-form-type="other" ' +
            'placeholder="One paragraph per block, separated by a blank line."></textarea></div>' +
      '</div>';
    block.querySelector('[data-heading]').value = heading || '';
    block.querySelector('[data-text]').value = text || '';
    block.querySelector('[data-remove]').addEventListener('click', function () {
      block.remove();
      renumber();
      tally();
    });
    block.querySelector('[data-text]').addEventListener('input', tally);
    secWrap.appendChild(block);
    tally();
  }

  function renumber() {
    Array.prototype.forEach.call(secWrap.children, function (b, i) {
      b.querySelector('h3').textContent = 'Section ' + (i + 1);
    });
  }

  function collect() {
    return Array.prototype.map.call(secWrap.children, function (b) {
      return {
        h: b.querySelector('[data-heading]').value.trim(),
        p: b.querySelector('[data-text]').value
             .split(/\n\s*\n/)
             .map(function (s) { return s.trim().replace(/\s*\n\s*/g, ' '); })
             .filter(Boolean)
      };
    }).filter(function (s) { return s.h || s.p.length; });
  }

  function tally() {
    const words = collect().map(function (s) { return s.p.join(' '); }).join(' ')
      .split(/\s+/).filter(Boolean).length;
    document.getElementById('wordTally').textContent =
      words + ' words. Signed out readers see the first ' + SITE.freeWords + '.';
  }

  document.getElementById('addSection').addEventListener('click', function () { addSection(); });
  addSection();

  /* ----------------------------------------------------------- the market
     The dropdown is the single source of truth and is what gets sent to the
     database, whatever day of the week the report is dated. The publishing
     calendar only supplies a starting suggestion on a fresh form, and a note
     underneath if the chosen market differs from the usual one for that date.
     Changing the date never silently rewrites the selection. */
  const dateEl = document.getElementById('f-date');
  const marketEl = document.getElementById('f-market');
  const marketHint = document.getElementById('marketHint');

  /* The options come from the schedule, in the order the week runs, so adding
     or moving a slot in data.js is the only edit that change ever needs. */
  (function buildMarketOptions() {
    const seen = [];
    for (let i = 0; i < 7; i++) {
      const code = SITE.schedule[i];
      if (seen.indexOf(code) === -1) seen.push(code);
    }
    marketEl.innerHTML = seen.map(function (code) {
      const m = MARKETS[code];
      return '<option value="' + code + '">' + LS.esc(m.name) + ' · ' + LS.esc(m.dayLabel) + '</option>';
    }).join('');
  })();

  /* One record covers three shapes of report, so the labels move instead of
     the fields. Writing an index outlook under a box labelled "Ticker" is how
     you end up with a database full of tickers that are not tickers. */
  const FIELD_HINTS = {
    stock:  { ticker: 'AAPL',     company: 'Apple Inc.',                 target: '$150 to $168', last: '$121' },
    macro:  { ticker: 'NIFTY 50', company: 'The Indian equity market',   target: '24,800 to 26,100', last: '25,400' },
    sector: { ticker: 'IT',       company: 'Indian information technology', target: '38,000 to 41,500', last: '36,900' }
  };

  function paintFieldLabels() {
    const c = LS.coverage(marketEl.value);
    const hint = FIELD_HINTS[c.kind] || FIELD_HINTS.stock;

    document.getElementById('l-ticker').textContent = c.subject;
    document.getElementById('l-company').textContent = c.holder;
    document.getElementById('l-target').textContent = c.target;
    document.getElementById('l-last').textContent = c.last;

    document.getElementById('f-ticker').placeholder = hint.ticker;
    document.getElementById('f-company').placeholder = hint.company;
    document.getElementById('f-target').placeholder = hint.target;
    document.getElementById('f-last').placeholder = hint.last;
  }

  function paintMarket() {
    paintFieldLabels();
    if (!dateEl.value) { marketHint.textContent = ''; return; }
    const usual = LS.marketForDate(dateEl.value);
    if (marketEl.value === usual) {
      marketHint.textContent = LS.fmtDate(dateEl.value, 'short') + ' is normally ' + LS.market(usual).name + '.';
      marketHint.style.color = '';
    } else {
      marketHint.textContent = 'Note: ' + LS.fmtDate(dateEl.value, 'short') + ' is normally a ' +
        LS.market(usual).name + ' day. Publishing as ' + LS.market(marketEl.value).name + ' anyway.';
      marketHint.style.color = 'var(--brass)';
    }
  }
  dateEl.addEventListener('change', paintMarket);
  marketEl.addEventListener('change', paintMarket);

  /* ------------------------------------------------------- what is loaded
     There is no picker on this page. The form is either blank or editing one
     specific report, and the only way into that state is admin.html?edit=<id>,
     which the Edit buttons on the reports page and in the list below link to. */
  let rows = [];
  let editingId = '';

  /* Reflects the URL so a refresh keeps you on the same report, and so leaving
     edit mode does not leave a stale ?edit= behind. */
  function syncUrl() {
    const url = new URL(location.href);
    if (editingId) url.searchParams.set('edit', editingId);
    else url.searchParams.delete('edit');
    history.replaceState({}, '', url.pathname + url.search);
  }

  function paintEditingBar() {
    const editing = editingRow();
    const bar = document.getElementById('editingBar');
    document.getElementById('adminTitle').textContent = editing ? 'Edit report' : 'Publish a report';
    if (!editing) { bar.hidden = true; return; }
    bar.className = 'notice notice--info';
    bar.innerHTML = LS.icon('doc') +
      '<span>Editing <strong>' + LS.esc(editing.title) + '</strong> (' + LS.esc(editing.id) + ')' +
      (editing.is_published ? '' : ' · draft') +
      ' &nbsp; <a class="link" href="admin.html" id="leaveEdit">Start a new report instead</a></span>';
    bar.hidden = false;
  }

  /* Back to a blank slate, ready for the next report. */
  function resetForm() {
    form.reset();
    editingId = '';
    secWrap.innerHTML = '';
    addSection();
    dateEl.value = LS.toISO(new Date());
    /* Suggestion only. The dropdown stays editable and authoritative. */
    marketEl.value = LS.marketForDate(dateEl.value);
    document.getElementById('f-horizon').value = '12 months';
    document.getElementById('f-rating').value = 'Fairly valued';
    syncUrl();
    paintMarket();
    paintButtons();
    paintEditingBar();
    tally();
    markClean();
  }

  function loadInto(row) {
    if (!row) { resetForm(); return; }
    editingId = row.id;
    dateEl.value = row.published_on;
    /* A report written under the old week carries a code the dropdown no
       longer offers. market() maps it onto the closest current slot; without
       that the select would silently fall to blank and the next save would
       write an empty market. */
    marketEl.value = LS.market(row.market || LS.marketForDate(row.published_on)).code;
    document.getElementById('f-ticker').value = row.ticker || '';
    document.getElementById('f-exchange').value = row.exchange || '';
    document.getElementById('f-sector').value = row.sector || '';
    document.getElementById('f-company').value = row.company || '';
    document.getElementById('f-title').value = row.title || '';
    document.getElementById('f-standfirst').value = row.standfirst || '';
    /* A report written before the stances changed may hold a value that is no
       longer in the list. Offer it back rather than silently rewriting it on
       the next save. */
    const stanceEl = document.getElementById('f-rating');
    if (row.rating && !Array.prototype.some.call(stanceEl.options,
          function (o) { return o.value === row.rating; })) {
      const legacy = document.createElement('option');
      legacy.value = row.rating;
      legacy.textContent = row.rating + ' (retired)';
      stanceEl.appendChild(legacy);
    }
    stanceEl.value = row.rating || 'Fairly valued';
    document.getElementById('f-target').value = row.target || '';
    document.getElementById('f-last').value = row.last_price || '';
    document.getElementById('f-horizon').value = row.horizon || '12 months';
    secWrap.innerHTML = '';
    (row.body || []).forEach(function (s) { addSection(s.h, (s.p || []).join('\n\n')); });
    if (!secWrap.children.length) addSection();
    syncUrl();
    paintMarket();
    paintButtons();
    paintEditingBar();
    tally();
    /* Freshly loaded from the database, so nothing here is unsaved yet. */
    markClean();
  }

  /* Button labels follow what is actually being edited, so neither button can
     do something the label did not say. */
  const draftBtn = document.getElementById('draftBtn');
  const publishBtn = document.getElementById('publishBtn');
  const saveHint = document.getElementById('saveHint');

  function editingRow() {
    return rows.find(function (r) { return r.id === editingId; }) || null;
  }

  function paintButtons() {
    const editing = editingRow();
    const isLive = !!(editing && editing.is_published);
    draftBtn.textContent = isLive ? 'Save changes' : 'Save draft';
    publishBtn.textContent = isLive ? 'Save and open' : 'Publish report';
    saveHint.textContent = editing
      ? (isLive
          ? 'Editing a published report. Save changes keeps it live. '
          : 'Editing a draft. Save draft keeps it hidden until you publish. ')
      : 'Save draft keeps it hidden from readers. Publish makes it live straight away. ';
    saveHint.textContent += 'Either way the form clears afterwards.';
  }

  document.getElementById('newReport').addEventListener('click', function () {
    clearAutosave();
    resetForm();
    note.hidden = true;
  });

  /* ------------------------------------------------------------- autosave
     Anything typed but not yet saved is kept on this device, so a refresh, a
     closed tab or a stray click does not lose the work. It is cleared the
     moment the report reaches the database, and by the New / clear form
     button. This is separate from a saved draft: a draft lives in Supabase
     and shows in the list below, this is just the in progress form. */
  const AUTOSAVE_KEY = 'leoside.admin.autosave';
  const FIELDS = ['f-date','f-market','f-ticker','f-exchange','f-sector','f-company',
                  'f-title','f-standfirst','f-rating','f-target','f-last','f-horizon'];
  let autosaveTimer = null;

  /* Only genuinely unsaved typing is ever kept. `dirty` goes true when the
     person edits something and false the moment the work reaches the database
     or the form is reset. Without it, simply opening a saved report and
     leaving the page would write its own contents back as an "autosave", and
     you would be offered your own already saved work as if it were unsaved. */
  let dirty = false;
  function markClean() { dirty = false; }

  function snapshot() {
    const values = {};
    FIELDS.forEach(function (id) { values[id] = document.getElementById(id).value; });
    return { at: Date.now(), editingId: editingId, values: values, sections: collect() };
  }

  function hasContent(snap) {
    if (!snap || !snap.values) return false;
    const typed = ['f-ticker','f-company','f-title','f-standfirst','f-target','f-last','f-sector','f-exchange']
      .some(function (id) { return (snap.values[id] || '').trim(); });
    const written = (snap.sections || []).some(function (s) {
      return (s.h || '').trim() || (s.p || []).length;
    });
    return typed || written;
  }

  function writeAutosave() {
    if (!dirty) return;
    try {
      const snap = snapshot();
      if (!hasContent(snap)) { localStorage.removeItem(AUTOSAVE_KEY); return; }
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snap));
    } catch (e) { /* storage full or blocked, not worth interrupting for */ }
  }

  function clearAutosave() {
    markClean();
    clearTimeout(autosaveTimer);
    try { localStorage.removeItem(AUTOSAVE_KEY); } catch (e) {}
    const bar = document.getElementById('autosaveBar');
    if (bar) bar.hidden = true;
  }

  function readAutosave() {
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      const snap = raw ? JSON.parse(raw) : null;
      return hasContent(snap) ? snap : null;
    } catch (e) { return null; }
  }

  function applyAutosave(snap) {
    /* Restored work is unsaved by definition, so it stays dirty and keeps
       being kept until it is saved or discarded. */
    dirty = true;
    editingId = snap.editingId || '';
    FIELDS.forEach(function (id) {
      if (snap.values[id] !== undefined) document.getElementById(id).value = snap.values[id];
    });
    secWrap.innerHTML = '';
    (snap.sections || []).forEach(function (s) { addSection(s.h, (s.p || []).join('\n\n')); });
    if (!secWrap.children.length) addSection();
    syncUrl();
    paintMarket();
    paintButtons();
    paintEditingBar();
    tally();
  }

  function showAutosaveBar(snap) {
    const bar = document.getElementById('autosaveBar');
    const when = new Date(snap.at);
    const mins = Math.round((Date.now() - snap.at) / 60000);
    const ago = mins < 1 ? 'less than a minute ago'
      : mins < 60 ? mins + (mins === 1 ? ' minute ago' : ' minutes ago')
      : when.toLocaleString();
    bar.className = 'notice notice--ok';
    bar.innerHTML = LS.icon('check') +
      '<span>Picked up where you left off. This is what you had typed ' + ago +
      ', restored automatically. It is not saved to the site yet. ' +
      '<button class="btn btn--quiet btn--sm" type="button" id="discardAutosave">Discard it</button></span>';
    bar.hidden = false;
    document.getElementById('discardAutosave').addEventListener('click', function () {
      clearAutosave();
      resetForm();
    });
  }

  function touched() {
    dirty = true;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(writeAutosave, 400);
  }
  form.addEventListener('input', touched);
  form.addEventListener('change', touched);
  window.addEventListener('beforeunload', writeAutosave);

  /* ---------------------------------------------------------- draft list
     Drafts only. Published reports are edited and deleted from the archive,
     where they sit alongside everything readers can see. */
  const draftList = document.getElementById('draftList');

  function drafts() {
    return rows.filter(function (r) { return !r.is_published; });
  }

  function paintDrafts() {
    const list = drafts();
    if (!list.length) {
      draftList.innerHTML = '<li><div style="padding:1.4rem 1.35rem" class="muted small">' +
        'No drafts. Anything you save without publishing waits for you here.</div></li>';
      return;
    }
    draftList.innerHTML = list.map(function (r) {
      return '<li><div style="display:flex;align-items:center;gap:.9rem;padding:.95rem 1.35rem;flex-wrap:wrap">' +
        '<span style="min-width:0;flex:1 1 220px">' +
          '<span class="t">' + LS.esc(r.title) + '</span>' +
          '<span class="m">' + LS.esc(r.ticker) + ' · ' + LS.fmtDate(r.published_on, 'short') +
            ' · ' + LS.esc(LS.market(r.market).short) + '</span>' +
        '</span>' +
        '<span class="r" style="display:inline-flex;gap:.35rem;align-items:center">' +
          '<a class="btn btn--ghost btn--sm" href="admin.html?edit=' + encodeURIComponent(r.id) + '">Edit</a>' +
          '<button class="btn btn--sm" type="button" data-publish="' + LS.esc(r.id) + '">Publish</button>' +
          '<button class="btn btn--danger btn--sm" type="button" data-delete="' + LS.esc(r.id) + '">Delete</button>' +
        '</span>' +
      '</div></li>';
    }).join('');
  }

  /* Two step delete. First click arms, second within five seconds commits. */
  let armed = null, armedTimer = null;
  function disarm() {
    if (armed) { armed.removeAttribute('data-armed'); armed.textContent = 'Delete'; }
    armed = null;
    clearTimeout(armedTimer);
  }

  draftList.addEventListener('click', function (e) {
    /* Edit is a plain link to admin.html?edit=<id>, the one route into edit
       mode, so there is nothing to intercept for it. */

    const pubBtn = e.target.closest('[data-publish]');
    if (pubBtn) {
      disarm();
      publishDraft(pubBtn.getAttribute('data-publish'), pubBtn);
      return;
    }

    const delBtn = e.target.closest('[data-delete]');
    if (!delBtn) { disarm(); return; }

    const id = delBtn.getAttribute('data-delete');
    if (armed !== delBtn) {
      disarm();
      armed = delBtn;
      delBtn.setAttribute('data-armed', 'true');
      delBtn.textContent = 'Confirm delete';
      armedTimer = setTimeout(disarm, 5000);
      return;
    }

    disarm();
    delBtn.disabled = true;
    delBtn.textContent = 'Deleting…';

    Data.deleteReport(id).then(function (res) {
      if (!res.ok) {
        delBtn.disabled = false;
        delBtn.textContent = 'Delete';
        say('Could not delete that draft. ' + LS.esc(res.error), false);
        return;
      }
      rows = rows.filter(function (r) { return r.id !== id; });
      /* If the form was editing what we just removed, clear it. */
      if (editingId === id) resetForm();
      paintDrafts();
      paintEditingBar();
      say('Deleted draft <strong>' + LS.esc(id) + '</strong>.', true);
    });
  });

  /* Publish straight from the list, without loading it into the form first. */
  function publishDraft(id, btn) {
    const row = rows.find(function (r) { return r.id === id; });
    if (!row) return;

    btn.disabled = true;
    btn.textContent = 'Publishing…';

    SB.rpc('upsert_report', { p: {
      id: row.id,
      published_on: row.published_on,
      market: row.market,
      ticker: row.ticker,
      company: row.company,
      exchange: row.exchange,
      sector: row.sector,
      rating: row.rating,
      target: row.target,
      last_price: row.last_price,
      horizon: row.horizon,
      read_mins: String(row.read_mins || 1),
      title: row.title,
      standfirst: row.standfirst,
      body: row.body,
      is_published: true
    } }).then(function (res) {
      btn.disabled = false;
      btn.textContent = 'Publish';
      if (res.error) { fail(res.error); return; }
      row.is_published = true;
      paintDrafts();
      paintButtons();
      paintEditingBar();
      say('Published <strong>' + LS.esc(id) + '</strong>. ' +
          '<a class="link" href="report.html?id=' + encodeURIComponent(id) + '">Open it</a>. ' +
          'It is now edited and deleted from the reports page.', true);
    }).catch(function (err) {
      btn.disabled = false;
      btn.textContent = 'Publish';
      fail(err);
    });
  }

  /* Feeds the draft list and tells the form whether the report it is editing
     is already published. No dropdown is built from this. */
  function loadRows() {
    return SB.rpc('admin_list_reports').then(function (res) {
      rows = res.error ? [] : (res.data || []);
      paintDrafts();
    });
  }

  loadRows().then(function () {
    /* The only way into edit mode: admin.html?edit=some-report-id */
    const wanted = new URLSearchParams(location.search).get('edit');
    const row = wanted ? rows.find(function (r) { return r.id === wanted; }) : null;
    const snap = readAutosave();

    /* Unsaved work wins over a fresh copy from the database, but only when it
       belongs to the same thing you are opening. Restoring one report's
       half finished text over a different report would be worse than losing
       it, so that case loads the database version and offers the other. */
    if (row) {
      if (snap && snap.editingId === row.id) { applyAutosave(snap); showAutosaveBar(snap); }
      else { loadInto(row); }
      return;
    }

    if (wanted) {
      resetForm();
      say('No report matches <strong>' + LS.esc(wanted) + '</strong>. Starting a new one instead.', false);
      return;
    }

    if (snap && !snap.editingId) { applyAutosave(snap); showAutosaveBar(snap); return; }
    resetForm();
  });

  /* ------------------------------------------------------------------ save
     intent: 'publish' makes it live. 'draft' keeps it hidden, except when the
     report being edited is already published, in which case it preserves that
     state rather than quietly pulling a live report down. The button label
     changes to "Save changes" in that case so it says what it does. */
  function save(intent) {
    /* Let the browser flag missing required fields before anything is sent. */
    if (!form.reportValidity()) return;

    const body = collect();
    if (!body.length) { fail('Add at least one section with some text before saving.'); return; }

    const editing = editingRow();
    const isPublished = intent === 'publish' ? true : !!(editing && editing.is_published);

    const date = dateEl.value;
    const ticker = document.getElementById('f-ticker').value.trim().toUpperCase();
    const words = body.map(function (s) { return s.p.join(' '); }).join(' ').split(/\s+/).filter(Boolean).length;

    const payload = {
      id: editingId || (ticker.toLowerCase() + '-' + date),
      published_on: date,
      /* The dropdown decides, not the calendar. */
      market: marketEl.value,
      ticker: ticker,
      company: document.getElementById('f-company').value.trim(),
      exchange: document.getElementById('f-exchange').value.trim(),
      sector: document.getElementById('f-sector').value.trim(),
      rating: document.getElementById('f-rating').value,
      target: document.getElementById('f-target').value.trim(),
      last_price: document.getElementById('f-last').value.trim(),
      horizon: document.getElementById('f-horizon').value.trim(),
      read_mins: String(Math.max(1, Math.round(words / 200))),
      title: document.getElementById('f-title').value.trim(),
      standfirst: document.getElementById('f-standfirst').value.trim(),
      body: body,
      is_published: isPublished
    };

    const pressed = intent === 'publish' ? publishBtn : draftBtn;
    const restoreLabel = pressed.textContent;
    draftBtn.disabled = true;
    publishBtn.disabled = true;
    pressed.textContent = 'Saving…';

    function done() {
      draftBtn.disabled = false;
      publishBtn.disabled = false;
      pressed.textContent = restoreLabel;
    }

    SB.rpc('upsert_report', { p: payload }).then(function (res) {
      done();
      if (res.error) { fail(res.error); return; }

      const reportId = idFromResponse(res.data, payload.id);
      if (!reportId) { fail('The report saved but no id came back. Check the reports page.'); return; }

      /* Keep the in memory list current so the draft list below reflects the
         save without a page reload. */
      const saved = Object.assign({}, payload, { id: reportId, body: body });
      let at = -1;
      rows.forEach(function (r, i) { if (r.id === reportId) at = i; });
      if (at === -1) rows.unshift(saved); else rows[at] = saved;
      rows.sort(function (a, b) {
        return a.published_on === b.published_on ? 0 : (a.published_on < b.published_on ? 1 : -1);
      });

      /* The work is safely in the database now, so the local copy of the
         unsaved form can go. */
      clearAutosave();

      /* Publishing takes you to the live report. Saving a draft keeps you
         here with a clean form, and the draft appears in the list below. A
         draft never redirects, because get_report() filters on is_published
         and the page would just say "not found". */
      if (intent === 'publish' && isPublished) {
        say('Published <strong>' + LS.esc(reportId) + '</strong>. Opening it now…', true);
        location.href = 'report.html?id=' + encodeURIComponent(reportId);
        return;
      }

      resetForm();
      paintDrafts();

      say(isPublished
        ? 'Saved changes to <strong>' + LS.esc(reportId) + '</strong>, which stays published. ' +
          '<a class="link" href="report.html?id=' + encodeURIComponent(reportId) + '">Open it</a>.'
        : 'Saved <strong>' + LS.esc(reportId) + '</strong> as a draft. Nothing has been deleted: ' +
          'it is in <strong>Manage drafts</strong> at the bottom of this page, where you can edit, ' +
          'publish or delete it.', true);

    }).catch(function (err) {
      done();
      fail(err);
    });
  }

  draftBtn.addEventListener('click', function () { save('draft'); });
  publishBtn.addEventListener('click', function () { save('publish'); });

  /* Nothing fails quietly. Surface it in the page and in the console, and put
     it in front of the user so a failed save cannot look like a successful one. */
  function fail(err) {
    const message = typeof err === 'string'
      ? err
      : (err && (err.message || err.details || err.hint)) || 'Unknown error';
    console.error('[Leoside] save failed', err);
    say('Could not save. ' + LS.esc(message), false);
    window.alert('Could not save the report.\n\n' + message);
  }

  /* upsert_report is declared `returns text`, so PostgREST normally hands the
     id back as a bare string. Older or altered versions of the function can
     return it wrapped in an array or an object, and a void return gives null,
     which is how the redirect ended up at id=null. Normalise every shape, and
     fall back to the id we built here, since that is what the row was saved
     under either way. */
  function idFromResponse(data, fallback) {
    let value = data;
    if (Array.isArray(value)) value = value[0];
    if (value && typeof value === 'object') {
      value = value.upsert_report || value.id || value.report_id || null;
    }
    if (typeof value === 'string' && value.trim()) return value.trim();
    return (typeof fallback === 'string' && fallback.trim()) ? fallback.trim() : null;
  }

  function say(html, ok) {
    note.className = 'notice notice--' + (ok ? 'ok' : 'err');
    note.innerHTML = (ok ? LS.icon('check') : LS.icon('alert')) + '<span>' + html + '</span>';
    note.hidden = false;
    note.scrollIntoView({ block: 'nearest' });
  }
});
