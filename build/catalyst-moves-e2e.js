// WHAT MOVED IT - the proof (2026-10-29). Three legs:
//   --pure      lifts cxDetectMoves / cxAttribute / cxLabel out of the SHIPPED worker and drives them with constructed bars
//               and catalysts: one big bar is one move, a six-bar drift is one move, noise is none; a dated catalyst ten
//               minutes before is the cause, the same one three hours before is not, a source that speaks thirty times a
//               day cannot claim a move by time alone, a prospectus never explains an alt, a macro print explains every
//               coin, a liquidation burst is a cascade. `--falsify` restores the time-only weighting and must turn red.
//   (default)   production: the route's shape, the PLACEBO (every catalyst shifted a week: the explained share must
//               collapse - that is the one number that says the matching is not chance), the live `?at=` path, a coin
//               with no liquidation feed never reads "cascade".
//   --browser   the indicator on /charts (desktop) and on the phone layer: marks on the bars, the legend line, a flag
//               that opens its card on a real click, the live line after an injected move. `--local` serves the bundles
//               from the tree.
//   node build/catalyst-moves-e2e.js [--pure] [--browser] [--local] [--falsify]
'use strict';
const fs = require('fs'), path = require('path');
const ARGS = process.argv.slice(2), has = k => ARGS.includes(k);
const PURE = has('--pure'), BROWSER = has('--browser'), LOCAL = has('--local'), FALSIFY = has('--falsify');
const BASE = 'https://marginpad.io', DIST = path.join(__dirname, '..', 'dist'), A = path.join(DIST, 'assets');
let pass = 0, fail = 0;
const ok = (name, cond, note) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (note !== undefined ? '  -> ' + String(note).slice(0, 220) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- pure: the shipped functions, lifted ----------
function lift() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
  const a = src.indexOf('const CX_BEFORE_MS'), b = src.indexOf('// GET /api/catalysts/moves?symbol=');
  if (a < 0 || b < 0 || b < a) throw new Error('cx block not found in worker.js');
  let block = src.slice(a, b);
  if (FALSIFY) {
    // time-only weighting: the source's chance of speaking is ignored - whale alerts explain everything again
    block = block.replace("const rateW = isMacro ? 1 : Math.max(0.1, 1 - chance);", 'const rateW = 1;');
    if (!/const rateW = 1;/.test(block)) throw new Error('falsify anchor missing');
  }
  return new Function(block + '\nreturn { cxDetectMoves, cxAttribute, cxLabel, cxMedian, CX_BEFORE_MS, CX_AFTER_MS };')();
}
function synthBars(n, opt) {
  const o = Object.assign({ p0: 100, noise: 0.0005, step: 900 }, opt || {}); const out = []; let p = o.p0; let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
  for (let i = 0; i < n; i++) { const r = (o.at && o.at[i] != null) ? o.at[i] : rnd() * 2 * o.noise; const open = p; p = p * (1 + r); out.push({ time: 1700000000 + i * o.step, open, high: Math.max(open, p) * 1.0002, low: Math.min(open, p) * 0.9998, close: p }); }
  return out;
}
function pureLeg() {
  const X = lift();
  console.log('[pure] the shipped detector');
  const quiet = X.cxDetectMoves(synthBars(500));
  ok('noise alone is no move', quiet.moves.length === 0, JSON.stringify(quiet.moves.slice(0, 2)));
  ok('and the scale is the noise it measured (about 0.05%)', quiet.scale > 0.02 && quiet.scale < 0.1, quiet.scale);
  const one = X.cxDetectMoves(synthBars(500, { at: { 300: 0.02 } }));
  ok('one +2% bar is exactly one move', one.moves.length === 1, one.moves.length);
  ok('of +2%, up, one bar', one.moves[0] && one.moves[0].dir === 1 && Math.abs(one.moves[0].pct - 2) < 0.05 && one.moves[0].n === 1, JSON.stringify(one.moves[0]));
  ok('starting on that bar', one.moves[0] && one.moves[0].t0 === (1700000000 + 300 * 900) * 1000, one.moves[0] && one.moves[0].t0);
  const drift = X.cxDetectMoves(synthBars(500, { at: { 200: -0.004, 201: -0.004, 202: -0.004, 203: -0.004, 204: -0.004, 205: -0.004 } }));
  ok('six bars of -0.4% each are ONE move of about -2.4%', drift.moves.length === 1 && drift.moves[0].dir === -1 && Math.abs(drift.moves[0].pct + 2.4) < 0.1 && drift.moves[0].n === 6, JSON.stringify(drift.moves[0]));
  const two = X.cxDetectMoves(synthBars(600, { at: { 100: 0.015, 400: -0.015 } }));
  ok('two separate moves come back newest first', two.moves.length === 2 && two.moves[0].dir === -1 && two.moves[1].dir === 1, JSON.stringify(two.moves.map(m => [m.dir, m.pct])));

  console.log('[pure] the shipped attribution');
  const T0 = Date.UTC(2026, 9, 20, 12, 0), mv = { t0: T0, t1: T0 + 15 * 60000, pct: 2.1, dir: 1 };
  const cat = (over) => Object.assign({ ts_src: T0 - 10 * 60000, source: 'bybit-ann', kind: 'delisting', expect: -1, syms: 'BTC', score: 65, conf: 1, title: 'Delisting of BTCUSDT', url: '' }, over);
  let a = X.cxAttribute(mv, [cat({ kind: 'listing', expect: 1 })], null, { sym: 'BTC' });
  ok('a scored BTC listing ten minutes before a BTC rise is the cause', a.cause === 'news' && a.catalyst && a.catalyst.leadMin === 10 && a.catalyst.after === false, JSON.stringify(a));
  ok('with a label a flag can carry', a.label === 'Bybit listing', a.label);
  a = X.cxAttribute(mv, [cat({ kind: 'listing', expect: 1, ts_src: T0 - 3 * 3600000 })], null, { sym: 'BTC' });
  ok('the same news three hours before is outside the window: unknown', a.cause === 'unknown' && !a.catalyst, a.cause);
  a = X.cxAttribute(mv, [cat({ kind: 'listing', expect: 1, ts_src: T0 + 20 * 60000 })], null, { sym: 'BTC' });
  ok('news twenty minutes AFTER the start still counts, marked as after (the market led the news)', a.cause === 'news' && a.catalyst && a.catalyst.after === true, JSON.stringify(a.catalyst));
  a = X.cxAttribute(mv, [cat({ kind: 'listing', expect: 1, syms: 'ETH' })], null, { sym: 'BTC' });
  ok('another coin\'s listing does not explain BTC', a.cause === 'unknown', a.cause);
  a = X.cxAttribute(mv, [cat({ kind: 'promo', expect: 0, score: 0 })], null, { sym: 'BTC' });
  ok('a promo is never a cause', a.cause === 'unknown', a.cause);
  a = X.cxAttribute(mv, [cat({ kind: 'listing', expect: -1 })], null, { sym: 'BTC' });
  ok('an expectation against the move halves the weight but still names it when strong', a.catalyst ? a.catalyst.w < 0.6 : true, JSON.stringify(a.catalyst));
  // the chance of speaking: thirty whale alerts in the day around the move, one of them twelve minutes before
  const whales = []; for (let i = 0; i < 30; i++) whales.push(cat({ source: 'tg:whale_alert_io', kind: 'whale', expect: 0, score: 49, ts_src: T0 - 12 * 3600000 + i * 48 * 60000, title: 'transfer ' + i }));
  whales.push(cat({ source: 'tg:whale_alert_io', kind: 'whale', expect: 0, score: 49, ts_src: T0 - 12 * 60000, title: '1,947 BTC transferred to Coinbase' }));
  a = X.cxAttribute(mv, whales, null, { sym: 'BTC' });
  ok('a source that speaks thirty times a day cannot claim the move by time alone', a.cause === 'unknown', JSON.stringify(a.catalyst));
  a = X.cxAttribute(mv, [cat({ source: 'sec', kind: 'filing', expect: 0, syms: '', score: 57, title: '497 - BLACKROCK ADVANTAGE GLOBAL FUND' })], null, { sym: 'SOL' });
  ok('a prospectus with no issuer symbol never explains an alt', a.cause === 'unknown', a.cause);
  a = X.cxAttribute({ t0: T0, t1: T0 + 15 * 60000, pct: -1.4, dir: -1 }, [cat({ source: 'calendar', kind: 'macro', expect: 0, syms: '', score: 70, ts_src: T0 - 60 * 60000, title: 'FOMC rate decision' })], null, { sym: 'SOL' });
  ok('a macro print an hour before explains every coin, SOL included', a.cause === 'news' && a.label === 'FOMC', JSON.stringify(a));
  // cascade: a quiet month of 5-minute buckets, then a burst inside the move
  const liq = []; for (let i = 0; i < 2000; i++) liq.push({ t: T0 - 2000 * 300000 + i * 300000, long: 10000, short: 10000 });
  liq.push({ t: T0, long: 300000, short: 20000 }); liq.push({ t: T0 + 300000, long: 250000, short: 10000 });
  a = X.cxAttribute({ t0: T0, t1: T0 + 15 * 60000, pct: -1.9, dir: -1 }, [], liq, { sym: 'BTC', liqFloor: 250000 });
  ok('a liquidation burst many times the typical bucket with no news is a cascade', a.cause === 'cascade' && a.liq && a.liq.x >= 6, JSON.stringify(a.liq));
  a = X.cxAttribute({ t0: T0, t1: T0 + 15 * 60000, pct: -1.9, dir: -1 }, [cat({ expect: -1, ts_src: T0 - 5 * 60000 })], liq, { sym: 'BTC', liqFloor: 250000 });
  ok('news AND a cascade is said as both', a.cause === 'news+cascade', a.cause);
  a = X.cxAttribute({ t0: T0, t1: T0 + 15 * 60000, pct: -1.9, dir: -1 }, [], liq.slice(0, 2000), { sym: 'BTC', liqFloor: 250000 });
  ok('a quiet feed is no cascade', a.cause === 'unknown' && !a.cascade, a.cause);
  ok('the window rules are the documented ones', X.CX_BEFORE_MS === 90 * 60000 && X.CX_AFTER_MS === 30 * 60000);
}

