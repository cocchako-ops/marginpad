// check-formulas.js - the drift guard for the trading math. Run after ANY change to it:
//   node build/check-formulas.js
//
// In a no-build vanilla codebase the liquidation and PnL formulas exist as inline copies across the client
// bundles - they cannot share an import - so the only thing standing between them and silent divergence is
// this script.
//
// IT WAS BROKEN AND THAT IS WHY EVERYTHING DRIFTED (rewritten 2026-10-09). The old version extracted the
// canonical mpcLiq with a regex that assumed a one-line body; the 2026-09-25 move to the exchange formula
// made it three lines, so the regex matched null, the script CRASHED before its math self-test, and three of
// its literal counts had been stale for weeks. Worse, the counts it did assert were counts of the RETIRED
// formula - the guard was keeping the bug in place. Found when the heatmap turned out to be placing every
// band 0.5% of the price away from where the rest of the site says the liquidation is: seven separate copies
// had drifted (the server pool cron, the heatmap client, mp-charts' two pool models, the 76 liquidation
// calculators, mp-calc, mp-auth's guest limit fill and /leverage-calculator/), and nothing noticed.
//
// So it works differently now, in three layers, and none of them rots on an unrelated edit:
//   1. the canonical is extracted by BRACE MATCHING, not a regex on its body, and self-tested;
//   2. every named mirror is EXTRACTED AND EXECUTED against the canonical over a grid - the only check that
//      actually proves two formulas agree;
//   3. the retired shapes are BANNED outright in executable code, and every file carrying an inline mirror
//      must carry the clamp that keeps a liquidation on the right side of its entry.
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0;
const must = (name, cond, detail) => { if (cond) console.log('  OK  ' + name); else { console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); fails++; } };

// ---- brace-matched extraction: survives a reformat, a multi-line body and a nested object literal ----
function sliceFn(src, needle) {
  const i = src.indexOf(needle);
  if (i < 0) return null;
  const open = src.indexOf('{', i + needle.length - 1);
  if (open < 0) return null;
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    const c = src[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return src.slice(i, j + 1); }
  }
  return null;
}
// Build a callable from extracted source. `window` is passed in so a mirror that prefers window.mpLiqPx can
// be tested on its OWN maths by handing it a window without one - which is the branch that has to be right.
function callable(src, name, decl) {
  try { return new Function('window', (decl || src) + '\nreturn ' + name + ';')({}); }
  catch (e) { return null; }
}

console.log('[worker] the canonical implementation:');
const w = R('src/worker.js');
must('mpcLiq defined exactly once', w.split('function mpcLiq(').length - 1 === 1, 'count ' + (w.split('function mpcLiq(').length - 1));
const canonSrc = sliceFn(w, 'function mpcLiq(');
must('mpcLiq extracted', !!canonSrc, 'brace matching found no body - did the function move or get renamed?');
if (!canonSrc) { console.log('\nDRIFT GUARD: cannot continue without the canonical.'); process.exit(1); }
const mpcLiq = callable(canonSrc, 'mpcLiq');
must('mpcLiq callable', typeof mpcLiq === 'function');

