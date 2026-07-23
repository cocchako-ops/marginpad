// test-multidevice.js — B4: multi-device journal-merge conflict rules, tested against PRODUCTION.
// Simulates two devices (same account, different local states) pushing /api/auth/trades and asserts
// the DO merge invariants: closed-beats-stale-open, union-merge (a stale device can't delete), qty
// can only shrink, and a client cannot fabricate pnl on a server-filled trade (recomputed from exit).
//   node build/test-multidevice.js
const KEY = 'mpadm_43bf150d4778e4f0e72f717f69f82d3acb326e9a';
const UID = 'e2e-multidev';
const BASE = 'https://marginpad.io';
const HDR = { 'content-type': 'application/json', cookie: 'mp_uid=' + UID };
let pass = 0, fail = 0;
function ok(name, cond, detail) { if (cond) { pass++; console.log('  OK  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); } }
async function push(journal) { const r = await fetch(BASE + '/api/auth/trades', { method: 'POST', headers: HDR, body: JSON.stringify({ journal }) }); return r.json(); }
async function pull() { const r = await fetch(BASE + '/api/auth/trades', { headers: HDR }); const d = await r.json(); return d.journal || []; }
const find = (jn, id) => jn.filter(t => String(t.id) === String(id))[0];

(async () => {
  // /trades sync requires a real users row (anti-fabrication guard) — provision the e2e row first (idempotent, 'e2e-' prefix enforced server-side)
  const mk0 = await (await fetch(BASE + '/api/admin/mktestuser?uid=' + UID + '&key=' + KEY)).json();
  if (!mk0.ok) { console.log('FATAL: mktestuser failed — ' + JSON.stringify(mk0)); process.exit(1); }
  const S = Date.now().toString(36);
  const mk = (id, over) => Object.assign({ id, ts: Date.now(), sym: 'BTC', side: 'long', entry: 50000, lev: 10, margin: 20, qty: 20 * 10 / 50000, notional: 200, liq: 45025, status: 'open', pnl: null }, over);

  console.log('== 1) device B closes, stale device A re-pushes open → stays CLOSED ==');
  const id1 = 'md1' + S;
  await push([mk(id1)]);                                                        // A: open
  await push([mk(id1, { status: 'win', exit: 51000, pnl: 4, closeTs: Date.now() })]); // B: closed
  await push([mk(id1)]);                                                        // A again, stale open
  let jn = await pull();
  ok('closed survives stale open push', (find(jn, id1) || {}).status === 'win', JSON.stringify(find(jn, id1) || {}).slice(0, 100));

  console.log('== 2) stale device with a SHORTER list cannot delete a trade ==');
  const id2 = 'md2' + S;
  await push([mk(id2, { sym: 'ETH', entry: 3000, qty: 20 * 10 / 3000, liq: 2701.5 })]); // A: adds T2
  await push([mk(id1, { status: 'win', exit: 51000, pnl: 4, closeTs: Date.now() })]);   // B: pushes WITHOUT T2
  jn = await pull();
  ok('missing trade survives (union merge)', !!find(jn, id2));

  console.log('== 3) qty can only shrink on an open trade ==');
  await push([mk(id2, { sym: 'ETH', entry: 3000, qty: 99, liq: 2701.5 })]); // inflated qty
  jn = await pull();
  const q2 = +(find(jn, id2) || {}).qty;
  ok('qty inflation rejected', q2 < 1, 'qty=' + q2);

  console.log('== 4) client cannot fabricate pnl on a server-filled (srv) trade ==');
  const o = await (await fetch(BASE + '/api/trade/open?uid=' + UID + '&key=' + KEY, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sym: 'BTC', side: 'long', margin: 10, lev: 10 }) })).json();
  if (o.ok) {
    const p = o.position;
    const lie = Object.assign({}, p, { status: 'win', exit: p.entry * 1.001, pnl: 99999, closeTs: Date.now() });
    await push([lie]);
    jn = await pull();
    const got = find(jn, p.id) || {};
    const expect = Math.round((p.qty * (p.entry * 1.001 - p.entry) - p.qty * (p.entry + p.entry * 1.001) * 0.00055) * 100) / 100;
    ok('pnl recomputed from exit (not the claimed 99999)', Math.abs((+got.pnl) - expect) < 0.05 && +got.pnl < 1000, 'pnl=' + got.pnl + ' expect~' + expect);
    ok('fill fields intact (entry unchanged)', +got.entry === +p.entry);
  } else ok('srv open for test 4', false, JSON.stringify(o).slice(0, 80));

  console.log('== 5) fabricated srv id from a client is dropped ==');
  await push([mk('srvFAKE' + S, { src: 'srv' })]);
  jn = await pull();
  ok('fabricated srv trade dropped', !find(jn, 'srvFAKE' + S));

  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (fail ? '' : ' — multi-device merge rules hold'));
  process.exit(fail ? 1 : 0);
})();
