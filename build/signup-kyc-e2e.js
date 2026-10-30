/* THE SIGN-UP BONUS IS NOT PAID TO AN UNVERIFIED ACCOUNT, AND EVERY REJECTION CARRIES A REASON (2026-10-30, owner:
   "nemoj da isplacujemo ljude koji se nisu verifikovali na menjacnici ... odbijaces ih sa porukom da treba da se
   verifikuju ... pogledaj da li dobijaju lepo i citko reject reason").

   What a behavioural test can prove here:
     - the sweep's verdict on a REAL referral the venue reports as unverified is `ours_unverified` (a dry run on a
       throwaway member - the desk looks at test rows with ?e2e=1, a paying pass never does);
     - a KYC rejection reaches the member WITHOUT the [kyc] mark, flagged `kyc:true`, and does NOT spend one of the
       account's two submissions (the ledger excludes it from the count);
     - a rejection with NO reason typed is filed with a readable default naming support;
     - the two-submission limit still closes after two ORDINARY rejections.
   Mints one throwaway member and removes it (e2euser rm wipes its claims out of the ledger).
   node build/signup-kyc-e2e.js                                                                                  */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (p, opt) => { const r = await fetch(O + p, opt); let b = null; try { b = await r.json(); } catch (e) {} return { s: r.status, b }; };
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
// a BingX UID the roster reports as OURS and NOT verified (read off /api/admin/bingxverify?list=1 on 2026-10-30); the
// test picks one live from the roster so a member finishing KYC does not silently retire the fixture
async function pickUnverified() {
  const r = await j('/api/admin/bingxverify?list=1', { headers: AK });
  const rows = (r.b && r.b.roster) || [];
  const taken = new Set(); try { const l = await j('/api/reward/bingxsign/list?all=1', { headers: AK }); for (const x of ((l.b && l.b.decided) || []).concat((l.b && l.b.pending) || [])) if (x.status !== 'rejected') taken.add(String(x.uid)); } catch (e) {}
  const c = rows.filter(x => x.kyc === false && !taken.has(String(x.uid)))[0];
  return c ? String(c.uid) : '';
}
(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  ok(src.indexOf("r.kyc === false") > 0 && src.indexOf("'ours_unverified'") > 0, 'the sweep has a KYC verdict (ours_unverified)');
  ok(src.indexOf("status='rejected' AND note LIKE '[kyc]%'") > 0, "the ledger's two-submission count excludes a KYC rejection");
  ok((src.match(/\.replace\(\/\^\\\[kyc\\\]\\s\*\/, ''\)/g) || []).length >= 3, 'the [kyc] mark is stripped on mine, list and the bell row');
  const ops = fs.readFileSync(path.join(__dirname, '..', 'src', 'ops', 'client', 'ops.js.txt'), 'utf8');
  ok(ops.indexOf("prompt('Reason shown to the user (optional):')") < 0, 'the desk no longer asks for a reason through a native prompt');
  ok(ops.indexOf("Not verified (KYC)") > 0, 'the desk offers the KYC reason as a chip');

  const uid = 'e2ekyc' + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);
  await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  const se = await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) });
  const tok = se.b && (se.b.token || se.b.sess || se.b.mp_sess);
  ok(!!tok, 'a throwaway member with a session');
  const H = { cookie: 'mp_sess=' + tok, 'content-type': 'application/json' };
  const sub = u => j('/api/reward/bingxsign/submit', { method: 'POST', headers: H, body: JSON.stringify({ uid: u }) });
  const mine = async () => ((await j('/api/reward/bingxsign/mine', { headers: H })).b || {}).signups || [];
  const review = (id, action, note) => j('/api/reward/bingxsign/review', { method: 'POST', headers: AK, body: JSON.stringify({ id, action, note, notify: true }) });
  try {
    const bx = await pickUnverified();
    ok(!!bx, 'the BingX roster carries a referral it reports as unverified (' + (bx || 'none') + ')');
    if (bx) {
      const s1 = await sub(bx);
      ok(s1.s === 200 && s1.b && s1.b.ok, 'the claim is filed (' + s1.s + ' ' + JSON.stringify(s1.b).slice(0, 60) + ')');
      const dry = await j('/api/admin/bingxverify?e2e=1&limit=40', { headers: AK });
      const row = ((dry.b && dry.b.rows) || []).filter(x => x.id === (s1.b && s1.b.id))[0];
      ok(!!row, 'the dry run looked at the test row');
      ok(row && row.verdict === 'ours_unverified' && row.kyc === false, 'verdict: ours but unverified (' + (row && row.verdict) + ')');
      ok(dry.b && dry.b.approved === 0 && !(row && row.paid), 'nothing was paid for it');
      ok(dry.b && (dry.b.unverified || 0) >= 1, 'the sweep counts it as held for verification (unverified ' + (dry.b && dry.b.unverified) + ')');
      // the KYC rejection, the way the sweep writes it after the day of grace
      const r1 = await review(s1.b.id, 'reject', '[kyc] Your BingX account is one of our referrals, but it has not completed identity verification (KYC) on BingX yet. Finish the verification, then submit the UID once more.');
      ok(r1.b && r1.b.status === 'rejected', 'the KYC rejection is filed');
      const m1 = (await mine())[0] || {};
      ok(m1.status === 'rejected' && m1.kyc === true, 'the member sees it flagged as a KYC rejection');
      ok(m1.note && m1.note.indexOf('[kyc]') < 0 && /verification/i.test(m1.note), 'and reads the reason without the mark: ' + String(m1.note).slice(0, 60));
    }
    // a KYC rejection spends no submission: two ORDINARY rejections still fit after it
    const s2 = await sub('e2ekyc2' + Date.now().toString(36).slice(-5));
    ok(s2.s === 200 && s2.b && s2.b.ok, 'the member may submit again after a KYC rejection (' + s2.s + ' ' + ((s2.b && s2.b.error) || 'ok') + ')');
    const r2 = await review(s2.b.id, 'reject', '');
    ok(r2.b && r2.b.status === 'rejected', 'an ordinary rejection with NO reason typed is filed');
    const m2 = (await mine())[0] || {};
    ok(m2.note && /support@marginpad\.io/.test(m2.note) && m2.kyc !== true, 'and carries the readable default naming support: ' + String(m2.note).slice(0, 70));
    const s3 = await sub('e2ekyc3' + Date.now().toString(36).slice(-5));
    ok(s3.s === 200 && s3.b && s3.b.ok, 'the second ordinary submission is still allowed');
    await review(s3.b.id, 'reject', 'Wrong UID, as a test.');
    const s4 = await sub('e2ekyc4' + Date.now().toString(36).slice(-5));
    ok(s4.s === 409 && s4.b && s4.b.error === 'limit_reached', 'the third ordinary submission is refused (limit_reached) - the limit itself is intact');
  } finally {
    await j('/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
    const left = await j('/api/reward/bingxsign/list?all=1&e2e=1', { headers: AK });
    const mineLeft = ((left.b && left.b.decided) || []).concat((left.b && left.b.pending) || []).filter(x => String(x.address || '').indexOf(uid) >= 0);
    ok(mineLeft.length === 0, 'the throwaway member and its claims are gone (' + mineLeft.length + ' left)');
  }
  console.log('\nsignup-kyc-e2e: ' + pass + ' ok, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
