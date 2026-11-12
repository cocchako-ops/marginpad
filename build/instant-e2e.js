/* INSTANT TOOL SWITCHING (2026-11-12, owner-approved feature #15): the lazy bundles of the OTHER tool routes are prefetched
   once the shell has gone idle (desktop: charts, heatmap, screener; phone: the phone chart engine instead of the desktop one),
   and at once on a hover/touch of a link to that tool - never on a saveData / 2g connection. With `?v=` assets immutable since
   2026-11-12, a prefetched bundle is a cache hit for a year, so a route switch waits for nothing but its data.
   Run: node build/instant-e2e.js [--local] */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io', LOCAL = process.argv.includes('--local'), ROOT = path.join(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let okN = 0, failN = 0; const chk = (n, ok, x) => { ok ? okN++ : failN++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 240) : '')); };
const CT = { js: 'text/javascript', css: 'text/css', html: 'text/html; charset=utf-8' };
function localFile(u) { const p = new URL(u).pathname; if (p.indexOf('/assets/') === 0) return path.join(ROOT, 'dist', p); if (/^\/(paper-trade|charts|heatmap|screener|calculators|swap)$/.test(p)) return path.join(ROOT, 'app', 'index.html'); return null; }
async function page(browser, w, pre) {
  const ctx = await browser.createBrowserContext(); const p = await ctx.newPage();
  await p.setViewport({ width: w, height: w < 500 ? 844 : 900, isMobile: w < 500, hasTouch: w < 500 });
  if (LOCAL) { await p.setRequestInterception(true); p.on('request', r => { const f = localFile(r.url()); if (f && fs.existsSync(f)) { const ext = f.split('.').pop(); return r.respond({ status: 200, headers: { 'content-type': CT[ext] || 'application/octet-stream', 'cache-control': 'no-store' }, body: fs.readFileSync(f) }); } r.continue(); }); }
  if (pre) await p.evaluateOnNewDocument(pre);
  const errs = []; p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  return { ctx, p, errs };
}
const links = () => [...document.querySelectorAll('link[rel="prefetch"]')].map(l => l.getAttribute('href').replace(/\?v=[a-f0-9]+/, '').split('/').pop());
(async () => {
  await withBrowser(async (browser) => {
    { // desktop, idle
      const { ctx, p, errs } = await page(browser, 1366);
      await p.goto(ORIGIN + '/paper-trade', { waitUntil: 'load', timeout: 90000 });
      const early = await p.evaluate(links);
      chk('nothing is prefetched at load (the page comes first)', early.length === 0, early);
      await sleep(11000);
      const late = await p.evaluate(links);
      chk('once idle, the desktop shell prefetches charts, heatmap and screener', late.indexOf('mp-charts.js') >= 0 && late.indexOf('mp-heatmap.js') >= 0 && late.indexOf('mp-screener.js') >= 0, late);
      chk('and not the phone chart engine', late.indexOf('mp-mcharts.js') < 0, late);
      const dup = await p.evaluate(() => document.querySelectorAll('link[rel="prefetch"][href*="mp-charts"]').length);
      chk('one prefetch per bundle', dup === 1, dup);
      chk('no page errors', errs.length === 0, errs);
      await ctx.close();
    }
    { // desktop, hover beats idle
      const { ctx, p } = await page(browser, 1366);
      await p.goto(ORIGIN + '/paper-trade', { waitUntil: 'load', timeout: 90000 });
      const hovered = await p.evaluate(() => { const a = document.querySelector('a[href="/charts"]'); if (!a) return false; a.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })); return true; }); await sleep(200);
      const after = await p.evaluate(links);
      chk('a hand moving towards a Charts link prefetches the charts bundle at once', hovered && after.indexOf('mp-charts.js') >= 0, after);
      await ctx.close();
    }
    { // phone
      const { ctx, p } = await page(browser, 390);
      await p.goto(ORIGIN + '/paper-trade', { waitUntil: 'load', timeout: 90000 }); await sleep(11000);
      const l = await p.evaluate(links);
      chk('the phone prefetches ITS chart engine (mp-mcharts), not the desktop one', l.indexOf('mp-mcharts.js') >= 0 && l.indexOf('mp-charts.js') < 0, l);
      await ctx.close();
    }
    { // a metered connection
      const { ctx, p } = await page(browser, 1366, () => { try { Object.defineProperty(navigator, 'connection', { get: function () { return { saveData: true, effectiveType: '4g' }; } }); } catch (e) {} });
      await p.goto(ORIGIN + '/paper-trade', { waitUntil: 'load', timeout: 90000 }); await sleep(10000);
      const l = await p.evaluate(links);
      chk('a saveData connection gets no prefetch at all', l.length === 0, l);
      await ctx.close();
    }
  }, { timeoutMs: 300000 });
  console.log('\ninstant-e2e: ' + okN + ' passed, ' + failN + ' failed' + (LOCAL ? ' [local]' : ''));
  process.exit(failN ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
