/* ==========================================================================
   Leoside Equity: publishing screen
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

  /* Three markets, in the order the week meets them. Nothing about the shape
     of the report is chosen here: that is visible from reading it. */
  marketEl.innerHTML = REGION_ORDER.map(function (code) {
    return '<option value="' + code + '">' + LS.esc(REGIONS[code].name) + '</option>';
  }).join('');

  /* The valuation block only applies where there is a share price to compare
     against. On a market or a sector note those boxes are hidden rather than
     left blank, so nothing can be half filled in and saved. */
  const valuationBlock = document.getElementById('valuationBlock');
  const PLACEHOLDERS = {
    US: { ticker: 'AAPL',     company: 'Apple Inc.',              exchange: 'Nasdaq', sector: 'Technology' },
    UK: { ticker: 'SHEL',     company: 'Shell plc',               exchange: 'LSE',    sector: 'Energy' },
    IN: { ticker: 'NIFTY 50', company: 'The Indian equity market', exchange: 'NSE',    sector: 'Index' }
  };

  function paintMarket() {
    const code = marketEl.value;
    const priced = LS.hasValuation(code);
    const hint = PLACEHOLDERS[code] || PLACEHOLDERS.US;

    valuationBlock.hidden = !priced;
    /* A hidden required field blocks submission with a message nobody can see,
       so requiredness follows visibility. */
    Array.prototype.forEach.call(valuationBlock.querySelectorAll('input, select'), function (el) {
      el.disabled = !priced;
    });

    document.getElementById('f-ticker').placeholder = hint.ticker;
    document.getElementById('f-company').placeholder = hint.company;
    document.getElementById('f-exchange').placeholder = hint.exchange;
    document.getElementById('f-sector').placeholder = hint.sector;

    if (!dateEl.value) { marketHint.textContent = ''; return; }
    const usual = LS.marketForDate(dateEl.value);
    if (code === usual) {
      marketHint.textContent = LS.fmtDate(dateEl.value, 'short') + ' is normally ' + LS.market(usual).name + '.';
      marketHint.style.color = '';
    } else {
      marketHint.textContent = 'Note: ' + LS.fmtDate(dateEl.value, 'short') + ' is normally a ' +
        LS.market(usual).name + ' day. Publishing as ' + LS.market(code).name + ' anyway.';
      marketHint.style.color = 'var(--brass)';
    }
  }
  /* ---------------------------------------------------------- the date
     Three states, and the form says which one it is in before anything is
     saved rather than after.

       before today   refused. The picker will not offer it and the database
                      rejects it too, so a crafted API call cannot backdate
                      a report either.
       today          publishes straight away.
       later          held as a scheduled draft and goes live at 06:00 on the
                      day, without anything needing to run at six o'clock.

     Dates are compared as plain YYYY-MM-DD strings. That is not laziness: it
     avoids every timezone trap that comes with turning a date input into a
     Date object, and the strings sort correctly by definition. */
  function todayISO() { return LS.toISO(new Date()); }

  function dateState() {
    const v = dateEl.value;
    if (!v) return 'empty';
    const t = todayISO();
    if (v < t) return 'past';
    if (v === t) return 'today';
    return 'future';
  }

  /* The picker itself refuses yesterday. Re-applied on every paint because a
     form left open overnight would otherwise still be offering the old date. */
  function clampDate() {
    dateEl.min = todayISO();
    if (dateEl.value && dateEl.value < dateEl.min) dateEl.value = dateEl.min;
  }

  const dateHint = document.getElementById('dateHint');

  function paintDate() {
    clampDate();
    if (!dateHint) return;

    const state = dateState();
    if (state === 'future') {
      dateHint.innerHTML = LS.icon('clock') +
        '<span>Scheduled. Publishing saves it to drafts and it goes live at ' +
        '<strong>6:00 am on ' + LS.esc(LS.fmtDate(dateEl.value, 'short')) + '</strong>. ' +
        'You can edit or delete it until then.</span>';
      dateHint.className = 'hint hint--scheduled';
    } else if (state === 'today') {
      dateHint.innerHTML = LS.icon('check') + '<span>Publishing puts this live straight away.</span>';
      dateHint.className = 'hint hint--now';
    } else {
      dateHint.textContent = '';
      dateHint.className = 'hint';
    }
    paintButtons();
  }

  dateEl.addEventListener('change', function () { paintDate(); paintMarket(); });
  dateEl.addEventListener('input', paintDate);
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
    paintDate();
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
    paintDate();
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
    const scheduled = dateState() === 'future';

    draftBtn.textContent = isLive ? 'Save changes' : 'Save draft';
    /* The primary button says what it will actually do. Calling it "Publish"
       on a future date would be a lie: nothing becomes readable that day. */
    publishBtn.textContent = isLive
      ? 'Save and open'
      : (scheduled ? 'Schedule report' : 'Publish report');

    saveHint.textContent = editing
      ? (isLive
          ? 'Editing a published report. Save changes keeps it live. '
          : 'Editing a draft. Save draft keeps it hidden until you publish. ')
      : (scheduled
          ? 'Save draft keeps it hidden with no date attached. Schedule holds it in drafts and releases it at 6:00 am on the chosen day. '
          : 'Save draft keeps it hidden from readers. Publish makes it live straight away. ');
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
    paintDate();
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

  /* "Wed, 30 Jul at 6:00 am", for a report that is waiting its turn. */
  function goLiveLabel(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const hour = d.getHours();
    const mins = String(d.getMinutes()).padStart(2, '0');
    const suffix = hour < 12 ? 'am' : 'pm';
    const h12 = ((hour + 11) % 12) + 1;
    return LS.fmtDate(LS.toISO(d), 'short') + ' at ' + h12 + ':' + mins + ' ' + suffix;
  }

  function paintDrafts() {
    const list = drafts();
    if (!list.length) {
      draftList.innerHTML = '<li><div style="padding:1.4rem 1.35rem" class="muted small">' +
        'No drafts. Anything you save without publishing, or schedule for a later day, waits for you here.</div></li>';
      return;
    }
    draftList.innerHTML = list.map(function (r) {
      /* A scheduled report is a draft with a date on it. Shown as such, with
         the moment it goes out, so the queue can be read at a glance. */
      const scheduled = !!r.go_live_at && new Date(r.go_live_at) > new Date();

      return '<li><div style="display:flex;align-items:center;gap:.9rem;padding:.95rem 1.35rem;flex-wrap:wrap">' +
        '<span style="min-width:0;flex:1 1 220px">' +
          '<span class="t">' + LS.esc(r.title) +
            (scheduled ? ' <span class="tag tag--brass">Scheduled</span>' : '') + '</span>' +
          '<span class="m">' + LS.esc(r.ticker) + ' · ' + LS.fmtDate(r.published_on, 'short') +
            ' · ' + LS.esc(LS.market(r.market).name) +
            (scheduled ? ' · goes live ' + LS.esc(goLiveLabel(r.go_live_at)) : '') + '</span>' +
        '</span>' +
        '<span class="r" style="display:inline-flex;gap:.35rem;align-items:center">' +
          '<a class="btn btn--ghost btn--sm" href="admin.html?edit=' + encodeURIComponent(r.id) + '">Edit</a>' +
          /* Publishing a scheduled report early is a legitimate thing to want,
             so the button stays, relabelled so it is clear what it overrides. */
          '<button class="btn btn--sm" type="button" data-publish="' + LS.esc(r.id) + '">' +
            (scheduled ? 'Publish now' : 'Publish') + '</button>' +
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

  /* Publish straight from the list, without loading it into the form first.

     The date is forced to today. A draft written last week carries a date the
     database now refuses, and a scheduled report published early would simply
     be rescheduled if its future date were sent back unchanged. Publishing
     something today means it is dated today. */
  function publishDraft(id, btn) {
    const row = rows.find(function (r) { return r.id === id; });
    if (!row) return;

    btn.disabled = true;
    btn.textContent = 'Publishing…';

    const p = {
      id: row.id,
      published_on: todayISO(),
      market: row.market,
      ticker: row.ticker,
      company: row.company,
      exchange: row.exchange,
      sector: row.sector,
      read_mins: String(row.read_mins || 1),
      title: row.title,
      standfirst: row.standfirst,
      body: row.body,
      is_published: true
    };
    /* Same rule as the form. A draft saved before the market was changed can
       still be carrying a stance, and replaying it here would put it back into
       a market that has no valuation. */
    if (LS.hasValuation(row.market)) {
      p.rating = row.rating;
      p.target = row.target;
      p.last_price = row.last_price;
      p.horizon = row.horizon;
    }

    SB.rpc('upsert_report', { p: p }).then(function (res) {
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

    /* Caught here as well as in the database. The date input's min attribute
       stops the picker offering it, but a typed date can still get through,
       and a clear message beats a constraint violation. */
    if (dateState() === 'past') {
      fail('That date has already passed. Reports cannot be backdated, so pick today or a later day.');
      dateEl.focus();
      return;
    }

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
      read_mins: String(Math.max(1, Math.round(words / 200))),
      title: document.getElementById('f-title').value.trim(),
      standfirst: document.getElementById('f-standfirst').value.trim(),
      body: body,
      is_published: isPublished
    };

    /* The valuation fields are added only where there is a share price to
       compare against. On a market without one the keys are left out of the
       payload entirely rather than sent as null or as an empty string: the
       database reads them with p->>'key', a missing key is SQL NULL, and that
       is the one value no CHECK constraint can reject.

       Sending them at all was also how a stance typed for a US note could
       survive a switch to India and be stored against it. */
    if (LS.hasValuation(marketEl.value)) {
      payload.rating = document.getElementById('f-rating').value;
      payload.target = document.getElementById('f-target').value.trim();
      payload.last_price = document.getElementById('f-last').value.trim();
      payload.horizon = document.getElementById('f-horizon').value.trim();
    }

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
  /* A check constraint rejection means the database is on an older shape than
     the form expects. The raw message names the constraint but not the fix, so
     the ones we know about are translated into the migration that resolves
     them. Anything else is passed through untouched. */
  const CONSTRAINT_HELP = {
    reports_rating_check:
      'The database still restricts the valuation stance to an older list. ' +
      'Run supabase/apply_now.sql in the Supabase SQL editor.',
    reports_market_check:
      'The database still expects the old market codes (IN_MACRO, IN_SECTOR). ' +
      'Run supabase/apply_now.sql in the Supabase SQL editor.',
    profiles_market_check:
      'The database still expects a single market per reader. ' +
      'Run supabase/apply_now.sql in the Supabase SQL editor.'
  };

  function explain(message) {
    const hit = Object.keys(CONSTRAINT_HELP).find(function (name) {
      return String(message).indexOf(name) !== -1;
    });
    return hit ? CONSTRAINT_HELP[hit] + '\n\n(' + message + ')' : message;
  }

  function fail(err) {
    const raw = typeof err === 'string'
      ? err
      : (err && (err.message || err.details || err.hint)) || 'Unknown error';
    const message = explain(raw);
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