// ---------- production ----------
async function getJ(u) { const r = await fetch(u, { headers: { 'user-agent': 'MarginPad-e2e/1.0' } }); const t = await r.text(); try { return { status: r.status, j: JSON.parse(t), raw: t }; } catch (e) { return { status: r.status, j: null, raw: t.slice(0, 200) }; } }
async function prodLeg() {
  console.log('[prod] the route');
  const b = await getJ(BASE + '/api/catalysts/moves?symbol=BTC&nc=1');
  const j = b.j || {};
  ok('BTC answers 200 with bars covering the month', b.status === 200 && j.bars >= 2000 && j.coversSince === true, b.status + ' bars ' + j.bars);
  ok('a measured scale and the rules it was judged by', j.scale > 0 && j.rules && j.rules.windowBeforeMin === 90, JSON.stringify(j.rules));
  ok('the collector answered with a month of catalysts', j.collector === 'ok' && j.catalysts > 500, j.collector + ' ' + j.catalysts);
  ok('liquidations were measured for BTC', j.liqMeasured === true);
  const mv = j.moves || [];
  ok('moves exist, newest first, each with a cause word', mv.length >= 10 && mv.every(m => ['news', 'cascade', 'news+cascade', 'unknown'].includes(m.cause)) && mv.every((m, i) => i === 0 || m.t0 <= mv[i - 1].t0), mv.length);
  const s = j.summary || {};
  ok('the summary adds up', s.n === mv.length && s.news + s.cascade + s.both + s.unknown === s.n, JSON.stringify(s));
  ok('every named cause carries its evidence', mv.filter(m => m.cause !== 'unknown').every(m => (m.catalyst && m.catalyst.title && m.catalyst.source) || (m.cascade && m.liq && m.liq.usd > 0)));
  ok('every catalyst named sits inside the window', mv.filter(m => m.catalyst).every(m => m.catalyst.leadMin <= 90 && m.catalyst.leadMin >= -30), JSON.stringify(mv.filter(m => m.catalyst).map(m => m.catalyst.leadMin).slice(0, 20)));
  ok('unknown is said out loud for some moves (an engine that explains everything is lying)', s.unknown > 0, s.unknown);
  // THE PLACEBO
  const p = await getJ(BASE + '/api/catalysts/moves?symbol=BTC&nc=1&shift=-604800000');
  const ps = (p.j && p.j.summary) || {};
  const real = s.n ? (s.n - s.unknown) / s.n : 0, plac = ps.n ? (ps.n - ps.unknown) / ps.n : 0;
  const realNews = s.n ? (s.news + s.both) / s.n : 0, placNews = ps.n ? (ps.news + ps.both) / ps.n : 0;
  ok('the placebo (every catalyst shifted a week) answers', p.status === 200 && ps.n === s.n, JSON.stringify(ps));
  ok('and its news-explained share is well under the real one (the matching is not chance)', placNews <= realNews * 0.6, 'real ' + Math.round(realNews * 100) + '% placebo ' + Math.round(placNews * 100) + '%');
  console.log('  info news-explained real ' + Math.round(realNews * 100) + '% / placebo ' + Math.round(placNews * 100) + '% ; all causes real ' + Math.round(real * 100) + '% / placebo ' + Math.round(plac * 100) + '%');
  // a coin with no liquidation feed
  const h = await getJ(BASE + '/api/catalysts/moves?symbol=HYPE&nc=1');
  const hj = h.j || {};
  ok('HYPE (no liquidation feed) answers with moves and never a cascade', h.status === 200 && hj.liqMeasured === false && (hj.moves || []).every(m => !m.cascade), hj.liqMeasured);
  // the live path
  const at = Date.now() - 10 * 60000;
  const l = await getJ(BASE + '/api/catalysts/moves?symbol=BTC&at=' + at + '&pct=-1.5&n=2&nc=1');
  const lj = l.j || {};
  ok('the live path answers for a move starting ten minutes ago', l.status === 200 && lj.live === true && lj.at === at && ['news', 'cascade', 'news+cascade', 'unknown'].includes(lj.cause), JSON.stringify(lj).slice(0, 200));
  ok('with the catalysts it saw counted', lj.catalystsSeen >= 0 && lj.collector === 'ok', lj.catalystsSeen + ' ' + lj.collector);
  const cached = await fetch(BASE + '/api/catalysts/moves?symbol=BTC');
  // the worker says max-age 300 (60 with the collector down); a zone Cache Rule rewrites the browser TTL on /api/* edge HITs to
  // 14400 (documented 2026-10-22, the owner's to remove) - either reading is the edge cache working, a missing header is not
  ok('the month is edge-cached', cached.status === 200 && /max-age=(300|60|14400)/.test(cached.headers.get('cache-control') || ''), cached.headers.get('cache-control'));
}

