/* Season prize timing (2026-09-13, owner: "kad promenim nagrade treba nešto što kaže da promene nastupe po novoj sezoni
   a ne po trenutnoj ... hoću smooth transition"). Prizes are read at PAYOUT time, which is AFTER a season ends, so an
   edit made mid-season silently changes what the finished season pays. This proves both paths on prod against the live
   config, and puts every value back exactly as it found it.                     node build/season-prizes-e2e.js      */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = process.env.MP_ADMIN_KEY || fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { _raw: t.slice(0, 200) }; } };
const BOARDS = ['lbRoe', 'lbRoe2', 'lbWr', 'lbXp', 'lbGold', 'lbBybit'];
const get = async () => j(await fetch(O + '/api/reward/config', { headers: { 'x-admin-key': K } }));
const put = async (body) => j(await fetch(O + '/api/reward/config', { method: 'POST', headers: H, body: JSON.stringify(body) }));

(async () => {
  const start = await get();
  const before = {}; BOARDS.forEach(k => { before[k] = (start.config || {})[k]; });
  ok(BOARDS.every(k => Array.isArray(before[k]) && before[k].length === 5), 'every board has a five-place prize table (' + BOARDS.join(', ') + ')');
  ok(!!(start.season && start.season.we > Date.now()), 'the config answers with the current season window (ends ' + (start.season ? new Date(start.season.we).toISOString() : '?') + ')');
  ok(Array.isArray(before.lbGold), 'The Gold Room is a real board in the config, not just on the page');

  // ---- scheduled: the live numbers must NOT move ------------------------------------------------------------------
  const probe = [7, 6, 5, 4, 3];
  await put({ lbGold: probe, nextSeason: true });
  const sched = await get();
  ok(JSON.stringify((sched.config || {}).lbGold) === JSON.stringify(before.lbGold), 'a scheduled change leaves the live prizes untouched (' + JSON.stringify((sched.config || {}).lbGold) + ')');
  ok(!!sched.pending && JSON.stringify(sched.pending.lbGold) === JSON.stringify(probe), 'it is parked as pending (' + JSON.stringify(sched.pending && sched.pending.lbGold) + ')');
  ok(sched.pending && sched.pending.fromWs === start.season.we, 'parked against the start of the NEXT season, not an arbitrary date');
  ok(sched.pending && BOARDS.filter(k => sched.pending[k]).length === 1, 'only the board that was edited is parked, the others are left alone');

  // ---- cancelling a scheduled change --------------------------------------------------------------------------------
  await put({ clearPending: true });
  const cleared = await get();
  ok(!cleared.pending, 'a scheduled change can be cancelled');
  ok(JSON.stringify((cleared.config || {}).lbGold) === JSON.stringify(before.lbGold), 'cancelling leaves the live prizes as they were');

  // ---- immediate: the live numbers move now ------------------------------------------------------------------------
  await put({ lbGold: probe });
  const now = await get();
  ok(JSON.stringify((now.config || {}).lbGold) === JSON.stringify(probe), 'without the flag the change applies immediately (' + JSON.stringify((now.config || {}).lbGold) + ')');
  ok(!now.pending, 'and nothing is left pending');

  // ---- restore, and prove the restore took ---------------------------------------------------------------------------
  await put({ lbGold: before.lbGold });
  const end = await get();
  ok(JSON.stringify((end.config || {}).lbGold) === JSON.stringify(before.lbGold), 'restored to the value this run found (' + JSON.stringify(before.lbGold) + ')');
  ok(BOARDS.every(k => JSON.stringify((end.config || {})[k]) === JSON.stringify(before[k])), 'every other board is byte-for-byte what it was before this test');
  ok(!end.pending, 'no scheduled change left behind');

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
