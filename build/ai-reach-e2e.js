/* AN ENTRY PRICE NEVER REACHES IS NOT A TRADE (2026-10-11, owner: "dosta puta kad ga pitam za neki potencijalni
 * setup on mi da neki entry ... jednostavno cena je prosla taj entry nivo ... bolje da kaze nema pozicije sad ali
 * evo ti analiza charta").
 *
 * MEASURED before this existed: over 30 days, 30 of 30 directional Ask AI calls expired with price never ONCE
 * touching the entry, each with a full seven days to do it. The cause was the prompt's own rule - "an entry is a
 * price worth WAITING for, not the price right now" - which is correct and had no ceiling.
 *
 * This file guards the ceiling from three sides:
 *   1. PURE: the measurement and the judgement, lifted out of the SHIPPED bundle, against candles built to contain
 *      a known excursion. A detector that cannot fire is worse than none, so every check here is written to go RED
 *      when the rule is removed - verify with --falsify.
 *   2. ONE JUDGEMENT, TWO PLACES: the worker's aiReachMissOf and the chart's aiReachMiss must agree on the same
 *      numbers, or the book and the screen disagree about what counted as a trade.
 *   3. LIVE: a real chart in a real browser - the brief carries `reach`, and a plan outside it renders as
 *      NO POSITION NOW with the measurement printed, while one inside it still renders as a trade.
 *
 * Run: node build/ai-reach-e2e.js            (add --pure to skip the browser)
 *      node build/ai-reach-e2e.js --falsify  (asserts the suite CAN fail)
 */
const fs = require('fs');
const path = require('path');

const BUNDLE = path.join(__dirname, '..', 'dist', 'assets', 'mp-charts.js');
const WORKER = path.join(__dirname, '..', 'src', 'worker.js');
const PURE = process.argv.includes('--pure');
const FALSIFY = process.argv.includes('--falsify');

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d ? '  ' + JSON.stringify(d).slice(0, 240) : '')); } };

// ---- lift the real functions out of the shipped files --------------------------------------------------------
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0, started = false;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') { d++; started = true; }
    else if (src[j] === '}') { d--; if (started && d === 0) return src.slice(i, j + 1); }
  }
  throw new Error('unbalanced braces reading ' + name);
}
let CSRC = fs.readFileSync(BUNDLE, 'utf8');
const WSRC = fs.readFileSync(WORKER, 'utf8');

// the falsification run breaks exactly ONE thing - the line that makes an unreachable entry stop being a trade
if (FALSIFY) {
  const line = 'if(aiReachMiss(plan)) return false;';
  if (CSRC.indexOf(line) < 0) throw new Error('falsify: the guard line is not in the bundle - did it move?');
  CSRC = CSRC.replace(line, 'if(false) return false;');
  console.log('FALSIFY: the reach guard is removed from aiTradable in memory. Checks marked [LB] must go RED.\n');
}

const C = {};
['excursionOf', 'aiReachOf', 'aiStampReach', 'aiReachMiss', 'aiTradable', 'aiRR'].forEach((n) => {
  // eslint-disable-next-line no-new-func
  C[n] = n;
});
const clientFns = new Function('var AI_MIN_RR=1.5;' +
  ['excursionOf', 'aiReachOf', 'aiStampReach', 'aiReachMiss', 'aiRR', 'aiTradable'].map((n) => grab(CSRC, n)).join('\n') +
  '\nreturn {excursionOf:excursionOf,aiReachOf:aiReachOf,aiStampReach:aiStampReach,aiReachMiss:aiReachMiss,aiTradable:aiTradable,aiRR:aiRR};')();
const workerFns = new Function(grab(WSRC, 'aiReachMissOf') + '\nreturn {aiReachMissOf:aiReachMissOf};')();

// ---- candles with a KNOWN excursion --------------------------------------------------------------------------
/* A sawtooth around 100: every bar's high is +1% and its low is -1% of its own close, and the close itself walks
   a slow 20-bar cycle of +-0.5%. Over 18 candles the up-excursion is therefore about 1.5% and the down about the
   same - a number this test can state rather than discover. */
