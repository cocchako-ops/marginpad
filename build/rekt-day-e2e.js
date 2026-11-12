/* /rekt/'s headline is TODAY and never falls (2026-11-12, owner: "vidim da se cifra smanjuje ... broj nikako ne sme da se smanjuje u toku dana").

   --pure : paintDayHero is LIFTED out of dist/rekt/index.html and driven with a stub document - a smaller day total arriving later
            must not lower the figure; a new UTC day must start it again; the split follows the total that was kept.
   browser: /rekt/ (the tree's page with --local) at 1366 and 390 - the hero total reads the day series' figure to the formatted
            dollar, the labels say today / UTC and no longer "24h" on the total and the count, the biggest-hit tile still says 24h
            (a record is a record), the By-hour chart agrees with the hero, no page errors.

   Run: node build/rekt-day-e2e.js [--pure] [--local]
*/
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const PURE = process.argv.includes('--pure'), LOCAL = process.argv.includes('--local');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0; const ok = (n, c, d) => { if (c) pass++; else fail++; console.log((c ? 'ok   ' : 'FAIL ') + n + (c ? '' : '  ' + (d === undefined ? '' : String(d).slice(0, 300)))); };
const html = fs.readFileSync(path.join(ROOT, 'dist/rekt/index.html'), 'utf8');

