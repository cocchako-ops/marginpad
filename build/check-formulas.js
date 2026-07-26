// check-formulas.js — P1 mp-core drift guard. In a no-build vanilla codebase the liquidation/PnL formulas
// exist as inline copies across the client bundles (they can't share an import). This script makes drift
// IMPOSSIBLE to miss: (1) the worker must have exactly ONE canonical implementation (mpcLiq) and zero inline
// copies; (2) every known client copy must match its verbatim literal (count-asserted per file); (3) the
// canonical math self-tests against hand-computed values. Run after ANY change to trading math:
//   node build/check-formulas.js
const fs = require('fs');
const R = (p) => fs.readFileSync(require('path').join(__dirname, '..', p), 'utf8');
let fails = 0;
const must = (name, cond, detail) => { if (cond) console.log('  OK  ' + name); else { console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); fails++; } };

console.log('[worker] canonical mpcLiq:');
const w = R('src/worker.js');
must('mpcLiq defined once', w.split('function mpcLiq(').length - 1 === 1);
must('zero inline liq copies outside mpcLiq', w.split('(1 - (1 - mmr) / lev)').length - 1 === 1, 'found ' + (w.split('(1 - (1 - mmr) / lev)').length - 1));
must('all fill paths call mpcLiq', w.split('mpcLiq(entry, lev, mmr, long)').length - 1 >= 5, 'call sites: ' + (w.split('mpcLiq(entry, lev, mmr, long)').length - 1));
must('server fee literal ×5', w.split('(+t.feeRate || 0)').length - 1 === 5, 'count ' + (w.split('(+t.feeRate || 0)').length - 1));
must('server fund settlement ×4 (+1 partial)', w.split('- (+t.fund || 0)').length - 1 === 4 && w.split('- (+part.fund || 0)').length - 1 === 1, 'counts t:' + (w.split('- (+t.fund || 0)').length - 1) + ' part:' + (w.split('- (+part.fund || 0)').length - 1));

console.log('[clients] verbatim formula literals (drift = count mismatch):');
const CLIENT = [
  ['dist/assets/home.js', [
    ["liq (all copies)", '1-(1-mmr)', 6],
    ["pnl clamp", 'pnl<-margin', 3],
  ]],
  ['dist/assets/mp-charts.js', [["liq", '1-(1-mmr)', 2]]],
  ['dist/assets/mp-mcharts.js', [["liq", '1-(1-mmr)', 4]]],
  ['dist/assets/mp-trade.js', [["pnl clamp", 'pnl<-margin', null]]], // null = presence only
  // P1 fees: the per-side taker fee literal must exist at every P&L center (server copies asserted below)
  ['dist/assets/home.js', [["fee literal", '(+e.feeRate||0)', 5]]],
  ['dist/assets/mp-trade.js', [["fee literal", '(+e.feeRate||0)', 2]]],
  // P1 funding: the fund settlement literal must exist at every P&L center
  ['dist/assets/home.js', [["fund literal", '-(+e.fund||0)', 5]]],
  ['dist/assets/mp-trade.js', [["fund literal", '-(+e.fund||0)', 2]]],
];
for (const [file, checks] of CLIENT) {
  const s = R(file);
  for (const [name, lit, count] of checks) {
    const n = s.split(lit).length - 1;
    if (count == null) must(file + ' :: ' + name, n >= 1, 'count ' + n);
    else must(file + ' :: ' + name + ' ×' + count, n === count, 'count ' + n + ' (expected ' + count + ' — a copy was added/edited: update this manifest AND verify the math matches mpcLiq)');
  }
}

console.log('[math] canonical self-test:');
const mpcLiq = new Function('entry', 'lev', 'mmr', 'long', 'return ' + (w.match(/function mpcLiq\([^)]*\) \{ return ([^;]+);/)[1]).replace(/entry/g, 'entry').toString());
const approx = (a, b) => Math.abs(a - b) < 1e-6;
must('long 10x @100 mmr .005 → 90.05', approx(mpcLiq(100, 10, 0.005, true), 100 * (1 - 0.995 / 10)));
must('short 10x @100 → 109.95', approx(mpcLiq(100, 10, 0.005, false), 109.95));
must('long 1000x @65000 → within 0.1% of entry', (() => { const l = mpcLiq(65000, 1000, 0.005, true); return l < 65000 && (65000 - l) / 65000 < 0.0011; })());
must('never inverts at 200x+', mpcLiq(100, 200, 0.005, true) < 100 && mpcLiq(100, 200, 0.005, false) > 100);

console.log('');
if (fails) { console.log('DRIFT GUARD: ' + fails + ' FAILURE(S) — trading math is out of sync.'); process.exit(1); }
console.log('DRIFT GUARD: all formulas in sync (worker canonical + ' + CLIENT.length + ' client bundles verified).');
