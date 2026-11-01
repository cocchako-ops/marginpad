// WHAT MOVED IT - the steps a deploy cannot do by itself (2026-11-01). Run once after the deploy that ships cx:lblarch:
//   1. folds the two days of live labels into the archive,
//   2. re-reads the month's catalysts through the model, oldest first, each batch told the stories running at that moment
//      (about 270 Haiku calls, about $2; `--dry` says how many are left and spends nothing),
//   3. fills 35 days of the earnings calendar,
//   4. probes whether the Worker can reach the stock news feeds,
//   5. starts the coverage sweep.
// Safe to re-run: labelled items are skipped.  node build/cx-after-deploy.js [--dry] [--skip-relabel]
'use strict';
const fs = require('fs'), path = require('path');
const BASE = 'https://marginpad.io', DRY = process.argv.includes('--dry'), SKIP = process.argv.includes('--skip-relabel');
const m = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/);
if (!m) throw new Error('no admin key');
const H = { 'x-admin-key': m[0], 'content-type': 'application/json' };
const post = (b) => fetch(BASE + '/api/admin/cxrelabel', { method: 'POST', headers: H, body: JSON.stringify(b) }).then(r => r.json());
const get = (u) => fetch(BASE + u, { headers: H }).then(r => r.json());
(async () => {
  const d0 = await post({ mergeLive: true });
  console.log('to read:', d0.todo, 'of', d0.items);
  if (DRY) return;
  if (!SKIP) {
    let left = d0.todo, fails = 0;
    while (left > 0 && fails < 5) {
      const r = await post({ go: true, n: 14 }).catch(e => ({ err: String(e) }));
      if (!r || !r.ok) { fails++; console.log('  retry', JSON.stringify(r).slice(0, 120)); await new Promise(x => setTimeout(x, 4000)); continue; }
      left = +r.left || 0; fails = 0;
      console.log('  ', new Date(+r.at).toISOString().slice(0, 16), 'answered', r.answered, 'of', r.done, 'left', left);
    }
  }
  const now = Date.now(); let earn = 0;
  for (let i = 0; i < 35; i++) { const d = new Date(now - i * 86400000); if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue; const r = await get('/api/admin/cxeq?day=' + d.toISOString().slice(0, 10)); earn += +r.n || 0; if (r.status !== 200) console.log('  earnings', d.toISOString().slice(0, 10), JSON.stringify(r).slice(0, 100)); }
  console.log('earnings rows stored:', earn);
  console.log('stock news from the Worker:', JSON.stringify((await get('/api/admin/cxeq?probe=NVDA')).diag));
  console.log('coverage pass:', JSON.stringify(await get('/api/admin/cxcov?run=6')));
})().catch(e => { console.error(e); process.exit(1); });
