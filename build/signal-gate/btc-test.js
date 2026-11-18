// 2026-11-18: does "BTC moving the signal's way over the last 4h" (a hint from the live channel) add to the cluster rule over
// 2024-2026, on the channel coins AND on coins never looked at (cluster measured on the channel coins, CLFILE)?
const fs = require('fs');
const { simulate, P, COINS } = require('./backtest.js');
const T = simulate({ slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' }).filter(t => t.f);
let flips = {}; for (const c of COINS) { const { b, st } = P[c]; for (let i = 1; i < b.length; i++) if (st.dir[i] != null && st.dir[i - 1] != null && st.dir[i] !== st.dir[i - 1]) { const k = b[i].time; flips[k] = flips[k] || { 1: 0, '-1': 0 }; flips[k][st.dir[i]]++; } }
if (process.env.CLFILE) flips = JSON.parse(fs.readFileSync(__dirname + '/' + process.env.CLFILE, 'utf8'));
const BTC = JSON.parse(fs.readFileSync(__dirname + '/klines-long.json', 'utf8'))['60'].BTC; const bi = new Map(BTC.map((b, i) => [b.time, i]));
T.forEach(t => { const f = flips[t.t] || { 1: 0, '-1': 0 }; t.cl = f[t.long ? 1 : -1]; t.wk = t.f.dow !== 0 && t.f.dow !== 6; const i = bi.get(t.t); t.btc4 = i != null && i >= 4 ? (BTC[i].close / BTC[i - 4].close - 1) * 100 * (t.long ? 1 : -1) : null; });
const s = (a) => { const R = a.reduce((x, t) => x + t.R, 0), w = a.filter(t => t.R > 0).length; return 'n' + String(a.length).padStart(4) + ' WR ' + String(a.length ? Math.round(w / a.length * 100) : 0).padStart(3) + '% R/sig ' + (a.length ? ((R / a.length >= 0 ? '+' : '') + (R / a.length).toFixed(2)) : '-'); };
const MID = Date.UTC(2025, 5, 1) / 1000;
const row = (lab, f) => { const a = T.filter(f); console.log(lab.padEnd(44) + '| ALL ' + s(a) + ' | to May 2025 ' + s(a.filter(t => t.t < MID)) + ' | from Jun 2025 ' + s(a.filter(t => t.t >= MID))); };
console.log((process.env.KFILE || '') + (process.env.CLFILE ? ' (cluster from ' + process.env.CLFILE + ')' : ''));
row('every signal', () => true);
row('PROPOSAL cl>=3 & weekday', t => t.cl >= 3 && t.wk);
row('BTC 4h with the signal >0.5%', t => t.btc4 != null && t.btc4 > 0.5);
row('PROPOSAL & BTC with >0.5%', t => t.cl >= 3 && t.wk && t.btc4 > 0.5);
row('PROPOSAL & BTC with >0%', t => t.cl >= 3 && t.wk && t.btc4 > 0);
row('PROPOSAL & BTC against', t => t.cl >= 3 && t.wk && t.btc4 != null && t.btc4 <= 0);
row('PROPOSAL & stop < 1%', t => t.cl >= 3 && t.wk && t.slPct < 1);
row('PROPOSAL & stop >= 2%', t => t.cl >= 3 && t.wk && t.slPct >= 2);
row('PROPOSAL & BTC with >0.5% & stop < 2%', t => t.cl >= 3 && t.wk && t.btc4 > 0.5 && t.slPct < 2);
row('PROPOSAL & stop < 2%', t => t.cl >= 3 && t.wk && t.slPct < 2);
{ const P0 = T.filter(t => t.cl >= 3 && t.wk && t.slPct < 2), pool = T.filter(t => t.wk), m0 = P0.reduce((a, t) => a + t.R, 0) / P0.length; let ge = 0; for (let i = 0; i < 20000; i++) { let s = 0; for (let j = 0; j < P0.length; j++) s += pool[Math.floor(Math.random() * pool.length)].R; if (s / P0.length >= m0) ge++; }
  const days = (Math.max(...T.map(t => t.t)) - Math.min(...T.map(t => t.t))) / 86400; console.log('stop<2% rule: p-value ' + (ge / 200).toFixed(2) + '% | signals per month ' + (P0.length / days * 30).toFixed(1));
  const q = {}; P0.forEach(t => { const d = new Date(t.t * 1000); const k = d.getUTCFullYear() + 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1); (q[k] = q[k] || []).push(t.R); }); console.log('quarters positive ' + Object.values(q).filter(a => a.reduce((x, y) => x + y, 0) > 0).length + ' / ' + Object.keys(q).length); }
