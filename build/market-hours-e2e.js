#!/usr/bin/env node
/* A MARKET IS OPEN ONLY WHEN ITS VENUE IS - E2E (2026-10-24). marketSession is a MONEY gate: it decides whether
   a fill may happen, and until today it called index hours 24/5 on the New York clock while a cash index trades
   only locally, so for six to fifteen hours a day the engine would fill against a price that could not move.
   Four of twenty live index positions had been opened that way.

   The decision cannot be staged against production (it depends on the hour), so the function is LIFTED OUT OF
   THE SHIPPED WORKER with the four tables it reads and driven at chosen instants. The load-bearing check is the
   INVARIANT, not any single verdict: the venue window may only ever REFUSE. For every class and instant, if the
   old rules said closed the new ones must still say closed - a session gate that could OPEN a market the
   weekend or maintenance rules had shut would be a worse bug than the one it fixes.

   --falsify removes the window check and must turn the index checks red. */
'use strict';
const fs = require('fs'), path = require('path');
const FALSIFY = process.argv.indexOf('--falsify') >= 0;
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m + (x !== undefined ? '  -> ' + JSON.stringify(x).slice(0, 200) : '')); } };

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
function grab(re, what) { const m = SRC.match(re); if (!m) throw new Error('could not lift ' + what + ' out of the worker'); return m[0]; }
function lift(strip) {
  let fn = grab(/function marketSession\(sym, pd, now\) \{[\s\S]*?\n\}/, 'marketSession');
  if (strip) fn = fn.replace(/const w9 = pd && pd\.sess;[\s\S]*?\n  \}\n/, ''); // the falsification: back to the New York clock alone
  const pre = [
    grab(/const STOCKS = \{[\s\S]*?\};/, 'STOCKS'),
    grab(/const COMMOD = \{[^}]*\};/, 'COMMOD'),
    grab(/const IDX_SYMS = \{[^}]*\};/, 'IDX_SYMS'),
    grab(/const FX_SYMS = \{[^}]*\};/, 'FX_SYMS'),
    grab(/function _nyParts\(ms\) \{[\s\S]*?\n\}/, '_nyParts'),
    grab(/function assetClassOf\(sym\) \{[\s\S]*?\n\}/, 'assetClassOf'),
  ].join('\n');
  return new Function(pre + '\n' + fn + '\nreturn marketSession;')();
}
const MS = lift(FALSIFY);

// a Wednesday, so no weekend rule is in play: 2026-10-21
const D = (h, m) => Date.UTC(2026, 9, 21, h, m || 0);
const win = (fromH, toH, tz, gmt) => ({ s: Math.floor(D(fromH) / 1000), e: Math.floor(D(toH) / 1000), tz: tz || 'Europe/Berlin', gmt: gmt || 7200 });

console.log('# a cash index follows its own exchange');
const ger = { sess: win(7, 15.5 | 0) }; ger.sess.e = Math.floor(D(15, 30) / 1000);
ok(MS('GER40', ger, D(10, 0)).open === true, 'GER40 is open at 10:00 UTC, inside Frankfurt hours');
ok(MS('GER40', ger, D(16, 30)).open === false, 'GER40 is CLOSED at 16:30 UTC - Frankfurt shut and the price cannot move', MS('GER40', ger, D(16, 30)));
ok(/07:00|09:00/.test(MS('GER40', ger, D(16, 30)).msg || ''), 'the refusal names the hours it does trade', MS('GER40', ger, D(16, 30)).msg);
ok(MS('GER40', ger, D(6, 0)).open === false, 'and before the open too');

const spx = { sess: { s: Math.floor(D(13, 30) / 1000), e: Math.floor(D(20, 0) / 1000), tz: 'America/New_York', gmt: -14400 } };
ok(MS('SPX500', spx, D(15, 0)).open === true, 'SPX500 is open at 15:00 UTC');
ok(MS('SPX500', spx, D(2, 0)).open === false, 'SPX500 is CLOSED at 02:00 UTC - this is the hour a US30 position was opened against a frozen print');
const hk = { sess: { s: Math.floor(D(1, 30) / 1000), e: Math.floor(D(8, 10) / 1000), tz: 'Asia/Hong_Kong', gmt: 28800 } };
ok(MS('HK50', hk, D(3, 0)).open === true && MS('HK50', hk, D(12, 0)).open === false, 'HK50 follows Hong Kong, not New York');

console.log('# what has no published window is untouched');
ok(MS('XAU', { }, D(12, 0)).open === true, 'XAU carries no session (it comes from Gate) and still trades on the 24/5 rule');
ok(MS('XAU', { }, D(21, 30)).open === false, 'and still stops in the 17:00-18:00 New York maintenance hour');
ok(MS('BTC', {}, D(3, 0)).open === true && MS('BTC', { sess: { s: 1, e: 2 } }, D(3, 0)).open === true, 'crypto is never gated, with or without a window');
ok(MS('AAPL', { state: 'REGULAR', sess: { s: 1, e: 2 } }, D(15, 0)).open === true, 'a stock still answers to its own state, not to the window');

console.log('# the invariant: the window may only ever REFUSE');
const OLD = lift(true);
let viol = 0, checked = 0;
for (const sym of ['GER40', 'SPX500', 'HK50', 'EURUSD', 'OIL', 'XAU', 'VIX']) {
  for (let day = 19; day <= 25; day++) {
    for (let h = 0; h < 24; h++) {
      const t = Date.UTC(2026, 9, day, h, 15);
      const w = { sess: { s: Math.floor(Date.UTC(2026, 9, day, 7) / 1000), e: Math.floor(Date.UTC(2026, 9, day, 15, 30) / 1000), tz: 'Europe/Berlin', gmt: 7200 } };
      const a = OLD(sym, w, t).open, b = MS(sym, w, t).open;
      checked++; if (!a && b) viol++;
    }
  }
}
ok(viol === 0, 'across ' + checked + ' instants the window never opened a market the old rules had closed', { viol });

console.log('\n' + pass + ' passed, ' + fail + ' failed' + (FALSIFY ? '  (falsification run - the index checks SHOULD be red)' : ''));
process.exitCode = FALSIFY ? (fail > 0 ? 0 : 1) : (fail ? 1 : 0);
