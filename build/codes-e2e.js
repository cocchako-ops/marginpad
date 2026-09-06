/* Codes E2E (2026-09-06): a code can give the pro pass, cents on the rewards balance, Premium days or Ticks.
   Generated through the ops endpoint (key + ?e2e=1), redeemed through /api/pass (op buy, src code — the /season/ box) with the
   admin ?uid= hook on a throwaway member. Proven: each kind applies (response fields from the store / ledger), a code is one use
   per account, a used-up code refuses, a revoked code refuses, an unknown code refuses, the ops list shows kind + amount, and
   every redemption leaves a 'code' row in the live activity log.
   Run: node build/codes-e2e.js
*/
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const get = (p) => fetch(ORIGIN + p, { headers: H }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const UID = 'e2ecd' + Math.random().toString(36).slice(2, 7), UID2 = 'e2ecd' + Math.random().toString(36).slice(2, 7);
const gen = (kind, amt, uses) => post('/api/admin/passcodes?e2e=1', { op: 'gen', kind, amt, n: 1, uses: uses || 1, days: 1, note: 'codes-e2e ' + UID });
const redeem = (uid, code) => post('/api/pass?uid=' + uid, { op: 'buy', src: 'code', code });

(async () => {
  const mk = await post('/api/admin/e2euser', { uid: UID, op: 'mk' }), mk2 = await post('/api/admin/e2euser', { uid: UID2, op: 'mk' });
  chk('two e2e members minted', mk.body.ok && mk2.body.ok);

  const cC = (await gen('cents', 25, 2)).body, cP = (await gen('premium', 7, 1)).body, cT = (await gen('ticks', 40, 1)).body, cS = (await gen('pass', 0, 1)).body, cR = (await gen('cents', 10, 1)).body;
  chk('generated: cents / premium / ticks / pass codes with kind + amount echoed', cC.ok && cC.kind === 'cents' && cC.amt === 25 && cP.kind === 'premium' && cP.amt === 7 && cT.kind === 'ticks' && cT.amt === 40 && cS.kind === 'pass' && cR.ok, { cents: cC.codes, prem: cP.codes, ticks: cT.codes, pass: cS.codes });
  const bad = (await post('/api/admin/passcodes?e2e=1', { op: 'gen', kind: 'cents', amt: 0, n: 1 })).body;
  chk('a cents/premium/ticks code without an amount is refused', bad.error === 'amount_required', bad);
  const capped = (await gen('cents', 99999, 1)).body;
  chk('cents are capped at $5 per code', capped.ok && capped.amt === 500, capped.amt);

  const r1 = (await redeem(UID, cC.codes[0])).body;
  chk('cents code: consumed, credited on the ledger, balance returned', r1.ok && r1.kind === 'cents' && r1.amt === 25 && r1.credited === true && +r1.balanceUsd >= 0.25, r1);
  const r1b = (await redeem(UID, cC.codes[0])).body;
  chk('same account cannot redeem the same code twice', r1b.error === 'code_taken', r1b);
  const r1c = (await redeem(UID2, cC.codes[0])).body;
  chk('second account uses the second use of a 2-use code', r1c.ok && r1c.credited === true, r1c);
  const r1d = (await redeem(UID, cR.codes[0])).body; // fresh 1-use code on UID, then UID2 finds it used up
  const r1e = (await redeem(UID2, cR.codes[0])).body;
  chk('a used-up code refuses', r1d.ok && r1e.error === 'used_up', r1e);

  const r2 = (await redeem(UID, cP.codes[0])).body;
  chk('premium code: 7 days written on the account (until ~7d ahead)', r2.ok && r2.kind === 'premium' && r2.until > Date.now() + 6.9 * 86400000 && r2.until < Date.now() + 7.1 * 86400000, r2);
  const r3 = (await redeem(UID, cT.codes[0])).body;
  chk('ticks code: 40 Ticks granted', r3.ok && r3.kind === 'ticks' && r3.ticks === 40, r3);
  const r4 = (await redeem(UID, cS.codes[0])).body;
  const pass = (await get('/api/pass?uid=' + UID)).body;
  chk('pass code: pro track unlocked for this season', r4.ok && r4.kind === 'pass' && pass.pro === true, { r4, pro: pass.pro });
  const r5 = (await redeem(UID, 'MP-NOPE1-NOPE2')).body;
  chk('unknown code refuses', r5.error === 'bad_code', r5);
  const cV = (await gen('ticks', 5, 5)).body; await post('/api/admin/passcodes?e2e=1', { op: 'revoke', code: cV.codes[0] });
  const r6 = (await redeem(UID2, cV.codes[0])).body;
  chk('revoked code refuses', r6.error === 'bad_code', r6);

  const ml = (await get('/api/admin/acctlog?uid=' + UID)).body; // the durable per-account money history (2026-09-06)
  const giftRows = (ml.rows || []).filter(r => r.type === 'gift' && r.detail === 'code');
  chk('money history: the cents code shows as a durable ledger row (+25 cents, from code) with the account balance', giftRows.length >= 2 && giftRows.some(r => r.amount === 25) && giftRows.some(r => r.amount === 10) && ml.account && (+ml.account.balance || 0) >= 25 && ml.acct === 'u:' + UID, { rows: (ml.rows || []).map(r => r.type + ':' + r.amount), balance: ml.account && ml.account.balance });
  const mlU = (await get('/api/admin/acctlog?u=e2e_' + UID)).body;
  chk('money history: resolves a username too', mlU.acct === 'u:' + UID && (mlU.rows || []).length >= 1, mlU.acct);
  // batches (2026-09-06, owner): one generation = one batch id on every code; mp-ops lists per batch, copies the batch, revokes the batch
  const cB = (await post('/api/admin/passcodes?e2e=1', { op: 'gen', kind: 'ticks', amt: 5, n: 3, uses: 1, days: 1, note: 'codes-e2e batch ' + UID })).body;
  chk('a generation of 3 returns one batch id', cB.ok && cB.codes.length === 3 && /^b[a-z0-9]{8,}$/.test(cB.batch || ''), cB.batch);
  const list = (await get('/api/admin/passcodes')).body;
  const mine = (list.codes || []).filter(c => /codes-e2e/.test(c.note || ''));
  chk('ops list carries kind + amount + uses for every generated code', mine.length >= 6 && mine.every(c => c.kind && (c.kind === 'pass' || c.kind === 'bundle' || c.kind === 'item' || c.amt > 0)) && mine.some(c => c.kind === 'premium' && c.amt === 7), mine.map(c => c.kind + ':' + c.amt + ':' + c.used + '/' + c.uses));
  const inB = (list.codes || []).filter(c => c.batch === cB.batch);
  chk('the list carries the batch id on all 3 codes of that generation and on nothing else', inB.length === 3 && inB.every(c => cB.codes.indexOf(c.code) >= 0), inB.map(c => c.code));
  // one code per drop per account (owner 2026-09-06): UID takes code 0 of the batch, then code 1 refuses for UID and still works for UID2
  const b0 = (await redeem(UID, cB.codes[0])).body, b1 = (await redeem(UID, cB.codes[1])).body, b2 = (await redeem(UID2, cB.codes[1])).body;
  chk('one code per batch per member: second code of the same drop -> batch_taken, another member takes it fine', b0.ok && b1.error === 'batch_taken' && b2.ok, { b0: b0.ok, b1: b1.error, b2: b2.ok });
  const rb = (await post('/api/admin/passcodes?e2e=1', { op: 'revokebatch', batch: cB.batch })).body;
  const rb1 = (await redeem(UID2, cB.codes[1])).body;
  chk('revoke the whole batch: every not-yet-revoked code of it is revoked (used-up ones too), a code from it refuses', rb.ok && rb.revoked === 3 && rb1.error === 'bad_code', { rb, rb1 });

  // ---- codes v2 (2026-09-06): bundles, requirements, custom codes, unlimited uses, batch delete/extend, redemptions in the list
  const genV2 = (body) => post('/api/admin/passcodes?e2e=1', Object.assign({ op: 'gen', n: 1, uses: 1, days: 1, note: 'codes-e2e v2 ' + UID }, body));
  const bnd = (await genV2({ give: { ticks: 30, prem: 2, xp: 40, item: 'carbon', fz: 1 } })).body;
  chk('v2: a bundle code (Ticks + Premium + XP + a skin + a freeze) generates with kind bundle and the give echoed', bnd.ok && bnd.kind === 'bundle' && bnd.give && bnd.give.ticks === 30 && bnd.give.prem === 2 && bnd.give.xp === 40 && bnd.give.item === 'carbon' && bnd.give.fz === 1, bnd);
  const rv0 = (await redeem(UID2, bnd.codes[0])).body;
  chk('v2: redeeming the bundle applies every part (Ticks, Premium until, XP (>= 40: Premium landed first and adds its bonus), Carbon in the Vault, freeze banked)', rv0.ok && rv0.applied && rv0.applied.ticks === 30 && rv0.applied.prem === 2 && rv0.applied.until > Date.now() + 1.9 * 86400000 && rv0.applied.xp >= 40 && rv0.applied.item === 'carbon' && rv0.applied.fz === 1, rv0.applied);
  const shop2 = (await get('/api/auth/shop?uid=' + UID2)).body;
  chk('v2: the skin from the code is really owned (store)', (shop2.owned || []).indexOf('carbon') >= 0, shop2.owned);
  const bnd2 = (await genV2({ give: { item: 'carbon', ticks: 5 } })).body, rv1 = (await redeem(UID2, bnd2.codes[0])).body;
  chk('v2: a code with a skin the member already owns still pays the rest and says so', rv1.ok && rv1.applied.itemOwned === 'Carbon' && !rv1.applied.item && rv1.applied.ticks === 5, rv1.applied);
  const capd = (await genV2({ give: { cents: 9999, prem: 999, ticks: 99999, xp: 99999, fz: 99 } })).body;
  chk('v2: every part is capped (cents 500, prem 365, ticks 5000, xp 2000, fz 5)', capd.ok && capd.give.cents === 500 && capd.give.prem === 365 && capd.give.ticks === 5000 && capd.give.xp === 2000 && capd.give.fz === 5, capd.give);
  const nothing = (await post('/api/admin/passcodes?e2e=1', { op: 'gen', give: { item: 'shield' }, n: 1 })).body;
  chk('v2: a code that would give only a supply gives nothing -> amount_required', nothing.error === 'amount_required', nothing);
  const cust = (await genV2({ give: { ticks: 7 }, custom: 'e2e-welcome-' + UID.slice(-4) })).body;
  chk('v2: a custom (vanity) code is stored upper-case as typed', cust.ok && cust.codes[0] === ('E2E-WELCOME-' + UID.slice(-4)).toUpperCase(), cust.codes);
  const custDup = (await genV2({ give: { ticks: 7 }, custom: cust.codes[0] })).body, custMany = (await genV2({ give: { ticks: 7 }, custom: 'E2EX-' + UID.slice(-4), n: 2 })).body;
  chk('v2: a duplicate custom code is refused, a custom code with n>1 is refused', custDup.error === 'custom_exists' && custMany.error === 'custom_single', { custDup, custMany });
  const rcu = (await redeem(UID, cust.codes[0].toLowerCase())).body;
  chk('v2: the custom code redeems (case-insensitive)', rcu.ok && rcu.applied.ticks === 7, rcu);
  const lvl = (await genV2({ give: { ticks: 3 }, minXp: 1000000 })).body, rlv = (await redeem(UID, lvl.codes[0])).body;
  chk('v2: a min-XP requirement refuses a low account with the numbers', rlv.error === 'too_low_level' && rlv.need === 1000000 && rlv.have >= 0, rlv);
  const nw = (await genV2({ give: { ticks: 3 }, newDays: 1 })).body, rnw = (await redeem(UID, nw.codes[0])).body;
  chk('v2: a new-accounts-only code accepts the minutes-old test member', rnw.ok && rnw.applied.ticks === 3, rnw);
  const unl = (await genV2({ give: { xp: 5 }, uses: 0 })).body;
  chk('v2: uses 0 = unlimited is stored as 0', unl.ok && unl.uses === 0, unl.uses);
  const ru1 = (await redeem(UID, unl.codes[0])).body, ru2 = (await redeem(UID2, unl.codes[0])).body;
  chk('v2: an unlimited code serves both members, one use each', ru1.ok && ru2.ok, { ru1: ru1.ok, ru2: ru2.ok });
  const ext = (await post('/api/admin/passcodes?e2e=1', { op: 'extend', batch: unl.batch, days: 30 })).body;
  chk('v2: extend moves the batch expiry ~30 days out', ext.ok && ext.exp > Date.now() + 29 * 86400000, ext);
  const lst2 = (await get('/api/admin/passcodes')).body;
  const rowU = (lst2.codes || []).filter(c => c.code === unl.codes[0])[0], redU = (lst2.redeems || []).filter(r => r.code === unl.codes[0]);
  chk('v2: the list carries give/req objects and the redemptions with usernames', rowU && rowU.give && rowU.give.xp === 5 && redU.length === 2 && redU.every(r => /^e2e_/.test(r.username || '')), { give: rowU && rowU.give, red: redU.map(r => r.username) });
  const del = (await post('/api/admin/passcodes?e2e=1', { op: 'delete', batch: unl.batch })).body, lst3 = (await get('/api/admin/passcodes')).body;
  chk('v2: delete removes the batch and its redemption rows', del.ok && del.deleted === 1 && !(lst3.codes || []).some(c => c.code === unl.codes[0]) && !(lst3.redeems || []).some(r => r.code === unl.codes[0]), del);

  const act = (await get('/api/admin/activity?h=1&e2e=1&actor=u:e2e_' + UID)).body;
  const rows = (act.rows || []).filter(r => r.t === 'code');
  chk('live activity: one code row per redemption with kind + amount', rows.length >= 4 && rows.some(r => r.x && r.x.kind === 'cents' && r.x.amt === 25) && rows.some(r => r.x && r.x.kind === 'premium'), rows.map(r => r.e));

  for (const u of [UID, UID2]) await post('/api/admin/e2euser', { uid: u, op: 'rm' });
  // the batches this run generated leave the owner's list (delete removes the codes and their redemption rows; rewards on the scrubbed members are gone with them)
  const fin = (await get('/api/admin/passcodes')).body; const mineB = {}; (fin.codes || []).forEach(c => { if (c.batch && /codes-e2e/.test(c.note || '')) mineB[c.batch] = 1; });
  let delN = 0; for (const bt of Object.keys(mineB)) { const dr = (await post('/api/admin/passcodes?e2e=1', { op: 'delete', batch: bt })).body; if (dr && dr.ok) delN++; }
  const fin2 = (await get('/api/admin/passcodes')).body;
  chk('cleanup: members scrubbed and every codes-e2e batch deleted from the ops list', delN === Object.keys(mineB).length && !(fin2.codes || []).some(c => /codes-e2e/.test(c.note || '')), { batches: Object.keys(mineB).length, deleted: delN });
  out.forEach(l => console.log(l));
  const badN = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + badN + ' failed  (uid ' + UID + ')');
  process.exit(badN ? 1 : 0);
})();
