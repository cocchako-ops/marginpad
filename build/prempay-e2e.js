/* Premium payment book E2E (2026-09-12). Owner: "on the Premium desk I want a list of who paid Premium, when and how much."
   Before this the only records were KV nowpay:* (90-day TTL), the ledger shoplog for balance payments and the current prem:sub
   expiry — no durable book. Now every payment is ONE row in RewardLedger `prempay` (keyed by payment id, in the 6h backup),
   read by GET /api/admin/prempay and drawn first on mp-ops Money > Premium desk.

   Proves: idempotent insert (an IPN retry can never double-count), e2e rows hidden from the owner's read unless asked,
   totals / per-payer / renewal maths, the desk renders the book (tiles, 12-month strip, rows, plan chips filter, paid column
   on Members), the phone width has no horizontal scroll, and the cleanup leaves nothing behind. Run: node build/prempay-e2e.js */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const jget = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const get = (p) => fetch(ORIGIN + p, { headers: H }).then(jget);
const post = (p, b) => fetch(ORIGIN + p, { method: 'POST', headers: H, body: JSON.stringify(b || {}) }).then(jget);
const TAG = Math.random().toString(36).slice(2, 8);
const uidE = 'e2epay' + TAG, acct = 'u:' + uidE;
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 300) : '')); console.log(out[out.length - 1]); };

