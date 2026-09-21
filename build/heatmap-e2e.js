// heatmap-e2e.js - the liquidation heatmap, desktop and phone.
//
// There was no test for this page at all until 2026-09-18, which is how a product named "heatmap" spent months
// drawing no heat: of 650 standing zones only 7 rendered above alpha 0.5 and 312 under 0.1, and nothing anywhere
// would have noticed. The checks that matter here are the ones that would have caught that - the field has a
// mid-tone, the price action keeps its share of the plot, the axes are outside the drawing, and on a phone the
// map actually gets the screen.
//
// Usage: node build/heatmap-e2e.js [--local]
//   --local serves dist/assets/mp-heatmap.js from the working tree, for a pre-deploy check.
//
// NOTE: Network.setBypassServiceWorker must be sent AFTER setRequestInterception (which enables the Network
// domain). Sent first it is silently ignored and sw.js answers from Cache Storage - the run then grades whatever
// is in the cache while reporting on the local file.

const { withBrowser } = require('./e2e-browser.js');
const fs = require('fs'), path = require('path');
const ADMIN = (() => { try { return (fs.readFileSync(path.join(__dirname, '..', 'ADMIN_KEY.local.txt'), 'utf8').match(/mpadm_[a-z0-9]+/i) || [''])[0]; } catch (e) { return ''; } })();

const LOCAL = process.argv.includes('--local');
const BUNDLE = path.join(__dirname, '..', 'dist', 'assets', 'mp-heatmap.js');
const SRC = LOCAL ? fs.readFileSync(BUNDLE, 'utf8') : null;
const URL_ = 'https://marginpad.io/heatmap?nc=1';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail != null ? '  -> ' + detail : '')); }
};

async function open(browser, vp, ua) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  if (ua) await page.setUserAgent(ua);
  await page.setRequestInterception(true);
  const cdp = await page.target().createCDPSession();
  await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  page.on('request', r => {
    if (SRC && /\/assets\/mp-heatmap\.js/.test(r.url())) r.respond({ status: 200, contentType: 'application/javascript', body: SRC });
    else r.continue();
  });
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 });
  // the map needs klines + liquidations + pools + price before it has anything to draw
  await page.waitForFunction('window.__mpHeat && window.__mpHeat.state() && window.__mpHeat.state().bands > 0', { timeout: 45000 });
  await new Promise(r => setTimeout(r, 3500));
  return { page, errs };
}

