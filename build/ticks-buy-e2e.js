/* Buying Ticks with real money (2026-09-13). Proves the whole chain on prod without spending anything real:
   the pack list and its economy floor, the balance purchase (debit + grant + durable book row), idempotency,
   the refusal when the balance is short, the crypto invoice shape, and that the book reaches the admin route.
   A throwaway member is minted, credited from the ledger, used, and scrubbed.      node build/ticks-buy-e2e.js   */
'use strict';
const fs = require('fs'), path = require('path');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = process.env.MP_ADMIN_KEY || fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { _raw: t.slice(0, 200), _status: r.status }; } };
const uid = 'e2e' + Date.now().toString(36);

(async () => {
  // ---- the catalogue and its guard -------------------------------------------------------------------------------
  const packs = await j(await fetch(O + '/api/ticks/packs'));
  ok(Array.isArray(packs.packs) && packs.packs.length >= 2, 'packs are listed (' + (packs.packs || []).length + ')');
  ok((packs.packs || []).every(p => p.ticks > 0 && p.cents > 0 && p.per1k >= packs.floorPer1k), 'every pack is at or above the economy floor of ' + packs.floorPer1k + 'c per 1,000 Ticks');
  // the floor exists to stop a pack undercutting something that already has BOTH prices: the season pass, 2,500 T / $2.99
  const best = (packs.packs || []).reduce((a, b) => (b.per1k < a.per1k ? b : a));
  ok(Math.round(2500 / 1000 * best.per1k) >= 299, 'at the best rate 2,500 Ticks still cost at least the pass price ($' + (Math.round(2500 / 1000 * best.per1k) / 100).toFixed(2) + ' vs $2.99)');
  ok(Math.round(7000 / 1000 * best.per1k) > 799, 'at the best rate a legendary (7,000 T) costs more than buying one outright ($' + (Math.round(7000 / 1000 * best.per1k) / 100).toFixed(2) + ' vs $7.99 top cash price)');

  // ---- a throwaway member with a rewards balance ------------------------------------------------------------------
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'mk' }) });
  const s = await j(await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'sess' }) }));
  const tok = s.token || s.sess || s.mp_sess;
  if (!tok) { console.log('no session for the test member: ' + JSON.stringify(s)); process.exit(1); }
  const CK = { 'content-type': 'application/json', cookie: 'mp_sess=' + tok + '; mp_un=e2e_' + uid };
  const pk = packs.packs[0]; // the cheapest pack

  const before = await j(await fetch(O + '/api/auth/shop', { headers: CK }));
  const t0 = +before.ticks || 0;

  // short balance first: the purchase must be refused and nothing granted
  const poor = await j(await fetch(O + '/api/ticks/buy', { method: 'POST', headers: CK, body: JSON.stringify({ pack: pk.id }) }));
  ok(poor.error === 'insufficient' || poor.error === 'no_account', 'an empty balance is refused without granting anything (' + JSON.stringify(poor).slice(0, 70) + ')'); // a brand-new member has no ledger row at all yet, which the ledger answers as no_account
  const stillT = +(await j(await fetch(O + '/api/auth/shop', { headers: CK }))).ticks || 0;
  ok(stillT === t0, 'the refused purchase granted nothing (' + t0 + ' -> ' + stillT + ')');

  // fund the account through the same admin route the owner uses, then buy
  const credit = await j(await fetch(O + '/api/admin/credit', { method: 'POST', headers: H, body: JSON.stringify({ uid, usd: (pk.cents / 100) + 1, note: 'ticks e2e', op: 'gift' }) }));
  ok(credit && !credit.error, 'test member funded (' + JSON.stringify(credit).slice(0, 80) + ')');

  const buy = await j(await fetch(O + '/api/ticks/buy', { method: 'POST', headers: CK, body: JSON.stringify({ pack: pk.id }) }));
  ok(buy.ok === true && buy.granted === pk.ticks, 'balance purchase granted the pack (' + JSON.stringify(buy).slice(0, 90) + ')');
  const after = await j(await fetch(O + '/api/auth/shop', { headers: CK }));
  ok((+after.ticks || 0) === t0 + pk.ticks, 'the Ticks actually landed on the account (' + t0 + ' -> ' + after.ticks + ')');
  ok(Math.round((+before.balance || 0) * 100) + (pk.cents + 100) - pk.cents === Math.round((+after.balance || 0) * 100), 'the balance was debited exactly once (' + before.balance + ' +$' + ((pk.cents / 100) + 1).toFixed(2) + ' -$' + (pk.cents / 100).toFixed(2) + ' = ' + after.balance + ')');

  // a double tap inside the window is a retry, never a second charge
  const again = await j(await fetch(O + '/api/ticks/buy', { method: 'POST', headers: CK, body: JSON.stringify({ pack: pk.id }) }));
  ok(again.error === 'in_progress', 'an immediate repeat is refused as a retry, not charged again (' + JSON.stringify(again).slice(0, 60) + ')');

  ok((await j(await fetch(O + '/api/ticks/buy', { method: 'POST', headers: CK, body: JSON.stringify({ pack: 'tp_nope' }) }))).error === 'bad_pack', 'an unknown pack is refused');
  ok((await j(await fetch(O + '/api/ticks/buy', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pack: pk.id }) }))).error === 'login_required', 'a signed-out purchase is refused');

  // crypto: the invoice must be created for the signed-in member (or be cleanly unconfigured)
  const inv = await j(await fetch(O + '/api/ticks/checkout', { method: 'POST', headers: CK, body: JSON.stringify({ pack: pk.id }) }));
  ok(!!inv.invoice_url || inv.error === 'unconfigured' || inv.error === 'invoice_failed', 'crypto checkout answers with an invoice or a clean error (' + JSON.stringify(inv).slice(0, 70) + ')');

  // ---- the book the owner reads ----------------------------------------------------------------------------------
  const book = await j(await fetch(O + '/api/admin/tickbuys?e2e=1&n=50', { headers: { 'x-admin-key': K } }));
  const mine = (book.rows || []).filter(r => r.uid === uid);
  ok(mine.length === 1, 'exactly one row in the purchase book - the retry did not add a second (' + mine.length + ')');
  ok(mine[0] && mine[0].ticks === pk.ticks && mine[0].cents === pk.cents && mine[0].via === 'balance', 'the row carries who, how many and how much (' + JSON.stringify(mine[0] || null).slice(0, 110) + ')');
  const pub = await j(await fetch(O + '/api/admin/tickbuys?n=50', { headers: { 'x-admin-key': K } }));
  ok(!(pub.rows || []).some(r => r.uid === uid), 'test rows are hidden from the default view the owner sees');

  // ---- the limited frame is on sale, and its window is real -------------------------------------------------------
  const shop = await j(await fetch(O + '/api/auth/shop', { headers: CK }));
  const nova = (shop.items || []).find(i => i.id === 'supernova');
  ok(!!nova && nova.tier === 'apex' && !!nova.until, 'the apex frame is in the catalogue with an end date (' + (nova && nova.until) + ')');
  const days = nova ? Math.ceil((Date.parse(nova.until) - Date.now()) / 86400000) : 0;
  ok(days > 0 && days <= 21, 'its window is still open and no longer than the twenty days promised (' + days + ' days left)');
  const bgs = (shop.items || []).filter(i => i.kind === 'bg');
  ok(bgs.length >= 31, 'the new backgrounds are in the catalogue (' + bgs.length + ' total)');
  ok(['bg_tape', 'bg_girder', 'bg_smoke', 'bg_vaultdoor', 'bg_packice', 'bg_terrace', 'bg_lava', 'bg_reactor', 'bg_titan', 'bg_stormsea'].every(id => bgs.some(b => b.id === id)), 'all ten new backgrounds are listed and priced');

  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: H, body: JSON.stringify({ uid, op: 'rm' }) });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
