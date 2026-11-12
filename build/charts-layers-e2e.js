#!/usr/bin/env node
/* THE CHART'S LAYERS SIT BESIDE EACH OTHER - E2E (2026-11-12, owner: "kad se upali vise stvari, idu jedne preko drugih ... klik na
   prozor ce da otvori alate za crtanje iako ja to nisam hteo").
   A Premium member, one /charts window with EVERY indicator on, the AI plan drawn, the drawing palette up, a What-moved-it card open:
     - a pointerdown on a card / the legend / a button never enters draw mode, whatever shape lies under it (w._drBodyPd asks WHAT was
       hit before it asks WHERE);
     - the price axis carries ONE badge per spot: no two visible axis labels within one badge height (axisGovern), and a merged badge
       names both ("R · PDH");
     - the legend shows at most six rows at rest with "+N" for the rest, and the plan box starts below it;
     - the What-moved-it pill sits left of the price axis and, with the palette up, below it;
     - a card is clamped to the plot (never into the indicator strip) and leaves with a window resize;
     - the palette's bin / undo / redo are drawn icons, no unicode arrows;
     - on the phone the palette is ONE row that does not cover the indicator strip, and the axis is governed there too.
   `--local` serves the bundles from the working tree. Cleanup: the throwaway member is removed. */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const LOCAL = process.argv.includes('--local');
const K = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-f0-9]+/)[0];
const AK = { 'x-admin-key': K, 'content-type': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 260) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DIST = path.join(__dirname, '..', 'dist', 'assets');
const LOCAL_FILES = ['home.js', 'mp-charts.js', 'mp-mcharts.js', 'mp-auth.js', 'home.css', 'mp-nav.js'];
const ALL_INDS = { sig: 1, casc: 1, brain: 1, memory: 1, magnet: 1, whaleliq: 1, catalyst: 1, ema: 1, sma: 1, vwap: 1, bb: 1, sr: 1, pp: 1, dl: 1, sess: 1, vol: 1, rsi: 1, macd: 1 };

