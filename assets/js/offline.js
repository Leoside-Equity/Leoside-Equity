/* The offline page: retry on request, and reload by itself once the
   connection comes back. navigator.onLine only says an interface is up, not
   that the site is reachable, so it changes the wording, not the promise. */
(function () {
  'use strict';
  var status = document.getElementById('status');
  document.getElementById('retry').addEventListener('click', function () { location.reload(); });
  function paint() { status.textContent = navigator.onLine ? 'Back online. Reloading.' : 'Waiting for a connection'; }
  window.addEventListener('online', function () { paint(); setTimeout(function () { location.reload(); }, 700); });
  window.addEventListener('offline', paint);
  paint();
})();
