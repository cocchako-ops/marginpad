/* chart-heal-e2e (2026-10-26, owner: after an AI drawing, "zoom in and zoom out focus some part of the chart from days ago"
   and at a candle close the chart "zoomed out and sent me back, the drawing out of frame").
   MEASURED on production before the fix: with 2,000 paginated bars loaded, the 60 s re-sync heal (a closed bar that
   differs from the server) REPLACED the book with the 1,000-bar server window - the view kept its time (LWC keeps the right
   offset) but every drawing is anchored on a LOGICAL INDEX, so a line planted on bar 1995 sat 1,000 bars off the data.
   The AI's "widen the view to the furthest drawing" then framed the chart out to that index.
   This drives the REAL engine on /charts (desktop): paginate, plant a drawing, corrupt one closed bar, wait for the heal,
   and require the bar count, the drawing's candle and the view to be exactly what they were; then the two things the owner
   named - an indicator rebuild (the path a new candle takes) and a wheel zoom - must not move the bar under the cursor.
   --local serves dist/assets/mp-charts.js from the tree.                           node build/chart-heal-e2e.js [--local] */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('D:/part1/money-mission/build/e2e-browser.js');
const B = 'https://marginpad.io', LOCAL = process.argv.includes('--local');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const out = [];
const ok = (c, m, d) => { (c ? pass++ : fail++); out.push((c ? '  ok   ' : '  FAIL ') + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 300) : '')); };
const MAP = { '/assets/mp-charts.js': path.join(__dirname, '..', 'dist', 'assets', 'mp-charts.js') };
(async () => {
  // the shipped source carries the merge, never the replace
  const src = fs.readFileSync(MAP['/assets/mp-charts.js'], 'utf8');
  ok(!/if\(_mism\)\{_rm=2;w\.bars=kd;/.test(src) && /_pre\.concat\(kd\)/.test(src) && /_healShift/.test(src), 'mp-charts: the heal merges the server window into the book (no `w.bars=kd` replace) and records the index shift');
  const srcM = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-mcharts.js'), 'utf8');
  ok(!/if\(_mism\)\{_rm=2;p\.bars=kd;/.test(srcM) && /_pre\.concat\(kd\)/.test(srcM) && /padSub\(/.test(srcM), 'mp-mcharts: the same merge, and sub-pane series padded to the main index base');
  ok(/function padSub\(/.test(src) && /s\.setData\(_tc===w\.sub\?padSub\(data\):data\)/.test(src), 'mp-charts: sub-pane line series are padded with whitespace from the first candle');
  ok(/mx<=n-1\+45/.test(src), 'mp-charts: the AI view-widening never frames past 45 candles of future');
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setRequestInterception(true);
    page.on('request', req => { const u = new URL(req.url()); const m = LOCAL && u.hostname === 'marginpad.io' && MAP[u.pathname]; if (m) req.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(m) }); else req.continue(); });
    await page.setBypassServiceWorker(true); await page.setViewport({ width: 1366, height: 900 });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_charts', JSON.stringify([{ sym: 'BTC', tf: '60', inds: { ema: true, rsi: true, macd: true }, x: 80, y: 10, w: 1100, h: 700, id: 1 }])); localStorage.setItem('mp_cws_rail', 'mini'); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {} });
    await page.goto(B + '/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction("window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length > 100 && window.__mpWinsDbg[0].sub", { timeout: 60000 }).catch(() => {});
    await sleep(2000);
    const rd = () => page.evaluate(() => { const w = window.__mpWinsDbg[0]; const r = w.chart.timeScale().getVisibleLogicalRange(); const s = w.sub && w.sub.timeScale().getVisibleLogicalRange(); const n = w.bars.length; const t = i => { const b = w.bars[Math.max(0, Math.min(n - 1, Math.round(i)))]; return b ? b.time : 0; }; return { n, from: +r.from.toFixed(1), to: +r.to.toFixed(1), fromT: t(r.from), sub: s && { from: +s.from.toFixed(1), to: +s.to.toFixed(1) } }; });
    const n0 = (await rd()).n;
    ok(n0 > 100, 'the window loaded its candles', { n0 });
    // 1. paginate (scroll to the start -> loadMoreW), then back to the live edge at 60 bars, plant a line on the 5th-newest bar
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.chart.timeScale().setVisibleLogicalRange({ from: 0, to: 120 }); });
    await page.waitForFunction((n0) => window.__mpWinsDbg[0].bars.length > n0 + 100, { timeout: 30000 }, n0).catch(() => {});
    await sleep(1200);
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const n = w.bars.length; w.chart.timeScale().setVisibleLogicalRange({ from: n - 60, to: n + 6 }); const b = w.bars[n - 5]; w.dr.shapes.push({ t: 'hline', p: b.close, l: n - 5, color: '#ff00ff', w: 2 }); if (w.dr.redraw) w.dr.redraw(); window.__plantT = b.time; });
    await sleep(800); const a = await rd();
    ok(a.n > n0 + 100, 'older history was paginated in (the book is longer than the server window)', { before: n0, after: a.n });
    // 2. corrupt one CLOSED bar so the next 60 s re-sync sees a mismatch and takes the heal (setData) path
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const b = w.bars[w.bars.length - 30]; window.__origClose = b.close; window.__corrT = b.time; b.close = b.close * 1.0012; b.high = Math.max(b.high, b.close); });
    const healed = () => page.evaluate(() => { const w = window.__mpWinsDbg[0]; const x = w.bars.find(q => q.time === window.__corrT); return !!(x && Math.abs(x.close - window.__origClose) < 1e-9); });
    const t0 = Date.now(); let h = false; while (Date.now() - t0 < 85000) { await sleep(2500); if (await healed()) { h = true; break; } }
    const b = await rd();
    const plant = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const s = (w.dr.shapes || []).filter(x => x.color === '#ff00ff')[0]; const i = w.bars.findIndex(x => x.time === window.__plantT); return { shapeL: s && s.l, barIdxNow: i, drift: s && i >= 0 ? s.l - i : null }; });
    ok(h, 'the re-sync heal ran (the corrupted closed bar was restored to the server value) within 85 s', { waitedS: Math.round((Date.now() - t0) / 1000) });
    ok(b.n === a.n, 'LOAD-BEARING: the heal kept every paginated bar - the book did not shrink back to the server window', { before: a.n, after: b.n });
    ok(plant.drift === 0, 'LOAD-BEARING: the planted drawing is still on the candle it was drawn on (index drift 0)', plant);
    ok(b.from === a.from && b.fromT === a.fromT && b.to === a.to, 'the view did not move through the heal (same logical range, same first candle)', { before: a, after: b });
    // 3. an indicator rebuild (the path a new candle takes) must not move the view
    await page.evaluate(() => window.dispatchEvent(new Event('mp-auth-change'))); await sleep(1500);
    const c = await rd();
    ok(Math.abs(c.from - b.from) < 0.5 && Math.abs(c.to - b.to) < 0.5 && c.sub && Math.abs(c.sub.from - c.from) < 0.5, 'an indicator rebuild leaves the view where it was, and the sub-pane shares the same logical range', { b, c });
    // 4. a wheel zoom keeps the bar under the cursor under the cursor, in and out
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const n = w.bars.length; w.chart.timeScale().setVisibleLogicalRange({ from: n - 120, to: n + 6 }); }); await sleep(600);
    const box = await page.evaluate(() => { const r = window.__mpWinsDbg[0].el.querySelector('.cwin-chart').getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.5 }; });
    const under = () => page.evaluate((x) => { const w = window.__mpWinsDbg[0]; const r = w.el.querySelector('.cwin-chart').getBoundingClientRect(); return w.chart.timeScale().coordinateToLogical(x - r.x); }, box.x);
    const u0 = await under(); await page.mouse.move(box.x, box.y);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: -120 }); await sleep(100); } await sleep(800); const u1 = await under();
    for (let i = 0; i < 6; i++) { await page.mouse.wheel({ deltaY: 120 }); await sleep(100); } await sleep(800); const u2 = await under();
    const d = await rd();
    ok(Math.abs(u1 - u0) < 1.5 && Math.abs(u2 - u0) < 1.5 && d.to > d.n - 30, 'wheel zoom in and out keeps the bar under the cursor (no focus days back) and stays near the live edge', { u0: Math.round(u0), u1: Math.round(u1), u2: Math.round(u2), to: d.to, n: d.n });
    ok(errs.length === 0, 'no page errors', errs);
    await ctx.close();
  });
  console.log(out.join('\n')); console.log('\nchart-heal-e2e: pass ' + pass + '  fail ' + fail);
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); console.log(out.join('\n')); process.exitCode = 1; });
