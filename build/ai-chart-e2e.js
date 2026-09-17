/* Ask AI on /charts - the step-up of 2026-09-17 (owner: "da crta na chartu analizu i da pokaze korisniku sta je target",
   "interaktivnije, ali nikako da ne oduzimamo prostora").

   Proven on production:
     worker: GET status shape; ONE real model call through the E2E hook (admin key + x-mp-e2e) on a live BTC brief -
       the answer ends with the disclaimer, ALWAYS carries a ```plan block that parses, bias is long/short/wait, and a
       long/short plan's entry/stop/targets sit within 15% of the live price with the stop on the correct side
     desktop /charts (member + Premium simulated, the model replaced by a canned stream built from the chart's own price):
       the panel keeps its 360px width, the answer renders the plan card (bias, R:R, rows), the plan is drawn the moment
       it lands - price lines on the candle series AND risk/reward zones + labels in the drawing engine flagged ai -
       a card row flashes a level without error, On chart toggles the drawing off and on, the drawing store never
       persists the ai shapes, Trade it opens the quick-trade ticket prefilled with side/stop/target/leverage on the
       window's symbol, follow-up chips become plan-aware
     mobile /charts (landscape phone): the sheet renders markdown + the plan card, draws the lines on the pane, and
       Trade it links the terminal with coin/side/sl/tp/lev

   Run: node build/ai-chart-e2e.js
*/
const fs = require('fs');
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = process.env.MP_ORIGIN || 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split(/\r?\n/)[1].trim();
const out = []; const chk = (n, ok, x) => out.push((ok ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? ' ' + JSON.stringify(x).slice(0, 260) : ''));
const splitPlan = (t) => { const re = /```[a-zA-Z]*\s*([\s\S]*?)```/g; let m, plan = null; while ((m = re.exec(t))) { const b = m[1].trim(); if (b[0] === '{') { try { plan = JSON.parse(b); } catch (e) {} } } return plan; };

