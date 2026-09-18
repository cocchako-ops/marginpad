/* What the AI actually KNOWS about the chart (2026-09-18).
 *
 * The model never sees the chart - it reads a JSON brief. So the brief IS the quality ceiling, and this file
 * guards it from two directions:
 *
 *   1. PURE: every detector is run - out of the SHIPPED bundle, not a copy - against candles built to contain the
 *      thing it looks for. This is the load-bearing half. The first cut of the liquidity-sweep detector put the
 *      recency test on the PIVOT rather than on the sweep candle, so it could never fire on any chart, ever, and
 *      would have read for months as "this market is quiet". A detector that cannot fire is worse than no
 *      detector, and nothing but a test like this finds one.
 *   2. LIVE: a real chart in a real browser - the blocks populate with real numbers, and the whole brief still
 *      fits the cap the worker sends it under. An over-cap brief is not a smaller brief, it is a BROKEN one.
 *
 * Run: node build/ai-brief-e2e.js
 */
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');

const BUNDLE = path.join(__dirname, '..', 'dist', 'assets', 'mp-charts.js');
const WORKER = path.join(__dirname, '..', 'src', 'worker.js');
const CAP = 7000; // must match briefJson(ctx, N) in handleAiChart

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 220) : '')); } };

// ---- lift the real functions out of the shipped bundle -------------------------------------------------------
const src = fs.readFileSync(BUNDLE, 'utf8');
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found in the bundle: ' + name);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; started = true; }
    else if (src[j] === '}') { d--; if (started && d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces reading ' + name);
}
const _p6 = (x) => (x != null && isFinite(x)) ? +(+x).toPrecision(6) : null;
const tfWords = (t) => String(t) + 'm';
for (const fn of ['pivotsOf', 'levelsOf', 'volOf', 'aggBars', 'htfOf', 'fvgOf', 'volRegimeOf', 'setupsOf', 'sessionOf']) eval(grab(fn));

const bar = (o, h, l, c, v) => ({ time: 0, open: o, high: h, low: l, close: c, vol: v == null ? 100 : v });
const names = (s) => (s || []).map(x => x.name).join(' | ');

console.log('\nPURE - each detector against candles that contain the thing');

// liquidity sweep: an older pivot high, then a wick through it closing back under
{
  const b = [];
  for (let i = 0; i < 60; i++) b.push(bar(100, 101, 99, 100));
  b[30] = bar(100, 112, 99, 100);
  for (let i = 31; i < 58; i++) b[i] = bar(100, 103, 98, 100);
  b[58] = bar(100, 115, 99, 104);
  b[59] = bar(104, 105, 102, 103);
  const s = setupsOf(b, pivotsOf(b, 3, 16), [], 103, null);
  ok(!!s && /liquidity sweep of the high/.test(names(s)), 'liquidity sweep fires on a swept pivot high', { got: names(s) });
}
// and it must NOT fire when the candle closes beyond the level (that is a break, not a sweep)
{
  const b = [];
  for (let i = 0; i < 60; i++) b.push(bar(100, 101, 99, 100));
  b[30] = bar(100, 112, 99, 100);
  for (let i = 31; i < 58; i++) b[i] = bar(100, 103, 98, 100);
  b[58] = bar(100, 118, 99, 117);   // closes ABOVE the pivot
  b[59] = bar(117, 119, 116, 118);
  const s = setupsOf(b, pivotsOf(b, 3, 16), [], 118, null);
  ok(!/liquidity sweep/.test(names(s)), 'a clean break through a pivot is NOT reported as a sweep', { got: names(s) });
}
// failed breakout of a respected level
{
  const b = [];
  for (let i = 0; i < 60; i++) b.push(bar(100, 101, 99, 100));
  b[20] = bar(100, 110, 99, 100); b[40] = bar(100, 110, 99, 100);
  b[55] = bar(100, 113, 99, 112); b[57] = bar(112, 112, 105, 106);
  const p = pivotsOf(b, 3, 16), l = levelsOf(p, 106, 0.01);
  const s = setupsOf(b, p, l, 106, null);
  ok(!!s && /failed break of the resistance/.test(names(s)), 'failed breakout fires on a broken-then-reclaimed level', { got: names(s), levels: l.length });
}
// range compression
{
  const b = [];
  for (let i = 0; i < 120; i++) b.push(bar(100, 104, 96, 100));
  for (let i = 100; i < 120; i++) b[i] = bar(100, 100.4, 99.6, 100);
  const s = setupsOf(b, pivotsOf(b, 3, 16), [], 100, { atrPercentileVsOwnHistory: 10 });
  ok(!!s && /range compression/.test(names(s)), 'range compression fires on a quiet, narrowing tail', { got: names(s) });
}
// a market with nothing in it must report NOTHING - an honest empty answer
{
  const b = [];
  for (let i = 0; i < 120; i++) b.push(bar(100 + i * 0.5, 101 + i * 0.5, 99 + i * 0.5, 100.4 + i * 0.5));
  const s = setupsOf(b, pivotsOf(b, 3, 16), [], 160, { atrPercentileVsOwnHistory: 50 });
  ok(s === null, 'a clean trend with no pattern reports nothing rather than inventing one', { got: names(s) });
}
// FVG: an unfilled gap up is found; a filled one is not
{
  const b = [];
  for (let i = 0; i < 40; i++) b.push(bar(100, 101, 99, 100));
  b[31] = bar(101, 108, 101, 107); b[32] = bar(107, 109, 104, 108);
  for (let i = 33; i < 40; i++) b[i] = bar(108, 109, 107, 108);
  const g = fvgOf(b, 108);
  ok(!!g && g.length >= 1 && g[0].side === 'bullish' && g[0].from < g[0].to, 'fair value gap found, with from < to and a side', { got: g });

  const f = b.slice();
  for (let i = 33; i < 40; i++) f[i] = bar(108, 109, 100, 101);  // trades back through the gap
  ok(fvgOf(f, 101) === null, 'a gap price has traded back through is NOT reported', { got: fvgOf(f, 101) });
}
// volume: the node is a price inside the range, and a heavy bar reads as heavy
{
  const b = [];
  for (let i = 0; i < 60; i++) b.push(bar(100, 101, 99, 100, 100));
  b[59] = bar(100, 101, 99, 100, 400);
  const v = volOf(b);
  ok(!!v && v.lastBarVsMedian20 >= 3 && /heavier/.test(v.state), 'volume reads a 4x bar as much heavier than usual', { got: v && { r: v.lastBarVsMedian20, s: v.state } });
  ok(!!v && v.heaviestTradedPrice >= 99 && v.heaviestTradedPrice <= 101, 'heaviestTradedPrice lands inside the traded range', { got: v && v.heaviestTradedPrice });
}
// volatility percentile: a quiet tail after a wild history reads as a squeeze
{
  const b = [];
  for (let i = 0; i < 160; i++) b.push(bar(100, 106, 94, 100));
  for (let i = 140; i < 160; i++) b[i] = bar(100, 100.3, 99.7, 100);
  const r = volRegimeOf(b);
  ok(!!r && r.atrPercentileVsOwnHistory <= 25 && /squeeze/.test(r.regime), 'volatility reads a quiet tail as a squeeze', { got: r });
}
// higher timeframe: aggregation is x4 and the structure is read from the aggregated bars
{
  const b = []; let p = 100;
  for (let i = 0; i < 400; i++) { p += (i % 17 < 9 ? 0.6 : -0.35); b.push(bar(p - 0.2, p + 1.2, p - 1.2, p)); }
  ok(aggBars(b, 4).length === 100, 'aggBars folds 400 candles into 100');
  const h = htfOf(b, 60, p);
  ok(!!h && h.structure === 'uptrend', 'higher timeframe reads an uptrend off the aggregated candles', { got: h && h.structure });
  ok(!!h && /aggregated x4/.test(h.note || ''), 'the higher-timeframe block says where it came from');
  ok(htfOf(b.slice(0, 60), 60, p) === null, 'too few candles to aggregate honestly returns nothing, never a guess');
}
// session
{
  const b = []; const t0 = Date.UTC(2026, 8, 17, 20, 0, 0) / 1000;
  for (let i = 0; i < 30; i++) b.push(Object.assign(bar(100, 101, 99, 100), { time: t0 + i * 3600 }));
  const s = sessionOf(b);
  ok(!!s && s.lastUtcDayOpenBarsAgo > 0 && s.lastUtcDayOpenBarsAgo < 30, 'the UTC day open is found and dated in barsAgo', { got: s });
}

// ---- the worker's own brief packer ---------------------------------------------------------------------------
console.log('\nPURE - the brief packer (an over-cap brief must be SMALLER, never broken)');
{
  const w = fs.readFileSync(WORKER, 'utf8');
  const i = w.indexOf('const BRIEF_DROP'), j = w.indexOf('// "Ask AI about this chart"');
  eval(w.slice(i, j));
  ok(/briefJson\(ctx, 7000\)/.test(w), 'handleAiChart packs the brief at the cap this test checks (' + CAP + ')');
  const big = {
    symbol: 'BTC', price: 80900, setups: [{ name: 'keep me' }], volume: { state: 'normal' }, chartTools: { x: 1 },
    swingPivots: new Array(60).fill({ barsAgo: 1, price: 80000, kind: 'high' }),
    recentCloses: new Array(200).fill(80000),
    liquidationPools: { above: new Array(30).fill({ price: 1, sizeUsd: 2 }) },
  };
  for (const cap of [CAP, 3000, 1200, 700]) {
    const out = briefJson(big, cap);
    let parsed = null; try { parsed = JSON.parse(out); } catch (e) {}
    ok(!!parsed, 'brief at cap ' + cap + ' is still valid JSON', { len: out.length });
    ok(!!parsed && !!parsed.setups && !!parsed.volume, 'brief at cap ' + cap + ' keeps the measured blocks (pivots/closes go first)');
    if (out.length > cap) ok(false, 'brief at cap ' + cap + ' respects the cap', { len: out.length });
  }
  const small = { symbol: 'BTC', setups: null };
  ok(briefJson(small, CAP) === JSON.stringify(small), 'a brief that already fits is passed through untouched');
  ok(/_omitted/.test(briefJson(big, 1200)), 'a trimmed brief SAYS what was left out, so an absent block is never read as an absent market');
}

// ---- the server's own half of the brief -----------------------------------------------------------------------
// marketPressure is merged SERVER-side (funding, open interest, positioning, our collector's liquidations), so it
// cannot be seen from the client builder. The only honest test is to ask the model for the numbers and check it
// has them - if the merge breaks, the assistant simply says it cannot see them and nobody would ever notice.
console.log('\nLIVE - the half of the brief the server adds');
async function derivCheck() {
  const KEY = 'mpadm_20ca118e2de368204c82ea9a97a6fca4';
  const brief = {
    symbol: 'BTC', timeframe: '1-hour', price: 81000, barsLoaded: 1000,
    swingPivots: [{ barsAgo: 4, price: 81390, kind: 'high' }],
    respectedLevels: [{ price: 79743, kind: 'resistance', touches: 3 }],
    chartTools: { indicators: { ids: ['rsi'], on: [], locked: [] }, shapes: ['level'], timeframes: ['60'], currentTf: '60', currentTfLabel: '1-hour', canSwitchSymbol: true },
  };
  let j = null;
  try {
    const r = await fetch('https://marginpad.io/api/ai/chart', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' },
      body: JSON.stringify({ context: brief, question: 'State the funding rate, the 24h open-interest change and the 24h liquidation split. Numbers only.', stream: false, lang: 'en' }),
    });
    j = await r.json();
  } catch (e) { ok(false, 'the model call threw: ' + e.message); return; }
  const a = String((j && j.answer) || '');
  ok(!!a, 'the model answered');
  // a live funding rate and an OI change, in an answer that could only contain them if the merge worked
  ok(/funding/i.test(a) && /-?\d+\.\d+ ?%/.test(a), 'it can state a funding rate', a.slice(0, 120));
  ok(/open interest/i.test(a), 'and the open-interest move', a.slice(0, 120));
  ok(/liquidat/i.test(a) && /\$\s?[\d.,]+ ?[MBK]/i.test(a), 'and the liquidation split in dollars - our collector, not a model', a.slice(0, 160));
  ok(!/(cannot|can't|do not have|don't have|not provided|no data)/i.test(a.slice(0, 260)), 'it does NOT say the data is missing', a.slice(0, 160));
}

