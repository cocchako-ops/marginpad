/* WHAT THE CHART KEEPS, AND WHAT THE READER CAN TAKE BACK (2026-10-15, owner: "dosta stvari se izgubi i obrise ako izadjem iz
   charts ili promenim da gledam nesto drugo ... undo jer mi se desavalo da slucajno pomerim nesto ... full screen ... lupa").

   Desktop: a drawn line survives Ctrl+Z / Ctrl+Y, a move is undone to the exact price, the palette has Undo and Redo, an AI
   shape AND the AI plan lines come back after a symbol round-trip and after a reload, a save fired before the new symbol's
   candles land cannot wipe that symbol's stored drawings (the guard), Maximize fills the board, Full screen asks the browser.
   Phone: the symbol wheel opens under the finger (not at 46% of the screen), the plan lines come back after a coin
   round-trip through the real coin sheet, the palette carries Undo and Redo.

   node build/charts-keep-e2e.js            against production
   node build/charts-keep-e2e.js --local    app.html + the bundles served from the tree (pre-deploy) */
const fs = require('fs'), path = require('path');
const { withBrowser, newPage, UA_DESKTOP, UA_MOBILE } = require('./e2e-browser');
const BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist'), A = path.join(DIST, 'assets');
const LOCAL = process.argv.includes('--local');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note ? '  -> ' + String(typeof note === 'string' ? note : JSON.stringify(note)).slice(0, 260) : '')); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SERVE = /^\/assets\/(home\.css|home\.js|mp-charts\.js|mp-mcharts\.js|mp-auth\.js)$/;
const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
async function prep(browser, mobile, w, h) {
  const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
  await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.setCacheEnabled(false);
  await page.setRequestInterception(true);
  try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
  await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
  page.on('request', (req) => {
    const u = req.url();
    if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
    if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'probe', xp: 4100, level: LV, premium: true } }) });
    if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
    if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, source: 'owner' }) });
    if (u.includes('/api/ai/chart') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('hist=') ? { ok: true, msgs: [] } : { signedIn: true, premium: true, used: 1, limit: 50, ai: true }) });
    if (LOCAL) { try { const p = new URL(u).pathname;
      if (req.resourceType() === 'document' && /^\/charts\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
      const m = p.match(SERVE); if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1]), 'utf8') });
    } catch (e) {} }
    req.continue();
  });
  page._errors = errors; return page;
}
const W = 'window.__mpWinsDbg[0]';
const ready = (page, g) => page.waitForFunction(g + ' && ' + g + '.bars && ' + g + '.bars.length>50 && ' + g + '.dr && ' + g + '.dr._lk', { timeout: 40000 });
const state = (page, g) => page.evaluate((g) => { const w = eval(g); const sh = w.dr.shapes || []; return { sym: w.sym, tf: w.tf, user: sh.filter(s => !s.ai && s.by !== 'ai').length, ai: sh.filter(s => s.by === 'ai').length, planLines: (w._aiPlan || []).length, hist: (w.dr.hist || []).length, redo: (w.dr.redoS || []).length, userP: (sh.filter(s => !s.ai && s.by !== 'ai')[0] || {}).p }; }, g);

