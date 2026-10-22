#!/usr/bin/env node
/* THE SAME CLOSED-MARKET LOOP IN THE TWO /charts ENGINES (2026-10-22, the error/perf pass, round three).

   fix-stall-backoff.js records the home.js half: on a closed market (a stock after hours, every weekend for
   forex/indices) three liveness defenses each decided every few seconds that a chart whose newest bar is hours old
   must be stuck, and the gap-refetch did a FULL reload every 8 s for ever. mp-charts.js (desktop workspace) and
   mp-mcharts.js (phone) carry the same four defenses by design (CLAUDE.md: port all of them into any new engine) and
   therefore the same loop: `refreshData(w)` / `resyncKlines(p)` off the gap check every 8 s, off the watchdog every
   10 s, off the 60 s re-sync, per WINDOW - a four-window AAPL layout after hours is ~1,800 klines fetches an hour.

   Per window/pane state `o._st = {key, bk, next, seen}`; `klStallNote` is fed by every klines fetch that lands
   (the initial load and the re-sync) and backs off ONLY while the newest bar is genuinely behind the clock and did
   not move since the last fetch (an open market inside one bucket is never a stall); `klQuiet(o)` = the market is
   closed for `o.sym` (`window.mpIsMktClosed`, home.js, fed by the price pollers) or that window's back-off holds.
   Idempotent, --dry.                                                                                            */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const F = { d: path.join(R, 'dist', 'assets', 'mp-charts.js'), m: path.join(R, 'dist', 'assets', 'mp-mcharts.js') };
const src = {}; for (const k of Object.keys(F)) src[k] = fs.readFileSync(F[k], 'utf8');
const before = Object.assign({}, src);
const done = [];
const count = (s, a) => s.split(a).length - 1;
function one(file, name, a, b, skipIf) {
  const h = src[file]; if (skipIf && h.indexOf(skipIf) >= 0) return false;
  const n = count(h, a); if (n !== 1) throw new Error(file + ' / ' + name + ': anchor appears ' + n + ' times');
  src[file] = h.split(a).join(b); done.push(file + ': ' + name); return true;
}
const HELPERS = "  function klStallNote(o,sym,tf,kd){try{var k=sym+'|'+tf,s=o._st||(o._st={});if(s.key!==k){s.key=k;s.bk=0;s.next=0;s.seen=0;}var nw=+kd[kd.length-1].time,ivS=tfSecs(tf)||300,nb=Math.floor((window.mpSrvNow?window.mpSrvNow():Date.now())/1000/ivS)*ivS,behind=nb-nw>Math.max(ivS*1.5,12);if(!behind){s.bk=0;s.next=0;}else if(s.seen&&nw<=s.seen){s.bk=Math.min(300000,(s.bk||5000)*2);s.next=Date.now()+s.bk;}s.seen=nw;}catch(e){}} /* STALL BACK-OFF (2026-10-22): a klines fetch counts as a stall only while the newest bar is BEHIND the clock and did not move since the last fetch - 5 s -> 5 min doubling, reset by any newer bar. An open market inside one bucket is never a stall. */\n" +
  "  function klQuiet(o){try{if(window.mpIsMktClosed&&window.mpIsMktClosed(o.sym))return true;}catch(e){}return !!(o._st&&Date.now()<o._st.next);} /* the ONE answer to \"should a liveness defense fetch candles now\": a closed market never prints a newer bar, and asking every 8 s is load, not liveness (measured: 15 fetches in 45 s on one closed AAPL chart before this) */\n";
