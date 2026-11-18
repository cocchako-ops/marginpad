// 2026-11-18 (owner liked the sizing table: "probaj ako mozes i to da poboljsas"). Trades from both universes
// (channel coins + 9 unseen, cluster always measured on the channel coins). Positions opened in the same hour are open AT THE
// SAME TIME and their outcomes are correlated, so they are settled together on the equity they shared (no compounding inside
// an hour) - the honest version of the table. Then: more coins, a per-hour risk budget, conviction sizing.
const fs = require('fs');
const load = f => JSON.parse(fs.readFileSync(__dirname + '/' + f, 'utf8'));
const CH = load('tr-chan.json'), ALT = load('tr-alt.json');
const span = (a) => (Math.max(...a.map(t => t.t)) - Math.min(...a.map(t => t.t))) / 86400 / 30;
const MID = Date.UTC(2025, 5, 1) / 1000;
function run(trades, riskOf) {
  const byH = new Map(); trades.forEach(t => { const h = Math.floor(t.t / 3600); (byH.get(h) || byH.set(h, []).get(h)).push(t); });
  let eq = 1, pk = 1, dd = 0, maxOpen = 0; const hs = [...byH.keys()].sort((a, b) => a - b);
  for (const h of hs) { const g = byH.get(h); const rs = riskOf(g); let d = 0; g.forEach((t, i) => { d += rs[i] * t.R; }); maxOpen = Math.max(maxOpen, rs.reduce((a, b) => a + b, 0)); eq *= Math.max(0, 1 + d); pk = Math.max(pk, eq); dd = Math.max(dd, 1 - eq / pk); }
  return { eq, dd, maxOpen };
}
function show(lab, trades, riskOf) {
  const r = run(trades, riskOf), m = span(trades), o = run(trades.filter(t => t.t < MID), riskOf), n = run(trades.filter(t => t.t >= MID), riskOf);
  console.log(lab.padEnd(50) + '$1,000 -> $' + Math.round(r.eq * 1000).toLocaleString('en-US').padStart(8) + ' | /mo ' + ((Math.pow(r.eq, 1 / m) - 1) * 100).toFixed(1).padStart(5) + '% | drop ' + (r.dd * 100).toFixed(0).padStart(2) + '% | most at risk at once ' + (r.maxOpen * 100).toFixed(0) + '% | trades/mo ' + (trades.length / m).toFixed(1) + ' | old x' + o.eq.toFixed(2) + ' new x' + n.eq.toFixed(2));
}
const each = p => g => g.map(() => p);
const budget = (p, cap) => g => g.map(() => Math.min(p, cap / g.length));
const B = t => t.cl >= 4;
const sets = { 'channel coins (as in the table)': CH.filter(B), '+ 9 more coins': CH.filter(B).concat(ALT.filter(B)) };
for (const [k, a] of Object.entries(sets)) {
  console.log('\n=== ' + k + ' ===');
  for (const p of [0.01, 0.02, 0.03]) show('risk ' + p * 100 + '% each, no limit', a, each(p));
  for (const [p, cap] of [[0.02, 0.04], [0.03, 0.06], [0.03, 0.05]]) show('risk ' + p * 100 + '% each, max ' + cap * 100 + '% per hour', a, budget(p, cap));
}
const all = CH.concat(ALT);
console.log('\n=== conviction sizing (both coin sets) ===');
show('cl>=4 only, 2% / max 4% per hour', all.filter(B), budget(0.02, 0.04));
show('cl 3 at 1%, cl>=4 at 2%, max 4% per hour', all, g => g.map(t => Math.min(t.cl >= 4 ? 0.02 : 0.01, 0.04 / g.length)));
show('cl>=4 2%, cl>=5 3%, max 5% per hour', all.filter(B), g => g.map(t => Math.min(t.cl >= 5 ? 0.03 : 0.02, 0.05 / g.length)));
show('cl>=4, vol>=2x 3% else 2%, max 5% per hour', all.filter(B), g => g.map(t => Math.min(t.vol >= 2 ? 0.03 : 0.02, 0.05 / g.length)));
console.log('\nR per trade by cluster size (both sets): ' + [3, 4, 5, 6].map(k => { const a = all.filter(t => k === 6 ? t.cl >= 6 : t.cl === k); return 'cl' + (k === 6 ? '6+' : k) + ' n' + a.length + ' ' + (a.reduce((x, t) => x + t.R, 0) / a.length).toFixed(2); }).join(' | '));
console.log('\n=== bigger clusters are the best hours, so size UP with the cluster instead of capping the hour (both sets) ===');
const both = all.filter(B);
show('2% each (reference)', both, each(0.02));
show('cl4-5 1.5%, cl6+ 3%', both, g => g.map(t => t.cl >= 6 ? 0.03 : 0.015));
show('cl4-5 2%, cl6+ 3%', both, g => g.map(t => t.cl >= 6 ? 0.03 : 0.02));
show('cl4-5 1%, cl6+ 2%', both, g => g.map(t => t.cl >= 6 ? 0.02 : 0.01));
for (const [lab, a] of [['old half', both.filter(t => t.t < MID)], ['new half', both.filter(t => t.t >= MID)]]) console.log(lab + ': ' + [4, 5, 6].map(k => { const x = a.filter(t => k === 6 ? t.cl >= 6 : t.cl === k); return 'cl' + (k === 6 ? '6+' : k) + ' n' + x.length + ' R ' + (x.reduce((s, t) => s + t.R, 0) / x.length).toFixed(2) + ' WR ' + Math.round(x.filter(t => t.R > 0).length / x.length * 100) + '%'; }).join(' | '));
