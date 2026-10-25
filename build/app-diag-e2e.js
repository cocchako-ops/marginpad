/* THE TEST I SHOULD HAVE HAD BEFORE SHIPPING THE FIRST ONE (2026-10-25).
 *
 * An in-page instrument has one failure mode that matters more than whether it measures anything: it can take
 * the main thread with it. v1 of the app diagnostic did exactly that - a DOM write inside a MutationObserver
 * callback, which re-queues the callback as a microtask, and microtasks are drained to exhaustion before the
 * next task or paint. The owner's app froze on opening Demo Spot and on tapping the exchange picker.
 *
 * So the load-bearing check here is not "did a row arrive". It is: AFTER the instrument has run, and after the
 * very gesture that triggered it, can the page still answer a question inside a bound? Every evaluate is raced
 * against a timeout, because a frozen page does not fail - it never replies, and an unraced await simply hangs
 * the suite (which is how the first version's evidence got written off as a flaky probe three times).
 *
 * `--falsify` puts the v1 shape back and must turn the liveness checks red.
 */
'use strict';
const fs = require('fs');
const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
const O = 'https://marginpad.io';

let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (extra ? '   ' + extra : '')); } };

// a question a healthy page answers in milliseconds; a frozen one never answers at all
async function answers(p, ms) {
  const t0 = Date.now();
  try {
    const v = await Promise.race([
      p.evaluate(() => 1 + 1),
      new Promise((_, rej) => setTimeout(() => rej(new Error('no answer')), ms)),
    ]);
    return { alive: v === 2, ms: Date.now() - t0 };
  } catch (e) { return { alive: false, ms: Date.now() - t0 }; }
}

const V1 = `(function(){var s={};function ins(){var d=document.createElement('div');d.style.cssText='position:fixed;left:-9999px;height:env(safe-area-inset-bottom,0px)';document.body.appendChild(d);var h=d.getBoundingClientRect().height;d.remove();return h;}
function go(){var t=document.querySelector('body');if(!t)return;var l='x'+ins();if(s.a)return;s.a=1;}
var mo=new MutationObserver(function(){try{go();}catch(e){}});mo.observe(document.documentElement,{subtree:true,attributes:true,childList:true});})();`;

(async () => {
  console.log('\n-- the shipped block carries no feedback path');
  const src = fs.readFileSync('dist/assets/mp-auth.js', 'utf8');
  /* START AT THE COMMENT'S OWN `/*`, NOT AT THE MARKER INSIDE IT. Slicing from the marker cuts the header's
     opening delimiter off, so the comment stripper below never recognises the header as a comment and the ban
     then reads the sentence that EXPLAINS the bug as the bug. */
  const mk = src.indexOf('APP DIAGNOSTIC (2026-10-25');
  const i = mk < 0 ? -1 : src.lastIndexOf('/*', mk);
  const blk = i < 0 ? '' : src.slice(i, src.length);
  ok(i >= 0, 'the diagnostic block is in the bundle');
  if (i >= 0) {
    /* COMMENTS ARE STRIPPED BEFORE THE BAN. The block's own header NAMES the thing it must not contain -
       "it mutated the DOM inside a MutationObserver callback" - so the first run of this check flagged the
       sentence explaining the bug as the bug. Same trap sectf-e2e's ban hit; the rule is to judge executable
       code, never the prose beside it. */
    const code = blk.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    ok(!/MutationObserver/.test(code), 'it registers NO MutationObserver - that is the whole v1 bug', 'found one');
    const writes = (blk.match(/appendChild|insertBefore|\.innerHTML\s*=/g) || []).length;
    ok(writes <= 1, 'it writes to the DOM at most once (the inset probe)', writes + ' write sites');
    ok(/var INS=-1;/.test(blk) && /INS=Math\.round/.test(blk), 'the inset is measured once into a cached value');
    ok(/if\(sent\.dock\|\|dead\)return;/.test(blk) && /if\(sent\.csel\|\|dead\)return;/.test(blk),
      'every entry point checks its guard FIRST, before building a label');
    ok(/dead=true/.test(blk), 'it stops for good on a deadline, measured or not');
  }

  console.log('\n-- the page still answers, with the instrument running and the gesture made');
  await withBrowser(async (browser) => {
    for (const path of ['/spot/', '/paper-trade']) {
      const p = await newPage(browser);
      await p.setViewport({ width: 393, height: 852, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
      await p.evaluateOnNewDocument(() => { Object.defineProperty(window.navigator, 'standalone', { get: () => true, configurable: true }); });
      await p.goto(O + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
      if (FALSIFY) await Promise.race([p.evaluate(V1), new Promise(r => setTimeout(r, 4000))]);
      await new Promise(r => setTimeout(r, 4000));

      let a = await answers(p, 6000);
      ok(a.alive, path + ': the page answers after the instrument has run', a.ms + 'ms');

      if (path === '/paper-trade' && a.alive) {
        // the gesture that froze it: open Advanced, tap the exchange picker
        await Promise.race([
          p.evaluate(() => {
            const b = Array.from(document.querySelectorAll('button')).find(x => /advanced/i.test(x.textContent || ''));
            if (b) b.click();
          }),
          new Promise(r => setTimeout(r, 4000)),
        ]);
        await new Promise(r => setTimeout(r, 600));
        await Promise.race([
          p.evaluate(() => {
            const s = document.getElementById('planEx'); if (!s) return;
            const t = s.closest('.csel').querySelector('.csel-trigger');
            t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); t.click();
          }),
          new Promise(r => setTimeout(r, 4000)),
        ]);
        await new Promise(r => setTimeout(r, 1500));
        a = await answers(p, 6000);
        ok(a.alive, path + ': the page answers AFTER the picker has been tapped - the gesture that froze it', a.ms + 'ms');
        if (a.alive) {
          const seen = await Promise.race([
            p.evaluate(() => { const el = document.querySelector('.csel-panel.csel-sheet:not([hidden])'); if (!el) return null; const r = el.getBoundingClientRect(); return { y: Math.round(r.y), h: Math.round(r.height) }; }),
            new Promise(r => setTimeout(() => r('timeout'), 5000)),
          ]);
          console.log('       sheet after the tap: ' + JSON.stringify(seen));
        }
      }
      await Promise.race([p.close(), new Promise(r => setTimeout(r, 5000))]);
    }
  }, { timeoutMs: 200000 });

  console.log('\napp-diag-e2e: ' + pass + ' passed, ' + fail + ' failed');
  process.exitCode = fail ? 1 : 0;
})();
