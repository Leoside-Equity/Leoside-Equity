/* ==========================================================================
   Leoside Equity: service worker
   --------------------------------------------------------------------------
   Lets the site install as an app and show an offline page. Deliberately
   conservative:

   - caches only this site's own files (pages, stylesheet, scripts, fonts,
     icons), never anything from Supabase. Reports, sessions and saved lists
     always go to the network, so one reader can never be shown a cached
     response meant for another
   - network first: with a connection you always get the current site; the
     cache is only a fallback
   - only GET requests, and only same origin
   ========================================================================== */

/* Bump when the list below changes. */
const CACHE = 'leoside-shell-v6';

const SHELL = [
  '/', '/index.html', '/reports.html', '/about.html', '/method.html',
  '/signin.html', '/signup.html', '/terms.html', '/privacy.html',
  '/disclaimer.html', '/accessibility.html', '/copyright.html',
  '/offline.html', '/404.html',
  '/assets/css/styles.css',
  '/assets/fonts/playfair-display-var.woff2', '/assets/fonts/inter-var.woff2',
  '/assets/fonts/plex-mono-400-normal.woff2', '/assets/fonts/plex-mono-500-normal.woff2',
  '/assets/vendor/supabase-2.117.1.js',
  '/assets/js/boot.js', '/assets/js/config.js', '/assets/js/data.js', '/assets/js/auth.js',
  '/assets/js/store.js', '/assets/js/app.js', '/assets/js/cards.js', '/assets/js/page.js',
  '/assets/js/offline.js',
  '/favicon.ico', '/assets/img/logo-64.webp', '/assets/img/logo-128.webp', '/assets/img/icon-192.png', '/assets/img/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* One at a time, so a single missing file cannot stop installation. */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) { return key === CACHE ? null : caches.delete(key); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok && response.type === 'basic') {
        const copy = response.clone();
        caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
      }
      return response;
    }).catch(function () {
      return caches.match(request, { ignoreSearch: request.mode !== 'navigate' }).then(function (hit) {
        if (hit) return hit;
        if (request.mode === 'navigate') return caches.match('/offline.html');
        return Response.error();
      });
    })
  );
});
