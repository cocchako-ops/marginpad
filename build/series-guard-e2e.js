#!/usr/bin/env node
/* A NULL POINT NEVER REACHES LIGHTWEIGHT-CHARTS - E2E (2026-10-24). See build/fix-series-guard.js.
   Two halves. PURE: mpPtBad is lifted out of the SHIPPED bundle and driven through every shape that reaches a
   series - a real bar, a real line point, a gap (`{time}` alone, which lightweight-charts draws as a hole and which
   this guard must NOT touch), and the poison: value null, value NaN, a null close, a null time.
   BROWSER: on a real /paper-trade, a chart built through the page's own mpCreateChart is fed a null value; the page
   must still be alive a second later (the library throws from its own render loop, not from the call) and the site
   must be named once through the crash beacon. Then the FALSIFICATION, which is the half that matters: the same
   poison into an UNGUARDED chart built straight from LightweightCharts.createChart must produce the very error the
   owner's crash list is full of - "Value is null" - proving the guard addresses that crash and not a theory. */
'use strict';
const fs = require('fs'), path = require('path');
const { withBrowser } = require(path.join(__dirname, 'e2e-browser.js'));
const O = process.env.MP_ORIGIN || 'https://marginpad.io';
const LOCAL = process.argv.indexOf('--local') >= 0;
const PURE = process.argv.indexOf('--pure') >= 0;
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 220) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', 'home.js'), 'utf8');

// the predicate, lifted from the bundle that ships
function liftPtBad() {
  const i = SRC.indexOf('function mpPtBad(');
  if (i < 0) throw new Error('mpPtBad not found in home.js - the guard is not in the shipped bundle');
  const j = SRC.indexOf('\nfunction mpGuardSeries(', i);
  if (j < 0) throw new Error('could not find the end of mpPtBad');
  return new Function(SRC.slice(i, j) + '; return mpPtBad;')();
}

