#!/usr/bin/env node
/* A BAR WITH A NULL IN IT POISONS THE RENDER LOOP, AND NO try/catch CAN SEE IT (2026-10-22).

   Measured against lightweight-charts 4.2.0 itself (scratchpad/lwc-api-probe.js): `series.update({..., close: null})`
   returns normally - and from the NEXT animation frame on, the library's own render loop throws
   "Uncaught Error: Value is null" on every frame. That is the exact shape of the week's #1 client crash on
   /paper-trade (3 / 14 / 23 a day since 10-19): uncaught, repeated, named after the library, and invisible to the
   try/catch every update site sits in, because the throw happens later and elsewhere. sanitizeBars() already guards
   setData(); the sixteen update() sites across the three engines had no guard at all.

   `window.mpBarOk(bar, site)` is the one validator: time > 0, open/high/low/close finite numbers > 0. A bad bar is
   SKIPPED (the chart keeps its last good frame instead of dying) and reported ONCE per site per session through the
   crash beacon as `bad bar <site> <fields>` - so the source is named on tomorrow's broken-pages list instead of
   silenced. Idempotent, --dry.                                                                                  */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const FILES = { h: 'home.js', c: 'mp-charts.js', m: 'mp-mcharts.js' };
const DEF = "window.mpBarOk=window.mpBarOk||function(b,site){try{var bad=[];if(!b||typeof b!=='object'){bad.push('bar');}else{if(!(+b.time>0&&isFinite(+b.time)))bad.push('time');['open','high','low','close'].forEach(function(k){var v=b[k];if(!(typeof v==='number'&&isFinite(v)&&v>0))bad.push(k+'='+(v===null?'null':typeof v==='number'?'NaN':typeof v));});}if(!bad.length)return true;var S=window.__mpBadBar=window.__mpBadBar||{};if(!S[site]){S[site]=1;try{console.warn('[mpBarOk] skipped a bad bar at '+site,b);}catch(_){}try{window.__mpTrack&&window.__mpTrack('jserr','bad bar '+site+' '+bad.join(' '));}catch(_){}}return false;}catch(_){return true;}}; /* a null/NaN OHLC value handed to series.update() poisons lightweight-charts' render loop from the next frame on (measured 2026-10-22) - the update is skipped and the site is named ONCE through the crash beacon */\n";
const done = [];
for (const tag of Object.keys(FILES)) {
  const f = path.join(R, 'dist', 'assets', FILES[tag]);
  let h = fs.readFileSync(f, 'utf8');
  const before = h;
  if (h.indexOf('window.mpBarOk=window.mpBarOk||') < 0) {
    if (tag === 'h') {
      const A = 'window.mpPxT=window.mpPxT||function(pd){';
      if (h.split(A).length !== 2) throw new Error('home: mpPxT anchor not unique');
      h = h.split(A).join(DEF + A);
    } else {
      h = DEF + h; // these two load after home.js on the app shell and self-guard, so order never matters
    }
  }
  // guard every update site, numbered by its line so the beacon can name it
  const lines = h.split('\n');
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    if (L.indexOf('candle.update(') < 0) continue;
    // every `X.candle.update(ARG)` on the line, left to right; ARG is a balanced expression
    let out = '', pos = 0;
    const re = /(\b(?:w\.|p\.)?candle\.update\()/g; let m;
    while ((m = re.exec(L))) {
      const start = m.index, open = start + m[0].length;
      // already guarded on this line at this spot?
      if (L.slice(Math.max(0, start - 40), start).indexOf('mpBarOk(') >= 0) continue;
      let depth = 1, j = open; while (j < L.length && depth > 0) { if (L[j] === '(') depth++; else if (L[j] === ')') depth--; j++; }
      const arg = L.slice(open, j - 1), callee = m[0].slice(0, -1); // e.g. w.candle.update
      const site = tag + (i + 1);
      out += L.slice(pos, start) + "(function(_b){if(window.mpBarOk(_b,'" + site + "'))" + callee + "(_b);})(" + arg + ")";
      pos = j; n++;
      re.lastIndex = j;
    }
    if (pos) lines[i] = out + L.slice(pos);
  }
  h = lines.join('\n');
  if (n) done.push(FILES[tag] + ': ' + n + ' update site(s) guarded');
  if (h !== before) {
    if (h.length < before.length) throw new Error(FILES[tag] + ' shrank - refusing');
    if (!DRY) { fs.writeFileSync(f + '.tmp', h); fs.renameSync(f + '.tmp', f); }
  }
}
if (!done.length) { console.log('fix-bar-guard: nothing to do (already applied)'); process.exit(0); }
console.log('fix-bar-guard: ' + done.join(', ') + (DRY ? '  --dry: nothing written' : '  written'));
