#!/usr/bin/env node
/* A PRICE HAS TWO TIMES: WHEN IT WAS MEASURED AND WHEN IT ARRIVED (2026-10-22, same day as the price-age change).

   This morning's fix stamps a REST price at its MEASURED time (Date.now() - age, up to 8 s behind the clock) so a stale
   body can never read as live. Two readers of that stamp meant "when did we last HEAR from the feed", not "how old is
   the price", and the new stamp turned them wrong for a REST-only symbol (every stock, forex and index chart - Yahoo has
   no socket): the terminal's stale-source watchdog (9 s, every 5 s) could now trip on a price that arrived a second ago,
   and its hard-recover re-fetches the candles and snaps the chart to the live edge under the reader. And the watchdog's
   "no source yet" branch fired on every cold load before the first tick - measured on a throttled phone: the SAME
   timeframe fetched twice inside 1.7 s of the first paint.

   `r` = received time, beside `t` = measured time, on every map entry. The watchdog and the poll cadence read `r`;
   the stale mark keeps reading `t`. The watchdog counts from the chart's first paint until the first tick arrives.
   Idempotent, --dry.                                                                                                */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const F = { home: path.join(R, 'dist', 'assets', 'home.js'), trade: path.join(R, 'dist', 'assets', 'mp-trade.js') };
const src = {}; for (const k of Object.keys(F)) src[k] = fs.readFileSync(F[k], 'utf8');
const before = Object.assign({}, src);
const done = [];
const count = (s, a) => s.split(a).length - 1;
function one(file, name, a, b, skipIf) {
  const h = src[file]; if (skipIf && h.indexOf(skipIf) >= 0) return false;
  const n = count(h, a); if (n !== 1) throw new Error(file + ' / ' + name + ': anchor appears ' + n + ' times');
  src[file] = h.split(a).join(b); done.push(file + ': ' + name); return true;
}
one('home', 'emit() stamps the received time beside the measured one',
  "window.mpLivePrices[sym]={p:price,t:_t9,chg:(chg!=null&&isFinite(chg))?chg:prev.chg};",
  "window.mpLivePrices[sym]={p:price,t:_t9,r:Date.now(),chg:(chg!=null&&isFinite(chg))?chg:prev.chg}; /* t = measured, r = received (2026-10-22) */",
  "{p:price,t:_t9,r:Date.now(),chg:");
one('home', 'pollPrices stamps the received time',
  "prices[sym]={p:+pd.price,t:_t9,chg:(pd.chg!=null?+pd.chg:(cur&&cur.chg))};",
  "prices[sym]={p:+pd.price,t:_t9,r:Date.now(),chg:(pd.chg!=null?+pd.chg:(cur&&cur.chg))};",
  "{p:+pd.price,t:_t9,r:Date.now(),chg:");
one('home', 'pollPrices cadence reads the received time',
  "var cur=prices[sym];if(cur&&cur.t&&(Date.now()-cur.t)<4000)return;",
  "var cur=prices[sym];if(cur&&(cur.r||cur.t)&&(Date.now()-(cur.r||cur.t))<4000)return; /* cadence by ARRIVAL, not by the measured stamp - a REST price is measured up to 8 s before it lands and would be re-polled every pass */",
  "(Date.now()-(cur.r||cur.t))<4000)return;");
one('home', 'the watchdog reads the received time and counts from the first paint before any tick',
  "var _pd=window.mpPlanLive,_srcT=Math.max((_pd&&_pd.sym===chartSym&&_pd.t)||0,(prices[chartSym]&&prices[chartSym].t)||0);\n    if(!_srcT||Date.now()-_srcT>9000){",
  "var _pd=window.mpPlanLive,_px9=prices[chartSym],_srcT=Math.max((_pd&&_pd.sym===chartSym&&_pd.t)||0,(_px9&&(_px9.r||_px9.t))||0); /* when the feed last ARRIVED (r); the measured stamp t is for the stale mark and would trip this on every REST-only chart */\n    var _ref9=_srcT||_chartUpT||0; /* no tick yet = count from the chart's first paint, not from zero - the \"no source\" branch used to hard-recover (re-fetch + snap) on every cold load before the first tick (2026-10-22) */\n    if(_ref9&&Date.now()-_ref9>9000){",
  "var _ref9=_srcT||_chartUpT||0;");
one('home', '_chartUpT declared', "  var _kq=0; // klines request ticket", "  var _kq=0,_chartUpT=0; // klines request ticket", "var _kq=0,_chartUpT=0;");
one('home', '_chartUpT set on first paint',
  "    _userPS=false;try{candle.setData(bars);chart.priceScale('right').applyOptions({autoScale:true});",
  "    _chartUpT=Date.now();_userPS=false;try{candle.setData(bars);chart.priceScale('right').applyOptions({autoScale:true});",
  "_chartUpT=Date.now();_userPS=false;");
one('trade', 'the drawer poll stamps the received time',
  "window.mpLivePrices[sym]={p:p,t:_t9,chg:(j&&j.chg!=null&&isFinite(j.chg))?+j.chg:prev.chg};",
  "window.mpLivePrices[sym]={p:p,t:_t9,r:Date.now(),chg:(j&&j.chg!=null&&isFinite(j.chg))?+j.chg:prev.chg};",
  "{p:p,t:_t9,r:Date.now(),chg:");
one('trade', 'the drawer poll cadence reads the received time',
  "if(lp&&lp.t&&(now-lp.t)<6000)return;               // WS or a recent poll already fresh → skip",
  "if(lp&&(lp.r||lp.t)&&(now-(lp.r||lp.t))<6000)return;               // WS or a recent poll already fresh → skip (by ARRIVAL since 2026-10-22; t is the measured time)",
  "(now-(lp.r||lp.t))<6000)return;");
if (!done.length) { console.log('fix-price-received: nothing to do (already applied)'); process.exit(0); }
for (const k of Object.keys(F)) if (src[k].length < before[k].length) throw new Error(k + ' shrank');
console.log('fix-price-received: ' + done.length + ' edits\n  ' + done.join('\n  ') + (DRY ? '\n  --dry: nothing written' : ''));
if (DRY) process.exit(0);
for (const k of Object.keys(F)) if (src[k] !== before[k]) { fs.writeFileSync(F[k] + '.tmp', src[k]); fs.renameSync(F[k] + '.tmp', F[k]); console.log('  written: ' + path.relative(R, F[k])); }