// ---- live ----------------------------------------------------------------------------------------------------
console.log('\nLIVE - a real chart in a real browser');
derivCheck().then(() => withBrowser(async (browser) => {
  for (const sym of ['BTC', 'SOL']) {
    const page = await newPage(browser);
    const errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
    await page.goto('https://marginpad.io/charts?coin=' + sym, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(s => setTimeout(s, 13000));
    const o = await page.evaluate(() => {
      const w = window.__mpWinsDbg && window.__mpWinsDbg[0];
      if (!w || !window.__mpAiContext) return { err: 'chart not ready' };
      const c = window.__mpAiContext(w);
      return {
        sym: w.sym, total: JSON.stringify(c).length, bars: w.bars.length,
        hasVol: !!(c.volume && c.volume.heaviestTradedPrice),
        hasRegime: !!(c.volatility && typeof c.volatility.atrPercentileVsOwnHistory === 'number'),
        hasHtf: !!(c.higherTimeframe && c.higherTimeframe.timeframe),
        htfDiffers: !!(c.higherTimeframe && c.higherTimeframe.timeframe !== c.timeframe),
        fvg: (c.fairValueGaps || []).length,
        fvgSane: (c.fairValueGaps || []).every(g => g.from < g.to && g.widthPct > 0),
        sess: !!(c.session && c.session.lastUtcDayOpenBarsAgo >= 0),
        volSane: !!(c.volume && c.volume.lastBarVsMedian20 > 0),
      };
    });
    if (o.err) { ok(false, sym + ': ' + o.err); await page.close().catch(() => {}); continue; }
    ok(o.total <= CAP, sym + ': the whole brief fits the cap (' + o.total + ' / ' + CAP + ' chars)', o);
    ok(o.hasVol && o.volSane, sym + ': volume is present with a traded-volume node and a sane ratio', o);
    ok(o.hasRegime, sym + ': volatility carries a percentile of this market\'s own history', o);
    ok(o.hasHtf && o.htfDiffers, sym + ': the higher timeframe is present and is NOT the frame in view', o);
    ok(o.fvgSane, sym + ': every fair value gap has from < to and a real width (' + o.fvg + ' found)', o);
    ok(o.sess, sym + ': the UTC day open is dated', o);
    ok(errs.length === 0, sym + ': no page errors', errs.slice(0, 3));
    await page.close().catch(() => {});
  }
}, { timeoutMs: 230000 }))
  .catch(e => { fail++; console.error('fatal ' + e.message); })
  .then(() => {
    console.log('\n' + pass + ' checks, ' + fail + ' failed');
    process.exitCode = fail ? 1 : 0; // never process.exit mid-teardown - the shell sees 127 on a green run
  });
