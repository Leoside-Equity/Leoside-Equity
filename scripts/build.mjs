/* ==========================================================================
   Leoside Equity: production build
   --------------------------------------------------------------------------
     npm run build

   Writes dist/, the only folder that should ever be deployed:

     - copies the public files and nothing else, so the SQL migrations, these
       scripts, _source/ and the README are never served
     - joins the shared scripts into one minified file and minifies the rest,
       with no source maps
     - minifies the stylesheet and the HTML
     - adds a content hash to every CSS and JS reference, so those files can
       be cached for a year and still update the moment they change
     - copies the Content-Security-Policy from _headers into a <meta> tag on
       every page, for hosts that cannot send headers
     - adds every published report to sitemap.xml, read from the public
       list_reports() function
     - points the service worker at the built files
   ========================================================================== */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join, dirname, extname } from 'node:path';
import { transformSync } from 'esbuild';

const ROOT = process.cwd();
const OUT = join(ROOT, 'dist');
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
function write(p, data) {
  const full = join(OUT, p);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, data);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------ plain copies */
const COPY = ['favicon.ico', 'robots.txt', 'llms.txt', 'manifest.webmanifest', '_headers',
              '.well-known', 'assets/fonts', 'assets/img', 'assets/vendor'];
COPY.forEach((p) => { if (existsSync(join(ROOT, p))) cpSync(join(ROOT, p), join(OUT, p), { recursive: true }); });
if (existsSync(join(ROOT, 'CNAME'))) cpSync(join(ROOT, 'CNAME'), join(OUT, 'CNAME'));

/* ------------------------------------------------------------------- CSS
   A stray quote or brace makes a browser drop every rule after it without
   a word, so the build stops instead of shipping a half styled site. */
