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
    // round six: sessions, compare, share, back to live
    await deskInd(page, 'sess', true);
    const ss = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const cv = document.querySelector('.cwin canvas.cwin-draw'); const ctx = cv.getContext('2d'); const y = Math.round(cv.height * 0.5); const d = ctx.getImageData(0, y, cv.width, 1).data; let lit = 0; const tones = new Set(); for (let i = 3; i < d.length; i += 4) if (d[i] > 0) { lit++; tones.add(d[i - 3] + ',' + d[i - 2] + ',' + d[i - 1]); } return { spans: (w._sess || []).length, kinds: [...new Set((w._sess || []).map(s => s.k))], litPct: Math.round(lit / cv.width * 100), tones: tones.size, tf: w.tf }; });
    ok('Trading sessions: spans per session block, the pane is shaded in MORE THAN ONE tone (one tone = every span painted over the whole pane)', ss.spans >= 2 && ss.kinds.length >= 2 && ss.litPct >= 40 && ss.tones >= 2, JSON.stringify(ss));
    await deskInd(page, 'sess', false);
    const ss2 = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; return !w._sess; });
    ok('switching sessions off clears the shading', ss2);
    await page.evaluate(() => { const w = document.querySelector('.cwin'); w.querySelector('.cwin-ind-btn').click(); document.querySelector('.cwin-ind-menu [data-cmp="ETH"]').click(); w.querySelector('.cwin-ind-btn').click(); });
    await sleep(4000);
    const cm = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const leg = (document.querySelector('.cwin .cwin-leg') || {}).textContent || ''; const ser = (w.indSeries || []).some(s => { try { return s.options().priceScaleId === 'cmp'; } catch (e) { return false; } }); let saved = null; try { saved = JSON.parse(localStorage.getItem('mp_charts'))[0].cmp; } catch (e) {} return { cmp: w.cmp, bars: (w._cmpBars || []).length, ser, leg: /vs ETH/.test(leg), saved }; });
    ok('Compare with ETH: its candles arrive, draw on an overlay scale, the legend says so, and the choice is saved', cm.cmp === 'ETH' && cm.bars > 50 && cm.ser && cm.leg && cm.saved === 'ETH', JSON.stringify(cm));
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
