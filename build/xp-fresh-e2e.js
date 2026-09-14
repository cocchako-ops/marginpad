/* XP toast freshness E2E (2026-09-07, owner: "posle claim-a proslava stigne tek posle par sekundi"). Proves on production that
   the grant a member just earned is visible to the very next /api/auth/xp?fresh=1 read (the 45 s per-isolate cache is bypassed),
   that the cached read is what the 60 s poll gets, and that the fresh read is fast enough to carry a toast (parallel DO reads).
   Throwaway member via POST /api/admin/e2euser (op mk + sess), scrubbed at the end. Run: node build/xp-fresh-e2e.js */
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 220) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = (p, b, extra) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, extra || {}), body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const UID = 'e2exp' + Math.random().toString(36).slice(2, 7);
(async () => {
  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' }); chk('e2e member minted', mk.body.ok, mk.body);
  const ss = await post('/api/admin/e2euser', { uid: UID, op: 'sess' }); chk('member session minted', ss.body.ok && ss.body.token, ss.body.cookie);
  const C = { cookie: ss.body.cookie + '=' + ss.body.token };
  const xp = async (fresh) => { const t = Date.now(); const r = await fetch(ORIGIN + '/api/auth/xp' + (fresh ? '?fresh=1' : ''), { headers: C }); const j = await r.json(); return { ms: Date.now() - t, j }; };
  const a = await xp(false); chk('signed-in xp read works', a.j.signedIn === true && a.j.level, { ms: a.ms, xp: a.j.xp });
  const b = await xp(false); chk('a second plain read is served from the 45 s cache (fast)', b.ms < a.ms || b.ms < 400, { first: a.ms, cached: b.ms });
  // earn XP now: open + close a small trade (the close grants 'trade' XP inside the DO before it answers)
  const op = await post('/api/trade/open?uid=' + UID, { sym: 'BTC', side: 'long', margin: 5, lev: 2 }); chk('trade opened', op.body.ok, op.body.error);
  const cl = await post('/api/trade/close?uid=' + UID, { id: op.body.position && op.body.position.id }); chk('trade closed', cl.body.ok, cl.body.error);
  const stale = await xp(false); const fresh = await xp(true);
  const n0 = (a.j.log || []).length, nS = (stale.j.log || []).length, nF = (fresh.j.log || []).length;
  chk('fresh=1 sees the grant immediately (log grew, xp rose)', nF > n0 && fresh.j.xp > a.j.xp, { before: a.j.xp, fresh: fresh.j.xp, logBefore: n0, logFresh: nF, newest: fresh.j.log && fresh.j.log[0] && fresh.j.log[0].src });
  chk('the plain read right after the grant is the cached (stale) payload - which is why claims must ask for fresh', stale.j.xp === a.j.xp && nS === n0, { stale: stale.j.xp, before: a.j.xp });
  chk('fresh read is fast enough to carry a toast (< 1500 ms from here; the DO reads run in parallel)', fresh.ms < 1500, { ms: fresh.ms });
  const again = await xp(false); chk('a fresh read refreshes the cache for the next plain poll', again.j.xp === fresh.j.xp, { again: again.j.xp });
  const rm = await post('/api/admin/e2euser', { uid: UID, op: 'rm' }); chk('member scrubbed', rm.body.ok, rm.body);
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' - ' + f + ' FAIL' : '')); process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });
