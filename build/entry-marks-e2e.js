/* Two Paper-Trade terminal changes (owner 2026-09-13):
   1. the leverage slider offers ROUND numbers only — whole steps to 10x, then tens (never 107 or 203);
   2. an entry-style toggle by the timeframe button: the entry price LINE, or a small green B / red S circle on the
      candle the position opened in. The circles must be ANCHORED to the bars, so panning the chart must not move them
      relative to the candles.                                                   node build/entry-marks-e2e.js       */
'use strict';
const { withBrowser, newPage } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const now = Date.now();
// Two OPEN positions on BTC, one long one short, opened far enough apart to land on different bars. They are priced
// off the LIVE market: a position seeded miles from spot is liquidated the instant the terminal prices it, and the
// mark it should have drawn never exists (that is what made the first run of this test report one mark instead of two).
async function seed() {
  let px = 0;
  try { const r = await fetch(O + '/api/price?symbol=BTC'); const j = await r.json(); px = +(j.price || j.p || 0); } catch (e) {}
  if (!(px > 0)) px = 60000;
  const lo = +(px * 0.985).toFixed(2), hi = +(px * 1.015).toFixed(2);   // long below spot, short above it: both in profit, neither near liquidation
  return [
    { id: String(now - 5400000) + '_1', sym: 'BTC', side: 'long', lev: 5, margin: 100, qty: 100 * 5 / lo, entry: lo, ts: now - 5400000, status: 'open', src: 'client' },
    { id: String(now - 1800000) + '_2', sym: 'BTC', side: 'short', lev: 5, margin: 50, qty: 50 * 5 / hi, entry: hi, ts: now - 1800000, status: 'open', src: 'client' },
  ];
}
(async () => {
  const J = await seed();
  await withBrowser(async (browser) => {
    const p = await newPage(browser); await p.setCacheEnabled(false);
    await p.setViewport({ width: 1366, height: 900 });
    await p.evaluateOnNewDocument((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.removeItem('mp_entry_mode'); } catch (e) {} }, J);
    await p.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(r => setTimeout(r, 6000));

    // ---- the leverage ladder ----------------------------------------------------------------------------------
    const lev = await p.evaluate(() => {
      const el = document.getElementById('planLev'), r = document.getElementById('planLevR');
      if (!el || !r) return null;
      const seen = [];
      for (let v = 0; v <= +r.max; v += 7) { r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); const n = +el.value; if (seen[seen.length - 1] !== n) seen.push(n); }
      const odd = seen.filter(n => n > 10 && n % 10 !== 0);
      // and a typed value commits to the same ladder
      el.value = '107'; el.dispatchEvent(new Event('change', { bubbles: true }));
      const typed = +el.value;
      return { seen: seen.slice(0, 22), odd, typed, max: +r.max };
    });
    ok(!!lev, 'the leverage controls are on the page');
    ok(lev && lev.odd.length === 0, 'no value above 10x is off the tens ladder (' + (lev ? lev.odd.slice(0, 6).join(', ') || 'none' : '?') + ')');
    ok(lev && lev.seen.filter(n => n <= 10).length >= 3, 'below 10x every whole step is still reachable (' + (lev ? lev.seen.filter(n => n <= 10).join(', ') : '') + ')');
    ok(lev && (lev.typed === 110 || lev.typed === 100), 'typing 107 commits to a round number (' + (lev ? lev.typed : '?') + ')');

    // ---- the entry-style toggle --------------------------------------------------------------------------------
    const btn = await p.evaluate(() => {
      const b = document.getElementById('ptEntryMode'); if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); // the glyph inside the button is the hit target, which still counts
      const tf = document.getElementById('ptTfBtn');
      const tr = tf ? tf.getBoundingClientRect() : null;
      return { w: Math.round(r.width), h: Math.round(r.height), reachable: !!(hit && b.contains(hit)), pressed: b.getAttribute('aria-pressed'), besideTf: tr ? Math.abs(r.top - tr.top) < 20 && r.left > tr.left : null };
    });
    ok(!!btn && btn.reachable, 'the toggle is on the chart toolbar and clickable');
    ok(btn && btn.w <= 34 && btn.h <= 30, 'it takes one button of space (' + (btn ? btn.w + 'x' + btn.h : '?') + ')');
    ok(btn && btn.besideTf, 'it sits beside the timeframe button, on the same row');
    ok(btn && btn.pressed === 'false', 'it starts off: entries are lines, as before');

    
    // switch to marks
    await p.evaluate(() => document.getElementById('ptEntryMode').click());
    await new Promise(r => setTimeout(r, 1200));
    const marks = await p.evaluate(() => {
      const b = document.getElementById('ptEntryMode');
      const s = document.querySelector('#ptChart');
      return { pressed: b.getAttribute('aria-pressed'), stored: (function () { try { return localStorage.getItem('mp_entry_mode'); } catch (e) { return null; } })(), canvas: !!s };
    });
    ok(marks.pressed === 'true' && marks.stored === 'mark', 'tapping it switches to marks and remembers the choice');

    // the markers are drawn by the chart library onto the candle canvas: prove they exist and are anchored by
    // reading the series markers back off the chart object the page exposes for debugging
    const anchored = await p.evaluate(async () => {
      const dbg = window.__mpPT && window.__mpPT();
      if (!dbg || !dbg.candle) return { no: true };
      const before = (dbg.marks || []).map(m => ({ t: m.time, text: m.text, pos: m.position, color: m.color }));
      // pan the chart hard, then read them again: a marker is bound to a bar time, so the times must not change
      try { const r = dbg.chart.timeScale().getVisibleLogicalRange(); dbg.chart.timeScale().setVisibleLogicalRange({ from: r.from - 40, to: r.to - 40 }); } catch (e) {}
      await new Promise(r => setTimeout(r, 500));
      const d2 = window.__mpPT(); const after = (d2.marks || []).map(m => ({ t: m.time, text: m.text, pos: m.position, color: m.color }));
      return { before, after };
    });
    if (anchored.no) { ok(false, 'the chart debug hook is available'); }
    else {
      ok(anchored.before.length === 2, 'one mark per open position (' + anchored.before.length + ')');
      ok(anchored.before.some(m => m.text === 'B' && /10b981/i.test(m.color || '')) && anchored.before.some(m => m.text === 'S' && /ef4444/i.test(m.color || '')), 'a green B for the long and a red S for the short');
      ok(anchored.before.every(m => Number.isFinite(m.t)), 'each mark carries a bar time, not a pixel');
      ok(JSON.stringify(anchored.before) === JSON.stringify(anchored.after), 'panning the chart does not move them: same bar times after a 40-bar scroll');
    }

    // and back to lines
    await p.evaluate(() => document.getElementById('ptEntryMode').click());
    await new Promise(r => setTimeout(r, 900));
    const back = await p.evaluate(() => {
      const dbg = window.__mpPT && window.__mpPT();
      return { pressed: document.getElementById('ptEntryMode').getAttribute('aria-pressed'), marks: dbg ? (dbg.marks || []).length : -1 };
    });
    ok(back.pressed === 'false' && back.marks === 0, 'switching back removes the marks and restores the lines');
  });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