// ---------- browser ----------
async function browserLeg() {
  const { withBrowser, newPage, UA_MOBILE, UA_DESKTOP } = require('./e2e-browser.js');
  const SERVE = /^\/assets\/(home\.css|home\.js|mp-charts\.js|mp-mcharts\.js)$/;
  async function prep(browser, mobile, w, h, seed) {
    const page = await newPage(browser, { mobile, ua: mobile ? UA_MOBILE : UA_DESKTOP });
    await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
    const errors = []; page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.setCacheEnabled(false); await page.setRequestInterception(true);
    try { const cdp = await page.target().createCDPSession(); await cdp.send('Network.enable'); await cdp.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}
    page.on('request', (req) => {
      const u = req.url();
      if (u.indexOf('/api/track') >= 0) return req.respond({ status: 204, body: '' });
      if (LOCAL) { try { const p = new URL(u).pathname;
        if (req.resourceType() === 'document' && /^\/charts\/?$/.test(p)) return req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: fs.readFileSync(path.join(DIST, 'app.html'), 'utf8') });
        const m = p.match(SERVE); if (m) return req.respond({ status: 200, contentType: m[1].endsWith('.css') ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8', body: fs.readFileSync(path.join(A, m[1]), 'utf8') });
      } catch (e) {} }
      req.continue();
    });
    await page.evaluateOnNewDocument((sd) => { try { for (const k in sd) localStorage.setItem(k, sd[k]); } catch (e) {} }, seed);
    page._errors = errors; return page;
  }
  await withBrowser(async (browser) => {
    console.log('[browser] desktop /charts');
    // `mp_charts` is the ARRAY savePersist() writes (one object per window), not the layout snapshot's {wins,notes}
    const seed = { mp_charts: JSON.stringify([{ sym: 'BTC', tf: '15', inds: { catalyst: true }, cmp: '', x: 0, y: 0, w: 1150, h: 640, id: 'cx1', emaList: [], smaList: [], liqMin: 0 }]), mp_cws_rail: 'mini', mp_ck_ok: '1' };
    const page = await prep(browser, false, 1366, 768, seed);
    await page.goto(BASE + '/charts', { waitUntil: 'domcontentloaded', timeout: 60000 });
    let got = false;
    try { await page.waitForFunction(() => { const w = window.__mpWinsDbg && window.__mpWinsDbg[0]; return !!(w && w._cx && w._cx.moves); }, { timeout: 40000 }); got = true; } catch (e) {}
    ok('the window loaded the month from the route', got);
    if (got) {
      await sleep(1200);
      const st = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; try { w.dr.redraw(); } catch (e) {} const lg = w.legEl ? w.legEl.textContent : ''; return { marks: (w._cxMarks || []).length, hits: (w._cxHit || []).length, leg: lg, on: !!w.inds.catalyst, sum: w._cx.summary, bars: (w.bars || []).length }; });
      ok('marks were built onto the loaded bars', st.marks > 0, JSON.stringify(st.sum));
      ok('flags were painted and are hittable', st.hits > 0, st.hits);
      ok('the legend carries the month line', /WHAT MOVED IT/.test(st.leg) && /explained|moves/.test(st.leg), st.leg.slice(0, 160));
      // click the first visible flag through the real chart click
      const hit = await page.evaluate(() => { const w = window.__mpWinsDbg[0]; const h = (w._cxHit || [])[0]; if (!h) return null; const cv = w.el.querySelector('canvas.cwin-draw'); const r = cv.getBoundingClientRect(); return { x: r.left + h.x + h.w / 2, y: r.top + h.y + h.h / 2, label: h.k.m.label, cause: h.k.m.cause }; });
      if (hit) {
        await page.mouse.click(hit.x, hit.y); await sleep(500);
        const card = await page.evaluate(() => { const c = document.querySelector('.cwin-cxc'); if (!c) return null; const r = c.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return { text: c.textContent.slice(0, 200), inside: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight, reach: !!(hit && c.contains(hit)), cause: (c.querySelector('.cxc-cause') || {}).textContent }; });
        ok('a real click on a flag opens its card', !!card, hit.label);
        ok('the card is inside the viewport and under the pointer', card && card.inside && card.reach, JSON.stringify(card));
        ok('and names the cause the flag carried', card && (hit.cause === 'unknown' ? /No known cause/i.test(card.cause || '') : /News|cascade/i.test(card.cause || '')), card && card.cause);
        await page.keyboard.press('Escape'); await page.evaluate(() => { const c = document.querySelector('.cwin-cxc'); if (c) c.remove(); });
      } else ok('a flag to click', false, 'no hit rects');
      // the live path, injected: a -1.5% move starting ten minutes ago
      const live = await page.evaluate(async () => { const w = window.__mpWinsDbg[0], S = window.__mpSig; S.cxLiveAsk(w, { t0: Date.now() - 10 * 60000, pct: -1.5, n: 2 }); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 250)); if (w._cxLive && w._cxLive.on) break; } try { w.dr.redraw(); } catch (e) {} return { on: !!(w._cxLive && w._cxLive.on), cause: w._cxLive && w._cxLive.a && w._cxLive.a.cause, leg: w.legEl ? w.legEl.textContent : '', hits: (w._cxHit || []).length }; });
      ok('an injected live move gets a verdict from the route', live.on && live.cause, JSON.stringify(live).slice(0, 160));
      ok('and the legend shows the LIVE line', /LIVE/.test(live.leg), live.leg.slice(0, 200));
      const brief = await page.evaluate(() => { try { const c = window.__mpAiContext(window.__mpWinsDbg[0]); return c && c.whatMovedIt ? { n: (c.whatMovedIt.recentMoves || []).length, live: !!c.whatMovedIt.live } : null; } catch (e) { return { err: String(e) }; } });
      ok('Ask AI\'s brief carries the moves and the live verdict', brief && brief.n > 0 && brief.live, JSON.stringify(brief));
      await page.evaluate(() => { const w = window.__mpWinsDbg[0]; w.inds.catalyst = false; window.__mpSig.cxWatch(w, false); });
    }
    ok('no page errors on the desktop', page._errors.length === 0, page._errors.join(' | ').slice(0, 200));
    await page.close();

    console.log('[browser] phone /charts');
    const seedM = { mp_mfc_state: JSON.stringify({ split: false, active: 0, panes: [{ sym: 'BTC', tf: '15', inds: { catalyst: true } }] }), mp_ck_ok: '1' };
    const pm = await prep(browser, true, 390, 844, seedM);
    await pm.goto(BASE + '/charts', { waitUntil: 'domcontentloaded', timeout: 60000 });
    let gotM = false;
    try { await pm.waitForFunction(() => { const ps = window.__mpMfcDbg && window.__mpMfcDbg(); const p = ps && ps[0]; return !!(p && p.w && p.w._cx && p.w._cx.moves); }, { timeout: 40000 }); gotM = true; } catch (e) {}
    ok('the phone pane loaded the month', gotM);
    if (gotM) {
      await sleep(1000);
      const stM = await pm.evaluate(() => { const p = window.__mpMfcDbg()[0]; try { p.w.dr.redraw(); } catch (e) {} /* the phone hides legend VALUES by default (mp:leghide), so the line is read off the pane's own legItems, which is what it paints from */ return { marks: (p.w._cxMarks || []).length, hits: (p.w._cxHit || []).length, leg: (p.legItems || []).map(x => x.label).join(' | ') }; });
      ok('marks on the phone pane', stM.marks > 0, stM.marks);
      ok('flags painted on the phone', stM.hits > 0, stM.hits);
      ok('the phone legend carries the month line', /WHAT MOVED IT/.test(stM.leg), stM.leg.slice(0, 160));
    }
    ok('no page errors on the phone', pm._errors.length === 0, pm._errors.join(' | ').slice(0, 200));
    await pm.close();
  }, { timeout: 230000 });
}

(async () => {
  if (PURE || (!BROWSER && !has('--prod'))) pureLeg();
  if (!PURE) await prodLeg();
  if (BROWSER) await browserLeg();
  console.log('\ncatalyst-moves-e2e: ' + pass + ' ok, ' + fail + ' failed' + (FALSIFY ? ' (falsify)' : ''));
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
