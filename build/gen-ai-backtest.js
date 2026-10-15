/* ASK AI, REPLAYED INTO THE PAST AND SETTLED AGAINST WHAT HAPPENED (2026-10-15, owner: "mozemo da prikazemo kao
   rezultat sta se stvarno desilo sa cenom ako je nas AI to lepo analizirao ... probaj istorijski da ga testiras").

   The six live reads on /premium/ (captured 2026-10-10) were settled on 2026-10-15 against real candles: six of six
   reached their entry and hit the stop before the first target. A section built on those is an advertisement against
   the product. So this harness asks the SAME model, through the SAME client, the SAME questions - but on a chart REWOUND
   with the product's own bar replay to a pseudo-random moment in the loaded history. The brief it builds sees only the
   candles up to that moment (the worker skips its live blocks when `replay:true` rides on the E2E path), the answer is
   replayed through the real client so the chart draws it with the code a member runs, and then the read is SETTLED
   against the candles that followed - which are already in the browser, in the replay's own array - with the rule
   checkAiCalls uses: the entry has to be reached from the right side; after that the FIRST of target-1 / stop decides;
   both inside one candle is unclear; an entry never reached inside 3x the horizon is a no-fill.

   Two captures per read: the chart at the moment of the read with the drawing on it, and - for a read that resolved -
   the same chart a few candles past the resolution, the plan lines still on it. Both at 1040x680 from a 2x render, plus
   a phone zoom each. build/data/ai-backtest-report.json carries every read, win or lose, and the aggregate; the page
   section is built FROM that file and may hide nothing (gen-premium-backtest.js).

   The moments are chosen by a hash of (sym, tf, seed), not by hand - the point is that nobody picked them.

   node build/gen-ai-backtest.js                 all 24 (8 coins x 3 timeframes)
   node build/gen-ai-backtest.js BTC ETH         only these coins
   node build/gen-ai-backtest.js --seed 2        a different set of moments
*/
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
const OUT = path.join(__dirname, '..', 'dist', 'assets', 'plus', 'bt');
const REPORT = path.join(__dirname, 'data', 'ai-backtest-report.json');
const W = 1040, H = 680, Q = 0.84;
const argv = process.argv.slice(2);
const SEED = (() => { const i = argv.indexOf('--seed'); return i >= 0 ? String(argv[i + 1] || '1') : '1'; })();
const want = argv.filter(a => /^[A-Z0-9]{2,10}$/i.test(a)).map(a => a.toUpperCase());

