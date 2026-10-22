#!/usr/bin/env node
/* A CANDLE SET FETCHED A SECOND AGO IS NOT RE-FETCHED (2026-10-22, the error/perf pass, round three).

   Measured on a cold /paper-trade load with fetch() wrapped: the head preload fired the chart's klines at +32 ms,
   the first loadKlines consumed that promise (no network), and a SECOND loadKlines - from the chart library's own
   onload - rendered the cached bars instantly and then fetched the identical window again at +1079 ms, before the
   first paint had settled. Every cold chart load paid for its candles twice; on a 1.5 Mbps phone that is the
   request that competes with the chart library download.

   `klCacheT[ck]` stamps when a window was stored; loadKlines skips the network when the cached set is younger than
   KL_FRESH_MS (10 s) - a TF/symbol switch back to a window cached minutes ago still re-syncs, exactly as before.
   The prewarm is scheduled either way. Idempotent, --dry.                                                        */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const F = path.join(__dirname, '..', 'dist', 'assets', 'home.js');
let h = fs.readFileSync(F, 'utf8');
const before = h;
const done = [];
const count = (s, a) => s.split(a).length - 1;
function one(name, a, b, skipIf) {
  if (skipIf && h.indexOf(skipIf) >= 0) return false;
  const n = count(h, a); if (n !== 1) throw new Error(name + ': anchor appears ' + n + ' times');
  h = h.split(a).join(b); done.push(name); return true;
}
one('klCacheT declared beside klCache',
  "_openLines=[],_openMarks=[],klCache={},_linesSig=null;",
  "_openLines=[],_openMarks=[],klCache={},klCacheT={},_linesSig=null; /* klCacheT: when each window was stored - a set younger than 10 s is not fetched again (2026-10-22) */",
  "klCache={},klCacheT={},");
one('loadKlines: a fresh cached window renders and returns',
  "    if(cached&&cached.length&&candle){renderKlines(cached);try{if(window.__mpCsWarm&&window.__mpUxm)window.__mpUxm('cs',performance.now()-_csT);}catch(e){}}",
  "    if(cached&&cached.length&&candle){renderKlines(cached);try{if(window.__mpCsWarm&&window.__mpUxm)window.__mpUxm('cs',performance.now()-_csT);}catch(e){}\n      if(Date.now()-(klCacheT[ck]||0)<10000){_holeK=0;clearNoData();try{window.__mpCsWarm=1;}catch(e){}(window.requestIdleCallback?requestIdleCallback(function(){preloadTfs(sym,tf);},{timeout:4000}):setTimeout(function(){preloadTfs(sym,tf);},2500));return;} /* stored inside the last 10 s (the head preload, a refreshKlinesQuiet, the prewarm): fetching the identical window again is the cold-load duplicate measured at +1079 ms */}",
  "if(Date.now()-(klCacheT[ck]||0)<10000){");
one('loadKlines stamps the store',
  "if(kd&&kd.length){_stallNote(sym,tf,kd);_holeK=0;klCache[ck]=kd;",
  "if(kd&&kd.length){_stallNote(sym,tf,kd);_holeK=0;klCache[ck]=kd;klCacheT[ck]=Date.now();",
  "klCache[ck]=kd;klCacheT[ck]=Date.now();");
one('refreshKlinesQuiet stamps the store',
  "kd=sanitizeBars(kd);_holeK=0;klCache[sym+'|'+tf]=kd;",
  "kd=sanitizeBars(kd);_holeK=0;klCache[sym+'|'+tf]=kd;klCacheT[sym+'|'+tf]=Date.now();",
  "klCache[sym+'|'+tf]=kd;klCacheT[sym+'|'+tf]=Date.now();");
one('preloadTfs stamps the store',
  "then(function(kd){if(kd&&kd.length)klCache[ck]=kd;}); }); }",
  "then(function(kd){if(kd&&kd.length){klCache[ck]=kd;klCacheT[ck]=Date.now();}}); }); }",
  "if(kd&&kd.length){klCache[ck]=kd;klCacheT[ck]=Date.now();}");
if (!done.length) { console.log('fix-klines-cold-dup: nothing to do (already applied)'); process.exit(0); }
if (h.length < before.length) throw new Error('home.js shrank');
console.log('fix-klines-cold-dup: ' + done.length + ' edits\n  ' + done.join('\n  ') + (DRY ? '\n  --dry: nothing written' : ''));
if (DRY) process.exit(0);
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F); console.log('  written: dist/assets/home.js');