const LAYOUT = () => {
  const bb = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), bottom: Math.round(r.bottom) }; };
  const nav = document.querySelector('.mpbn');
  const taps = [...document.querySelectorAll('.hm-bar select, .hm-bar button')].map(e => { const r = e.getBoundingClientRect(); return { t: (e.options ? e.options[e.selectedIndex].text : (e.textContent || e.title || '')).trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; });
  return {
    vw: innerWidth, vh: innerHeight,
    scrollW: document.documentElement.scrollWidth, pageH: document.documentElement.scrollHeight,
    cv: bb('.hm-cv'), pf: bb('.hm-prof'), stage: bb('.hm-stage'), bar: bb('.hm-bar'),
    // BOOK & FLOW: the measured panel joined under the map (2026-09-21). It also carries the map's legend,
    // which used to be a row of its own above the chart - so the legend check moved here with it.
    bk: bb('.hm-bk'), bkNote: bb('.hm-bk-n'),
    bkChips: [...document.querySelectorAll('[data-bv]')].map(function (b) { return b.textContent; }),
    bkNoteTxt: (document.querySelector('.hm-bk-n') || {}).innerText || '',
    bkAsks: document.querySelectorAll('.hm-ob-a .hm-ob-row').length,
    bkBids: document.querySelectorAll('.hm-ob-b .hm-ob-row').length,
    bkTrades: document.querySelectorAll('.hm-tp-row').length,
    bkSegs: document.querySelectorAll('.hm-ob-row .vs em').length,
    bkTapeCols: (function () { var r = document.querySelector('.hm-tp-row'); return r ? r.children.length : 0; })(),
    bkHeads: [...document.querySelectorAll('.hm-col-h')].map(function (h) { return h.innerText.replace(/s+/g, ' '); }),
    // A LADDER THAT IS CROSSED IS A BROKEN LADDER, and merging five venues by absolute price produces one
    // (measured: Hyperliquid traded $73 above the other four). This reads the prices off the DOM.
    bkCross: (function () {
      var n = function (e) { return +String(e.querySelector('.p').textContent).replace(/,/g, ''); };
      var a = [...document.querySelectorAll('.hm-ob-a .hm-ob-row')].map(n);
      var b2 = [...document.querySelectorAll('.hm-ob-b .hm-ob-row')].map(n);
      if (!a.length || !b2.length) return null;
      return { lowAsk: a[a.length - 1], highBid: b2[0], asksDown: a.every(function (v, i, r) { return !i || v < r[i - 1]; }), bidsDown: b2.every(function (v, i, r) { return !i || v < r[i - 1]; }) };
    })(),
    navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
    taps,
    barGroups: document.querySelectorAll('.hm-bar-a, .hm-bar-b').length,
    tgRows: [...document.querySelectorAll('.hm-tg-r')].map(r => ({
      lab: r.querySelector('.hm-tg-d').textContent,
      sides: [...r.querySelectorAll('.hm-tgb')].map(b => b.classList.contains('l') ? 'long' : 'short')
    })),
    wide: [...document.querySelectorAll('.hm-wrap *')].filter(e => e.getBoundingClientRect().width > innerWidth + 2).length,
    extStacked: document.querySelectorAll('.hm-ext-r2').length,
    extGrid: document.querySelectorAll('.hm-ext-r').length,
    ctCols: document.querySelector('.hm-ct-hd') ? document.querySelector('.hm-ct-hd').children.length : 0,
    footOpen: [...document.querySelectorAll('details.hm-foot-c')].filter(d => d.open).length,
    footTotal: document.querySelectorAll('details.hm-foot-c').length,
    mastTxt: (document.querySelector('.hm-mast-s') || {}).textContent || '',
    prevInMast: !!document.querySelector('.hm-mast-b .hm-prevrib'),
    mastLines: (() => { const t = document.querySelector('.hm-mast-t'), b = document.querySelector('.hm-mast-b'); return t && b ? Math.round(t.getBoundingClientRect().height + b.getBoundingClientRect().height) : 0; })(),
    mastTitleH: (() => { const t = document.querySelector('.hm-mast-t'); return t ? Math.round(t.getBoundingClientRect().height) : 0; })(),
    tgGap: (() => { const t = document.querySelector('.hm-targets'), st = document.querySelector('.hm-stage'); if (!t || !st) return null; const a = t.getBoundingClientRect(), b2 = st.getBoundingClientRect(); return Math.round(a.top > b2.top ? a.top - b2.bottom : b2.top - a.bottom); })()
  };
};

