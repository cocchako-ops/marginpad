/* Stale-tab notice E2E (2026-09-10).
   A tab left open across a deploy keeps the bundles it loaded - nothing reloads on its own. That is how three
   rounds of fixes to the winning-ticket line stayed invisible to the owner: the code was live, his tab was not.
   mp-auth compares the version it was loaded with against the one /api/announce reports and says so ONCE.

   Locks down: the current page is NEVER told it is stale; a page whose bundle version differs IS told, once, in
   the one notification channel, with a Reload button; and nothing reloads by itself.
   Run: node build/stalever-e2e.js */
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = [];
const chk = (n, ok, x) => { out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 240) : '')); console.log(out[out.length - 1]); };

(async () => {
  const ann = await (await fetch(ORIGIN + '/api/announce?cb=' + Date.now())).json();
  chk('announce reports the version the site is serving', /^[a-f0-9]{6,}$/.test(String(ann.av || '')), { av: ann.av });
  const page1 = await (await fetch(ORIGIN + '/paper-trade?cb=' + Date.now())).text();
  const served = (page1.match(/mp-auth\.js\?v=([a-f0-9]+)/) || [])[1];
  chk('the page loads exactly that version of mp-auth', served === ann.av, { page: served, announce: ann.av });

  await withBrowser(async (browser) => {
    // 1) a page opened right now must never be told it is old
    {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      await sleep(9000);
      const r = await page.evaluate(() => ({ toast: !!document.querySelector('#mpxpT .mpxp'), txt: (document.getElementById('mpxpT') || {}).innerText || '' }));
      chk('a fresh page is not told anything', r.toast === false, r);
      chk('no page errors', errs.length === 0, errs.slice(0, 2));
      await ctx.close();
    }
    // 2) a page whose bundle is older IS told, once, with a way out
    {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      // serve announce with a DIFFERENT version, i.e. exactly what an open tab sees after a deploy
      await page.setRequestInterception(true);
      page.on('request', async (req) => {
        if (req.url().indexOf('/api/announce') > 0) { try { return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ msg: '', level: '', ts: 0, guestNudge: true, av: 'deadbeef' }) }); } catch (e) {} }
        try { req.continue(); } catch (e) {}
      });
      let reloads = 0; page.on('framenavigated', () => { reloads++; });
      await page.goto(ORIGIN + '/paper-trade?cb=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
      const before = reloads;
      await sleep(11000);
      const r = await page.evaluate(() => {
        const host = document.getElementById('mpxpT');
        const card = host ? host.querySelector('.mpxp') : null;
        const btn = card ? card.querySelector('.mpxp-act') : null;
        return { shown: !!card, n: host ? host.children.length : 0, txt: card ? card.innerText.replace(/\s+/g, ' ').slice(0, 90) : '', btn: btn ? btn.textContent.trim() : null };
      });
      chk('an out-of-date tab is told, once, in the one channel', r.shown === true && r.n === 1 && /older version/i.test(r.txt), r);
      chk('and it offers a Reload button rather than reloading by itself', r.btn === 'Reload' && reloads === before, { btn: r.btn, navigations: reloads - before });
      await page.screenshot({ path: 'D:/part1/money-mission/build/pt-shots/stalever.png' });
      await ctx.close();
    }
  }, { timeoutMs: 300000 });
  const bad = out.filter(l => l.slice(0, 4) === 'FAIL').length;
  console.log('\npass ' + (out.length - bad) + ' fail ' + bad);
  process.exit(bad ? 1 : 0);
})();