function checkCss(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  code.split('\n').forEach((line, i) => {
    if ((line.match(/"/g) || []).length % 2) throw new Error('styles.css line ' + (i + 1) + ' has an unclosed quote');
  });
  let depth = 0;
  for (const ch of code.replace(/"[^"\n]*"/g, '""')) {
    if (ch === '{') depth++;
    else if (ch === '}' && --depth < 0) throw new Error('styles.css has a } with no {');
  }
  if (depth) throw new Error('styles.css has ' + depth + ' unclosed {');
}
checkCss(read('assets/css/styles.css'));
const css = transformSync(read('assets/css/styles.css'), { loader: 'css', minify: true, target: ['chrome100', 'safari15', 'firefox100'] }).code;
const cssHash = hash(css);
write('assets/css/styles.css', css);

/* ---------------------------------------------------------------- scripts
   The shared scripts are classic scripts that talk through globals (LS,
   Auth, Data and so on). Joined into one file they share one scope, which
   is what they share as separate files too, and esbuild leaves top level
   names alone when no module format is set, so nothing is renamed that a
   page script depends on. */
const index = read('index.html');
const block = index.match(/<!-- core:start -->([\s\S]*?)<!-- core:end -->/);
if (!block) throw new Error('index.html has no core:start / core:end block');
const coreFiles = [...block[1].matchAll(/src="\/([^"]+)"/g)].map((m) => m[1]).filter((f) => !f.startsWith('assets/vendor/'));
const vendor = [...block[1].matchAll(/src="\/(assets\/vendor\/[^"]+)"/g)].map((m) => m[1]);

const minifyJs = (code) => transformSync(code, { loader: 'js', minify: true, legalComments: 'none', target: ['chrome90', 'safari14', 'firefox90'] }).code;

const core = minifyJs(coreFiles.map((f) => read(f) + '\n;').join('\n'));
const coreName = 'assets/js/core.min.js';
write(coreName, core);
const coreHash = hash(core);

const jsHashes = {};
readdirSync(join(ROOT, 'assets/js')).filter((f) => f.endsWith('.js')).forEach((f) => {
  const p = 'assets/js/' + f;
  if (coreFiles.includes(p)) return;
  const out = minifyJs(read(p));
  write(p, out);
  jsHashes['/' + p] = hash(out);
});
const vendorHashes = {};
vendor.forEach((v) => { vendorHashes['/' + v] = hash(read(v)); });

/* --------------------------------------------------------------- CSP meta */
const csp = read('_headers').match(/Content-Security-Policy:\s*(.+)/)[1].trim()
  /* Not allowed in a meta tag; the header version still carries it. */
  .split(';').map((s) => s.trim()).filter((s) => s && !/^frame-ancestors|^report-uri|^sandbox/.test(s)).join('; ');

/* ------------------------------------------------------------------- HTML */
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
pages.forEach((file) => {
  let html = read(file);
  html = html.replace(/<!-- core:start -->[\s\S]*?<!-- core:end -->/,
    vendor.map((v) => '<script defer src="/' + v + '?v=' + vendorHashes['/' + v] + '"></script>').join('') +
    '<script defer src="/' + coreName + '?v=' + coreHash + '"></script>');
  html = html.replace(/(src="(\/assets\/js\/[^"?]+\.js))"/g, (m, attr, src) => jsHashes[src] ? attr + '?v=' + jsHashes[src] + '"' : m);
  html = html.replace('href="/assets/css/styles.css"', 'href="/assets/css/styles.css?v=' + cssHash + '"');
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="' + csp + '">');
  /* Comments out, runs of whitespace between tags collapsed. Text inside
     elements is left exactly as written. */
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s*\n\s*</g, '>\n<').replace(/\n{2,}/g, '\n');
  write(file, html);
});

/* ---------------------------------------------------------------- sitemap */
async function sitemap() {
  let xml = read('sitemap.xml').replace(/<!--[\s\S]*?-->\s*/g, '');
  try {
    const cfg = read('assets/js/config.js');
    const url = cfg.match(/SUPABASE_URL:\s*'([^']+)'/)[1];
    const key = cfg.match(/SUPABASE_KEY:\s*'([^']+)'/)[1];
    const res = await fetch(url + '/rest/v1/rpc/list_reports', {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = await res.json();
    const items = rows.map((r) =>
      '  <url><loc>https://leosideequity.com/report.html?id=' + encodeURIComponent(r.id).replace(/&/g, '&amp;') +
      '</loc><lastmod>' + String(r.published_at || r.published_on).slice(0, 10) + '</lastmod><priority>0.8</priority></url>').join('\n');
    xml = xml.replace('</urlset>', items + (items ? '\n' : '') + '</urlset>');
    console.log('sitemap: ' + rows.length + ' reports added');
  } catch (e) {
    console.warn('sitemap: reports not added (' + e.message + '). Static pages only.');
  }
  write('sitemap.xml', xml);
}

/* ---------------------------------------------------------- service worker */
function serviceWorker() {
  let sw = read('sw.js');
  const shell = ['/', ...pages.filter((p) => !['admin.html', 'dashboard.html', 'reset.html', 'report.html'].includes(p)).map((p) => '/' + p),
    '/assets/css/styles.css?v=' + cssHash, '/' + coreName + '?v=' + coreHash,
    ...Object.keys(vendorHashes).map((v) => v + '?v=' + vendorHashes[v]),
    '/assets/js/boot.js?v=' + jsHashes['/assets/js/boot.js'], '/assets/js/page.js?v=' + jsHashes['/assets/js/page.js'],
    '/assets/js/offline.js?v=' + jsHashes['/assets/js/offline.js'],
    '/assets/fonts/playfair-display-var.woff2', '/assets/fonts/inter-var.woff2',
    '/assets/fonts/plex-mono-400-normal.woff2', '/assets/fonts/plex-mono-500-normal.woff2',
    '/favicon.ico', '/assets/img/logo-64.webp', '/assets/img/logo-128.webp', '/assets/img/icon-192.png', '/assets/img/icon-512.png', '/manifest.webmanifest'];
  sw = sw.replace(/const CACHE = '[^']+';/, "const CACHE = 'leoside-" + hash(shell.join()) + "';")
         .replace(/const SHELL = \[[\s\S]*?\];/, 'const SHELL = ' + JSON.stringify(shell) + ';');
  write('sw.js', minifyJs(sw));
}

await sitemap();
serviceWorker();

/* ---------------------------------------------------------------- report */
function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(OUT);
let raw = 0, gz = 0;
const rows = files.filter((f) => ['.js', '.css', '.html'].includes(extname(f))).map((f) => {
  const b = readFileSync(f);
  const g = gzipSync(b).length;
  raw += b.length; gz += g;
  return [f.slice(OUT.length + 1).replace(/\\/g, '/'), b.length, g];
}).sort((a, b) => b[1] - a[1]);
rows.slice(0, 12).forEach((r) => console.log(r[0].padEnd(34) + String(r[1]).padStart(9) + ' B  ' + String(r[2]).padStart(8) + ' B gzip'));
console.log('HTML, CSS and JS: ' + raw + ' B, ' + gz + ' B gzip. ' + files.length + ' files in dist/.');
if (files.some((f) => /\.map$/.test(f))) throw new Error('A source map ended up in dist/');
