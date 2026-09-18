// BEFORE / AFTER, HONESTLY (2026-09-18).
//
// The owner asked for invented "it predicted this" screenshots. That would be fabricated performance evidence on a
// page that charges $159/month, and our own Terms 9.5 forbid passing simulated results off as a real record.
// This does the thing he actually wants without inventing anything: the REAL model reads a REAL chart truncated to
// a past bar - it cannot see the future because the future is not in the brief - and then the remaining candles are
// revealed. Whatever happens, happens. If the call misses, the pair is not published.
//
// Run: node replay.js  (env: SYM, CUT = how many candles to hide from the model)
const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
const fs = require('fs');
const KEY = 'mpadm_20ca118e2de368204c82ea9a97a6fca4';
const OUT = 'D:/part1/money-mission/dist/assets/plus/';
const SYM = process.env.SYM || 'BTC';
const TF = process.env.TF || '60';
const CUT = +(process.env.CUT || 40);
const TAG = process.env.TAG || SYM.toLowerCase();

withBrowser(async (browser) => {
  const page = await newPage(browser);
  await page.setViewport({ width: 1500, height: 900, deviceScaleFactor: 2 });
  await page.goto('https://marginpad.io/charts?coin=' + SYM + '&cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 70000 });
  await new Promise(s => setTimeout(s, 16000));

  // 1. Build the brief from the candles that existed AT THE CUT. The model sees nothing after it.
  const built = await page.evaluate((cut) => {
    const w = window.__mpWinsDbg && window.__mpWinsDbg[0];
    if (!w || !window.__mpAiContext) return { err: 'chart not ready' };
    const full = w.bars || [];
    if (full.length < cut + 120) return { err: 'not enough candles: ' + full.length };
    const past = full.slice(0, full.length - cut);
    // the real builder, over a window object carrying ONLY the past candles
    const ctx = window.__mpAiContext({ sym: w.sym, tf: w.tf, bars: past, inds: w.inds || {}, dr: null, emaList: w.emaList, smaList: w.smaList, chart: null, mtOn: false });
    return {
      ok: true, ctx, fullLen: full.length, pastLen: past.length,
      priceAtCut: +past[past.length - 1].close,
      priceNow: +full[full.length - 1].close,
      highAfter: Math.max.apply(null, full.slice(past.length).map(b => +b.high)),
      lowAfter: Math.min.apply(null, full.slice(past.length).map(b => +b.low)),
    };
  }, CUT);
  if (built.err) { console.log('ERR ' + built.err); await page.close().catch(() => {}); return; }
  console.log(SYM + ' ' + TF + 'm | candles ' + built.pastLen + ' shown to the model, ' + CUT + ' hidden');
  console.log('  price at the cut ' + built.priceAtCut + '  ->  now ' + built.priceNow + '  (high after ' + built.highAfter + ', low after ' + built.lowAfter + ')');

  // 2. A real model call on that truncated brief.
  const r = await fetch('https://marginpad.io/api/ai/chart', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': KEY, 'x-mp-e2e': '1' },
    body: JSON.stringify({ context: built.ctx, question: 'Find the best setup here and draw it on the chart.', stream: false, lang: 'en' }),
  });
  const j = await r.json();
  if (!j || !j.answer) { console.log('model call failed', r.status, JSON.stringify(j).slice(0, 200)); await page.close().catch(() => {}); return; }
  // the site path returns the answer whole - the plan block is parsed client-side, so parse it here too
  let plan = j.plan || null;
  if (!plan) {
    const pm = String(j.answer).match(/```plan\s*([\s\S]*?)```/);
    if (pm) { try { plan = JSON.parse(pm[1]); } catch (e) { console.log('  plan block did not parse: ' + pm[1].slice(0, 120)); } }
    else console.log('  no plan block in the answer');
  }
  const am = String(j.answer).match(/```actions\s*([\s\S]*?)```/);
  let acts = [];
  try { acts = am ? (JSON.parse(am[1]).actions || []) : []; } catch (e) {}
  console.log('  model: bias ' + (plan && plan.bias) + ', entry ' + (plan && plan.entry) + ', stop ' + (plan && plan.stop) + ', targets ' + JSON.stringify(plan && plan.targets));

  // 3. The model counted barsAgo from ITS last candle. Shift every anchor onto the full series.
  const shifted = acts.filter(a => a && a.a === 'draw').map(a => {
    const o = Object.assign({}, a);
    for (const k of ['barsAgo', 'barsAgo1', 'barsAgo2', 'barsAgo3']) if (typeof o[k] === 'number') o[k] = o[k] + CUT;
    return o;
  });

  const drew = await page.evaluate((acts2, cut) => {
    const A = window.__mpAi, w = window.__mpWinsDbg && window.__mpWinsDbg[0];
    if (!A || !w) return { err: 'not ready' };
    try { A.clearAi && A.clearAi(w); } catch (e) {}
    try { A.draw(w, acts2, 'replay'); } catch (e) { return { err: 'draw: ' + e.message }; }
    if (w.dr && w.dr.redraw) w.dr.redraw();
    return { ok: true, shapes: w.dr.shapes.filter(s => s.by === 'ai' || s.ai).length };
  }, shifted, CUT);
  console.log('  drew ' + JSON.stringify(drew));

  const clip = await page.evaluate(() => {
    const c = document.querySelector('.cwin') || document.body; const r2 = c.getBoundingClientRect();
    return { x: Math.max(0, r2.left), y: Math.max(0, r2.top), width: Math.min(r2.width, innerWidth - r2.left), height: Math.min(r2.height, innerHeight - r2.top) };
  });

  // 4. BEFORE: the right edge sits at the cut, so only what the model saw is on screen.
  await page.evaluate((cut) => {
    const w = window.__mpWinsDbg && window.__mpWinsDbg[0];
    const n = w.bars.length;
    w.chart.timeScale().setVisibleLogicalRange({ from: n - cut - 110, to: n - cut + 4 });
    if (w.dr && w.dr.redraw) w.dr.redraw();
  }, CUT);
  await new Promise(s => setTimeout(s, 2200));
  await page.screenshot({ path: OUT + 'replay-' + TAG + '-before.jpg', clip, type: 'jpeg', quality: 88 });

  // 5. AFTER: reveal the candles the model never saw.
  await page.evaluate((cut) => {
    const w = window.__mpWinsDbg && window.__mpWinsDbg[0];
    const n = w.bars.length;
    w.chart.timeScale().setVisibleLogicalRange({ from: n - cut - 110, to: n + 6 });
    if (w.dr && w.dr.redraw) w.dr.redraw();
  }, CUT);
  await new Promise(s => setTimeout(s, 2200));
  await page.screenshot({ path: OUT + 'replay-' + TAG + '-after.jpg', clip, type: 'jpeg', quality: 88 });

  const kb = (f) => Math.round(fs.statSync(OUT + f).size / 1024);
  console.log('  wrote replay-' + TAG + '-before.jpg (' + kb('replay-' + TAG + '-before.jpg') + ' KB) and -after.jpg (' + kb('replay-' + TAG + '-after.jpg') + ' KB)');

  // 6. Did it actually work? Report it plainly - a miss must not be published.
  if (plan && plan.entry && plan.targets && plan.targets.length) {
    const long = plan.bias === 'long';
    const t1 = +plan.targets[0];
    const hit = long ? built.highAfter >= t1 : built.lowAfter <= t1;
    const stopHit = long ? built.lowAfter <= +plan.stop : built.highAfter >= +plan.stop;
    console.log('  VERDICT: first target ' + t1 + ' ' + (hit ? 'REACHED' : 'not reached') + '; stop ' + plan.stop + ' ' + (stopHit ? 'HIT' : 'not hit'));
    console.log('  -> ' + (hit && !stopHit ? 'publishable' : 'DO NOT PUBLISH'));
  } else console.log('  VERDICT: a wait plan - nothing to verify');
  await page.close().catch(() => {});
}, { timeoutMs: 235000 }).catch(e => { console.error('fatal', e.message); process.exitCode = 1; });
