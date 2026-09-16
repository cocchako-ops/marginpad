/* /liquidations/ rebuilt as a data page (2026-09-17, owner: "cool like the screener, almost no text, text at the bottom").

   Proven on production:
     raw HTML (what a crawler sees): title, canonical, Dataset + FAQPage + WebApplication JSON-LD, the first <h2> sits in
       the prose section BELOW the data (so the worker's SSR box lands with the prose), the SSR box is present with ?nc=1,
       hub links / exchange rail / sentry / share card survived the regeneration, prose under 600 words
     browser, desktop + phone: stat strip filled from /api/cg/liquidations (total = API total), the tape carries real
       events, at least 25 coin rows reachable at their centre, sort chips reorder (Longs wiped puts the biggest long
       figure first), search narrows, the coin sheet opens on a tap, is on screen, reachable, names the coin and
       links a paper trade of it, closes; venues painted; no horizontal scroll; no page errors

   Run: node build/liq-page-e2e.js
*/
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 240) : ''));

(async () => {
  const raw = await (await fetch(ORIGIN + '/liquidations/?nc=1&cb=' + Date.now())).text();
  const api = await (await fetch(ORIGIN + '/api/cg/liquidations', { cache: 'no-store' })).json();
  const noScript = raw.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const words = noScript.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length;
  // the page's OWN prose (the .lq-prose section) - the served page also carries the SSR box, hub links and the exchange rail
  const proseM = noScript.match(/<section class="lq-prose">([\s\S]*?)<\/section>/);
  const proseWords = proseM ? proseM[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().split(' ').length : 9999;
  chk('raw: title, canonical, Dataset + FAQPage + WebApplication JSON-LD', /<title>Crypto Liquidations Today/.test(raw) && /rel="canonical" href="https:\/\/marginpad.io\/liquidations\/"/.test(raw) && /"@type":"Dataset"/.test(raw) && /"@type":"FAQPage"/.test(raw) && /"@type":"WebApplication"/.test(raw));
  chk('raw: the data UI comes before the first h2, which lives in the prose at the bottom', raw.indexOf('id="lqList"') > 0 && raw.indexOf('<h2') > raw.indexOf('id="lqVen"') && /class="lq-prose"/.test(raw), { list: raw.indexOf('id="lqList"'), h2: raw.indexOf('<h2') });
  chk('raw: the worker SSR box is injected (crawler-visible sentences) and sits with the prose', /class="mp-live"/.test(raw) && raw.indexOf('class="mp-live"') > raw.indexOf('id="lqVen"'), { ssr: raw.indexOf('class="mp-live"') });
  chk('raw: hub links, exchange rail, sentry and the share card survived the regeneration', (raw.match(/class="hublinks"/g) || []).length >= 3 && /mp-xr-n/.test(raw) && /sentry\.js\?v=/.test(raw) && /og\/liquidations\.jpg/.test(raw) && /mp-nav\.js\?v=/.test(raw));
  chk('raw: the page\'s own prose is under 400 words and sits at the bottom; the whole served page (SSR box, hub links, rail included) under 1,100', proseWords < 400 && words < 1100, { proseWords, words });

  await withBrowser(async (browser) => {
    for (const vp of [{ w: 1366, h: 900, t: 'desktop' }, { w: 390, h: 800, t: 'phone' }]) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      await page.goto(ORIGIN + '/liquidations/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction("document.querySelectorAll('#lqList .lq-row').length>10 && document.querySelectorAll('#lqTape .lq-ev').length>3", { timeout: 30000 }).catch(() => {});
      const g = await page.evaluate(() => {
        const reach = el => { if (!el) return false; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(h && el.contains(h)); };
        const rows = [...document.querySelectorAll('#lqList .lq-row')];
        return { sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, tot: (document.getElementById('lqTot') || {}).textContent, cnt: (document.getElementById('lqCnt') || {}).textContent, big: (document.getElementById('lqBig') || {}).textContent, tape: document.querySelectorAll('#lqTape .lq-ev:not(.head)').length, tapeReal: [...document.querySelectorAll('#lqTape .lq-ev:not(.head) b')].every(b => /(LONG|SHORT)$/.test(b.textContent.trim())), rows: rows.length, r0: reach(rows[0]), r9: reach(rows[9]), ven: document.querySelectorAll('#lqVen .lq-ven').length, firstSym: rows[0] && rows[0].getAttribute('data-sym'), upd: (document.getElementById('lqUpd') || {}).textContent };
      });
      const bn = x => { const a = Math.abs(x); return a >= 1e9 ? '$' + (x / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (x / 1e6).toFixed(1) + 'M' : a >= 1e3 ? '$' + (x / 1e3).toFixed(0) + 'K' : '$' + x.toFixed(0); };
      chk(vp.t + ': stat strip filled from the API (total, positions, biggest hit), tape carries real events', g.tot === bn(api.market.total) && /\d/.test(g.cnt) && /\$/.test(g.big) && g.tape >= 4 && g.tapeReal, { tot: g.tot, api: bn(api.market.total), cnt: g.cnt, big: g.big, tape: g.tape });
      chk(vp.t + ': at least 25 coin rows, first and tenth reachable, sorted by total, venues painted, no horizontal scroll', g.rows >= 25 && g.r0 && g.r9 && g.firstSym === api.coins[0].s && g.ven >= 5 && !g.sx, { rows: g.rows, r0: g.r0, r9: g.r9, first: g.firstSym, ven: g.ven, sx: g.sx });
      const s = await page.evaluate(async () => {
        document.querySelector('#lqChips button[data-sort="long"]').click(); await new Promise(r => setTimeout(r, 200));
        const lg = [...document.querySelectorAll('#lqList .lq-row .l2 .lg')].slice(0, 5).map(x => x.textContent);
        const rows = window.__lq.rows(); const okSort = rows.length > 2 && rows[0].long >= rows[1].long && rows[1].long >= rows[2].long;
        document.querySelector('#lqChips button[data-sort="liq"]').click();
        const q = document.getElementById('lqQ'); q.value = 'BTC'; q.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
        const narrowed = [...document.querySelectorAll('#lqList .lq-row')].map(r => r.getAttribute('data-sym'));
        q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); await new Promise(r => setTimeout(r, 300));
        return { lg, okSort, narrowed, restored: document.querySelectorAll('#lqList .lq-row').length };
      });
      chk(vp.t + ': "Longs wiped" sorts by the long figure, search narrows to the coin, clearing restores', s.okSort && s.narrowed.length >= 1 && s.narrowed.every(x => /BTC/.test(x)) && s.restored >= 25, s);
      const sh = await page.evaluate(async () => {
        const row = document.querySelector('#lqList .lq-row'); const sym = row.getAttribute('data-sym'); row.click(); await new Promise(r => setTimeout(r, 400));
        const sheet = document.getElementById('lqSheet'), r = sheet.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 40);
        const res = { sym, open: !sheet.hidden, inView: r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1, reach: !!(hit && sheet.contains(hit)), title: (document.getElementById('lqShT') || {}).textContent, paper: !![...sheet.querySelectorAll('a')].find(a => a.getAttribute('href') === '/paper-trade?coin=' + encodeURIComponent(sym)), tiles: sheet.querySelectorAll('.lq-tiles .c').length, ex: sheet.querySelectorAll('.lq-ex a').length, locked: document.documentElement.style.overflow === 'hidden' };
        document.getElementById('lqShX').click(); await new Promise(r => setTimeout(r, 200));
        res.closed = sheet.hidden && document.documentElement.style.overflow === ''; return res;
      });
      chk(vp.t + ': tapping a row opens the coin sheet on screen and reachable, naming the coin, three tiles, a paper-trade link and exchange links; it closes', sh.open && sh.inView && sh.reach && sh.title.indexOf(sh.sym) === 0 && sh.paper && sh.tiles === 3 && sh.ex >= 3 && sh.locked && sh.closed, sh);
      chk(vp.t + ': no page errors', errs.length === 0, errs);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'liq-page-' + vp.t + '.png') });
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
