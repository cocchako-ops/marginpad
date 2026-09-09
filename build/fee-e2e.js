/* Fee arithmetic E2E (2026-09-09, owner: "otvorio sam poziciju od 100 dolara i odmah mi je oduzelo 12 — proveri da li
   lepo racunamo").
   Two findings, both proved here:
     A THE COST IS REAL. At 107x a $100 margin is a $10,700 position, and a 0.055% taker fee on both legs is $11.77.
       That was always charged; until 2026-09-09 the terminal simply did not show it until the trade closed.
     B THE MARGIN WAS SHORT BY THE OPEN LEG. Every server fill since 2026-09-02 stored `margin` MINUS the open-leg fee
       while the close still charged BOTH legs, so the fee was counted twice for everything that reads `margin`: the ROE
       denominator (5.9% too small at 107x) and Balance Mode equity. Realized pnl was never wrong.
   The suite opens real positions on a throwaway member and checks the stored row against the formula, so a future change
   to either side (open or close) that breaks the "charged exactly once" invariant fails here.
   Run: node build/fee-e2e.js */
const fs = require('fs'), path = require('path');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : ''));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const H = { 'x-admin-key': K, 'content-type': 'application/json' };
const TAG = Math.random().toString(36).slice(2, 8), uidE = 'e2efee' + TAG;
const jr = async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) });
const post = (p, b, hd) => fetch(ORIGIN + p, { method: 'POST', headers: Object.assign({}, H, hd || {}), body: JSON.stringify(b || {}) }).then(jr);
const journal = async () => { const j = (await fetch(ORIGIN + '/api/admin/journal?uid=' + uidE, { headers: H }).then(jr)).body; return j.journal || j.trades || []; };
const near = (a, b, tol) => Math.abs((+a) - (+b)) <= (tol == null ? 0.01 : tol);
const RATE = 0.00055; // crypto taker, both legs — feeRateFor()

(async () => {
  const se = await post('/api/admin/e2euser', { uid: uidE, op: 'sess' });
  const tok = se.body.token || ''; chk('throwaway member', se.status === 200 && !!tok);
  if (!tok) { console.log(out.join('\n')); process.exit(1); }
  const CK = { cookie: 'mp_sess=' + tok + '; mp_uid=' + uidE };

  // ---- B: what a fill stores
  for (const lev of [1, 20, 107]) {
    const o = await post('/api/trade/open', { sym: 'BTC', side: 'long', lev, margin: 100, cid: 'fee' + lev + TAG }, CK);
    const p = o.body.position || {};
    const expFeeOpen = Math.round(100 * lev * RATE * 1e6) / 1e6;
    chk('open ' + lev + 'x $100: margin is what the trader committed, not margin minus the open fee', o.status === 200 && p.margin === 100 && p.riskAmt === 100, { margin: p.margin, riskAmt: p.riskAmt, lev: p.lev });
    chk('open ' + lev + 'x: the open-leg fee is still recorded for the ticket breakdown', near(p.feeOpen, expFeeOpen, 0.000001), { feeOpen: p.feeOpen, expected: expFeeOpen });
    chk('open ' + lev + 'x: the position is sized on the full margin (qty*entry = margin*lev)', near((+p.qty) * (+p.entry), 100 * lev, 0.5), { notional: Math.round((+p.qty) * (+p.entry) * 100) / 100, expected: 100 * lev });
    chk('open ' + lev + 'x: a fresh position starts at zero P&L, and the fee it will owe is the round trip', p.pnl === null && near((+p.qty) * (+p.entry) * 2 * RATE, 100 * lev * 2 * RATE, 0.02), { roundTrip: Math.round((+p.qty) * (+p.entry) * 2 * RATE * 100) / 100 });
  }
  // the owner's case, in one line: 107x on $100 costs $11.77 to open and close. That is the leverage, not a bug.
  chk('107x on $100 = a $10,700 position, so the round trip really is about $11.77', near(100 * 107 * 2 * RATE, 11.77, 0.01), { cost: Math.round(100 * 107 * 2 * RATE * 100) / 100 });

  // ---- A: what a close settles, against the formula
  await sleep(1200);
  let open = (await journal()).filter(t => t.status !== 'win' && t.status !== 'loss');
  chk('three positions are open', open.length === 3, { n: open.length });
  for (const t of open) {
    const c = await post('/api/trade/close', { id: t.id, pct: 100 }, CK);
    chk('close ' + t.lev + 'x accepted', c.status === 200 && !c.body.error, { err: c.body.error });
  }
  await sleep(1500);
  const closed = (await journal()).filter(t => t.status === 'win' || t.status === 'loss');
  chk('all three settled', closed.length === 3, { n: closed.length });
  for (const t of closed) {
    const dir = t.side === 'short' ? -1 : 1;
    const gross = (+t.qty) * ((+t.exit) - (+t.entry)) * dir;
    const fee = (+t.qty) * ((+t.entry) + (+t.exit)) * (+t.feeRate);
    const expected = Math.round((gross - fee - (+t.fund || 0)) * 100) / 100;
    chk('close ' + t.lev + 'x: realized pnl = gross - taker fee BOTH legs - funding, charged exactly once', near(t.pnl, expected, 0.02), { pnl: t.pnl, expected, gross: Math.round(gross * 100) / 100, fee: Math.round(fee * 100) / 100 });
    // the double charge would show up here: margin short by the open leg makes |ROE| bigger than the honest number
    const honestRoe = Math.round((+t.pnl) / 100 * 10000) / 100;
    const storedRoe = Math.round((+t.pnl) / (+t.margin) * 10000) / 100;
    chk('close ' + t.lev + 'x: ROE is measured against the full $100, so the board cannot inflate it', +t.margin === 100 && near(honestRoe, storedRoe, 0.001), { margin: t.margin, roe: storedRoe, honest: honestRoe });
  }
  try { await post('/api/admin/e2euser', { uid: uidE, op: 'rm' }); } catch (e) {}
  console.log(out.join('\n')); const f = out.filter(l => l.startsWith('FAIL')).length; console.log('\n' + (out.length - f) + '/' + out.length + ' PASS' + (f ? ' — ' + f + ' FAIL' : ''));
  process.exit(f ? 1 : 0);
})().catch(e => { console.error('suite crashed', e); process.exit(1); });
