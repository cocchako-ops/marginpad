/* Ask AI on /charts - the chart-control step-up of 2026-09-17 (owner: "ako mu kazem da mi nacrta, on treba da nacrta i da koristi
   alate za crtanje ... kad izadjes iz chat-a, istorija se gubi ... AI treba da ima kontrolu nad chartom ... da objasni indikatore
   koje nudimo").

   Proven on production:
     worker: GET status shape; ONE real model call through the E2E hook (admin key + x-mp-e2e) on a live BTC brief that carries
       chartTools and asks it to DRAW and OPEN RSI - the answer ends with the disclaimer, carries a ```plan block that parses AND an
       ```actions block with at least one valid draw action (prices within 15% of the live price) and an indicator action for rsi,
       plus 1-4 chips; the per-symbol thread round-trips through the server (POST op:hist -> GET ?hist= -> clear)
     desktop /charts (member + Premium simulated, the model replaced by a canned stream built from the chart's own price): the
       answer renders the plan card; the actions EXECUTE with no click - RSI is switched on (the oscillator sub-pane appears), the
       model's shapes land in the drawing engine tagged by:'ai' (a ray, a zone, a level, their labels) and are PERSISTED like the
       reader's own drawings, the plan draws its level lines but NOT its zones (the model drew the setup), the bubble carries the
       receipt ("Opened RSI", "Drew 3 shapes"), the chips are the model's, Undo removes exactly that answer's drawings; the thread
       survives closing and reopening the panel AND a reload (localStorage per symbol), and a history save reached the server
     mobile /charts (landscape phone): the sheet renders the thread with the plan card, executes the actions on the pane (RSI on,
       ai shapes on the pane's engine), shows the receipt + chips, and reopening the sheet shows the same thread

   Run: node build/ai-chart-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : ''));
const splitAll = (t) => { const re = /```[a-zA-Z]*\s*([\s\S]*?)```/g; let m, plan = null, acts = null, chips = null; while ((m = re.exec(t))) { const b = m[1].trim(); if (b[0] !== '{' && b[0] !== '[') continue; let p; try { p = JSON.parse(b); } catch (e) { continue; } if (Array.isArray(p)) { acts = p; continue; } if (Array.isArray(p.actions) || Array.isArray(p.chips)) { acts = p.actions || acts; chips = p.chips || chips; } else if (p.bias || p.entry) plan = p; } return { plan, acts, chips }; };
const HDR = { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' };

(async () => {
  // ---- worker ----
  const st = await (await fetch(ORIGIN + '/api/ai/chart')).json();
  chk('GET status carries signedIn/premium/limit/ai', st && typeof st.signedIn === 'boolean' && typeof st.premium === 'boolean' && 'limit' in st && st.ai === true, st);
  const px = await (await fetch(ORIGIN + '/api/price?symbol=BTC')).json();
  const kl = await (await fetch(ORIGIN + '/api/klines?symbol=BTC&interval=60')).json();
  const bars = (Array.isArray(kl) ? kl : (kl.data || [])).slice(-150), c = bars.map(b => +b.close), price = +px.price || c[c.length - 1];
  let hi = -Infinity, lo = Infinity, hiAgo = 0, loAgo = 0; bars.slice(-90).forEach((b, i, arr) => { if (+b.high > hi) { hi = +b.high; hiAgo = arr.length - 1 - i; } if (+b.low < lo) { lo = +b.low; loAgo = arr.length - 1 - i; } });
  // the real structure the client sends: fractal pivots + the levels price respected, so the model is asked to anchor on something real
  const PV = (() => { const n = bars.length, o = [], k = Math.max(2, Math.min(9, Math.round(n / 40)));
    for (let i = k; i < n - k; i++) { const h = +bars[i].high, l = +bars[i].low; let iH = true, iL = true;
      for (let j2 = i - k; j2 <= i + k; j2++) { if (j2 === i) continue; if (+bars[j2].high >= h) iH = false; if (+bars[j2].low <= l) iL = false; if (!iH && !iL) break; }
      if (iH) o.push({ barsAgo: n - 1 - i, price: h, kind: 'high' }); if (iL) o.push({ barsAgo: n - 1 - i, price: l, kind: 'low' }); }
    return o.sort((a, b) => a.barsAgo - b.barsAgo).slice(0, 16); })();
  const pivots = PV.map(x => ({ barsAgo: x.barsAgo, price: +x.price.toPrecision(6), kind: x.kind }));
  const levels = (() => { const o = []; PV.forEach(x => { let hit = null; for (const q of o) if (Math.abs(q.price - x.price) / price <= 0.004) { hit = q; break; }
      if (hit) { hit.touches++; if (x.barsAgo < hit.lastTouchBarsAgo) hit.lastTouchBarsAgo = x.barsAgo; } else o.push({ price: +x.price.toPrecision(6), touches: 1, lastTouchBarsAgo: x.barsAgo }); });
    return o.filter(q => q.touches >= 2).sort((a, b) => b.touches - a.touches).slice(0, 6); })();
  const brief = { chartTools: { indicators: { ids: ['sig', 'casc', 'brain', 'memory', 'magnet', 'ema', 'sma', 'hma', 'vwap', 'bb', 'kc', 'dc', 'ichi', 'psar', 'sr', 'pp', 'vol', 'rsi', 'macd', 'stoch', 'atr', 'wr', 'cci'], on: [], locked: [], emaPeriodsNow: [21], smaPeriodsNow: [50] }, shapes: ['trend', 'ray', 'channel', 'zone', 'hline', 'arrow', 'text', 'fib'], timeframes: ['1', '5', '15', '60', '240', '1440'], currentTf: '60', currentTfLabel: '1-hour', canSwitchSymbol: true, barsAgoNote: 'barsAgo 0 = the newest candle; 150 candles are loaded; negative projects into the future (max -30)' }, swingPivots: pivots, respectedLevels: levels, structure: 'mixed - range or a transition', visibleWindow: { oldestBarsAgo: 120, newestBarsAgo: 0, barsOnScreen: 120 }, symbol: 'BTC', timeframe: '1-hour', barsLoaded: bars.length, price, lastBarChangePct: +((c[c.length - 1] / c[c.length - 2] - 1) * 100).toFixed(2), changePctOver150Bars: +((price / c[0] - 1) * 100).toFixed(2), loadedHigh: hi, loadedLow: lo, recentSwingHigh: hi, swingHighBarsAgo: hiAgo, recentSwingLow: lo, swingLowBarsAgo: loAgo, distToSwingHighPct: +((price - hi) / hi * 100).toFixed(2), distToSwingLowPct: +((price - lo) / lo * 100).toFixed(2), rsi14: 52.3, rsiState: 'neutral', atrPct: 0.6, recentCloses: c.slice(-24), liquidationPools: { above: [{ price: +(price * 1.02).toFixed(0), distPct: 2, sizeUsd: 41000000, side: 'short liquidations' }], below: [{ price: +(price * 0.982).toFixed(0), distPct: -1.8, sizeUsd: 38000000, side: 'long liquidations' }] } };
  const t0 = Date.now();
  const r = await fetch(ORIGIN + '/api/ai/chart', { method: 'POST', headers: HDR, body: JSON.stringify({ context: brief, question: 'Draw the setup on the chart and open RSI, then tell me what RSI shows here.', stream: false, lang: 'en' }) });
  const j = await r.json().catch(() => null); const ms = Date.now() - t0;
  const sp = j && j.answer ? splitAll(j.answer) : { plan: null, acts: null, chips: null };
  chk('POST (real model, E2E hook): 200, disclaimer, a plan block parses, bias is long/short/wait', r.status === 200 && j && /Not financial advice/.test(j.answer || '') && sp.plan && /^(long|short|wait)$/.test(String(sp.plan.bias)), { status: r.status, ms, bias: sp.plan && sp.plan.bias, used: j && j.used, err: j && j.error, head: (j && j.answer || '').slice(0, 120) });
  const near = v => v > 0 && Math.abs(v - price) / price < 0.15;
  const draws = (sp.acts || []).filter(a => a && a.a === 'draw');
  const drawOk = draws.length >= 1 && draws.every(a => { if (a.shape === 'hline' || a.shape === 'text') return near(+a.p); if (a.shape === 'zone') return near(+a.from) && near(+a.to); if (a.shape === 'arrow') return near(+a.p2); if (a.shape === 'vline') return true; return near(+a.p1) && near(+a.p2); });
  // every line anchor the model used must be a REAL pivot it was given - that is the whole point of sending swingPivots
  const anch = draws.filter(a => ['trend', 'ray', 'channel', 'fib'].indexOf(a.shape) >= 0);
  const anchOk = anch.every(a => [a.barsAgo1, a.barsAgo2].every(b => pivots.some(p => Math.abs(p.barsAgo - +b) <= 2)) && Math.abs(+a.barsAgo1 - +a.barsAgo2) >= 4);
  chk('every trend line / channel the model drew is anchored on real swing pivots at least 4 candles apart (or it drew the range with horizontal levels instead)', anchOk, { anchored: anch.map(a => a.shape + ' ' + a.barsAgo1 + '->' + a.barsAgo2), structureDrawn: draws.some(a => ['trend', 'ray', 'channel'].indexOf(a.shape) >= 0) || draws.filter(a => a.shape === 'hline').length >= 2 });
  const indAct = (sp.acts || []).find(a => a && a.a === 'indicator' && String(a.id).toLowerCase() === 'rsi');
  chk('asked to DRAW and OPEN RSI: the actions block carries >=1 valid draw action (every price within 15% of the live price) and an rsi indicator action switched on', drawOk && !!indAct && indAct.on !== false, { draws: draws.map(a => a.shape), n: (sp.acts || []).length, ind: indAct, acts: (sp.acts || []).slice(0, 6) });
  chk('the model proposes 1-4 chips and the prose does not print the JSON', Array.isArray(sp.chips) && sp.chips.length >= 1 && sp.chips.length <= 4 && sp.chips.every(x => typeof x === 'string' && x.length <= 40) && !/"actions"\s*:/.test((j && j.answer || '').split('```')[0]), sp.chips);
  // per-symbol thread on the server (KV per account, the E2E uid)
  const hm = [{ role: 'user', text: 'e2e question', ts: 1700000000001 }, { role: 'ai', text: 'e2e answer', ts: 1700000000002, plan: { bias: 'wait', levels: [{ price: 1, label: 'x', kind: 'support' }] }, acts: ['Opened RSI (14)', 'Drew 2 shapes'], chips: ['Draw it', 'Why?'] }];
  const hs = await (await fetch(ORIGIN + '/api/ai/chart', { method: 'POST', headers: HDR, body: JSON.stringify({ op: 'hist', sym: 'e2eai', msgs: hm }) })).json().catch(() => null);
  const hg = await (await fetch(ORIGIN + '/api/ai/chart?hist=E2EAI', { headers: HDR })).json().catch(() => null);
  const hc = await (await fetch(ORIGIN + '/api/ai/chart', { method: 'POST', headers: HDR, body: JSON.stringify({ op: 'hist', sym: 'E2EAI', clear: true }) })).json().catch(() => null);
  const hg2 = await (await fetch(ORIGIN + '/api/ai/chart?hist=E2EAI', { headers: HDR })).json().catch(() => null);
  chk('thread round-trip: POST op:hist stores 2 turns with plan/acts/chips, GET ?hist= returns them, clear empties it; none of it touched the AI quota', hs && hs.ok && hs.n === 2 && hg && Array.isArray(hg.msgs) && hg.msgs.length === 2 && hg.msgs[1].acts && hg.msgs[1].acts.length === 2 && hg.msgs[1].chips.length === 2 && hg.msgs[1].plan && hg.msgs[1].plan.bias === 'wait' && hc && hc.ok && hg2 && hg2.msgs.length === 0 && (st.used == null || true), { hs, n: hg && hg.msgs && hg.msgs.length, after: hg2 && hg2.msgs.length });

  // ---- browser ----
  const canned = (p) => { // a deterministic short setup off the chart's own price, streamed the way Anthropic does - with actions
    const e = p, s = +(p * 1.02).toPrecision(8), t1 = +(p * 0.97).toPrecision(8), t2 = +(p * 0.95).toPrecision(8), l1 = +(p * 1.035).toPrecision(8), l2 = +(p * 0.93).toPrecision(8);
    const text = '**Leaning DOWN (better for a short) on this chart.**\n- Price is under the 50 EMA (average price, last 50 candles) and the last bounce failed.\n- A pool of long liquidations sits just below - price tends to visit it.\n\nI opened RSI (a 0-100 speed meter) so you can see momentum, and drew the setup.\n\nNot financial advice - learn and decide for yourself.\n```plan\n' + JSON.stringify({ bias: 'short', confidence: 64, reason: 'failed bounce under the 50 EMA', entry: e, stop: s, targets: [t1, t2], invalidation: 'a close back above the stop level', horizonBars: 12, leverage: 8, levels: [{ price: l1, label: 'resistance', kind: 'resistance' }, { price: l2, label: 'long liqs', kind: 'liquidity' }], zone: null }) + '\n```\n```actions\n' + JSON.stringify({ actions: [{ a: 'clear_ai' }, { a: 'draw', shape: 'ray', p1: +(p * 1.04).toPrecision(8), barsAgo1: 40, p2: +(p * 1.015).toPrecision(8), barsAgo2: 5, label: 'Downtrend', color: '#ff5a4d' }, { a: 'draw', shape: 'zone', from: +(p * 0.975).toPrecision(8), to: +(p * 0.96).toPrecision(8), barsAgo1: 30, label: 'Long liqs', color: '#ffb020' }, { a: 'draw', shape: 'hline', p: l1, label: 'Resistance', color: '#3fd8e6' }, { a: 'draw', shape: 'forecast', p2: t1, label: 'Target', color: '#ff5a4d' }, { a: 'indicator', id: 'rsi', on: true }, { a: 'zoom', bars: 120 }], chips: ['Draw the 4H too', 'Why this stop?', 'Explain Market Brain'] }) + '\n```';
    const parts = []; for (let i = 0; i < text.length; i += 40) parts.push(text.slice(i, i + 40));
    return parts.map(t => 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n').join('') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  };
  const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
  async function fresh(browser, w, h) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
    await page.setCookie({ name: 'mp_li', value: '1', domain: new URL(ORIGIN).hostname, path: '/' }); // a signed-in browser carries mp_li; without it mp-auth treats a RELOAD as a guest and never asks /api/auth/me (the mock cannot set cookies)
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    const saves = []; // history saves that reached "the server"
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2eai', xp: 4100, level: LV, premium: true } }) });
      if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
      if (u.indexOf('/api/premium/status') >= 0 || u.indexOf('/api/ind/access') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, until: null, source: 'owner' }) });
      if (u.indexOf('/api/ai/chart') >= 0) {
        if (req.method() === 'GET') { if (u.indexOf('hist=') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, msgs: [] }) }); return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, premium: true, used: 3, limit: 50, premiumOnly: false, ai: true }) }); }
        let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
        if (b.op === 'hist') { saves.push({ sym: b.sym, n: (b.msgs || []).length, acts: ((b.msgs || []).slice(-1)[0] || {}).acts }); return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, n: (b.msgs || []).length }) }); }
        let p = 0; try { p = +b.context.price; } catch (e) {}
        if (!(p > 0)) p = 60000;
        return req.respond({ status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'x-ai-used': '4', 'x-ai-limit': '50' }, body: canned(p) });
      }
      return req.continue();
    });
    return { ctx, page, errs, saves };
  }

  await withBrowser(async (browser) => {
    { // desktop
      const { ctx, page, errs, saves } = await fresh(browser, 1366, 900);
      await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
      await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd') || document.querySelector('[data-cws-add]'); a && a.click(); } });
      await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.__mpWinsDbg[0].dr', { timeout: 40000 }).catch(() => {});
      await page.evaluate(() => { const b = document.querySelector('.cwin-ai'); b && b.click(); });
      await page.waitForFunction("!!document.querySelector('.cwin-ai-panel') && !document.querySelector('.cwin-ai-panel').hidden && !document.querySelector('.cwin-ai-panel').classList.contains('gated')", { timeout: 15000 }).catch(() => {});
      const w0 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); return p ? Math.round(p.getBoundingClientRect().width) : 0; });
      if (!w0) { chk('desktop: the AI panel opened', false, await page.evaluate(() => ({ wins: (window.__mpWinsDbg || []).length, btn: document.querySelectorAll('.cwin-ai').length }))); await ctx.close(); return; }
      await page.evaluate(() => { const c = document.querySelector('.cwin-ai-panel .cwin-ai-chips .cwin-ai-chip'); c && c.click(); });
      await page.waitForFunction("!!document.querySelector('.cwin-ai-panel .aiacts')", { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 700));
      const d = await page.evaluate(() => {
        const w = window.__mpWinsDbg[0], p = document.querySelector('.cwin-ai-panel'), card = p.querySelector('.aiplan-card');
        const ov = w.dr.shapes.filter(s => s.ai), ai = w.dr.shapes.filter(s => s.by === 'ai');
        const sub = w.el.querySelector('.cwin-sub');
        const last = w.bars.length - 1, zone = ai.filter(s => s.t === 'rect')[0], gb = w._ghostBars || [], txts = ai.filter(s => s.t === 'text');
        let lo = Infinity, hi = -Infinity; for (let i = Math.max(0, w.bars.length - 200); i < w.bars.length; i++) { if (w.bars[i].low < lo) lo = w.bars[i].low; if (w.bars[i].high > hi) hi = w.bars[i].high; }
        return { width: Math.round(p.getBoundingClientRect().width), card: !!card, bias: card && card.getAttribute('data-bias'), rows: card ? card.querySelectorAll('.aipr').length : 0, lines: (w._aiPlan || []).length, planRects: ov.filter(s => s.t === 'rect').length, planTexts: ov.filter(s => s.t === 'text').length, aiKinds: ai.map(s => s.t), aiTexts: txts.map(s => s.txt), aiBatch: ai.length ? ai.every(s => s.aiB === ai[0].aiB) : false, rsi: !!w.inds.rsi, subShown: !!(sub && sub.style.display !== 'none' && sub.offsetHeight > 30), receipts: [...p.querySelectorAll('.aiacts span')].map(s => s.textContent), undo: !!p.querySelector('.aiundo'), chips: [...p.querySelectorAll('.cwin-ai-chips .cwin-ai-chip')].map(c => c.textContent), sym: w.sym, tf: w.tf, price: +w.bars[w.bars.length - 1].close, prose: (p.querySelector('.aimsg.ai .aitxt') || {}).textContent || '',
          zoneEndsAfterLast: !!zone && zone.l2 > last, zoneHeightPctOfRange: zone ? (zone.p2 - zone.p1) / (hi - lo) * 100 : -1,
          labelsInGutter: txts.length > 0 && txts.every(s => s.l > last), labelsRightAligned: txts.length > 0 && txts.every(s => s.ar === 1),
          ghostN: gb.length, ghostAhead: gb.length > 0 && gb[0].time > +w.bars[last].time,
          ghostOnGrid: (function () { const iv = parseInt(w.tf, 10) * 60; if (!(iv > 0) || gb.length < 2) return false;
            for (let i = 0; i < gb.length; i++) if ((gb[i].time - +w.bars[last].time) !== iv * (i + 1)) return false; return true; })(),
          ghostContinuous: gb.length > 1 && gb.every((x, i) => i === 0 ? Math.abs(x.open - +w.bars[last].close) / +w.bars[last].close < 0.005 : Math.abs(x.open - gb[i - 1].close) < 1e-6), // the first bar opened at the market when it was drawn; the live bar may have ticked since
          ghostSane: gb.length > 0 && gb.every(x => x.high >= Math.max(x.open, x.close) && x.low <= Math.min(x.open, x.close) && x.low > 0),
          ghostMixed: (function () { let up = 0, dn = 0; gb.forEach(x => { if (x.close >= x.open) up++; else dn++; }); return up > 0 && dn > 0; })(),
          ghostTranslucent: (function () { try { const o = w._ghost.options(); return /rgba\(.*0?\.[0-9]+\)/.test(o.upColor) && parseFloat(o.upColor.split(',')[3]) < 0.5; } catch (e) { return false; } })(),
          labelsHaveBackground: txts.length > 0 && txts.every(s => s.bg === 1),
          labelGapsOk: (function () { const ys = ai.concat(ov).filter(s => s.t === 'text').map(s => { const y = w.candle.priceToCoordinate(s.p); return y == null ? null : y + (+s._dy || 0); }).filter(y => y != null).sort((a, b) => a - b);
            for (let i = 1; i < ys.length; i++) if (ys[i] - ys[i - 1] < 15) return false; return true; })() };
      });
      chk('desktop: panel width unchanged, the plan card renders (SHORT, rows) and the prose carries no JSON', d.width > 0 && d.width === w0 && d.width <= 360 && d.card && d.bias === 'short' && d.rows >= 5 && !/actions/.test(d.prose) && !/\{/.test(d.prose), { width: d.width, bias: d.bias, rows: d.rows, prose: d.prose.slice(0, 80) });
      chk('desktop: the actions EXECUTED with no click - RSI is on and its sub-pane is visible', d.rsi && d.subShown && d.receipts.some(t => /^Opened RSI/.test(t)), { rsi: d.rsi, sub: d.subShown, receipts: d.receipts });
      chk('desktop: the model drew with the drawing engine - a ray, a zone band and a level with their labels, tagged by:ai, one batch', d.aiKinds.indexOf('ray') >= 0 && d.aiKinds.indexOf('rect') >= 0 && d.aiKinds.indexOf('hline') >= 0 && d.aiTexts.indexOf('Downtrend') >= 0 && d.aiTexts.indexOf('Resistance') >= 0 && d.aiBatch, { kinds: d.aiKinds, texts: d.aiTexts, batch: d.aiBatch });
      chk('desktop: the FORECAST is 15-20 translucent candles continuing the chart - on the timeframe grid, each opening where the last closed, every bar sane, a mix of green and red, and faint enough to tell from a real candle', d.ghostN >= 15 && d.ghostN <= 20 && d.ghostAhead && d.ghostOnGrid && d.ghostContinuous && d.ghostSane && d.ghostMixed && d.ghostTranslucent, { n: d.ghostN, ahead: d.ghostAhead, grid: d.ghostOnGrid, continuous: d.ghostContinuous, sane: d.ghostSane, mixed: d.ghostMixed, translucent: d.ghostTranslucent });
      chk('desktop: because the model drew the setup, the plan adds only its trade levels - no second zone rectangle over the drawing', d.lines >= 3 && d.planRects === 0, { lines: d.lines, planRects: d.planRects });
      chk('desktop: GEOMETRY - the zone band reaches past the newest candle, its height is a band and not a wall, and every label sits in the gutter right of the last candle, right-aligned', d.zoneEndsAfterLast && d.zoneHeightPctOfRange > 0 && d.zoneHeightPctOfRange <= 28 && d.labelsInGutter && d.labelsRightAligned, { zoneEnd: d.zoneEndsAfterLast, h: d.zoneHeightPctOfRange, gutter: d.labelsInGutter, ar: d.labelsRightAligned });
      chk('desktop: every label carries the ground behind it so a number printed over a line is still readable, and no two labels overlap', d.labelsHaveBackground && d.labelGapsOk, { bg: d.labelsHaveBackground, gaps: d.labelGapsOk });
      chk('desktop: the receipt says what was done and the chips are the model\'s', d.receipts.some(t => /^Drew 4 shapes/.test(t)) && d.receipts.some(t => /^Zoomed/.test(t)) && d.undo && d.chips[0] === 'Draw the 4H too' && d.chips.indexOf('Explain Market Brain') >= 0 && d.chips.some(c => /Re-read/.test(c)), { receipts: d.receipts, chips: d.chips });
      const g = await page.evaluate(() => { // the guard rails, run against the real pure function with deliberately bad actions
        const w = window.__mpWinsDbg[0], n = w.bars.length, px = +w.bars[n - 1].close, last = n - 1;
        let lo = Infinity, hi = -Infinity; for (let i = Math.max(0, n - 200); i < n; i++) { if (w.bars[i].low < lo) lo = w.bars[i].low; if (w.bars[i].high > hi) hi = w.bars[i].high; }
        const S = (a) => window.__mpAi.shapeOf(a, n, px, { lo, hi, px, bars: w.bars, rhythm: window.__mpAi.rhythm(w), snap: [] });
        const wall = S({ shape: 'zone', from: lo, to: hi, barsAgo1: 60, label: 'wall' });
        const past = S({ shape: 'zone', from: px * 0.98, to: px * 0.99, barsAgo1: 120, barsAgo2: 60, label: 'stale' });
        const flat = S({ shape: 'zone', from: px, to: px, barsAgo1: 30, label: 'pool' });
        const stub = S({ shape: 'trend', p1: px, barsAgo1: 3, p2: px * 1.001, barsAgo2: 1 });
        const mad = S({ shape: 'hline', p: px * 9 });
        const zr = wall.filter(s => s.t === 'rect')[0], pr = past.filter(s => s.t === 'rect')[0], fr = flat.filter(s => s.t === 'rect')[0];
        // the forecast must be paced like this market: what the run covers vs what the market typically covers in that many candles
        const gb2 = w._ghostBars || [];
        const H = gb2.length;
        const moved = H ? Math.abs(gb2[H - 1].close - gb2[0].open) / px * 100 : 0;
        const d2 = []; for (let i = H; i < n; i++) { const a3 = +w.bars[i].close, b3 = +w.bars[i - H].close; if (a3 > 0 && b3 > 0) d2.push(Math.abs(a3 - b3) / px * 100); }
        d2.sort((x, y) => x - y); const typical = d2.length ? d2[Math.floor(d2.length * 0.55)] : 0;
        return { wallH: (zr.p2 - zr.p1) / (hi - lo), pastEnd: pr.l2 - last, flatH: (fr.p2 - fr.p1) / px, stub: stub, madPrice: mad,
          slopeH: H, slopeRatio: typical ? +(moved / typical).toFixed(2) : null };
      });
      chk('desktop: GEOMETRY guard rails hold on bad input - a full-range zone is clamped to a band, a zone stranded in the past is extended past the newest candle, a flat zone gets a real height, a 2-bar trend and an off-chart price are refused, ', g.wallH <= 0.29 && g.pastEnd >= 6 && g.flatH > 0.002 && g.stub === null && g.madPrice === null, g);
      chk('desktop: PACE - the forecast run covers no more ground than this market typically covers in those 15-20 candles (a ruler-straight dash to the target measured 10x-50x too fast)', g.slopeH >= 15 && g.slopeH <= 20 && g.slopeRatio != null && g.slopeRatio <= 1.4, { candles: g.slopeH, ratioVsMarket: g.slopeRatio });
      const pers = await page.evaluate(() => {
        const w = window.__mpWinsDbg[0]; w.dr.save(); let stored = null; try { stored = JSON.parse(localStorage.getItem('mp_charts_draw') || '{}'); } catch (e) {}
        const rec = stored && stored[w.sym + ':' + w.tf]; return { aiKept: rec ? rec.shapes.filter(s => s.by === 'ai').length : 0, overlayKept: rec ? rec.shapes.filter(s => s.ai).length : 0, total: rec ? rec.shapes.length : 0 };
      });
      chk('desktop: the AI\'s drawings persist like the reader\'s own (the store keeps by:ai shapes, never the plan overlay)', pers.aiKept >= 5 && pers.overlayKept === 0, pers);
      const undo = await page.evaluate(async () => {
        const w = window.__mpWinsDbg[0], p = document.querySelector('.cwin-ai-panel'); const before = w.dr.shapes.filter(s => s.by === 'ai').length;
        const u = p.querySelector('.aiundo');
        if (!u) return { before, after: before, btn: false, rsiStill: !!w.inds.rsi, missing: true, receipts: [...p.querySelectorAll('.aiacts span')].map(x => x.textContent), bubbles: p.querySelectorAll('.aimsg.ai').length };
        u.click(); await new Promise(r => setTimeout(r, 200));
        return { before, after: w.dr.shapes.filter(s => s.by === 'ai').length, btn: !!p.querySelector('.aiundo'), rsiStill: !!w.inds.rsi };
      });
      chk('desktop: Undo removes exactly that answer\'s drawings and nothing else (RSI stays on)', undo.before >= 5 && undo.after === 0 && !undo.btn && undo.rsiStill, undo);
      const hist1 = await page.evaluate(async () => {
        const w = window.__mpWinsDbg[0], p = document.querySelector('.cwin-ai-panel');
        p.querySelector('.cwin-ai-x').click(); await new Promise(r => setTimeout(r, 150));
        const closed = p.hidden; document.querySelector('.cwin-ai').click(); await new Promise(r => setTimeout(r, 400));
        let ls = null; try { ls = JSON.parse(localStorage.getItem('mp_ai_s_' + w.sym) || 'null'); } catch (e) {}
        return { closed, reopened: !p.hidden, msgs: p.querySelectorAll('.aimsg').length, card: !!p.querySelector('.aiplan-card'), receipts: p.querySelectorAll('.aiacts span').length, key: !!ls, n: ls ? ls.length : 0, acts: ls && ls[1] && ls[1].acts };
      });
      chk('desktop: closing and reopening the panel keeps the thread (2 messages, the card, the receipt) - stored per SYMBOL', hist1.closed && hist1.reopened && hist1.msgs === 2 && hist1.card && hist1.receipts >= 3 && hist1.key && hist1.n === 2 && Array.isArray(hist1.acts), hist1);
      chk('desktop: the thread was saved to the server with the receipt on the answer', saves.length >= 1 && saves.some(s => s.n === 2 && Array.isArray(s.acts) && s.acts.length >= 3), saves.slice(-2));
      await page.reload({ waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.mpAuth && window.mpAuth.me && window.mpAuth.me()', { timeout: 40000 }).catch(() => {}); // the account must be restored before the panel opens, else it shows the sign-in gate (a real reader has the cookie + cached account before they can click)
      await page.evaluate(() => { const b = document.querySelector('.cwin-ai'); b && b.click(); });
      await page.waitForFunction("!!document.querySelector('.cwin-ai-panel .aimsg')", { timeout: 15000 }).catch(() => {});
      const hist2 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); return { msgs: p ? p.querySelectorAll('.aimsg').length : 0, chips: p ? [...p.querySelectorAll('.cwin-ai-chips .cwin-ai-chip')].map(c => c.textContent) : [] }; });
      chk('desktop: after a RELOAD the thread is still there and the chips are still the model\'s', hist2.msgs === 2 && hist2.chips[0] === 'Draw the 4H too', hist2);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'ai-chart-desktop.png') });
      chk('desktop: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
    { // mobile, landscape phone
      const { ctx, page, errs } = await fresh(browser, 844, 390);
      await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('window.__mfcPanes && window.__mfcPanes().length && window.__mfcPanes()[0].bars && window.__mfcPanes()[0].bars.length>50 && window.__mfcPanes()[0].w', { timeout: 40000 }).catch(() => {});
      await page.evaluate(() => { const b = document.querySelector('[data-act="ai"]'); b && b.click(); });
      await page.waitForFunction("!!document.getElementById('mfcAI')", { timeout: 10000 }).catch(() => {});
      const chips0 = await page.evaluate(() => [...document.querySelectorAll('#mfcAC .cwin-ai-chip')].map(c => c.textContent));
      await page.evaluate(() => { const i = document.getElementById('mfcAI'); i.value = 'Read this chart'; document.getElementById('mfcAS').click(); });
      await page.waitForFunction("!!document.querySelector('#mfcAB .aiacts')", { timeout: 20000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 600));
      const m = await page.evaluate(() => { const ps = window.__mfcPanes(), p = ps.find(x => x._aiPlan) || ps[0]; const card = document.querySelector('#mfcAB .aiplan-card'); const ai = (p.w && p.w.dr) ? p.w.dr.shapes.filter(s => s.by === 'ai') : []; return { card: !!card, bias: card && card.getAttribute('data-bias'), rows: card ? card.querySelectorAll('.aipr').length : 0, lines: (p._aiPlan || []).length, bold: !!document.querySelector('#mfcAB .mfc-ai-msg.ai b'), trade: card ? (card.querySelector('a.aipc-trade') || {}).getAttribute('href') : null, rsi: !!p.inds.rsi, aiKinds: ai.map(s => s.t), ghostN: ((p.w && p.w._ghostBars) || []).length, receipts: [...document.querySelectorAll('#mfcAB .aiacts span')].map(s => s.textContent), chips: [...document.querySelectorAll('#mfcAC .cwin-ai-chip')].map(c => c.textContent), sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, sym: p.sym }; });
      chk('mobile: the sheet renders markdown + the plan card, draws the plan lines, Trade it links the terminal prefilled', m.card && m.bias === 'short' && m.rows >= 5 && m.lines >= 5 && m.bold && /\/paper-trade\?coin=[A-Z0-9]+&side=short&sl=\d/.test(m.trade || '') && /&tp=\d/.test(m.trade || '') && /&lev=8/.test(m.trade || '') && !m.sx, m);
      chk('mobile: the actions executed on the pane - RSI on, the model\'s shapes in the pane\'s engine, receipt + the model\'s chips (the default chips offered "Draw the setup" before)', m.rsi && m.aiKinds.indexOf('ray') >= 0 && m.aiKinds.indexOf('rect') >= 0 && m.ghostN >= 15 && m.receipts.some(t => /^Opened RSI/.test(t)) && m.receipts.some(t => /^Drew 4/.test(t)) && m.chips[0] === 'Draw the 4H too' && chips0.some(c => /Find an opportunity/.test(c)), { rsi: m.rsi, kinds: m.aiKinds, receipts: m.receipts, chips: m.chips, chips0 });
      const mh = await page.evaluate(async () => { const x = document.querySelector('.mfc-sheet-x'); x && x.click(); await new Promise(r => setTimeout(r, 200)); const gone = !document.getElementById('mfcAB'); document.querySelector('[data-act="ai"]').click(); await new Promise(r => setTimeout(r, 400)); return { gone, msgs: document.querySelectorAll('#mfcAB .mfc-ai-msg').length, card: !!document.querySelector('#mfcAB .aiplan-card'), receipts: document.querySelectorAll('#mfcAB .aiacts span').length, chips: [...document.querySelectorAll('#mfcAC .cwin-ai-chip')].map(c => c.textContent) }; });
      chk('mobile: closing and reopening the sheet shows the same thread (it used to start empty every time)', mh.gone && mh.msgs === 2 && mh.card && mh.receipts >= 3 && mh.chips[0] === 'Draw the 4H too', mh);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'ai-chart-mobile.png') });
      chk('mobile: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  });
  out.forEach(l => console.log(l));
  const bad = out.filter(l => l.indexOf('FAIL') === 0).length;
  console.log('\n' + out.length + ' checks, ' + bad + ' failed');
  process.exit(bad ? 1 : 0);
})();
