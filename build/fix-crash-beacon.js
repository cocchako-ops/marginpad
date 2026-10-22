#!/usr/bin/env node
/* THE CRASH BEACON NAMES THE FRAME, THE STORE NAMES THE ROUTE, THE MIDNIGHT ARCHIVE STOPS CRYING WOLF (2026-10-22,
   owner: "prodji kroz greske ... smoother proizvod i bolje performanse").

   Measured first, from the seven-day broken-pages list: 28 of 40 client crashes are "Uncaught Error: Value is null"
   thrown INSIDE lightweight-charts on /paper-trade, 3 on 10-19, 14 on 10-20, 23 on 10-21 - a fresh regression - and
   the beacon recorded "@lightweight-charts-4.2.0.js :4", i.e. the minified library's own line, cut at the worker's
   48-char label cap, which says nothing about which of OUR calls asked the library for a null. A storm probe
   (timeframes, coins, resize, open/close, a 4x-throttled phone on 3G) could not reproduce it. So:

   1. The beacon reads the error's STACK and names the first frame that is ours (home.js:2888:43), not the frame
      that threw; the worker keeps 110 chars for a jserr label instead of 48. Tomorrow's list says where.
   2. drawLiq (the terminal's liquidation histogram) called candle.priceToCoordinate SIX times with no guard - the one
      LWC call that throws exactly "Value is null" on a series with no data. Guarded; it is a latent crash whether or
      not it is this one.
   3. usersDO() samples one call in five into the perf ring as `do:<path>` - the UserStore p95 pages RED (1607 ms,
      20,963 samples/6h) and nothing could say WHICH route is slow; /api/admin/perf and perfhist carry it now.
   4. archiveLiq skips the :00 pass: the collector's midnight film persist trips the worker's breaker at exactly that
      minute, the archive threw `collector_breaker_open` and paged every night, then self-healed at :10. It starts at
      :10 now and pages only when that fails.

   Idempotent, --dry. Refuses rather than guessing.                                                                */
'use strict';
const fs = require('fs');
const path = require('path');
const DRY = process.argv.indexOf('--dry') >= 0;
const R = path.join(__dirname, '..');
const F = { worker: path.join(R, 'src', 'worker.js'), home: path.join(R, 'dist', 'assets', 'home.js'), app: path.join(R, 'app', 'index.html'), dapp: path.join(R, 'dist', 'app.html'), dappes: path.join(R, 'dist', 'app-es.html') };
const src = {}; for (const k of Object.keys(F)) src[k] = fs.readFileSync(F[k], 'utf8');
const before = Object.assign({}, src);
const done = [];
const count = (s, a) => s.split(a).length - 1;
function one(file, name, a, b, skipIf) {
  const h = src[file];
  if (skipIf && [].concat(skipIf).some(m => h.indexOf(m) >= 0)) return false;
  const n = count(h, a);
  if (n !== 1) throw new Error(file + ' / ' + name + ': anchor appears ' + n + ' times, expected 1');
  src[file] = h.split(a).join(b);
  done.push(file + ': ' + name);
  return true;
}

