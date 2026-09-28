/* ==========================================================================
   Leoside Equity: first script on every page, loaded in the head
   --------------------------------------------------------------------------
   Kept tiny and synchronous so the right theme is applied before the first
   paint. Lives in a file rather than inline so the Content Security Policy
   can forbid inline script entirely.
   ========================================================================== */
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');
  try {
    var t = localStorage.getItem('leoside.theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    root.setAttribute('data-theme', t);
  } catch (e) {
    root.setAttribute('data-theme', 'light');
  }

  /* beforeinstallprompt can fire before the page scripts at the end of the
     body have run. Catch it here so the install button can use it later. */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__leosideInstall = e;
  });
})();
