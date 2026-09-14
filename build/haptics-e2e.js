// Haptics E2E (2026-09-14) — owner: "samo za neke bitne klikove a ne za sve moguce ... Pored klikova moze i leverage slajder".
//
// navigator.vibrate cannot be observed from outside the page, so every check here replaces it with a counter and then
// drives the REAL controls. What has to hold:
//   · the helper exists on a page that does NOT load home.js (it used to live there, so every caller elsewhere was dead)
//   · the leverage slider ticks once per STEP of the ladder, never once per pixel of the drag
//   · a position opening buzzes exactly once
//   · localStorage mp_haptics=0 silences everything
//   · on a device with no vibrator nothing throws, nothing is scheduled
//
//   node build/haptics-e2e.js
const { withBrowser, newPage } = require('./e2e-browser.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

// counts every navigator.vibrate the page makes, and records the patterns
const SPY = () => {
  Object.defineProperty(navigator, 'vibrate', {
    configurable: true, writable: true,
    value: function (p) { window.__v = window.__v || []; window.__v.push(p); return true; }
  });
  window.__v = [];
};

(async () => {
  await withBrowser(async b => {

    // ── 1. the helper is on every page, not just the app shell ───────────────────────────────────────────────────
    console.log('\nevery page (the bundle that is not home.js)');
    for (const path of ['/season/', '/rekt/', '/vault/']) {
      const p = await newPage(b);
      await p.evaluateOnNewDocument(SPY);
      await p.goto('https://marginpad.io' + path + '?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      await sleep(2600);
      const r = await p.evaluate(() => ({
        haptic: typeof window.mpHaptic === 'function',
        buzz: typeof window.mpBuzz === 'function',
        home: !!document.querySelector('script[src*="home.js"]')
      }));
      ok(r.haptic && r.buzz, path + ' has mpHaptic + mpBuzz' + (r.home ? '' : ' (and no home.js)'));
      await p.close();
    }

    // ── 2. the terminal: slider, ladder, open ────────────────────────────────────────────────────────────────────
    console.log('\npaper trade');
    const p = await newPage(b);
    await p.setViewport({ width: 1366, height: 940 });
    const errs = [];
    p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
    await p.evaluateOnNewDocument(SPY);
    await p.goto('https://marginpad.io/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 70000 });
    await sleep(3200);

    // a real click first: Chrome refuses to vibrate before the page has been interacted with, and the helper
    // checks navigator.userActivation for exactly that reason
    await p.click('#planLev').catch(() => {});
    await sleep(150);

    const ua = await p.evaluate(() => !navigator.userActivation || navigator.userActivation.hasBeenActive);
    ok(ua, 'the page counts as interacted with (the activation gate is open)');

    // the slider — drag it across the ladder at a human pace and count ticks against value changes
    const drag = await p.evaluate(async () => {
      const r = document.getElementById('planLevR'), n = document.getElementById('planLev');
      if (!r || !n) return { err: 'no slider' };
      window.__v = [];
      const seen = [];
      let steps = 0, prev = n.value;
      for (let v = 500; v <= 700; v += 10) {           // 21 input events across the ladder
        r.value = String(v);
        r.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(x => setTimeout(x, 60));      // a finger moves slower than a loop
        if (n.value !== prev) { steps++; prev = n.value; seen.push(n.value); }
      }
      return { steps, ticks: window.__v.length, pattern: window.__v[0], lev: n.value, seen: seen.slice(0, 4) };
    });
    ok(!drag.err, 'the leverage slider is on the page');
    ok(drag.ticks > 0, 'dragging the slider buzzes (' + drag.ticks + ' ticks over ' + drag.steps + ' ladder steps, ' + (drag.seen || []).join('/') + '...)');
    ok(drag.ticks <= drag.steps, 'never more ticks than steps — the drag itself does not buzz');
    ok(drag.pattern === 7, 'the slider uses the short step pattern (' + JSON.stringify(drag.pattern) + ')');

    // a value that is not on the ladder: 107 commits as 110, and that snap is confirmed
    const snap = await p.evaluate(async () => {
      const n = document.getElementById('planLev');
      n.value = '107';
      n.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 120));
      window.__v = [];
      n.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 120));
      return { lev: n.value, ticks: window.__v.length };
    });
    ok(snap.lev === '110', '107 commits as 110 (the ladder)');
    ok(snap.ticks === 1, 'the snap to the ladder buzzes once');

    // a value already on the ladder must NOT buzz — nothing changed
    const nosnap = await p.evaluate(async () => {
      const n = document.getElementById('planLev');
      n.value = '110'; n.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(x => setTimeout(x, 120));
      window.__v = [];
      n.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(x => setTimeout(x, 150));
      return window.__v.length;
    });
    ok(nosnap === 0, 'a value already on the ladder is silent');

    // opening a position: exactly one confirmation
    const open = await p.evaluate(async () => {
      const n = document.getElementById('planLev'), a = document.getElementById('planAmt');
      if (a) { a.value = '50'; a.dispatchEvent(new Event('input', { bubbles: true })); }
      if (n) { n.value = '10'; n.dispatchEvent(new Event('input', { bubbles: true })); }
      await new Promise(x => setTimeout(x, 400));
      const before = (JSON.parse(localStorage.getItem('mp_journal') || '[]')).length;
      window.__v = [];
      const btn = document.getElementById('planSave'); if (!btn) return { err: 'no open button' };
      btn.click();
      await new Promise(x => setTimeout(x, 3000));
      const after = (JSON.parse(localStorage.getItem('mp_journal') || '[]')).length;
      return { before, after, ticks: window.__v.length, pattern: window.__v[0] };
    });
    ok(!open.err && open.after > open.before, 'a position opened (' + open.before + ' -> ' + open.after + ')');
    ok(open.ticks === 1, 'opening a position buzzes exactly once (' + open.ticks + ')');
    ok(Array.isArray(open.pattern) && open.pattern.length === 3, 'the open uses the three-part confirmation pattern ' + JSON.stringify(open.pattern));

    ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await p.close();

    // ── 3. the opt-out, and a device with no vibrator ────────────────────────────────────────────────────────────
    console.log('\nopting out, and a device that cannot buzz');
    const p2 = await newPage(b);
    await p2.evaluateOnNewDocument(() => {
      try { localStorage.setItem('mp_haptics', '0'); } catch (e) {}
      Object.defineProperty(navigator, 'vibrate', {
        configurable: true, writable: true,
        value: function (x) { window.__v = window.__v || []; window.__v.push(x); return true; }
      });
      window.__v = [];
    });
    await p2.goto('https://marginpad.io/season/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2400);
    await p2.click('body').catch(() => {});
    const offr = await p2.evaluate(() => {
      const r = [window.mpHaptic('ok'), window.mpHaptic('tick'), window.mpBuzz([20])];
      return { returned: r, calls: window.__v.length };
    });
    ok(offr.calls === 0 && offr.returned.every(x => x === false), 'mp_haptics=0 silences every kind and every entry point');
    await p2.close();

    const p3 = await newPage(b);
    await p3.evaluateOnNewDocument(() => {
      // a desktop or an iPhone: the API simply is not there
      try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined }); } catch (e) {}
    });
    const e3 = [];
    p3.on('pageerror', e => e3.push(String(e.message).slice(0, 120)));
    await p3.goto('https://marginpad.io/season/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(2400);
    await p3.click('body').catch(() => {});
    const nov = await p3.evaluate(() => {
      const before = performance.now();
      for (let i = 0; i < 2000; i++) window.mpHaptic('tick');
      return { ms: performance.now() - before, ret: window.mpHaptic('ok') };
    });
    ok(nov.ret === false && e3.length === 0, 'no vibrator: returns false, throws nothing');
    ok(nov.ms < 60, '2,000 calls with no vibrator cost ' + nov.ms.toFixed(1) + ' ms — nothing is scheduled or loaded');
    await p3.close();
  });

  console.log('\nhaptics-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
