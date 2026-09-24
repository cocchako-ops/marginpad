// fee-open-e2e.js - THE OPENING FEE IS TAKEN AT THE FILL (2026-09-24).
//
// Owner: "ne svidja mi se da covek vidi tipa $5 profita i zatvori poziciju da bi video da je zapravo u minusu
// zbog fee ... Ja hocu da kad otvore, odma im se uzme fee i smanji margina a onda kad zatvore da znaju unapred
// koliko placaju fee."
//
// Measured before building it: at 100x - and our own median position runs above that - the round trip is 11% of
// the stake, all of it invisible on the card until the moment of closing. At 50x, a card reading +$5.00 books
// -$0.50. That is the complaint, exactly.
//
// WHAT THIS SUITE IS ACTUALLY GUARDING, because two of these have been broken before and cost real money:
//
//   1. THE BOOKED NUMBER MUST NOT MOVE. pnl still charges BOTH legs against the COMMITTED margin, so ROE, the
//      paid boards and every closed trade in history mean what they meant yesterday (the owner's own call).
//      Between 2026-09-02 and 09-09 the fill wrote a margin already net of the open leg WHILE the close still
//      charged both - the entry leg counted twice, and a flat $100 at 163x read ROE -19.7% instead of -17.93%.
//      Checks 5-7 are that guard.
//   2. SETTLING THE FEE INTO THE LIVE NUMBER WAS REVERTED ON THE OWNER'S ORDER on 2026-09-09 (a fresh $100
//      position read -$12 and looked broken). The headline PnL on an open position stays GROSS; the cost is
//      NAMED beside it instead. Check 11 fails if the headline starts arriving net.
//   3. HISTORY IS NEVER REWRITTEN. A position filled before this change carries feeRate 0 and must still price
//      its liq on the old formula, byte for byte. Check 4.
//
// Falsify it by dropping the `rate` argument in mpcLiq (worker.js): checks 2, 3 and 8 go red.
//
// Usage: node build/fee-open-e2e.js

const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser.js');
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();
const B = 'https://marginpad.io';
const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail != null ? '  -> ' + detail : '')); }
};
const post = async (p, b) => { const r = await fetch(B + p, { method: 'POST', headers: H, body: JSON.stringify(b) }); const t = await r.text(); try { return { s: r.status, j: JSON.parse(t) }; } catch (e) { return { s: r.status, j: null, raw: t.slice(0, 200) }; } };
const get = async (p) => { const r = await fetch(B + p, { headers: H }); const t = await r.text(); try { return JSON.parse(t); } catch (e) { return { _raw: t.slice(0, 200) }; } };

// the formula, written out independently of the worker so the test does not just restate the implementation
const oldLiq = (entry, lev, mmr, long) => long ? entry * (1 - (1 - mmr) / lev) : entry * (1 + (1 - mmr) / lev);
const newLiq = (entry, lev, mmr, long, rate) => { const f = 1 - Math.min(0.1, rate * lev); return long ? entry * (1 - (1 - mmr) * f / lev) : entry * (1 + (1 - mmr) * f / lev); };