// ---- pure: lift paintDayHero ----
(function () {
  const a = html.indexOf('var _dh={day:0'), b = html.indexOf('function loadLiqStats()');
  ok('paintDayHero exists in the page, ahead of loadLiqStats', a > 0 && b > a);
  const src = html.slice(a, b);
  ok('loadLiqStats no longer writes the total, the count or the split', !/rkhTot|rkTot|rkhCnt|rkCnt|rkhML|rkML/.test(html.slice(b, html.indexOf('loadLiqStats();setInterval'))));
  ok('liqStatsDown no longer blanks the day figures', !/rkTot|rkhTot|rkCnt|rkhCnt/.test(html.slice(html.indexOf('function liqStatsDown'), a)));
  const els = {}; const doc = { getElementById: id => (els[id] = els[id] || { textContent: '', style: {} }) };
  const money = n => { n = +n; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return n.toFixed(0); };
  const H = (l, s, n) => { const h = []; for (let i = 0; i < 24; i++) h.push({ l: 0, s: 0, n: 0 }); h[3] = { l, s, n }; return h; };
  const run = new Function('document', 'window', 'money', 'dayH', 'dayTot', 'dayN', 'dayMid', src + '\n paintDayHero(); return { _dh: _dh, rk: window.__rkDay };');
  const w = {};
  // day 1: 10M arrives, then a SMALLER 7M on the same day, then a new day with 1M
  let r1 = run(doc, w, money, H(6e6, 4e6, 4000), 10e6, 4000, 1000);
  const t1 = els.rkhTot.textContent, c1 = els.rkhCnt.textContent, ml1 = els.rkhML.style.width;
  ok('10M on day 1 paints $10.0M, 4,000 positions, 60% longs', t1 === '$10.0M' && c1 === '4,000' && ml1 === '60%', t1 + ' ' + c1 + ' ' + ml1);
  // the lifted copy has its own _dh, so day 1 state is carried by re-running with the same closure: emulate by a second Function sharing globals
  const run2 = new Function('document', 'window', 'money', 'steps', src + '\n var out=[]; steps.forEach(function(st){ dayH=st.H; dayTot=st.tot; dayN=st.n; dayMid=st.mid; paintDayHero(); out.push({tot:document.getElementById("rkhTot").textContent, n:document.getElementById("rkhCnt").textContent, ml:document.getElementById("rkhML").style.width, mirror:window.__rkDay.tot}); }); return out;');
  const els2 = {}; const doc2 = { getElementById: id => (els2[id] = els2[id] || { textContent: '', style: {} }) };
  const out = run2(doc2, {}, money, [
    { H: H(6e6, 4e6, 4000), tot: 10e6, n: 4000, mid: 1000 },
    { H: H(3e6, 4e6, 2500), tot: 7e6, n: 2500, mid: 1000 },   // a partial / late answer, same day
    { H: H(5e6, 7e6, 5000), tot: 12e6, n: 5000, mid: 1000 },  // the day grows again
    { H: H(1e6, 0, 300), tot: 1e6, n: 300, mid: 2000 },       // midnight: a new day starts from its own figure
  ]);
  ok('a smaller total on the same day never lowers the figure (10M then 7M reads $10.0M, 4,000)', out[1].tot === '$10.0M' && out[1].n === '4,000' && out[1].mirror === 10e6, JSON.stringify(out[1]));
  ok('the split follows the total that was KEPT, not the smaller answer', out[1].ml === '60%', out[1].ml);
  ok('a larger total raises it (12M, 5,000, 42% longs)', out[2].tot === '$12.0M' && out[2].n === '5,000' && out[2].ml === '42%', JSON.stringify(out[2]));
  ok('a new UTC day starts again from its own figure ($1.0M, 300)', out[3].tot === '$1.0M' && out[3].n === '300', JSON.stringify(out[3]));
  void r1;
  // markup
  ok('the hero says "liquidated today" and the eyebrow names UTC', /liquidated today<\/small>/.test(html) && /today, UTC<\/div>/.test(html));
  ok('the count tile says today; the total/count stat slips say today, UTC', /Positions rekt · today/.test(html) && (html.match(/· today, UTC<\/span>/g) || []).length === 2);
  ok('the biggest-hit tile still says 24h (a record is a record)', /Biggest hit · 24h/.test(html));
  ok('the series fetch recomputes the UTC midnight each time (a tab open past midnight asks for the new day)', /dayMid=\(function\(\)\{var d=new Date\(\);d\.setUTCHours\(0,0,0,0\);return d\.getTime\(\);\}\)\(\); \/\/ a tab left open past midnight/.test(html));
})();
if (PURE) { console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0; }
else (async () => {
  const { withBrowser } = require('./e2e-browser');
  await withBrowser(async (browser) => {
    for (const vp of [{ w: 1366, h: 900 }, { w: 390, h: 844 }]) {
      const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
      await page.setCacheEnabled(false); await page.setViewport({ width: vp.w, height: vp.h, isMobile: vp.w < 500, hasTouch: vp.w < 500 });
      await page.setRequestInterception(true); await page.setBypassServiceWorker(true);
      page.on('request', req => { const p = new URL(req.url()).pathname; if (LOCAL && p === '/rekt/' && req.resourceType() === 'document') return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: html }); req.continue(); });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} });
      await page.goto(ORIGIN + '/rekt/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.__rkDay && window.__rkDay.tot > 0, { timeout: 45000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500));
      const g = await page.evaluate(() => {
        const money = n => { n = +n; if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'; if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return n.toFixed(0); };
        const d = window.__rkDay || null, T = id => (document.getElementById(id) || {}).textContent || '';
        const hs = T('rktHsum');
        return { d, tot: T('rkhTot'), cnt: T('rkhCnt'), want: d ? '$' + money(d.tot) : null, wantN: d ? d.n.toLocaleString('en-US') : null, eyebrow: (document.querySelector('.rkh-eyebrow') || {}).textContent, totLbl: (document.querySelector('.rkh-tot small') || {}).textContent, cntLbl: (document.querySelector('.rkh-tile .l') || {}).textContent, recLbl: T('rkhRecL'), hsum: hs, hsumTot: (hs.match(/\$([\d.]+[KMB]?)/) || [])[1] || null, hours: document.querySelectorAll('#rktHours .hc').length, ml: (document.getElementById('rkhMLl') || {}).textContent, sx: document.documentElement.scrollWidth, vw: innerWidth };
      });
      const tag = vp.w + 'px';
      ok(tag + ': the day series landed and the hero prints exactly its total and count', !!g.d && g.tot === g.want && g.cnt === g.wantN, JSON.stringify({ tot: g.tot, want: g.want, cnt: g.cnt, wantN: g.wantN }));
      ok(tag + ': the labels say today / UTC on the total and the count, 24h on the record', /today/.test(g.totLbl) && /today/.test(g.cntLbl) && /UTC/.test(g.eyebrow) && /24h/.test(g.recLbl), JSON.stringify({ totLbl: g.totLbl, cntLbl: g.cntLbl, eyebrow: g.eyebrow, recLbl: g.recLbl }));
      if (vp.w > 500) ok(tag + ': the By-hour summary and the hero quote one figure', !!g.hsumTot && g.tot === '$' + g.hsumTot, JSON.stringify({ hero: g.tot, hsum: g.hsum.slice(0, 60) }));
      ok(tag + ': the long/short split is painted from the day', /Longs rekt \d+%/.test(g.ml), g.ml);
      ok(tag + ': nothing wider than the screen, no page errors', g.sx <= g.vw && errs.length === 0, JSON.stringify({ sx: g.sx, vw: g.vw, errs }));
      await ctx.close();
    }
  }, { timeoutMs: 240000 });
  console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
