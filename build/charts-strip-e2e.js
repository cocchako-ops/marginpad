// charts-strip-e2e: the indicator strip after the 2026-10-08 round five - shaded zones and the MACD histogram are real series in
// the strip, a tap on a card opens the indicator's explanation (desktop popover / phone sheet) with a working "Remove from chart",
// and the chart style (candles / hollow / Heikin Ashi / bars / line / area) switches on both surfaces and survives a reload.
//   node build/charts-strip-e2e.js            (production)
//   node build/charts-strip-e2e.js --local    (serves dist/app.html, home.css, home.js, mp-charts.js, mp-mcharts.js from the tree)
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_MOBILE, UA_DESKTOP } = require('./e2e-browser.js');
const LOCAL = process.argv.includes('--local');
const BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist'), A = path.join(DIST, 'assets');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note ? '  -> ' + String(note).slice(0, 240) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SHOTS = path.join(__dirname, 'charts-shots'); fs.mkdirSync(SHOTS, { recursive: true });
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, n + '.png') }).catch(() => {});
const SERVE = /^\/assets\/(home\.css|home\.js|mp-charts\.js|mp-mcharts\.js)$/;
async function prep(browser, mobile, w, h) {
  const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|403|402|Ignored attempt to cancel a touchmove/.test(m.text())) errors.push(m.text());/* the touchmove line is Chrome's intervention notice while a native scroll is in flight, not a script error */ });
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
const W0 = () => { const w = window.__mpWinsDbg && window.__mpWinsDbg[0]; return w || null; };
async function deskInd(page, k, on) {
  await page.evaluate((k, on) => { const w = document.querySelector('.cwin'); const b = w.querySelector('.cwin-ind-btn'); b.click(); const it = document.querySelector('.cwin-ind-menu .cwin-ind-item[data-ind="' + k + '"]'); const isOn = it.classList.contains('on'); if (isOn !== on) it.click(); b.click(); }, k, on);
  await sleep(500);
}

