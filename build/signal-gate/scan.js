const { simulate } = require('./backtest.js');
const base = { slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' };
const T = simulate(base).filter(t => t.f);
// cluster size: signals in the same hour
const hh = {}; T.forEach(t => hh[t.t] = (hh[t.t] || 0) + 1); T.forEach(t => t.f.cl = hh[t.t]);
// previous signal on the same coin: was it a loss?
const byC = {}; T.forEach(t => (byC[t.c] = byC[t.c] || []).push(t)); Object.values(byC).forEach(a => { a.sort((x, y) => x.t - y.t); a.forEach((t, i) => t.f.prevLoss = i ? (a[i - 1].R < 0 ? 1 : 0) : 0); });
const OOS = Date.UTC(2026, 4, 15) / 1000, LIVE = Date.UTC(2026, 6, 24) / 1000;
const good = t => t.R > 0, bad = t => t.tag === 'loss';
function seg(a, keep) { const k = a.filter(keep); const g0 = a.filter(good).length, b0 = a.filter(bad).length, g1 = k.filter(good).length, b1 = k.filter(bad).length; const avg = k.length ? k.reduce((s, t) => s + t.R, 0) / k.length : 0; return { n: k.length, gKeep: g0 ? g1 / g0 : 0, bCut: b0 ? 1 - b1 / b0 : 0, avg, sum: k.reduce((s, t) => s + t.R, 0) }; }
const pct = v => String(Math.round(v * 100)).padStart(3) + '%';
function row(label, keep) {
  const A = seg(T, keep), I = seg(T.filter(t => t.t < OOS), keep), O = seg(T.filter(t => t.t >= OOS), keep), L = seg(T.filter(t => t.t >= LIVE), keep);
  const f = s => 'n' + String(s.n).padStart(3) + ' win' + pct(s.gKeep) + ' loss-' + pct(s.bCut) + ' R' + (s.avg >= 0 ? '+' : '') + s.avg.toFixed(2);
  const robust = I.bCut > I.gKeep - 1 + 0.10 && O.bCut > O.gKeep - 1 + 0.10; // cuts losses at least 10 points more than wins in BOTH halves
  console.log((robust ? '* ' : '  ') + label.padEnd(34) + '| ALL ' + f(A) + ' | IS ' + f(I) + ' | OOS ' + f(O) + ' | LIVE ' + f(L));
  return { label, keep, A, I, O, L, robust };
}
console.log('baseline: n', T.length, 'wins', T.filter(good).length, 'losses', T.filter(bad).length, 'avgR', (T.reduce((s, t) => s + t.R, 0) / T.length).toFixed(3));
console.log('columns: win% = share of winners KEPT, loss-% = share of losers REMOVED, R = avg R of what remains. * = cuts losses >=10 pts more than wins in BOTH halves');
const R = [];
R.push(row('longs only', t => t.long));
R.push(row('shorts only', t => !t.long));
for (const c of ['BTC', 'XRP', 'ETH', 'TRX', 'HBAR', 'BNB']) R.push(row('drop ' + c, t => t.c !== c));
for (const v of [0.5, 0.6, 0.7, 0.8, 1.0]) R.push(row('stop >= ' + v + '%', t => t.slPct >= v));
for (const v of [15, 18, 20, 22, 25]) R.push(row('ADX >= ' + v, t => t.f.adx >= v));
R.push(row('ADX <= 30', t => t.f.adx <= 30));
for (const v of [1.5, 2, 3]) R.push(row('vol >= ' + v + 'x', t => t.f.volR >= v));
R.push(row('vol <= 3x', t => t.f.volR <= 3));
R.push(row('daily aligned', t => t.f.dd === 1));
R.push(row('daily opposed', t => t.f.dd === 0));
for (const v of [6, 12, 24, 48]) R.push(row('gap >= ' + v + 'h', t => t.f.gap >= v));
for (const v of [24, 48]) R.push(row('gap <= ' + v + 'h', t => t.f.gap <= v));
for (const v of [3.3, 3.6, 4]) R.push(row('ext <= ' + v + ' ATR', t => t.f.ext <= v));
for (const v of [1, 1.5, 2]) R.push(row('flip body <= ' + v + ' ATR', t => t.f.body <= v));
for (const v of [1, 1.5]) R.push(row('flip body >= ' + v + ' ATR', t => t.f.body >= v));
for (const v of [1.5, 2.5, 3.5]) R.push(row('run6 <= ' + v + ' ATR', t => t.f.run6 <= v));
for (const v of [0, 2, 4]) R.push(row('run24 >= ' + v + ' ATR', t => t.f.run24 >= v));
for (const v of [0, 2, 5]) R.push(row('run24 <= ' + v + ' ATR', t => t.f.run24 <= v));
R.push(row('above/below EMA200 (dir)', t => t.f.ema200 > 0));
R.push(row('within 3 ATR of EMA200', t => Math.abs(t.f.ema200) <= 3));
R.push(row('EMA200 dist >= 3 ATR', t => t.f.ema200 >= 3));
for (const v of [65, 70]) R.push(row('RSI not beyond ' + v, t => t.long ? t.f.rsi <= v : t.f.rsi >= 100 - v));
R.push(row('RSI beyond 60', t => t.long ? t.f.rsi >= 60 : t.f.rsi <= 40));
R.push(row('no weekend', t => t.f.dow !== 0 && t.f.dow !== 6));
R.push(row('weekend only', t => t.f.dow === 0 || t.f.dow === 6));
R.push(row('no Monday', t => t.f.dow !== 1));
R.push(row('hours 00-07', t => t.f.hour < 8));
R.push(row('hours 08-13', t => t.f.hour >= 8 && t.f.hour < 14));
R.push(row('hours 14-19', t => t.f.hour >= 14 && t.f.hour < 20));
R.push(row('not 20-23', t => t.f.hour < 20));
R.push(row('not 08-13', t => !(t.f.hour >= 8 && t.f.hour < 14)));
R.push(row('cluster size 1', t => t.f.cl === 1));
R.push(row('cluster size >= 2', t => t.f.cl >= 2));
R.push(row('cluster size >= 3', t => t.f.cl >= 3));
R.push(row('prev signal on coin was loss', t => t.f.prevLoss === 1));
R.push(row('prev signal on coin was win', t => t.f.prevLoss === 0));
for (const v of [0.4, 0.6, 0.8]) R.push(row('atr% >= ' + v, t => t.f.atrPct >= v));
for (const v of [0.8, 1.2]) R.push(row('atr% <= ' + v, t => t.f.atrPct <= v));
console.log('\n=== robust singles ==='); R.filter(r => r.robust).forEach(r => console.log(r.label));
require('fs').writeFileSync(__dirname + '/scan-trades.json', JSON.stringify(T));