(async () => {
  // ---- worker ----
  const st = await (await fetch(ORIGIN + '/api/ai/chart')).json();
  chk('GET status carries signedIn/premium/limit/ai', st && typeof st.signedIn === 'boolean' && typeof st.premium === 'boolean' && 'limit' in st && st.ai === true, st);
  const px = await (await fetch(ORIGIN + '/api/price?symbol=BTC')).json();
  const kl = await (await fetch(ORIGIN + '/api/klines?symbol=BTC&interval=60')).json();
  const bars = (Array.isArray(kl) ? kl : (kl.data || [])).slice(-150), c = bars.map(b => +b.close), price = +px.price || c[c.length - 1];
  const hi = Math.max(...bars.slice(-90).map(b => +b.high)), lo = Math.min(...bars.slice(-90).map(b => +b.low));
  const brief = { symbol: 'BTC', timeframe: '1-hour', barsLoaded: bars.length, price, lastBarChangePct: +((c[c.length - 1] / c[c.length - 2] - 1) * 100).toFixed(2), changePctOver150Bars: +((price / c[0] - 1) * 100).toFixed(2), loadedHigh: hi, loadedLow: lo, recentSwingHigh: hi, recentSwingLow: lo, distToSwingHighPct: +((price - hi) / hi * 100).toFixed(2), distToSwingLowPct: +((price - lo) / lo * 100).toFixed(2), rsi14: 52.3, rsiState: 'neutral', atrPct: 0.6, recentCloses: c.slice(-24), liquidationPools: { above: [{ price: +(price * 1.02).toFixed(0), distPct: 2, sizeUsd: 41000000, side: 'short liquidations' }], below: [{ price: +(price * 0.982).toFixed(0), distPct: -1.8, sizeUsd: 38000000, side: 'long liquidations' }] } };
  const t0 = Date.now();
  const r = await fetch(ORIGIN + '/api/ai/chart', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' }, body: JSON.stringify({ context: brief, question: 'Read this chart for me and give me the plan.', stream: false, lang: 'en' }) });
  const j = await r.json().catch(() => null); const ms = Date.now() - t0;
  const plan = j && j.answer ? splitPlan(j.answer) : null;
  chk('POST (real model, E2E hook): 200, answer ends with the disclaimer, a plan block parses, bias is long/short/wait', r.status === 200 && j && /Not financial advice/.test(j.answer || '') && plan && /^(long|short|wait)$/.test(String(plan.bias)), { status: r.status, ms, bias: plan && plan.bias, used: j && j.used, err: j && j.error, head: (j && j.answer || '').slice(0, 120) });
  if (plan && (plan.bias === 'long' || plan.bias === 'short')) {
    const near = v => v > 0 && Math.abs(v - price) / price < 0.15;
    const sideOk = plan.bias === 'long' ? (plan.stop < plan.entry && (plan.targets || [])[0] > plan.entry) : (plan.stop > plan.entry && (plan.targets || [])[0] < plan.entry);
    chk('a directional plan has entry/stop/targets near the live price, stop and target on the right side, confidence + invalidation', near(+plan.entry) && near(+plan.stop) && (plan.targets || []).every(t => near(+t)) && sideOk && +plan.confidence > 0 && !!plan.invalidation, { entry: plan.entry, stop: plan.stop, targets: plan.targets, conf: plan.confidence, lev: plan.leverage, inv: (plan.invalidation || '').slice(0, 80) });
  } else {
    chk('a wait plan still names levels to watch', plan && (plan.levels || []).length >= 2, plan && plan.levels);
  }

  // ---- browser ----
  const canned = (p) => { // a deterministic short setup off the chart's own price, streamed the way Anthropic does
    const e = p, s = +(p * 1.02).toPrecision(8), t1 = +(p * 0.97).toPrecision(8), t2 = +(p * 0.95).toPrecision(8), l1 = +(p * 1.035).toPrecision(8), l2 = +(p * 0.93).toPrecision(8);
    const text = '**Leaning DOWN (better for a short) on this chart.**\n- Price is under the 50 EMA (average price, last 50 candles) and the last bounce failed.\n- A pool of long liquidations sits just below - price tends to visit it.\n\nNot financial advice - learn and decide for yourself.\n```plan\n' + JSON.stringify({ bias: 'short', confidence: 64, reason: 'failed bounce under the 50 EMA', entry: e, stop: s, targets: [t1, t2], invalidation: 'a close back above the stop level', horizonBars: 12, leverage: 8, levels: [{ price: l1, label: 'resistance', kind: 'resistance' }, { price: l2, label: 'long liqs', kind: 'liquidity' }], zone: null }) + '\n```';
    const parts = []; for (let i = 0; i < text.length; i += 40) parts.push(text.slice(i, i + 40));
    return parts.map(t => 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n').join('') + 'event: message_stop\ndata: {"type":"message_stop"}\n\n';
  };
  const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
  async function fresh(browser, w, h) {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: w, height: h, isMobile: w < 900, hasTouch: w < 900 });
    const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/auth/me') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'e2eai', xp: 4100, level: LV, premium: true } }) });
      if (u.indexOf('/api/auth/xp') >= 0 && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
      if (u.indexOf('/api/premium/status') >= 0 || u.indexOf('/api/ind/access') >= 0) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, until: null, source: 'owner' }) });
      if (u.indexOf('/api/ai/chart') >= 0) {
        if (req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, premium: true, used: 3, limit: 50, premiumOnly: false, ai: true }) });
        let p = 0; try { p = +JSON.parse(req.postData() || '{}').context.price; } catch (e) {}
        if (!(p > 0)) p = 60000;
        return req.respond({ status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'x-ai-used': '4', 'x-ai-limit': '50' }, body: canned(p) });
      }
      return req.continue();
    });
    return { ctx, page, errs };
  }

  await withBrowser(async (browser) => {
    { // desktop
      const { ctx, page, errs } = await fresh(browser, 1366, 900);
      await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      // a fresh profile lands on the empty workspace (no persisted layout): add the first window the way a reader would
      await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
      await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd') || document.querySelector('[data-cws-add]'); a && a.click(); } });
      await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.__mpWinsDbg[0].dr', { timeout: 40000 }).catch(() => {});
      await page.evaluate(() => { const b = document.querySelector('.cwin-ai'); b && b.click(); });
      await page.waitForFunction("!!document.querySelector('.cwin-ai-panel') && !document.querySelector('.cwin-ai-panel').hidden && !document.querySelector('.cwin-ai-panel').classList.contains('gated')", { timeout: 15000 }).catch(() => {});
      const w0 = await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); return p ? Math.round(p.getBoundingClientRect().width) : 0; });
      if (!w0) { chk('desktop: the AI panel opened', false, await page.evaluate(() => ({ wins: (window.__mpWinsDbg || []).length, btn: document.querySelectorAll('.cwin-ai').length }))); await ctx.close(); return; }
      await page.evaluate(() => { const c = document.querySelector('.cwin-ai-panel .cwin-ai-chip[data-q=""]'); c && c.click(); });
      await page.waitForFunction("!!document.querySelector('.cwin-ai-panel .aiplan-card')", { timeout: 20000 }).catch(() => {});
      const d = await page.evaluate(() => {
        const w = window.__mpWinsDbg[0], p = document.querySelector('.cwin-ai-panel'), card = p.querySelector('.aiplan-card');
        const ai = w.dr.shapes.filter(s => s.ai);
        return { width: Math.round(p.getBoundingClientRect().width), card: !!card, bias: card && card.getAttribute('data-bias'), rows: card ? card.querySelectorAll('.aipr').length : 0, rr: card ? (card.querySelector('.aipc-rr') || {}).textContent : '', lines: (w._aiPlan || []).length, aiShapes: ai.length, rects: ai.filter(s => s.t === 'rect').length, texts: ai.filter(s => s.t === 'text').map(s => s.txt), on: !!card && !!card.querySelector('.aipc-on.on'), chips: [...p.querySelectorAll('.cwin-ai-chips .cwin-ai-chip')].map(c => c.textContent), sym: w.sym, price: +w.bars[w.bars.length - 1].close };
      });
      chk('desktop: the panel width is unchanged and the answer renders a plan card (SHORT, rows, R:R)', d.width > 0 && d.width === w0 && d.width <= 360 && d.card && d.bias === 'short' && d.rows >= 5 && /R:R \d/.test(d.rr), { width: d.width, w0, bias: d.bias, rows: d.rows, rr: d.rr });
      chk('desktop: the plan is drawn the moment it lands - price lines + risk/reward rects + labels in the drawing engine, flagged ai', d.lines >= 5 && d.rects === 2 && d.texts.some(t => /^STOP/.test(t)) && d.texts.some(t => /^TP1/.test(t)) && d.texts.some(t => /^R:R/.test(t)) && d.on, { lines: d.lines, rects: d.rects, texts: d.texts, on: d.on });
      chk('desktop: follow-up chips became plan-aware', d.chips.some(c => /Why this stop/.test(c)) && d.chips.some(c => /kills it/.test(c)), d.chips);
      const tg = await page.evaluate(async () => {
        const w = window.__mpWinsDbg[0], p = document.querySelector('.cwin-ai-panel');
        p.querySelector('.aipr').click(); await new Promise(r => setTimeout(r, 100));
        p.querySelector('.aipc-on').click(); await new Promise(r => setTimeout(r, 150));
        const off = { lines: (w._aiPlan || []).length, ai: w.dr.shapes.filter(s => s.ai).length, btn: p.querySelector('.aipc-on').textContent };
        p.querySelector('.aipc-on').click(); await new Promise(r => setTimeout(r, 150));
        const on = { lines: (w._aiPlan || []).length, ai: w.dr.shapes.filter(s => s.ai).length };
        w.dr.save(); let stored = null; try { stored = JSON.parse(localStorage.getItem('mp_charts_draw') || '{}'); } catch (e) {}
        const rec = stored && stored[w.sym + ':' + w.tf]; const persistedAi = rec ? rec.shapes.filter(s => s.ai).length : 0;
        return { off, on, persistedAi, userShapesKept: rec ? rec.shapes.length : 0 };
      });
      chk('desktop: On chart toggles the drawing off (0 lines, 0 ai shapes) and on again; the drawing store never keeps ai shapes', tg.off.lines === 0 && tg.off.ai === 0 && /Show/.test(tg.off.btn) && tg.on.lines >= 5 && tg.on.ai >= 3 && tg.persistedAi === 0, tg);
      const qt = await page.evaluate(async () => {
        const p = document.querySelector('.cwin-ai-panel'); p.querySelector('.aipc-trade').click(); await new Promise(r => setTimeout(r, 300));
        const m = document.querySelector('.cqt-modal'); if (!m) return { modal: false };
        return { modal: !m.hidden, side: (m.querySelector('.cqt-side button.on') || {}).getAttribute('data-side'), sym: m.querySelector('.cqt-sym').value, sl: +m.querySelector('.cqt-sl').value, tp: +m.querySelector('.cqt-tp').value, adv: !m.querySelector('.cqt-adv-fields').hidden, lev: (m.querySelector('.cqt-levv') || {}).textContent, msg: (m.querySelector('.cqt-msg') || {}).textContent };
      });
      chk('desktop: Trade it opens the quick-trade ticket prefilled - short, the window symbol, stop above and target below the price, 8x, a check-the-numbers note', qt.modal && qt.side === 'short' && qt.sym === d.sym && qt.sl > d.price && qt.tp > 0 && qt.tp < d.price && qt.adv && /8/.test(qt.lev || '') && /AI plan/.test(qt.msg || ''), qt);
      await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'ai-chart-desktop.png') });
      chk('desktop: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
    { // mobile, landscape phone
      const { ctx, page, errs } = await fresh(browser, 844, 390);
      await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await page.waitForFunction('window.__mfcPanes && window.__mfcPanes().length && window.__mfcPanes()[0].bars && window.__mfcPanes()[0].bars.length>50', { timeout: 40000 }).catch(() => {});
      await page.evaluate(() => { const b = document.querySelector('[data-act="ai"]'); b && b.click(); });
      await page.waitForFunction("!!document.getElementById('mfcAI')", { timeout: 10000 }).catch(() => {});
      await page.evaluate(() => { const i = document.getElementById('mfcAI'); i.value = 'Read this chart'; document.getElementById('mfcAS').click(); });
      await page.waitForFunction("!!document.querySelector('#mfcAB .aiplan-card')", { timeout: 20000 }).catch(() => {});
      const m = await page.evaluate(() => { const ps = window.__mfcPanes(), p = ps.find(x => x._aiPlan) || ps[0]; const card = document.querySelector('#mfcAB .aiplan-card'); return { card: !!card, bias: card && card.getAttribute('data-bias'), rows: card ? card.querySelectorAll('.aipr').length : 0, lines: (p._aiPlan || []).length, bold: !!document.querySelector('#mfcAB .mfc-ai-msg.ai b'), trade: card ? (card.querySelector('a.aipc-trade') || {}).getAttribute('href') : null, sx: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 }; });
      chk('mobile: the sheet renders markdown + the plan card, draws the lines on the pane, Trade it links the terminal prefilled', m.card && m.bias === 'short' && m.rows >= 5 && m.lines >= 5 && m.bold && /\/paper-trade\?coin=[A-Z0-9]+&side=short&sl=\d/.test(m.trade || '') && /&tp=\d/.test(m.trade || '') && /&lev=8/.test(m.trade || '') && !m.sx, m);
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
