/* ==========================================================================
   Leoside Equity: simultaneous readers
   --------------------------------------------------------------------------
     npm run loadtest                 25 readers, 4 rounds each
     node scripts/load-test.mjs 50 6  50 readers, 6 rounds each

   Each simulated reader does what a signed out visitor does: loads the
   archive (list_reports) and opens a report (get_report). Read only, public
   calls, using the publishable key from config.js. Nothing is written.

   Keep the numbers modest on the free plan: Supabase counts these requests.
   ========================================================================== */
import { readFileSync } from 'node:fs';

const USERS = Math.min(200, parseInt(process.argv[2], 10) || 25);
const ROUNDS = Math.min(20, parseInt(process.argv[3], 10) || 4);

const cfg = readFileSync('assets/js/config.js', 'utf8');
const URL_ = cfg.match(/SUPABASE_URL:\s*'([^']+)'/)[1];
const KEY = cfg.match(/SUPABASE_KEY:\s*'([^']+)'/)[1];

async function rpc(name, body) {
  const t = performance.now();
  try {
    const res = await fetch(URL_ + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json', 'Accept-Encoding': 'gzip' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json();
    return { ms: performance.now() - t, ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ms: performance.now() - t, ok: false, status: e.name };
  }
}

const first = await rpc('list_reports');
if (!first.ok) { console.error('list_reports failed:', first.status); process.exit(1); }
const ids = first.data.map((r) => r.id);
console.log(USERS + ' simultaneous readers, ' + ROUNDS + ' rounds each, ' + ids.length + ' published reports');

const timings = { list_reports: [], get_report: [] };
const failures = {};
let leaked = 0;

async function reader() {
  for (let i = 0; i < ROUNDS; i++) {
    const a = await rpc('list_reports');
    timings.list_reports.push(a.ms);
    if (!a.ok) failures[a.status] = (failures[a.status] || 0) + 1;
    if (ids.length) {
      const b = await rpc('get_report', { p_id: ids[Math.floor(Math.random() * ids.length)] });
      timings.get_report.push(b.ms);
      if (!b.ok) failures[b.status] = (failures[b.status] || 0) + 1;
      /* A signed out reader must never receive the full text. */
      if (b.ok && b.data && (b.data.body || b.data.locked !== true)) leaked++;
    }
  }
}

const start = performance.now();
await Promise.all(Array.from({ length: USERS }, reader));
const secs = (performance.now() - start) / 1000;

const pct = (arr, p) => { const s = arr.slice().sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]) : 0; };
for (const k of Object.keys(timings)) {
  const t = timings[k];
  console.log(k.padEnd(13) + ' n=' + String(t.length).padEnd(5) + ' p50 ' + pct(t, 50) + ' ms   p95 ' + pct(t, 95) + ' ms   max ' + pct(t, 100) + ' ms');
}
const total = timings.list_reports.length + timings.get_report.length;
console.log('requests: ' + total + ' in ' + secs.toFixed(1) + ' s (' + (total / secs).toFixed(1) + '/s)');
console.log('failures: ' + (Object.keys(failures).length ? JSON.stringify(failures) : 'none'));
console.log('full text sent to a signed out reader: ' + (leaked ? leaked + ' TIMES, CHECK get_report()' : 'never'));
