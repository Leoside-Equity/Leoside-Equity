/* ==========================================================================
   Leoside Equity — sign up and sign in forms
   Both pages share this file. Everything routes through the Auth module, so
   it behaves the same whether the site is on localStorage or on Supabase.
   ========================================================================== */

Boot.start(document.getElementById('signupForm') ? 'signup' : 'signin', function () {
  'use strict';

  const signupForm = document.getElementById('signupForm');
  const signinForm = document.getElementById('signinForm');

  /* Where to send the visitor once they are in. */
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  function landing() {
    if (next && /^[\w.-]+\.html(\?[^#]*)?(#.*)?$/.test(next)) return next;
    return 'dashboard.html';
  }

  /* Already signed in? No reason to show a form. */
  if (Auth.current()) { location.replace(landing()); return; }

  /* ------------------------------------------------------------ side panel */
  const perks = document.getElementById('perks');
  if (perks) {
    const items = [
      ['Every report, in full', 'Reports open end to end rather than stopping at the summary.'],
      ['Two markets, seven days', 'India Sunday to Wednesday, United States Thursday to Saturday.'],
      ['Your own dashboard', 'Reports organised by month, week and day, plus what you have saved.'],
      ['No cost, no card', 'There is no paid tier. We do not ask for payment details at any point.']
    ];
    perks.innerHTML = items.map(function (i) {
      return '<li>' + LS.icon('check') + '<span><b>' + i[0] + '</b>' + i[1] + '</span></li>';
    }).join('');
  }

  /* --------------------------------------------------------------- helpers */
  function setInvalid(groupId, message) {
    const g = document.getElementById(groupId);
    if (!g) return;
    g.classList.add('is-invalid');
    if (message) { const e = g.querySelector('.err'); if (e) e.textContent = message; }
  }
  function clearInvalid() {
    Array.prototype.forEach.call(document.querySelectorAll('.form-group.is-invalid'), function (g) {
      g.classList.remove('is-invalid');
    });
    const err = document.getElementById('formError');
    if (err) err.hidden = true;
  }
  function showError(message) {
    const err = document.getElementById('formError');
    if (!err) return;
    err.className = 'notice notice--err';
    err.innerHTML = LS.icon('alert') + '<span>' + LS.esc(message) + '</span>';
    err.hidden = false;
    err.scrollIntoView({ block: 'nearest' });
  }
  function busy(form, on, label) {
    const btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  /* Show and hide the password without losing what has been typed. */
  const pwToggle = document.getElementById('pwToggle');
  if (pwToggle) {
    pwToggle.addEventListener('click', function () {
      const input = document.getElementById('password');
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      pwToggle.textContent = showing ? 'Show' : 'Hide';
      pwToggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      input.focus();
    });
  }

  /* ------------------------------------------------------------- Google */
  Array.prototype.forEach.call(document.querySelectorAll('[data-oauth]'), function (btn) {
    btn.addEventListener('click', function () {
      const note = document.getElementById('oauthNote');
      btn.disabled = true;
      Auth.signInWithGoogle().then(function (res) {
        btn.disabled = false;
        /* On success the browser is redirected to Google, so nothing below
           this line runs in the happy path. */
        if (!res.ok) {
          note.className = 'notice notice--info';
          note.innerHTML = LS.icon('info') + '<span>' + LS.esc(res.error) + '</span>';
          note.hidden = false;
        }
      });
    });
  });

  /* ---------------------------------------------------------------- sign up */
  if (signupForm) {
    const pw = document.getElementById('password');
    const meter = document.getElementById('meter');
    const hint = document.getElementById('pwHint');
    const words = ['Too short', 'Weak', 'Reasonable', 'Strong', 'Very strong'];

    pw.addEventListener('input', function () {
      const score = Auth.passwordScore(pw.value);
      meter.setAttribute('data-level', pw.value ? String(score) : '0');
      hint.textContent = pw.value
        ? words[score] + '. Longer is better than complicated.'
        : 'Use at least 8 characters. Longer is better than complicated.';
    });

    signupForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearInvalid();
      busy(signupForm, true, 'Creating your account…');

      Auth.signUp({
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        password: pw.value,
        market: document.getElementById('market').value,
        digestOptIn: document.getElementById('digest').checked,
        agreed: document.getElementById('terms').checked
      }).then(function (result) {
        busy(signupForm, false);

        if (!result.ok) {
          setInvalid('g-' + result.field, result.error);
          showError(result.error);
          const focus = document.getElementById(result.field === 'terms' ? 'terms' : result.field);
          if (focus) focus.focus();
          return;
        }

        /* With email confirmation switched on there is no session yet. */
        if (result.needsConfirmation) {
          signupForm.innerHTML =
            '<h1>Check your email</h1>' +
            '<div class="notice notice--ok">' + LS.icon('check') +
              '<span>Your account is created. We have sent a confirmation link to <strong>' +
              LS.esc(document.getElementById('email').value.trim()) +
              '</strong>. Click it and you are in.</span></div>' +
            '<p class="muted small">Nothing arrived? Check the spam folder, then try ' +
            '<a class="link" href="signin.html">signing in</a> to have it sent again.</p>';
          return;
        }

        location.href = landing();
      }).catch(function (err) {
        busy(signupForm, false);
        showError('Something went wrong creating that account. Please try again.');
        console.error(err);
      });
    });

    if (next) {
      const note = document.createElement('div');
      note.className = 'notice notice--info';
      note.innerHTML = LS.icon('lock') + '<span>Create your account and we will take you straight back to the report.</span>';
      signupForm.querySelector('h1').insertAdjacentElement('afterend', note);
    }
    const link = document.getElementById('toSignin');
    if (link && next) link.href = 'signin.html?next=' + encodeURIComponent(next);
  }

  /* ---------------------------------------------------------------- sign in */
  if (signinForm) {
    if (next) {
      const note = document.getElementById('gateNote');
      note.innerHTML = LS.icon('lock') + '<span>Sign in and we will return you to the report you were reading.</span>';
      note.hidden = false;
    }
    const link = document.getElementById('toSignup');
    if (link && next) link.href = 'signup.html?next=' + encodeURIComponent(next);

    signinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      clearInvalid();

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      if (!Auth.validEmail(email)) {
        setInvalid('g-email', 'Enter a valid email address.');
        return;
      }

      busy(signinForm, true, 'Signing you in…');
      Auth.signIn(email, password).then(function (result) {
        busy(signinForm, false);
        if (!result.ok) {
          setInvalid('g-password', result.error);
          showError(Auth.live
            ? 'We could not match that email and password. If you have just signed up, confirm your email address first.'
            : 'We could not match that email and password. If you have not registered on this browser yet, create a free account.');
          return;
        }
        location.href = landing();
      }).catch(function (err) {
        busy(signinForm, false);
        showError('Something went wrong signing in. Please try again.');
        console.error(err);
      });
    });

    const forgot = document.getElementById('forgot');
    if (forgot) forgot.addEventListener('click', function (e) {
      e.preventDefault();
      if (!Auth.live) {
        showError('Password resets need the backend, which is not connected yet. Once it is, this will send a reset link by email.');
        return;
      }
      const email = document.getElementById('email').value;
      if (!Auth.validEmail(email)) {
        setInvalid('g-email', 'Enter your email address first, then use this link.');
        return;
      }
      SB.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: location.origin + '/signin.html'
      }).then(function (res) {
        const err = document.getElementById('formError');
        err.className = res.error ? 'notice notice--err' : 'notice notice--ok';
        err.innerHTML = (res.error ? LS.icon('alert') : LS.icon('check')) +
          '<span>' + (res.error ? LS.esc(res.error.message) : 'Reset link sent. Check your email.') + '</span>';
        err.hidden = false;
      });
    });
  }
});
