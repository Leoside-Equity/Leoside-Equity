/* Writes a WebP copy of each scaled logo, keeping the transparency:

     assets/img/logo-64.png   ->  logo-64.webp
     assets/img/logo-128.png  ->  logo-128.webp
     assets/img/logo-256.png  ->  logo-256.webp

   The pages load the WebP copies; the PNGs stay for the favicon, the app
   manifest and anything that cannot read WebP. Uses the locally installed
   Chrome through its DevTools protocol, so there is no image library to
   install. Run after make-icons.mjs, from the project root:
     node scripts/make-webp.mjs */

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FILES = ['assets/img/logo-64.png', 'assets/img/logo-128.png', 'assets/img/logo-256.png'];
const QUALITY = 0.9;

const port = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=' + port,
  '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'leoside-webp-')), '--no-first-run', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = [];
for (let i = 0; i < 80 && !targets.length; i++) {
  try { targets = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).filter((t) => t.type === 'page'); } catch (e) {}
  if (!targets.length) await sleep(150);
}
if (!targets.length) { chrome.kill(); throw new Error('Chrome did not start'); }

const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const waiting = new Map();
ws.addEventListener('message', (m) => { const msg = JSON.parse(m.data); if (waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } });
const send = (method, params) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });

try {
  for (const file of FILES) {
    const png = readFileSync(file).toString('base64');
    const res = await send('Runtime.evaluate', {
      awaitPromise: true, returnByValue: true,
      expression: '(async () => {' +
        'const blob = await (await fetch("data:image/png;base64,' + png + '")).blob();' +
        'const bmp = await createImageBitmap(blob);' +
        'const c = new OffscreenCanvas(bmp.width, bmp.height);' +
        'c.getContext("2d").drawImage(bmp, 0, 0);' +
        'const out = await c.convertToBlob({ type: "image/webp", quality: ' + QUALITY + ' });' +
        'const bytes = new Uint8Array(await out.arrayBuffer()); let s = "";' +
        'for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);' +
        'return { type: out.type, data: btoa(s) }; })()'
    });
    const value = res.result && res.result.result && res.result.result.value;
    if (!value || value.type !== 'image/webp') throw new Error('WebP encoding failed for ' + file);
    const outFile = file.replace(/\.png$/, '.webp');
    const buf = Buffer.from(value.data, 'base64');
    writeFileSync(outFile, buf);
    console.log(outFile.padEnd(28) + String(buf.length).padStart(7) + ' B  (PNG ' + readFileSync(file).length + ' B)');
  }
} finally {
  ws.close();
  chrome.kill();
}
