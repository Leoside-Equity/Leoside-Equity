/* Regenerates every raster brand asset from the original logo artwork,
   assets/img/logo.png (transparent, 335 x 335):

     assets/img/logo-64.png, logo-128.png   header and footer sizes
     assets/img/logo-256.png                call to action panels
     favicon.ico (16, 32, 48)
     assets/img/apple-touch-icon.png, icon-192.png, icon-512.png,
     icon-maskable-512.png
     assets/img/og-image.png (1200 x 630)

   Uses the locally installed Chrome in headless mode to scale and composite,
   so there is no image library to install. Run from the project root:
     node scripts/make-icons.mjs */

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const INK = '#0B1118';
const root = process.cwd().replace(/\\/g, '/');
const work = mkdtempSync(join(tmpdir(), 'leoside-icons-'));
const LOGO = 'file:///' + root + '/assets/img/logo.png';

function shot(name, w, h, body, transparent, bg) {
  const file = join(work, name + '.html');
  writeFileSync(file,
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@font-face{font-family:"Playfair Display";src:url("file:///' + root + '/assets/fonts/playfair-display-var.woff2") format("woff2");font-weight:400 900}' +
    '@font-face{font-family:"Plex Mono";src:url("file:///' + root + '/assets/fonts/plex-mono-500-normal.woff2") format("woff2");font-weight:500}' +
    '@font-face{font-family:"Inter";src:url("file:///' + root + '/assets/fonts/inter-var.woff2") format("woff2");font-weight:100 900}' +
    'html,body{margin:0;width:' + w + 'px;height:' + h + 'px;overflow:hidden;background:' + (transparent ? 'transparent' : (bg || INK)) + '}' +
    'img{display:block;image-rendering:auto}</style></head><body>' + body + '</body></html>');
  const out = join(work, name + '.png');
  const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--window-size=' + w + ',' + h, '--screenshot=' + out, '--virtual-time-budget=2000'];
  if (transparent) args.push('--default-background-color=00000000');
  args.push('file:///' + file.replace(/\\/g, '/'));
  execFileSync(CHROME, args, { stdio: 'ignore' });
  return readFileSync(out);
}

function logoAt(size, x, y) {
  return '<img src="' + LOGO + '" width="' + size + '" height="' + size + '" style="position:absolute;left:' + x + 'px;top:' + y + 'px">';
}

/* Scaled copies for the header and footer, so a 32 pixel mark does not
   download the full 335 pixel file. */
writeFileSync('assets/img/logo-64.png', shot('l64', 64, 64, logoAt(64, 0, 0), true));
writeFileSync('assets/img/logo-128.png', shot('l128', 128, 128, logoAt(128, 0, 0), true));
/* The call to action panels show it at 120 to 230 pixels. */
writeFileSync('assets/img/logo-256.png', shot('l256', 256, 256, logoAt(256, 0, 0), true));

/* Favicons: the logo on transparent, as the site always used. */
const fav = [16, 32, 48].map((s) => shot('fav' + s, s, s, logoAt(s, 0, 0), true));
function ico(pngs, sizes) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach((png, i) => {
    const o = 6 + i * 16, s = sizes[i];
    head.writeUInt8(s >= 256 ? 0 : s, o); head.writeUInt8(s >= 256 ? 0 : s, o + 1);
    head.writeUInt8(0, o + 2); head.writeUInt8(0, o + 3);
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(png.length, o + 8); head.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs]);
}
writeFileSync('favicon.ico', ico(fav, [16, 32, 48]));

/* App icons. "any" icons keep the transparent logo; the maskable and Apple
   icons sit it on ink, because launchers crop them and iOS fills
   transparency with black. */
function tile(size, scale, transparent) {
  const m = Math.round(size * scale);
  const o = Math.round((size - m) / 2);
  return shot('tile' + size + scale + (transparent ? 't' : ''), size, size, logoAt(m, o, o), transparent);
}
writeFileSync('assets/img/icon-192.png', tile(192, 1, true));
writeFileSync('assets/img/icon-512.png', tile(512, 1, true));
writeFileSync('assets/img/icon-maskable-512.png', tile(512, .66, false));
writeFileSync('assets/img/apple-touch-icon.png', tile(180, .82, false));

/* Social share card. Plain facts only. */
writeFileSync('assets/img/og-image.png', shot('og', 1200, 630,
  '<div style="position:relative;width:1200px;height:630px;background:' + INK + ';color:#EDE6D6;font-family:Inter,sans-serif;overflow:hidden">' +
    '<svg width="1200" height="630" style="position:absolute;inset:0" viewBox="0 0 1200 630">' +
      '<g fill="none" stroke="#C9A052" stroke-opacity=".14">' +
        Array.from({ length: 9 }, (_, i) => '<ellipse cx="1010" cy="315" rx="' + (250 * Math.abs(Math.cos((i - 4) * Math.PI / 9))) + '" ry="250"/>').join('') +
        Array.from({ length: 7 }, (_, i) => { const y = 315 + 250 * Math.sin((i - 3) * Math.PI / 8); const r = 250 * Math.cos((i - 3) * Math.PI / 8); return '<line x1="' + (1010 - r) + '" y1="' + y + '" x2="' + (1010 + r) + '" y2="' + y + '"/>'; }).join('') +
        '<circle cx="1010" cy="315" r="250" stroke-opacity=".35"/>' +
      '</g>' +
    '</svg>' +
    logoAt(132, 72, 58) +
    '<div style="position:absolute;left:80px;top:236px;font-family:\'Playfair Display\',serif;font-weight:600;font-size:92px;line-height:1;letter-spacing:-2px">Leoside Equity</div>' +
    '<div style="position:absolute;left:84px;top:354px;width:640px;font-size:33px;line-height:1.36;color:#B6BDC6">Written equity research on United States, United Kingdom and Indian markets, published daily.</div>' +
    '<div style="position:absolute;left:84px;bottom:70px;font-family:Plex Mono,monospace;font-weight:500;font-size:22px;letter-spacing:3px;color:#C9A052">LEOSIDEEQUITY.COM</div>' +
  '</div>', false));

console.log('icons written');
