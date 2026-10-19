/* /rekt/: A NARROW FILTER SEARCHED 200 ROWS ON A PHONE, AND "BY HOUR" PROMISED A DAY IT DID NOT HAVE
   (2026-10-19, owner: "na telefonu izabrao btc >1k i izaslo mi je samo dve likvidacije, na desktopu izlazi vise"
   + "ovo takodje ne radi lepo jer samo su 3 svece ispunjene")

   MEASURED IN THE SOURCE, both confirmed:
   1. The page keeps TWO stores. `all` is the live buffer and is capped at 200 rows in three places; `dayAll` is
      the whole day (backfill + live, 7,000 cap) and is filled on every viewport because the backfill calls
      deskAgg for every event. The DESKTOP tape filters dayAll (`tapeList = dayAll.filter(matchF)`) - the mobile
      feed filtered `all`. So on a phone a narrow filter searched the newest 200 rows ACROSS ALL COINS, and BTC
      over $1K is a thin slice of those: two rows. The data was already on the device; the feed was looking at
      the wrong half of it.
   2. The hour histogram is honest in its arithmetic and dishonest in its label. The backfill is the newest 3,000
      prints, which on a busy day reaches back a few hours, so the chart draws ~4 of 24 bars and hatches the rest
      - but `.hc.nd` hatches at rgba(255,255,255,.05) over a .03 background, which at 46px on a phone is
      invisible. A reader cannot tell "we did not see this hour" from "nothing was liquidated", and the heading
      says "today", so a day-shaped chart with three bars reads as broken. The summary already names the real
      start; the heading now stops claiming the day, and the hatch is visible.

   Not fixed here, and it is the better fix: /api/v1/liqseries has 5-minute buckets for the WHOLE day straight
   out of the collector's agg_5m - the same source that replaced the heatmap's browser-sample total on
   2026-10-09 - but it is symbol-scoped (symbol=ALL is read as a coin called ALL and returns three empty
   buckets). A market-wide mode there is a collector change and would let this chart show the real 24 hours.

   Idempotent, --dry prints without writing, refuses rather than guessing.  Run: node build/fix-rekt-window.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const FILE = path.join(__dirname, '..', 'dist', 'rekt', 'index.html');

const EDITS = [
  {
    what: 'the phone feed searches the day, not the last 200 rows',
    from: "    var list=all.filter(matchF).slice(0,60);",
    to: "    /* A NARROW FILTER MUST SEARCH THE DAY, NOT THE LIVE BUFFER (2026-10-19). `all` is capped at 200 rows\n       across every coin, so BTC over $1K found two; the desktop tape has always filtered `dayAll`, the full-day\n       store the backfill fills on every viewport. The cheap pass runs first and the day is only scanned when it\n       did not fill the screen - which is exactly when a filter is narrow, and never on the hot live path. */\n    var list=all.filter(matchF);\n    if(list.length<60&&typeof dayAll!=='undefined'&&dayAll&&dayAll.length>all.length){\n      list=dayAll.filter(matchF).sort(function(a,b){return b.ts-a.ts;});\n    }\n    list=list.slice(0,60);"
  },
  {
    what: 'an hour we did not see must look different from an empty one',
    from: ".hc.nd{background:repeating-linear-gradient(135deg,rgba(255,255,255,.05) 0 2px,transparent 2px 5px)}",
    to: ".hc.nd{background:repeating-linear-gradient(135deg,rgba(255,255,255,.17) 0 1px,rgba(255,255,255,.035) 1px 4px)}/* 2026-10-19: was .05 over a .03 ground - a hatch nobody could see, so 'we did not watch this hour' read as 'nothing happened' */"
  },
  // the heading claimed the whole day while the summary under it said the window really started mid-afternoon.
  // Two statements about one thing, and the wrong one was the bigger type.
  { what: 'phone heading stops claiming the day', from: 'By hour <small>today · UTC · ≥ $1K</small>', to: 'By hour <small>UTC · ≥ $1K · hatched = not watched</small>' },
  { what: 'desktop heading stops claiming the day', from: 'By hour <small>today · UTC · prints ≥ $1K</small>', to: 'By hour <small>UTC · prints ≥ $1K · hatched = hour not watched</small>' }
];

let src = fs.readFileSync(FILE, 'utf8');
const before = src;
const done = [];
let bad = 0;
for (const e of EDITS) {
  const n = src.split(e.from).length - 1;
  if (n === 0) {
    if (src.indexOf(e.to) >= 0 || src.indexOf(e.to.split('\n')[0]) >= 0) { done.push(e.what + ': already done'); continue; }
    console.log('  REFUSED ' + e.what + ' - anchor not found and replacement absent'); bad++; continue;
  }
  if (n > 1) { console.log('  REFUSED ' + e.what + ' - anchor appears ' + n + ' times'); bad++; continue; }
  src = src.split(e.from).join(e.to);   // split/join: never String.replace with a `$` anywhere near it
  done.push(e.what + ': ok');
}
if (bad) { console.log('\nREFUSED - nothing written'); process.exit(1); }
for (const must of ['dayAll.filter(matchF).sort', 'hatched = not watched']) {
  if (src.indexOf(must) < 0) { console.log('REFUSED - missing ' + must + ' after the pass'); process.exit(1); }
}
if (src.indexOf('By hour <small>today') >= 0) { console.log('REFUSED - a heading still claims the whole day'); process.exit(1); }
done.forEach(d => console.log('  ' + d));
if (src === before) { console.log('no change'); process.exit(0); }
if (DRY) { console.log('--dry: nothing written'); process.exit(0); }
fs.writeFileSync(FILE, src);
if (fs.readFileSync(FILE, 'utf8') !== src) { console.log('WROTE BUT DID NOT MATCH'); process.exit(1); }
console.log('written and verified from disk');