(async () => {
  console.log('heatmap-e2e ' + (LOCAL ? '(local bundle)' : '(production)') + '\n');

  // ---- desktop ------------------------------------------------------------------------------------------
  await withBrowser(async (browser) => {
    console.log('desktop 1366x768');
    const { page, errs } = await open(browser, { width: 1366, height: 768 });
    const L = await page.evaluate(LAYOUT);
    const S = await page.evaluate(() => window.__mpHeat.state());

    ok('no page or console errors', errs.length === 0, errs.join(' | '));
    ok('the map renders standing bands', S.bands > 5, 'bands=' + S.bands);

    // THE central regression: a heat field with no mid-tone is the bug this whole pass existed to fix.
    const levels = [S.bandsFaint, S.bandsMid, S.bandsStrong].filter(n => n > 0).length;
    ok('the heat field occupies more than one level', levels >= 2,
      'faint=' + S.bandsFaint + ' mid=' + S.bandsMid + ' strong=' + S.bandsStrong);
    ok('the heaviest band on screen is bright', S.maxAlpha > 0.6, 'maxAlpha=' + S.maxAlpha);
    ok('and it is a real multiple of the lightest, so weight stays readable', S.minAlpha > 0 && S.maxAlpha / S.minAlpha >= 2.5,
      'max=' + S.maxAlpha + ' min=' + S.minAlpha + ' ratio=' + (S.minAlpha ? (S.maxAlpha / S.minAlpha).toFixed(1) : 'n/a'));
    ok('the field is mostly dark, so a heavy band means something', S.bandsStrong / Math.max(1, S.bands) < 0.5,
      'strong share=' + (S.bandsStrong / Math.max(1, S.bands)).toFixed(2));

    // THE LOAD-BEARING ONE. Zoom the price axis hard into a narrow window - the way a reader does, by dragging the
    // zones column - so the heaviest band in the whole model is certainly off screen, then require the heaviest
    // band that IS on screen to still be bright. That is exactly what scaling to a global maximum cannot do, and
    // exactly the bug this page shipped with: bands measured against something the reader could not see, leaving
    // the visible field at 3-10% opacity. A "does the field have a mid-tone" check alone passes with the broken
    // curve - verified by restoring it - so it proves nothing on its own.
    const drag = async (d) => {
      await page.evaluate((dd) => {
        const pf = document.querySelector('.hm-prof'), r = pf.getBoundingClientRect();
        const y0 = r.top + r.height / 2;
        pf.dispatchEvent(new MouseEvent('mousedown', { clientY: y0, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mousemove', { clientY: y0 + dd, bubbles: true }));
        window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      }, d);
      await new Promise(r => setTimeout(r, 400));
    };
    // tighten in steps and stop at the last window that still holds bands - an empty window proves nothing
    let Z = S;
    for (let i = 0; i < 4; i++) {
      await drag(-150);
      const z = await page.evaluate(() => window.__mpHeat.state());
      if (!z.bands) { await drag(150); Z = await page.evaluate(() => window.__mpHeat.state()); break; }
      Z = z;
      if ((Z.yHi - Z.yLo) < (S.yHi - S.yLo) * 0.4) break;
    }
    ok('zooming the price axis narrows the visible range', (Z.yHi - Z.yLo) < (S.yHi - S.yLo) * 0.5,
      'range ' + Math.round(S.yHi - S.yLo) + ' -> ' + Math.round(Z.yHi - Z.yLo));
    ok('the heaviest band on screen is bright even when the model maximum is not', Z.bands > 0 && Z.maxAlpha > 0.6,
      'bands=' + Z.bands + ' maxAlpha=' + Z.maxAlpha);
    await page.evaluate(() => { const pf = document.querySelector('.hm-prof'); pf.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })); });
    await new Promise(r => setTimeout(r, 500));

    // the axes live outside the plot
    ok('the plot leaves a strip for the time axis', S.plotH > 0 && S.plotH < S.canvasH && S.canvasH - S.plotH >= 12,
      'plotH=' + S.plotH + ' canvasH=' + S.canvasH);
    ok('the price axis has its own column', L.pf && L.pf.w >= 90, 'profile w=' + (L.pf && L.pf.w));

    ok('the whole map is visible without scrolling', L.stage.bottom <= L.vh, 'stage bottom=' + L.stage.bottom + ' vh=' + L.vh);
    ok('the control bar is two named groups', L.barGroups === 2, 'groups=' + L.barGroups);
    ok('the masthead states the measured venue count', /9 exchanges/.test(L.mastTxt), L.mastTxt.slice(0, 80));
    ok('the foot cards are open on a desktop', L.footTotal === 3 && L.footOpen === 3, L.footOpen + '/' + L.footTotal);
    ok('nothing in the section overflows the viewport', L.wide === 0, 'wide=' + L.wide);
    ok('the exchange table is a grid on a desktop', L.extGrid > 0 && L.extStacked === 0, 'grid=' + L.extGrid + ' stacked=' + L.extStacked);
    ok('the coin table shows all four windows on a desktop', L.ctCols === 11, 'cols=' + L.ctCols);

    // TARGETS: above must be shorts, below must be longs - the fact the block exists to state
    const above = L.tgRows.find(r => /ABOVE/.test(r.lab)), below = L.tgRows.find(r => /BELOW/.test(r.lab));
    ok('TARGETS has a labelled ABOVE row', !!above);
    ok('TARGETS has a labelled BELOW row', !!below);
    ok('every ABOVE target is a short zone', above && above.sides.length > 0 && above.sides.every(x => x === 'short'), above && above.sides.join(','));
    ok('every BELOW target is a long zone', below && below.sides.length > 0 && below.sides.every(x => x === 'long'), below && below.sides.join(','));

    // a target chip moves the view to its zone
    const before = await page.evaluate(() => { const s = window.__mpHeat.state(); return { lo: s.yLo, hi: s.yHi, viewed: s.yViewed }; });
    await page.evaluate(() => document.querySelector('.hm-tg-r .hm-tgb').click());
    await new Promise(r => setTimeout(r, 900));
    const after = await page.evaluate(() => { const s = window.__mpHeat.state(); return { lo: s.yLo, hi: s.yHi, viewed: s.yViewed, sel: !!document.querySelector('.hm-selbox') && getComputedStyle(document.querySelector('.hm-selbox')).display !== 'none' }; });
    ok('tapping a target moves the price view to it', after.viewed && (after.lo !== before.lo || after.hi !== before.hi),
      JSON.stringify(before) + ' -> ' + JSON.stringify(after));
    ok('tapping a target explains it in the readout', after.sel);

    // the dot filter is honoured by what is drawn
    const d0 = (await page.evaluate(() => window.__mpHeat.state())).dotsDrawn;
    await page.select('.hm-bar-a select:nth-of-type(1) ~ select', '250000').catch(() => {});
    await page.evaluate(() => { const s = [...document.querySelectorAll('.hm-bar select')][2]; s.value = '250000'; s.dispatchEvent(new Event('change')); });
    await new Promise(r => setTimeout(r, 900));
    const d1 = (await page.evaluate(() => window.__mpHeat.state())).dotsDrawn;
    ok('raising the dot threshold draws fewer liquidations', d1 < d0 || d0 === 0, d0 + ' -> ' + d1);
    await page.evaluate(() => { const s = [...document.querySelectorAll('.hm-bar select')][2]; s.value = '-1'; s.dispatchEvent(new Event('change')); });
    await new Promise(r => setTimeout(r, 900));
    const d2 = (await page.evaluate(() => window.__mpHeat.state())).dotsDrawn;
    ok('turning dots off draws none', d2 === 0, 'drawn=' + d2);

    await page.close();
  }, { timeoutMs: 230000 });

  // ---- phone --------------------------------------------------------------------------------------------
  await withBrowser(async (browser) => {
    console.log('\nphone 390x844');
    const { page, errs } = await open(browser, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, IPHONE);
    const L = await page.evaluate(LAYOUT);
    const S = await page.evaluate(() => window.__mpHeat.state());

    ok('no page or console errors', errs.length === 0, errs.join(' | '));
    ok('the map gets the screen (canvas >= 300px of 390)', L.cv.w >= 300, 'canvas=' + L.cv.w);
    ok('the stage runs edge to edge', L.stage.x <= 1 && L.stage.w >= L.vw - 1, JSON.stringify(L.stage));
    ok('the whole map clears the fixed tab bar', L.stage.bottom <= L.vh - L.navH, 'bottom=' + L.stage.bottom + ' limit=' + (L.vh - L.navH));
    ok('every control is at least 29px tall', L.taps.length > 0 && L.taps.every(t => t.h >= 29), JSON.stringify(L.taps.filter(t => t.h < 29)));
    ok('no control is narrower than 29px', L.taps.every(t => t.w >= 29), JSON.stringify(L.taps.filter(t => t.w < 29)));
    ok('the title keeps one line, with LIVE on the row below it', L.mastTitleH > 0 && L.mastTitleH < 30, 'title h=' + L.mastTitleH);
    ok('TARGETS is joined to the map, not floating beside it', L.tgGap === 0, 'gap=' + L.tgGap);
    // The panel is the measured half of this page and must never look like part of the model above it.
    ok('the order-book panel is there and joined under the map', !!L.bk && L.bk.w >= L.vw - 2, JSON.stringify(L.bk));
    ok('the ladder has rows on both sides', L.bkAsks >= 5 && L.bkBids >= 5, 'asks=' + L.bkAsks + ' bids=' + L.bkBids);
    ok('and the tape has prints', L.bkTrades >= 5, 'trades=' + L.bkTrades);
    ok('the ladder is NOT crossed and runs high to low', !!L.bkCross && L.bkCross.highBid < L.bkCross.lowAsk && L.bkCross.asksDown && L.bkCross.bidsDown, JSON.stringify(L.bkCross));
    ok('every exchange can be picked, and all of them together', L.bkChips[0] === 'All' && L.bkChips.length >= 5, L.bkChips.join(','));
    ok('it explains how to read itself', /How to read it/i.test(L.bkNoteTxt) && /Sum/.test(L.bkNoteTxt) && /crossed the spread/.test(L.bkNoteTxt), L.bkNoteTxt.slice(0, 90));
    ok('and says which half of the page is measured', /not modelled|none of (this|it) is modelled/i.test(L.bkNoteTxt), L.bkNoteTxt.slice(-110));
    // The three additions the owner asked for: the venue strip under each row, the value of every print,
    // and prints that are far bigger than the rest standing out without being hunted for.
    ok('each ladder row shows WHICH exchanges hold that price', L.bkSegs >= L.bkAsks + L.bkBids, 'segments=' + L.bkSegs + ' rows=' + (L.bkAsks + L.bkBids));
    ok('every print carries its dollar value and its venue', L.bkTapeCols >= 5, 'tape columns=' + L.bkTapeCols);
    ok('the three columns say what they answer', L.bkHeads.length === 3 && /ORDER BOOK/.test(L.bkHeads[0]) && /TAPE/.test(L.bkHeads[1]) && /READ/.test(L.bkHeads[2]), L.bkHeads.join(' / '));
    ok('the page never scrolls sideways', L.scrollW <= L.vw, 'scrollW=' + L.scrollW);
    ok('nothing in the section is wider than the screen', L.wide === 0, 'wide=' + L.wide);
    ok('the exchange table is stacked, not a clipped grid', L.extStacked > 0 && L.extGrid === 0, 'stacked=' + L.extStacked + ' grid=' + L.extGrid);
    ok('the coin table shows the selected window only', L.ctCols === 5, 'cols=' + L.ctCols);
    ok('the prose is collapsed behind disclosures', L.footTotal === 3 && L.footOpen === 0, L.footOpen + '/' + L.footTotal);
    ok('the Premium countdown is in the masthead, not over the map', L.prevInMast);
    ok('the plot leaves a strip for the time axis', S.plotH < S.canvasH && S.canvasH - S.plotH >= 10, 'plotH=' + S.plotH + ' canvasH=' + S.canvasH);
    ok('the heat field occupies more than one level', [S.bandsFaint, S.bandsMid, S.bandsStrong].filter(n => n > 0).length >= 2,
      'faint=' + S.bandsFaint + ' mid=' + S.bandsMid + ' strong=' + S.bandsStrong);
    ok('the heaviest band on screen is bright', S.maxAlpha > 0.6, 'maxAlpha=' + S.maxAlpha);

    // THE READOUT HAS TO LAND WHERE THE READER IS LOOKING, AND NOT ON WHAT THEY TOUCHED. Pinned top-left it
    // covered the band it was explaining; pinned to the bottom of the VIEWPORT it could sit 300px below the
    // circle the finger just touched, which on a phone reads as "nothing happened". It is inside the map, in
    // the half opposite the touch.
    const tapHalf = async (frac) => {
      await page.evaluate(() => { const sb = document.querySelector('.hm-selbox'); if (sb) sb.style.display = 'none'; });
      const b = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      await page.touchscreen.tap(b.x + b.w * 0.55, b.y + b.h * frac);
      await new Promise(r => setTimeout(r, 400));
      return await page.evaluate(() => {
        const sb = document.querySelector('.hm-selbox');
        if (!sb || getComputedStyle(sb).display === 'none') return { shown: false };
        const r = sb.getBoundingClientRect(), st = document.querySelector('.hm-stage').getBoundingClientRect();
        return { shown: true, lo: sb.classList.contains('lo'), inside: r.top >= st.top - 2 && r.bottom <= st.bottom + 2,
          midFrac: (r.top + r.height / 2 - st.top) / st.height, txt: sb.textContent.slice(0, 40) };
      });
    };
    const hiTap = await tapHalf(0.25), loTap = await tapHalf(0.72);
    ok('a tap on the map opens the readout', hiTap.shown && loTap.shown, { hi: hiTap.shown, lo: loTap.shown });
    ok('the readout stays inside the map, where the reader is looking', hiTap.inside && loTap.inside, { hi: hiTap, lo: loTap });
    ok('touching the top half puts it low, touching the bottom half puts it high', hiTap.midFrac > 0.5 && loTap.midFrac < 0.5,
      { afterTopTap: +hiTap.midFrac.toFixed(2), afterBottomTap: +loTap.midFrac.toFixed(2) });

    await page.close();
  }, { timeoutMs: 230000 });

  // ---- picking things off the map ------------------------------------------------------------------------
  // Three owner reports, all of them about the same surface. On a phone Chrome fires compatibility mouse events
  // after a tap, which raised the DESKTOP hover tip - white-space:nowrap, and much wider since it gained the
  // ratio and measured-dollars lines - so its own flip-to-the-left rule pushed it off the canvas and the reader
  // saw the second half of every line. And a click collected dots within a flat 16px of their CENTRES while a
  // drawn dot can be 10px in radius, so two circles that visibly overlap never clustered.
  console.log('\npicking');
  await withBrowser(async (browser) => {
    const { page } = await open(browser, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, IPHONE);
    await page.evaluate(() => { const s = [...document.querySelectorAll('.hm-bar select')][2]; s.value = '0'; s.dispatchEvent(new Event('change')); });
    await new Promise(r => setTimeout(r, 2500));
    const box = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    let tipEver = false, cluster = null, anySel = false;
    outer:
    for (let fy = 0.38; fy <= 0.60; fy += 0.03) for (let fx = 0.20; fx <= 0.92; fx += 0.04) {
      await page.touchscreen.tap(box.x + box.w * fx, box.y + box.h * fy);
      await new Promise(r => setTimeout(r, 90));
      const st = await page.evaluate(() => {
        const t = document.querySelector('.hm-tip'), sb = document.querySelector('.hm-selbox');
        const shownSb = sb && getComputedStyle(sb).display !== 'none';
        return {
          tip: !!(t && getComputedStyle(t).display !== 'none'),
          tipLeft: t ? Math.round(t.getBoundingClientRect().left) : null,
          sel: shownSb ? (sb.querySelector('.hm-cl-list') ? 'clu' : 'one') : null,
          n: shownSb ? sb.querySelectorAll('.hm-cl-it[data-ci]').length : 0,
          boxL: shownSb ? Math.round(sb.getBoundingClientRect().left) : null
        };
      });
      if (st.tip) tipEver = true;
      if (st.sel) anySel = true;
      if (st.sel === 'clu') { cluster = st; break outer; }
    }
    ok('a tap never raises the desktop hover tip', !tipEver);
    ok('a tap selects something', anySel);
    ok('and a tap into a dense patch opens the list, not one liquidation', !!cluster && cluster.n >= 2, cluster);
    ok('the readout starts on screen, not half off the left edge', !cluster || cluster.boxL >= 0, cluster && cluster.boxL);
    await page.close();
  }, { timeoutMs: 230000 });

  await withBrowser(async (browser) => {
    const { page } = await open(browser, { width: 1366, height: 900 });
    await page.evaluate(() => { const s = [...document.querySelectorAll('.hm-bar select')][2]; s.value = '0'; s.dispatchEvent(new Event('change')); });
    await new Promise(r => setTimeout(r, 2500));
    const box = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    // CLICK WHERE THE DOTS ARE, NOT ON A BLIND GRID. Liquidations hug the price line, so most of the canvas is
    // empty: measured, 208 of 210 grid clicks collected zero dots while the two that landed on the ribbon
    // collected two each. A grid made this a weather report - it passed on a busy day and failed on a quiet one
    // while the code was identical. The sweep follows the live price line, which is where the data lives.
    let biggest = 0, offEdge = 0, tried = 0;
    const yOfPrice = await page.evaluate(() => {
      const s = window.__mpHeat.state();
      if (!(s.price > 0) || !(s.yHi > s.yLo)) return null;
      return s.plotH * (1 - (s.price - s.yLo) / (s.yHi - s.yLo));
    });
    for (let fx = 0.10; fx <= 0.96 && yOfPrice != null; fx += 0.012) {
      for (const dy of [-14, 0, 14, 28, -28]) {
        const y = box.y + yOfPrice + dy;
        if (y < box.y + 4 || y > box.y + box.h - 4) continue;
        await page.mouse.move(box.x + box.w * fx, y);
        await new Promise(r => setTimeout(r, 18));
        const t = await page.evaluate(() => { const e = document.querySelector('.hm-tip'); if (!e || getComputedStyle(e).display === 'none') return null; const r = e.getBoundingClientRect(); const c = document.querySelector('.hm-cv').getBoundingClientRect(); return { l: Math.round(r.left - c.left), r: Math.round(c.right - r.right) }; });
        if (t && (t.l < 0 || t.r < 0)) offEdge++;
        await page.mouse.click(box.x + box.w * fx, y);
        await new Promise(r => setTimeout(r, 22));
        const n = await page.evaluate(() => window.__mpHeat.state().lastHits);
        tried++;
        if (n > biggest) biggest = n;
      }
    }
    ok('clicking a dot on the price line collects the circles around it, not just one', biggest >= 2,
      JSON.stringify({ clicks: tried, mostCollected: biggest }));
    const rad = await page.evaluate(() => { const s = window.__mpHeat.state(); return { small: s.hitRadius(1000), mid: s.hitRadius(50000), big: s.hitRadius(5000000) }; });
    ok('a small dot is never harder to hit than the flat radius it replaced', rad.small >= 16, JSON.stringify(rad));
    ok('and a big dot reaches further, so overlapping circles collect together', rad.big > rad.small && rad.big >= 18, JSON.stringify(rad));
    ok('the hover tip never hangs off either edge of the canvas', offEdge === 0, offEdge);
    await page.close();
  }, { timeoutMs: 280000 });

  // ---- copy that has to agree with itself ---------------------------------------------------------------
  console.log('\ncopy');
  const src = SRC || await (await fetch('https://marginpad.io/assets/mp-heatmap.js?cb=' + Date.now())).text();
  ok('the venue count is stated once and correctly', !/11 venues/.test(src) && /9 exchanges/.test(src));
  ok('the share card is not misspelled', !/exchangess/.test(src));
  ok('the paywall sells the four indicators that exist', !/8 exclusive AI indicators/.test(src) && /4 exclusive AI indicators/.test(src));
  const html = await (await fetch(URL_ + '&cb=' + Date.now())).text();
  ok('the page does not claim the heatmap has no paywall', !/no paywall on models/.test(html));
  ok('the page states the real allowance', /five minutes every 12 hours/.test(html));

  // ---- the paywall, both sides of it --------------------------------------------------------------------
  // signedIn came back from /api/premium/status, was assigned and never read once, so a member who already holds
  // Premium on an account they were not signed into here saw a buy button and no way in. A guest gets the
  // sign-in path; a signed-in member without Premium gets the buy path alone, which is the only one that helps.
  console.log('\npaywall');
  const wall = async (cookie) => {
    let out = null;
    await withBrowser(async (browser) => {
      const page = await browser.newPage();
      await page.setViewport({ width: 1366, height: 768 });
      await page.setRequestInterception(true);
      const cdp = await page.target().createCDPSession();
      await cdp.send('Network.setBypassServiceWorker', { bypass: true });
      page.on('request', r => {
        if (SRC && /\/assets\/mp-heatmap\.js/.test(r.url())) r.respond({ status: 200, contentType: 'application/javascript', body: SRC });
        else r.continue();
      });
      if (cookie) await page.setCookie({ name: 'mp_sess', value: cookie, domain: 'marginpad.io', path: '/' });
      // a preview already spent, so the wall paints at once instead of five minutes from now
      await page.evaluateOnNewDocument(() => { try { localStorage.setItem('mp_hm_lock', String(Date.now() - 3600000)); } catch (e) {} });
      await page.goto(URL_, { waitUntil: 'networkidle2', timeout: 60000 });
      await page.waitForSelector('.hm-paywall', { timeout: 30000 }).catch(() => {});
      out = await page.evaluate(() => {
        const w = document.querySelector('.hm-paywall');
        return w ? { shown: true, signIn: !!w.querySelector('.hm-pw-in'), buy: !!w.querySelector('.hm-pw-btn'), txt: w.textContent } : { shown: false };
      });
      if (out.shown && out.signIn) { // the sign-in path must not fall through to the checkout page
        await page.evaluate(() => document.querySelector('.hm-pw-in').click());
        await new Promise(r => setTimeout(r, 1200));
        out.stayed = !/\/premium/.test(await page.evaluate(() => location.pathname));
      }
      await page.close();
    }, { timeoutMs: 150000 });
    return out;
  };
  const g = await wall(null);
  ok('a guest hits the wall', g.shown);
  ok('a guest is offered the sign-in path', g.signIn, g.txt);
  ok('and the buy path', g.buy);
  ok('clicking sign in does not fall through to /premium', g.stayed === true);
  ok('the wall says when the free preview returns', /Free preview again in/.test(g.txt || ''), g.txt);
  if (ADMIN) {
    const uid = 'e2ehm' + Math.random().toString(36).slice(2, 6);
    const H = { 'x-admin-key': ADMIN, 'content-type': 'application/json' };
    const po = (p2, b2) => fetch('https://marginpad.io' + p2, { method: 'POST', headers: H, body: JSON.stringify(b2) }).then(r => r.json().catch(() => ({})));
    await po('/api/admin/e2euser', { uid, op: 'mk' });
    const se = await po('/api/admin/e2euser', { uid, op: 'sess' });
    const m = se && se.token ? await wall(se.token) : null;
    ok('a signed-in member without Premium hits the wall', m && m.shown, m && m.txt);
    ok('and is NOT asked to sign in again', m && m.shown && !m.signIn, m && m.txt);
    await po('/api/admin/e2euser', { uid, op: 'rm' });
  } else {
    console.log('  skip the member half (no ADMIN_KEY.local.txt)');
  }

  console.log('\nheatmap-e2e: ' + pass + ' passed, ' + fail + ' failed');
  // process.exit() here aborts inside libuv while the harness is still tearing the browser down, and the shell
  // then sees 127 rather than 0 or 1 - a green run that every batch runner would read as a failure. Set the code
  // and let the loop drain. (The mirror of the spot-e2e-contract trap: a suite that printed "fail 1" and exited 0.)
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error('heatmap-e2e crashed: ' + (e && e.stack || e)); process.exitCode = 1; });
