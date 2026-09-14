/* Two Paper-Trade terminal controls (owner 2026-09-13, second pass):
   1. the leverage slider offers ROUND numbers only - whole steps to 10x, then tens (never 107 or 203);
   2. an entry-style chooser in its OWN control beside the timeframe pill: entries as price LINES, or as a DOT pinned
      to the exact entry price. The first cut used series markers, which are anchored to a BAR and floated up and down
      with it - "cela poenta je da prikaže tačno gde je bio ulaz". A dot is now a one-point series, so the chart itself
      pins it to (time, price) and it cannot drift.                              node build/entry-marks-e2e.js       */
'use strict';
const { withBrowser, newPage } = require('./e2e-browser.js');
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const now = Date.now();
// Positions priced off the LIVE market: one seeded far from spot is liquidated before it can ever be drawn.
async function seed() {
  let px = 0;
  try { const r = await fetch(O + '/api/price?symbol=BTC'); const j = await r.json(); px = +(j.price || j.p || 0); } catch (e) {}
  if (!(px > 0)) px = 60000;
  const lo = +(px * 0.9985).toFixed(2), hi = +(px * 1.0015).toFixed(2);
  return [
    { id: String(now - 3600000) + '_1', sym: 'BTC', side: 'long', lev: 5, margin: 100, qty: 100 * 5 / lo, entry: lo, ts: now - 3600000, status: 'open', src: 'client' },
    { id: String(now - 1200000) + '_2', sym: 'BTC', side: 'short', lev: 5, margin: 50, qty: 50 * 5 / hi, entry: hi, ts: now - 1200000, status: 'open', src: 'client' },
  ];
}
(async () => {
  const J = await seed();
  await withBrowser(async (browser) => {
    const p = await newPage(browser); await p.setCacheEnabled(false);
    await p.setViewport({ width: 1366, height: 900 });
    await p.evaluateOnNewDocument((j) => { try { localStorage.setItem('mp_journal', JSON.stringify(j)); localStorage.removeItem('mp_entry_mode'); } catch (e) {} }, J);
    await p.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
    await new Promise(r => setTimeout(r, 7000));

    // ---- the leverage ladder ------------------------------------------------------------------------------------
    const lev = await p.evaluate(() => {
      const el = document.getElementById('planLev'), r = document.getElementById('planLevR');
      if (!el || !r) return null;
      const seen = [];
      for (let v = 0; v <= +r.max; v += 7) { r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); const n = +el.value; if (seen[seen.length - 1] !== n) seen.push(n); }
      el.value = '107'; el.dispatchEvent(new Event('change', { bubbles: true }));
      return { seen: seen.slice(0, 22), odd: seen.filter(n => n > 10 && n % 10 !== 0), typed: +el.value };
    });
    ok(!!lev, 'the leverage controls are on the page');
    ok(lev && lev.odd.length === 0, 'no value above 10x is off the tens ladder (' + (lev ? lev.odd.slice(0, 6).join(', ') || 'none' : '?') + ')');
    ok(lev && lev.seen.filter(n => n <= 10).length >= 3, 'below 10x every whole step is still reachable (' + (lev ? lev.seen.filter(n => n <= 10).join(', ') : '') + ')');
    ok(lev && (lev.typed === 110 || lev.typed === 100), 'typing 107 commits to a round number (' + (lev ? lev.typed : '?') + ')');

    // ---- the entry-style control --------------------------------------------------------------------------------
    const ctl = await p.evaluate(() => {
      const w = document.querySelector('.ptt-es'); if (!w) return null;
      w.scrollIntoView({ block: 'center' });
      const bs = [...w.querySelectorAll('button[data-es]')];
      const r = w.getBoundingClientRect(), tf = document.getElementById('ptTfBtn'), tr = tf ? tf.getBoundingClientRect() : null;
      const first = bs[0].getBoundingClientRect();
      const hit = document.elementFromPoint(first.left + first.width / 2, first.top + first.height / 2);
      return {
        opts: bs.map(b => b.getAttribute('data-es')), on: bs.filter(b => b.classList.contains('on')).map(b => b.getAttribute('data-es')),
        w: Math.round(r.width), h: Math.round(r.height), reachable: !!(hit && bs[0].contains(hit)),
        separate: tr ? (r.left > tr.right && Math.abs(r.top - tr.top) < 22) : null,
      };
    });
    ok(!!ctl, 'the entry-style control is on the chart toolbar');
    ok(ctl && ctl.opts.join(',') === 'line,mark', 'it offers both options explicitly, not a toggle (' + (ctl ? ctl.opts.join(', ') : '') + ')');
    ok(ctl && ctl.separate, 'it is its own control, to the right of the timeframe pill');
    ok(ctl && ctl.w <= 70 && ctl.h <= 30, 'it stays small (' + (ctl ? ctl.w + 'x' + ctl.h : '?') + ')');
    ok(ctl && ctl.reachable, 'its buttons are clickable');
    ok(ctl && ctl.on.join(',') === 'line', 'it opens on lines, as before');

    // ---- switch to dots -----------------------------------------------------------------------------------------
    await p.evaluate(() => document.querySelector('.ptt-es button[data-es="mark"]').click());
    await new Promise(r => setTimeout(r, 1300));
    const dots = await p.evaluate(() => {
      const d = window.__mpPT();
      return {
        stored: (function () { try { return localStorage.getItem('mp_entry_mode'); } catch (e) { return null; } })(),
        on: [...document.querySelectorAll('.ptt-es button.on')].map(b => b.getAttribute('data-es')),
        marks: (d.marks || []).map(m => ({ price: m.price, side: m.side, color: m.color, r: m.r, text: m.text })),
      };
    });
    ok(dots.stored === 'mark' && dots.on.join(',') === 'mark', 'picking dots switches and is remembered');
    ok(dots.marks.length === 2, 'one dot per open position (' + dots.marks.length + ')');
    ok(dots.marks.every(m => m.text === undefined), 'no letter on the dot, just the dot');
    ok(dots.marks.some(m => m.side === 'buy' && /10b981/i.test(m.color)) && dots.marks.some(m => m.side === 'sell' && /ef4444/i.test(m.color)), 'green for the buy, red for the sell');
    ok(dots.marks.every(m => m.r <= 5), 'the dot is proportional to the chart, not a blob (r=' + dots.marks.map(m => m.r).join('/') + ')');

    // ---- the whole point: it marks the entry PRICE, and stays there ----------------------------------------------
    const pinned = await p.evaluate(async () => {
      const d = window.__mpPT();
      const read = () => (d.marks || []).map(m => {
        const y = d.candle.priceToCoordinate(m.price);
        return { price: m.price, y: y == null ? null : Math.round(y), back: y == null ? null : +d.candle.coordinateToPrice(y).toFixed(2) };
      });
      const before = read();
      const ts = d.chart.timeScale(), r = ts.getVisibleLogicalRange();
      ts.setVisibleLogicalRange({ from: r.from - 60, to: r.to - 20 });                        // pan and zoom
      await new Promise(x => setTimeout(x, 300));
      d.chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.02, bottom: 0.45 } }); // and move the price scale
      await new Promise(x => setTimeout(x, 600));
      return { before, after: read() };
    });
    ok(pinned.before.every((m, i) => Math.abs(pinned.after[i].back - m.price) < Math.max(0.5, m.price * 0.00002)),
      'after a pan, a zoom and a price-scale change each dot still resolves to its entry price (' + pinned.after.map(m => m.back).join(', ') + ')');
    ok(pinned.before.some((m, i) => pinned.after[i].y !== m.y), 'and the view really did move, so that is not a no-op');

    // ---- back to lines ------------------------------------------------------------------------------------------
    await p.evaluate(() => document.querySelector('.ptt-es button[data-es="line"]').click());
    await new Promise(r => setTimeout(r, 900));
    const back = await p.evaluate(() => {
      const d = window.__mpPT();
      return { on: [...document.querySelectorAll('.ptt-es button.on')].map(b => b.getAttribute('data-es')), marks: (d.marks || []).length };
    });
    ok(back.on.join(',') === 'line' && back.marks === 0, 'choosing lines removes the dots and restores the entry lines');
  });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
