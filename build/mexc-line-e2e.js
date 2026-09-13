/* The MEXC fee comparison lives inside the FEE WINDOW, in every one of them (owner 2026-09-13: not on the ticket),
   on AS MANY tickets as it can honestly sit (owner 2026-09-14: "svuda da bude, i na dobitnim i na gubitnim, pa makar
   ušteda bila i jedan cent"). The seed covers what real journals hold: a win, a loss, an old row with no stamped
   rate, a tiny trade whose saving is under half a cent, and a stocks ticket — MEXC futures has no AAPL pair, so that
   one must NOT get a line or the link would 404. It also proves the line is built when the window OPENS rather than
   at render, which is what made it vanish: window.mpEx ships in the deferred mp-auth.js, so at first paint it is
   usually absent.                                                              node build/mexc-line-e2e.js          */
'use strict';
const { withBrowser } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const now = Date.now();
const J = [
  { id: String(now - 60000) + '_1', sym: 'BTC', side: 'long', lev: 10, margin: 100, qty: 100 * 10 / 60000, entry: 60000, exit: 60600, ts: now - 3600000, closeTs: now - 60000, status: 'win', pnl: 9.34, feeRate: 0.00055, src: 'client' },
  { id: String(now - 50000) + '_2', sym: 'ETH', side: 'short', lev: 20, margin: 50, qty: 50 * 20 / 3000, entry: 3000, exit: 3030, ts: now - 3000000, closeTs: now - 50000, status: 'loss', pnl: -10.9, feeRate: 0.00055, src: 'client' },
  { id: String(now - 40000) + '_3', sym: 'SOL', side: 'long', lev: 5, margin: 200, qty: 200 * 5 / 150, entry: 150, exit: 147, ts: now - 2000000, closeTs: now - 40000, status: 'loss', pnl: -20, src: 'client' }, // no feeRate stamped (old row)
  // a tiny trade: legs about half a cent, saving about a third of a cent. A half-cent floor used to hide it.
  { id: String(now - 30000) + '_4', sym: 'DOGE', side: 'long', lev: 2, margin: 2.5, qty: 2.5 * 2 / 0.4, entry: 0.4, exit: 0.402, ts: now - 1000000, closeTs: now - 30000, status: 'win', pnl: 0.02, feeRate: 0.00055, src: 'client' },
  // a stocks ticket: it HAS a fee window (0.02% stock rate) but MEXC futures has no such pair - no line, on purpose.
  { id: String(now - 20000) + '_5', sym: 'AAPL', side: 'long', lev: 5, margin: 100, qty: 100 * 5 / 250, entry: 250, exit: 248, ts: now - 900000, closeTs: now - 20000, status: 'loss', pnl: -4.1, feeRate: 0.0002, src: 'client' },
];
const CRYPTO_SYMS = ['BTC', 'ETH', 'DOGE'];   // the seeded rows MEXC can actually quote
(async () => {
  await withBrowser(async (browser) => {
    for (const cc of ['DE', 'US']) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.evaluateOnNewDocument((j, cc) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_cc', JSON.stringify({ cc: cc, ts: Date.now() })); localStorage.setItem('mp_grad_fw', '1'); } catch (e) {} }, J, cc); // mp_grad_fw: the first-win celebration would sit over the drawer and make the reachability check meaningless
      await page.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2500));
      const r = await page.evaluate(async () => {
        try { if (window.mpOpenTrades) window.mpOpenTrades(); } catch (e) {}
        await new Promise(r => setTimeout(r, 800));
        try { const t = document.querySelector('#jrDrawer [data-jt="closed"]'); if (t) t.click(); } catch (e) {} // the drawer opens on the Open tab; closed tickets live under Closed
        await new Promise(r => setTimeout(r, 1200));
        const cards = [...document.querySelectorAll('#jrDrawer .pp')];
        const closed = cards.filter(c => c.querySelector('.pp-res'));
        const per = [];
        for (const c of closed) {
          const onCard = [...c.querySelectorAll('.fb-mx')].filter(a => !a.closest('.pp-feebd')).length; // OUTSIDE the window: must be zero
          const feeBtn = c.querySelector('.pp-fee');
          if (feeBtn) { feeBtn.click(); await new Promise(r => setTimeout(r, 320)); }
          const pop = c.querySelector('.pp-feebd');
          const open = !!(pop && pop.classList.contains('on'));
          if (pop) { pop.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 220)); } // elementFromPoint answers null outside the viewport, and the drawer scrolls
          const a = pop ? pop.querySelector('.fb-mx') : null;
          const b = a ? a.getBoundingClientRect() : null;
          const hitEl = b ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) : null;
          const slot = pop ? pop.querySelector('[data-mxs]') : null;
          per.push({ sym: (c.querySelector('.pp-sym') || {}).textContent, res: (c.querySelector('.pp-res') || {}).textContent,
            slot: !!slot, filled: !!(slot && slot.getAttribute('data-done')),
            hasWindow: !!pop, windowOpened: open, onCard: onCard, inPop: pop ? pop.querySelectorAll('.fb-mx').length : 0,
            vis: !!(b && b.width > 0 && b.height > 0), hit: !!(hitEl && a && a.contains(hitEl)), href: a ? a.getAttribute('href') || '' : '', txt: ((pop && pop.querySelector('.fb-mx b') || {}).textContent || '').slice(0, 80) });
        }
        const cc = (() => { try { return window.mpEx && window.mpEx.ccNow ? window.mpEx.ccNow() : null; } catch (e) { return null; } })();
        return { cards: cards.length, closed: closed.length, per, cc };
      });
      console.log(cc, JSON.stringify(r));
      if (cc === 'DE') {
        ok(r.closed === 5, 'five closed tickets rendered (' + r.closed + ')');
        ok(r.per.every(p => p.onCard === 0), 'no MEXC line on the ticket itself (owner: it does not belong there)');
        const withWin = r.per.filter(p => p.hasWindow);
        ok(withWin.length >= 4, 'every ticket carrying a fee rate has a fee window (' + withWin.length + ' of ' + r.per.length + '; a row with no stamped rate has no breakdown to show)');
        ok(withWin.every(p => p.windowOpened), 'tapping Fees opens that window');
        ok(withWin.every(p => p.slot), 'each window carries the MEXC slot in its markup, not a finished line');
        const crypto = r.per.filter(p => CRYPTO_SYMS.indexOf(String(p.sym || '').trim().toUpperCase()) >= 0 && p.hasWindow);
        const stocks = r.per.filter(p => String(p.sym || '').trim().toUpperCase() === 'AAPL');
        ok(crypto.length === 3, 'the three crypto tickets with a window are all present (' + crypto.map(p => p.sym).join(', ') + ')');
        ok(crypto.every(p => p.filled), 'opening the window FILLS the slot - the line is not baked at render, when mpEx is still loading');
        ok(crypto.every(p => p.inPop === 1), 'every crypto fee window carries exactly one MEXC line, win and loss alike');
        const tiny = crypto.find(p => String(p.sym || '').trim().toUpperCase() === 'DOGE');
        ok(!!tiny && tiny.inPop === 1, 'a saving under half a cent still shows the line (owner: even one cent)');
        ok(stocks.length === 1 && stocks[0].hasWindow && stocks[0].inPop === 0, 'a stocks ticket has a fee window but NO MEXC line - MEXC futures has no such pair');
        ok(crypto.every(p => p.vis), 'the line is actually visible inside the open window');
        ok(crypto.every(p => /MEXC/.test(p.txt) && /\$\d/.test(p.txt)), 'each line names MEXC and prints a dollar amount');
        ok(crypto.every(p => p.hit), 'the line is clickable where it sits, not covered by anything');
        ok(crypto.every(p => /mexc\.com/.test(p.href) && /inviteCode=/.test(p.href)), 'and it carries our referral code');
      } else {
        ok(r.closed === 5 && r.per.every(p => p.inPop === 0 && p.onCard === 0), 'US reader: no MEXC line anywhere, window or ticket (partner rule)');
      }
      await ctx.close();
    }
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
