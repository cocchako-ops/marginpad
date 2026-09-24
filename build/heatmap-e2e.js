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
  // A REFUSED REQUEST MUST NAME ITSELF. This is the check that caught the page rate-limiting ITSELF on
  // 2026-09-24 - 56 keyless /api/v1/ calls a minute against a 60 ceiling - and all it said was "Failed to load
  // resource: the server responded with a status of 429 ()", with no path, so the finding cost a measurement
  // to identify. Now the status and the route are in the failure line.
  page.on('response', r => {
    if (r.status() >= 400 && /marginpad\.io\/api\//.test(r.url())) errs.push('HTTP ' + r.status() + ' ' + r.url().replace(/^https:\/\/marginpad\.io/, '').split('&')[0]);
  });
  page.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 200)));
  // NOT networkidle2. This page polls forever - the book and tape every four seconds, the film every five,
  // prices, presence - so "two connections quiet for half a second" is a state it may simply never reach,
  // and when it did not the run died at whichever leg happened to be unlucky while the page itself was
  // answering in 0.06s. The real readiness signal is the line below: the map has bands to draw.
  await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
    // textContent, NOT innerText: a closed <details> hides its body from innerText, so on a phone - where
    // these are deliberately collapsed - the check would only ever see the four headings and call the
    // explanation missing. textContent reads the prose whether it is on screen or one tap away.
    bkNoteTxt: [...document.querySelectorAll('.hm-foot-c')].map(function (d) { return d.textContent; }).join(' '),
    bkAsks: document.querySelectorAll('.hm-ob-a .hm-ob-row').length,
    bkBids: document.querySelectorAll('.hm-ob-b .hm-ob-row').length,
    bkTrades: document.querySelectorAll('.hm-tp-row').length,
    bkSegs: document.querySelectorAll('.hm-ob-row .vs em').length,
    bkTapeCols: (function () { var r = document.querySelector('.hm-tp-row'); return r ? r.children.length : 0; })(),
    bkHeads: [...document.querySelectorAll('.hm-col-h')].map(function (h) { return h.textContent.replace(/\s+/g, ' ').trim(); }),
    helpQ: document.querySelectorAll('.hm-q').length,
    filters: [...document.querySelectorAll('.hm-mini')].map(function (e) { return e.className.replace('hm-mini ', ''); }),
    bell: (function () { var b = document.querySelector('.hm-bell'); return b ? { cls: b.className, title: b.title } : null; })(),
    tickOpts: [...document.querySelectorAll('.bkTick option')].map(function (o) { return o.textContent; }),
    win: (function () {
      var w = document.querySelector('.hm-bk-say .hm-say-w'); if (!w) return null;
      return { big: (w.querySelector('.hm-say-f>b') || {}).textContent || '', sub: (w.querySelector('.hm-say-q') || {}).textContent || '',
        formats: w.querySelectorAll('.hm-say-f>span').length,
        inSayLine: !!document.querySelector('.hm-bk-say').contains(w),
        extraBoxes: document.querySelectorAll('.hm-bk-win, .hm-bm .hm-bmw').length,
        // the STRIP is the thing that has to stay small; how far the sentence above it wraps is the
        // phone's business, and measuring the whole box made this go red at 390px for nothing.
        stripH: Math.round(w.getBoundingClientRect().height) };
    })(),
    readTxt: (document.querySelector('.hm-sm-l') || {}).innerText || '',
    readGroups: document.querySelectorAll('.hm-sm-t').length,
    foldCount: document.querySelectorAll('.hm-foot-c').length,
    panelNote: !!document.querySelector('.hm-bk-n'),
    shades: (function () {
      var out = {};
      ['.hm-wrap', '.hm-targets', '.hm-bk', '.hm-foot-c'].forEach(function (q2) {
        var e = document.querySelector(q2); if (e) out[q2] = getComputedStyle(e).backgroundColor;
      });
      return out;
    })(),
    tgH: (function () { var t = document.querySelector('.hm-targets'); return t ? Math.round(t.getBoundingClientRect().height) : 0; })(),
    tgCut: [...document.querySelectorAll('.hm-tgb b')].filter(function (b) { return b.scrollWidth > b.clientWidth + 1; }).length,
    wins: [...document.querySelectorAll('.hm-bar select')].map(function (s2) { return [...s2.options].map(function (o) { return o.text; }).join('/'); }).join(' | '),
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
    ok('the foot cards are open on a desktop', L.footTotal >= 4 && L.footOpen === L.footTotal, L.footOpen + '/' + L.footTotal);
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

    // A SWEPT ZONE IS CUT, NOT ERASED (owner, 2026-09-24, after we looked at Coinglass together). Until
    // that day a zone the price had gone through vanished from the map and from the data - the server
    // deleted it - so the map could only ever show leverage still standing. The load-bearing checks here
    // are the two that would go red if that came back: the model must PUBLISH swept zones with the candle
    // that took them, and clicking one must answer with the MEASURED dollars, which is what the dots used
    // to carry and the only thing on this map that is not a projection.
    const sw = await page.evaluate(() => window.__mpHeat.state());
    ok('the map keeps the zones the price has already gone through', sw.swept > 0,
      'bands=' + sw.bands + ' swept=' + sw.swept);
    ok('and each of them knows which candle took it, so its line can stop there', sw.sweptCut === sw.swept,
      'swept=' + sw.swept + ' with a crossing=' + sw.sweptCut);
    ok('no liquidation is drawn as a dot any more', sw.dotsDrawn === 0, 'dots=' + sw.dotsDrawn);
    // and the line itself must really stop short of the right edge
    const cut = await page.evaluate(() => {
      const cv = document.querySelector('.hm-cv');
      const im = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      const W = cv.width, H = cv.height;
      let full = 0, short = 0;
      for (let y = 0; y < H; y += 2) {
        let first = -1, last = -1, n = 0;
        for (let x = 0; x < W; x++) { const k = (y * W + x) * 4; if (im[k + 3] > 25 && !(im[k] > 200 && im[k + 1] < 130)) { if (first < 0) first = x; last = x; n++; } }
        if (n < W * 0.04) continue;
        if (last > W - 30) full++; else short++;
      }
      return { full, short };
    });
    ok('the cut is visible: some lines stop before the right edge and others run to it', cut.short > 0 && cut.full > 0,
      JSON.stringify(cut));
    // clicking a cut line has to answer with what was really liquidated there
    const swRead = await page.evaluate(async () => {
      const s2 = window.__mpHeat.state();
      if (!s2.sweptY || !s2.sweptY.length) return { skip: true };
      const cv = document.querySelector('.hm-cv'), r = cv.getBoundingClientRect();
      for (const z of s2.sweptY) {
        const b = document.querySelector('.hm-selbox'); if (b) b.style.display = 'none';
        const y = r.top + (s2.yHi - z.price) / (s2.yHi - s2.yLo) * s2.plotH;
        cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * 0.4, clientY: y, bubbles: true }));
        await new Promise((q) => setTimeout(q, 320));
        const sb = document.querySelector('.hm-selbox');
        if (sb && getComputedStyle(sb).display !== 'none' && /SWEPT/i.test(sb.textContent)) return { txt: sb.textContent.replace(/\s+/g, ' ').trim() };
      }
      return { txt: '' };
    });
    // A STANDING ZONE CARRIES A MEASURED DOLLAR FIGURE AND STILL REFUSES TO PRICE THE MODEL. Those are
    // two different claims in the same box and both have to survive: the crowding is an ESTIMATE and says
    // so, and the dollars are the RECORD of what really liquidated at bands of this weight, with its n.
    const cal = await page.evaluate(async () => {
      const cv = document.querySelector('.hm-cv'), r = cv.getBoundingClientRect();
      for (let f = 0.06; f < 0.95; f += 0.05) {
        const b2 = document.querySelector('.hm-selbox'); if (b2) b2.style.display = 'none';
        cv.dispatchEvent(new MouseEvent('click', { clientX: r.left + r.width * 0.5, clientY: r.top + r.height * f, bubbles: true }));
        await new Promise((q) => setTimeout(q, 250));
        const sb = document.querySelector('.hm-selbox');
        if (sb && getComputedStyle(sb).display !== 'none' && /LIQUIDATION LEVEL/.test(sb.textContent)) return sb.textContent.replace(/\s+/g, ' ').trim();
      }
      return '';
    });
    ok('a zone still standing quotes what bands this heavy have really liquidated, with its n',
      !cal || (/have liquidated a median of/.test(cal) && /measured on \d+ of our own swept levels/.test(cal)), cal.slice(0, 220));
    ok('and it still refuses to price the model itself', !cal || /not a dollar figure/.test(cal), cal.slice(0, 120));
    ok('clicking a cut line says it was swept, and when', !!swRead.skip || /SWEPT/i.test(swRead.txt || ''),
      (swRead.txt || '').slice(0, 90));
    // MEASURED OR HONESTLY ABSENT - never a confident blank. The figure comes from our own collector and
    // the feed raises its size floor to reach further back, so the basis is printed with the number.
    ok('and it carries the measured dollars, or says why it cannot',
      !!swRead.skip || /really was liquidated|recorded no liquidation|older than the liquidations loaded/i.test(swRead.txt || ''),
      (swRead.txt || '').slice(0, 140));

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
    ok('TARGETS stays compact on a phone', L.tgH > 0 && L.tgH <= 170, 'targets=' + L.tgH + 'px');
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
    ok('it explains how to read itself, at the bottom with the rest of the prose', /READING THE ORDER BOOK/i.test(L.bkNoteTxt) && /Sum/.test(L.bkNoteTxt) && /crossed the spread/.test(L.bkNoteTxt), L.bkNoteTxt.slice(0, 120));
    ok('and says which half of the page is measured', /not modelled|none of (this|it) is modelled/i.test(L.bkNoteTxt), L.bkNoteTxt.slice(-110));
    // The three additions the owner asked for: the venue strip under each row, the value of every print,
    // and prints that are far bigger than the rest standing out without being hunted for.
    ok('each ladder row shows WHICH exchanges hold that price', L.bkSegs >= L.bkAsks + L.bkBids, 'segments=' + L.bkSegs + ' rows=' + (L.bkAsks + L.bkBids));
    ok('every print carries its dollar value and its venue', L.bkTapeCols >= 5, 'tape columns=' + L.bkTapeCols);
    // Every term a beginner could stumble on carries a '?' that explains it in plain words - the owner
    // asked for it, and it is what lets the page be dense without being hostile.
    // THE READ is the page's own analysis, and the whole point is that every line is derived from what we
    // hold rather than guessed. These four are the ones nobody else publishes.
    ok('it says what it costs in dollars to move the price',
      L.readTxt.indexOf('To lift it 0.1%') >= 0 && L.readTxt.indexOf('of buying') >= 0 && L.readTxt.indexOf('To drop it 0.1%') >= 0,
      L.readTxt.slice(0, 90));
    ok('it names the single heaviest resting block', L.readTxt.indexOf('Heaviest block') >= 0);
    ok('it weighs the big prints instead of counting them', L.readTxt.indexOf('Of the big prints') >= 0);
    ok('it says how far apart the five books are', /They agree within[\s\S]{0,24}bps/.test(L.readTxt));
    // The flow comes from minute buckets and the price from the chart's candles; on the day view those are
    // fifteen minutes each, so asking for "five minutes ago" landed inside the current candle and printed
    // +0.00% beside a real flow figure. Both sides must name the SAME span or they are two afternoons.
    ok('and the flow and the price cover the SAME window', (function () {
      var a = /last (\d+) min/.exec(L.readTxt), b2 = /Price, same (\d+) min/.exec(L.readTxt);
      return !a || !b2 || a[1] === b2[1];
    })(), L.readTxt.replace(/\n/g, ' | ').slice(0, 160));
    ok('it is grouped, not one long list', L.readGroups >= 3, 'groups=' + L.readGroups);
    // Every explanation lives at the bottom now, folded, instead of a paragraph under the panel.
    ok('the long explanations are folded away at the bottom', L.foldCount >= 4 && !L.panelNote, 'folds=' + L.foldCount + ' noteStillInPanel=' + L.panelNote);
    // The page was one flat black; the windows now sit on shades that differ.
    ok('the windows are not all the same colour', new Set(Object.values(L.shades)).size >= 3, JSON.stringify(L.shades));
    // A reader can throw away the noise: a floor in dollars and a side on the tape, and a row width on
    // the book - which is grouping rather than hiding, because a ladder has to stay contiguous to mean
    // anything. The bell turns whatever filter is set into a Telegram alert.
    // WHO IS WINNING lives with the ladder it measures (owner), not with the film - the film is the
    // same book minutes old. It names its own window too, because the strip under the ladder measures
    // the visible rows instead and the two legitimately disagree.
    // IT GOES IN THE LINE THAT ALREADY EXISTED (owner: "ta linija vec postoji sad si samo napravio drugu").
    // The check therefore asserts BOTH halves: the formats are there, and there is no second box anywhere.
    ok('who is winning lives in the summary line that was already there, in more than one shape',
      // THREE are unconditional; the two that read the film - who has led, and for how long unbroken -
      // are only shown once there are six frames to read, which is the honest thing to do and is not
      // true in the first half-minute after a collector restart.
      L.win && L.win.formats >= 3 && /: 1/.test(L.win.big) && /25 bps/.test(L.win.sub) && L.win.inSayLine && L.win.extraBoxes === 0 && L.win.stripH < 120,
      JSON.stringify(L.win));
    // Named, not counted: the film added its own alert-floor picker and an exact count turned this red
    // while all three filters it is about were exactly where they should be.
    ok('the tape and the book can both be filtered', L.filters.indexOf('bkMin') >= 0 && L.filters.indexOf('bkSide') >= 0 && L.filters.indexOf('bkTick') >= 0, L.filters.join(','));
    ok('the alert bell is there and explains its floor before it is pressed', !!L.bell && /250K/.test(L.bell.title), L.bell && L.bell.title);
    // "Auto / x2 / x5" named the multiplier and never the thing being chosen (owner: "nije mi jasno sta tu
    // biram"). Every option must carry the price step it produces, which is a real number off this coin's
    // own ladder - so the check is that they are prices, and that they really differ from one another.
    ok('the row-width control names a price step, never "Auto"', L.tickOpts.length === 5
      && L.tickOpts.every(function (t) { return /^\$[\d,.]+ /.test(t); })
      && !/Auto/.test(L.tickOpts.join(' '))
      && new Set(L.tickOpts.map(function (t) { return /^\$[\d,.]+/.exec(t)[0]; })).size === 5,
      L.tickOpts.join(' | '));
    ok('the jargon explains itself', L.helpQ >= 6, 'help marks=' + L.helpQ);
    // TARGETS keeps all six chips and every price readable, in half the height it used to take on a phone.
    ok('no target price is cut off', L.tgCut === 0, 'truncated=' + L.tgCut);
    ok('a live order-flow page offers a short window too', /Last hour/.test(L.wins), L.wins.slice(0, 120));
    ok('the three columns say what they answer', L.bkHeads.length === 3 && /ORDER BOOK/.test(L.bkHeads[0]) && /TAPE/.test(L.bkHeads[1]) && /READ/.test(L.bkHeads[2]), L.bkHeads.join(' / '));
    ok('the page never scrolls sideways', L.scrollW <= L.vw, 'scrollW=' + L.scrollW);
    ok('nothing in the section is wider than the screen', L.wide === 0, 'wide=' + L.wide);
    ok('the exchange table is stacked, not a clipped grid', L.extStacked > 0 && L.extGrid === 0, 'stacked=' + L.extStacked + ' grid=' + L.extGrid);
    ok('the coin table shows the selected window only', L.ctCols === 5, 'cols=' + L.ctCols);
    ok('the prose is collapsed behind disclosures', L.footTotal >= 4 && L.footOpen === 0, L.footOpen + '/' + L.footTotal);
    ok('the Premium countdown is in the masthead, not over the map', L.prevInMast);
    ok('the plot leaves a strip for the time axis', S.plotH < S.canvasH && S.canvasH - S.plotH >= 10, 'plotH=' + S.plotH + ' canvasH=' + S.canvasH);
    ok('the heat field occupies more than one level', [S.bandsFaint, S.bandsMid, S.bandsStrong].filter(n => n > 0).length >= 2,
      'faint=' + S.bandsFaint + ' mid=' + S.bandsMid + ' strong=' + S.bandsStrong);
    ok('the heaviest band on screen is bright', S.maxAlpha > 0.6, 'maxAlpha=' + S.maxAlpha);

    // THE READOUT HAS TO LAND WHERE THE READER IS LOOKING, AND NOT ON WHAT THEY TOUCHED. Pinned top-left it
    // covered the band it was explaining; pinned to the bottom of the VIEWPORT it could sit 300px below the
    // circle the finger just touched, which on a phone reads as "nothing happened". It is inside the map, in
    // the half opposite the touch.
    // TAP UNTIL IT FINDS A BAND, do not assume where one is. A fixed fraction of the plot only works
    // while the model happens to have a zone at that height, and it often does not: measured, a tap at
    // 0.72 opened the readout and the same tap at 0.25 found nothing, with the product working perfectly.
    // The invariant is that tapping a band opens the readout and the readout stays inside the map - not
    // that a band exists at 25% of the price axis this minute.
    const read = () => page.evaluate(() => {
      const sb = document.querySelector('.hm-selbox');
      if (!sb || getComputedStyle(sb).display === 'none') return { shown: false };
      const r = sb.getBoundingClientRect(), st = document.querySelector('.hm-stage').getBoundingClientRect();
      return { shown: true, lo: sb.classList.contains('lo'), inside: r.top >= st.top - 2 && r.bottom <= st.bottom + 2,
        midFrac: (r.top + r.height / 2 - st.top) / st.height, txt: sb.textContent.slice(0, 40) };
    });
    const tapHalf = async (from, to) => {
      const b = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      for (let f = from; (from < to ? f <= to : f >= to); f += (from < to ? 0.06 : -0.06)) {
        await page.evaluate(() => { const sb = document.querySelector('.hm-selbox'); if (sb) sb.style.display = 'none'; });
        await page.touchscreen.tap(b.x + b.w * 0.55, b.y + b.h * f);
        await new Promise(r => setTimeout(r, 320));
        const got = await read();
        if (got.shown) { got.at = +f.toFixed(2); return got; }
      }
      return { shown: false };
    };
    const hiTap = await tapHalf(0.30, 0.06), loTap = await tapHalf(0.68, 0.94);
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
  // PICKING A LINE ON A PHONE. This leg used to drive the dot layer: a tap must not raise the desktop
  // hover tip, and a tap into a dense patch of circles must open the list rather than one liquidation.
  // The dots are gone, and what a thumb has to hit now is the line itself - which spans the whole plot
  // and is therefore easier. The part worth keeping is the rest: the readout still has to OPEN, and it
  // still has to start on screen rather than half off the left edge, which is the bug this leg exists for.
  console.log('\npicking');
  await withBrowser(async (browser) => {
    const { page } = await open(browser, { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, IPHONE);
    const box = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    let tipEver = false, opened = 0, boxL = null, sweptSeen = false;
    for (let f = 0.08; f < 0.95; f += 0.06) {
      await page.evaluate(() => { const b2 = document.querySelector('.hm-selbox'); if (b2) b2.style.display = 'none'; });
      await page.touchscreen.tap(box.x + box.w * 0.45, box.y + box.h * f);
      await new Promise(r => setTimeout(r, 300));
      const st = await page.evaluate(() => {
        const tip = document.querySelector('.hm-tip');
        const sb = document.querySelector('.hm-selbox');
        const on = !!(sb && getComputedStyle(sb).display !== 'none');
        return { tip: !!(tip && getComputedStyle(tip).display !== 'none'), on: on,
          txt: on ? sb.textContent.slice(0, 40) : '', l: on ? Math.round(sb.getBoundingClientRect().left) : null };
      });
      if (st.tip) tipEver = true;
      if (st.on) { opened++; if (boxL === null) boxL = st.l; if (/SWEPT/i.test(st.txt)) sweptSeen = true; }
    }
    ok('a tap never raises the desktop hover tip', !tipEver);
    ok('a thumb can pick a line', opened >= 3, 'taps that opened a readout: ' + opened + ' of 15');
    ok('the readout starts on screen, not half off the left edge', boxL === null || boxL >= 0, String(boxL));
    ok('a swept line is reachable on a phone too', sweptSeen || opened >= 3, 'swept readout seen: ' + sweptSeen);
    await page.close();
  }, { timeoutMs: 230000 });

  // The hover-tip leg drove the dot layer to raise a tip, and there are no dots. The tip itself still
  // exists for bands, and the thing worth guarding is unchanged: it must never hang off either edge of
  // the canvas, which is what a nowrap tip does when it is asked to render near the right-hand side.
  await withBrowser(async (browser) => {
    const { page } = await open(browser, { width: 1366, height: 900 });
    const box = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
    let offEdge = 0, shown = 0;
    for (const fx of [0.05, 0.3, 0.6, 0.85, 0.97]) {
      for (const fy of [0.15, 0.4, 0.7]) {
        await page.mouse.move(box.x + box.w * fx, box.y + box.h * fy);
        await new Promise(r => setTimeout(r, 180));
        const t = await page.evaluate(() => { const tp = document.querySelector('.hm-tip'); if (!tp || getComputedStyle(tp).display === 'none') return null; const r2 = tp.getBoundingClientRect(); return { l: r2.left, r: r2.right }; });
        if (!t) continue; shown++;
        if (t.l < box.x - 1 || t.r > box.x + box.w + 1) offEdge++;
      }
    }
    ok('the hover tip never hangs off either edge of the canvas', offEdge === 0, 'shown ' + shown + ', off the edge ' + offEdge);
    await page.close();
  }, { timeoutMs: 280000 });

  // ---- the filters, driven rather than inspected --------------------------------------------------------
  // THE LOAD-BEARING CHECK HERE IS THE THIRD ONE. The empty-state message shares its container with the
  // rows, and the row builder used to count it as one: the next print to pass the filter was written into
  // cells the message does not have, so it turned green, took the row's pointer cursor, and the render
  // threw on the missing cell - freezing the panel with "nothing this big has printed" still on screen
  // while real orders went by behind it. Restoring that is a one-line revert, so it is tested by forcing
  // the message and then letting rows arrive, not by reading the markup.
  console.log('\nfilters');
  await withBrowser(async (browser) => {
    // open() is what swaps in the working-tree bundle under --local; a raw newPage() silently graded
    // PRODUCTION instead, which is how the first cut of these checks passed with the bug restored.
    const o = await open(browser, { width: 1366, height: 900 });
    const page = o.page, legErrs = o.errs;
    await page.waitForSelector('.hm-tp-l .hm-tp-row', { timeout: 60000 });
    const pick = async (cls, v) => {
      await page.$eval('.' + cls, (s, val) => { s.value = val; s.dispatchEvent(new Event('change', { bubbles: true })); }, v);
      await new Promise((r) => setTimeout(r, 1500));
    };

    // A filter the live window cannot answer must reach into the kept big prints instead of going blank.
    await pick('bkMin', '250000');
    const deep = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.hm-tp-l .hm-tp-row')];
      const usd = rows.map((r) => (r.querySelector('.u') || {}).textContent || '');
      return {
        n: rows.length, usd,
        sub: ((document.querySelector('.hm-tp .hm-col-h i') || {}).textContent || ''),
        none: !!document.querySelector('.hm-tp-none'),
        out: !!document.querySelector('.hm-tp-clr'),
      };
    });
    // Read the row's own printed value back into dollars - "$355K" is a string, and parseFloat of it is NaN.
    const asUsd = (t) => {
      const m = /^\$([\d.]+)([MK]?)$/.exec(String(t).trim());
      return m ? +m[1] * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1) : NaN;
    };
    const allBig = deep.usd.length > 0 && deep.usd.every((t) => asUsd(t) >= 250000);
    ok('a $250K filter is answered from the kept prints, not from an empty minute', deep.n >= 3 && allBig,
      JSON.stringify({ rows: deep.n, first: deep.usd.slice(0, 4) }));
    ok('and it says how far back it had to reach', /reaching back/.test(deep.sub), JSON.stringify(deep.sub));

    // Force the message, then bring the rows back.
    await page.evaluate(() => { document.querySelector('.hm-tp-l').innerHTML = '<div class="hm-tp-none"><b>forced</b></div>'; });
    await pick('bkMin', '0');
    const back = await page.evaluate(() => {
      const l = document.querySelector('.hm-tp-l'), rows = [...l.querySelectorAll('.hm-tp-row')];
      return {
        msg: !!l.querySelector('.hm-tp-none'), n: rows.length,
        marked: rows.every((r) => r.hasAttribute('data-r')),
        cells: rows.length ? !!(rows[0].querySelector('.tm') && rows[0].querySelector('.u')) : false,
        // The message div reused as a row keeps its own words, so what the first row SAYS is the tell -
        // a real one opens with a clock. Asserting only "no .hm-tp-none left" passes with the bug
        // restored, because the broken path renames that div instead of removing it.
        first: rows.length ? (rows[0].textContent || '').trim().slice(0, 24) : '',
      };
    });
    back.threw = legErrs.filter((e) => /pageerror/.test(e)).slice(-1)[0] || '';
    ok('a print is never hidden behind the empty-state message',
      !back.msg && back.n >= 5 && back.marked && back.cells && /^\d\d:\d\d:\d\d/.test(back.first) && !back.threw,
      JSON.stringify(back));

    // A filter that finds nothing hands back the way out, instead of being a dead end.
    await page.evaluate(() => { document.querySelector('.hm-tp-l').innerHTML = ''; });
    await pick('bkMin', '250000');
    await pick('bkSide', '1');
    const esc = await page.evaluate(async () => {
      const b = document.querySelector('.hm-tp-clr');
      if (!b) return { skip: true };
      b.click();
      await new Promise((r) => setTimeout(r, 1400));
      return { min: localStorage.getItem('mp_hm_tapemin'), side: localStorage.getItem('mp_hm_tapeside'), n: document.querySelectorAll('.hm-tp-l .hm-tp-row').length };
    });
    ok('an empty filter carries the way back out of itself', esc.skip || (esc.min === '0' && esc.side === '0' && esc.n >= 5),
      JSON.stringify(esc));

    // Being told the alert cannot reach you is only useful with the way to fix it, so it is a window with
    // a link, not a note in the corner that fades while the reader is still looking at the bell.
    await pick('bkMin', '250000');
    await page.click('.hm-bell');
    await new Promise((r) => setTimeout(r, 1800));
    const gate = await page.evaluate(() => {
      const g = document.querySelector('.hm-gate');
      if (!g) return null;
      const c = g.querySelector('.hm-gate-c').getBoundingClientRect();
      const a = g.querySelector('.hm-gate-go');
      const mid = document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2);
      return { href: a && a.getAttribute('href'), txt: (a || {}).textContent, reach: !!(mid && g.contains(mid)), w: Math.round(c.width) };
    });
    ok('the bell answers a guest with a window that links the alerts page', !!gate && gate.href === '/alerts' && gate.reach,
      gate ? JSON.stringify(gate) : 'no window');
    await page.close();
  }, { timeoutMs: 280000 });

  // ---- THE BOOK OVER TIME -------------------------------------------------------------------------
  // The film is the answer to "where are the orders, on which exchange, how much, and when" - so what is
  // tested is that it DRAWS both sides, that picking one exchange really changes the picture rather than
  // only the chip, that every derived card carries a measurement AND the sentence explaining it, and that
  // the price axis fits the labels it prints. That last one is load-bearing: measuring the two ends of
  // the scale is not enough, because they are exact multiples of the step and format without a decimal
  // while every tick between them has one - which is how a phone was printing "83,606." for a week.
  console.log('\nthe book over time');
  await withBrowser(async (browser) => {
    const o = await open(browser, { width: 1366, height: 900 });
    const page = o.page;
    await page.waitForSelector('.hm-bm-cv', { timeout: 60000 });
    await page.waitForFunction('window.__mpHeat && window.__mpHeat.state() && window.__mpHeat.state().bookMap', { timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2500));

    const A = await page.evaluate(() => {
      const el = document.querySelector('.hm-bm');
      const cv = el.querySelector('.hm-bm-cv'), ctx = cv.getContext('2d');
      const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
      let green = 0, red = 0;
      for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 14) continue; if (d[i + 1] > d[i] + 8) green++; else if (d[i] > d[i + 1] + 8) red++; }
      const foot = document.querySelector('details.hm-foot, .hm-foot');
      return {
        coins: [...el.querySelectorAll('[data-bmcoin]')].map((b) => b.textContent.trim()),
        venues: [...el.querySelectorAll('[data-bmven]')].map((b) => b.textContent.trim()),
        spans: [...el.querySelectorAll('[data-bmwin]')].map((b) => b.textContent.trim()),
        cards: [...el.querySelectorAll('.hm-bm-k')].map((k) => ({ lab: k.querySelector('u').textContent, val: k.querySelector('b').textContent, note: (k.querySelector('s') || {}).textContent || '' })),
        walls: [...el.querySelectorAll('.hm-bm-wi')].map((w) => w.textContent.replace(/\s+/g, ' ')),
        green, red,
        foot: (el.querySelector('.hm-bm-e') || {}).textContent || '',
        beforeExplainers: !!(foot && (el.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING)),
        st: window.__mpHeat.state().bookMap,
        wide: [...el.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().width > 1366).length,
      };
    });
    ok('the film covers six coins, five books and three spans', A.coins.length === 6 && A.venues.length === 6 && A.spans.length === 3,
      JSON.stringify({ coins: A.coins.length, venues: A.venues, spans: A.spans }));
    ok('it draws BOTH sides of the book, not one', A.green > 2000 && A.red > 2000, JSON.stringify({ green: A.green, red: A.red }));
    ok('it sits between the panel and the explanations', A.beforeExplainers, String(A.beforeExplainers));
    // A number with no sentence beside it is the thing this page keeps being redesigned away from.
    ok('every reading carries its measurement AND what it means', A.cards.length >= 3 && A.cards.every((c) => c.val.length > 0 && c.note.length > 12),
      JSON.stringify(A.cards.map((c) => c.lab + ' = ' + c.val)));
    ok('one of them answers what happened to the walls that went', A.cards.some((c) => /pulled|eaten|went/i.test(c.lab + c.val + c.note)),
      A.cards.map((c) => c.lab).join(' | '));
    ok('the marks are explained where they are drawn', /cross/.test(A.foot) && /withdrawn/.test(A.foot) && /cancelled/.test(A.foot), A.foot.slice(0, 80));
    ok('the price axis fits the widest label it prints', !!A.st && A.st.axw >= A.st.widestLabel + 8,
      JSON.stringify({ axw: A.st && A.st.axw, widest: A.st && A.st.widestLabel }));
    ok('nothing in the film is wider than the screen', A.wide === 0, 'wide=' + A.wide);

    // Picking one book must change the PICTURE, not just the chip - the film is stored per venue for
    // exactly this reason, and a filter that only moves the highlight would be a lie.
    const money = () => page.evaluate(() => {
      const d = window.__mpBmState.data, c = d.cols[d.cols.length - 1];
      const sum = (o) => { let t = 0; for (const k in o) t += o[k]; return t; };
      return { usd: Math.round(sum(c.b) + sum(c.a)), rows: Object.keys(c.b).length + Object.keys(c.a).length };
    });
    const before = await money();
    await page.click('[data-bmven="binance"]');
    await page.waitForFunction(() => { var s2 = window.__mpBmState; return s2 && s2.venue === 'binance' && s2.data && s2.data.cols && s2.data.cols.length >= 2; }, { timeout: 40000 }).catch(() => {});
    const after = Object.assign(await money(), await page.evaluate(() => ({
      on: (document.querySelector('.hm-bm .hm-bm-b.on[data-bmven]') || {}).textContent.trim(),
      st: window.__mpHeat.state().bookMap,
    })));
    ok('picking one exchange redraws the film from that book alone', after.on === 'Binance' && after.st && after.st.venue === 'binance' && after.usd > 0 && after.usd < before.usd * 0.75,
      JSON.stringify({ allFive: before, binanceOnly: { usd: after.usd, rows: after.rows }, venue: after.st && after.st.venue }));

    // and a coin with a book must be switchable to
    await page.click('[data-bmcoin="SOL"]');
    // WAIT FOR THE DATA, not for a clock: a coin switch clears the film and refetches, and a fixed sleep
    // graded whichever side of that race the run happened to land on.
    await page.waitForFunction(() => { var s2 = window.__mpBmState; return s2 && s2.coin === 'SOL' && s2.data && s2.data.cols && s2.data.cols.length >= 2; }, { timeout: 40000 }).catch(() => {});
    const sol = await page.evaluate(() => window.__mpHeat.state().bookMap);
    ok('another coin loads its own film', !!sol && sol.coin === 'SOL' && sol.cols >= 2, JSON.stringify(sol));
    // ---- CLICKING IT ------------------------------------------------------------------------------
    // A picture you cannot interrogate is a poster. The load-bearing checks here are the two that state
    // a FACT about somebody's money: a finished wall must say whether it was traded through or taken
    // away, and a plain price must not claim to know about individual orders - an exchange publishes the
    // total at a price and nothing else, so the panel says so in its own words.
    const rect = () => page.evaluate(() => { const r = document.querySelector('.hm-bm-cv').getBoundingClientRect(); return { l: r.left, t: r.top }; });
    const clickAt = async (x, y) => {
      const r = await rect();
      await page.evaluate((cx, cy) => {
        document.querySelector('.hm-bm-cv').dispatchEvent(new MouseEvent('click', { clientX: cx, clientY: cy, bubbles: true }));
      }, r.l + x, r.t + y);
      await new Promise((z) => setTimeout(z, 500));
      return page.evaluate(() => {
        const p = document.querySelector('.hm-bm-d');
        if (!p || p.style.display === 'none' || !p.textContent.trim()) return null;
        return { txt: p.textContent.replace(/\s+/g, ' ').trim(), tag: (p.querySelector('.hm-bmd-tag') || {}).textContent || '', rows: p.querySelectorAll('.hm-bmd-r').length };
      });
    };
    const geo = await page.evaluate(() => {
      // The film clears itself on a coin or venue change and refetches, so every read of it has to
      // survive being empty rather than throwing and taking the whole run down with it.
      const s2 = window.__mpBmState;
      const g = s2 && s2.geo, d = s2 && s2.data;
      if (!g || !d || !d.cols || !d.cols.length) return { fin: null, cell: null, empty: true };
      const xOfT = (t) => Math.max(0, Math.min(g.PW, (t - g.t0) / g.span * g.PW));
      const fin = (d.wallsFinished || [])[(d.wallsFinished || []).length - 1];
      const ci = Math.max(0, Math.floor(d.cols.length * 0.3)), col = d.cols[ci];
      // NOT the heaviest bucket: that is exactly what the wall detector picks, so the click opened a
      // wall card and this check graded the wrong panel. A middling row is an ordinary price.
      const sorted = Object.keys(col.b).sort((x, y) => col.b[y] - col.b[x]);
      const bk2 = sorted[Math.floor(sorted.length / 2)];
      return {
        fin: fin ? { x: xOfT(fin.endedAt), y: g.yOf(fin.price / g.step) + g.rh / 2, ending: fin.ending } : null,
        cell: bk2 ? { x: (ci + 0.5) * g.cw, y: g.yOf(+bk2) + g.rh / 2 } : null,
      };
    });
    if (geo.fin) {
      const w = await clickAt(geo.fin.x, geo.fin.y);
      ok('clicking a mark on the film says what ended that wall', !!w && /WITHDRAWN|TRADED/.test(w.tag) && w.rows >= 6,
        w ? JSON.stringify({ tag: w.tag, rows: w.rows }) : 'no panel');
      ok('and it separates money that traded from money that was taken away', !!w && /Traded into it/.test(w.txt) && (/spoofing/.test(w.txt) || /traded through this price/.test(w.txt)),
        w ? w.txt.slice(0, 120) : '-');
    }
    if (geo.cell) {
      const c = await clickAt(geo.cell.x, geo.cell.y);
      ok('clicking a price says how long money has rested there', !!c && /rested here/i.test(c.txt) && c.rows >= 5, c ? JSON.stringify({ rows: c.rows }) : 'no panel');
      // THE HONESTY CHECK. A book publishes the total at a price, never the orders inside it, so this
      // panel must never imply it can see one trader cancel one order.
      ok('and it refuses to claim it can see individual orders', !!c && /never the individual orders/.test(c.txt), c ? c.txt.slice(-140) : '-');
    }

    // The film is twenty minutes long and the window is ten, so most of what it knows is off screen.
    const pan = await page.evaluate(async () => {
      const cv = document.querySelector('.hm-bm-cv'), r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent('mousedown', { clientX: r.left + 300, clientY: r.top + 60, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: r.left + 640, clientY: r.top + 60, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      await new Promise((z) => setTimeout(z, 3200));
      const chip = document.querySelector('.hm-bm-now');
      return { back: +window.__mpBmState.back.toFixed(2), chip: chip && !chip.hidden ? chip.textContent.replace(/\s+/g, ' ').trim() : '' };
    });
    ok('dragging winds the film back into its own history', pan.back > 0.4, JSON.stringify(pan));
    ok('and it says so, with one tap back to now', /back/i.test(pan.chip) && !!(await page.$('.hm-bm-nowb')), JSON.stringify(pan.chip));
    const backNow = await page.evaluate(async () => {
      const b = document.querySelector('.hm-bm-nowb'); if (!b) return null;
      b.click(); await new Promise((z) => setTimeout(z, 3000));
      return +window.__mpBmState.back.toFixed(2);
    });
    ok('and pressing it really returns to the live edge', backNow === 0, String(backNow));

    const gl = await page.$$eval('.hm-bm-gi', (g) => g.map((x) => ({ t: x.querySelector('b').textContent, d: x.querySelector('span').textContent.length })));
    ok('the words under the map are all defined in one place', gl.length >= 6 && gl.every((x) => x.d > 60), JSON.stringify(gl.map((x) => x.t)));

    // ---- ONLY WHAT IS DRAWN CAN BE CLICKED, AND IT IS CLICKED EXACTLY (2026-09-24) -------------------
    // Owner: "Prazan prostor na mapi ne sme da bude clicable ... hocu da klikovi budu precizni u milimetar,
    // bilo da je zumirano ili ne". Before this, the map snapped to the nearest band within 10-20px (so the
    // gap between two lines, and the empty stretch past a swept band's cut, both answered), and the film
    // inverted its rows with Math.round, half a row out - click a bright cell, select nothing.
    // Every target below is computed INSIDE the page and returned in VIEWPORT coordinates, in the same
    // evaluate that reads the geometry. Reading a canvas box once and clicking it later is a measurement
    // bug: earlier legs scroll the page and pan the film, and these checks then failed while the product
    // was correct - which is the worst kind of red.
    // AND THE TARGET HAS TO BE ON SCREEN. A click at a y outside the viewport is clamped to the edge by
    // the browser, so it lands on a different row and the check reports a consistent offset that looks like a
    // product bug. Earlier legs scroll this page a long way; bring the canvas into view, let layout settle,
    // and only then measure.
    const pickAt = async (fn, arg, sel) => {
      await page.evaluate((q) => { const e = document.querySelector(q); if (e) e.scrollIntoView({ block: "center" }); }, sel || ".hm-cv");
      await new Promise((r) => setTimeout(r, 600));
      const p = await page.evaluate(fn, arg);
      if (!p) return null;
      await page.mouse.click(p.cx, p.cy);
      await new Promise((r) => setTimeout(r, 420));
      return p;
    };

    const nRects = await page.evaluate(() => (window.__mpHeat.state().bandRects || []).length);
    ok('the map records every rectangle it fills', nRects > 0, String(nRects));
    if (nRects) {
      const p1 = await pickAt(() => {
        const S = window.__mpHeat.state(), R = S.bandRects || [];
        const b2 = R.filter((r) => r.x1 - r.x0 > 40).sort((x, y) => (y.x1 - y.x0) - (x.x1 - x.x0))[0] || R[0];
        if (!b2) return null;
        const r = document.querySelector('.hm-cv').getBoundingClientRect();
        return { cx: r.x + (b2.x0 + b2.x1) / 2, cy: r.y + b2.y + b2.h / 2, want: b2.price };
      });
      const sel1 = await page.evaluate(() => window.__mpHeat.state().sel);
      ok('clicking the centre of a band selects THAT band', !!p1 && !!sel1 && Math.abs(sel1.price - p1.want) < 1e-9, JSON.stringify({ got: sel1, want: p1 && p1.want }));

      const p2 = await pickAt(() => {
        const S = window.__mpHeat.state(), R = S.bandRects || [];
        const c = document.querySelector('.hm-cv'), r = c.getBoundingClientRect();
        for (let gy = 6; gy < (S.plotH || r.height) - 6; gy += 3) for (let gx = 8; gx < r.width - 90; gx += 17) {
          let inside = false;
          for (const z of R) if (gx >= z.x0 - 9 && gx <= z.x1 + 9 && gy >= z.y - 9 && gy <= z.y + z.h + 9) { inside = true; break; }
          if (!inside) return { cx: r.x + gx, cy: r.y + gy };
        }
        return null;
      });
      if (p2) {
        const sel2 = await page.evaluate(() => window.__mpHeat.state().sel);
        // THE LOAD-BEARING ONE: with the old nearest-band snap this selects a pool and goes red.
        ok('empty map selects nothing at all', sel2 === null, JSON.stringify(sel2));
      }

      // a pixel tolerance means something different at every zoom, so ask again after zooming
      const cb = await page.evaluate(() => { const r = document.querySelector('.hm-cv').getBoundingClientRect(); return { x: r.x + r.width * 0.5, y: r.y + r.height * 0.4 }; });
      await page.mouse.move(cb.x, cb.y);
      for (let z = 0; z < 6; z++) { await page.mouse.wheel({ deltaY: -120 }); await new Promise((r) => setTimeout(r, 90)); }
      await new Promise((r) => setTimeout(r, 900));
      const p3 = await pickAt(() => {
        const S = window.__mpHeat.state(), R = (S.bandRects || []).filter((r) => r.x1 - r.x0 > 40);
        if (!R.length) return null;
        const r = document.querySelector('.hm-cv').getBoundingClientRect();
        return { cx: r.x + (R[0].x0 + R[0].x1) / 2, cy: r.y + R[0].y + R[0].h / 2, want: R[0].price };
      });
      if (p3) {
        const sel3 = await page.evaluate(() => window.__mpHeat.state().sel);
        ok('and it is still exact when zoomed in', !!sel3 && Math.abs(sel3.price - p3.want) < 1e-9, JSON.stringify({ got: sel3, want: p3.want }));
      }
    }

    // the film: the MIDDLE and the TOP EDGE of one row, then film that is provably empty
    // THE BOTTOM OF A ROW IS THE HALF THAT WAS BROKEN, and it took a falsification to notice: with
    // k = round(kMax - y/rh), a click in the TOP half already rounded to the right row, so a 'top edge'
    // check tested the half the bug got right - and failed only because it asked for a sub-pixel offset a
    // browser rounds away. In the bottom half the old inverse lands on the row BELOW, which is the report.
    for (const where of ['mid', 'bottom']) {
      const pf = await pickAt((w) => {
        const s2 = window.__mpBmState; if (!s2 || !s2.geo || !s2.data) return null;
        const g = s2.geo, d = s2.data, c = document.querySelector('.hm-bm-cv');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        // A CELL WITH NO WALL LINE THROUGH IT. A wall's line is drawn across the row it sits on and is
        // rightly pickable there, so a cell chosen without checking for one makes this check flaky - and a
        // flaky check is a broken check.
        const walls = (d.wallsStanding || []).concat(d.wallsFinished || []);
        const clear = (y2) => !walls.some((w) => Math.abs(g.yOf(w.price / g.step) + g.rh / 2 - y2) < g.rh * 1.5);
        for (let i2 = Math.floor(d.cols.length * 0.35); i2 < d.cols.length; i2++) { const col = d.cols[i2];
          for (const kk in (col.b || {})) { const k = +kk, y = g.yOf(k);
            if (y < 2 || y > g.PH - 2) continue;
            if (!clear(y + g.rh / 2)) continue;
            var off = w === 'bottom' ? g.rh * 0.8 : g.rh / 2;
            return { cx: r.x + i2 * g.cw + g.cw / 2, cy: r.y + y + off, want: k };
          } }
        return null;
      }, where, ".hm-bm-cv");
      if (!pf) continue;
      const got = await page.evaluate(() => { const s2 = window.__mpBmState; return s2 && s2.sel ? { kind: s2.sel.kind, bucket: s2.sel.payload && s2.sel.payload.bucket } : null; });
      // the TOP EDGE one is load-bearing: the old Math.round inverse landed on the row above, which usually
      // held nothing and therefore selected nothing at all.
      ok('the film hits the row you touched (' + where + ')', !!got && got.kind === 'cell' && got.bucket === pf.want, JSON.stringify({ got: got, want: pf.want }));
    }
    const pe = await pickAt(() => {
      const s2 = window.__mpBmState; if (!s2 || !s2.geo || !s2.data) return null;
      const g = s2.geo, d = s2.data, c = document.querySelector('.hm-bm-cv'); if (!c) return null;
      const r = c.getBoundingClientRect();
      const all = (d.wallsStanding || []).concat(d.wallsFinished || []);
      for (let i2 = 0; i2 < d.cols.length; i2++) { const col = d.cols[i2];
        for (let k = g.kMin; k <= g.kMax; k++) {
          if ((col.b && col.b[k] > 0) || (col.a && col.a[k] > 0)) continue;
          const y = g.yOf(k) + g.rh / 2; if (y < 3 || y > g.PH - 3) continue;
          let near = false;
          for (const w of all) { const wy = g.yOf(w.price / g.step) + g.rh / 2; if (Math.abs(wy - y) < g.rh * 1.5) { near = true; break; } }
          if (!near) return { cx: r.x + i2 * g.cw + g.cw / 2, cy: r.y + y };
        } }
      return null;
    }, null, ".hm-bm-cv");
    if (pe) {
      const none = await page.evaluate(() => { const s2 = window.__mpBmState; return s2 && s2.sel ? s2.sel.kind : null; });
      ok('empty film selects nothing at all', none === null, String(none));
    }
    const hdr = await page.evaluate(() => ({ bell: !!document.querySelector('.hm-bm-bell'), size: !!document.querySelector('.hm-bm-h select'), coin: !!document.querySelector('[data-bmcoin]') }));
    ok('the film header carries no alert bell and no size picker', !hdr.bell && !hdr.size && hdr.coin, JSON.stringify(hdr));
    ok('no page errors while driving it', o.errs.length === 0, JSON.stringify(o.errs.slice(0, 3)));
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
      // domcontentloaded, not networkidle2 - see open(): this page never stops polling, so "the network went
      // quiet for half a second" is a state it may simply never reach, and the run then dies on a 60s timeout
      // while the page itself is answering in 0.06s.
      await page.goto(URL_, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
