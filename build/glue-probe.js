/* Is the drawing GLUED to the chart? Paint a magenta h-line (price axis) and a cyan trend line + label (time axis), then move the
   chart every way a reader can and compare PAINTED pixels against the engine's own projection. */
const path = require('path');
const { withBrowser } = require('./e2e-browser');
const ORIGIN = 'https://marginpad.io';
const LV = { idx: 2, k: 'silver', name: 'Silver', col: '#b7c2d0', min: 3000, xp: 4100, next: 'Gold', nextMin: 12000, toNext: 7900, pct: 12, stars: 0 };

(async () => {
  await withBrowser(async (browser) => {
    const ctx = await browser.createBrowserContext(); const page = await ctx.newPage();
    await page.setCacheEnabled(false); await page.setBypassServiceWorker(true); await page.setViewport({ width: 1400, height: 900 });
    await page.setCookie({ name: 'mp_li', value: '1', domain: 'marginpad.io', path: '/' });
    page.on('pageerror', e => console.log('PAGEERR', String(e.message).slice(0, 160)));
    await page.setRequestInterception(true);
    page.on('request', (req) => { const u = req.url();
      if (u.includes('/api/auth/me')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'e2e', username: 'probe', xp: 4100, level: LV, premium: true } }) });
      if (u.includes('/api/auth/xp') && req.method() === 'GET') return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedIn: true, xp: 4100, level: LV, log: [] }) });
      if (u.includes('/api/premium/status') || u.includes('/api/ind/access')) return req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ allowed: true, premium: true, signedIn: true }) });
      return req.continue(); });
    await page.goto(`${ORIGIN}/charts?cb=${Date.now()}`, { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) document.getElementById('cwsAdd').click(); });
    await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>50 && window.__mpWinsDbg[0].dr', { timeout: 40000 }).catch(() => {});
    await page.evaluate(() => { const w = window.__mpWinsDbg[0], b = document.getElementById('cwsBoard');
      w.el.style.left = '0px'; w.el.style.top = '0px'; w.el.style.width = b.clientWidth + 'px'; w.el.style.height = b.clientHeight + 'px'; });
    await new Promise(r => setTimeout(r, 1600));

    await page.evaluate(() => { const w = window.__mpWinsDbg[0], n = w.bars.length, px = +w.bars[n - 1].close;
      window.__pPx = px; window.__pL = n - 1 - 30; window.__pP2 = +w.bars[n - 1 - 30].close;
      w.dr.shapes.push({ t: 'hline', p: px, color: '#ff00ff', w: 2, by: 'ai' });
      w.dr.shapes.push({ t: 'text', l: n - 1 - 30, p: +w.bars[n - 1 - 30].close, txt: 'MARK', color: '#00ffff', w: 2, by: 'ai' });
      w.dr.redraw(); });
    await new Promise(r => setTimeout(r, 400));

    const measure = async (tag) => page.evaluate((tag) => {
      const w = window.__mpWinsDbg[0], cv = w.el.querySelector('.cwin-body .cwin-draw');
      const expY = w.candle.priceToCoordinate(window.__pPx), expX = w.chart.timeScale().logicalToCoordinate(window.__pL), expY2 = w.candle.priceToCoordinate(window.__pP2);
      const c2 = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
      const img = c2.getImageData(0, 0, cv.width, cv.height).data;
      let mrow = null, cx = null, cy = null;
      for (let y = 0; y < cv.height; y++) { let hits = 0;
        for (let x = 0; x < cv.width; x += 7) { const i = (y * cv.width + x) * 4; if (img[i] > 200 && img[i + 1] < 80 && img[i + 2] > 200) hits++; }
        if (hits > (cv.width / 7) * 0.5) { mrow = y / dpr; break; } }
      for (let y = 0; y < cv.height && cx === null; y++) for (let x = 0; x < cv.width; x++) { const i = (y * cv.width + x) * 4;
        if (img[i] < 90 && img[i + 1] > 190 && img[i + 2] > 190) { cx = x / dpr; cy = y / dpr; break; } }
      return { tag, expY: expY == null ? null : Math.round(expY), painted: mrow == null ? null : Math.round(mrow),
        expX: expX == null ? null : Math.round(expX), textX: cx == null ? null : Math.round(cx), expY2: expY2 == null ? null : Math.round(expY2), textY: cy == null ? null : Math.round(cy),
        canvasCssH: Math.round(cv.getBoundingClientRect().height), bitmapH: Math.round(cv.height / dpr), drH: Math.round(w.dr.H) };
    }, tag);

    const drag = async (dx, dy) => { const b = await page.evaluate(() => { const r = window.__mpWinsDbg[0].el.querySelector('.cwin-chart').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      await page.mouse.move(b.x, b.y); await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + dx * i / 10, b.y + dy * i / 10);
      await page.mouse.up(); await new Promise(r => setTimeout(r, 700)); };

    const rows = [];
    rows.push(await measure('at rest'));
    await drag(-300, 0); rows.push(await measure('horizontal pan'));
    await drag(0, -160); rows.push(await measure('vertical pan'));
    // open RSI through the real UI (it adds the oscillator sub-pane, which shortens the price pane)
    await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.el.querySelector('.cwin-ind-btn').click(); });
    await new Promise(r => setTimeout(r, 500));
    await page.evaluate(() => { const it = document.querySelector('.cwin-ind-menu .cwin-ind-item[data-ind="rsi"]'); if (it) it.click(); });
    await new Promise(r => setTimeout(r, 1500));
    const on = await page.evaluate(() => { const w = window.__mpWinsDbg[0], sub = w.el.querySelector('.cwin-sub'); return { rsi: !!w.inds.rsi, subH: sub ? Math.round(sub.getBoundingClientRect().height) : 0 }; });
    rows.push(await measure('after RSI pane opened  ' + JSON.stringify(on)));
    await page.evaluate(() => { const b = document.querySelector('.cwin-chart'), r = b.getBoundingClientRect();
      b.dispatchEvent(new WheelEvent('wheel', { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, deltaY: -300, bubbles: true })); });
    await new Promise(r => setTimeout(r, 800));
    rows.push(await measure('after zoom'));

    console.log('\n  PRICE axis (h-line)              TIME axis (label)            canvas');
    rows.forEach(r => { const dy = (r.expY == null || r.painted == null) ? null : Math.abs(r.expY - r.painted);
      const dx = (r.expX == null || r.textX == null) ? null : Math.abs(r.expX - r.textX);
      const dy2 = (r.expY2 == null || r.textY == null) ? null : Math.abs(r.expY2 - r.textY);
      console.log(`   ${String(r.tag).padEnd(38)} y ${String(r.expY).padStart(4)}/${String(r.painted).padStart(4)} d=${dy}   x ${String(r.expX).padStart(4)}/${String(r.textX).padStart(4)} d=${dx} y2 d=${dy2}   css ${r.canvasCssH} bmp ${r.bitmapH} dr ${r.drH}${(dy > 3 || dx > 6) ? '  <-- NOT GLUED' : ''}`); });
    await page.screenshot({ path: path.join(__dirname, 'vault-shots', 'glue.png') });
    await ctx.close();
    const bad = rows.filter(r => { const dy = (r.expY == null || r.painted == null) ? 99 : Math.abs(r.expY - r.painted); const dx = (r.expX == null || r.textX == null) ? 99 : Math.abs(r.expX - r.textX); return dy > 3 || dx > 6; });
    console.log('  ' + (rows.length - bad.length) + ' of ' + rows.length + ' states glued' + (bad.length ? ' - FAILED on: ' + bad.map(r => r.tag).join(', ') : ''));
    process.exitCode = bad.length ? 1 : 0;
  });
})();
