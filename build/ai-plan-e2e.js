/* The plan, the card and the chart must say the same thing (2026-09-19).
 *
 * Two faults this guards, both found in production:
 *   1. A `wait` plan still drew AI ENTRY, AI STOP and both TP price lines, while the card correctly hid those rows.
 *      A reader got a card saying WAIT over a chart showing a full trade. Measured on SOL: bias 'wait' returned
 *      with entry 107.20, stop 104.2 and two targets.
 *   2. The prompt has said since day one that a first target paying under 1.5x the risk should be a wait - and the
 *      chart drew R:R 0.83 as a position block with POOR across it. Printing a warning is not honouring a rule.
 *
 * Everything now asks aiTradable(). This runs the REAL functions out of the shipped bundle against hand-built
 * plans, then proves it on a live chart.
 *
 * Run: node build/ai-plan-e2e.js
 */
const fs = require('fs');
const path = require('path');
const { withBrowser, newPage } = require('./e2e-browser.js');

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (d !== undefined ? '  ' + JSON.stringify(d).slice(0, 200) : '')); } };

console.log('\nPURE - the one rule, run out of the shipped bundle');
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'mp-charts.js'), 'utf8');
  const grab = (name) => {
    const i = src.indexOf('function ' + name + '(');
    if (i < 0) throw new Error('not in the bundle: ' + name);
    let d = 0, started = false;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') { d++; started = true; }
      else if (src[j] === '}') { d--; if (started && d === 0) return src.slice(i, j + 1); }
    }
    throw new Error('unbalanced: ' + name);
  };
  const mRr = src.match(/var AI_MIN_RR *= *([0-9.]+)/);
  ok(!!mRr, 'the bundle declares a reward-to-risk floor');
  const AI_MIN_RR = mRr ? +mRr[1] : 1.5;
  eval(grab('aiRR')); eval(grab('aiTradable')); eval(grab('aiWhyNotTradable'));

  const long = (e, st, t) => ({ bias: 'long', entry: e, stop: st, targets: [t] });
  ok(aiTradable(long(100, 98, 104)) === true, 'a long paying 2.0x the risk is a trade', aiRR(long(100, 98, 104)));
  ok(aiTradable(long(100, 98, 103)) === true, 'a long paying exactly the floor is a trade', aiRR(long(100, 98, 103)));
  ok(aiTradable(long(100, 98, 101.6)) === false, 'a long paying 0.8x is NOT a trade', aiRR(long(100, 98, 101.6)));
  ok(aiTradable({ bias: 'wait', entry: 107.2, stop: 104.2, targets: [112.63, 114.31] }) === false,
    'the exact SOL plan that caused this - bias wait carrying entry, stop and targets - is not a trade');
  ok(aiTradable({ bias: 'long', levels: [{ price: 100 }] }) === true, 'a long with no targets yet is still a trade (nothing to judge)');
  ok(aiTradable(null) === false && aiTradable({}) === false, 'a missing or empty plan is never a trade');
  ok(aiWhyNotTradable(long(100, 98, 101.6)) === aiRR(long(100, 98, 101.6)), 'the card is told the ratio so it can name it', aiWhyNotTradable(long(100, 98, 101.6)));
  ok(aiWhyNotTradable(long(100, 98, 104)) === '', 'a sound setup gets no excuse line');
  ok(aiWhyNotTradable({ bias: 'wait' }) === '', 'an honest wait is not reported as a rejected trade');
}

console.log('\nLIVE - a real chart, three plans');
withBrowser(async (browser) => {
  const page = await newPage(browser);
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 90)));
  await page.goto('https://marginpad.io/charts?coin=BTC&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await new Promise(s => setTimeout(s, 14000));

  const run = async (plan) => page.evaluate((p) => {
    const A = window.__mpAi, w = window.__mpWinsDbg && window.__mpWinsDbg[0];
    if (!A || !w) return { err: 'not ready' };
    const px = +w.bars[w.bars.length - 1].close;
    const scale = (v) => v == null ? v : +(px * v).toFixed(2);
    const P = { bias: p.bias, confidence: 60, entry: scale(p.e), stop: scale(p.s), targets: (p.t || []).map(scale), levels: [{ price: scale(p.e), label: 'watch', kind: 'support' }] };
    try { A.clearAi && A.clearAi(w); } catch (e) {}
    try { if (w._aiPlan) { w._aiPlan.forEach(l => { try { w.candle.removePriceLine(l); } catch (e) {} }); w._aiPlan = []; } } catch (e) {}
    // the real drawing path
    try { A.draw(w, [], 'plantest'); } catch (e) {}
    const before = (w.dr.shapes || []).length;
    try { window.__mpAiDrawPlan ? window.__mpAiDrawPlan(w, P, false) : (A.drawPlan && A.drawPlan(w, P, false)); } catch (e) { return { err: 'no drawPlan hook' }; }
    const card = A.planCard ? A.planCard(P, px) : '';
    const rects = (w.dr.shapes || []).filter(s => s.ai && s.t === 'rect').length;
    const lines = (w._aiPlan || []).length;
    return { lines, rects, card: String(card).replace(/\s+/g, ' '), added: (w.dr.shapes || []).length - before };
  }, plan);

  const sound = await run({ bias: 'long', e: 0.99, s: 0.975, t: [1.02, 1.04] });
  if (sound.err) ok(false, 'live: ' + sound.err);
  else {
    ok(sound.lines >= 3, 'a sound long draws its entry, stop and targets (' + sound.lines + ' lines)', sound);
    ok(/ENTRY|Entry/.test(sound.card), 'and the card shows the entry row');
  }

  const waitPlan = await run({ bias: 'wait', e: 0.99, s: 0.975, t: [1.02, 1.04] });
  if (!waitPlan.err) {
    // 2026-09-19: a wait plan used to hide its levels, which left "wait for a pullback" with nothing to wait
    // FOR. It shows the trigger now - but it has to be unmistakably not-a-trade, and THAT is what is load-bearing
    // here: no risk/reward rectangles, no position block, and the rows carried under the waiting label.
    ok(/aipc-wait/.test(waitPlan.card) && /aipc-rows w/.test(waitPlan.card), 'a WAIT plan shows its trigger rows, marked as waiting', { card: waitPlan.card.slice(0, 200) });
    ok(/waiting for/i.test(waitPlan.card), 'and the label says it is not a trade yet');
    ok(waitPlan.rects === 0, 'and paints no risk/reward rectangles', waitPlan);
    ok(waitPlan.lines >= 3, 'the trigger is on the chart too (' + waitPlan.lines + ' lines)', waitPlan);
    ok(/WAIT/.test(waitPlan.card), 'the card says WAIT');
  }

  const poor = await run({ bias: 'long', e: 1.0, s: 0.98, t: [1.016] });
  if (!poor.err) {
    ok(/WAIT/.test(poor.card), 'a long paying under 1.5x is presented as a WAIT, not a trade with a warning', { card: poor.card.slice(0, 140) });
    ok(/Not worth it/.test(poor.card), 'and the card says WHY, with the ratio');
    ok(poor.rects === 0, 'no risk/reward rectangles for a setup below the floor', poor);
  }
  ok(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await page.close().catch(() => {});
}, { timeoutMs: 200000 })
  .catch(e => { fail++; console.error('fatal ' + e.message); })
  .then(() => {
    console.log('\n' + pass + ' checks, ' + fail + ' failed');
    process.exitCode = fail ? 1 : 0;
  });