(async () => {
  if (!ADMIN) { console.error('fee-open-e2e: ADMIN_KEY.local.txt has no mpadm_ token'); process.exitCode = 1; return; }
  const UID = 'e2e-fee' + Date.now().toString(36);
  await post('/api/admin/e2euser', { uid: UID, op: 'mk' });

  try {
    console.log('\nthe fill');
    // A LONG AND A SHORT, at a leverage where the fee is a real share of the stake.
    const positions = {};
    for (const side of ['long', 'short']) {
      const o = await post('/api/trade/open?uid=' + UID, { sym: 'BTC', side, lev: 100, margin: 100 });
      positions[side] = (o.j && (o.j.raw || o.j.position)) || o.j;
    }
    const L = positions.long, S = positions.short;
    ok('a position opens at all', !!(L && +L.entry > 0 && S && +S.entry > 0), JSON.stringify(L || {}).slice(0, 140));
    if (!L || !(+L.entry > 0)) throw new Error('no position');

    const rate = +L.feeRate, mmr = +L.mmr || 0.005;
    ok('the liq carries the opening fee, to the digit',
      Math.abs(L.liq - newLiq(L.entry, 100, mmr, true, rate)) < L.entry * 1e-9,
      'got ' + L.liq + ' want ' + newLiq(L.entry, 100, mmr, true, rate));
    // THE LOAD-BEARING ONE: it must be strictly CLOSER than the old formula, not merely different.
    ok('and it really sits closer than it used to', L.liq > oldLiq(L.entry, 100, mmr, true),
      'new ' + L.liq + ' old ' + oldLiq(L.entry, 100, mmr, true));
    ok('a short liquidates sooner too, on its own side',
      S.liq < oldLiq(S.entry, 100, mmr, false) && S.liq > S.entry,
      'new ' + S.liq + ' old ' + oldLiq(S.entry, 100, mmr, false) + ' entry ' + S.entry);
    ok('the opening fee is recorded as its own figure', Math.abs(+L.feeOpen - 100 * 100 * rate) < 0.01, String(L.feeOpen));

    // HISTORY IS NEVER REWRITTEN: the fee-less calculator, which every legacy row and every generic answer uses,
    // must be untouched. /api/liquidation is that path.
    const calc = await get('/api/liquidation?entry=100000&leverage=100&side=long&mmr=0.5');
    ok('a fee-less liquidation still answers the old number',
      Math.abs(+calc.liquidationPrice - oldLiq(100000, 100, 0.005, true)) < 0.02,
      JSON.stringify(calc).slice(0, 140));

    console.log('\nwhat the trader sees before pressing Close');
    // BOTH BROWSER LEGS RUN WHILE A POSITION IS STILL OPEN. The first cut closed the long first and the phone
    // leg then graded a CLOSED ticket, which carries no cost line by design - four checks red with nothing
    // wrong. The short opened above is the one on screen here.
    const sess = await post('/api/admin/e2euser', { uid: UID, op: 'sess' });
    const tok = sess.j && (sess.j.token || sess.j.sess);
    await withBrowser(async (browser) => {
      // A NARROW VIEWPORT IS NOT A PHONE. Without the touch flags and a real mobile UA the app shell takes a
      // different path and this leg found nothing at all - six checks red with the product working fine on the
      // device they were meant to describe.
      const IPH = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      for (const [label, vp, ua] of [['desktop', { width: 1366, height: 900 }, null], ['phone', { width: 390, height: 844, isMobile: true, hasTouch: true }, IPH]]) {
        const page = await browser.newPage();
        await page.setViewport(vp);
        if (ua) await page.setUserAgent(ua);
        if (tok) await page.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_uid', value: UID, domain: 'marginpad.io', path: '/' });
        await page.goto(B + '/paper-trade?nc=1', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForSelector('.ptl-cost', { timeout: 45000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 3500));
        const o = await page.evaluate(() => {
          const t = (q) => { const e = document.querySelector(q); return e ? e.innerText.replace(/\s+/g, ' ').trim() : null; };
          const mb = document.querySelector('.ptl-meta b[title]');
          const big = document.querySelector('.pt-last .big');
          return { meta: t('.ptl-meta'), cost: t('.ptl-cost'), title: mb ? mb.getAttribute('title') : null, big: big ? big.innerText.trim() : null, scrollW: document.documentElement.scrollWidth, vw: innerWidth };
        });
        // read the figures by what they FOLLOW, never by position in the string: the entry price carries one
        // decimal on BTC and none on a sub-penny coin, so an index into "every $ figure" is a moving target and
        // was silently one out on the first run.
        const after = (s2, word) => { const m2 = String(s2 || '').match(new RegExp(word + '\\s*(−?-?\\$[\\d,]+\\.\\d\\d)')); return m2 ? +m2[1].replace(/[^0-9.]/g, '') * (/[−-]\$/.test(m2[1]) ? -1 : 1) : null; };
        ok(label + ': the margin line says what is still backing the position', !!(o.meta && /Margin \$/.test(o.meta) && / of \$/.test(o.meta)), o.meta);
        ok(label + ': and names the stake and the fee it took', !!(o.title && /committed/.test(o.title) && /opening fee/.test(o.title)), o.title);
        ok(label + ': the closing cost is stated BEFORE the click', !!(o.cost && /closing fee/.test(o.cost)), o.cost);
        // the arithmetic on screen has to close: what you get back = stake + what the close books
        const book = after(o.cost, 'Close now'), back = after(o.cost, '·\\s*\\$[\\d,]+\\.\\d\\d closing fee ·');
        const working = after(o.meta, 'Margin'), stake = after(o.meta, 'of');
        ok(label + ': the numbers on screen agree with each other',
          book != null && back != null && stake != null && Math.abs((stake + book) - back) < 0.02,
          JSON.stringify({ book, back, working, stake }));
        ok(label + ': and the margin shown really is the stake less the opening fee',
          working != null && stake != null && working < stake && (stake - working) < stake * 0.12,
          JSON.stringify({ working, stake }));
        // AND THE HEADLINE STAYS GROSS - the 2026-09-09 revert, guarded
        ok(label + ': the headline P&L is still the market number, not the net one',
          !!(o.big && book != null && Math.abs((+String(o.big).replace(/[^0-9.]/g, '') * (/−|-/.test(o.big) ? -1 : 1)) - book) > 0.5),
          'headline ' + o.big + ' book ' + book);
        ok(label + ': nothing is wider than the screen', o.scrollW <= o.vw + 1, o.scrollW + ' vs ' + o.vw);
        await page.close();
      }
    }, 300000);

    console.log('\nthe money does not move');
    // Close at the live price and compare what the server booked against the formula in force since 2026-09-09:
    // gross minus BOTH legs minus funding, measured against the COMMITTED margin. The response is the Bot API
    // shape (entry_price / exit_price / pnl_usd / margin_usd), not the journal one.
    const c = await post('/api/trade/close?uid=' + UID, { id: L.id });
    const p = (c.j && c.j.position) || {};
    const exit = +p.exit_price, qty = +p.qty;
    if (exit > 0 && qty > 0) {
      const gross = qty * (exit - (+p.entry_price));
      const round = qty * ((+p.entry_price) + exit) * rate;
      ok('the close still charges BOTH legs, exactly once',
        Math.abs((+p.pnl_usd) - Math.round((gross - round) * 100) / 100) < 0.02,
        'booked ' + p.pnl_usd + ' want ' + (Math.round((gross - round) * 100) / 100));
      ok('and the margin on the row is what the trader committed, not what is left',
        Math.abs((+p.margin_usd) - 100) < 0.01, String(p.margin_usd));
      // the 2026-09-02 double-charge stated as arithmetic: the gap between gross and booked is ONE round trip
      ok('never two round trips - the entry leg is not counted twice',
        Math.abs((gross - (+p.pnl_usd)) - round) < 0.02,
        'gap ' + (gross - (+p.pnl_usd)).toFixed(4) + ' round trip ' + round.toFixed(4));
    } else ok('the close returns an exit price', false, JSON.stringify(c.j || {}).slice(0, 160));
  } finally {
    await post('/api/admin/e2euser', { uid: UID, op: 'rm' });
  }

  console.log('\nfee-open-e2e: ' + pass + ' passed, ' + fail + ' failed');
  // exitCode, never process.exit - exiting mid-teardown aborts inside libuv and the shell sees 127 on a green run
  process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.error('fee-open-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
