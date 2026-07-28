/* ==========================================================================
   Leoside Equity: set a new password after following a reset link
   --------------------------------------------------------------------------
   What was going wrong before this page existed.

   A Supabase reset link does not carry a "change your password" screen of its
   own. It carries a one time recovery token. When the link is opened,
   supabase-js reads that token out of the URL and establishes a real session,
   which is exactly how the browser earns the right to set a new password.

   The old redirect pointed at signin.html, and signin.html sends anyone with
   a session straight to the dashboard. So the token did its job, the session
   appeared, and the reader was bounced to the dashboard signed in, with no
   opportunity to type a new password. It looked like the link was logging
   people in instead of resetting anything. It was: that is the intended first
   half, and the second half was missing.

   This page is the second half. It waits for the recovery session, takes the
   new password, calls updateUser, then deliberately signs the session out so
   the reader proves the new password works on the way back in.
   ========================================================================== */

Boot.start('reset', function () {
  'use strict';

  const form    = document.getElementById('resetForm');
  const who     = document.getElementById('resetWho');
  const fields  = document.getElementById('resetFields');
  const dead    = document.getElementById('resetDead');
  const errBox  = document.getElementById('resetError');
  const pw      = document.getElementById('password');
  const confirm = document.getElementById('confirm');
  const goBtn   = document.getElementById('resetGo');

  const perks = document.getElementById('perks');
  if (perks) {
    perks.innerHTML = [
      ['Only you can be here', 'The link proved you control the inbox on this account.'],
      ['One use only', 'The link stops working the moment the password changes.'],
      ['Nothing else changes', 'Your saved reports and reading history stay exactly as they were.']
    ].map(function (i) {
      return '<li>' + LS.icon('check') + '<span><b>' + i[0] + '</b>' + i[1] + '</span></li>';
    }).join('');
  }

  if (!Auth.live) {
    who.textContent = 'Password resets need the backend, which is not connected on this build.';
    dead.hidden = false;
    return;
  }

  /* ---------------------------------------------------- find the session
     Auth.ready has already run getSession(), and config.js sets
     detectSessionInUrl, so by the time we get here the recovery token in the
     URL hash has been exchanged for a session if it was valid. */
  const user = Auth.current();

  if (!user) {
    who.textContent = 'This reset link is no longer valid.';
    dead.hidden = false;
    return;
  }

  who.innerHTML = 'Setting a new password for <strong>' + LS.esc(user.email) + '</strong>.';
  fields.hidden = false;

  /* Tidy the token out of the address bar so it is not left in history or
     copied into a screenshot. The session is already established. */
  if (location.hash) {
    history.replaceState({}, '', location.pathname + location.search);
  }

  /* -------------------------------------------------------- strength meter */
  const meter = document.getElementById('meter');
  const hint  = document.getElementById('pwHint');
  const words = ['Too short', 'Weak', 'Reasonable', 'Strong', 'Very strong'];

  pw.addEventListener('input', function () {
    const score = Auth.passwordScore(pw.value);
    meter.setAttribute('data-level', pw.value ? String(score) : '0');
    hint.textContent = pw.value
      ? words[score] + '. Longer is better than complicated.'
      : 'Use at least 8 characters. Longer is better than complicated.';
  });

  /* -------------------------------------------------------- show and hide */
  document.getElementById('pwToggle').addEventListener('click', function () {
    const btn = document.getElementById('pwToggle');
    const showing = pw.type === 'text';
    pw.type = showing ? 'password' : 'text';
    btn.textContent = showing ? 'Show' : 'Hide';
    pw.focus();
  });

  /* ---------------------------------------------------------------- submit */
  function clearInvalid() {
    Array.prototype.forEach.call(document.querySelectorAll('.form-group.is-invalid'), function (g) {
      g.classList.remove('is-invalid');
    });
    errBox.hidden = true;
  }
  function fail(groupId, message) {
    if (groupId) document.getElementById(groupId).classList.add('is-invalid');
    errBox.className = 'notice notice--err';
    errBox.innerHTML = LS.icon('alert') + '<span>' + LS.esc(message) + '</span>';
    errBox.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearInvalid();

    if (pw.value.length < 8) { fail('g-password', 'Use at least 8 characters.'); pw.focus(); return; }
    if (pw.value !== confirm.value) { fail('g-confirm', 'The two passwords do not match.'); confirm.focus(); return; }

    goBtn.disabled = true;
    goBtn.textContent = 'Saving…';

    Promise.resolve(SB.auth.updateUser({ password: pw.value })).then(function (res) {
      if (res && res.error) {
        goBtn.disabled = false;
        goBtn.textContent = 'Save new password';
        fail('g-password', res.error.message);
        return;
      }

      /* End the recovery session on purpose. The reader signs back in with
         the password they just chose, which proves it took. */
      return Promise.resolve(Auth.signOut()).then(function () {
        location.replace('signin.html?reset=1');
      });
    }).catch(function (err) {
      goBtn.disabled = false;
      goBtn.textContent = 'Save new password';
      console.error('[Leoside] password update failed:', err);
      fail(null, 'Something went wrong saving that password. Please try the link again.');
    });
  });
});
