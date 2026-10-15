/* Assemble the per-strategy replay-backtest results into ONE object literal baked into worker.js (AI_STRAT_BT), so the
   GET /api/ai/chart catalogue can carry each strategy's win/loss/unclear over the same 24 historical moments. Reads
   build/data/ai-backtest-strat-<id>-report.json (written by gen-ai-backtest.js --strategy <id> --out strat-<id>) plus the
   plain run (ai-backtest-report.json) as the `auto` baseline. Small sample on purpose: a lean shown to the reader, not a
   promise - the picker labels it so. Run: node build/gen-ai-strat-bt.js  (writes build/data/ai-strat-bt.json + patches worker.js)
   2026-10-15. */
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, 'data');
const STRATS = ['trend_pullback', 'breakout', 'mean_reversion', 'sweep_reversal', 'supply_demand', 'vwap', 'scalp', 'swing'];
function tally(file) {
  let r; try { r = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  const rows = Object.keys(r).filter(k => /^\d+$/.test(k)).map(k => r[k]);
  const t = { n: 0, w: 0, l: 0, u: 0, nofill: 0, noplan: 0 };
  for (const row of rows) {
    const o = row && row.result && row.result.outcome;
    if (!o) { t.noplan++; continue; }
    if (o === 'win') { t.w++; t.n++; } else if (o === 'loss') { t.l++; t.n++; } else if (o === 'unclear') { t.u++; t.n++; } else if (o === 'nofill') { t.nofill++; }
  }
  return t;
}
const out = {};
const auto = tally(path.join(D, 'ai-backtest-report.json'));
if (auto) out.auto = auto;
for (const s of STRATS) { const t = tally(path.join(D, 'ai-backtest-strat-' + s + '-report.json')); if (t) out[s] = t; }
fs.writeFileSync(path.join(D, 'ai-strat-bt.json'), JSON.stringify(out, null, 1));
// bake into worker.js: replace the AI_STRAT_BT literal (or insert one before AI_STRAT_LIST)
const wf = path.join(__dirname, '..', 'src', 'worker.js');
let w = fs.readFileSync(wf, 'utf8');
const lit = 'const AI_STRAT_BT = ' + JSON.stringify(out) + '; // replay backtest, same 24 moments; baked by build/gen-ai-strat-bt.js';
if (/const AI_STRAT_BT = \{[\s\S]*?\};.*\n/.test(w)) {
  w = w.replace(/const AI_STRAT_BT = \{[\s\S]*?\};[^\n]*\n/, lit + '\n');
} else {
  w = w.replace('const AI_STRAT_LIST = Object.keys(AI_STRATS)', lit + '\nconst AI_STRAT_LIST = Object.keys(AI_STRATS)');
}
// AI_STRAT_LIST must attach bt for each id (and the panel reads s.bt)
w = w.replace(
  /const AI_STRAT_LIST = Object\.keys\(AI_STRATS\)\.map\(k => \(\{ id: k, name: AI_STRATS\[k\]\.name, short: AI_STRATS\[k\]\.short \}\)\);/,
  "const AI_STRAT_LIST = Object.keys(AI_STRATS).map(k => ({ id: k, name: AI_STRATS[k].name, short: AI_STRATS[k].short, bt: (AI_STRAT_BT && AI_STRAT_BT[k] && AI_STRAT_BT[k].n >= 20) ? { w: AI_STRAT_BT[k].w, l: AI_STRAT_BT[k].l, u: AI_STRAT_BT[k].u, n: AI_STRAT_BT[k].n } : null }));"
);
const tmp = wf + '.tmp';
fs.writeFileSync(tmp, w);
fs.renameSync(tmp, wf);
console.log('baked AI_STRAT_BT:', JSON.stringify(out));
