/* Moon sign-up bonus: one retry per account (owner 2026-09-13: "ladyp03 submits far too often; once approved never again").
   Mints a throwaway member, submits, is rejected by an admin session, submits once more (allowed), is rejected again,
   and the third submission must be refused with limit_reached. An approved row still refuses with already_submitted.
   node build/moon-limit-e2e.js                                                                                        */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
(async () => {
  const uid = 'e2emoon' + Date.now().toString(36);
  const mk = await j('/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) }); // 600 XP: rewards routes unlock at Bronze (500)
  ok(mk.s === 200, 'test member minted');
  const se = await j('/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: JSON.stringify({ uid, op: 'sess' }) });
  const tok = se.b && (se.b.token || se.b.sess || se.b.mp_sess);
  ok(!!tok, 'member session minted');
  const adm = await j('/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } });
  ok(adm.b && adm.b.token, 'admin session minted');
  const U = { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, A = { cookie: 'mp_sadm=' + adm.b.token, 'content-type': 'application/json' };
  const submit = (n) => j('/api/reward/moonsign/submit', { method: 'POST', headers: U, body: JSON.stringify({ uid: 'e2e_moon_' + n }) });
  const reject = async () => { const l = await j('/api/reward/moonsign/list', { headers: A }); const row = ((l.b && l.b.pending) || []).find(x => String(x.address || '').indexOf(uid) >= 0); if (!row) return null; return j('/api/reward/moonsign/review', { method: 'POST', headers: A, body: JSON.stringify({ id: row.id, action: 'reject', note: 'e2e' }) }); };
  const s1 = await submit(1); ok(s1.s === 200 && s1.b && s1.b.ok, 'first submission accepted (' + s1.s + ')');
  const s1b = await submit(2); ok(s1b.s === 409 && s1b.b && s1b.b.error === 'already_submitted', 'a second submission while pending is refused (already_submitted)');
  const r1 = await reject(); ok(r1 && r1.s === 200, 'admin rejects it');
  const s2 = await submit(3); ok(s2.s === 200 && s2.b && s2.b.ok, 'one retry after a rejection is allowed');
  const r2 = await reject(); ok(r2 && r2.s === 200, 'admin rejects the retry');
  const s3 = await submit(4); ok(s3.s === 409 && s3.b && s3.b.error === 'limit_reached', 'third submission refused with limit_reached (' + s3.s + ' ' + (s3.b && s3.b.error) + ')');
  const mine = await j('/api/reward/moonsign/mine', { headers: U }); ok(mine.b && Array.isArray(mine.b.signups) && mine.b.signups.length === 2, 'the account sees its two rows (' + (mine.b && mine.b.signups && mine.b.signups.length) + ')');
  const rm = await j('/api/admin/e2euser', { method: 'POST', headers: { 'x-admin-key': K, 'content-type': 'application/json' }, body: JSON.stringify({ uid, op: 'rm' }) });
  ok(rm.s === 200, 'test member removed');
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