// desktop workspace
one('d', 'helpers', "  function refreshData(w){ if(w.dead||!w.candle||w._lm||w._rp)return;", HELPERS + "  function refreshData(w){ if(w.dead||!w.candle||w._lm||w._rp)return;", "function klQuiet(o){");
one('d', 'loadData feeds the note', "if(kd&&kd.length){kd=sanitizeBars(kd);w.bars=kd;applyPrec(", "if(kd&&kd.length){klStallNote(w,w.sym,w.tf,kd);kd=sanitizeBars(kd);w.bars=kd;applyPrec(", "{klStallNote(w,w.sym,w.tf,kd);kd=sanitizeBars(kd);w.bars=kd;");
one('d', 'refreshData feeds the note', "      kd=sanitizeBars(kd);w._hole=0;/* server answered", "      klStallNote(w,sym,tf,kd);kd=sanitizeBars(kd);w._hole=0;/* server answered", "klStallNote(w,sym,tf,kd);kd=sanitizeBars(kd);w._hole=0;");
one('d', 'gap-refetch asks first', "if(!w._gapT||Date.now()-w._gapT>8000){w._gapT=Date.now();refreshData(w);}", "if(!klQuiet(w)&&(!w._gapT||Date.now()-w._gapT>8000)){w._gapT=Date.now();refreshData(w);}", "if(!klQuiet(w)&&(!w._gapT||Date.now()-w._gapT>8000))");
one('d', 'watchdog asks first', "&&(!w._gapT||now-w._gapT>10000)){w._gapT=now;refreshData(w);continue;}", "&&!klQuiet(w)&&(!w._gapT||now-w._gapT>10000)){w._gapT=now;refreshData(w);continue;}", "&&!klQuiet(w)&&(!w._gapT||now-w._gapT>10000))");
one('d', 'poll-miss refetch asks first', "else if(!w._gapT||Date.now()-w._gapT>12000){w._gapT=Date.now();refreshData(w);}", "else if(!klQuiet(w)&&(!w._gapT||Date.now()-w._gapT>12000)){w._gapT=Date.now();refreshData(w);}", "else if(!klQuiet(w)&&(!w._gapT||Date.now()-w._gapT>12000))");
one('d', '60 s re-sync asks first', "if(!w.dead&&!document.hidden)refreshData(w); },60000);", "if(!w.dead&&!document.hidden&&!klQuiet(w))refreshData(w); },60000);", "if(!w.dead&&!document.hidden&&!klQuiet(w))refreshData(w); },60000);");
// phone
one('m', 'helpers', "  function resyncKlines(p){ if(!p.candle)return; // background", HELPERS + "  function resyncKlines(p){ if(!p.candle)return; // background", "function klQuiet(o){");
one('m', '_applyKlines feeds the note', "if(kd&&kd.length){kd=sanitizeBars(kd);p.bars=kd;p._hole=0;", "if(kd&&kd.length){klStallNote(p,sym,tf,kd);kd=sanitizeBars(kd);p.bars=kd;p._hole=0;", "{klStallNote(p,sym,tf,kd);kd=sanitizeBars(kd);p.bars=kd;p._hole=0;");
one('m', 'resyncKlines feeds the note', "      kd=sanitizeBars(kd);\n      var _rm=0,_app=[],_mism=false;", "      klStallNote(p,sym,tf,kd);kd=sanitizeBars(kd);\n      var _rm=0,_app=[],_mism=false;", "klStallNote(p,sym,tf,kd);kd=sanitizeBars(kd);\n      var _rm=0,");
one('m', 'gap-refetch asks first', "p._hole=1;if(!p._gapT||Date.now()-p._gapT>8000){p._gapT=Date.now();resyncKlines(p);}", "p._hole=1;if(!klQuiet(p)&&(!p._gapT||Date.now()-p._gapT>8000)){p._gapT=Date.now();resyncKlines(p);}", "p._hole=1;if(!klQuiet(p)&&(!p._gapT||Date.now()-p._gapT>8000))");
one('m', 'watchdog asks first', "&&(!p._gapT||Date.now()-p._gapT>10000)){p._gapT=Date.now();resyncKlines(p);return;}", "&&!klQuiet(p)&&(!p._gapT||Date.now()-p._gapT>10000)){p._gapT=Date.now();resyncKlines(p);return;}", "&&!klQuiet(p)&&(!p._gapT||Date.now()-p._gapT>10000))");
// The market state the gate reads is written by home.js's PT pollers, which do not run on /charts - measured: a seeded
// AAPL window on /charts read mpIsMktClosed('AAPL') === false after hours, so only the back-off was holding it. The
// engines' own REST polls receive the same `state` field in the /api/price body and now record it.
const ST_W = "try{if(j&&j.state!=null&&window.mpMktState)window.mpMktState[String(w.sym).toUpperCase()]=String(j.state);}catch(e){} /* the market state the stall gate reads - the PT pollers that usually write it do not run here (2026-10-22) */";
one('d', 'window REST poll records the market state', ".then(function(j){if(w.dead)return;var px=j&&+(j.price||j.p||j.last||0);", ".then(function(j){if(w.dead)return;" + ST_W + "var px=j&&+(j.price||j.p||j.last||0);", "if(w.dead)return;try{if(j&&j.state!=null&&window.mpMktState)");
one('d', 'phone-fallback REST poll records the market state', ".then(function(j){if(j&&!mw.dead){var px=+(j.price||j.p||j.last||0);", ".then(function(j){if(j&&!mw.dead){" + ST_W.split('w.sym').join('mw.sym') + "var px=+(j.price||j.p||j.last||0);", "if(j&&!mw.dead){try{if(j&&j.state!=null&&window.mpMktState)");
one('m', 'pane REST poll records the market state', ".then(function(j){var px=j&&+j.price;if(px>0&&window.mpLivePrices){window.mpLivePrices[p.sym]=", ".then(function(j){" + ST_W.split('w.sym').join('p.sym') + "var px=j&&+j.price;if(px>0&&window.mpLivePrices){window.mpLivePrices[p.sym]=", "then(function(j){try{if(j&&j.state!=null&&window.mpMktState)window.mpMktState[String(p.sym)");
if (!done.length) { console.log('fix-stall-backoff-charts: nothing to do (already applied)'); process.exit(0); }
for (const k of Object.keys(F)) if (src[k].length < before[k].length) throw new Error(k + ' shrank');
console.log('fix-stall-backoff-charts: ' + done.length + ' edits\n  ' + done.join('\n  ') + (DRY ? '\n  --dry: nothing written' : ''));
if (DRY) process.exit(0);
for (const k of Object.keys(F)) if (src[k] !== before[k]) { fs.writeFileSync(F[k] + '.tmp', src[k]); fs.renameSync(F[k] + '.tmp', F[k]); console.log('  written: ' + path.relative(R, F[k])); }