console.log('[math] the canonical self-tests (the exchange formula, 2026-09-25):');
const approx = (a, b, tol) => Math.abs(a - b) <= (tol == null ? 1e-9 : tol) * Math.max(1, Math.abs(b));
// Hand-computed from entry * (1 - 1/lev + min(mmr, 1/(2*lev))), rate 0.
must('long 10x @100 mmr 0.5% -> 90.5 (not the retired 90.05)', approx(mpcLiq(100, 10, 0.005, true, 0), 90.5));
must('short 10x @100 mmr 0.5% -> 109.5', approx(mpcLiq(100, 10, 0.005, false, 0), 109.5));
must('long 100x @100 mmr 0.5% -> 99.5 (0.500% away, not 0.995%)', approx(mpcLiq(100, 100, 0.005, true, 0), 99.5));
// A HIGHER MAINTENANCE MARGIN LIQUIDATES YOU SOONER, NOT LATER - the measurement that caught four wrong
// sentences on 2026-09-25. The figures in CLAUDE.md are quoted WITH the 0.055% crypto taker fee, which is
// already out of the backing margin: 10x at mmr 0.4% -> 9.545% from entry, at 0.8% -> 9.145%.
const TAKER = 0.00055;
must('higher mmr liquidates sooner at 10x', mpcLiq(100, 10, 0.008, true, TAKER) > mpcLiq(100, 10, 0.004, true, TAKER));
must('10x mmr 0.4% is 9.545% from entry', approx(100 - mpcLiq(100, 10, 0.004, true, TAKER), 9.545, 1e-9));
must('10x mmr 0.8% is 9.145% from entry', approx(100 - mpcLiq(100, 10, 0.008, true, TAKER), 9.145, 1e-9));
// The clamp. Without mmr_eff = min(mmr, im/2) a 200x long liquidates AT its entry and a 1000x one above it.
must('never inverts: long < entry up to 1000x', [100, 125, 200, 333, 500, 1000].every((L) => mpcLiq(100, L, 0.005, true, 0) < 100));
must('never inverts: short > entry up to 1000x', [100, 125, 200, 333, 500, 1000].every((L) => mpcLiq(100, L, 0.005, false, 0) > 100));
must('never inverts with a fat mmr at low leverage', mpcLiq(100, 2, 0.5, true, 0) < 100 && mpcLiq(100, 2, 0.5, true, 0) > 0);
must('long liq stays above zero at 1x', mpcLiq(100, 1, 0.005, true, 0) > 0);
must('more leverage = closer liq', (() => { let prev = 0; for (const L of [2, 5, 10, 25, 50, 100]) { const d = (100 - mpcLiq(100, L, 0.005, true, 0)); if (prev && d >= prev) return false; prev = d; } return true; })());
// THE OPEN FEE IS ALREADY OUT OF THE BACKING MARGIN, so it moves a long's liquidation UP - i.e. closer to
// the entry, because there is less margin left to lose (2026-09-24: 0.995% from entry became 0.9403%).
must('a taker fee moves a long liq closer to entry', mpcLiq(100, 100, 0.005, true, TAKER) > mpcLiq(100, 100, 0.005, true, 0));
must('a taker fee moves a short liq closer to entry', mpcLiq(100, 100, 0.005, false, TAKER) < mpcLiq(100, 100, 0.005, false, 0));
must('the fee term is capped at 0.1/lev', approx(mpcLiq(100, 10, 0.005, true, 1), mpcLiq(100, 10, 0.005, true, 0.1 / 10)));