/* 1. the beacon, in the three copies of the app shell (source + the two served shells; the script is byte-identical) */
const BEACON_OLD_REP = "function rep(m,ln){if(n>=8)return;m=String(m||'').slice(0,140);if(!m||IGN.test(m))return;var k=m+'@'+(ln||0);if(seen[k])return;seen[k]=1;n++;var lbl=(m+(ln?(' :'+ln):'')).replace(/[^a-zA-Z0-9 #:._/-]/g,' ').replace(/\\s+/g,' ').slice(0,80);";
const BEACON_NEW_REP = "/* frameOf: the first frame of the stack that is OURS (an /assets/ bundle or a page's inline script), never the library that threw - 'Value is null @lightweight-charts :4' named nothing for three days (2026-10-22) */\n"
  + "function frameOf(st){try{st=String(st||'');var m,re=/\\/assets\\/([a-z0-9.-]+)\\.js[^\\n]*?:(\\d+):(\\d+)/g;while((m=re.exec(st))){if(!/lightweight/i.test(m[1]))return m[1]+':'+m[2]+':'+m[3];}var m2=/marginpad\\.io\\/([a-z0-9-]*)[^\\n:]*:(\\d+):(\\d+)/.exec(st);if(m2)return (m2[1]||'page')+':'+m2[2]+':'+m2[3];}catch(_){}return '';}\n"
  + "function rep(m,ln,fr){if(n>=8)return;m=String(m||'').replace(/^Uncaught (?:[A-Za-z]*Error|Error): /,'').slice(0,140);if(!m||IGN.test(m))return;var k=m+'@'+(fr||ln||0);if(seen[k])return;seen[k]=1;n++;var lbl=(m+(fr?' #'+fr:(ln?(' :'+ln):''))).replace(/[^a-zA-Z0-9 #:._/-]/g,' ').replace(/\\s+/g,' ').slice(0,110);";
const BEACON_OLD_ERR = "window.addEventListener('error',function(e){if(!e||!e.message)return;var f=(e.filename||'');if(/-extension:/i.test(f))return;var b=f?f.split('/').pop().split('?')[0].slice(0,26):'';rep(e.message+(b?' @'+b:''),e.lineno);},true);";
const BEACON_NEW_ERR = "window.addEventListener('error',function(e){if(!e||!e.message)return;var f=(e.filename||'');if(/-extension:/i.test(f))return;var fr=frameOf(e.error&&e.error.stack);var b=f?f.split('/').pop().split('?')[0].slice(0,26):'';rep(e.message+(fr||!b?'':' @'+b),e.lineno,fr);},true);";
const BEACON_OLD_REJ = "window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;rep((r&&r.message)||(typeof r==='string'?r:'unhandledrejection'),0);});";
const BEACON_NEW_REJ = "window.addEventListener('unhandledrejection',function(e){var r=e&&e.reason;rep((r&&r.message)||(typeof r==='string'?r:'unhandledrejection'),0,frameOf(r&&r.stack));});";
for (const f of ['app', 'dapp', 'dappes']) {
  if (src[f].indexOf('function frameOf(st)') >= 0) continue;
  one(f, 'beacon names our frame (rep)', BEACON_OLD_REP, BEACON_NEW_REP);
  one(f, 'beacon names our frame (error)', BEACON_OLD_ERR, BEACON_NEW_ERR);
  one(f, 'beacon names our frame (rejection)', BEACON_OLD_REJ, BEACON_NEW_REJ);
}

/* 2. the worker keeps 110 chars of a jserr label */
one('worker', 'jserr label cap 48 -> 110',
  "  let label = (p.get('e') || '').replace(/[^a-zA-Z0-9 #:._/-]/g, '').slice(0, 48);",
  "  let label = (p.get('e') || '').replace(/[^a-zA-Z0-9 #:._/-]/g, '').slice(0, type === 'jserr' ? 110 : 48); // a crash label carries the message AND our frame since 2026-10-22; 48 cut it at the library's name",
  "slice(0, type === 'jserr' ? 110 : 48)");

/* 3. usersDO samples one call in five into the perf ring as do:<path> */
one('worker', 'usersDO per-route timing',
  "async function usersDO(env, p, body) {\n  try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })); return await r.json(); } catch (e) { return null; }\n}",
  "async function usersDO(env, p, body) {\n  // ONE call in five is timed into the perf ring as `do:<path>` (2026-10-22): the store's p95 paged RED at 1,607 ms\n  // over 20,963 samples and nothing could say WHICH route was slow - a single slow query blocks every other caller of a\n  // single-threaded DO, so the route matters more than the aggregate. Read it on /api/admin/perf (groups do:*) and\n  // /api/admin/perfhist?g=do:/botpositions. No ctx here: the buffer flushes with the next timed route that has one.\n  const _t0 = Date.now(), _smp = Math.floor(Math.random() * 5) === 0;\n  try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })); const j = await r.json(); if (_smp) { try { perfPush(env, null, 'do:' + String(p).split('?')[0].slice(0, 32), Date.now() - _t0, r.status < 500); } catch (e) {} } return j; } catch (e) { if (_smp) { try { perfPush(env, null, 'do:' + String(p).split('?')[0].slice(0, 32), Date.now() - _t0, false); } catch (e2) {} } return null; }\n}",
  "'do:' + String(p).split('?')[0]");