function sawCandles(n, amp, wick) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const c = 100 * (1 + amp * Math.sin(i / 20 * Math.PI * 2));
    out.push({ time: 1700000000 + i * 3600, open: c, high: c * (1 + wick), low: c * (1 - wick), close: c, vol: 1000 });
  }
  return out;
}
function flatCandles(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ time: 1700000000 + i * 3600, open: 100, high: 100, low: 100, close: 100, vol: 1 });
  return out;
}

console.log('PURE - the measurement');
{
  const bars = sawCandles(400, 0.005, 0.01);
  const px = +bars[bars.length - 1].close;
  const e = clientFns.excursionOf(bars, px, 18);
  ok(!!e, 'excursionOf returns a reading on 400 candles', e);
  ok(e && e.up > 0.009 && e.up < 0.035, 'the up-excursion is the wick plus the cycle, not the net move (0.9-3.5%)', e && { up: +(e.up * 100).toFixed(2) });
  ok(e && e.down > 0.009 && e.down < 0.035, 'and the down-excursion likewise', e && { down: +(e.down * 100).toFixed(2) });
  ok(e && e.bars === 18 && e.n > 300, 'it reports the horizon it measured and how many windows it used', e && { bars: e.bars, n: e.n });

  /* NET DISPLACEMENT IS THE WRONG STATISTIC and this is the case that proves it: a market that ends every window
     exactly where it started still touches +-1% on every single bar. travelOf would call that unreachable. */
  const flat = [];
  for (let i = 0; i < 200; i++) flat.push({ time: 1700000000 + i * 3600, open: 100, high: 101, low: 99, close: 100, vol: 1 });
  const fe = clientFns.excursionOf(flat, 100, 18);
  ok(fe && fe.up > 0.009 && fe.down > 0.009, 'a market with ZERO net movement still has a real excursion - the statistic the entry needs', fe);

  ok(clientFns.excursionOf(flatCandles(200), 100, 18).up === 0, 'a genuinely dead market reaches nowhere');
  ok(clientFns.excursionOf(sawCandles(20, 0.005, 0.01), 100, 18) === null, 'too few candles to measure returns null, never a guess');
}