(async () => {
  await withBrowser(async (browser) => {
    console.log('\ndesktop 1366x768' + (LOCAL ? ' (--local)' : ''));
    let page = await prep(browser, false, 1366, 768);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(2500);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^OK$/.test((x.textContent || '').trim())); if (b) b.click(); });
    await page.evaluate(() => { const b = [...document.querySelectorAll('.cws-tpls button')].find(x => /Top 3|Single|BTC/.test(x.textContent)); if (b) b.click(); });
    await sleep(6000);
    await page.evaluate(() => { try { localStorage.setItem('mp:leghide', '0'); } catch (e) {} });
    for (const k of ['rsi', 'macd', 'stoch', 'wr', 'cci', 'vol']) await deskInd(page, k, true);
    await sleep(800);
    const d1 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const cards = [...document.querySelectorAll('.cwin .cwin-subleg .cwin-subcard[data-ix]')].map(c => c.getAttribute('data-ix')); const sub = document.querySelector('.cwin .cwin-sub'); const r = sub && sub.getBoundingClientRect(); const dc = document.querySelector('.cwin .cwin-draw'); const dr = dc && dc.getBoundingClientRect(); return { sub: !!w.sub, n: (w.subSeries || []).length, cards, subH: r ? Math.round(r.height) : 0, drawBottom: dr ? Math.round(dr.bottom) : 0, subTop: r ? Math.round(r.top) : 0 }; });
    await shot(page, 'strip-desk');
    // rsi 2 zones + 3 lines, macd hist + 3, stoch 2 zones + 4, wr 2 + 3, cci 2 + 4, vol 1 = 26 series in the strip
    ok('six bands draw their zones and histogram as real series in the strip (>= 24 series)', d1.sub && d1.n >= 24, JSON.stringify(d1));
    ok('every band carries a tappable card', d1.cards.length === 6 && ['rsi', 'macd', 'stoch', 'wr', 'cci', 'vol'].every(k => d1.cards.indexOf(k) >= 0), JSON.stringify(d1.cards));
    ok('the drawing canvas still stops where the strip starts', Math.abs(d1.drawBottom - d1.subTop) <= 2, JSON.stringify(d1));
    const mh = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return (w.subSeries || []).some(s => { try { return s.seriesType() === 'Histogram' && s.options().priceScaleId === 'macd'; } catch (e) { return false; } }); });
    ok('MACD has a histogram series on its own scale', mh);
    const zn = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return (w.subSeries || []).filter(s => { try { return s.seriesType() === 'Baseline'; } catch (e) { return false; } }).length; });
    ok('the overbought / oversold zones are baseline fills (>= 8)', zn >= 8, 'baselines=' + zn);
    // tap the RSI card
    await page.click('.cwin .cwin-subleg .cwin-subcard[data-ix="rsi"]');
    await sleep(300);
    const ex = await page.evaluate(() => { const e = document.getElementById('mpIndX'); if (!e || e.hidden) return { open: false }; const r = e.getBoundingClientRect(); return { open: true, title: (e.querySelector('.ix-h b') || {}).textContent, rows: e.querySelectorAll('.ix-r').length, now: (e.querySelector('.ix-now') || {}).textContent || '', inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, rm: !!e.querySelector('[data-act="rm"]'), sheet: e.classList.contains('sheet') }; });
    await shot(page, 'strip-desk-explain');
    ok('tapping the RSI card opens its explanation inside the viewport', ex.open && ex.inside && !ex.sheet, JSON.stringify(ex));
    ok('the explanation has the four rows and the card\'s current reading on top', ex.rows === 4 && /RSI/.test(ex.title || '') && ex.now.length > 2, JSON.stringify(ex));
    await page.click('#mpIndX [data-act="rm"]');
    await sleep(600);
    const rm = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return { rsi: !!w.inds.rsi, cards: document.querySelectorAll('.cwin .cwin-subleg .cwin-subcard[data-ix]').length, hidden: document.getElementById('mpIndX').hidden }; });
    ok('"Remove from chart" switches the indicator off and the strip loses that band', !rm.rsi && rm.cards === 5 && rm.hidden, JSON.stringify(rm));
    // chart styles from the indicator menu
    const setStyle = async (s) => { await page.evaluate((s) => { const w = document.querySelector('.cwin'); const b = w.querySelector('.cwin-ind-btn'); b.click(); document.querySelector('.cwin-ind-menu [data-chstyle="' + s + '"]').click(); b.click(); }, s); await sleep(500); };
    const styleState = () => page.evaluate(() => { const w = window.__mpWinsDbg[0]; const o = w.candle.options(); const raw = w._raw || [], ha = w._ha || []; const n = raw.length; return { style: w._style || 'candles', up: o.upColor, border: o.borderVisible, shadow: w._styleS ? w._styleS.seriesType() : null, rawN: n, haDiff: n > 2 ? Math.abs(ha[n - 1].open - raw[n - 1].open) : 0, stored: localStorage.getItem('mp_ch_style') }; });
    const chips = await page.evaluate(() => { document.querySelector('.cwin .cwin-ind-btn').click(); const n = document.querySelectorAll('.cwin-ind-menu [data-chstyle]').length; document.querySelector('.cwin .cwin-ind-btn').click(); return n; });
    ok('the indicator menu offers six chart styles', chips === 6, 'chips=' + chips);
    await setStyle('line'); let st = await styleState();
    ok('Line: the candlestick goes transparent and a line series shadows the same bars', st.style === 'line' && st.shadow === 'Line' && /rgba\(0, ?0, ?0, ?0\)/.test(st.up) && st.stored === 'line', JSON.stringify(st));
    await setStyle('heikin'); st = await styleState();
    ok('Heikin Ashi: no shadow series, the fed bars differ from the raw bars', st.style === 'heikin' && !st.shadow && st.haDiff > 0 && st.up !== 'rgba(0, 0, 0, 0)', JSON.stringify(st));
    await setStyle('hollow'); st = await styleState();
    ok('Hollow: borders on, up body transparent', st.style === 'hollow' && st.border === true && /rgba\(0, ?0, ?0, ?0\)/.test(st.up), JSON.stringify(st));
    await setStyle('bars'); st = await styleState();
    ok('Bars: a bar series shadows the bars', st.shadow === 'Bar', JSON.stringify(st));
    await shot(page, 'strip-desk-bars');
    // a live update must reach the shadow series too
    const upd = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const last = w._raw[w._raw.length - 1]; const probe = Object.assign({}, last, { close: last.close * 1.001, high: Math.max(last.high, last.close * 1.001) }); w.candle.update(probe); const d = w._styleS && w._styleS.dataByIndex ? null : null; return { raw: w._raw[w._raw.length - 1].close === probe.close, ha: w._ha.length === w._raw.length }; });
    ok('an update through the wrapped series keeps the raw and the converted books in step', upd.raw && upd.ha, JSON.stringify(upd));
    await page.reload({ waitUntil: 'networkidle2', timeout: 90000 }); await sleep(6000);
    st = await styleState();
    ok('the chosen style survives a reload', st.style === 'bars' && st.shadow === 'Bar', JSON.stringify(st));
    await setStyle('candles'); st = await styleState();
    ok('back to candles: filled bodies, no shadow', st.style === 'candles' && !st.shadow && st.up === '#10b981', JSON.stringify(st));
    // round seven: the card never covers the plot; many bands = a strip that scrolls
    for (const k of ['rsi', 'atr', 'stoch', 'cci']) await deskInd(page, k, true);
    await sleep(900);
    const g7 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const sh = document.querySelector('.cwin .cwin-sub'), sc = sh.querySelector('.cwin-subsc'), inn = sh.querySelector('.cwin-subin'); const ir = inn.getBoundingClientRect(); const cards = [...inn.querySelectorAll('.cwin-subcard[data-ix]')]; const bands = cards.map(c => { const k = c.getAttribute('data-ix'); const r = c.getBoundingClientRect(); const s = (w.subSeries || []).find(x => { try { return x.seriesType() === 'Line' && x.options().priceScaleId === k; } catch (e) { return false; } }); const hi = k === 'rsi' || k === 'stoch' ? 100 : k === 'wr' ? 0 : null; let topY = null; if (s && hi != null) { const y = s.priceToCoordinate(hi); if (y != null) topY = Math.round(ir.top + y); } return { k, cardBottom: Math.round(r.bottom), plotTop: topY }; }); return { n: cards.length, visH: Math.round(sh.getBoundingClientRect().height), innerH: Math.round(ir.height), scrollable: sc.scrollHeight > sc.clientHeight + 2, scrollTop0: sc.scrollTop, bands }; });
    ok('seven bands: the inner strip is at least 92px a band and taller than the visible strip, so it scrolls', g7.n >= 7 && g7.innerH >= g7.n * 92 - 2 && g7.innerH > g7.visH && g7.scrollable, JSON.stringify({ n: g7.n, visH: g7.visH, innerH: g7.innerH, scrollable: g7.scrollable }));
    const covered = g7.bands.filter(b => b.plotTop != null && b.plotTop < b.cardBottom - 1);
    ok('the top of every bounded plot (RSI 100, Stoch 100) sits BELOW its card - the card never covers a peak', g7.bands.some(b => b.plotTop != null) && covered.length === 0, JSON.stringify(g7.bands));
    await page.evaluate(() => { const sc = document.querySelector('.cwin .cwin-subsc'); const r = sc.getBoundingClientRect(); window.__scPt = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const pt = await page.evaluate(() => window.__scPt);
    await page.mouse.move(pt.x, pt.y); await page.mouse.wheel({ deltaY: 400 }); await sleep(400);
    const w7 = await page.evaluate(() => { const sc = document.querySelector('.cwin .cwin-subsc'); const last = [...sc.querySelectorAll('.cwin-subcard[data-ix]')].pop(); const r = last.getBoundingClientRect(); const sr = sc.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 20, r.top + r.height / 2); const vr = window.__mpWinsDbg[0].chart.timeScale().getVisibleLogicalRange(); return { scrollTop: sc.scrollTop, lastInView: r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1, lastReach: !!(hit && (hit === last || last.contains(hit))), lastKey: last.getAttribute('data-ix'), to: vr && Math.round(vr.to) }; });
    ok('the wheel scrolls the strip (not the time axis) and the last band becomes visible and tappable', w7.scrollTop > 100 && w7.lastInView && w7.lastReach, JSON.stringify(w7));
    await shot(page, 'strip-desk-scrolled');
    // round eight: a hand-sized strip stays that size through applyInds (owner: it reset to half the window on every change)
    const hs = await page.evaluate(async () => { const w = window.__mpWinsDbg[0]; const sh = document.querySelector('.cwin .cwin-sub'); const rz = sh.querySelector('.cwin-subrz'); const r0 = rz.getBoundingClientRect(); const body = document.querySelector('.cwin .cwin-body').getBoundingClientRect(); const fire = (t, y) => rz.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: r0.left + 40, clientY: y, pointerId: 1 })); fire('pointerdown', r0.top + 4); fire('pointermove', body.bottom - 70); fire('pointerup', body.bottom - 70); await new Promise(r => setTimeout(r, 400)); const h1 = Math.round(sh.getBoundingClientRect().height); const b = document.querySelector('.cwin .cwin-ind-btn'); b.click(); document.querySelector('.cwin-ind-menu .cwin-ind-item[data-ind="vol"]').click(); b.click(); await new Promise(r => setTimeout(r, 500)); const h2 = Math.round(sh.getBoundingClientRect().height); const sc = sh.querySelector('.cwin-subsc'); return { h1, h2, bands: w._subN, scrollable: sc.scrollHeight > sc.clientHeight + 2, saved: localStorage.getItem('mp:subh') }; });
    ok('dragging the strip down stops at one band (92px) and holds through the next indicator change (no reset to half the window), the bands scroll inside it', hs.h1 >= 92 && hs.h1 <= 100 && hs.h2 === hs.h1 && hs.bands >= 6 && hs.scrollable, JSON.stringify(hs));
    await page.evaluate(() => { try { localStorage.setItem('mp:subh', '200'); } catch (e) {} });
    for (const k of ['rsi', 'atr', 'stoch', 'cci']) await deskInd(page, k, false);
    // daily levels + price scale + bar replay
    await deskInd(page, 'dl', true);
    const dl = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const t = (w.indLines || []).map(l => { try { return l.options().title; } catch (e) { return ''; } }); return { titles: t, tf: w.tf }; });
    ok('Daily levels draws PDH / PDL / PDC / OPEN as price lines on an intraday chart', ['PDH', 'PDL', 'PDC', 'OPEN'].every(k => dl.titles.indexOf(k) >= 0), JSON.stringify(dl));
    await deskInd(page, 'dl', false);
    const sc8 = await page.evaluate(async () => { const w = window.__mpWinsDbg[0]; const b = document.querySelector('.cwin .cwin-ind-btn'); b.click(); const n = document.querySelectorAll('.cwin-ind-menu [data-chscale]').length; document.querySelector('.cwin-ind-menu [data-chscale="log"]').click(); b.click(); await new Promise(r => setTimeout(r, 300)); const mode = w.chart.priceScale('right').options().mode; b.click(); document.querySelector('.cwin-ind-menu [data-chscale="lin"]').click(); b.click(); return { n, mode, stored: localStorage.getItem('mp_ch_scale') }; });
    ok('Price scale: three modes in the menu, Log switches the right scale to mode 1', sc8.n === 3 && sc8.mode === 1, JSON.stringify(sc8));
    const glyphs = await page.evaluate(() => { const b = document.querySelector('.cwin .cwin-ind-btn'); b.click(); document.querySelector('.cwin-ind-menu [data-replay]').click(); const ui = document.querySelector('.cwin .cwin-replay'); const txt = [...ui.querySelectorAll('button')].map(x => x.textContent.trim()).join(''); const svgs = ui.querySelectorAll('button svg').length; ui.querySelector('[data-rp="x"]').click(); return { txt, svgs }; });
    ok('replay buttons are SVG icons, not glyphs (no non-ASCII text in any button)', glyphs.svgs >= 6 && !/[^\x00-\x7F]/.test(glyphs.txt), JSON.stringify(glyphs));
    const rp = await page.evaluate(async () => { const w = window.__mpWinsDbg[0]; const n0 = w.bars.length; const b = document.querySelector('.cwin .cwin-ind-btn'); b.click(); document.querySelector('.cwin-ind-menu [data-replay]').click(); await new Promise(r => setTimeout(r, 500)); const ui = document.querySelector('.cwin .cwin-replay'); if (!ui) return { ui: false }; const r = ui.getBoundingClientRect(); const i0 = w._rp.i, n1 = w.bars.length, lastClose0 = w.lastBar.close; document.dispatchEvent(new CustomEvent('mp:price', { detail: { sym: w.sym, price: lastClose0 * 1.05 } })); await new Promise(r => setTimeout(r, 400)); const tickHeld = w.lastBar.close === lastClose0 && w.bars.length === i0; ui.querySelector('[data-rp="1"]').click(); await new Promise(r => setTimeout(r, 200)); const i1 = w._rp.i, n2 = w.bars.length; ui.querySelector('[data-rp="play"]').click(); await new Promise(r => setTimeout(r, 1900)); const i2 = w._rp.i, playing = w._rp.playing; ui.querySelector('[data-rp="x"]').click(); await new Promise(r => setTimeout(r, 400)); return { ui: true, inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, n0, i0, n1, tickHeld, i1, n2, i2, playing, exited: !w._rp, n3: w.bars.length, cls: document.querySelector('.cwin').classList.contains('replaying') }; });
    ok('Bar replay: the book is cut at the start point, a live tick is held off, step +1 adds one candle, play advances, exit restores the full history', rp.ui && rp.inside && rp.n1 === rp.i0 && rp.n1 < rp.n0 && rp.tickHeld && rp.i1 === rp.i0 + 1 && rp.n2 === rp.i1 && rp.i2 > rp.i1 && rp.playing && rp.exited && rp.n3 >= rp.n0 - 1 && !rp.cls /* exit re-syncs from klines, which may drop the forming bar the live feed had appended */, JSON.stringify(rp));
    // round six: sessions, compare, share, back to live
    await deskInd(page, 'sess', true);
    const ss = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const cv = document.querySelector('.cwin canvas.cwin-draw'); const ctx = cv.getContext('2d'); const y = Math.round(cv.height * 0.5); const d = ctx.getImageData(0, y, cv.width, 1).data; let lit = 0; const tones = new Set(); for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { lit++; tones.add(d[i - 3] + ',' + d[i - 2] + ',' + d[i - 1]); } return { spans: (w._sess || []).length, kinds: [...new Set((w._sess || []).map(s => s.k))], litPct: Math.round(lit / cv.width * 100), tones: tones.size, tf: w.tf }; });
    ok('Trading sessions: spans per session block, the pane is shaded in MORE THAN ONE tone (one tone = every span painted over the whole pane)', ss.spans >= 2 && ss.kinds.length >= 2 && ss.litPct >= 40 && ss.tones >= 2, JSON.stringify(ss));
    await deskInd(page, 'sess', false);
    const ss2 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return !w._sess; });
    ok('switching sessions off clears the shading', ss2);
    await page.evaluate(() => { const w = document.querySelector('.cwin'); w.querySelector('.cwin-ind-btn').click(); document.querySelector('.cwin-ind-menu [data-cmp="ETH"]').click(); w.querySelector('.cwin-ind-btn').click(); });
    await sleep(4000);
    const cm = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const leg = (document.querySelector('.cwin .cwin-leg') || {}).textContent || ''; const cs = (w.indSeries || []).find(s => { try { return s.options().priceScaleId === 'cmp'; } catch (e) { return false; } }); const ser = !!cs; const candles = cs ? cs.seriesType() === 'Candlestick' : false; const translucent = cs ? /rgba\([^)]*,\s*0?\.\d+\)/.test(cs.options().upColor || '') : false; let saved = null; try { saved = JSON.parse(localStorage.getItem('mp_charts'))[0].cmp; } catch (e) {} return { cmp: w.cmp, bars: (w._cmpBars || []).length, ser, candles, translucent, sameTf: w._cmpK === 'ETH|' + w.tf, leg: /vs ETH 5m|vs ETH 1h|vs ETH/.test(leg), saved }; });
    ok('Compare with ETH: translucent CANDLES on an overlay scale, the SAME timeframe, the legend names it, the choice is saved', cm.cmp === 'ETH' && cm.bars > 50 && cm.ser && cm.candles && cm.translucent && cm.sameTf && cm.leg && cm.saved === 'ETH', JSON.stringify(cm));
    await shot(page, 'strip-desk-compare');
    await page.evaluate(() => { const w = document.querySelector('.cwin'); w.querySelector('.cwin-ind-btn').click(); document.querySelector('.cwin-ind-menu [data-cmp=""]').click(); w.querySelector('.cwin-ind-btn').click(); });
    await sleep(500);
    const cm2 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return { cmp: w.cmp, ser: (w.indSeries || []).some(s => { try { return s.options().priceScaleId === 'cmp'; } catch (e) { return false; } }) }; });
    ok('Compare off removes the overlay', cm2.cmp === '' && !cm2.ser, JSON.stringify(cm2));
    const sh = await page.evaluate(() => { const b = document.querySelector('.cwin .cwin-share'); if (!b) return { missing: true }; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const head = document.querySelector('.cwin .cwin-head').getBoundingClientRect(); return { reach: !!(hit && (hit === b || b.contains(hit))), headH: Math.round(head.height) }; });
    ok('the share button is reachable in a one-row header', sh.reach && sh.headH <= 48, JSON.stringify(sh));
    const snap = await page.evaluate(() => new Promise((res) => { const rec = { name: null, size: 0 }; const oc = URL.createObjectURL; URL.createObjectURL = (b) => { rec.size = b && b.size || 0; return 'blob:x'; }; const ok0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { rec.name = this.download; }; try { navigator.share = undefined; } catch (e) {} document.querySelector('.cwin .cwin-share').click(); setTimeout(() => { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok0; res(rec); }, 2500); }));
    ok('Share produces a PNG named after the chart (header + chart + strip + footer)', /^marginpad-[A-Z0-9]+-.+\.png$/.test(snap.name || '') && snap.size > 20000, JSON.stringify(snap));
    const gl = await page.evaluate(async () => { const w = window.__mpWinsDbg[0]; const b = document.querySelector('.cwin .cwin-chart .cwin-golive'); if (!b) return { missing: true }; const before = b.hidden; w.chart.timeScale().scrollToPosition(-80, false); await new Promise(r => setTimeout(r, 250)); const shown = !b.hidden; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const reach = !!(hit && (hit === b || b.contains(hit))); b.click(); await new Promise(r => setTimeout(r, 400)); return { before, shown, reach, after: b.hidden, to: Math.round(w.chart.timeScale().getVisibleLogicalRange().to), n: w.bars.length }; });
    ok('Back to live: hidden at rest, shown once the newest candle leaves the screen, reachable, and a click returns to it', gl.before === true && gl.shown && gl.reach && gl.after === true && gl.to >= gl.n - 2, JSON.stringify(gl));
    ok('no page errors on the desktop', page._errors.length === 0, page._errors.join(' | '));
    await page.close();

    console.log('\nphone 390x844');
    page = await prep(browser, true, 390, 844);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await sleep(7000);
    await page.tap('.mfc-dock [data-act="ind"]'); await sleep(500);
    const pc = await page.evaluate(() => document.querySelectorAll('.mfc-sheet .mfs[data-chstyle]').length);
    ok('the phone indicator sheet opens with the six style chips', pc === 6, 'chips=' + pc);
    await page.tap('.mfc-sheet .mfs[data-chstyle="area"]'); await sleep(500);
    const ps = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; return { style: p._style, shadow: p._styleS ? p._styleS.seriesType() : null, stored: localStorage.getItem('mp_ch_style') }; });
    ok('Area on the phone: the pane gets an area series and the same stored key', ps.style === 'area' && ps.shadow === 'Area' && ps.stored === 'area', JSON.stringify(ps));
    await page.tap('.mfc-sheet .mfs[data-chstyle="candles"]'); await sleep(300);
    for (const k of ['rsi', 'macd']) { await page.evaluate((k) => { const i = document.querySelector('.mfc-sheet input[data-ind="' + k + '"]'); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }, k); await sleep(400); }
    await page.tap('.mfc-sheet [data-x]'); await sleep(600);
    const pm = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; const cards = [...document.querySelectorAll('.mfc-sub .cwin-subleg .cwin-subcard[data-ix]')].map(c => c.getAttribute('data-ix')); const hist = (p.subSeries || []).some(s => { try { return s.seriesType() === 'Histogram' && s.options().priceScaleId === 'macd'; } catch (e) { return false; } }); const zones = (p.subSeries || []).filter(s => { try { return s.seriesType() === 'Baseline'; } catch (e) { return false; } }).length; return { cards, hist, zones }; });
    await shot(page, 'strip-phone');
    ok('phone strip: RSI zones + MACD histogram + a card per band', pm.cards.length === 2 && pm.hist && pm.zones >= 2, JSON.stringify(pm));
    await page.tap('.mfc-sub .cwin-subleg .cwin-subcard[data-ix="macd"]'); await sleep(400);
    const pe = await page.evaluate(() => { const e = document.getElementById('mpIndX'); if (!e || e.hidden) return { open: false }; const r = e.getBoundingClientRect(); return { open: true, sheet: e.classList.contains('sheet'), bottom: Math.round(innerHeight - r.bottom), inside: r.top >= 0 && r.bottom <= innerHeight + 1, title: (e.querySelector('.ix-h b') || {}).textContent, rows: e.querySelectorAll('.ix-r').length }; });
    await shot(page, 'strip-phone-explain');
    ok('on the phone the explanation is a bottom sheet inside the viewport', pe.open && pe.sheet && pe.bottom <= 1 && pe.inside && pe.rows === 4 && /MACD/.test(pe.title || ''), JSON.stringify(pe));
    await page.tap('#mpIndX [data-act="rm"]'); await sleep(600);
    const prm = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; return { macd: !!p.inds.macd, cards: document.querySelectorAll('.mfc-sub .cwin-subleg .cwin-subcard[data-ix]').length }; });
    ok('"Remove from chart" works on the phone too', !prm.macd && prm.cards === 1, JSON.stringify(prm));
    // round seven on the phone: six bands, a finger scrolls the strip, the last card is reachable after
    await page.tap('.mfc-dock [data-act="ind"]'); await sleep(500);
    for (const k of ['macd', 'stoch', 'atr', 'wr', 'cci']) { await page.evaluate((k) => { const i = document.querySelector('.mfc-sheet input[data-ind="' + k + '"]'); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }, k); await sleep(300); }
    await page.tap('.mfc-sheet [data-x]'); await sleep(700);
    const m7 = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; const sh = p.el.querySelector('.mfc-sub'), sc = sh.querySelector('.cwin-subsc'), inn = sh.querySelector('.cwin-subin'); const ir = inn.getBoundingClientRect(); const cards = [...inn.querySelectorAll('.cwin-subcard[data-ix]')]; const rsi = cards.find(c => c.getAttribute('data-ix') === 'rsi'); const s = (p.subSeries || []).find(x => { try { return x.seriesType() === 'Line' && x.options().priceScaleId === 'rsi'; } catch (e) { return false; } }); const y = s ? s.priceToCoordinate(100) : null; const sr = sc.getBoundingClientRect(); return { n: cards.length, innerH: Math.round(ir.height), visH: Math.round(sr.height), scrollable: sc.scrollHeight > sc.clientHeight + 2, rsiCardBottom: rsi ? Math.round(rsi.getBoundingClientRect().bottom) : null, rsiPlotTop: y != null ? Math.round(ir.top + y) : null, cx: Math.round(sr.left + sr.width / 2), y0: Math.round(sr.bottom - 20), y1: Math.round(sr.top + 20) }; });
    ok('phone: six bands at >= 104px each in a strip that scrolls, RSI 100 below its card', m7.n === 6 && m7.innerH >= 6 * 104 - 2 && m7.scrollable && m7.rsiPlotTop != null && m7.rsiPlotTop >= m7.rsiCardBottom - 1, JSON.stringify(m7));
    for (let d = 0; d < 8; d++) { await page.touchscreen.touchStart(m7.cx, m7.y0 - 6); for (let i = 1; i <= 10; i++) { await page.touchscreen.touchMove(m7.cx, m7.y0 - 6 - 240 * i / 10); await sleep(25); } await page.touchscreen.touchEnd(); await sleep(700); /* the finger starts inside the strip and keeps scrolling it while it travels over the price pane, as a real thumb does */ const atEnd = await page.evaluate(() => { const sc = window.__mpMfcDbg()[0].el.querySelector('.cwin-subsc'); return sc.scrollTop >= sc.scrollHeight - sc.clientHeight - 2; }); if (atEnd) break; }
    const m7b = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; const sc = p.el.querySelector('.cwin-subsc'); const last = [...sc.querySelectorAll('.cwin-subcard[data-ix]')].pop(); const r = last.getBoundingClientRect(); const sr = sc.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + 20, r.top + r.height / 2); return { scrollTop: sc.scrollTop, lastInView: r.top >= sr.top - 1 && r.bottom <= sr.bottom + 1, lastReach: !!(hit && (hit === last || last.contains(hit))), lastKey: last.getAttribute('data-ix') }; });
    await shot(page, 'strip-phone-scrolled');
    ok('phone: a finger drag scrolls the strip and the last band comes into reach', m7b.scrollTop > 60 && m7b.lastInView && m7b.lastReach, JSON.stringify(m7b));
    await page.tap('.mfc-dock [data-act="ind"]'); await sleep(400);
    for (const k of ['macd', 'stoch', 'atr', 'wr', 'cci']) { await page.evaluate((k) => { const i = document.querySelector('.mfc-sheet input[data-ind="' + k + '"]'); if (i && i.checked) { i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); } }, k); await sleep(200); }
    // round eight on the phone: daily levels, scale chips, replay
    await page.evaluate(() => { const i = document.querySelector('.mfc-sheet input[data-ind="dl"]'); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }); await sleep(400);
    const p8 = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; const t = (p.indLines || []).map(l => { try { return l.options().title; } catch (e) { return ''; } }); return { titles: t, scaleChips: document.querySelectorAll('.mfc-sheet [data-chscale]').length, replayBtn: !!document.querySelector('.mfc-sheet [data-replay]') }; });
    ok('phone: Daily levels draws the four lines; the sheet carries the three scale chips and the replay button', ['PDH', 'PDL', 'PDC', 'OPEN'].every(k => p8.titles.indexOf(k) >= 0) && p8.scaleChips === 3 && p8.replayBtn, JSON.stringify(p8));
    await page.evaluate(() => { const i = document.querySelector('.mfc-sheet input[data-ind="dl"]'); if (i && i.checked) { i.checked = false; i.dispatchEvent(new Event('change', { bubbles: true })); } }); await sleep(200);
    await page.tap('.mfc-sheet [data-replay]'); await sleep(700);
    const prp = await page.evaluate(async () => { const p = window.__mpMfcDbg()[0]; const ui = p.host.querySelector('.cwin-replay'); if (!ui) return { ui: false }; const r = ui.getBoundingClientRect(); const dock = document.querySelector('.mfc-dock').getBoundingClientRect(); const i0 = p._rp.i; const pb = ui.querySelector('[data-rp="play"]'); const pr = pb.getBoundingClientRect(); const hit = document.elementFromPoint(pr.left + pr.width / 2, pr.top + pr.height / 2); const reach = !!(hit && (hit === pb || pb.contains(hit))); pb.click(); await new Promise(r => setTimeout(r, 1600)); const i1 = p._rp.i; ui.querySelector('[data-rp="x"]').click(); await new Promise(r => setTimeout(r, 400)); return { ui: true, aboveDock: r.bottom <= dock.top + 1, reach, i0, i1, exited: !p._rp, n: p.bars.length }; });
    ok('phone: replay controls sit above the dock, play is reachable and advances, exit restores the book', prp.ui && prp.aboveDock && prp.reach && prp.i1 > prp.i0 && prp.exited && prp.n > prp.i1, JSON.stringify(prp));
    await page.tap('.mfc-dock [data-act="ind"]'); await sleep(400);
    await page.tap('.mfc-sheet [data-x]'); await sleep(400);
    // round six on the phone
    await page.tap('.mfc-dock [data-act="ind"]'); await sleep(500);
    await page.evaluate(() => { const i = document.querySelector('.mfc-sheet input[data-ind="sess"]'); if (i && !i.checked) { i.checked = true; i.dispatchEvent(new Event('change', { bubbles: true })); } }); await sleep(400);
    await page.tap('.mfc-sheet [data-cmp="ETH"]'); await sleep(3500);
    await page.tap('.mfc-sheet [data-x]'); await sleep(500);
    const p6 = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; const bar = document.querySelector('.mfc-bar'); const sb = bar.querySelector('[data-act="share"]'); const r = sb && sb.getBoundingClientRect(); const hit = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); let saved = null; try { saved = JSON.parse(localStorage.getItem('mp_mfc_state')).panes[0].cmp; } catch (e) {} return { sess: (p.w && p.w._sess || []).length, cmp: p.cmp, bars: (p._cmpBars || []).length, leg: /vs ETH/.test((p.el.querySelector('.cwin-leg') || {}).textContent || ''), saved, shareReach: !!(hit && (hit === sb || sb.contains(hit))), barOverflow: bar.scrollWidth - bar.clientWidth }; });
    await shot(page, 'strip-phone-compare');
    ok('phone: sessions shade the pane, Compare with ETH draws and is saved, the share button sits in the top bar without overflow', p6.sess >= 2 && p6.cmp === 'ETH' && p6.bars > 50 && p6.leg && p6.saved === 'ETH' && p6.shareReach && p6.barOverflow <= 0, JSON.stringify(p6));
    const pgl = await page.evaluate(async () => { const p = window.__mpMfcDbg()[0]; const b = p.host.querySelector('.cwin-golive'); if (!b) return { missing: true }; const before = b.hidden; p.chart.timeScale().scrollToPosition(-60, false); await new Promise(r => setTimeout(r, 250)); const shown = !b.hidden; const r = b.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); const reach = !!(hit && (hit === b || b.contains(hit))); const size = Math.round(Math.min(r.width, r.height)); b.click(); await new Promise(r => setTimeout(r, 400)); return { before, shown, reach, size, after: b.hidden }; });
    ok('phone: back-to-live appears when scrolled back, is thumb-sized and reachable, and a tap returns to the newest candle', pgl.before === true && pgl.shown && pgl.reach && pgl.size >= 38 && pgl.after === true, JSON.stringify(pgl));
    await page.tap('.mfc-dock [data-act="ind"]'); await sleep(400); await page.tap('.mfc-sheet [data-cmp=""]'); await sleep(300); await page.tap('.mfc-sheet [data-x]'); await sleep(200);
    ok('no page errors on the phone', page._errors.length === 0, page._errors.join(' | '));
    await page.close();
  });
  console.log('\ncharts-strip-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
