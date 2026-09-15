/* Fomo $1 sign-up bonus (2026-09-15, owner: "napravi $1 za Fomo login - nagrada ako se prijave i posalju username").
   It rides the same exsign table as the Moon bonus, so the things worth proving are the ones a shared table can get
   wrong: that the two surfaces do not leak into each other, that approval credits EXACTLY the configured dollar, and
   that one Fomo username can only ever be paid once across all accounts.
   Mints throwaway members, approves a real $1, and removes everything it made.
   node build/fomo-bonus-e2e.js                                                                                       */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };

(async () => {
  const mkUser = async (tag) => {
    const uid = tag + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
    await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) }); // rewards unlock at Bronze (500 XP)
    const se = await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) });
    const tok = se.b && (se.b.token || se.b.sess || se.b.mp_sess);
    return { uid, H: { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' }, tok };
  };
  const a = await mkUser('e2efomo'), b2 = await mkUser('e2efomo2');
  ok(!!a.tok && !!b2.tok, 'two test members with sessions');
  const adm = await j('/api/stats/session', { method: 'POST', headers: { 'x-admin-key': K } });
  ok(adm.b && adm.b.token, 'admin session minted');
  const A = { cookie: 'mp_sadm=' + adm.b.token, 'content-type': 'application/json' };

  const name = 'e2efomo' + Date.now().toString(36);
  const sub = (H, u) => j('/api/reward/fomosign/submit', { method: 'POST', headers: H, body: JSON.stringify({ uid: u }) });

  // the bonus is offered at all
  const acct0 = await j('/api/reward/account', { headers: a.H });
  ok(acct0.b && acct0.b.fomoUsd === 1, 'the page is told the bonus is $1 (fomoUsd=' + (acct0.b && acct0.b.fomoUsd) + ')');
  ok(acct0.b && acct0.b.fomoEnabled !== false, 'and that it is switched on');
  const bal0 = Math.round((acct0.b && acct0.b.balance || 0) * 100);

  // a username has to look like one
  const badv = await sub(a.H, 'x');
  ok(badv.s === 400 && badv.b && badv.b.error === 'bad_uid', 'a two-character username is refused (bad_uid)');

  const s1 = await sub(a.H, name);
  ok(s1.s === 200 && s1.b && s1.b.ok && s1.b.status === 'pending', 'the submission is accepted and waits for review');
  const s1b = await sub(a.H, name + 'z');
  ok(s1b.s === 409 && s1b.b && s1b.b.error === 'already_submitted', 'a second submission while one is pending is refused');

  // ONE USERNAME PAYS ONCE, across every account - the whole point of manual review
  const s2 = await sub(b2.H, name);
  ok(s2.s === 409 && s2.b && s2.b.error === 'uid_taken', 'the same Fomo username on another account is refused (uid_taken)');

  // THE TWO SURFACES SHARE A TABLE AND MUST NOT SHARE ROWS
  const mineF = await j('/api/reward/fomosign/mine', { headers: a.H });
  const mineM = await j('/api/reward/moonsign/mine', { headers: a.H });
  ok(mineF.b && (mineF.b.signups || []).length === 1 && mineF.b.signups[0].uid === name, 'the account sees its Fomo row on the Fomo surface');
  ok(mineM.b && (mineM.b.signups || []).length === 0, 'and the Moon surface does not show it');
  const listF = await j('/api/reward/fomosign/list', { headers: A });
  const rows = [...((listF.b && listF.b.pending) || []), ...((listF.b && listF.b.decided) || [])];
  ok(rows.length > 0 && rows.every(x => x.exchange === 'fomo'), 'the admin queue for Fomo contains only fomo rows (' + rows.length + ')');
  const row = ((listF.b && listF.b.pending) || []).find(x => String(x.address || '').indexOf(a.uid) >= 0);
  ok(!!row, 'the pending row is found for review');

  // the money
  const rev = await j('/api/reward/fomosign/review', { method: 'POST', headers: A, body: JSON.stringify({ id: row.id, action: 'approve' }) });
  ok(rev.s === 200 && rev.b && rev.b.status === 'approved' && rev.b.amount === 1, 'approving it pays exactly $1 (' + (rev.b && rev.b.amount) + ')');
  const acct1 = await j('/api/reward/account', { headers: a.H });
  const bal1 = Math.round((acct1.b && acct1.b.balance || 0) * 100);
  ok(bal1 - bal0 === 100, 'the balance moved by exactly 100 cents (' + bal0 + ' -> ' + bal1 + ')');

  // once paid, never again
  const s3 = await sub(a.H, name + 'q');
  ok(s3.s === 409 && s3.b && s3.b.error === 'already_submitted', 'an approved account cannot submit again');

  // the kill switch
  await j('/api/reward/config', { method: 'POST', headers: AK, body: JSON.stringify({ fomoEnabled: false }) });
  const off = await sub(b2.H, name + 'off');
  ok(off.s === 503 && off.b && off.b.error === 'paused', 'fomoEnabled:false pauses new submissions (' + off.s + ')');
  await j('/api/reward/config', { method: 'POST', headers: AK, body: JSON.stringify({ fomoEnabled: true }) });
  const back = await j('/api/reward/account', { headers: a.H });
  ok(back.b && back.b.fomoEnabled !== false, 'and it switches back on');

  // the partner link itself
  const go = await fetch(O + '/go?ex=fomo', { redirect: 'manual' });
  ok(go.status === 302 && String(go.headers.get('location') || '').indexOf('fomo.family/r/Marginpad') >= 0, '/go?ex=fomo redirects to the referral link');

  for (const u of [a.uid, b2.uid]) await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid: u, op: 'rm' }) });
  ok(true, 'test members removed');
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
