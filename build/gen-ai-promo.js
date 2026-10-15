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
/* 1040x680 since 2026-10-08 (was 1320x880): the chart's labels are fixed-size pixels, so a smaller window shows them LARGER
   on the page - at the 620px the grid gives a figure on a desktop the old frame was 47% scale and every number on the drawing
   was illegible, which defeats a section whose argument is the arithmetic. A second file per read, `-zoom.jpg`, is the
   plan's own neighbourhood cut out of the 2x render for phones, where even 1040 lands at 34%. */
const W = 1040, H = 680, Q = 0.84;

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
          if (window.mpCharts && window.mpCharts.setTf) { if (win.tf !== tf) window.mpCharts.setTf(win, tf); } else { const tb = win.el.querySelector('.cwin-tf button[data-tf="' + tf + '"]'); if (tb && win.tf !== tf) tb.click(); }
          win.el.id = win.el.id || 'promoWin';
          win.el.style.left = '0px'; win.el.style.top = '0px'; win.el.style.width = w + 'px'; win.el.style.height = h + 'px';
          await new Promise(r => setTimeout(r, 2600));
        }, shot.sym, shot.tf, W, H);
        await page.waitForFunction(`window.__mpWinsDbg[0].sym==='${shot.sym}' && window.__mpWinsDbg[0].tf==='${shot.tf}' && window.__mpWinsDbg[0].bars.length>50`, { timeout: 30000 });

        // the REAL brief this chart would send
        const brief = await page.evaluate(() => window.__mpAiContext(window.__mpWinsDbg[0]));
        const t0 = Date.now();
        // ?uid=e2e-promo: the E2E path reads THAT account's record and open calls. The default e2e-ai uid is shared with
        // ai-chart-e2e, whose runs leave open calls behind - the first BTC capture opened with "My earlier long is dead"
        // (2026-10-08). A promo read must start from a clean dossier.
        const r = await fetch(ORIGIN + '/api/ai/chart?uid=e2e-promo', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' },
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
          const rec = [...document.querySelectorAll('.cwin-ai-panel .aiacts')].map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
          const last = w.bars.length ? +w.bars[w.bars.length - 1].close : 0;
          return { sym: w.sym, tf: w.tf, shapes: ai.map(s => s.t + (s.txt ? ':' + s.txt : '')), plan: pm,
            ghost: (w._ghostBars || []).length, lines: (w._aiPlan || []).length, receipts: rec, lastClose: last,
            prose: '' };
        });
        console.log('  shapes: ' + info.shapes.join(' | '));
        if (info.plan) console.log('  plan: ' + info.plan.bias + '  entry ' + (info.plan.entry || '-') + '  stop ' + (info.plan.stop || '-') + '  targets ' + JSON.stringify(info.plan.targets || []) + '  conf ' + (info.plan.confidence || '-'));
        console.log('  price lines ' + info.lines + ', forecast candles ' + info.ghost);
        const proseTxt = String(answer).split('```')[0].replace(/\s+/g, ' ').trim();
        console.log('  prose: ' + proseTxt.slice(0, 300));
        // held back until the picture passes the look below - a read whose capture is refused must not leave a
        // caption behind on the page describing an image nobody can see.
        const entry = { file: shot.file, sym: shot.sym, tf: shot.tf, q: shot.q, shapes: info.shapes, plan: info.plan, receipts: info.receipts, lastClose: info.lastClose, prose: proseTxt.slice(0, 1200), at: new Date().toISOString() };

        // FRAME IT ON THE ANALYSIS. The default view showed 120 candles, so the whole read - entry, stop, both
        // targets, the block - sat squashed into the top-right tenth of the picture while nine tenths was old
        // price history. This walks the window in until every price the plan names is inside the plot, with
        // forward room for the labels (they are right-aligned past the last candle and were clipping the axis).
        /* FRAMED BY TIME, NOT BY LOGICAL INDEX (2026-10-11). `setVisibleLogicalRange({from: n - bars})` counts
           from the end of the SERIES, and `n` is the length of `w.bars` - two numbers that are not the same
           number. After a load-more doubled LINK 4h to 2,000 bars they disagreed, so the window opened ~114 bars
           past the newest candle and the time axis printed 17-29 on the 11th of October (and, on the run before,
           November into December). The candles and the drawing looked right, which is how it shipped. A visible
           range asked for in SECONDS cannot be offset by a bookkeeping mismatch. */
        const framed = await page.evaluate(async (fwd) => {
          const w = window.__mpWinsDbg[0], n = w.bars.length;
          const bt = (x) => { let v = +((x && (x.time || x.t)) || 0); return v > 1e12 ? v / 1000 : v; };
          const lastT = bt(w.bars[n - 1]), step = Math.max(60, bt(w.bars[n - 1]) - bt(w.bars[n - 2]) || 60);
          const plan = w._aiPlanObj || {};
          const want = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number))
            .concat(w.dr.shapes.filter(s => s.by === 'ai').flatMap(s => [+s.p, +s.p1, +s.p2, +s.from, +s.to]))
            .filter(v => v > 0);
          const oldest = Math.max.apply(null, [30].concat(w.dr.shapes.filter(s => s.by === 'ai')
            .flatMap(s => [s.l1, s.l2, s.l]).filter(v => typeof v === 'number').map(v => n - 1 - v)));
          let bars = Math.max(38, Math.min(110, oldest + 10));
          for (let tries = 0; tries < 5; tries++) {
            w.chart.timeScale().setVisibleRange({ from: lastT - bars * step, to: lastT + fwd * step });
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
          /* FORWARD ROOM IS MEASURED, NOT A CONSTANT. It was a flat 30 candles, which on a read that drew no
             forecast left the right THIRD of the picture empty and the candles squeezed into the left 62% - a
             sparse image for a section whose job is to show a dense piece of work. The AI's labels are parked at
             last+5 and right-aligned (they extend leftward), and the price tags sit outside the plot, so the only
             thing that genuinely needs room to the right is the forecast. */
        }, Math.max(10, (info.ghost || 0) + 8));
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

        /* THE PICTURE IS CHECKED BEFORE IT IS SAVED (2026-10-11, owner: "ne svidja mi se ova slika").
           The SOL 15m capture shipped on 08-10 carried the word "loading...", not one candle, and a price axis
           reading 90000 down to 20000 on a $116 chart - a single stale BTC bar had survived the symbol switch, the
           series autoscaled to it, and every price the plan named was crushed into the bottom 2% of the frame. It
           sat on /premium/ for three days under a card promising that every number is a measurement.
           Nothing in this run could have noticed. The wait at the top asks for sym/tf/bars.length, and `w.sym`
           flips the instant the picker changes while `w.bars` is replaced only when the fetch lands - so the
           condition passes against the PREVIOUS symbol's candles. A capture is a PICTURE: the check has to be on
           what is on screen at the moment of the shot, never on state that was true a minute earlier. */
        const look = () => page.evaluate((sym, tf, fwd) => {
          const w = window.__mpWinsDbg[0], bars = w.bars || [];
          const closes = bars.map(b => +b.close).filter(v => v > 0).sort((a, b) => a - b);
          const med = closes.length ? closes[closes.length >> 1] : 0;
          // a bar four times off the median is not this market - it is the previous symbol's data left in the series
          const strays = closes.filter(v => v < med / 4 || v > med * 4).length;
          const loading = [...document.querySelectorAll('#promoWin *')].some(e => {
            if (e.childElementCount || !/^loading/i.test((e.textContent || '').trim())) return false;
            const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0;
          });
          const plan = w._aiPlanObj || {};
          const want = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number)).filter(v => v > 0);
          const ph = (w.el.querySelector('.cwin-chart') || {}).clientHeight || 600;
          const off = w.candle && w.candle.priceToCoordinate
            ? want.map(v => w.candle.priceToCoordinate(v)).filter(y => y == null || y < 8 || y > ph - 8).length : want.length;
          const lr = w.chart.timeScale().getVisibleLogicalRange() || { from: 0, to: 0 };
          const shown = Math.min(bars.length, Math.round(lr.to)) - Math.max(0, Math.round(lr.from));
          /* AND THE NEWEST CANDLE HAS TO BE NOW. The LINK 4h capture passed every other check and printed a time
             axis running "18 20 22 24 26 28 Dec 3 5 7" on the 11th of October - the series had been extended to
             2000 bars by a load-more and the merge left the book dated two months into the future. A reader
             checks the date on a screenshot before anything else. */
          let lastT = bars.length ? +(bars[bars.length - 1].time || bars[bars.length - 1].t || 0) : 0;
          if (lastT > 1e12) lastT /= 1000;
          const step = (+tf || 1) * 60;
          const ageBars = lastT > 0 ? (Date.now() / 1000 - lastT) / step : 1e9;
          /* AND THE AXIS UNDER THE CANDLES HAS TO BE THEIR OWN DATES. The right edge of the visible range is what
             the time axis prints; when it sits far past the newest candle the axis reads a month that never
             happened, which is the first thing a reader checks on a screenshot. */
          const vr = w.chart.timeScale().getVisibleRange() || {};
          const vt = (v) => { if (v == null) return 0; let n2 = typeof v === 'object' ? Date.UTC(v.year, v.month - 1, v.day) / 1000 : +v; return n2 > 1e12 ? n2 / 1000 : n2; };
          const edgeBars = lastT > 0 && vt(vr.to) ? (vt(vr.to) - lastT) / step : 1e9;
          return { sym: w.sym, tf: w.tf, n: bars.length, med: med, strays: strays, loading: loading, offscreen: off, inView: shown,
            lastBar: lastT ? new Date(lastT * 1000).toISOString().slice(0, 16) : '-', ageBars: Math.round(ageBars * 10) / 10,
            axisEnds: vt(vr.to) ? new Date(vt(vr.to) * 1000).toISOString().slice(0, 16) : '-', edgeBars: Math.round(edgeBars * 10) / 10,
            ok: w.sym === sym && w.tf === tf && bars.length > 50 && !strays && !loading && !off && shown >= 20
              && ageBars > -1 && ageBars < 6 && edgeBars > -2 && edgeBars <= fwd + 6 };
        }, shot.sym, shot.tf, Math.max(10, (info.ghost || 0) + 8));

        let seen = await look();
        for (let t = 0; t < 6 && !seen.ok; t++) {
          await new Promise(r2 => setTimeout(r2, 1600));
          await page.evaluate((b, fwd) => { const w = window.__mpWinsDbg[0], n = w.bars.length;
            const bt = (x) => { let v = +((x && (x.time || x.t)) || 0); return v > 1e12 ? v / 1000 : v; };
            const lastT = bt(w.bars[n - 1]), step = Math.max(60, lastT - bt(w.bars[n - 2]) || 60);
            w.chart.timeScale().setVisibleRange({ from: lastT - b * step, to: lastT + fwd * step });
          }, framed.bars, Math.max(10, (info.ghost || 0) + 8)).catch(() => {});
          await new Promise(r2 => setTimeout(r2, 500));
          seen = await look();
        }
        if (!seen.ok) throw new Error('picture REFUSED, nothing written: ' + JSON.stringify(seen));
        console.log('  picture checked: ' + seen.n + ' bars (' + seen.inView + ' in view), newest ' + seen.lastBar + ', axis ends ' + seen.axisEnds + ' (+' + seen.edgeBars + ' bars), median ' + seen.med + ', no stray bars, nothing loading, every plan price on screen');

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
        // THE ZOOM: the plan's own neighbourhood - the last ~48 candles plus the price axis, centred on the plan's prices - cut
        // out of the 2x render at 1:1, so a phone shows the numbers at 2/3 of their real size instead of a third.
        const zoom = await page.evaluate(async (b64, W0, H0, q) => {
          const w = window.__mpWinsDbg[0], plan = w._aiPlanObj || {}, el = w.el.getBoundingClientRect();
          const ch = w.el.querySelector('.cwin-chart').getBoundingClientRect();
          const prices = [+plan.entry, +plan.stop].concat((plan.targets || []).map(Number)).concat(w.dr.shapes.filter(s => s.by === 'ai').flatMap(s => [+s.p, +s.p1, +s.p2])).filter(v => v > 0);
          const ys = prices.map(v => w.candle.priceToCoordinate(v)).filter(v => v != null);
          const cw = 560, chh = 373; // css px, 3:2
          let cy = ys.length ? (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2 : ch.height / 2;
          let top = (ch.top - el.top) + cy - chh / 2; top = Math.max(0, Math.min(H0 - chh, top));
          const left = Math.max(0, W0 - cw);
          const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + b64; });
          const c = document.createElement('canvas'); c.width = cw * 2; c.height = chh * 2;
          const g = c.getContext('2d'); g.drawImage(img, left * 2, top * 2, cw * 2, chh * 2, 0, 0, cw * 2, chh * 2);
          return { b64: c.toDataURL('image/jpeg', q).split(',')[1], top: Math.round(top), left: left, w: cw * 2, h: chh * 2 };
        }, png, W, H, Q);
        const zbuf = Buffer.from(zoom.b64, 'base64');
        fs.writeFileSync(path.join(OUT, shot.file + '-zoom.jpg'), zbuf);
        console.log('  -> ' + shot.file + '-zoom.jpg  ' + zoom.w + 'x' + zoom.h + ' (crop at ' + zoom.left + ',' + zoom.top + ')  ' + (zbuf.length / 1024).toFixed(0) + 'KB');
        report.push(entry);
      } catch (e) {
        console.log(shot.sym + ': FAILED - ' + String(e.message).slice(0, 160));
      }
      await ctxB.close().catch(() => {});
    }
  }, { timeoutMs: 900000 });

  const rp = path.join(__dirname, 'data', 'ai-promo-report.json');
  let prev = []; try { prev = JSON.parse(fs.readFileSync(rp, 'utf8')); } catch (e) {}
  // a partial run keeps the other reads - and keeps them in SHOTS order. Concatenating the new ones on the end
  // silently reordered the section (one re-run of LINK moved it from fifth to last, i.e. off the visible three).
  const byFile = {}; prev.concat(report).forEach(r => { byFile[r.file] = r; });
  const merged = SHOTS.map(s => byFile[s.file]).filter(Boolean)
    .concat(prev.filter(p => !SHOTS.some(s => s.file === p.file)));
  fs.writeFileSync(rp, JSON.stringify(merged, null, 2));
  console.log('\nreport -> build/data/ai-promo-report.json  (gen-premium-aishow.js builds the section from it - never write a caption from memory)');
})();