(async () => {
  console.log('# the predicate, out of the shipped bundle');
  const bad = liftPtBad();
  const T = 1792700000;
  ok(bad({ time: T, open: 1, high: 2, low: 0.5, close: 1.5 }) === '', 'a real candle passes');
  ok(bad({ time: T, value: 42 }) === '', 'a real line point passes');
  ok(bad({ time: T, value: 0 }) === '', 'zero is a value, not a hole');
  ok(bad({ time: T, value: -3.5 }) === '', 'a negative value passes (an oscillator goes below zero)');
  ok(bad({ time: '2026-10-24' }) === '', 'a gap - time alone - is left alone, it is how a hole is drawn');
  ok(bad({ time: { year: 2026, month: 10, day: 24 } }) === '', 'a business-day time passes');
  ok(bad({ time: T, value: null }) === 'value=null', 'THE CRASH: value null is caught', bad({ time: T, value: null }));
  ok(bad({ time: T, value: NaN }) === 'value=NaN', 'value NaN is caught');
  ok(bad({ time: T, value: Infinity }) === 'value=Inf', 'value Infinity is caught');
  ok(bad({ time: T, open: 1, high: 2, low: 1, close: null }) === 'close=null', 'a null close is caught');
  ok(bad({ time: T, open: 1, high: 2, low: 1, close: NaN }) === 'close=NaN', 'a NaN close is caught');
  ok(bad({ time: null, value: 1 }) === 'time', 'a null time is caught');
  ok(bad({ time: NaN, value: 1 }) === 'time', 'a NaN time is caught');
  ok(bad(null) === 'point', 'a null point is caught');
  ok(bad({ time: T, value: undefined }) === '', 'an undefined value is whitespace to the library, so it is left alone');
  if (PURE) { console.log('\n' + pass + ' passed, ' + fail + ' failed (pure)'); process.exitCode = fail ? 1 : 0; return; }

  /* THE POISON IS A CANDLE WITH A NULL CLOSE, MEASURED (scratchpad/lwc-null-probe.js, 2026-10-24): of fifteen
     candidates driven on a real page, only three produce "Value is null" - a candle update with a null close, a
     candle setData with one, and setVisibleRange on an empty chart (which this codebase never calls). Both candle
     paths throw from the library's RENDER LOOP, not from the call, which is why the crash carries no frame of ours.
     A line point with a null value is accepted and harmless - the first draft of this test poisoned one and proved
     nothing. setData matters as much as update: the 10-22 guard covered the update sites only. */
  const POISON = `(function(){
    var host=document.createElement('div');host.style.cssText='position:fixed;left:-9999px;top:0;width:300px;height:200px';document.body.appendChild(host);
    var c=%FACTORY%;var s=c.addCandlestickSeries({});
    s.setData([{time:1792700000,open:1,high:2,low:1,close:1.5},{time:1792700060,open:1,high:2,low:1,close:1.2}]);
    s.update({time:1792700120,open:1,high:2,low:1,close:null});
    return true;})()`;
  const POISON_SET = POISON.replace('s.update({time:1792700120,open:1,high:2,low:1,close:null});', 's.setData([{time:1792700180,open:1,high:2,low:1,close:null}]);');

  await withBrowser(async (b) => {
    const page = async () => {
      const p = await b.newPage();
      await p.setViewport({ width: 1366, height: 768 });
      await p.setCacheEnabled(false);
      await p.setRequestInterception(true);
      const beacons = [];
      p.on('request', req => {
        const u = req.url();
        if (/\/api\/track\?/.test(u)) { beacons.push(decodeURIComponent((u.match(/[?&]e=([^&]*)/) || [, ''])[1])); return req.respond({ status: 204, body: '' }); }
        if (LOCAL && /\/assets\/(home|mp-charts|mp-mcharts)\.js/.test(u)) { const f = (u.match(/\/assets\/([a-z-]+)\.js/) || [])[1]; return req.respond({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(__dirname, '..', 'dist', 'assets', f + '.js'), 'utf8') }); }
        req.continue();
      });
      const cdp = await p.target().createCDPSession(); await cdp.send('Network.setBypassServiceWorker', { bypass: true });
      const errs = []; p.on('pageerror', e => errs.push(String(e.message || e)));
      await p.goto(O + '/paper-trade?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 90000 });
      await p.waitForFunction("window.LightweightCharts && typeof mpCreateChart === 'function'", { timeout: 40000 });
      return { p, errs, beacons };
    };

    console.log('# a poisoned point into a GUARDED chart');
    const g = await page();
    ok(await g.p.evaluate(POISON.replace('%FACTORY%', 'mpCreateChart(host,{autoSize:true})')), 'the guarded chart took the poisoned update');
    await sleep(1200); // the library throws from its own render loop, not from the call - a frame has to pass
    ok(g.errs.filter(e => /Value is null/i.test(e)).length === 0, 'no "Value is null" after a second of frames', g.errs);
    const rep = g.beacons.filter(x => /^bad pt /.test(x));
    ok(rep.length === 1 && /candlestick/.test(rep[0]) && /close=null/.test(rep[0]) && /home:\d+/.test(rep[0]), 'the drop is reported ONCE, naming the series kind, the field and OUR frame', rep);
    ok(await g.p.evaluate('!!window.__mpBadPt'), 'the once-per-session mark is set');
    // setData is the half the 2026-10-22 guard never covered
    ok(await g.p.evaluate(POISON_SET.replace('%FACTORY%', 'mpCreateChart(host,{autoSize:true})')), 'the guarded chart took a poisoned setData');
    await sleep(1200);
    ok(g.errs.filter(e => /Value is null/i.test(e)).length === 0, 'setData is guarded too - still no crash', g.errs);
    await g.p.close();

    console.log('# FALSIFICATION: the same poison into an UNGUARDED chart');
    const u = await page();
    await u.p.evaluate(POISON.replace('%FACTORY%', 'LightweightCharts.createChart(host,{autoSize:true})'));
    await sleep(1200);
    ok(u.errs.filter(e => /Value is null/i.test(e)).length > 0, 'without the guard an update throws "Value is null" - the crash on the owner\'s list', u.errs.slice(0, 3));
    const u2 = await page();
    await u2.p.evaluate(POISON_SET.replace('%FACTORY%', 'LightweightCharts.createChart(host,{autoSize:true})'));
    await sleep(1200);
    ok(u2.errs.filter(e => /Value is null/i.test(e)).length > 0, 'and so does a setData with one bad bar', u2.errs.slice(0, 3));
    await u.p.close(); await u2.p.close();
  });
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
