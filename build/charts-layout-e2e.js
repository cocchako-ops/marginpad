// charts-layout-e2e: the /charts product after the 2026-10-08 layout pass - how much of the screen is chart, where the
// tools are, whether every tool the AI draws with can be drawn by hand, on desktop and on a phone in both orientations.
//   node build/charts-layout-e2e.js            (production)
//   node build/charts-layout-e2e.js --local    (serves dist/app.html, home.css, home.js, mp-charts.js, mp-mcharts.js from the tree)
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_MOBILE, UA_DESKTOP } = require('./e2e-browser.js');
const LOCAL = process.argv.includes('--local');
const BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist'), A = path.join(DIST, 'assets');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note ? '  -> ' + String(note).slice(0, 220) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SHOTS = path.join(__dirname, 'charts-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') }).catch(() => {});
const SERVE = /^\/assets\/(home\.css|home\.js|mp-charts\.js|mp-mcharts\.js)$/;
async function prep(browser, mobile, w, h) {
  const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|403|402/.test(m.text())) errors.push(m.text()); });
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
    if (LOCAL) {
      try {
        const p = new URL(u).pathname;
        if (req.resourceType() === 'document' && /^\/charts\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
        const m = p.match(SERVE);
        if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1]), 'utf8') });
      } catch (e) {}
    }
    req.continue();
  });
  page._errors = errors;
  return page;
}
// union of every visible canvas, as a share of the viewport (overlapping canvases counted once)
const CHART_PCT = () => {
  const vw = innerWidth, vh = innerHeight, g = 4, cols = Math.ceil(vw / g), rows = Math.ceil(vh / g), bits = new Uint8Array(cols * rows);
  for (const el of document.querySelectorAll('canvas')) { const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const x0 = Math.max(0, Math.floor(r.left / g)), x1 = Math.min(cols, Math.ceil(r.right / g)), y0 = Math.max(0, Math.floor(r.top / g)), y1 = Math.min(rows, Math.ceil(r.bottom / g));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) bits[y * cols + x] = 1; }
  let on = 0; for (let i = 0; i < bits.length; i++) on += bits[i];
  return Math.round(on * g * g / (vw * vh) * 1000) / 10;
};
const REACH = (sel) => { const el = document.querySelector(sel); if (!el) return 'missing'; const r = el.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0)) return 'zero'; const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (hit && (hit === el || el.contains(hit))) ? 'ok' : ('covered by ' + (hit ? (hit.id ? '#' + hit.id : '.' + String(hit.className).split(' ')[0]) : 'nothing')); };
// a pointer gesture on the first window's drawing canvas, in canvas-relative fractions
async function gesture(page, cvSel, pts, opts) {
  const r = await page.evaluate((s) => { const c = document.querySelector(s); const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }, cvSel);
  const P = pts.map(([fx, fy]) => ({ x: Math.round(r.x + r.w * fx), y: Math.round(r.y + r.h * fy) }));
  if (opts && opts.drag) { await page.mouse.move(P[0].x, P[0].y); await page.mouse.down(); await sleep(60); for (let i = 1; i < P.length; i++) { await page.mouse.move(P[i].x, P[i].y, { steps: 4 }); await sleep(40); } await page.mouse.up(); }
  else for (const p of P) { await page.mouse.move(p.x, p.y); await sleep(50); await page.mouse.down(); await sleep(40); await page.mouse.up(); await sleep(120); }
  await sleep(150);
}
const SHAPES = () => { const w = window.__mpWinsDbg && window.__mpWinsDbg[0]; return w && w.dr ? w.dr.shapes.map(s => ({ t: s.t, l1: s.l1, l2: s.l2, p1: s.p1, p2: s.p2, l3: s.l3, p3: s.p3, p: s.p, stop: s.stop, tgts: s.tgts, off: s.off, pts: s.pts && s.pts.length, bins: s.bins && s.bins.length, by: s.by })) : null; };
const pickTool = async (page, tool) => { await page.evaluate((t) => { const w = document.querySelector('.cwin'); const tp = w.querySelector('[data-tpick]'); tp.click(); const b = w.querySelector('.cpop-it[data-tool="' + t + '"]'); b.click(); }, tool); await sleep(100); };

