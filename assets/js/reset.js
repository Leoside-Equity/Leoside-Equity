/* ==========================================================================
   Leoside Equity: choose a new password after following a reset link
   --------------------------------------------------------------------------
   The link carries a one time recovery token. supabase-js exchanges it for a
   session on arrival (detectSessionInUrl), which is what allows the password
   to be changed here. Afterwards the session is ended on purpose, so the
   reader proves the new password works by signing in with it.
   ========================================================================== */

Boot.start('reset', function () {
  'use strict';

  const form = document.getElementById('resetForm');
  const who = document.getElementById('resetWho');
  const fields = document.getElementById('resetFields');
  const dead = document.getElementById('resetDead');
  const errBox = document.getElementById('resetError');
  const pw = document.getElementById('password');
  const confirm = document.getElementById('confirm');
  const goBtn = document.getElementById('resetGo');

  const facts = document.getElementById('perks');
  if (facts) {
    facts.innerHTML = [
      ['Only you can be here', 'The link proved you can read the inbox on this account.'],
      ['It works once', 'The link stops working as soon as the password changes.'],
      ['Nothing else changes', 'Saved reports and reading history stay as they were.']
    ].map(function (i) { return '<div><dt>' + i[0] + '</dt><dd>' + i[1] + '</dd></div>'; }).join('');
  }

  if (!Auth.live) {
    who.textContent = 'Password resets need the backend, which is off in this build.';
    dead.hidden = false;
    return;
  }

  const user = Auth.current();
  if (!user) {
    who.textContent = 'This reset link has expired or has already been used.';
    dead.hidden = false;
    return;
  }

  who.innerHTML = 'Setting a new password for <strong>' + LS.esc(user.email) + '</strong>.';
  fields.hidden = false;

  /* Take the token out of the address bar so it is not left in history. */
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);

  const meter = document.getElementById('meter');
  const hint = document.getElementById('pwHint');
  const words = ['Too short', 'Weak', 'Reasonable', 'Strong', 'Very strong'];
  pw.addEventListener('input', function () {
    const score = Auth.passwordScore(pw.value);
    meter.setAttribute('data-level', pw.value ? String(score) : '0');
    hint.textContent = pw.value ? words[score] + '. A long phrase beats a short jumble.'
      : 'At least ' + Auth.MIN_PASSWORD + ' characters. A long phrase beats a short jumble.';
  });

  document.querySelectorAll('.pw-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const input = document.getElementById(btn.getAttribute('aria-controls'));
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.textContent = showing ? 'Show' : 'Hide';
      btn.setAttribute('aria-pressed', String(!showing));
    });
  });

  function clearInvalid() {
    document.querySelectorAll('.form-group.is-invalid').forEach(function (g) { g.classList.remove('is-invalid'); });
    errBox.hidden = true;
  }
  function fail(groupId, message) {
    if (groupId) document.getElementById(groupId).classList.add('is-invalid');
    errBox.innerHTML = LS.icon('alert') + '<span>' + LS.esc(message) + '</span>';
    errBox.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearInvalid();
    if (pw.value.length < Auth.MIN_PASSWORD) { fail('g-password', 'Use at least ' + Auth.MIN_PASSWORD + ' characters.'); pw.focus(); return; }
    if (pw.value.length > 72) { fail('g-password', 'Use 72 characters or fewer.'); pw.focus(); return; }
    if (pw.value !== confirm.value) { fail('g-confirm', 'The two passwords do not match.'); confirm.focus(); return; }

    goBtn.disabled = true;
    goBtn.classList.add('is-busy');
    Promise.resolve(SB.auth.updateUser({ password: pw.value })).then(function (res) {
      if (res && res.error) {
        goBtn.disabled = false;
        goBtn.classList.remove('is-busy');
        fail('g-password', Auth.friendly(res.error.message, res.error.message || 'That password could not be saved.'));
        return;
      }
      return Promise.resolve(Auth.signOut()).then(function () { location.replace('signin.html?reset=1'); });
    }).catch(function (err) {
      goBtn.disabled = false;
      goBtn.classList.remove('is-busy');
      console.error('[Leoside] password update failed:', err);
      fail(null, 'Something went wrong saving that password. Please try the link again.');
    });
  });
});
