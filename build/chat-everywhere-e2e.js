/* Chat everywhere E2E (2026-09-06). The trader chat used to exist only where mp-trade.js ships; on every other page
   the bottom-bar Chat was a link to '/' that landed with the chat closed. mp-nav.js now puts the FAB + box on any
   page that lacks them at load (stylesheet too) and pulls mp-trade.js on the first click, so the chat opens IN
   PLACE. Pages that already carry the widget are left alone; /spot is excluded.

   Proven on production in a real browser, desktop and 390px:
     /vault/, /pass/, /levels/, /academy/: the FAB is on the page at load, the bundle is NOT (lazy), a click opens
     the box without leaving the page; on the phone the bottom-bar Chat does the same.
     /, /rekt/: nothing injected (they ship their own). /spot/: nothing injected.

   Run: node build/chat-everywhere-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 200) : ''));

(async () => {
  await withBrowser(async (browser) => {
    async function fresh(w, h, mobile) { const ctx = await browser.createBrowserContext(); const page = await ctx.newPage(); await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: !!mobile, hasTouch: !!mobile }); const errs = []; page.on('pageerror', e => errs.push(String(e.message || e))); return { ctx, page, errs }; }

    for (const p of ['/vault/', '/season/', '/levels/', '/academy/']) {
      const { ctx, page, errs } = await fresh(1280, 860);
      await page.goto(ORIGIN + p + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("!!document.getElementById('chatFab')", { timeout: 15000 }).catch(() => {});
      const before = await page.evaluate(() => ({ fab: !!document.getElementById('chatFab'), host: !!document.getElementById('mpChatHost'), css: !!document.querySelector('link[href*="/assets/mp-trade.css"]'), js: typeof window.mpOpenChat === 'function', path: location.pathname }));
      chk(p + ' desktop: FAB and stylesheet on the page at load, bundle not yet', before.fab && before.host && before.css && !before.js, before);
      await page.evaluate(() => { const f = document.getElementById('chatFab'); f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
      await page.click('#chatFab');
      await page.waitForFunction("typeof window.mpOpenChat === 'function' && document.getElementById('chatBox') && !document.getElementById('chatBox').hidden", { timeout: 15000 }).catch(() => {});
      const after = await page.evaluate(() => { const b = document.getElementById('chatBox'); const r = b ? b.getBoundingClientRect() : null; const hit = r ? document.elementFromPoint(r.left + r.width / 2, r.top + 20) : null; return { js: typeof window.mpOpenChat === 'function', open: !!b && !b.hidden, reach: !!(hit && b.contains(hit)), path: location.pathname }; });
      chk(p + ' desktop: click loads the bundle and opens the chat in place', after.js && after.open && after.reach && after.path === p, after);
      chk(p + ' desktop: no page errors', errs.length === 0, errs.slice(0, 3));
      await ctx.close();
    }

    for (const p of ['/vault/', '/season/']) {
      const { ctx, page } = await fresh(390, 800, true);
      await page.goto(ORIGIN + p + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("!!document.querySelector('[data-mpbn=\"chat\"]')", { timeout: 15000 }).catch(() => {});
      const has = await page.evaluate(() => !!document.querySelector('[data-mpbn="chat"]'));
      if (has) { await page.click('[data-mpbn="chat"]'); }
      await page.waitForFunction("document.getElementById('chatBox') && !document.getElementById('chatBox').hidden", { timeout: 15000 }).catch(() => {});
      const m = await page.evaluate(() => { const b = document.getElementById('chatBox'); return { bar: !!document.querySelector('[data-mpbn="chat"]'), open: !!b && !b.hidden, path: location.pathname, inView: b ? (function () { const r = b.getBoundingClientRect(); return r.bottom <= window.innerHeight + 0.5 && r.top >= -0.5; })() : false }; });
      chk(p + ' phone: bottom-bar Chat opens the chat here, no navigation', m.bar && m.open && m.path === p, m);
      await ctx.close();
    }

    for (const p of ['/', '/rekt/', '/spot/']) {
      const { ctx, page } = await fresh(1280, 860);
      await page.goto(ORIGIN + p + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await new Promise(r => setTimeout(r, 2500));
      const v = await page.evaluate(() => ({ host: !!document.getElementById('mpChatHost'), fab: !!document.getElementById('chatFab') }));
      chk(p + ': nothing injected' + (p === '/spot/' ? ' (excluded)' : ' (ships its own chat)'), !v.host && (p === '/spot/' ? true : v.fab), v);
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
