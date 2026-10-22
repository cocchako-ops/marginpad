#!/usr/bin/env node
/* A CLOSED MARKET IS NOT A FROZEN CHART (2026-10-22, the error/perf pass, round three).

   Measured on a desktop AAPL chart at 03:47 UTC (US market closed), with fetch() wrapped to keep the caller's frames:
   15 /api/klines requests in 45 s. Six were the one-off timeframe prewarm; the rest were THREE separate "liveness"
   defenses all deciding, every few seconds, that a chart whose newest bar is hours old must be stuck:
     - liveCandle's gap-refetch (`nowBar - lastBar.time > 1.5 bars` -> reloadKlinesThrottled -> a FULL loadKlines
       that resets the view) every 8 s, for ever - +2072, +10072, +18072, +27072, +35072, +43072 ms;
     - the 30 s authoritative re-sync (refreshKlinesQuiet);
     - the 5 s stalled-chart watchdog (gated on the market state earlier the same day - the one of the three that
       the first measurement happened to catch).
   720 full reloads an hour per open stock chart after hours, each one snapping the view back to the live edge.

   ONE predicate now, `_klQuiet()`: the market is closed (`window.mpIsMktClosed`, fed by the price pollers from the
   same `/api/price` body) OR the stall back-off is holding. The back-off (`_stallNote`) is fed by BOTH fetch paths
   (loadKlines + refreshKlinesQuiet), keyed on sym|tf so a switch starts clean, and it counts a fetch as a stall ONLY
   while the newest bar is genuinely behind the clock: on an open market successive fetches inside one 5m bucket all
   return the same newest bar, and the first cut of the back-off would have throttled the healthy re-sync for that.

   This file records the final form; the first cut was hand-edited the same day (the `var _stallNext...` line, the
   try{} in refreshKlinesQuiet and the watchdog gate), which is why the anchors below are that interim form rather
   than git HEAD. Idempotent, --dry.                                                                               */
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
const NOTE = "function _stallNote(sym,tf,kd){try{var k=sym+'|'+tf;if(k!==_stallKey){_stallKey=k;_stallBk=0;_stallNext=0;_stallSeen=0;}var nw=+kd[kd.length-1].time,ivS=tfSecs(tf)||300,nb=Math.floor((window.mpSrvNow?window.mpSrvNow():Date.now())/1000/ivS)*ivS,behind=nb-nw>Math.max(ivS*1.5,12);if(!behind){_stallBk=0;_stallNext=0;}else if(_stallSeen&&nw<=_stallSeen){_stallBk=Math.min(300000,(_stallBk||5000)*2);_stallNext=Date.now()+_stallBk;}_stallSeen=nw;}catch(e){}} /* a fetch counts as a stall only while the newest bar is BEHIND the clock and did not move since the last fetch */\n" +
  "  function _klQuiet(){try{if(window.mpIsMktClosed&&window.mpIsMktClosed(chartSym))return true;}catch(e){}return Date.now()<_stallNext;} /* the ONE answer to \"should a liveness defense fetch candles now\": closed market, or the back-off is holding */\n";
one('declarations + the two helpers',
  "  var _stallNext=0,_stallBk=0,_stallSeen=0; /* STALL BACK-OFF (2026-10-22):",
  "  var _stallNext=0,_stallBk=0,_stallSeen=0,_stallKey='';\n  " + NOTE + "  /* STALL BACK-OFF (2026-10-22):",
  "function _klQuiet(){");
one('comment states the open-market rule',
  "a newer bar resets it. */",
  "a newer bar resets it - and ONLY while the newest bar is genuinely behind the clock: on an open market successive fetches inside one 5m bucket all return the same newest bar and must never back the healthy re-sync off. Three defenses (gap-refetch, 30 s re-sync, 5 s watchdog) all ask _klQuiet() first; measured before: 15 klines fetches in 45 s on a closed AAPL chart, six of them full reloads that reset the view. */",
  "must never back the healthy re-sync off.");
one('refreshKlinesQuiet feeds the shared note',
  "      try{var _nw=+kd[kd.length-1].time;if(_stallSeen&&_nw<=_stallSeen){_stallBk=Math.min(300000,(_stallBk||5000)*2);_stallNext=Date.now()+_stallBk;}else{_stallBk=0;_stallNext=0;}_stallSeen=_nw;}catch(_){} /* no newer bar than last time = the market is not printing, not the chart freezing: back off */",
  "      _stallNote(sym,tf,kd);",
  "      _stallNote(sym,tf,kd);\n      kd=sanitizeBars(kd);_holeK=0;");
one('loadKlines feeds the shared note',
  "      if(kd&&kd.length){_holeK=0;klCache[ck]=kd;clearNoData();renderKlines(kd);",
  "      if(kd&&kd.length){_stallNote(sym,tf,kd);_holeK=0;klCache[ck]=kd;clearNoData();renderKlines(kd);",
  "{_stallNote(sym,tf,kd);_holeK=0;klCache[ck]=kd;");
one('gap-refetch asks first',
  "{_holeK=1;reloadKlinesThrottled();if(!(p>0)||nowBar-lastBar.time>Math.max(ivSec*30,60))return;}",
  "{_holeK=1;if(!_klQuiet())reloadKlinesThrottled();if(!(p>0)||nowBar-lastBar.time>Math.max(ivSec*30,60))return;}",
  "{_holeK=1;if(!_klQuiet())reloadKlinesThrottled();");
one('30 s re-sync asks first',
  "&&chart&&candle)refreshKlinesQuiet();},30000);",
  "&&chart&&candle&&!_klQuiet())refreshKlinesQuiet();},30000);",
  "&&chart&&candle&&!_klQuiet())refreshKlinesQuiet();},30000);");
one('watchdog asks the same predicate',
  "&&Date.now()>=_stallNext&&!(window.mpIsMktClosed&&window.mpIsMktClosed(chartSym)))refreshKlinesQuiet();",
  "&&!_klQuiet())refreshKlinesQuiet();",
  "||_holeK)&&!_klQuiet())refreshKlinesQuiet();");
if (!done.length) { console.log('fix-stall-backoff: nothing to do (already applied)'); process.exit(0); }
if (h.length < before.length) throw new Error('home.js shrank');
console.log('fix-stall-backoff: ' + done.length + ' edits\n  ' + done.join('\n  ') + (DRY ? '\n  --dry: nothing written' : ''));
if (DRY) process.exit(0);
fs.writeFileSync(F + '.tmp', h); fs.renameSync(F + '.tmp', F); console.log('  written: dist/assets/home.js');