const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'LINK', 'DOGE', 'BNB', 'AVAX'];
const TFS = ['15', '60', '240'];
const QS = [
  'Read this chart and draw the setup on it.',
  'Find me an opportunity here and draw it on the chart.',
  'Where would you enter, and where does the stop go? Draw it.',
  'Mark the structure and the levels that actually matter here.',
  'Show me where the liquidation pools sit and what they mean for a trade.',
  'Is there anything worth taking here right now? Draw your answer.',
];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
const sse = (text) => { const parts = []; for (let i = 0; i < text.length; i += 60) parts.push(text.slice(i, i + 60));
  return parts.map(t => 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n').join('')
    + 'event: message_stop\ndata: {"type":"message_stop"}\n\n'; };

/* the settlement, pure - run in node over the bars the browser handed back */
function settle(plan, bars, i0, lastClose) {
  const p = plan || {}; const e = +p.entry, st = +p.stop, tg = (p.targets || []).map(Number).filter(v => v > 0);
  if (!(e > 0 && st > 0 && tg[0] > 0)) return { outcome: 'noplan' };
  const side = st < e ? 'long' : 'short', dir = side === 'long' ? 1 : -1;
  const needsDown = e < lastClose; // entry below the price at the time: reached when a low gets down to it
  const horizon = Math.max(10, +p.horizonBars || 30), maxFill = Math.min(120, horizon * 3), maxRes = 400;
  let fillIdx = null, res = 'open', resIdx = null, mfe = 0, mae = 0;
  for (let i = i0; i < bars.length; i++) {
    const b = bars[i];
    if (fillIdx == null) {
      if (i - i0 > maxFill) { res = 'nofill'; break; }
      const hit = needsDown ? b.low <= e : b.high >= e; if (hit) fillIdx = i; continue;
    }
    if (i - fillIdx > maxRes) break;
    const hitT = side === 'long' ? b.high >= tg[0] : b.low <= tg[0], hitS = side === 'long' ? b.low <= st : b.high >= st;
    mfe = Math.max(mfe, dir * ((side === 'long' ? b.high : b.low) - e) / e * 100); mae = Math.min(mae, dir * ((side === 'long' ? b.low : b.high) - e) / e * 100);
    if (hitT && hitS) { res = 'unclear'; resIdx = i; break; }
    if (hitT) { res = 'win'; resIdx = i; break; }
    if (hitS) { res = 'loss'; resIdx = i; break; }
  }
  if (fillIdx == null && res === 'open') res = 'nofill';
  const rr = Math.abs(tg[0] - e) / Math.abs(e - st);
  const t = (i) => (i == null ? null : new Date((+bars[i].time > 1e12 ? +bars[i].time : +bars[i].time * 1000)).toISOString());
  return { outcome: res, side, entry: e, stop: st, target: tg[0], rr: +rr.toFixed(2), fillIdx, resIdx, fillAt: t(fillIdx), resolvedAt: t(resIdx),
    barsToFill: fillIdx == null ? null : fillIdx - i0, barsToResolve: resIdx == null ? null : resIdx - fillIdx,
    movePct: res === 'win' ? +(dir * (tg[0] - e) / e * 100).toFixed(2) : res === 'loss' ? +(dir * (st - e) / e * 100).toFixed(2) : null,
    mfePct: +mfe.toFixed(2), maePct: +mae.toFixed(2) };
}

(async () => {
  const list = [];
  for (const sym of SYMS) for (const tf of TFS) { if (want.length && want.indexOf(sym) < 0) continue; list.push({ sym, tf, file: 'bt-' + sym.toLowerCase() + '-' + tf, q: QS[hash(sym + tf + SEED) % QS.length] }); }
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const report = [];

  await withBrowser(async (browser) => {
    for (const shot of list) {
      const ctxB = await browser.createBrowserContext();
      const page = await ctxB.newPage();
      let answer = null;
      try {
        await page.setCacheEnabled(false); await page.setBypassServiceWorker(true);
        await page.setViewport({ width: 1560, height: 1000, deviceScaleFactor: 2 });
        await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
        await page.setRequestInterception(true);
        page.on('request', (req) => {
          const u = req.url();
          if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'probe', xp: 4100, level: LV, premium: true } }) });
          if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [], notifUnread: 0, dmUnread: 0, duelPending: 0 }) });
          if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true, source: 'owner' }) });
          if (u.includes('/api/ai/chart')) {
            if (req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('hist=') ? { ok: true, msgs: [] } : { signedIn: true, premium: true, used: 3, limit: 50, ai: true }) });
            let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {}
            if (b.op === 'hist') return req.respond({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
            if (!answer) return req.respond({ status: 503, contentType: 'application/json', body: '{"error":"not ready"}' });
            return req.respond({ status: 200, contentType: 'text/event-stream; charset=utf-8', headers: { 'x-ai-used': '4', 'x-ai-limit': '50' }, body: sse(answer) });
          }
          return req.continue();
        });

        await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
        await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
        await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
        await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.__mpWinsDbg[0].dr', { timeout: 40000 });
        await page.evaluate(() => {
          ['#mpCkBar', '.top', 'header', '#mpGn', '.mpbn'].forEach(sel => document.querySelectorAll(sel).forEach(e => e.remove()));
          const hide = [...document.querySelectorAll('button,a')].find(b => (b.textContent || '').trim().toUpperCase() === 'HIDE'); if (hide) hide.click();
          const rail = document.getElementById('cwsRail') || document.querySelector('.cws-rail, .cws-side'); if (rail) rail.style.display = 'none';
          const st = document.createElement('style'); st.textContent = '.cwin-replay{display:none!important}'; document.head.appendChild(st); // the replay transport is hidden in every capture; the date is printed on the page instead
        });
        await new Promise(r2 => setTimeout(r2, 500));
        await page.evaluate(async (sym, tf, w, h) => {
          const win = window.__mpWinsDbg[0], si = win.el.querySelector('.cwin-sym');
          // the five MarginPad readouts are computed over the FULL array once and would carry the future into a rewound
          // brief; off for the read (the model is told what is locked/off and reads the standard set)
          ['casc', 'brain', 'memory', 'magnet', 'whaleliq'].forEach(k => { if (win.inds) win.inds[k] = false; });
          if (win.sym !== sym) { si.value = sym; si.dispatchEvent(new Event('change', { bubbles: true })); }
          const tb = win.el.querySelector('.cwin-tf button[data-tf="' + tf + '"]'); if (tb && win.tf !== tf) tb.click();
          win.el.id = win.el.id || 'promoWin';
          win.el.style.left = '0px'; win.el.style.top = '0px'; win.el.style.width = w + 'px'; win.el.style.height = h + 'px';
          await new Promise(r => setTimeout(r, 2600));
        }, shot.sym, shot.tf, W, H);
        await page.waitForFunction(`window.__mpWinsDbg[0].sym==='${shot.sym}' && window.__mpWinsDbg[0].tf==='${shot.tf}' && window.__mpWinsDbg[0].bars.length>400 && !window.__mpWinsDbg[0]._lm`, { timeout: 40000 });
        await new Promise(r2 => setTimeout(r2, 1200));

        // ---- rewind: the product's own replay, started the way a member starts it (so indicators follow the cut) ----
        const n = await page.evaluate(() => window.__mpWinsDbg[0].bars.length);
        const back = 200 + (hash(shot.sym + shot.tf + SEED) % Math.max(50, n - 350));   // leaves >= 150 candles of future
        const rp = await page.evaluate(async (back) => {
          const w = window.__mpWinsDbg[0];
          const ib = w.el.querySelector('.cwin-ind-btn'); if (ib) ib.click(); await new Promise(r => setTimeout(r, 250));
          const chip = document.querySelector('.cwin-ind-menu [data-replay]'); if (!chip) return { err: 'no replay chip' }; chip.click();
          await new Promise(r => setTimeout(r, 400));
          if (!w._rp) return { err: 'replay did not start' };
          window.__mpReplay.seek(w, w._rp.all.length - back);
          await new Promise(r => setTimeout(r, 900));
          const lb = w.bars[w.bars.length - 1]; let t = +lb.time; if (t > 1e12) t /= 1000;
          return { i: w._rp.i, all: w._rp.all.length, at: new Date(t * 1000).toISOString(), lastClose: +lb.close, n: w.bars.length };
        }, back);
        if (rp.err) throw new Error(rp.err);
        console.log('\n=== ' + shot.sym + ' ' + shot.tf + '  rewound to ' + rp.at + ' (' + rp.i + ' of ' + rp.all + ')');

        // ---- the brief this rewound chart builds, plus the picture the member's client would attach ----
        const brief = await page.evaluate(() => {
          const w = window.__mpWinsDbg[0]; const b = window.__mpAiContext(w);
          if (b.premiumReadouts) { delete b.premiumReadouts.bigLiquidations; delete b.premiumReadouts.whatAMoveCosts; if (!Object.keys(b.premiumReadouts).length) delete b.premiumReadouts; }
          delete b.openPosition;
          let img = null; try { const src = w.chart.takeScreenshot(); const sc = Math.min(1, 900 / src.width), cv = document.createElement('canvas'); cv.width = Math.round(src.width * sc); cv.height = Math.round(src.height * sc); cv.getContext('2d').drawImage(src, 0, 0, cv.width, cv.height); const u = cv.toDataURL('image/jpeg', 0.6); if (u.length > 1200 && u.length < 3500000) img = u; } catch (e) {}
          return { b, img };
        });
        const t0 = Date.now();
        const r = await fetch(ORIGIN + '/api/ai/chart?uid=e2e-promo', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' },
          body: JSON.stringify({ context: brief.b, question: shot.q, stream: false, lang: 'en', replay: true, image: brief.img || undefined }) });
        const j = await r.json();
        if (!j.answer) { console.log(shot.sym + ': model gave nothing - ' + JSON.stringify(j).slice(0, 140)); await ctxB.close(); continue; }
        answer = j.answer; const modelMs = Date.now() - t0;

        // ---- replay the answer through the real client so the chart draws it ----
        await page.evaluate(() => { const b = document.querySelector('.cwin-ai'); b && b.click(); });
        await page.waitForFunction("!!document.querySelector('.cwin-ai-panel') && !document.querySelector('.cwin-ai-panel').hidden", { timeout: 15000 }).catch(() => {});
        await page.evaluate((q) => {
          const p = document.querySelector('.cwin-ai-panel'); if (!p) return;
          const ta = p.querySelector('textarea, input[type=text]'); const btn = p.querySelector('.cwin-ai-send, button[type=submit]');
          if (ta) { ta.value = q; ta.dispatchEvent(new Event('input', { bubbles: true })); }
          if (btn) btn.click(); else { const c = p.querySelector('.cwin-ai-chip'); c && c.click(); }
        }, shot.q);
        await page.waitForFunction("!!document.querySelector('.cwin-ai-panel .aiacts')", { timeout: 30000 }).catch(() => {});
        await new Promise(r2 => setTimeout(r2, 1500));

        const info = await page.evaluate(() => {
          const w = window.__mpWinsDbg[0], ai = w.dr.shapes.filter(s => s.by === 'ai');
          const rec = [...document.querySelectorAll('.cwin-ai-panel .aiacts')].map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
          const all = w._rp.all.map(b => ({ time: +b.time, open: +b.open, high: +b.high, low: +b.low, close: +b.close }));
          return { shapes: ai.map(s => s.t + (s.txt ? ':' + s.txt : '')), plan: w._aiPlanObj || null, ghost: (w._ghostBars || []).length, receipts: rec, all, i: w._rp.i,
            tradable: !!(window.__mpAi && window.__mpAi.tradable && w._aiPlanObj && window.__mpAi.tradable(w._aiPlanObj)) };
        });
        const proseTxt = String(answer).split('```')[0].replace(/\s+/g, ' ').trim();
        console.log('  plan: ' + (info.plan ? info.plan.bias + '  entry ' + (info.plan.entry || '-') + '  stop ' + (info.plan.stop || '-') + '  targets ' + JSON.stringify(info.plan.targets || []) + '  conf ' + (info.plan.confidence || '-') : 'none') + '  tradable ' + info.tradable);
        console.log('  shapes: ' + info.shapes.join(' | '));
        const result = settle(info.plan, info.all, info.i, rp.lastClose);
        console.log('  SETTLED: ' + result.outcome + (result.fillAt ? '  filled ' + result.fillAt + ' (+' + result.barsToFill + ' bars)' : '') + (result.resolvedAt ? '  resolved ' + result.resolvedAt + ' (+' + result.barsToResolve + ' bars) move ' + result.movePct + '%' : '') + '  rr ' + (result.rr || '-'));

        const entry = { file: shot.file, sym: shot.sym, tf: shot.tf, q: shot.q, seed: SEED, back, replayAt: rp.at, askedAt: new Date().toISOString(), modelMs,
          shapes: info.shapes, plan: info.plan, receipts: info.receipts, lastClose: rp.lastClose, prose: proseTxt.slice(0, 1200), tradable: info.tradable, result };

        /* ---- capture A: the read, framed on the analysis (the promo generator's framing, over the CUT array) ---- */
        const frame = (fwd) => page.evaluate(async (fwd) => {
          const w = window.__mpWinsDbg[0], n = w.bars.length;
          const bt = (x) => { let v = +((x && (x.time || x.t)) || 0); return v > 1e12 ? v / 1000 : v; };
          const lastT = bt(w.bars[n - 1]), step = Math.max(60, lastT - bt(w.bars[n - 2]) || 60);
          const plan = w._aiPlanObj || {};
          const want = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number)).concat(w.dr.shapes.filter(s => s.by === 'ai').flatMap(s => [+s.p, +s.p1, +s.p2, +s.from, +s.to])).filter(v => v > 0);
          const oldest = Math.max.apply(null, [30].concat(w.dr.shapes.filter(s => s.by === 'ai').flatMap(s => [s.l1, s.l2, s.l]).filter(v => typeof v === 'number').map(v => n - 1 - v)));
          let bars = Math.max(38, Math.min(110, oldest + 10));
          for (let tries = 0; tries < 5; tries++) {
            w.chart.timeScale().setVisibleRange({ from: lastT - bars * step, to: lastT + fwd * step });
            await new Promise(r => setTimeout(r, 420));
            const ys = want.map(v => w.candle.priceToCoordinate(v));
            const ph = w.el.querySelector('.cwin-chart') ? w.el.querySelector('.cwin-chart').clientHeight : 600;
            const bad = ys.filter(y => y == null || y < 8 || y > ph - 8).length;
            if (!bad) return { bars, fits: true };
            bars = Math.round(bars * 1.35); if (bars > 150) return { bars, fits: false };
          }
          return { bars, fits: false };
        }, fwd);
        await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); if (p) p.style.display = 'none';
          document.querySelectorAll('#mpxpT, .mpxp-card, #mpGn, .wts-toast, .cwin-tools-tab, .dr-tools-tab').forEach(e => e.remove());
          document.querySelectorAll('.cwin-tools, .cwin-pop').forEach(e => { e.style.display = 'none'; }); });
        const fA = await frame(Math.max(10, (info.ghost || 0) + 8));
        await new Promise(r2 => setTimeout(r2, 600));
        const look = () => page.evaluate((sym, tf) => {
          const w = window.__mpWinsDbg[0], bars = w.bars || [];
          const closes = bars.map(b => +b.close).filter(v => v > 0).sort((a, b) => a - b); const med = closes.length ? closes[closes.length >> 1] : 0;
          const strays = closes.filter(v => v < med / 4 || v > med * 4).length;
          const loading = [...document.querySelectorAll('#promoWin *')].some(e => { if (e.childElementCount || !/^loading/i.test((e.textContent || '').trim())) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; });
          const plan = w._aiPlanObj || {}; const want = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number)).filter(v => v > 0);
          const ph = (w.el.querySelector('.cwin-chart') || {}).clientHeight || 600;
          const off = want.map(v => w.candle.priceToCoordinate(v)).filter(y => y == null || y < 8 || y > ph - 8).length;
          return { ok: w.sym === sym && w.tf === tf && bars.length > 50 && !strays && !loading && !off && !!w._rp, strays, loading, off, n: bars.length, rp: !!w._rp };
        }, shot.sym, shot.tf);
        let seen = await look(); if (!seen.ok) throw new Error('capture A refused: ' + JSON.stringify(seen));
        const grab = async (name) => {
          const handle = await page.$('#promoWin'); if (!handle) throw new Error('chart window element not found');
          const png = await handle.screenshot({ type: 'png', encoding: 'base64' });
          const jpg = await page.evaluate(async (b64, w, h, q) => { const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; }); const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h); return c.toDataURL('image/jpeg', q).split(',')[1]; }, png, W, H, Q);
          fs.writeFileSync(path.join(OUT, name + '.jpg'), Buffer.from(jpg, 'base64'));
          const zoom = await page.evaluate(async (b64, W0, H0, q) => {
            const w = window.__mpWinsDbg[0], plan = w._aiPlanObj || {}, el = w.el.getBoundingClientRect(), ch = w.el.querySelector('.cwin-chart').getBoundingClientRect();
            const prices = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number)).filter(v => v > 0);
            const ys = prices.map(v => w.candle.priceToCoordinate(v)).filter(v => v != null);
            const cw = 560, chh = 373; let cy = ys.length ? (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 : ch.height / 2;
            let top = (ch.top - el.top) + cy - chh / 2; top = Math.max(0, Math.min(H0 - chh, top)); const left = Math.max(0, W0 - cw);
            const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
            const c = document.createElement('canvas'); c.width = cw * 2; c.height = chh * 2; c.getContext('2d').drawImage(img, left * 2, top * 2, cw * 2, chh * 2, 0, 0, cw * 2, chh * 2);
            return c.toDataURL('image/jpeg', q).split(',')[1];
          }, png, W, H, Q);
          fs.writeFileSync(path.join(OUT, name + '-zoom.jpg'), Buffer.from(zoom, 'base64'));
          console.log('  -> ' + name + '.jpg + zoom');
        };
        await grab(shot.file);
        entry.framedBars = fA.bars;

        /* ---- capture B: what happened next. Seek past the resolution, ghost candles off (they would sit on top of the
           real ones), the plan lines and the drawing still on the chart ---- */
        if (result.resIdx != null || result.outcome === 'nofill') {
          const toIdx = Math.min(info.all.length, (result.resIdx != null ? result.resIdx : info.i + (result.barsToFill == null ? Math.min(120, Math.max(10, +((info.plan || {}).horizonBars) || 30) * 3) : 0)) + 8);
          const fB = await page.evaluate(async (toIdx, fromIdx) => {
            const w = window.__mpWinsDbg[0]; try { window.__mpAi.ghostClear(w); } catch (e) {}
            window.__mpReplay.seek(w, toIdx); await new Promise(r => setTimeout(r, 900));
            const bt = (x) => { let v = +((x && (x.time || x.t)) || 0); return v > 1e12 ? v / 1000 : v; };
            const n = w.bars.length, lastT = bt(w.bars[n - 1]), step = Math.max(60, lastT - bt(w.bars[n - 2]) || 60);
            const plan = w._aiPlanObj || {}; const want = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number)).filter(v => v > 0);
            let backBars = Math.max(40, (n - fromIdx) + 30);
            for (let tries = 0; tries < 5; tries++) {
              w.chart.timeScale().setVisibleRange({ from: lastT - backBars * step, to: lastT + 6 * step });
              await new Promise(r => setTimeout(r, 420));
              const ys = want.map(v => w.candle.priceToCoordinate(v)); const ph = w.el.querySelector('.cwin-chart') ? w.el.querySelector('.cwin-chart').clientHeight : 600;
              if (!ys.filter(y => y == null || y < 8 || y > ph - 8).length) return { bars: backBars, fits: true, n };
              backBars = Math.round(backBars * 1.3);
            }
            return { bars: backBars, fits: false, n };
          }, toIdx, info.i);
          await new Promise(r2 => setTimeout(r2, 500));
          seen = await look(); if (!seen.ok) console.log('  capture B refused: ' + JSON.stringify(seen)); else { await grab(shot.file + '-after'); entry.after = { toIdx, bars: fB.bars, fits: fB.fits }; }
        }
        report.push(entry);
      } catch (e) {
        console.log(shot.sym + ' ' + shot.tf + ': FAILED - ' + String(e.message).slice(0, 200));
      }
      await ctxB.close().catch(() => {});
    }
  }, { timeoutMs: 3600000 });

  let prev = []; try { prev = JSON.parse(fs.readFileSync(REPORT, 'utf8')); } catch (e) {}
  const byFile = {}; prev.concat(report).forEach(r => { byFile[r.file] = r; });
  const merged = Object.values(byFile).sort((a, b) => (a.sym + a.tf).localeCompare(b.sym + b.tf));
  fs.writeFileSync(REPORT, JSON.stringify(merged, null, 2));
  const agg = {}; merged.forEach(r => { const k = (r.result || {}).outcome || 'none'; agg[k] = (agg[k] || 0) + 1; });
  console.log('\nreport -> build/data/ai-backtest-report.json  (' + merged.length + ' reads) ' + JSON.stringify(agg));
})();
