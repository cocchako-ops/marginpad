/* Promo captures of Ask AI reading a real chart (2026-09-19, owner: "cela analiza mora da stane u kadar,
   slike znatno manje dimenzije i boljeg kvaliteta, sve iste dimenzije i simetricno").

   The four they replace were phone crops at 1880 wide and FOUR DIFFERENT HEIGHTS (1480/1400/1254/1098), so a
   two-column grid could never line up, and blown up on a desktop they looked soft.

   These are captured from the live product at a fixed 1320x880 window with deviceScaleFactor 2 - so every pixel
   is supersampled from 2640x1760 and then downscaled in the browser's own canvas, which is why they are sharper
   AND smaller than the originals. Identical dimensions by construction.

   The analysis is REAL: the page's own brief goes to the real model, and the real answer is replayed through the
   real client so the chart draws it with the same code a member sees. Nothing is mocked except the Premium check.

   It prints the plan, the shapes and the prose for each capture - WRITE THE CAPTIONS FROM THAT, never from
   memory: every number under these images is a measurement.

   node build/gen-ai-promo.js            all six
   node build/gen-ai-promo.js BTC ETH    only these
*/
const fs = require('fs'), path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io';
const KEY = fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').split('\n')[1].replace('\r', '').trim();
const OUT = path.join(__dirname, '..', 'dist', 'assets', 'plus');
const W = 1320, H = 880, Q = 0.82;

const SHOTS = [
  { file: 'ai-setup', sym: 'BTC', tf: '60', q: 'Read this chart and draw the setup on it.' },
  { file: 'ai-opportunity', sym: 'ETH', tf: '240', q: 'Find me an opportunity here and draw it on the chart.' },
  { file: 'ai-risk', sym: 'SOL', tf: '15', q: 'Where would you enter, and where does the stop go? Draw it.' },
  { file: 'ai-structure', sym: 'XRP', tf: '60', q: 'Mark the structure and the levels that actually matter here.' },
  { file: 'ai-liquidity', sym: 'LINK', tf: '240', q: 'Show me where the liquidation pools sit and what they mean for a trade.' },
  { file: 'ai-wait', sym: 'DOGE', tf: '60', q: 'Is there anything worth taking here right now? Draw your answer.' },
];

const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };
const sse = (text) => { const parts = []; for (let i = 0; i < text.length; i += 60) parts.push(text.slice(i, i + 60));
  return parts.map(t => 'event: content_block_delta\ndata: ' + JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } }) + '\n\n').join('')
    + 'event: message_stop\ndata: {"type":"message_stop"}\n\n'; };