// the pure half: the shipped sources
console.log('# pure');
{
  const mc = fs.readFileSync(path.join(DIST, 'mp-charts.js'), 'utf8'), mm = fs.readFileSync(path.join(DIST, 'mp-mcharts.js'), 'utf8'), css = fs.readFileSync(path.join(DIST, 'home.css'), 'utf8');
  const pal = mc.slice(mc.indexOf('function drawToolsHtml('), mc.indexOf('function drawToolsHtml(') + 6000);
  ok(!/[↖-⇿]/.test(pal), 'the palette carries no unicode arrows (undo/redo are drawn)');
  ok(/class="cwin-tool cwin-tool-ic cwin-del"[^>]*><svg/.test(pal), 'the delete button carries an SVG, not an empty box');
  ok(mc.indexOf('function axisGovern(') > 0 && mc.indexOf('window.__mpAxisGovern=axisGovern') > 0, 'axisGovern exists and is exported');
  ok(/var tg0=e\.target;if\(!tg0\|\|!\(tg0===cv\|\|tg0===drHost/.test(mc), 'the outside-mode listener asks WHAT was hit before WHERE');
  ok(mm.indexOf('p.w._axLines=function()') > 0, 'the phone pane hands its price lines to the governor');
  ok(/\.mfc\.drawing \.mfc-stage\{padding-bottom:calc\(60px/.test(css) && /\.mfc-pane\.drawing \.cwin-tools\{gap:4px/.test(css), 'the phone stage keeps the palette\'s room and the palette is one row');
  ok(/\.cwin-liqc\{[^}]*max-height:calc\(100% - 12px\)/.test(css), 'a card can never be taller than its plot');
}

async function prep(p, tok) {
  await p.setCacheEnabled(false);
  await p.setCookie({ name: 'mp_sess', value: tok, domain: 'marginpad.io', path: '/' }, { name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  await p.setRequestInterception(true);
  const cdp = await p.target().createCDPSession(); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  p.on('request', req => { const u = req.url(); if (LOCAL) { const m = u.match(/\/assets\/([a-z-]+\.(?:js|css))(?:\?|$)/); if (m && LOCAL_FILES.indexOf(m[1]) >= 0) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css' : 'application/javascript', body: fs.readFileSync(path.join(DIST, m[1])) }); } req.continue(); });
}
const SEED = (inds) => {
  try { localStorage.setItem('mp_charts', JSON.stringify([{ sym: 'BTC', tf: '15', inds: inds, cmp: '', x: 0, y: 0, w: 1100, h: 640, id: 'w1', emaList: [9, 21, 50], smaList: [100, 200], liqMin: 0 }])); } catch (e) {}
  try { localStorage.setItem('mp_mfc_state', JSON.stringify({ split: false, active: 0, panes: [{ sym: 'BTC', tf: '15', inds: inds, cmp: '', liqMin: 0 }] })); } catch (e) {}
  try { localStorage.setItem('mp_cws_rail', 'mini'); localStorage.setItem('mp_ck_ok', '1'); } catch (e) {}
};
// every visible axis label's y, from the window's own price lines (the governor's input), plus the live-price label
const AXIS = `(function(){var w=window.__mpWinsDbg?window.__mpWinsDbg[0]:null;if(!w)return null;var lines=(typeof w._axLines==='function')?w._axLines():[].concat(w.indLines||[],w._aiPlan||[],w.mtLines||[],w._setupLines||[]);var ys=[],titles=[],hidden=0;lines.forEach(function(l){var o=l.options();var y=w.candle.priceToCoordinate(+o.price);if(y==null)return;if(o.axisLabelVisible===false){hidden++;return;}ys.push(Math.round(y));titles.push(o.title);});ys.sort(function(a,b){return a-b;});var minGap=1e9;for(var i=1;i<ys.length;i++)minGap=Math.min(minGap,ys[i]-ys[i-1]);return {n:lines.length,visible:ys.length,hidden:hidden,minGap:minGap,merged:titles.filter(function(t){return /\\u00b7/.test(t);}),titles:titles};})()`;

(async () => {
  const uid = 'e2elay' + Date.now().toString(36);
  await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'mk', xp: 600 }) });
  await fetch(O + '/api/admin/premium?add=e2e_' + uid + '&days=1', { headers: AK }).catch(() => {});
  const se = await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'sess' }) }).then(r => r.json());
  await fetch(O + '/api/auth/xp', { method: 'POST', headers: { cookie: 'mp_sess=' + se.token, 'content-type': 'application/json' }, body: JSON.stringify({ ack: 1 }) }).catch(() => {});
  try {
    await withBrowser(async (b) => {
      console.log('# desktop 1366, one window, every indicator on');
      let p = await b.newPage(); await p.setViewport({ width: 1366, height: 768 }); await prep(p, se.token);
      const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
      await p.evaluateOnNewDocument(SEED, ALL_INDS);
      await p.goto(O + '/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForFunction("window.__mpWinsDbg&&window.__mpWinsDbg[0]&&window.__mpWinsDbg[0].bars&&window.__mpWinsDbg[0].bars.length>50&&window.__mpWinsDbg[0].indLines&&window.__mpWinsDbg[0].indLines.length>3", { timeout: 60000 });
      await sleep(3500);
      await p.evaluate(() => { ['mpPgc', 'mpCkBar'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); });
      // the axis
      let ax = await p.evaluate(AXIS);
      ok(ax && ax.n >= 8, 'the window carries many price lines (' + (ax && ax.n) + ')', ax);
      ok(ax && ax.minGap >= 13, 'no two visible axis badges sit within one badge height (min gap ' + (ax && ax.minGap) + 'px)', ax);
      ok(ax && ax.hidden > 0 && ax.merged.length > 0, 'the governor hid ' + (ax && ax.hidden) + ' badge(s) and merged names onto the survivors', ax && ax.merged);
      // the legend
      let lg = await p.evaluate(() => { const l = document.querySelector('.cwin-leg'); const body = document.querySelector('.cwin-body').getBoundingClientRect(); const r = l.getBoundingClientRect(); return { rows: l.querySelectorAll('.lg-r').length, more: (l.querySelector('[data-legmore]') || {}).textContent || '', pct: Math.round(100 * r.height / body.height), bg: getComputedStyle(l.querySelector('.lg-r')).backgroundColor }; });
      ok(lg.rows <= 6 && /^\+\d+$/.test(lg.more), 'the legend shows at most six rows at rest, the rest behind "+N" (' + lg.rows + ' rows, ' + lg.more + ')', lg);
      ok(lg.pct <= 28, 'the legend takes at most 28% of the plot (' + lg.pct + '%)', lg);
      ok(/0\.8[5-9]|0\.9/.test(lg.bg) || /rgba\(10, 13, 17, 0\.8/.test(lg.bg), 'legend rows are opaque enough to hide a canvas label beneath', lg.bg);
      // the AI plan + shapes, then the plan box must start under the legend and the pill must clear the axis
      await p.evaluate(() => { const w = window.__mpWinsDbg[0], last = w.bars[w.bars.length - 1].close, n = w.bars.length; window.__mpAi.drawPlan(w, { bias: 'long', confidence: 62, entry: last * 0.995, stop: last * 0.985, targets: [last * 1.012, last * 1.025], horizonBars: 24, leverage: 5, levels: [{ price: last * 1.03, label: 'Resistance', kind: 'resistance' }], zone: { from: last * 0.993, to: last * 0.997 } }, false); window.__mpAi.draw(w, [{ a: 'draw', shape: 'hline', p: last * 0.98, label: 'Demand' }, { a: 'draw', shape: 'zone', from: last * 1.015, to: last * 1.02, label: 'Supply' }, { a: 'draw', shape: 'trend', p1: w.bars[n - 60].low, barsAgo1: 59, p2: w.bars[n - 5].low, barsAgo2: 4, label: 'Trend' }], 'e2e'); });
      await sleep(900);
      let geo = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; const l = document.querySelector('.cwin-leg'); return { leg: { top: l.offsetTop, bottom: l.offsetTop + l.offsetHeight }, box: w._planLegBox || null, pill: w._cxNoteBox || null, W: w.dr.W, axw: w.chart.priceScale('right').width(), shapes: w.dr.shapes.length }; });
      ok(geo.shapes >= 3, 'the AI drew its shapes (' + geo.shapes + ')', geo);
      ok(geo.box && geo.box.y >= geo.leg.bottom - 1, 'the plan box starts under the legend (box y ' + (geo.box && geo.box.y) + ', legend bottom ' + geo.leg.bottom + ')', geo);
      ok(!geo.pill || geo.pill.x + geo.pill.w <= geo.W - geo.axw, 'the What-moved-it pill ends before the price axis', geo.pill);
      ax = await p.evaluate(AXIS);
      ok(ax && ax.minGap >= 13, 'with the plan lines added the axis is still one badge per spot (min gap ' + ax.minGap + 'px)', ax);
      // THE CLICK-THROUGH: a real mouse press on the legend (DOM, over the plot, with shapes under it) must not enter draw mode
      const legPt = await p.evaluate(() => { const r = document.querySelector('.cwin-leg .lg-r').getBoundingClientRect(); return { x: r.left + 20, y: r.top + r.height / 2 }; });
      await p.mouse.move(legPt.x, legPt.y); await p.mouse.down(); await p.mouse.up(); await sleep(150);
      ok(!(await p.evaluate(() => window.__mpWinsDbg[0].dr.on)), 'a click on the legend over the plot does not enter draw mode');
      // a card over a shape: open the What-moved-it card (real move when there is one, else the plan selected through a canvas tap)
      const card = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; const m = (w._cx && w._cx.moves && w._cx.moves[0]) || null; const body = w.el.querySelector('.cwin-body').getBoundingClientRect(); if (!m) return null; window.__mpSig.cxCardOpen(w, m, body.width / 2, body.height / 3); const c = w.el.querySelector('.cwin-liqc'); const r = c.getBoundingClientRect(), host = w.el.querySelector('.cwin-chart').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + 40, inPlot: r.bottom <= host.bottom + 1 && r.top >= host.top - 1, h: r.height, hostH: host.height }; });
      if (card) {
        ok(card.inPlot, 'the card is clamped to the plot, never into the indicator strip', card);
        await p.mouse.move(card.x, card.y); await p.mouse.down(); await p.mouse.up(); await sleep(150);
        ok(!(await p.evaluate(() => window.__mpWinsDbg[0].dr.on)), 'a click on the What-moved-it card does not enter draw mode');
        // the same press on the PLOT beside it, over a shape line, DOES select (the feature is kept)
        const on = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; const c = w.el.querySelector('.cwin-liqc'); if (c) c.remove(); const s = w.dr.shapes.filter(x => x.t === 'hline')[0]; if (!s) return null; const cv = w.el.querySelector('.cwin-draw').getBoundingClientRect(); const y = w.candle.priceToCoordinate(s.p); return { x: cv.left + cv.width * 0.3, y: cv.top + y }; });
        if (on) { await p.mouse.move(on.x, on.y); await p.mouse.down(); await p.mouse.up(); await sleep(200); const st = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; return { on: w.dr.on, sel: !!w.dr.sel }; }); ok(st.on && st.sel, 'a click on the shape ITSELF still selects it', st); await p.mouse.move(on.x + 200, on.y + 80); await p.mouse.down(); await p.mouse.up(); await sleep(200); }
      } else console.log('  (no What-moved-it move on this chart right now - the card legs are skipped)');
      // the palette: icons, and the pill moves under it
      await p.evaluate(() => { const w = window.__mpWinsDbg[0]; if (w.dr.on) { w.dr.on = false; w.el.classList.remove('drawing'); } document.querySelector('.cwin-draw-tg').click(); }); await sleep(500);
      const pal = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; const t = w.el.querySelector('.cwin-tools'); const r = t.getBoundingClientRect(); return { del: !!t.querySelector('.cwin-del svg'), undo: !!t.querySelector('.cwin-undo svg'), txt: t.textContent.replace(/\s/g, ''), bottom: t.offsetTop + t.offsetHeight, pill: w._cxNoteBox }; });
      ok(pal.del && pal.undo && !/[↖-⇿]/.test(pal.txt), 'the palette draws its bin and undo/redo as icons', pal.txt);
      ok(!pal.pill || pal.pill.y >= pal.bottom, 'with the palette up the What-moved-it pill moves under it', { pill: pal.pill, palBottom: pal.bottom });
      await p.evaluate(() => document.querySelector('.cwin-draw-tg').click()); await sleep(300);
      // a window resize re-fits the strip and takes a card with it
      const hz = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; const m = (w._cx && w._cx.moves && w._cx.moves[0]) || null; if (m) { const body = w.el.querySelector('.cwin-body').getBoundingClientRect(); window.__mpSig.cxCardOpen(w, m, body.width / 2, body.height / 3); } const r = w.el.getBoundingClientRect(); const hs = Array.from(w.el.querySelectorAll('.cwin-rz')).map(h => { const q = h.getBoundingClientRect(); return { k: h.getAttribute('data-rz'), x: q.left + q.width / 2, y: q.top + q.height / 2 }; }); const se = hs.filter(h => /se|s$/.test(h.k)).sort((a, b) => (b.x + b.y) - (a.x + a.y))[0]; return { l: r.left, t: r.top, se, hadCard: !!m }; });
      if (hz.se) { await p.mouse.move(hz.se.x, hz.se.y); await p.mouse.down(); await p.mouse.move(hz.l + 560, hz.t + 330, { steps: 8 }); await p.mouse.up(); await sleep(1500); }
      const small = await p.evaluate(() => { const w = window.__mpWinsDbg[0]; const body = w.el.querySelector('.cwin-body'), sub = w.el.querySelector('.cwin-sub'), host = w.el.querySelector('.cwin-chart'); return { bodyH: body.clientHeight, subH: sub ? sub.offsetHeight : 0, plotH: host.clientHeight, legRows: w.el.querySelectorAll('.cwin-leg .lg-r').length, card: !!w.el.querySelector('.cwin-liqc'), box: w._planLegBox }; });
      ok(hz.se && small.bodyH < 330 && small.subH <= Math.round(small.bodyH * 0.42) + 1, 'after a drag to a 2x2 tile the indicator strip takes at most 42% of the body (' + small.subH + ' of ' + small.bodyH + ')', small);
      ok(small.legRows <= 4, 'the small window shows at most four legend rows (' + small.legRows + ')', small);
      ok(!hz.hadCard || !small.card, 'a card open at the old size left with the resize', small);
      ok(errs.length === 0, 'no page errors on the desktop', errs);
      await p.close();

      console.log('# phone 390, the mobile chart');
      p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); await prep(p, se.token);
      const errs2 = []; p.on('pageerror', e => errs2.push(String(e.message || e)));
      await p.evaluateOnNewDocument(SEED, ALL_INDS);
      await p.goto(O + '/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
      await p.waitForFunction("document.querySelector('.mfc') && document.querySelectorAll('.mfc canvas').length > 3", { timeout: 60000 });
      await sleep(6000);
      await p.evaluate(() => { ['mpPgc', 'mpCkBar'].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); });
      const ph = await p.evaluate(() => { const d = window.__mpMfcDbg && window.__mpMfcDbg(); const pane = d && (d.panes ? d.panes[0] : d[0]); if (!pane || !pane.w) return null; const w = pane.w; const lines = w._axLines ? w._axLines() : []; const ys = []; let hidden = 0; lines.forEach(l => { const o = l.options(); const y = pane.candle.priceToCoordinate(+o.price); if (y == null) return; if (o.axisLabelVisible === false) { hidden++; return; } ys.push(Math.round(y)); }); ys.sort((a, b) => a - b); let g = 1e9; for (let i = 1; i < ys.length; i++) g = Math.min(g, ys[i] - ys[i - 1]); return { n: lines.length, hidden, minGap: g }; });
      ok(ph && ph.n >= 6, 'the phone pane carries its price lines (' + (ph && ph.n) + ')', ph);
      ok(ph && ph.minGap >= 13, 'the phone axis is governed too (min gap ' + (ph && ph.minGap) + 'px, ' + (ph && ph.hidden) + ' hidden)', ph);
      await p.evaluate(() => { document.querySelector('.mfc [data-act="draw"]').click(); }); await sleep(600);
      const pp = await p.evaluate(() => { const t = document.querySelector('.mfc-pane.drawing .cwin-tools'); if (!t) return null; const r = t.getBoundingClientRect(); const sub = document.querySelector('.mfc-sub'); const sr = sub && sub.offsetHeight ? sub.getBoundingClientRect() : null; const cards = Array.from(document.querySelectorAll('.mfc .cwin-subcard')).map(c => c.getBoundingClientRect()); const over = cards.filter(c => c.bottom > r.top && c.top < r.bottom && c.height > 0).length; return { h: Math.round(r.height), rows: Math.round(r.height / 40), subBottom: sr ? Math.round(sr.bottom) : null, palTop: Math.round(r.top), overCards: over, del: !!t.querySelector('.cwin-del svg') }; });
      ok(pp && pp.h <= 64, 'the phone palette is one row (' + (pp && pp.h) + 'px)', pp);
      ok(pp && (pp.subBottom == null || pp.subBottom <= pp.palTop + 1) && pp.overCards === 0, 'the palette covers no indicator card', pp);
      ok(pp && pp.del, 'the phone palette has the drawn bin too', pp);
      ok(errs2.length === 0, 'no page errors on the phone', errs2);
      await p.close();
    });
  } finally {
    await fetch(O + '/api/admin/e2euser', { method: 'POST', headers: AK, body: JSON.stringify({ uid, op: 'rm' }) });
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