console.log('[clients] every named mirror, EXECUTED against the canonical:');
// Each entry: a label, the file, the needle that finds it, the name to call, a declaration wrapper when the
// source is an assignment rather than a declaration, the ARGUMENT ORDER (stated, never guessed - guessing it
// is how the first run of this check reported a real mirror as broken because plLiq takes `long` third), and
// which maintenance rates it is meaningful to compare at.
const MIRRORS = [
  { label: 'mpLiqPx', file: 'dist/assets/home.js', needle: 'window.mpLiqPx=function(', name: 'mpLiqPx',
    decl: (s) => 'var ' + s.replace('window.mpLiqPx=', 'mpLiqPx=').replace(/;$/, '') + ';',
    call: (f, e, L, m, long) => f(e, L, m, long, 0) },
  { label: 'liqPx', file: 'dist/assets/mp-heatmap.js', needle: 'function liqPx(', name: 'liqPx',
    call: (f, e, L, m, long) => f(e, L, long, m) },
  // plLiq hardcodes the flat 0.5% both pool models have always assumed, so that is the only rate to compare at.
  { label: 'plLiq', file: 'dist/assets/mp-charts.js', needle: 'function plLiq(', name: 'plLiq',
    call: (f, e, L, m, long) => f(e, L, long), mmrs: [0.005] },
];
const ENTRIES = [0.00012, 1.3806, 109.46, 2478.17, 82305.1, 123456.789];
const LEVS = [1, 2, 3, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 333, 500, 1000];
const MMRS = [0, 0.001, 0.005, 0.0125, 0.02, 0.05];
for (const M of MIRRORS) {
  const src = sliceFn(R(M.file), M.needle);
  if (!src) { must(M.file + ' :: ' + M.label + ' found', false, 'needle "' + M.needle + '" not present - a mirror was renamed or removed'); continue; }
  const fn = callable(src, M.name, M.decl ? M.decl(src) : null);
  if (typeof fn !== 'function') { must(M.file + ' :: ' + M.label + ' callable', false, 'could not build a function from the extracted source'); continue; }
  const mmrs = M.mmrs || MMRS;
  let worst = 0, bad = null;
  for (const e of ENTRIES) for (const L of LEVS) for (const m of mmrs) for (const long of [true, false]) {
    const got = M.call(fn, e, L, m, long);
    const want = mpcLiq(e, L, m, long, 0);
    const rel = Math.abs(got - want) / Math.max(1e-12, Math.abs(want));
    if (rel > worst) { worst = rel; bad = { e, L, m, long, got, want }; }
  }
  const n = ENTRIES.length * LEVS.length * mmrs.length * 2;
  must(M.file + ' :: ' + M.label + ' matches mpcLiq over ' + n + ' cases', worst < 1e-12,
    bad ? 'worst relative error ' + worst.toExponential(2) + ' at entry=' + bad.e + ' lev=' + bad.L + ' mmr=' + bad.m + ' ' + (bad.long ? 'long' : 'short') + ': got ' + bad.got + ', canonical ' + bad.want : '');
}

console.log('[ban] the retired formula must not exist in executable code:');
// Comments are stripped first, so the history can be written down without tripping the guard. Only whole
// line and block comments - never a quoted string, so a URL's "//" is safe.
// THE SOURCE IS CRLF. `.` does not match `\r` (it is a line terminator in JS), so `^\s*\/\/.*$` could not
// reach the end of a line split on '\n' alone and stripped NOTHING - the first run of this check reported
// its own comment as a retired formula. Split on /\r?\n/. Same trap as the /trading-api/ patchers.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split(/\r?\n/).map((l) => l.replace(/^(\s*)\/\/.*$/, '$1')).join('\n');
const BANNED = [
  ['(1-mmr)/', 'the pre-2026-09-25 distance (1-mmr)/lev'],
  ['(1 - mmr) / ', 'the pre-2026-09-25 distance, spaced'],
  ['(1 - MMR) / ', 'the pre-2026-09-25 distance, MMR constant'],
  ['0.995/', 'the same thing with mmr folded into a literal'],
  ['0.995 / ', 'the same thing with mmr folded into a literal, spaced'],
];
const SCAN = ['src/worker.js', 'app/index.html']
  .concat(fs.readdirSync(path.join(__dirname, '..', 'dist', 'assets')).filter((f) => /\.js$/.test(f)).map((f) => 'dist/assets/' + f));
// Hand-made dist pages that carry a calculator of their own.
for (const d of ['leverage-calculator', 'liquidation-calculator']) {
  const p = 'dist/' + d + '/index.html';
  try { fs.accessSync(path.join(__dirname, '..', p)); SCAN.push(p); } catch (e) {}
}
let banHits = 0;
for (const f of SCAN) {
  const s = strip(R(f));
  for (const [lit, why] of BANNED) {
    const n = s.split(lit).length - 1;
    if (n) { banHits++; console.log('  FAIL ' + f + ' contains "' + lit + '" x' + n + ' - ' + why); fails++; }
  }
}
if (!banHits) console.log('  OK  none of ' + BANNED.length + ' retired shapes in ' + SCAN.length + ' files');

