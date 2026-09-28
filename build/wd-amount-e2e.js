/* wd-amount-e2e (2026-09-28): A MEMBER PICKS HOW MUCH TO WITHDRAW (owner: "ljudi traze da unesu koliko hoce da povuku").
   A throwaway member is lifted to Bronze, credited $12.00 (plus the $0.50 welcome bonus every new member gets), and then: a $5.00 request leaves $7.50 on the balance; a second
   request is refused while the first waits (one at a time - the owner pays by hand); under the minimum and over the balance
   are refused; the queued row carries exactly $5.00. The page carries the amount field, the All button and the note.
   Cleans up: the pending withdrawal is cancelled with the silent admin cancel (refund), the rest is debited, the member removed.
   Needs ADMIN_KEY.local.txt (the mpadm_ token). Pays nobody.                                        node build/wd-amount-e2e.js */
const fs = require('fs');
const KEY = (fs.readFileSync(require('path').join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[A-Za-z0-9_-]+/) || [])[0];
const B = 'https://marginpad.io';
const H = { 'x-admin-key': KEY, 'content-type': 'application/json' };
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 240) : '')); };
const J = (u, o) => fetch(B + u, o).then(r => r.json());
const UID = 'e2e-wdamt1', UN = 'e2e_' + UID;
(async () => {
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) }).catch(() => {});
  const mk = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'mk' }) });
  const se = await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'sess' }) });
  const MH = { cookie: 'mp_sess=' + (se.token || se.sess), 'content-type': 'application/json' };
  const who = await J('/api/admin/xpdiag?u=' + encodeURIComponent(UN), { headers: H });
  const internal = who && who.user && who.user.id;
  ok(mk && internal, 'throwaway member minted', { internal: !!internal });
  const lift = await J('/api/auth/xp/setlevel?key=' + encodeURIComponent(KEY), { method: 'POST', headers: H, body: JSON.stringify({ uid: internal, level: 'bronze', note: 'wd-amount-e2e' }) });
  ok(lift && (lift.ok || lift.xp >= 500), 'lifted to Bronze (the withdrawal gate)', lift && { xp: lift.xp });
  const cr = await J('/api/admin/credit', { method: 'POST', headers: H, body: JSON.stringify({ username: UN, usd: 12, op: 'gift', note: 'wd-amount-e2e' }) });
  ok(cr && (cr.ok || cr.balanceUsd != null), 'credited $12.00', cr);
  const me0 = await J('/api/reward/me', { headers: MH });
  const B0 = +((me0 || {}).balance || 0); ok(me0 && B0 >= 12 && me0.canWithdraw === true, 'balance at least $12.00 (the welcome bonus, or a leftover from an aborted run, may sit on top - the clean-up drains it all), withdrawable', { bal: B0 });
  const near = (a, b) => Math.abs(a - b) < 0.001;
  const w1 = await fetch(B + '/api/reward/withdraw', { method: 'POST', headers: MH, body: JSON.stringify({ address: 'moon:e2ewdamt', amountUsd: 5 }) });
  const j1 = await w1.json();
  ok(w1.status === 200 && j1.ok && near(j1.amount, 5) && near(j1.remaining, B0 - 5) && j1.id, 'a $5.00 request is queued and the rest stays', j1);
  const me1 = await J('/api/reward/me', { headers: MH });
  ok(me1 && near(+me1.balance, B0 - 5), 'the balance reads the remainder afterwards', { bal: me1 && me1.balance });
  const w2 = await fetch(B + '/api/reward/withdraw', { method: 'POST', headers: MH, body: JSON.stringify({ address: 'moon:e2ewdamt', amountUsd: 5 }) });
  const j2 = await w2.json();
  ok(w2.status === 409 && j2.error === 'pending_exists' && near(j2.amount, 5), 'a second request is refused while the first waits (pending_exists, names the $5.00)', j2);
  // cancel the pending one silently (refund), then the bounds
  const cx = await J('/api/reward/wd/cancel', { method: 'POST', headers: H, body: JSON.stringify({ id: j1.id }) });
  ok(cx && cx.ok && near(+cx.refundedUsd, 5), 'admin cancel refunds the $5.00', cx);
  const me2 = await J('/api/reward/me', { headers: MH });
  ok(me2 && near(+me2.balance, B0), 'back to the full balance', { bal: me2 && me2.balance });
  const w3 = await fetch(B + '/api/reward/withdraw', { method: 'POST', headers: MH, body: JSON.stringify({ address: 'moon:e2ewdamt', amountUsd: 4.99 }) });
  const j3 = await w3.json();
  ok(w3.status === 400 && j3.error === 'bad_amount' && j3.minWd >= 1 && near(j3.max, B0), 'under the minimum is refused, and the answer names the bounds', j3);
  const w4 = await fetch(B + '/api/reward/withdraw', { method: 'POST', headers: MH, body: JSON.stringify({ address: 'moon:e2ewdamt', amountUsd: Math.round((B0 + 0.01) * 100) / 100 }) });
  const j4 = await w4.json();
  ok(w4.status === 400 && j4.error === 'bad_amount', 'over the balance is refused', j4);
  const w5 = await fetch(B + '/api/reward/withdraw', { method: 'POST', headers: MH, body: JSON.stringify({ address: 'moon:e2ewdamt' }) });
  const j5 = await w5.json();
  ok(w5.status === 200 && j5.ok && near(j5.amount, B0) && j5.remaining === 0, 'no amount = everything, as before (the old clients keep working)', j5);
  const cx2 = await J('/api/reward/wd/cancel', { method: 'POST', headers: H, body: JSON.stringify({ id: j5.id }) });
  ok(cx2 && cx2.ok, 'cancelled that one too');
  // the page
  const page = await fetch(B + '/rewards/?cb=' + Date.now()).then(r => r.text());
  ok(/id="wdAmt"/.test(page) && /id="wdAll"/.test(page) && /How much\?/.test(page) && /amountUsd:wdAmtVal\(\)/.test(page) && /pending_exists/.test(page) && !/Balance resets to \$0/.test(page), '/rewards/ carries the amount field, the All button, sends amountUsd and handles the new refusals');
  // clean up: take the $6 back, remove the member
  let left = B0, dbOk = true; while (left > 0.004) { const step = Math.min(5, Math.round(left * 100) / 100); const db = await J('/api/admin/credit', { method: 'POST', headers: H, body: JSON.stringify({ username: UN, usd: step, op: 'debit', note: 'wd-amount-e2e' }) }); if (!(db && (db.ok || db.balanceUsd != null))) { dbOk = false; break; } left = Math.round((left - step) * 100) / 100; } // a debit is capped at $5 a call
  const me9 = await J('/api/reward/me', { headers: MH });
  ok(dbOk && me9 && +me9.balance < 0.005, 'the test money is taken back', { bal: me9 && me9.balance });
  await J('/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid: UID, op: 'rm' }) });
  console.log(out.join('\n')); console.log('\nwd-amount-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
