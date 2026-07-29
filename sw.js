/* ==========================================================================
   Leoside Equity: service worker
   --------------------------------------------------------------------------
   This exists so the site can be installed as an app on Android, Windows,
   macOS and iOS. It is deliberately conservative.

   What it caches: the shell. HTML pages, the stylesheet, the scripts, the
   logo. Things that change when the site is redeployed, not when a report is
   published.

   What it never caches: anything from Supabase. Reports, sessions, saved
   lists and reading history all go straight to the network every time. A
   cached report would be a stale report, and worse, a cached response from
   the gate could show one reader another reader's access level. Requests to
   any origin other than this one are passed through untouched.

   Strategy for pages: network first, falling back to cache. The reader always
   gets the current site when they have a connection, and something readable
   when they do not. Cache first would mean a deploy took a reload or two to
   appear, which is the usual way service workers make people miserable.
   ========================================================================== */

/* Bump this to force every client onto a fresh copy of the shell. */
/* Bumped when the shell changes. v2 adds the real PWA icons: the manifest used
   to declare 192 and 512 against a 335px file, and Chrome validates declared
   sizes against actual pixels, so it rejected the icon set and never fired
   beforeinstallprompt at all. */
const CACHE = 'leoside-shell-v2';

const SHELL = [
  '/',
  '/index.html',
  '/reports.html',
  '/about.html',
  '/method.html',
  '/signin.html',
  '/signup.html',
  '/terms.html',
  '/privacy.html',
  '/disclaimer.html',
  '/offline.html',
  '/assets/css/styles.css',
  '/assets/js/config.js',
  '/assets/js/data.js',
  '/assets/js/auth.js',
  '/assets/js/store.js',
  '/assets/js/app.js',
  '/assets/js/cards.js',
  '/assets/js/home.js',
  '/assets/img/logo.png',
  '/assets/img/icon-192.png',
  '/assets/img/icon-512.png',
  '/assets/img/icon-maskable-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* addAll rejects the whole batch if any single file 404s, which would
         leave the worker uninstalled and the site uninstallable. Added one at
         a time so a missing file costs only that file. */
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function () {
          console.warn('[Leoside SW] could not cache', url);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;

  /* Only GET. A POST to Supabase must never be intercepted. */
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Anything not served from this site is left entirely alone: Supabase, the
     supabase-js CDN, Google Fonts. Reports and sessions are not ours to
     cache, and an intercepted auth call is a security problem rather than a
     performance one. */
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        /* Keep the shell current in the background. Opaque and error
           responses are not worth storing. */
        if (response && response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request).then(function (hit) {
          if (hit) return hit;
          /* A navigation with nothing cached gets the offline page rather
             than the browser's own error. */
          if (request.mode === 'navigate') return caches.match('/offline.html');
          return Response.error();
        });
      })
  );
});