/* 4. the midnight archive waits for :10 */
one('worker', 'archiveLiq skips the :00 pass',
  "async function archiveLiq(env) {\n  if (!env.BACKUP || !env.COLLECTOR_URL || !env.STATS) return;",
  "async function archiveLiq(env) {\n  if (!env.BACKUP || !env.COLLECTOR_URL || !env.STATS) return;\n  if (new Date().getUTCMinutes() < 5) return; // the collector's midnight film persist trips the worker's breaker at exactly :00 - this pass threw collector_breaker_open and paged every night, then self-healed at :10. Start at :10. (2026-10-22)",
  "if (new Date().getUTCMinutes() < 5) return; // the collector's midnight film persist");

/* 5. drawLiq: every priceToCoordinate goes through a guard, and an empty series draws nothing */
{
  const h = src.home;
  if (h.indexOf('function _p2c(v)') < 0) {
    const A = "  function drawLiq(){ if(!overlay||!chart||!candle)return;";
    if (count(h, A) !== 1) throw new Error('home: drawLiq head not unique');
    const i = h.indexOf(A), j = h.indexOf('\n  function onCross(param)', i);
    if (j < 0 || j - i > 12000) throw new Error('home: drawLiq end not found');
    let span = h.slice(i, j);
    const n = count(span, 'candle.priceToCoordinate(');
    if (n < 5) throw new Error('home: expected the six unguarded priceToCoordinate calls in drawLiq, found ' + n);
    span = span.split('candle.priceToCoordinate(').join('_p2c(');
    span = span.split(A).join("  function _p2c(v){try{var y=candle.priceToCoordinate(v);return (y==null||!isFinite(y))?null:y;}catch(e){return null;}} // LWC throws 'Value is null' on a series with no data - a guard, not a try/catch per line (2026-10-22)\n  function drawLiq(){ if(!overlay||!chart||!candle)return; if(!bars||!bars.length)return;");
    src.home = h.slice(0, i) + span + h.slice(j);
    done.push('home: drawLiq guarded (' + n + ' calls)');
  }
  // the hover lookup beside it (same scope, same series, same null)
  one('home', 'nearest-bin hover lookup guarded',
    "var bn=dispBins[i],y=candle.priceToCoordinate(bn.price); if(y==null)continue;",
    "var bn=dispBins[i],y=_p2c(bn.price); if(y==null)continue;",
    "var bn=dispBins[i],y=_p2c(bn.price);");
}

if (!done.length) { console.log('fix-crash-beacon: nothing to do (already applied)'); process.exit(0); }
for (const f of ['app', 'dapp', 'dappes']) { if (count(src[f], 'function frameOf(st)') !== 1 || count(src[f], 'function rep(m,ln,fr)') !== 1) throw new Error(f + ': beacon not exactly once'); }
{ const left = count(src.home, 'candle.priceToCoordinate('); if (left < 1 || left > 3) throw new Error('home: expected only the already-guarded priceToCoordinate calls (1-3) to remain outside drawLiq, got ' + left); }
for (const k of Object.keys(F)) if (src[k].length < before[k].length * 0.98) throw new Error(k + ' shrank - refusing');
console.log('fix-crash-beacon: ' + done.length + ' edits\n  ' + done.join('\n  '));
if (DRY) { console.log('  --dry: nothing written'); process.exit(0); }
for (const k of Object.keys(F)) if (src[k] !== before[k]) { fs.writeFileSync(F[k] + '.tmp', src[k]); fs.renameSync(F[k] + '.tmp', F[k]); console.log('  written: ' + path.relative(R, F[k])); }
