// 2026-11-18 (owner: "odradi sto vise testiranja da budemo sigurni da ima pozitivan edge"): the proposed Premium rule
// (confirmed 1h flip + >=3 coins flipping the same way in the same hour + not a weekend) against every check we can run.
// KFILE=klines-long.json (2024-2026, the 9 channel coins) or klines-alt.json (9 coins never looked at). Production indicator code.
const fs = require('fs');
const { simulate, P, COINS } = require('./backtest.js');
const T = simulate({ slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' }).filter(t => t.f);
const flips = {}; // per bar time: how many coins of THIS universe flipped each way
for (const c of COINS) { const { b, st } = P[c]; for (let i = 1; i < b.length; i++) if (st.dir[i] != null && st.dir[i - 1] != null && st.dir[i] !== st.dir[i - 1]) { const k = b[i].time; flips[k] = flips[k] || { 1: 0, '-1': 0 }; flips[k][st.dir[i]]++; } }
if (process.env.DUMPFLIPS) fs.writeFileSync(__dirname + '/' + process.env.DUMPFLIPS, JSON.stringify(flips));
if (process.env.CLFILE) { const ext = JSON.parse(fs.readFileSync(__dirname + '/' + process.env.CLFILE, 'utf8')); for (const k of Object.keys(flips)) delete flips[k]; Object.assign(flips, ext); console.log('cluster measured on ' + process.env.CLFILE); }
const cl = (t, w) => { let n = 0; for (let d = -w; d <= w; d++) { const f = flips[t.t + d * 3600]; if (f) n += f[t.long ? 1 : -1]; } return n; };
T.forEach(t => { t.cl0 = cl(t, 0); t.cl1 = cl(t, 1); t.wk = t.f.dow !== 0 && t.f.dow !== 6; });
const C = { adx18: t => t.f.adx >= 18, vol2: t => t.f.volR >= 2, noWknd: t => t.wk, hr20: t => t.f.hour < 20, cl2: t => t.cl0 >= 2, ema3: t => t.f.ema200 == null || Math.abs(t.f.ema200) < 3, atr06: t => t.f.atrPct >= 0.6, long: t => t.long };
const score = t => Object.keys(C).reduce((s, k) => s + (C[k](t) ? 1 : 0), 0);
const PROP = t => t.cl0 >= 3 && t.wk;
const mean = a => a.length ? a.reduce((s, t) => s + t.R, 0) / a.length : NaN;
function st(a, extraFee) {
  const R = a.map(t => t.R - (extraFee ? extraFee / (t.slPct / 100) : 0));
  const sum = R.reduce((x, y) => x + y, 0), w = R.filter(x => x > 0).length;
  let eq = 0, pk = 0, dd = 0, run = 0, worst = 0; a.map((t, i) => [t.t, R[i]]).sort((x, y) => x[0] - y[0]).forEach(([, r]) => { eq += r; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); run = r < 0 ? run + 1 : 0; worst = Math.max(worst, run); });
  const gw = R.filter(x => x > 0).reduce((x, y) => x + y, 0), gl = -R.filter(x => x < 0).reduce((x, y) => x + y, 0);
  return 'n' + String(a.length).padStart(4) + ' WR ' + String(a.length ? Math.round(w / a.length * 100) : 0).padStart(3) + '% R/sig ' + (a.length ? ((sum / a.length >= 0 ? '+' : '') + (sum / a.length).toFixed(2)) : '  -  ') + ' sum ' + (sum >= 0 ? '+' : '') + sum.toFixed(1).padStart(5) + ' PF ' + (gl ? (gw / gl).toFixed(2) : '-') + ' maxDD ' + dd.toFixed(1) + 'R lossRun ' + worst;
}
const sec = s => console.log('\n=== ' + s + ' ===');
const span = new Date(Math.min(...T.map(t => t.t)) * 1000).toISOString().slice(0, 10) + ' -> ' + new Date(Math.max(...T.map(t => t.t)) * 1000).toISOString().slice(0, 10);
console.log((process.env.KFILE || 'klines.json') + ' | coins ' + COINS.join(' ') + ' | ' + span + ' | fee ' + (process.env.FEE || 0.0011));
sec('the rules');
console.log('every confirmed signal          ' + st(T));
console.log('current gate (score >= 4 of 8)  ' + st(T.filter(t => score(t) >= 4)));
console.log('PROPOSAL cl>=3 & weekday        ' + st(T.filter(PROP)));
console.log('cl>=3 (any day)                 ' + st(T.filter(t => t.cl0 >= 3)));
console.log('cl>=4 & weekday                 ' + st(T.filter(t => t.cl0 >= 4 && t.wk)));
sec('PROPOSAL by year / half-year');
const per = (f) => { const g = {}; T.forEach(t => { const k = f(t); (g[k] = g[k] || []).push(t); }); return g; };
for (const [k, a] of Object.entries(per(t => { const d = new Date(t.t * 1000); return d.getUTCFullYear() + (d.getUTCMonth() < 6 ? ' H1' : ' H2'); })).sort()) console.log(k.padEnd(8) + ' all ' + st(a) + ' || PROP ' + st(a.filter(PROP)));
sec('PROPOSAL by quarter (positive quarters count)');
let pq = 0, nq = 0; for (const [k, a] of Object.entries(per(t => { const d = new Date(t.t * 1000); return d.getUTCFullYear() + ' Q' + (Math.floor(d.getUTCMonth() / 3) + 1); })).sort()) { const p = a.filter(PROP); if (p.length) { mean(p) > 0 ? pq++ : nq++; } console.log(k.padEnd(8) + ' PROP ' + st(p)); }
console.log('quarters positive ' + pq + ' / ' + (pq + nq));
sec('PROPOSAL longs vs shorts');
console.log('longs   ' + st(T.filter(t => PROP(t) && t.long))); console.log('shorts  ' + st(T.filter(t => PROP(t) && !t.long)));
sec('PROPOSAL leave one coin out (signals on that coin dropped; the cluster still counts it)');
for (const c of COINS) console.log(('without ' + c).padEnd(14) + st(T.filter(t => PROP(t) && t.c !== c)));
sec('PROPOSAL costs: extra round-trip cost on top of the 0.11% fee');
for (const x of [0, 0.0005, 0.001, 0.002]) console.log(('+' + (x * 100).toFixed(2) + '%').padEnd(8) + st(T.filter(PROP), x) + '   | current gate ' + st(T.filter(t => score(t) >= 4), x));
sec('PROPOSAL thresholds and window');
for (const k of [2, 3, 4, 5]) console.log(('cl>=' + k + ' same hour').padEnd(20) + st(T.filter(t => t.cl0 >= k && t.wk)));
for (const k of [3, 4, 5]) console.log(('cl>=' + k + ' +-1 hour').padEnd(20) + st(T.filter(t => t.cl1 >= k && t.wk)));
sec('random control: 20,000 draws of the same number of signals from all weekday signals');
const pool = T.filter(t => t.wk), P0 = T.filter(PROP), m0 = mean(P0); let ge = 0;
for (let i = 0; i < 20000; i++) { let s = 0; for (let j = 0; j < P0.length; j++) s += pool[Math.floor(Math.random() * pool.length)].R; if (s / P0.length >= m0) ge++; }
console.log('proposal mean R ' + m0.toFixed(3) + ' | weekday pool mean ' + mean(pool).toFixed(3) + ' | share of random draws at least as good: ' + (ge / 20000 * 100).toFixed(2) + '% (p-value)');
// bootstrap confidence interval of the proposal's mean R
const bs = []; for (let i = 0; i < 20000; i++) { let s = 0; for (let j = 0; j < P0.length; j++) s += P0[Math.floor(Math.random() * P0.length)].R; bs.push(s / P0.length); } bs.sort((a, b) => a - b);
console.log('bootstrap 90% interval of mean R: ' + bs[1000].toFixed(3) + ' .. ' + bs[19000].toFixed(3) + ' | chance mean <= 0: ' + (bs.filter(x => x <= 0).length / 200).toFixed(2) + '%');