withBrowser(async (browser) => {
  console.log('\ndesktop 1366x768' + (LOCAL ? ' (--local)' : ''));
  {
    const page = await prep(browser, false, 1366, 768);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
    await ready(page, W);
    // one window, a known size, draw mode on, the horizontal-line tool
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.el.style.left = '0px'; w.el.style.top = '0px'; w.el.style.width = '900px'; w.el.style.height = '560px'; });
    await sleep(600);
    const sym0 = await page.evaluate(() => window.__mpWinsDbg[0].sym);
    const other = sym0 === 'ETH' ? 'BTC' : 'ETH';
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.el.querySelector('.cwin-draw-tg').click(); w._drSetTool('hline'); });
    const box = await page.evaluate(() => { const r = window.__mpWinsDbg[0].el.querySelector('.cwin-draw').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    const cx = box.x + box.w * 0.5, cy = box.y + box.h * 0.45;
    await page.mouse.click(cx, cy); await sleep(300);
    let s = await state(page, W);
    ok('a drawn line lands as a user shape and is recorded for undo', s.user === 1 && s.hist === 1, s);
    const p0 = s.userP;
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(200);
    s = await state(page, W); ok('Ctrl+Z takes the line away and keeps it on the redo stack', s.user === 0 && s.redo === 1, s);
    await page.keyboard.down('Control'); await page.keyboard.press('y'); await page.keyboard.up('Control'); await sleep(200);
    s = await state(page, W); ok('Ctrl+Y brings it back at the same price', s.user === 1 && Math.abs(s.userP - p0) < 1e-9, s);
    // move it by dragging (select tool), then undo the move
    await page.evaluate(() => { window.__mpWinsDbg[0]._drSetTool('select'); });
    const ly = await page.evaluate((p) => { const w = window.__mpWinsDbg[0]; const r = w.el.querySelector('.cwin-draw').getBoundingClientRect(); return r.top + w.candle.priceToCoordinate(p); }, p0);
    await page.mouse.move(cx - 120, ly); await page.mouse.down(); await sleep(60); await page.mouse.move(cx - 120, ly + 30, { steps: 6 }); await sleep(60); await page.mouse.move(cx - 120, ly + 60, { steps: 6 }); await page.mouse.up(); await sleep(300);
    s = await state(page, W); ok('a drag moves the line to a different price', s.user === 1 && Math.abs(s.userP - p0) / p0 > 0.0005, { was: p0, now: s.userP });
    const moved = s.userP;
    await page.keyboard.down('Control'); await page.keyboard.press('z'); await page.keyboard.up('Control'); await sleep(200);
    s = await state(page, W); ok('Ctrl+Z puts the moved line back at its original price - the accidental nudge', Math.abs(s.userP - p0) < 1e-9, { back: s.userP, p0 });
    const pal = await page.evaluate(() => { const t = window.__mpWinsDbg[0].el.querySelector('.cwin-tools'); return { undo: !!t.querySelector('[data-undo]'), redo: !!t.querySelector('[data-redo]'), redoDim: t.querySelector('[data-redo]').classList.contains('dim') }; });
    ok('the palette carries Undo and Redo, and Redo is live after an undo', pal.undo && pal.redo && !pal.redoDim, pal);
    await page.evaluate(() => { window.__mpWinsDbg[0].el.querySelector('[data-redo]').click(); }); await sleep(200);
    s = await state(page, W); ok('the palette Redo re-applies the move', Math.abs(s.userP - moved) < 1e-9, { now: s.userP, moved });
    // AI shape + plan, then a symbol round-trip and a reload
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const px = +w.bars[w.bars.length - 1].close; window.__mpAi.draw(w, [{ a: 'draw', shape: 'level', p: px * 1.01, barsAgo: 10, label: 'keep-probe' }], 4242); window.__mpAi.drawPlan(w, { bias: 'long', confidence: 60, entry: px * 0.995, stop: px * 0.97, targets: [px * 1.03, px * 1.05], horizonBars: 20 }, false); w.dr.save(); });
    await sleep(300); s = await state(page, W);
    ok('an AI shape and the AI plan lines are on the chart', s.ai === 1 && s.planLines >= 3, s);
    const sw = async (sym) => { await page.evaluate((s2) => { window.__mpAi.setSym(window.__mpWinsDbg[0], s2); }, sym); await page.waitForFunction(W + '.sym==="' + sym + '" && ' + W + '.bars.length>50 && ' + W + '.dr._lk==="' + sym + ':"+' + W + '.tf', { timeout: 30000 }); await sleep(600); };
    await sw(other);
    // seed the other coin with one line and a stored state, then go back
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const px = +w.bars[w.bars.length - 1].close; w.dr.mark(); w.dr.shapes.push({ t: 'hline', p: px * 0.98, color: '#ff00ff', w: 2 }); w.dr.save(); });
    s = await state(page, W); ok('the other coin starts with its own canvas (nothing carried over)', s.user === 1 && s.ai === 0 && s.planLines === 0, s);
    await sw(sym0); s = await state(page, W);
    ok('back on the first coin: the user line, the AI shape AND the plan lines are back', s.user === 1 && s.ai === 1 && s.planLines >= 3, s);
    // THE GUARD: a save fired while the new coin's candles are still loading must not wipe that coin's store
    await page.evaluate((s2) => { const w = window.__mpWinsDbg[0]; window.__mpAi.setSym(w, s2); w.dr.save(); w.dr.save(); }, other);
    await page.waitForFunction(W + '.sym==="' + other + '" && ' + W + '.dr._lk==="' + other + ':"+' + W + '.tf', { timeout: 30000 }); await sleep(600);
    s = await state(page, W); ok('a save() fired before the new candles landed did NOT wipe that coin\'s drawings (the guard)', s.user === 1, s);
    await sw(sym0);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }); await ready(page, W); await sleep(1200);
    s = await state(page, W); ok('after a full reload everything is still there, plan lines included', s.sym === sym0 && s.user === 1 && s.ai === 1 && s.planLines >= 3, s);
    // maximize + full screen buttons
    const mx = await page.evaluate(() => { const w = window.__mpWinsDbg[0], b = w.el.querySelector('.cwin-max'); if (!b) return { no: true }; b.click(); const board = w.el.parentElement, cs = getComputedStyle(board); const inner = board.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0); return { w: w.el.offsetWidth, bw: inner, maxed: w.el.classList.contains('maxed') }; });
    ok('the Maximize button fills the board (its content box, beside the rail)', !mx.no && mx.maxed && Math.abs(mx.w - mx.bw) < 4, mx);
    await page.evaluate(() => { window.__mpWinsDbg[0].el.querySelector('.cwin-max').click(); });
    const fsb = await page.evaluate(() => !!window.__mpWinsDbg[0].el.querySelector('.cwin-fs'));
    ok('the Full screen button is in the window header', fsb);
    if (fsb) { await page.evaluate(() => { const r = window.__mpWinsDbg[0].el.querySelector('.cwin-fs').getBoundingClientRect(); window.__fsPt = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }); const pt = await page.evaluate(() => window.__fsPt); await page.mouse.click(pt.x, pt.y); await sleep(700);
      const fs2 = await page.evaluate(() => ({ el: document.fullscreenElement === window.__mpWinsDbg[0].el, enabled: document.fullscreenEnabled, cls: window.__mpWinsDbg[0].el.classList.contains('fs'), w: window.__mpWinsDbg[0].el.offsetWidth, vw: innerWidth }));
      ok('clicking it asks the browser for full screen (or the browser forbids it here)', fs2.el || !fs2.enabled, fs2);
      if (fs2.el) { await page.keyboard.press('Escape'); await sleep(500); }
    }
    ok('no page errors on the desktop', !page._errors.length, page._errors);
    await page.close();
  }
  console.log('\nphone 390x844' + (LOCAL ? ' (--local)' : ''));
  {
    const page = await prep(browser, true, 390, 844);
    await page.goto(BASE + '/charts?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 90000 });
    const G = 'window.__mpMfcDbg()[0].w';
    await page.waitForFunction('window.__mpMfcDbg && window.__mpMfcDbg()[0] && ' + G + ' && ' + G + '.dr && ' + G + '.dr._lk', { timeout: 40000 }); await sleep(800);
    const pal = await page.evaluate(() => { const t = document.querySelector('.mfc .cwin-tools'); return { undo: !!(t && t.querySelector('[data-undo]')), redo: !!(t && t.querySelector('[data-redo]')) }; });
    ok('the phone palette carries Undo and Redo', pal.undo && pal.redo, pal);
    // the wheel opens UNDER the finger
    const wh = await page.evaluate(() => { const b = document.querySelector('[data-act="sym"]'); const r = b.getBoundingClientRect(); window.__mpWheel.open(); const lens = document.querySelector('.mfc-wheel-lens'); const lr = lens ? lens.getBoundingClientRect() : null; const st = window.__mpWheel.state(); window.__mpWheel.set(st.i + 2); const st2 = window.__mpWheel.state(); window.__mpWheel.close(false); return { btnY: r.top + r.height / 2, lensMid: lr ? lr.top + lr.height / 2 : null, mid46: innerHeight * 0.46, i: st.i, i2: st2.i }; });
    ok('the lens sits under the finger (clamped to the screen), not at 46% of the screen', wh.lensMid != null && Math.abs(wh.lensMid - Math.max(96, wh.btnY)) < 40 && Math.abs(wh.lensMid - wh.mid46) > 40, wh);
    ok('the drum turns by rows', wh.i2 === wh.i + 2, wh);
    // plan persistence through the real coin sheet
    const sym0 = await page.evaluate(() => window.__mpMfcDbg()[0].sym);
    const other = sym0 === 'ETH' ? 'BTC' : 'ETH';
    await page.evaluate(() => { const p = window.__mpMfcDbg()[0], w = p.w; const px = +p.bars[p.bars.length - 1].close; w._planRestore({ bias: 'short', confidence: 60, entry: px * 1.005, stop: px * 1.03, targets: [px * 0.97, px * 0.95], horizonBars: 20 }); w.dr.save(); });
    await sleep(300);
    let ps = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; return { lines: (p._aiPlan || []).length, obj: !!p.w._aiPlanObj }; });
    ok('the phone draws the plan lines and the engine knows the plan', ps.lines >= 3 && ps.obj, ps);
    const pick = async (sym) => { await page.tap('[data-act="sym"]'); await page.waitForSelector('.mfc-sr[data-pick="' + sym + '"]', { timeout: 10000 }); await page.tap('.mfc-sr[data-pick="' + sym + '"]'); await page.waitForFunction('window.__mpMfcDbg()[0].sym==="' + sym + '" && window.__mpMfcDbg()[0].bars.length>50 && ' + G + '.dr._lk==="' + sym + ':"+window.__mpMfcDbg()[0].tf', { timeout: 30000 }); await sleep(700); };
    await pick(other);
    ps = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; return { lines: (p._aiPlan || []).length, sym: p.sym }; });
    ok('on the other coin the plan is gone (it belongs to the first)', ps.lines === 0, ps);
    await pick(sym0);
    ps = await page.evaluate(() => { const p = window.__mpMfcDbg()[0]; return { lines: (p._aiPlan || []).length, sym: p.sym, obj: !!p.w._aiPlanObj }; });
    ok('back on the first coin the plan lines are back through the coin sheet round-trip', ps.lines >= 3 && ps.obj, ps);
    ok('no page errors on the phone', !page._errors.length, page._errors);
    await page.close();
  }
  console.log('\ncharts-keep-e2e' + (LOCAL ? ' (--local)' : '') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
}, { timeoutMs: 600000 });
