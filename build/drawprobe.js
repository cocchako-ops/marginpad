/* Visual probe (2026-09-17): the only honest way to judge what Ask AI DRAWS - run the REAL model over a REAL brief, replay its
   answer through the live client, and screenshot the chart. A drawing is judged by looking at it, not by counting shapes.
   Visual probe: run the REAL model over a REAL chart brief, then draw its actions on the real /charts window and screenshot it.
   node drawprobe.js [SYM] [TF]  */
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(String.fromCharCode(10))[1].replace(String.fromCharCode(13), '').trim();
const SYM = process.argv[2] || 'BTC', TF = process.argv[3] || '60';
const OUT = path.join(__dirname, 'vault-shots');

const p6 = v => (v == null || !isFinite(v)) ? null : +(+v).toPrecision(6);
function pivotsOf(bars, k, max) { const n = bars.length, out = [];
  for (let i = k; i < n - k; i++) { const hi = +bars[i].high, lo = +bars[i].low; let isH = true, isL = true;
    for (let j = i - k; j <= i + k; j++) { if (j === i) continue; if (+bars[j].high >= hi) isH = false; if (+bars[j].low <= lo) isL = false; if (!isH && !isL) break; }
    if (isH) out.push({ barsAgo: n - 1 - i, price: hi, kind: 'high' }); if (isL) out.push({ barsAgo: n - 1 - i, price: lo, kind: 'low' }); }
  out.sort((a, b) => a.barsAgo - b.barsAgo); return out.slice(0, max || 16); }
function levelsOf(piv, price, tol) { const out = [];
  piv.forEach(p => { let hit = null; for (const o of out) if (Math.abs(o.price - p.price) / price <= tol) { hit = o; break; }
    if (hit) { hit.touches++; hit.price = (hit.price * (hit.touches - 1) + p.price) / hit.touches; if (p.barsAgo < hit.lastBarsAgo) hit.lastBarsAgo = p.barsAgo; }
    else out.push({ price: p.price, touches: 1, lastBarsAgo: p.barsAgo }); });
  return out.filter(l => l.touches >= 2).sort((a, b) => b.touches - a.touches).slice(0, 6); }
const ema = (v, p) => { const k = 2 / (p + 1), o = []; let e; for (let i = 0; i < v.length; i++) { e = i ? v[i] * k + o[i - 1] * (1 - k) : v[i]; o.push(e); } return o; };
const TFW = { '1': '1-minute', '5': '5-minute', '15': '15-minute', '60': '1-hour', '240': '4-hour', '1440': 'daily' };

