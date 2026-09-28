/* ==========================================================================
   Leoside Equity: sign up and sign in
   Both pages share this file. Everything goes through Auth, so it behaves the
   same on localStorage and on Supabase.
   ========================================================================== */

Boot.start(document.getElementById('signupForm') ? 'signup' : 'signin', function () {
  'use strict';

  const signupForm = document.getElementById('signupForm');
  const signinForm = document.getElementById('signinForm');
  const params = new URLSearchParams(location.search);
  const next = params.get('next');

  /* Only a page on this site is an acceptable destination: a bare file name
     with an optional query, never a scheme or another host. */
  function landing() {
    if (next && /^[\w.-]+\.html(\?[^#]*)?(#[\w-]*)?$/.test(next)) return next;
    return 'dashboard.html';
  }

  if (Auth.current()) { location.replace(landing()); return; }

  /* ------------------------------------------------------------ side panel */
  const facts = document.getElementById('perks');
  if (facts) {
    const items = signupForm ? [
      ['Every report, in full', 'Signed out you get the summary and the first ' + SITE.freeWords + ' words. Signed in, the whole report.'],
      ['Three markets', REGION_ORDER.map(function (c) { return REGIONS[c].name + ', ' + REGIONS[c].dayLabel; }).join('. ') + '.'],
      ['A dashboard', 'Reports by month, week and day, a saved list, and what you have already read.'],
      ['Your data stays yours', 'Download everything we hold about you, or delete the account and all of it, from your dashboard.']
    ] : [
      ['Saved reports', 'Everything you bookmarked, where you left it.'],
      ['Reading history', 'The last forty reports you opened.'],
      ['Account and privacy', 'Change your details, download your data, or delete the account.']
    ];
    facts.innerHTML = items.map(function (i) {
      return '<div><dt>' + LS.esc(i[0]) + '</dt><dd>' + LS.esc(i[1]) + '</dd></div>';
    }).join('');
  }

  /* --------------------------------------------------------------- helpers */
  function group(id) { return document.getElementById('g-' + id); }
  function setInvalid(field, message) {
    const g = group(field);
    if (!g) return;
    g.classList.add('is-invalid');
    const e = g.querySelector('.err');
    if (e && message) e.textContent = message;
    const input = g.querySelector('input, select');
    if (input) input.setAttribute('aria-invalid', 'true');
  }
  function clearInvalid() {
    document.querySelectorAll('.form-group.is-invalid').forEach(function (g) {
      g.classList.remove('is-invalid');
      g.querySelectorAll('[aria-invalid]').forEach(function (i) { i.removeAttribute('aria-invalid'); });
    });
    const err = document.getElementById('formError');
    if (err) err.hidden = true;
  }
  function showError(message) {
    const err = document.getElementById('formError');
    if (!err) return;
    err.innerHTML = LS.icon('alert') + '<span>' + LS.esc(message) + '</span>';
    err.hidden = false;
    err.scrollIntoView({ block: 'nearest' });
  }
  function busy(form, on) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('is-busy', on);
    btn.setAttribute('aria-busy', String(on));
  }

  /* Show and hide a password without losing what was typed. */
  document.querySelectorAll('.pw-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = document.getElementById(btn.getAttribute('aria-controls'));
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Show' : 'Hide';
      btn.setAttribute('aria-pressed', String(!showing));
      btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    });
  });

  /* ---------------------------------------------------------------- Google */
  document.querySelectorAll('[data-oauth]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const note = document.getElementById('oauthNote');
      btn.disabled = true;
      btn.classList.add('is-busy');
      Auth.signInWithGoogle().then(function (res) {
        if (!res.ok) {
          btn.disabled = false;
          btn.classList.remove('is-busy');
          note.innerHTML = LS.icon('info') + '<span>' + LS.esc(res.error) + '</span>';
          note.hidden = false;
        }
      });
    });
  });

  /* ------------------------------------------------------------- sign up */
  if (signupForm) {
    const BLOCK_KEY = 'leoside.age_block';
    function blocked() {
      try { const t = +localStorage.getItem(BLOCK_KEY); return t && Date.now() - t < 864e5; } catch (e) { return false; }
    }
    function showBlocked() {
      signupForm.innerHTML =
        '<h1>We cannot create an account for you</h1>' +
        '<div class="notice notice--info" role="status">' + LS.icon('info') +
          '<span>Accounts on Leoside Equity are for people aged ' + SITE.minAge + ' and over. Nothing you entered has been kept.</span></div>' +
        '<p class="muted">The home page and the research method stay open to everyone.</p>' +
        '<div class="row"><a class="btn" href="/">Home page</a><a class="btn btn--ghost" href="method.html">Research method</a></div>';
    }
    if (blocked() || params.get('under') === '1') { showBlocked(); return; }

    document.getElementById('dobSlot').outerHTML = LS.dobFields('su', 'g-dob');
    LS.wireDob('su', function (band) {
      group('guardian').hidden = band !== '13-17';
      if (band !== '13-17') document.getElementById('guardian').checked = false;
    });

    const marketBox = document.getElementById('marketChoices');
    marketBox.innerHTML = Auth.MARKET_CODES.map(function (code) {
      return '<label class="checkset__item"><input type="checkbox" name="market" value="' + code + '" checked>' +
        '<span class="tag tag--' + REGIONS[code].slug + '">' + LS.esc(REGIONS[code].name) + '</span></label>';
    }).join('');

    const pw = document.getElementById('password');
    const meter = document.getElementById('meter');
    const hint = document.getElementById('pwHint');
    const words = ['Too short', 'Weak', 'Reasonable', 'Strong', 'Very strong'];
    pw.addEventListener('input', function () {
      const score = Auth.passwordScore(pw.value);
      meter.setAttribute('data-level', pw.value ? String(score) : '0');
      hint.textContent = pw.value
        ? words[score] + '. A long phrase beats a short jumble.'
        : 'At least ' + Auth.MIN_PASSWORD + ' characters. A long phrase beats a short jumble.';
    });

    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearInvalid();

      const band = Auth.ageBand(LS.readDob('su'));
      if (band === 'under') {
        try { localStorage.setItem(BLOCK_KEY, String(Date.now())); } catch (x) {}
        showBlocked();
        return;
      }

      busy(signupForm, true);
      Auth.signUp({
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: pw.value,
        market: Array.prototype.map.call(document.querySelectorAll('#marketChoices input:checked'), function (i) { return i.value; }),
        ageBand: band,
        guardian: document.getElementById('guardian').checked,
        agreed: document.getElementById('terms').checked,
        utm: LS.utm()
      }).then(function (result) {
        busy(signupForm, false);
        if (!result.ok) {
          setInvalid(result.field, result.error);
          showError(result.error);
          const focus = result.field === 'dob' ? document.getElementById('suDay') : document.getElementById(result.field);
          if (focus) focus.focus();
          return;
        }
        if (result.needsConfirmation) {
          signupForm.innerHTML =
            '<h1>Check your email</h1>' +
            '<div class="notice notice--ok" role="status">' + LS.icon('check') +
              '<span>Your account is created. We sent a confirmation link to <strong>' +
              LS.esc(document.getElementById('email').value.trim()) + '</strong>. Open it and you are signed in.</span></div>' +
            '<p class="muted">Nothing there after a few minutes? Check spam, then try <a class="link" href="signin.html">signing in</a> to have it sent again.</p>';
          return;
        }
        location.href = landing();
      }).catch(function (err) {
        busy(signupForm, false);
        showError('Something went wrong creating the account. Please try again.');
        console.error(err);
      });
    });

    if (next) {
      const n = document.createElement('div');
      n.className = 'notice notice--info';
      n.innerHTML = LS.icon('lock') + '<span>Create your account and we will take you straight back to the report.</span>';
      signupForm.querySelector('h1').insertAdjacentElement('afterend', n);
      document.getElementById('toSignin').href = 'signin.html?next=' + encodeURIComponent(next);
    }
  }

  /* ------------------------------------------------------------- sign in */
  if (signinForm) {
    if (next) {
      const note = document.getElementById('gateNote');
      note.innerHTML = LS.icon('lock') + '<span>Sign in and we will return you to the report you were reading.</span>';
      note.hidden = false;
      document.getElementById('toSignup').href = 'signup.html?next=' + encodeURIComponent(next);
    }

    signinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearInvalid();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      if (!Auth.validEmail(email)) { setInvalid('email', 'Enter the email address you signed up with.'); document.getElementById('email').focus(); return; }
      if (!password) { setInvalid('password', 'Enter your password.'); document.getElementById('password').focus(); return; }

      busy(signinForm, true);
      Auth.signIn(email, password, document.getElementById('remember').checked).then(function (result) {
        busy(signinForm, false);
        if (!result.ok) {
          setInvalid(result.field, result.error);
          showError(result.error);
          return;
        }
        location.href = landing();
      }).catch(function (err) {
        busy(signinForm, false);
        showError('Something went wrong signing in. Please try again.');
        console.error(err);
      });
    });

    /* -------------------------------------------------- forgot password
       Nothing is sent until an address is typed here and the button pressed,
       and the button rests for a minute after each send. */
    const panel = document.getElementById('forgotPanel');
    const fEmail = document.getElementById('forgotEmail');
    const fSend = document.getElementById('forgotSend');
    const fError = document.getElementById('forgotError');
    const fSent = document.getElementById('forgotSent');

    function openForgot() {
      clearInvalid();
      panel.hidden = false;
      const typed = document.getElementById('email').value.trim();
      if (typed) fEmail.value = typed;
      fSend.disabled = !Auth.validEmail(fEmail.value);
      fEmail.focus();
    }
    document.getElementById('forgot').addEventListener('click', function (e) { e.preventDefault(); openForgot(); });
    if (params.get('forgot') === '1') openForgot();

    if (params.get('reset') === '1') {
      const done = document.getElementById('resetDone');
      done.innerHTML = LS.icon('check') + '<span>Password updated. Sign in with the new one.</span>';
      done.hidden = false;
    }

    document.getElementById('forgotCancel').addEventListener('click', function () {
      panel.hidden = true; fError.hidden = true; fSent.hidden = true;
      document.getElementById('forgot').focus();
    });
    fEmail.addEventListener('input', function () {
      fSend.disabled = !Auth.validEmail(fEmail.value);
      fError.hidden = true;
    });
    fSend.addEventListener('click', function () {
      const email = fEmail.value.trim();
      if (!Auth.validEmail(email)) return;
      fSend.disabled = true;
      fSend.classList.add('is-busy');
      fError.hidden = true;
      Auth.sendPasswordReset(email).then(function (res) {
        fSend.classList.remove('is-busy');
        if (!res.ok) {
          fSend.disabled = false;
          fError.innerHTML = LS.icon('alert') + '<span>' + LS.esc(res.error) + '</span>';
          fError.hidden = false;
          return;
        }
        /* Does not say whether the address has an account, so nobody can use
           this form to find out who is registered. */
        fSent.innerHTML = LS.icon('check') + '<span>If <strong>' + LS.esc(email) + '</strong> has an account, a reset link is on its way. It works once.</span>';
        fSent.hidden = false;
        let wait = 60;
        fSend.textContent = 'Send again in ' + wait + 's';
        const t = setInterval(function () {
          wait--;
          if (wait <= 0) { clearInterval(t); fSend.textContent = 'Send the reset link'; fSend.disabled = false; return; }
          fSend.textContent = 'Send again in ' + wait + 's';
        }, 1000);
      });
    });
  }
});
