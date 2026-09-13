/* MEXC fee line on EVERY closed ticket, win or loss (owner 2026-09-13). Seeds a guest journal with one winning and one
   losing closed trade (one without a stamped fee rate), opens My Trades on /paper-trade and asserts each closed card
   carries exactly one .fb-mx line, and none of it for a US reader (mp_cc=US).   node build/mexc-line-e2e.js            */
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
];
(async () => {
  await withBrowser(async (browser) => {
    for (const cc of ['DE', 'US']) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 1366, height: 900 });
      await page.evaluateOnNewDocument((j, cc) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.setItem('mp_cc', JSON.stringify({ cc: cc, ts: Date.now() })); } catch (e) {} }, J, cc);
      await page.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise(r => setTimeout(r, 2500));
      const r = await page.evaluate(async () => {
        try { if (window.mpOpenTrades) window.mpOpenTrades(); } catch (e) {}
        await new Promise(r => setTimeout(r, 800));
        try { const t = document.querySelector('#jrDrawer [data-jt="closed"]'); if (t) t.click(); } catch (e) {} // the drawer opens on the Open tab; closed tickets live under Closed
        await new Promise(r => setTimeout(r, 1200));
        const cards = [...document.querySelectorAll('#jrDrawer .pp')];
        const closed = cards.filter(c => c.querySelector('.pp-res'));
        const per = closed.map(c => ({ sym: (c.querySelector('.pp-sym') || {}).textContent, res: (c.querySelector('.pp-res') || {}).textContent, mx: c.querySelectorAll('.fb-mx').length, inPop: c.querySelectorAll('.pp-feebd .fb-mx').length, vis: (() => { const a = c.querySelector('.fb-mx'); if (!a) return false; const b = a.getBoundingClientRect(); return b.width > 0 && b.height > 0; })(), txt: ((c.querySelector('.fb-mx b') || {}).textContent || '').slice(0, 80) }));
        const cc = (() => { try { return window.mpEx && window.mpEx.ccNow ? window.mpEx.ccNow() : null; } catch (e) { return null; } })();
        return { cards: cards.length, closed: closed.length, per, cc };
      });
      console.log(cc, JSON.stringify(r));
      if (cc === 'DE') {
        ok(r.closed === 3, 'three closed tickets rendered (' + r.closed + ')');
        ok(r.per.every(p => p.mx === 1), 'every closed ticket carries exactly one MEXC line (win, loss, and the row without a fee rate)');
        ok(r.per.every(p => p.inPop === 0), 'the line sits on the card, not inside the fee popover');
        ok(r.per.every(p => /MEXC/.test(p.txt) && /\$\d/.test(p.txt)), 'each line names MEXC and prints a dollar amount');
      } else {
        ok(r.closed === 3 && r.per.every(p => p.mx === 0), 'US reader: no MEXC line on any ticket (partner rule)');
      }
      await ctx.close();
    }
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