(async () => {
  const want = process.argv.slice(2).map(s => s.toUpperCase());
  const list = want.length ? SHOTS.filter(s => want.indexOf(s.sym) >= 0) : SHOTS;
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

        // The first cut clipped the PAGE at 0,0 and caught the cookie bar, the site header, the whole left
        // sidebar and a chart cut off down the right edge - the analysis literally did not fit the frame.
        // Clear the chrome, collapse the rail, then screenshot the chart WINDOW element itself.
        await page.evaluate(() => {
          ['#mpCkBar', '.top', 'header', '#mpGn', '.mpbn'].forEach(sel => document.querySelectorAll(sel).forEach(e => e.remove()));
          const hide = [...document.querySelectorAll('button,a')].find(b => (b.textContent || '').trim().toUpperCase() === 'HIDE');
          if (hide) hide.click();
          const rail = document.getElementById('cwsRail') || document.querySelector('.cws-rail, .cws-side');
          if (rail) rail.style.display = 'none';
        });
        await new Promise(r2 => setTimeout(r2, 500));

        // one window, exactly the frame the image will be - the drawing is laid out for THIS size
        await page.evaluate(async (sym, tf, w, h) => {
          const win = window.__mpWinsDbg[0], si = win.el.querySelector('.cwin-sym');
          if (win.sym !== sym) { si.value = sym; si.dispatchEvent(new Event('change', { bubbles: true })); }
          const tb = win.el.querySelector('.cwin-tf button[data-tf="' + tf + '"]'); if (tb && win.tf !== tf) tb.click();
          win.el.id = win.el.id || 'promoWin';
          win.el.style.left = '0px'; win.el.style.top = '0px'; win.el.style.width = w + 'px'; win.el.style.height = h + 'px';
          await new Promise(r => setTimeout(r, 2600));
        }, shot.sym, shot.tf, W, H);
        await page.waitForFunction(`window.__mpWinsDbg[0].sym==='${shot.sym}' && window.__mpWinsDbg[0].tf==='${shot.tf}' && window.__mpWinsDbg[0].bars.length>50`, { timeout: 30000 });

        // the REAL brief this chart would send
        const brief = await page.evaluate(() => window.__mpAiContext(window.__mpWinsDbg[0]));
        const t0 = Date.now();
        const r = await fetch(ORIGIN + '/api/ai/chart', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' },
          body: JSON.stringify({ context: brief, question: shot.q, stream: false, lang: 'en' }) });
        const j = await r.json();
        if (!j.answer) { console.log(shot.sym + ': model gave nothing - ' + JSON.stringify(j).slice(0, 140)); await ctxB.close(); continue; }
        answer = j.answer;
        console.log('\n=== ' + shot.sym + ' ' + shot.tf + ' (model ' + (Date.now() - t0) + 'ms) ===');

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
          const pm = (window.__mpAi && w._aiPlanObj) || null;
          return { sym: w.sym, tf: w.tf, shapes: ai.map(s => s.t + (s.txt ? ':' + s.txt : '')), plan: pm,
            ghost: (w._ghostBars || []).length, lines: (w._aiPlan || []).length,
            prose: '' };
        });
        console.log('  shapes: ' + info.shapes.join(' | '));
        if (info.plan) console.log('  plan: ' + info.plan.bias + '  entry ' + (info.plan.entry || '-') + '  stop ' + (info.plan.stop || '-') + '  targets ' + JSON.stringify(info.plan.targets || []) + '  conf ' + (info.plan.confidence || '-'));
        console.log('  price lines ' + info.lines + ', forecast candles ' + info.ghost);
        const proseTxt = String(answer).split('```')[0].replace(/\s+/g, ' ').trim();
        console.log('  prose: ' + proseTxt.slice(0, 300));
        report.push({ file: shot.file, sym: shot.sym, tf: shot.tf, shapes: info.shapes, plan: info.plan, prose: proseTxt.slice(0, 900) });

        // FRAME IT ON THE ANALYSIS. The default view showed 120 candles, so the whole read - entry, stop, both
        // targets, the block - sat squashed into the top-right tenth of the picture while nine tenths was old
        // price history. This walks the window in until every price the plan names is inside the plot, with
        // forward room for the labels (they are right-aligned past the last candle and were clipping the axis).
        const framed = await page.evaluate(async (fwd) => {
          const w = window.__mpWinsDbg[0], n = w.bars.length;
          const plan = w._aiPlanObj || {};
          const want = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number))
            .concat(w.dr.shapes.filter(s => s.by === 'ai').flatMap(s => [+s.p, +s.p1, +s.p2, +s.from, +s.to]))
            .filter(v => v > 0);
          const oldest = Math.max.apply(null, [30].concat(w.dr.shapes.filter(s => s.by === 'ai')
            .flatMap(s => [s.l1, s.l2, s.l]).filter(v => typeof v === 'number').map(v => n - 1 - v)));
          let bars = Math.max(38, Math.min(110, oldest + 10));
          for (let tries = 0; tries < 5; tries++) {
            w.chart.timeScale().setVisibleLogicalRange({ from: n - bars, to: n + fwd });
            await new Promise(r => setTimeout(r, 420));
            const h = w.candle.priceToCoordinate ? 1 : 1;
            const ys = want.map(v => w.candle.priceToCoordinate(v));
            const ph = w.el.querySelector('.cwin-chart') ? w.el.querySelector('.cwin-chart').clientHeight : 600;
            const bad = ys.filter(y => y == null || y < 8 || y > ph - 8).length;
            if (!bad) return { bars: bars, prices: want.length, fits: true };
            bars = Math.round(bars * 1.35);
            if (bars > 150) return { bars: bars, prices: want.length, fits: false };
          }
          return { bars: bars, prices: want.length, fits: false };
        }, 30);
        console.log('  framed on ' + framed.bars + ' candles, ' + framed.prices + ' plan prices, all inside: ' + framed.fits);

        // hide the chat panel - the picture is the chart and what the assistant drew on it
        await page.evaluate(() => { const p = document.querySelector('.cwin-ai-panel'); if (p) p.style.display = 'none';
          document.querySelectorAll('#mpxpT, .mpxp-card, #mpGn, .wts-toast, .cwin-tools-tab, .dr-tools-tab').forEach(e => e.remove());
          // the drawing-tools tab: a narrow vertical strip pinned to the left edge. Matched by GEOMETRY rather
          // than a class name, which is what failed - its label is nested and the class is minified.
          // the drawing-tools rail: `.cwin-tools` is its real class (mp-charts is hand-edited, not minified,
          // so the geometric guess was never needed). Its collapsed tab reads TOOLS down the left edge.
          document.querySelectorAll('.cwin-tools, .cwin-pop').forEach(e => { e.style.display = 'none'; });
          document.querySelectorAll('div,button,span,aside').forEach(e => {
            const r = e.getBoundingClientRect();
            if (r.width > 0 && r.width < 46 && r.height > 50 && r.left < 46 && /TOOL/i.test(e.textContent || '')) e.style.display = 'none';
          }); });
        await new Promise(r2 => setTimeout(r2, 700));

        const handle = await page.$('#promoWin');
        if (!handle) throw new Error('chart window element not found');
        const png = await handle.screenshot({ type: 'png', encoding: 'base64' });

        // downscale 2640x1760 -> 1320x880 in the browser's own canvas: an exact 2x box filter, no dependency
        const jpg = await page.evaluate(async (b64, w, h, q) => {
          const img = new Image();
          await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
          g.drawImage(img, 0, 0, w, h);
          return c.toDataURL('image/jpeg', q).split(',')[1];
        }, png, W, H, Q);

        const buf = Buffer.from(jpg, 'base64');
        fs.writeFileSync(path.join(OUT, shot.file + '.jpg'), buf);
        console.log('  -> ' + shot.file + '.jpg  ' + W + 'x' + H + '  ' + (buf.length / 1024).toFixed(0) + 'KB');
      } catch (e) {
        console.log(shot.sym + ': FAILED - ' + String(e.message).slice(0, 160));
      }
      await ctxB.close().catch(() => {});
    }
  }, { timeoutMs: 900000 });

  fs.writeFileSync(path.join(__dirname, 'ask-shots', 'promo-report.json'), JSON.stringify(report, null, 2));
  console.log('\nreport -> build/ask-shots/promo-report.json  (write the captions from it)');
})();