console.log('[clamp] every file with an inline mirror must carry mmr_eff = min(mmr, im/2):');
// An inline expression cannot be extracted and run, so what is asserted is the one thing that distinguishes
// the exchange formula WITH the clamp from the one that inverts above 1/(2*mmr) leverage.
const CLAMPED = [
  ['dist/assets/liqcalc.js', 'im / 2'],                 // the 76 liquidation calculators
  ['dist/assets/mp-calc.js', 'im/2'],                   // the calculators inside the app shell
  ['dist/assets/mp-auth.js', 'im / 2'],                 // a guest's locally-filled limit order STORES this
  ['dist/leverage-calculator/index.html', 'im/2'],
  ['dist/es/leverage-calculator/index.html', 'im/2'],   // the Spanish twin is a shipped page, not a copy of one
];
for (const [f, lit] of CLAMPED) must(f + ' :: clamp present', R(f).indexOf(lit) >= 0, 'no "' + lit + '" - the formula there can print a liq at or above the entry');

console.log('[clients] the P&L literals (a count mismatch means a copy moved):');
// Exact counts, deliberately: a new P&L centre that nobody updated here is exactly what this catches. If a
// count is legitimately different, change it HERE and verify the new copy against mpcLiq by hand.
const CLIENT = [
  ['dist/assets/home.js', [
    ['pnl clamp (-99% open cap)', '_pf=_op?-margin*0.99:-margin', 3],
    ['fee literal', '(+e.feeRate||0)', 5],
    ['fund literal', '-(+e.fund||0)', 6],
  ]],
  ['dist/assets/mp-trade.js', [
    ['pnl clamp (-99% open cap)', '_pf=_op?-margin*0.99:-margin', 2],
    ['fee literal', '(+e.feeRate||0)', 3],
    ['fund literal', '-(+e.fund||0)', 3],
  ]],
];
for (const [file, checks] of CLIENT) {
  const s = R(file);
  for (const [name, lit, count] of checks) {
    const n = s.split(lit).length - 1;
    must(file + ' :: ' + name + ' x' + count, n === count, 'count ' + n + ' (expected ' + count + ')');
  }
}

console.log('[worker] the server P&L centres:');
// SEVEN P&L centres each, counted and read one by one on 2026-10-09 (the manifest said 4 and 3, written when
// there were fewer, and had been stale long enough that nobody could tell a drift from the staleness):
// the open unrealized figure, closeAt in the sweep, close in /botclose, the bot/replay bulk close, the
// full close at pct>=1, the partial (which reads part.fund), and closeAt in the nudge sweep. The eighth fee
// occurrence is `fee_rate_pct` on the Bot API position shape - a reported field, not a computation.
must('server fee literal x8 (7 P&L centres + the reported fee_rate_pct)', w.split('(+t.feeRate || 0)').length - 1 === 8, 'count ' + (w.split('(+t.feeRate || 0)').length - 1));
must('server fund settlement x6 (+1 partial)', w.split('- (+t.fund || 0)').length - 1 === 6 && w.split('- (+part.fund || 0)').length - 1 === 1,
  'counts t:' + (w.split('- (+t.fund || 0)').length - 1) + ' part:' + (w.split('- (+part.fund || 0)').length - 1));
must('all fill paths call mpcLiq', w.split('mpcLiq(').length - 1 >= 6, 'call sites: ' + (w.split('mpcLiq(').length - 1));

console.log('');
if (fails) { console.log('DRIFT GUARD: ' + fails + ' FAILURE(S) - the trading math is out of sync.'); process.exit(1); }
console.log('DRIFT GUARD: in sync. One canonical, ' + MIRRORS.length + ' mirrors executed against it, ' + SCAN.length + ' files clean of the retired formula.');