console.log('\nPURE - the judgement');
{
  const bars = sawCandles(400, 0.005, 0.01);
  const w = { sym: 'TEST', tf: '60', bars };
  const r = clientFns.aiReachOf(w);
  ok(!!r && r.price > 0 && r.upPct > 0, 'aiReachOf reads the band off the window', r && { up: r.upPct, down: r.downPct });
  ok(clientFns.aiReachOf(w) === r, 'and caches it against the candles it measured (same object back)');

  const px = r.price;
  const near = (plan) => clientFns.aiStampReach(w, plan);
  const inBandUp = px * (1 + r.up * 0.5), outBandUp = px * (1 + r.up * 3);
  const inBandDn = px * (1 - r.down * 0.5), outBandDn = px * (1 - r.down * 3);

  ok(clientFns.aiReachMiss(near({ bias: 'long', entry: inBandDn, stop: inBandDn * 0.98, targets: [inBandDn * 1.06] })) === null,
    'an entry inside the band is reachable');
  const miss = clientFns.aiReachMiss(near({ bias: 'long', entry: outBandDn, stop: outBandDn * 0.98, targets: [outBandDn * 1.06] }));
  ok(!!miss && miss.side === 'below', 'an entry far below the band is flagged, and the side is named', miss);
  ok(miss && miss.distPct > miss.reachPct, 'and it reports both numbers - how far it asked for, how far this market goes', miss);
  const missUp = clientFns.aiReachMiss(near({ bias: 'short', entry: outBandUp, stop: outBandUp * 1.02, targets: [outBandUp * 0.94] }));
  ok(!!missUp && missUp.side === 'above', 'the same above price, measured against the UP side of the band', missUp);
  ok(clientFns.aiReachMiss(near({ bias: 'short', entry: inBandUp, stop: inBandUp * 1.02, targets: [inBandUp * 0.94] })) === null,
    'an entry inside the band above price is reachable too');

  /* THE SIDES ARE MEASURED SEPARATELY and must not be collapsed to one number: a market in a downtrend does not
     reach as far up as it reaches down, and an entry is only ever on one side. */
  const dn = [];
  for (let i = 0; i < 400; i++) { const c = 100 - i * 0.05; dn.push({ time: 1700000000 + i * 3600, open: c, high: c * 1.001, low: c * 0.99, close: c, vol: 1 }); }
  const rd = clientFns.aiReachOf({ sym: 'DN', tf: '60', bars: dn });
  ok(rd && rd.down > rd.up * 1.5, 'in a falling market the band reaches further DOWN than up', rd && { up: rd.upPct, down: rd.downPct });

  // [LB] the one that decides whether any of this reaches the reader
  const good = near({ bias: 'long', entry: inBandDn, stop: inBandDn * 0.98, targets: [inBandDn * 1.06] });
  const far = near({ bias: 'long', entry: outBandDn, stop: outBandDn * 0.98, targets: [outBandDn * 1.06] });
  ok(clientFns.aiRR(good) >= 1.5 && clientFns.aiRR(far) >= 1.5, 'both test plans clear the 1.5 R:R rule, so only reach can separate them',
    { good: clientFns.aiRR(good), far: clientFns.aiRR(far) });
  ok(clientFns.aiTradable(good) === true, '[LB] a reachable plan that pays 1.5x IS a trade');
  ok(clientFns.aiTradable(far) === false, '[LB] the same plan with an out-of-reach entry is NOT a trade');

  /* THE EDGE OF THE BAND IS WHERE IT FLIPS, and both halves of that sentence are load-bearing: a guard that
     refuses everything is as useless as one that refuses nothing. */
  const at = (mult) => clientFns.aiTradable(near({ bias: 'long', entry: px * (1 - r.down * mult), stop: px * (1 - r.down * mult) * 0.98, targets: [px * (1 - r.down * mult) * 1.06] }));
  ok([0.2, 0.5, 0.9].every(at), '[LB] everything comfortably inside the band is still a trade', { at: [0.2, 0.5, 0.9].map(at) });
  ok([1.4, 2.5, 6].every((m) => at(m) === false), '[LB] everything well outside it is not', { at: [1.4, 2.5, 6].map(at) });

  /* An older client sends no measurement. It must behave EXACTLY as it did before this rule existed - a silent
     behaviour change on a surface we cannot see is worse than the bug. */
  const bare = { bias: 'long', entry: outBandDn, stop: outBandDn * 0.98, targets: [outBandDn * 1.06] };
  ok(clientFns.aiReachMiss(bare) === null && clientFns.aiTradable(bare) === true, 'with no reach measurement nothing changes - a plan is judged on R:R alone');
  ok(JSON.stringify(good).indexOf('_reach') < 0, 'the measurement is non-enumerable: it never travels into the saved thread or a button payload');
}

console.log('\nONE JUDGEMENT, TWO PLACES');
{
  const bars = sawCandles(400, 0.005, 0.01);
  const w = { sym: 'TEST', tf: '60', bars };
  const r = clientFns.aiReachOf(w);
  // the brief the worker receives is built from exactly this reading
  const ctx = { price: r.price, reach: { horizonBars: r.bars, reachableUpPct: r.upPct, reachableDownPct: r.downPct } };
  const cases = [r.price * (1 + r.up * 0.5), r.price * (1 + r.up * 3), r.price * (1 - r.down * 0.5), r.price * (1 - r.down * 3), r.price];
  let agree = 0;
  cases.forEach((entry) => {
    const cm = clientFns.aiReachMiss(clientFns.aiStampReach(w, { bias: 'long', entry }));
    const wm = workerFns.aiReachMissOf(ctx, entry);
    if (!!cm === !!wm && (!cm || (cm.side === wm.side && Math.abs(cm.distPct - wm.distPct) < 0.02))) agree++;
  });
  ok(agree === cases.length, 'the chart and the worker reach the same verdict on every case', { agree, of: cases.length });
  ok(workerFns.aiReachMissOf({ price: 100 }, 140) === null, 'a brief with no reach block records the way it always did');
  ok(workerFns.aiReachMissOf(ctx, 0) === null, 'a plan with no entry is not an out-of-reach entry');
}

