/* The MEXC fee comparison lives inside the FEE WINDOW, in every one of them (owner 2026-09-13: not on the ticket).
   Seeds a guest journal with a win, a loss and a row with no stamped fee rate, opens My Trades on /paper-trade, taps
   Fees on each closed ticket and asserts the window carries exactly one .fb-mx line, that the ticket itself carries
   none, and that a US reader gets no line at all.                              node build/mexc-line-e2e.js          */
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
          per.push({ sym: (c.querySelector('.pp-sym') || {}).textContent, res: (c.querySelector('.pp-res') || {}).textContent,
            hasWindow: !!pop, windowOpened: open, onCard: onCard, inPop: pop ? pop.querySelectorAll('.fb-mx').length : 0,
            vis: !!(b && b.width > 0 && b.height > 0), hit: !!(hitEl && a && a.contains(hitEl)), href: a ? a.getAttribute('href') || '' : '', txt: ((pop && pop.querySelector('.fb-mx b') || {}).textContent || '').slice(0, 80) });
        }
        const cc = (() => { try { return window.mpEx && window.mpEx.ccNow ? window.mpEx.ccNow() : null; } catch (e) { return null; } })();
        return { cards: cards.length, closed: closed.length, per, cc };
      });
      console.log(cc, JSON.stringify(r));
      if (cc === 'DE') {
        ok(r.closed === 3, 'three closed tickets rendered (' + r.closed + ')');
        ok(r.per.every(p => p.onCard === 0), 'no MEXC line on the ticket itself (owner: it does not belong there)');
        const withWin = r.per.filter(p => p.hasWindow);
        ok(withWin.length >= 2, 'the tickets that carry a fee rate have a fee window (' + withWin.length + ' of ' + r.per.length + '; a row with no stamped rate has no breakdown to show)');
        ok(withWin.every(p => p.windowOpened), 'tapping Fees opens that window');
        ok(withWin.every(p => p.inPop === 1), 'every fee window carries exactly one MEXC line, win and loss alike');
        ok(withWin.every(p => p.vis), 'the line is actually visible inside the open window');
        ok(withWin.every(p => /MEXC/.test(p.txt) && /\$\d/.test(p.txt)), 'each line names MEXC and prints a dollar amount');
        ok(withWin.every(p => p.hit), 'the line is clickable where it sits, not covered by anything');
        ok(withWin.every(p => /mexc\.com/.test(p.href) && /inviteCode=/.test(p.href)), 'and it carries our referral code');
      } else {
        ok(r.closed === 3 && r.per.every(p => p.inPop === 0 && p.onCard === 0), 'US reader: no MEXC line anywhere, window or ticket (partner rule)');
      }
      await ctx.close();
    }
  });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