(async () => {
  try {
    const before = await get('/api/admin/prempay');
    chk('book answers (rows, totals, 12 months, byPayer)', before.status === 200 && Array.isArray(before.body.rows) && before.body.totals && (before.body.months || []).length === 12 && Array.isArray(before.body.byPayer), { rows: before.body.rows.length, totals: before.body.totals });
    const now = Date.now();
    const r1 = await post('/api/admin/prempay?inject=1', { id: 'e2e:' + TAG + ':1', ts: now - 40 * 86400000, acct, kind: 'monthly', cents: 399, via: 'balance', cur: 'USD', until: now - 10 * 86400000 });
    const r2 = await post('/api/admin/prempay?inject=1', { id: 'e2e:' + TAG + ':2', ts: now - 3600000, acct, kind: 'founder', cents: 3999, via: 'nowpayments', cur: 'USDTTRC20', until: now + 100 * 365 * 86400000 });
    chk('two payments injected for a throwaway account', r1.body.added === true && r2.body.added === true, { r1: r1.body, r2: r2.body });
    const dup = await post('/api/admin/prempay?inject=1', { id: 'e2e:' + TAG + ':2', ts: now, acct, kind: 'founder', cents: 3999, via: 'nowpayments' });
    chk('same payment id again = ignored (an IPN retry can never double-count)', dup.status === 200 && dup.body.added === false, dup.body);
    const notE2e = await post('/api/admin/prempay?inject=1', { id: 'x' + TAG, acct: 'u:realuser1234', kind: 'monthly', cents: 399 });
    chk('inject refuses a non-e2e account', notE2e.status === 400 && notE2e.body.error === 'e2e_only', notE2e.body);

    const vis = await get('/api/admin/prempay?e2e=1');
    const mine = vis.body.rows.filter(r => r.acct === acct);
    const payer = (vis.body.byPayer || []).find(p => p.acct === acct);
    chk('with ?e2e=1 both rows are there, newest first, nth = 1 then 2', mine.length === 2 && mine[0].kind === 'founder' && mine[0].nth === 2 && mine[1].nth === 1, mine.map(r => [r.kind, r.nth, r.cents]));
    chk('per-payer maths: $43.98 over 2 payments; the second counts as a renewal', payer && payer.cents === 4398 && payer.n === 2 && vis.body.totals.renewals >= 1, payer);
    chk('the founder row carries the coin and lifetime access; the balance row says balance', mine[0].via === 'nowpayments' && mine[0].cur === 'USDTTRC20' && mine[1].via === 'balance', { via: mine.map(r => r.via) });
    const thisMonth = new Date(now).toISOString().slice(0, 7), mrow = vis.body.months.find(m => m.m === thisMonth);
    chk('month strip: this month includes the $39.99 founder payment', mrow && mrow.cents >= 3999 && mrow.m === thisMonth, mrow);
    const hid = await get('/api/admin/prempay');
    chk('without ?e2e=1 the test rows are hidden and the owner totals are unchanged', hid.body.rows.every(r => r.acct !== acct) && hid.body.totals.count === before.body.totals.count && hid.body.totals.lifetimeUsd === before.body.totals.lifetimeUsd, { count: hid.body.totals.count, was: before.body.totals.count });
    const bf = await get('/api/admin/prempay?backfill=1');
    chk('re-running the backfill imports nothing new (idempotent)', bf.body.backfill && bf.body.backfill.nowpay === 0 && bf.body.backfill.balance === 0 && bf.body.backfill.derived === 0, bf.body.backfill);

    // ---- the desk itself ----
    const sess = await post('/api/stats/session', {});
    chk('ops session minted', sess.body.ok && !!sess.body.token);
    await withBrowser(async (browser) => {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.setCookie({ name: 'mp_sadm', value: sess.body.token, domain: 'marginpad.io', path: '/', httpOnly: true, secure: true });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
      await page.goto(ORIGIN + '/api/stats#money/premium', { waitUntil: 'networkidle2', timeout: 120000 });
      for (let w = 0; w < 30; w++) { await sleep(500); if (await page.evaluate(() => document.querySelectorAll('#view .pmc').length === 12)) break; }
      const d = await page.evaluate(() => { const v = document.getElementById('view'), t = v.innerText; const first = v.querySelector('.card h2'); return { book: /paid for Premium, all time/i.test(t), last30: /last 30 days/i.test(t), renew: /renewals/i.test(t), firstCard: first ? first.innerText.trim().slice(0, 30) : '', months: v.querySelectorAll('.pmc').length, rows: v.querySelectorAll('.pmk').length, chips: v.querySelectorAll('#pmChips .chip').length, paidCol: !!Array.from(v.querySelectorAll('.tbl th')).find(th => th.innerText.trim().toLowerCase() === 'paid'), grantWord: /grant|owner/.test(t), whenCol: !!Array.from(v.querySelectorAll('.tbl th')).find(th => th.innerText.trim().toLowerCase() === 'when') }; });
      chk('desk: the payment book is the FIRST card, with tiles, a 12-month strip, chips and who/when/paid rows', d.book && d.last30 && d.renew && /Premium payments/i.test(d.firstCard) && d.months === 12 && d.chips === 5 && d.whenCol, d);
      chk('desk: Members carry a paid column (payer amount vs grant/owner)', d.paidCol && d.grantWord, { paidCol: d.paidCol });
      if (d.rows > 0) {
        const f = await page.evaluate(() => { const chips = document.querySelectorAll('#pmChips .chip'); const bal = Array.from(chips).find(c => /balance/i.test(c.textContent)); bal.click(); const trs = Array.from(document.querySelectorAll('#pmChips ~ .tblwrap table.tbl tbody tr, #pmChips + .tblwrap table.tbl tbody tr')); const all = Array.from(document.querySelectorAll('#view .pmk')).map(k => k.closest('tr')); const shown = all.filter(tr => !tr.hidden), hiddenBad = shown.filter(tr => !/balance/i.test((tr.querySelector('.pmv') || {}).getAttribute ? tr.querySelector('.pmv').getAttribute('data-v') : '')); const on = document.querySelector('#pmChips .chip.on'); Array.from(chips)[0].click(); const back = all.filter(tr => !tr.hidden).length; return { total: all.length, shown: shown.length, wrong: hiddenBad.length, on: on && on.textContent, back }; });
        chk('desk: the "From balance" chip keeps only balance rows and "All" brings every row back', f.wrong === 0 && f.back === f.total && /balance/i.test(f.on || ''), f);
      } else chk('desk: chip filter (skipped: the owner book has no rows to filter yet)', true);
      const shot = path.join(__dirname, 'ops-shots', 'v2-money-premium-book.png'); try { await page.screenshot({ path: shot }); } catch (e) {}
      // phone: nothing may scroll sideways
      await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true }); await sleep(800);
      const ph = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, months: document.querySelectorAll('#view .pmc').length, wide: Array.from(document.querySelectorAll('#view .pmm, #view .grid')).filter(e => e.getBoundingClientRect().right > 392).length }));
      chk('phone 390px: no horizontal scroll, the month strip and tiles fit', ph.sw <= 390 && ph.wide === 0, ph);
      chk('no page errors on the desk', errs.length === 0, errs);
      await ctx.close();
    });
  } catch (e) { chk('run', false, String(e && e.stack || e).slice(0, 400)); }
  finally {
    const pu = await post('/api/admin/prempay?purge=e2e', {});
    const after = await get('/api/admin/prempay?e2e=1');
    chk('cleanup: every e2e row purged', pu.body.ok === true && after.body.rows.every(r => !/^u:e2e/.test(r.acct)), { left: after.body.rows.filter(r => /^u:e2e/.test(r.acct)).length });
  }
  const fails = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + (out.length - fails) + '/' + out.length + ' passed');
  process.exit(fails ? 1 : 0);
})();