(async () => {
  await withBrowser(async (browser) => {
    // ---------------- DESKTOP 1366x768 ----------------
    console.log('\ndesktop 1366x768' + (LOCAL ? ' (--local)' : ''));
    let page = await prep(browser, false, 1366, 768);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(2500);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^OK$/.test((x.textContent || '').trim())); if (b) b.click(); });
    const rail0 = await page.evaluate(() => { const bar = document.querySelector('.cws-bar'), cs = document.getElementById('chartspace'); return { mini: document.body.classList.contains('cws-mini'), w: Math.round(bar.getBoundingClientRect().width), pad: parseFloat(getComputedStyle(cs).paddingLeft), tg: !!document.getElementById('cwsRailTg') }; });
    ok('the rail opens as icons (mini) by default', rail0.mini && rail0.w <= 60, JSON.stringify(rail0));
    ok('and the board is padded by exactly the rail width', Math.abs(rail0.pad - rail0.w) <= 2, JSON.stringify(rail0));
    if (rail0.w > 60) console.log('     rail diag:', JSON.stringify(await page.evaluate(() => { const b = document.querySelector('.cws-bar'), cs = getComputedStyle(b); return { width: cs.width, box: cs.boxSizing, pad: cs.paddingLeft + '/' + cs.paddingRight, rail: getComputedStyle(document.getElementById('chartspace')).getPropertyValue('--rail'), cls: document.body.className }; })));
    const icons = await page.evaluate(() => [...document.querySelectorAll('.cws-bar .cws-btn')].map(b => { const r = b.getBoundingClientRect(); return { t: b.title || '', w: Math.round(r.width), h: Math.round(r.height), vis: r.width > 0 }; }));
    ok('every rail button is a labelled icon at least 40px tall', icons.length >= 7 && icons.every(i => i.vis && i.h >= 38 && i.t.length > 2), JSON.stringify(icons.filter(i => !(i.vis && i.h >= 38 && i.t.length > 2))).slice(0, 200));
    await page.evaluate(() => { const b = [...document.querySelectorAll('.cws-tpls button')].find(x => /Top 3/.test(x.textContent)); b.click(); });
    await sleep(7000);
    await shot(page, 'desk-top3');
    const d1 = await page.evaluate(CHART_PCT);
    const wins = await page.evaluate(() => [...document.querySelectorAll('.cwin')].map(w => { const r = w.getBoundingClientRect(), hd = w.querySelector('.cwin-head').getBoundingClientRect(); return { left: Math.round(r.left), w: Math.round(r.width), hd: Math.round(hd.height) }; }));
    const railW = await page.evaluate(() => Math.round(document.querySelector('.cws-bar').getBoundingClientRect().right));
    ok('Top 3 renders three windows', wins.length === 3, JSON.stringify(wins));
    ok('no window sits under the rail', wins.every(w => w.left >= railW - 1), 'rail right=' + railW + ' ' + JSON.stringify(wins));
    ok('the window header is one row (<= 42px)', wins.every(w => w.hd <= 42), JSON.stringify(wins.map(w => w.hd)));
    if (!wins.every(w => w.hd <= 42)) console.log('     header diag:', JSON.stringify(await page.evaluate(() => { const h = document.querySelector('.cwin-head'); const cs = getComputedStyle(h); return { wrap: cs.flexWrap, cq: CSS.supports('container-type', 'inline-size'), winW: Math.round(h.parentElement.getBoundingClientRect().width), kids: [...h.children].map(k => k.className.split(' ')[0] + ':' + Math.round(k.getBoundingClientRect().width) + 'x' + Math.round(k.getBoundingClientRect().height) + '@' + Math.round(k.getBoundingClientRect().top)) }; })).slice(0, 600));
    ok('chart area >= 76% of a 1366x768 screen with three charts (was 71%)', d1 >= 76, d1 + '%');
    console.log('     measured: chart ' + d1 + '% | rail ' + railW + 'px | headers ' + wins.map(w => w.hd).join('/') + 'px');
    // rail toggle: full → windows re-tile past the wider rail
    await page.click('#cwsRailTg'); await sleep(700);
    const full = await page.evaluate(() => ({ full: !document.body.classList.contains('cws-mini') && !document.body.classList.contains('cws-side-off'), railR: Math.round(document.querySelector('.cws-bar').getBoundingClientRect().right), minLeft: Math.min(...[...document.querySelectorAll('.cwin')].map(w => Math.round(w.getBoundingClientRect().left))) }));
    ok('the toggle expands the rail to the labelled panel and the charts move out from under it', full.full && full.railR >= 200 && full.minLeft >= full.railR - 1, JSON.stringify(full));
    await page.click('#cwsRailTg'); await sleep(700);
    const back = await page.evaluate(() => ({ mini: document.body.classList.contains('cws-mini'), minLeft: Math.min(...[...document.querySelectorAll('.cwin')].map(w => Math.round(w.getBoundingClientRect().left))), railR: Math.round(document.querySelector('.cws-bar').getBoundingClientRect().right) }));
    ok('and back to icons, charts re-tiled to the narrow rail', back.mini && back.minLeft < 120 && back.minLeft >= back.railR - 1, JSON.stringify(back));
    ok('the choice is remembered', (await page.evaluate(() => localStorage.getItem('mp_cws_rail'))) === 'mini');
    // ---- the tool picker ----
    await page.evaluate(() => { const w = document.querySelector('.cwin'); w.querySelector('.cwin-draw-tg').click(); });
    await sleep(300);
    await page.evaluate(() => document.querySelector('.cwin [data-tpick]').click()); await sleep(200);
    const picker = await page.evaluate(() => { const pop = document.querySelector('.cwin .cwin-pop-tool'); const r = pop.getBoundingClientRect(); return { shown: !pop.hidden && r.height > 0, tools: [...pop.querySelectorAll('[data-tool]')].map(b => b.getAttribute('data-tool')), groups: pop.querySelectorAll('.cpop-g').length, h: Math.round(r.height), inWin: r.bottom <= document.querySelector('.cwin').getBoundingClientRect().bottom + 1 }; });
    const WANT = ['level', 'zone', 'channel', 'pattern', 'fibext', 'pitchfork', 'position', 'volprofile', 'trend', 'ray', 'hline', 'vline', 'rect', 'fib', 'measure', 'text', 'pen', 'arrow', 'alert'];
    await shot(page, 'desk-picker');
    ok('the picker opens with five named groups', picker.shown && picker.groups === 5, JSON.stringify(picker).slice(0, 200));
    ok('every tool the AI draws with is in it: ' + WANT.slice(0, 8).join(' '), WANT.every(t => picker.tools.indexOf(t) >= 0), 'missing ' + WANT.filter(t => picker.tools.indexOf(t) < 0).join(','));
    ok('and the panel stays inside the chart window', picker.inWin, 'h=' + picker.h + ' ' + JSON.stringify(await page.evaluate(() => { const p = document.querySelector('.cwin .cwin-pop-tool').getBoundingClientRect(), w = document.querySelector('.cwin').getBoundingClientRect(); return { popTop: Math.round(p.top), popBottom: Math.round(p.bottom), popLeft: Math.round(p.left), winTop: Math.round(w.top), winBottom: Math.round(w.bottom), winLeft: Math.round(w.left) }; })));
    await page.evaluate(() => document.querySelector('.cwin [data-tpick]').click());
    // ---- draw with each new tool, read the engine back ----
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.dr.shapes = []; w.dr.redraw(); });
    const CV = '.cwin canvas.cwin-draw';
    await pickTool(page, 'level'); await gesture(page, CV, [[0.3, 0.4]]);
    let sh = await page.evaluate(SHAPES);
    ok('level: one tap places a ray from that candle (hray)', sh.length === 1 && sh[0].t === 'hray' && sh[0].l1 != null && sh[0].p > 0, JSON.stringify(sh));
    ok('and the tool reverts to select afterwards', (await page.evaluate(() => window.__mpWinsDbg[0].dr.tool)) === 'select');
    await pickTool(page, 'zone'); await gesture(page, CV, [[0.35, 0.3], [0.35, 0.45]], { drag: true });
    sh = await page.evaluate(SHAPES);
    ok('zone: a vertical drag places a band from that candle to the right edge', sh.length === 2 && sh[1].t === 'zone' && sh[1].l2 == null && sh[1].p1 !== sh[1].p2, JSON.stringify(sh[1]));
    await pickTool(page, 'position'); await gesture(page, CV, [[0.5, 0.5], [0.5, 0.65], [0.5, 0.25]]);
    sh = await page.evaluate(SHAPES);
    ok('position: entry, stop, target in three taps', sh.length === 3 && sh[2].t === 'pos' && sh[2].stop > 0 && sh[2].tgts && sh[2].tgts.length === 1 && sh[2].tgts[0] > sh[2].p && sh[2].stop < sh[2].p, JSON.stringify(sh[2]));
    await pickTool(page, 'fibext'); await gesture(page, CV, [[0.2, 0.7], [0.4, 0.3], [0.55, 0.5]]);
    sh = await page.evaluate(SHAPES);
    ok('fib extension: A, B, C in three taps', sh.length === 4 && sh[3].t === 'fibx' && sh[3].l3 != null && sh[3].p3 > 0, JSON.stringify(sh[3]));
    await pickTool(page, 'pitchfork'); await gesture(page, CV, [[0.2, 0.6], [0.45, 0.25], [0.5, 0.55]]);
    sh = await page.evaluate(SHAPES);
    ok('pitchfork: three taps', sh.length === 5 && sh[4].t === 'fork' && sh[4].l3 != null, JSON.stringify(sh[4]));
    await pickTool(page, 'pattern'); await gesture(page, CV, [[0.2, 0.5], [0.3, 0.3], [0.4, 0.5], [0.5, 0.3]]);
    await page.evaluate(() => document.querySelector('.cwin [data-done]').click()); await sleep(150);
    sh = await page.evaluate(SHAPES);
    ok('pattern: four taps then Done = a four-point polyline', sh.length === 6 && sh[5].t === 'poly' && sh[5].pts === 4, JSON.stringify(sh[5]));
    ok('Done hides again once the tool is back on select', await page.evaluate(() => document.querySelector('.cwin [data-done]').hidden));
    await pickTool(page, 'channel'); await gesture(page, CV, [[0.2, 0.6], [0.6, 0.4]], { drag: true }); await gesture(page, CV, [[0.4, 0.3]]);
    sh = await page.evaluate(SHAPES);
    ok('channel: drag the base line, tap the width', sh.length === 7 && sh[6].t === 'channel' && Math.abs(sh[6].off) > 0, JSON.stringify(sh[6]));
    await pickTool(page, 'volprofile'); await gesture(page, CV, [[0.3, 0.5], [0.7, 0.5]], { drag: true });
    sh = await page.evaluate(SHAPES);
    ok('volume profile: drag a range of candles = 24 bins with a point of control', sh.length === 8 && sh[7] && sh[7].t === 'vp' && sh[7].bins === 24, JSON.stringify(sh[7] || sh).slice(0, 160));
    await shot(page, 'desk-drawn');
    // persistence round trip: every new field survives save + reload
    const rt = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const before = JSON.stringify(w.dr.shapes.map(s => [s.t, s.pts && s.pts.length, s.bins && s.bins.length, s.l3 != null, s.off])); w.dr.save(); w.dr.shapes = []; w.dr.reload(); return { before, after: JSON.stringify(w.dr.shapes.map(s => [s.t, s.pts && s.pts.length, s.bins && s.bins.length, s.l3 != null, s.off])), n: w.dr.shapes.length }; });
    ok('all eight survive a save + reload with their third point, width and bins', rt.n === 8 && rt.before === rt.after, rt.before + ' vs ' + rt.after);
    // selection: a click on the zone selects it (the reader's composite shapes are hittable, the AI's are not)
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w._drSetTool('select'); w.dr.shapes = w.dr.shapes.filter(s => s.t === 'zone' || s.t === 'hray'); w.dr.redraw(); });/* the channel's band covers the zone - hit-testing walks newest first, so isolate the zone */
    const zoneHit = await page.evaluate(async () => { const w = window.__mpWinsDbg[0]; const z = w.dr.shapes.find(s => s.t === 'zone'); const cv = document.querySelector('.cwin canvas.cwin-draw'); const r = cv.getBoundingClientRect(); const y = w.candle.priceToCoordinate((z.p1 + z.p2) / 2); const x = r.width * 0.6; const ev = (t) => cv.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 1, button: 0 })); ev('pointerdown'); ev('pointerup'); return w.dr.sel && w.dr.sel.t; });
    ok('clicking inside a hand-drawn zone selects it', zoneHit === 'zone', String(zoneHit));
    await page.keyboard.press('Delete'); await sleep(100);
    ok('and Delete removes it', (await page.evaluate(() => window.__mpWinsDbg[0].dr.shapes.length)) === 1);
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.dr.shapes = []; w.dr.save(); });
    ok('no page errors on desktop', page._errors.length === 0, page._errors.join(' | '));
    await page.close();

    // ---------------- PHONE portrait 390x844 ----------------
    console.log('\nphone portrait 390x844');
    page = await prep(browser, true, 390, 844);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    // THE OWNER'S PHOTOS (2026-10-08): the desktop template picker and the old single-chart fallback each painted for a frame
    // before the full-screen layer covered them. At DOMContentLoaded nothing of the shell may be visible - only black.
    const early = await page.evaluate(() => { const vis = (sel) => { const el = document.querySelector(sel); if (!el) return 'absent'; return getComputedStyle(el).visibility; }; return { route: document.documentElement.classList.contains('route-charts'), header: vis('body>header'), wrap: vis('body>.wrap'), cs: vis('#chartspace'), bg: getComputedStyle(document.body).backgroundColor }; });
    ok('phone /charts paints nothing of the shell before the layer is up (black, no template picker, no fallback)', early.route && early.header !== 'visible' && early.wrap !== 'visible' && early.cs !== 'visible', JSON.stringify(early));
    await page.waitForFunction(() => document.querySelector('.mfc') && !document.querySelector('.mfc').hidden && document.querySelector('.mfc-pane canvas'), { timeout: 40000 });
    await sleep(3500);
    const layerVis = await page.evaluate(() => getComputedStyle(document.querySelector('.mfc')).visibility);
    ok('and the charts layer itself is visible', layerVis === 'visible', layerVis);
    const m1 = await page.evaluate(() => { const bar = document.querySelector('.mfc-bar'), dock = document.querySelector('.mfc-dock'), dr = dock.getBoundingClientRect(); return { barOverflow: bar.scrollWidth - bar.clientWidth, barH: Math.round(bar.getBoundingClientRect().height), dockShown: dr.height > 0 && dr.bottom <= innerHeight + 1, dockH: Math.round(dr.height), dockN: dock.querySelectorAll('.mfc-b').length, dockBtns: [...dock.querySelectorAll('.mfc-b')].map(b => Math.round(b.getBoundingClientRect().height)), topActs: [...bar.querySelectorAll('.mfc-b')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getAttribute('data-act')), sx: document.documentElement.scrollWidth - innerWidth, pct: 0 }; });
    await shot(page, 'phone-portrait');
    m1.pct = await page.evaluate(CHART_PCT);
    ok('the top bar holds identity only and nothing scrolls off it', m1.barOverflow <= 1 && JSON.stringify(m1.topActs) === JSON.stringify(['close', 'sym', 'tf', 'ai']), JSON.stringify(m1.topActs) + ' overflow=' + m1.barOverflow);
    ok('the six actions sit in a bottom dock, every one at least 44px tall', m1.dockShown && m1.dockN === 6 && m1.dockBtns.every(h => h >= 44), JSON.stringify(m1.dockBtns));
    const reach = await page.evaluate(() => ['[data-act="ind"]', '[data-act="draw"]', '[data-act="split"]', '[data-act="trades"]', '[data-act="calc"]', '[data-act="trade"]'].map(s => { const el = document.querySelector('.mfc-dock ' + s); const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return (hit && (hit === el || el.contains(hit))) ? 'ok' : s; }));
    ok('and each dock button is reachable at its centre', reach.every(r => r === 'ok'), reach.join(','));
    ok('chart area >= 84% of the portrait screen (was 91% with margins counted, the frame is gone)', m1.pct >= 84, m1.pct + '%');
    ok('the page never scrolls sideways', m1.sx <= 0, 'sx=' + m1.sx);
    const edge = await page.evaluate(() => { const p = document.querySelector('.mfc-pane').getBoundingClientRect(); return { l: Math.round(p.left), r: Math.round(innerWidth - p.right) }; });
    ok('the pane runs edge to edge', edge.l === 0 && edge.r === 0, JSON.stringify(edge));
    console.log('     measured: chart ' + m1.pct + '% | top bar ' + m1.barH + 'px | dock ' + m1.dockH + 'px');
    // timeframe row
    await page.tap('.mfc-bar [data-act="tf"]'); await sleep(300);
    const tfr = await page.evaluate(() => { const r = document.getElementById('mfcTfRow'); return { shown: !r.hidden && r.getBoundingClientRect().height > 0, n: r.querySelectorAll('[data-tfpick]').length, hs: [...r.querySelectorAll('[data-tfpick]')].map(b => Math.round(b.getBoundingClientRect().height)) }; });
    ok('tapping the timeframe opens a chip row under the bar, six chips >= 36px', tfr.shown && tfr.n === 6 && tfr.hs.every(h => h >= 36), JSON.stringify(tfr));
    await page.tap('#mfcTfRow [data-tfpick="240"]'); await sleep(1500);
    const tfAfter = await page.evaluate(() => ({ tf: window.__mfcPanes()[0].tf, hidden: document.getElementById('mfcTfRow').hidden, label: document.querySelector('.mfc-tfL').textContent }));
    ok('a chip switches the pane to 4h and the row closes', tfAfter.tf === '240' && tfAfter.hidden && /4h/i.test(tfAfter.label), JSON.stringify(tfAfter));
    await sleep(2500);
    // draw mode from the dock
    await page.tap('.mfc-dock [data-act="draw"]'); await sleep(400);
    const dm = await page.evaluate(() => { const ov = document.querySelector('.mfc'), dock = document.querySelector('.mfc-dock'), tools = document.querySelector('.mfc-pane.drawing .cwin-tools'); if (!tools) return { tools: false }; const r = tools.getBoundingClientRect(); const tp = tools.querySelector('[data-tpick]'); const tr = tp.getBoundingClientRect(); const hit = document.elementFromPoint(tr.left + tr.width / 2, tr.top + tr.height / 2); return { tools: true, drawing: ov.classList.contains('drawing'), dockHidden: dock.getBoundingClientRect().height === 0, bottom: Math.round(innerHeight - r.bottom), h: Math.round(r.height), reach: !!(hit && (hit === tp || tp.contains(hit))), exit: !!tools.querySelector('[data-drawx]') }; });
    ok('Draw swaps the dock for the palette, pinned to the bottom edge', dm.tools && dm.drawing && dm.dockHidden && dm.bottom <= 1, JSON.stringify(dm));
    ok('the tool picker chip is reachable and the palette carries its own exit', dm.reach && dm.exit, JSON.stringify(dm));
    await page.tap('.mfc-pane.drawing [data-tpick]'); await sleep(300);
    const mp = await page.evaluate(() => { const pop = document.querySelector('.mfc-pane.drawing .cwin-pop-tool'); const r = pop.getBoundingClientRect(); const rows = [...pop.querySelectorAll('.cpop-it')].map(b => Math.round(b.getBoundingClientRect().height)); return { shown: !pop.hidden && r.height > 0, bottom: Math.round(innerHeight - r.bottom), n: rows.length, minH: Math.min(...rows), maxH: Math.round(r.height) }; });
    await shot(page, 'phone-picker');
    ok('on a phone the tool list is a bottom sheet of thumb-sized rows', mp.shown && mp.bottom <= 1 && mp.n >= 18 && mp.minH >= 40 && mp.maxH <= innerHeightOf(844) * 0.7, JSON.stringify(mp));
    await page.tap('.mfc-pane.drawing .cpop-it[data-tool="level"]'); await sleep(200);
    const cvr = await page.evaluate(() => { const c = document.querySelector('.mfc-pane.drawing canvas.cwin-draw').getBoundingClientRect(); return { x: c.left + c.width * 0.4, y: c.top + c.height * 0.4 }; });
    await page.touchscreen.tap(cvr.x, cvr.y); await sleep(300);
    const msh = await page.evaluate(() => window.__mfcPanes()[0].w.dr.shapes.map(s => s.t));
    ok('a tap on the chart places a level (hray) on the phone', msh.length === 1 && msh[0] === 'hray', JSON.stringify(msh));
    await page.tap('.mfc-pane.drawing [data-drawx]'); await sleep(300);
    const ex = await page.evaluate(() => ({ drawing: document.querySelector('.mfc').classList.contains('drawing'), dock: document.querySelector('.mfc-dock').getBoundingClientRect().height > 0 }));
    ok('the palette exit leaves draw mode and brings the dock back', !ex.drawing && ex.dock, JSON.stringify(ex));
    await page.evaluate(() => { const p = window.__mfcPanes()[0]; p.w.dr.shapes = []; p.w.dr.save && p.w.dr.save(); });
    ok('no page errors on the phone', page._errors.length === 0, page._errors.join(' | '));
    await page.close();

    // ---------------- PHONE landscape 844x390 ----------------
    console.log('\nphone landscape 844x390');
    page = await prep(browser, true, 844, 390);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction(() => document.querySelector('.mfc') && !document.querySelector('.mfc').hidden && document.querySelector('.mfc-pane canvas'), { timeout: 40000 });
    await sleep(3000);
    const l1 = await page.evaluate(() => { const bar = document.querySelector('.mfc-bar'), dock = document.querySelector('.mfc-dock'); return { barOverflow: bar.scrollWidth - bar.clientWidth, dockH: Math.round(dock.getBoundingClientRect().height), acts: [...bar.querySelectorAll('.mfc-b')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.getAttribute('data-act')), sx: document.documentElement.scrollWidth - innerWidth, barH: Math.round(bar.getBoundingClientRect().height) }; });
    await shot(page, 'phone-landscape');
    l1.pct = await page.evaluate(CHART_PCT);
    ok('landscape: the dock is gone and all ten actions fit in the top row as icons', l1.dockH === 0 && l1.acts.length === 10 && l1.barOverflow <= 1, JSON.stringify(l1));
    ok('chart area >= 82% of a landscape phone', l1.pct >= 82, l1.pct + '%');
    ok('no sideways scroll', l1.sx <= 0, 'sx=' + l1.sx);
    console.log('     measured: chart ' + l1.pct + '% | top bar ' + l1.barH + 'px');
    ok('no page errors in landscape', page._errors.length === 0, page._errors.join(' | '));
    await page.close();
  }, { timeoutMs: 235000 });
  console.log('\ncharts-layout-e2e' + (LOCAL ? ' (--local)' : '') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
function innerHeightOf(h) { return h; }
