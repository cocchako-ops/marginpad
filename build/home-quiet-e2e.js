// The homepage has to sit still (2026-09-15) - owner: "sajt prolazi kroz neki twitching ili kao mini
// refresh", guessed to be the DM going live.
//
// The DM was innocent. Three other things were measured doing it, and the biggest one was a regression
// from the day before. What this suite exists to stop coming back:
//
//   * a marquee whose content is replaced MID-SCROLL. Both strips translate to -50% of their OWN width
//     with the content duplicated, so any text change moves the loop point and the strip snaps - jumps
//     of 64px, 149px and 281px were measured. The content waits for `animationiteration` now.
//   * an animation driven by a TIMER instead of the compositor: the aurora drift was writing style 25
//     times a second onto three 46vw blobs under filter:blur(100px). 1,745 writes in 70 seconds.
//   * an element that redraws itself unconditionally on a catch-up loop (#lgGate, 7 times a load).
//
//   node build/home-quiet-e2e.js
const { withBrowser, newPage } = require('./e2e-browser.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  ' + JSON.stringify(x).slice(0, 260) : '')); } };

const WATCH = 60;   // long enough for the price poll, the liquidation poll and a marquee wrap

(async () => {
  await withBrowser(async b => {
    const p = await newPage(b);
    await p.setViewport({ width: 1440, height: 900 });
    const errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    await p.evaluateOnNewDocument(() => {
      window.__q = { style: 0, gate: 0, shifts: [] };
      const start = () => {
        try {
          new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__q.shifts.push(+e.value.toFixed(4)); })
            .observe({ type: 'layout-shift', buffered: true });
        } catch (e) {}
        new MutationObserver(recs => {
          for (const r of recs) {
            const t = r.target;
            if (r.type === 'attributes' && t && t.closest && t.closest('.bgfx')) window.__q.style++;
            if (t && t.id === 'lgGate' && r.type === 'childList') window.__q.gate++;
          }
        }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
      };
      if (document.documentElement) start();
      else document.addEventListener('readystatechange', function f() { if (document.documentElement) { document.removeEventListener('readystatechange', f); start(); } });
    });
    await p.goto('https://marginpad.io/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 70000 });
    await sleep(4000);

    // the catch-up loop runs for 14s from load, so read the gate count before resetting
    const gateEarly = await p.evaluate(() => window.__q.gate);
    ok(gateEarly <= 2, 'the league gate redraws at most twice while sign-in resolves (' + gateEarly + ')', gateEarly);

    await p.evaluate(() => { window.__q.style = 0; window.__q.gate = 0; window.__q.shifts = []; });
    console.log('\nwatching the homepage sit still for ' + WATCH + 's…');

    const r = await p.evaluate(async (secs) => {
      const rec = { tape: [], liq: [] };
      const t0 = performance.now();
      await new Promise(res => {
        const tick = () => {
          for (const [sel, n] of [['#tape', 'tape'], ['#mpqT', 'liq']]) {
            const el = document.querySelector(sel); if (!el) continue;
            const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
            rec[n].push([Math.round(performance.now() - t0), Math.round(m.m41), el.scrollWidth]);
          }
          if (performance.now() - t0 < secs * 1000) requestAnimationFrame(tick); else res();
        };
        requestAnimationFrame(tick);
      });
      const out = { style: window.__q.style, gate: window.__q.gate, cls: window.__q.shifts.reduce((a, x) => a + x, 0) };
      for (const n of Object.keys(rec)) {
        const a = rec[n], jumps = [];
        for (let i = 1; i < a.length; i++) {
          const d = a[i][1] - a[i - 1][1];
          if (Math.abs(d) <= 25) continue;
          // the wrap itself is not a jump: the content is duplicated, so -half and 0 look identical
          const half = Math.round(a[i - 1][2] / 2);
          const seam = Math.abs(Math.abs(a[i - 1][1]) - half) < 30 && Math.abs(a[i][1]) < 30;
          if (!seam) jumps.push({ at: Math.round(a[i][0] / 1000), from: a[i - 1][1], to: a[i][1], half });
        }
        out[n] = { frames: a.length, jumps, widths: [...new Set(a.map(x => x[2]))].length, moved: a.length > 2 && a[0][1] !== a[a.length - 1][1] };
      }
      return out;
    }, WATCH);

    ok(r.tape.moved, 'the price tape is actually scrolling');
    ok(r.liq.moved, 'the liquidation strip is actually scrolling');
    ok(r.tape.jumps.length === 0, 'the price tape never snaps mid-scroll', r.tape.jumps.slice(0, 3));
    ok(r.liq.jumps.length === 0, 'the liquidation strip never snaps mid-scroll', r.liq.jumps.slice(0, 3));
    // the point of the fix: the width DOES change, and it still does not jump
    ok(r.liq.widths > 1 || r.tape.widths > 1, 'content really changed during the watch (' + r.tape.widths + ' / ' + r.liq.widths + ' widths seen)');
    ok(r.style === 0, 'nothing writes style onto the background - the drift is on the compositor (' + r.style + ' writes in ' + WATCH + 's)', r.style);
    ok(r.gate === 0, 'the league gate does not redraw while nothing changes (' + r.gate + ')', r.gate);
    ok(r.cls < 0.02, 'no layout shift while the page is idle (CLS ' + r.cls.toFixed(4) + ')', r.cls);
    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));

    // and the background must still be moving, on a machine with animation effects off
    const p2 = await newPage(b);
    await p2.setViewport({ width: 1440, height: 900 });
    await p2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await p2.goto('https://marginpad.io/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 70000 });
    await sleep(2000);
    const a1 = await p2.evaluate(() => getComputedStyle(document.querySelector('.au1')).transform);
    await sleep(2600);
    const a2 = await p2.evaluate(() => getComputedStyle(document.querySelector('.au1')).transform);
    ok(a1 !== a2, 'the aurora still drifts with animation effects off', { a1, a2 });
    await p2.close();
    await p.close();
  });

  console.log('\nhome-quiet-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