(async () => {
  const kl = await (await fetch(`${ORIGIN}/api/klines?symbol=${SYM}&interval=${TF}`)).json();
  const bars = (Array.isArray(kl) ? kl : (kl.data || [])).map(b => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close, vol: +b.vol }));
  const n = bars.length, c = bars.map(b => b.close), price = c[n - 1];
  const k = Math.max(2, Math.min(9, Math.round(n / 40)));
  const P = pivotsOf(bars, k, 16);
  const lv = levelsOf(P, price, 0.004);
  const hs = P.filter(p => p.kind === 'high').slice(0, 3), ls = P.filter(p => p.kind === 'low').slice(0, 3);
  let structure = null;
  if (hs.length >= 2 && ls.length >= 2) { const hh = hs[0].price > hs[1].price, hl = ls[0].price > ls[1].price;
    structure = hh && hl ? 'higher highs and higher lows (uptrend structure)' : (!hh && !hl ? 'lower highs and lower lows (downtrend structure)' : 'mixed - range or a transition'); }
  let lo = Infinity, hi = -Infinity; bars.forEach(b => { if (b.low < lo) lo = b.low; if (b.high > hi) hi = b.high; });
  const brief = {
    chartTools: { indicators: { ids: ['sig','casc','brain','memory','magnet','ema','sma','hma','vwap','bb','kc','dc','ichi','psar','sr','pp','vol','rsi','macd','stoch','atr','wr','cci'], on: [], locked: [] },
      shapes: ['trend','ray','channel','zone','hline','arrow','text','fib','rect','vline'], timeframes: ['1','5','15','60','240','1440'], currentTf: TF, currentTfLabel: TFW[TF] || TF, canSwitchSymbol: true,
      barsAgoNote: `barsAgo 0 = the newest candle; ${n} candles are loaded, so barsAgo runs 0-${n - 1} into the past; negative projects into the future (max -30)` },
    swingPivots: P.map(p => ({ barsAgo: p.barsAgo, price: p6(p.price), kind: p.kind })),
    respectedLevels: lv.map(l => ({ price: p6(l.price), touches: l.touches, lastTouchBarsAgo: l.lastBarsAgo })),
    structure, visibleWindow: { oldestBarsAgo: Math.min(n - 1, 120), newestBarsAgo: 0, barsOnScreen: Math.min(n, 120) },
    symbol: SYM, timeframe: TFW[TF] || TF, barsLoaded: n, price: p6(price),
    loadedHigh: p6(hi), loadedLow: p6(lo),
    recentSwingHigh: p6(Math.max(...bars.slice(-90).map(b => b.high))), recentSwingLow: p6(Math.min(...bars.slice(-90).map(b => b.low))),
    movingAverages: { ema21: p6(ema(c, 21)[n - 1]), ema50: p6(ema(c, 50)[n - 1]), ema200: p6(ema(c, 200)[n - 1]) },
    atrPct: 0.6, recentCloses: c.slice(-24).map(p6),
    liquidationPools: { above: [{ price: p6(price * 1.022), distPct: 2.2, sizeUsd: 41000000, side: 'short liquidations' }], below: [{ price: p6(price * 0.981), distPct: -1.9, sizeUsd: 38000000, side: 'long liquidations' }] },
  };
  console.log(`${SYM} ${TFW[TF]} | ${n} bars | price ${price} | pivots ${P.length} | levels ${lv.length} | ${structure}`);
  const t0 = Date.now();
  const r = await fetch(`${ORIGIN}/api/ai/chart`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' },
    body: JSON.stringify({ context: brief, question: 'Read this chart and draw the setup on it.', stream: false, lang: 'en' }) });
  const j = await r.json();
  if (!j.answer) { console.log('FAIL', JSON.stringify(j).slice(0, 300)); process.exit(1); }
  console.log(`model ${Date.now() - t0}ms`);
  const blocks = []; const re = /```[a-zA-Z]*\s*([\s\S]*?)```/g; let m;
  while ((m = re.exec(j.answer))) { const b = m[1].trim(); if (b[0] === '{' || b[0] === '[') { try { blocks.push(JSON.parse(b)); } catch (e) {} } }
  const plan = blocks.find(b => b && b.bias), acts = (blocks.find(b => b && Array.isArray(b.actions)) || {});
  console.log('\n--- PROSE ---\n' + j.answer.split('```')[0].trim());
  console.log('\n--- ACTIONS ---');
  (acts.actions || []).forEach(a => console.log('  ' + JSON.stringify(a)));
  console.log('chips:', JSON.stringify(acts.chips || []));
  fs.writeFileSync(path.join(OUT, 'lastanswer.txt'), j.answer);

  // ---- render it on the real chart ----
  const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
  const sse = (text) => { const parts = []; for (let i = 0; i < text.length; i += 60) parts.push(text.slice(i, i + 60));
    return parts.map(t => 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n').join('') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n'; };
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1500, height: 950 });
    await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    page.on('pageerror', e => console.log('PAGEERR', String(e.message).slice(0, 160)));
    await page.setRequestInterception(true);
    page.on('request', (req) => { const u = req.url();
      if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'probe', xp: 4100, level: LV, premium: true } }) });
      if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
      if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, source: 'owner' }) });
      if (u.includes('/api/ai/chart')) { if (req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('hist=') ? { ok: true, msgs: [] } : { signedIn: true, premium: true, used: 3, limit: 50, ai: true }) });
        let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
        if (b.op === 'hist') return req.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
        return req.respond({ status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'x-ai-used': '4', 'x-ai-limit': '50' }, body: sse(j.answer) }); }
      return req.continue(); });
    await page.goto(`${ORIGIN}/charts?cb=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
    await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.__mpWinsDbg[0].dr', { timeout: 40000 }).catch(() => {});
    await page.evaluate(async (sym, tf) => { const w = window.__mpWinsDbg[0]; const si = w.el.querySelector('.cwin-sym');
      if (w.sym !== sym) { si.value = sym; si.dispatchEvent(new Event('change', { bubbles: true })); }
      const tb = w.el.querySelector('.cwin-tf button[data-tf="' + tf + '"]'); if (tb && w.tf !== tf) tb.click();
      // make it big so the drawing has room
      w.el.style.left = '0px'; w.el.style.top = '0px'; w.el.style.width = (document.getElementById('cwsBoard').clientWidth) + 'px'; w.el.style.height = (document.getElementById('cwsBoard').clientHeight) + 'px';
      await new Promise(r => setTimeout(r, 2500));
    }, SYM, TF);
    await page.waitForFunction(`window.__mpWinsDbg[0].sym==='${SYM}' && window.__mpWinsDbg[0].tf==='${TF}' && window.__mpWinsDbg[0].bars.length>50`, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { const b = document.querySelector('.cwin-ai'); b && b.click(); });
    await page.waitForFunction("!!document.querySelector('.cwin-ai-panel') && !document.querySelector('.cwin-ai-panel').hidden", { timeout: 15000 }).catch(() => {});
    await page.evaluate(() => { const c = document.querySelector('.cwin-ai-panel .cwin-ai-chip'); c && c.click(); });
    await page.waitForFunction("!!document.querySelector('.cwin-ai-panel .aiacts')", { timeout: 25000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1200));
    const info = await page.evaluate(() => { const w = window.__mpWinsDbg[0], ai = w.dr.shapes.filter(s => s.by === 'ai');
      return { sym: w.sym, tf: w.tf, shapes: ai.map(s => ({ t: s.t, l1: s.l1, l2: s.l2, l: s.l, p1: s.p1 && +(+s.p1).toPrecision(6), p2: s.p2 && +(+s.p2).toPrecision(6), p: s.p && +(+s.p).toPrecision(6), txt: s.txt })), n: w.bars.length,
        receipts: [...document.querySelectorAll('.aiacts span')].map(x => x.textContent) }; });
    console.log('\n--- ON CHART --- sym', info.sym, 'tf', info.tf, 'bars', info.n);
    info.shapes.forEach(s => console.log('  ', JSON.stringify(s)));
    console.log('receipts:', info.receipts.join(' | '));
    await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); if (p) p.style.display = 'none'; });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: path.join(OUT, `draw-${SYM}-${TF}.png`) });
    console.log('screenshot ->', path.join(OUT, `draw-${SYM}-${TF}.png`));
    await ctx.close();
  });
})();
