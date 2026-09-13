/* Who registered a Bybit UID and who tried: proves /api/admin/bybitlinks + the 'bylog' attempt ring end to end on prod.
   Mints a throwaway member, makes one bad, one refused and one accepted attempt, reads them back, scrubs the account.
   node build/bybit-uidlog-e2e.js                                                                                   */
// Prove the /bybitlink attempt log end to end: mint a throwaway member, make one refused and one accepted attempt,
// read them back from /api/admin/bybitlinks, then scrub the account.
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = process.env.MP_ADMIN_KEY || require('fs').readFileSync(require('path').join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0]; // gitignored file, never a literal in the repo
const uid = 'e2e' + Date.now().toString(36);
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { _raw: t.slice(0, 200), _status: r.status }; } };
(async () => {
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const s = await j(await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }));
  const tok = s.token || s.sess || s.mp_sess; if (!tok) { console.log('no session', JSON.stringify(s)); process.exit(1); }
  const CK = { 'content-type': 'application/json', cookie: 'mp_sess=' + tok + '; mp_un=e2e_' + uid };
  const r1 = await j(await fetch(O + '/api/reward/bybitlink', { method: 'POST', headers: CK, body: JSON.stringify({ uid: '12' }) }));
  ok(r1.error === 'bad_uid', 'too-short UID refused as bad_uid (' + JSON.stringify(r1).slice(0, 60) + ')');
  const r2 = await j(await fetch(O + '/api/reward/bybitlink', { method: 'POST', headers: CK, body: JSON.stringify({ uid: '187654321' }) }));
  ok(r2.error === 'uid_not_ours', 'UID outside the affiliate list refused as uid_not_ours');
  const r3 = await j(await fetch(O + '/api/reward/bybitlink', { method: 'POST', headers: CK, body: JSON.stringify({ uid: '999900001' }) }));
  ok(r3.ok === true, 'e2e test UID accepted (' + JSON.stringify(r3).slice(0, 60) + ')');
  await new Promise(r => setTimeout(r, 1500));
  const d = await j(await fetch(O + '/api/admin/bybitlinks?e2e=1', { headers: { 'x-admin-key': K } }));
  const mine = (d.attempts || []).filter(a => a.uid === uid);
  ok(mine.length === 3, 'all three attempts are in the log (' + mine.length + ')');
  ok(mine.some(a => a.err === 'bad_uid') && mine.some(a => a.err === 'uid_not_ours') && mine.some(a => !a.err && a.buid === '999900001'), 'each attempt kept its result: ' + mine.map(a => (a.err || 'ok') + ':' + a.buid).join(' '));
  ok(mine.every(a => a.ts && a.ip != null), 'rows carry a timestamp and the address');
  const reg = (d.registered || []).find(r => r.uid === uid);
  ok(reg && reg.buid === '999900001' && reg.source === 'registered', 'the accepted UID shows up as a registration (' + JSON.stringify(reg || null) + ')');
  const pub = await j(await fetch(O + '/api/admin/bybitlinks', { headers: { 'x-admin-key': K } }));
  ok(!(pub.attempts || []).some(a => a.uid === uid), 'test rows are hidden from the default (non-e2e) view');
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