if (PURE || FALSIFY) {
  console.log('\n' + pass + ' passed, ' + fail + ' failed' + (FALSIFY ? '  (falsification run: failures are the point)' : ''));
  if (FALSIFY) {
    if (fail >= 2) { console.log('\nFALSIFIED: removing the guard turned ' + fail + ' checks red. The suite can fail.'); process.exitCode = 0; }
    else { console.log('\nNOT FALSIFIED: the guard was removed and only ' + fail + ' checks noticed. This suite is worth nothing.'); process.exitCode = 1; }
  } else process.exitCode = fail ? 1 : 0;
  return;
}

// ---- LIVE -----------------------------------------------------------------------------------------------------
const { withBrowser } = require('./e2e-browser.js');
const ORIGIN = process.argv.includes('--local') ? 'http://127.0.0.1:8788' : 'https://marginpad.io';

(async () => {
  console.log('\nLIVE - ' + ORIGIN);
  await withBrowser(async (browser) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 950 });
    await page.setBypassServiceWorker(true);
    await page.goto(ORIGIN + '/charts?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await page.waitForFunction('!!document.getElementById("cwsAdd") || (window.__mpWinsDbg && window.__mpWinsDbg.length)', { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { if (!(window.__mpWinsDbg && window.__mpWinsDbg.length)) { const a = document.getElementById('cwsAdd'); a && a.click(); } });
    await page.waitForFunction('window.__mpWinsDbg && window.__mpWinsDbg[0] && window.__mpWinsDbg[0].bars && window.__mpWinsDbg[0].bars.length>80', { timeout: 60000 });

    const brief = await page.evaluate(() => {
      const w = window.__mpWinsDbg[0];
      const c = window.__mpAiContext(w);
      return { reach: c.reach, price: c.price, sym: c.symbol };
    });
    ok(!!brief.reach, 'the brief a real chart sends carries `reach`', brief.reach);
    ok(brief.reach && brief.reach.reachableUpPct > 0 && brief.reach.reachableDownPct > 0, 'with a real, non-zero band on both sides', brief.reach);
    ok(brief.reach && brief.reach.entryBandLow < brief.price && brief.reach.entryBandHigh > brief.price, 'the band brackets the live price', brief.reach);
    ok(brief.reach && /entry/i.test(String(brief.reach.note)) && /NO POSITION NOW/.test(String(brief.reach.note)),
      'and it tells the model what happens if it ignores it');

    const cards = await page.evaluate(() => {
      const w = window.__mpWinsDbg[0], px = +w.bars[w.bars.length - 1].close;
      const r = window.__mpAi.reachOf(w);
      const mk = (entry) => ({ bias: 'long', confidence: 60, entry, stop: entry * 0.98, targets: [entry * 1.06, entry * 1.1], levels: [] });
      const near = mk(px * (1 - r.down * 0.5)), far = mk(px * (1 - r.down * 4));
      window.__mpAi.stampReach(w, near); window.__mpAi.stampReach(w, far);
      return { nearHtml: window.__mpAi.planCard(near, px), farHtml: window.__mpAi.planCard(far, px),
        nearTradable: window.__mpAi.tradable(near), farTradable: window.__mpAi.tradable(far),
        band: { up: r.upPct, down: r.downPct } };
    });
    ok(cards.nearTradable === true && cards.farTradable === false, '[LB] on the live chart a reachable plan is a trade and a far one is not', { band: cards.band });
    ok(/NO POSITION NOW/.test(cards.farHtml), '[LB] the far plan renders the words the owner asked for');
    ok(!/NO POSITION NOW/.test(cards.nearHtml) && /LONG/.test(cards.nearHtml), 'the reachable plan still renders as a LONG');
    ok(/Out of reach/.test(cards.farHtml), 'the far card names the reason');
    ok(/away\. Over the next \d+ candles this market gets about/.test(cards.farHtml.replace(/<[^>]*>/g, '')),
      'and prints the measurement behind it, not just a refusal', cards.farHtml.replace(/<[^>]*>/g, '').slice(0, 200));
    ok(cards.farHtml.indexOf('aipc-rows w') >= 0, 'the levels are still drawn for watching - the read is not thrown away');

    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message)));
    await new Promise((r) => setTimeout(r, 800));
    ok(errs.length === 0, 'no page errors', errs.slice(0, 2));
    await page.close();
  }, { timeoutMs: 240000 });

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
