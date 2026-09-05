/* Guest carry-over E2E (2026-09-06). A guest's paper trades already ship into the account at sign-in through
   syncTrades(); the new part is the MOMENT: one card on the device that held closed guest trades, saying what
   came with you (closes, net, wins, best ROE) and that they count now. Once per account per device.

   Proven on production in a real browser: the local journal is seeded with three closed guest trades, the shipped
   window.mpCarryOver() is called the way the sign-in handler calls it, and the card is asserted for numbers,
   reachability, the My Trades button and the once-only rule. Nothing is written server-side.

   Run: node build/carry-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));

(async () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-auth.js'), 'utf8');
  chk('sign-in handler calls the carry-over after the OTP is verified', src.indexOf("window.mpCarryOver(ME && ME.id, !!d.isNew)") > 0);
  chk('carry-over ships in the bundle', src.indexOf('window.mpCarryOver = function (uid, isNew)') > 0);

  let r = null;
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1280, height: 860 });
    await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('typeof window.mpCarryOver === "function"', { timeout: 20000 }).catch(() => {});
    r = await page.evaluate(async () => {
      const uid = 'e2ecarry' + Date.now().toString(36);
      const t0 = Date.now() - 3600000;
      const J = [
        { id: 'g1', ts: t0, sym: 'BTC', side: 'long', lev: 10, margin: 100, status: 'win', pnl: 10, exit: 1, closeTs: t0 + 60000 },
        { id: 'g2', ts: t0 + 1000, sym: 'ETH', side: 'short', lev: 5, margin: 50, status: 'loss', pnl: -4, exit: 1, closeTs: t0 + 120000 },
        { id: 'g3', ts: t0 + 2000, sym: 'SOL', side: 'long', lev: 20, margin: 100, status: 'win', pnl: 26, exit: 1, closeTs: t0 + 180000 },
        { id: 'g4', ts: t0 + 3000, sym: 'BTC', side: 'long', lev: 10, margin: 100, status: 'open' },
      ];
      localStorage.setItem('mp_journal', JSON.stringify(J));
      const noClose = (function () { localStorage.setItem('mp_journal', '[]'); const v = window.mpCarryOver(uid + 'x', true); localStorage.setItem('mp_journal', JSON.stringify(J)); return v; })();
      const shown = window.mpCarryOver(uid, true);
      await new Promise(res => setTimeout(res, 400));
      const box = document.getElementById('mpCo'); if (!box) return { shown, noClose, box: false };
      const g = [...box.querySelectorAll('.mpco-g b')].map(b => b.textContent.trim());
      const br = box.getBoundingClientRect(); const hit = document.elementFromPoint(br.left + br.width / 2, br.top + 20);
      const go = box.querySelector('.mpco-go'); const gr = go.getBoundingClientRect(); const hit2 = document.elementFromPoint(gr.left + gr.width / 2, gr.top + gr.height / 2);
      const again = window.mpCarryOver(uid, true);
      const title = box.querySelector('.mpco-t').textContent, kicker = box.querySelector('.mpco-k').textContent;
      const inView = br.right <= window.innerWidth + 0.5 && br.bottom <= window.innerHeight + 0.5 && br.left >= -0.5;
      let opened = false; window.mpOpenTrades = function () { opened = true; };
      go.click();
      await new Promise(res => setTimeout(res, 450));
      return { shown, noClose, box: true, g, title, kicker, reach: !!(hit && box.contains(hit)), goReach: hit2 === go, again, inView, opened, gone: !document.getElementById('mpCo') };
    });
    await ctx.close();
  });
  chk('a journal without closed trades shows nothing', r && r.noClose === false, r && r.noClose);
  chk('three closed guest trades: the card shows', r && r.shown === true && r.box, r);
  chk('numbers from the journal: net +$32.00, 2 / 3 wins, best ROE +26%', r && r.g && r.g[0] === '+$32.00' && r.g[1] === '2 / 3' && r.g[2] === '+26%', r && r.g);
  chk('copy: "Welcome aboard" and "Your 3 guest trades came with you."', r && /Welcome aboard/.test(r.kicker) && /Your 3 guest trades came with you/.test(r.title), r && { k: r.kicker, t: r.title });
  chk('card fully in the viewport and reachable; the My Trades button is reachable', r && r.inView && r.reach && r.goReach, r && { inView: r.inView, reach: r.reach, go: r.goReach });
  chk('once per account per device: the second call returns false', r && r.again === false, r && r.again);
  chk('See My Trades opens the journal and closes the card', r && r.opened && r.gone, r && { opened: r.opened, gone: r.gone });

  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
