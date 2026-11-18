// 2026-11-18 (owner: "da stvarno imamo nesto vrhunsko"): under the rule (>=3 majors flipping the same way, weekday,
// stop < 2%) - which exits and which extra filters hold on BOTH universes. CLFILE = cluster from the channel coins.
const fs = require('fs');
const { simulate, P, COINS } = require('./backtest.js');
let flips = {}; for (const c of COINS) { const { b, st } = P[c]; for (let i = 1; i < b.length; i++) if (st.dir[i] != null && st.dir[i - 1] != null && st.dir[i] !== st.dir[i - 1]) { const k = b[i].time; flips[k] = flips[k] || { 1: 0, '-1': 0 }; flips[k][st.dir[i]]++; } }
if (process.env.CLFILE) flips = JSON.parse(fs.readFileSync(__dirname + '/' + process.env.CLFILE, 'utf8'));
const prep = (T) => { T.forEach(t => { const f = flips[t.t] || { 1: 0, '-1': 0 }; t.cl = f[t.long ? 1 : -1]; t.opp = f[t.long ? -1 : 1]; t.wk = t.f.dow !== 0 && t.f.dow !== 6; }); return T.filter(t => t.cl >= 3 && t.wk && t.slPct < 2); };
const s = (a) => { const R = a.reduce((x, t) => x + t.R, 0), w = a.filter(t => t.R > 0).length; let eq = 0, pk = 0, dd = 0; a.slice().sort((x, y) => x.t - y.t).forEach(t => { eq += t.R; pk = Math.max(pk, eq); dd = Math.max(dd, pk - eq); }); return 'n' + String(a.length).padStart(4) + ' WR ' + String(a.length ? Math.round(w / a.length * 100) : 0).padStart(3) + '% R ' + (a.length ? ((R / a.length >= 0 ? '+' : '') + (R / a.length).toFixed(2)) : '  -  ') + ' sum ' + R.toFixed(1).padStart(5) + ' DD ' + dd.toFixed(1); };
const MID = Date.UTC(2025, 5, 1) / 1000;
const row = (lab, a) => console.log(lab.padEnd(36) + '| ' + s(a) + ' | old ' + s(a.filter(t => t.t < MID)) + ' | new ' + s(a.filter(t => t.t >= MID)));
console.log('=== exits ===');
const base = prep(simulate({ slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' }).filter(t => t.f));
row('now: stop 1.5ATR, TP1 1.5R, TP2 3R', base);
for (const [slM, tp1, tp2, ex] of [[1.5, 1, 2, 'plan'], [1.5, 1, 3, 'plan'], [1.5, 2, 4, 'plan'], [1.5, 1.5, 3, 'trail'], [1.5, 1, 3, 'trail'], [2, 1.5, 3, 'plan'], [1.2, 1.5, 3, 'plan']]) row('stop ' + slM + ' TP1 ' + tp1 + ' TP2 ' + tp2 + ' ' + ex, prep(simulate({ slM, tp1R: tp1, tp2R: tp2, exit: ex, entry: 'next' }).filter(t => t.f)));
console.log('=== extra filters on top (current exits) ===');
const F = { 'cluster >= 4': t => t.cl >= 4, 'no coin flipped the other way': t => t.opp === 0, 'ADX >= 18': t => t.f.adx >= 18, 'ADX >= 25': t => t.f.adx >= 25, 'volume >= 2x': t => t.f.volR >= 2, 'hour 12-20 UTC': t => t.f.hour >= 12 && t.f.hour < 20, 'hour < 20 UTC': t => t.f.hour < 20, 'long only': t => t.long, 'short only': t => !t.long, 'with 4h trend': t => t.f.htf === 1 || t.f.htfOk, 'price near EMA200 (<3 ATR)': t => t.f.ema200 == null || Math.abs(t.f.ema200) < 3, 'ATR >= 0.6%': t => t.f.atrPct >= 0.6 };
for (const [k, f] of Object.entries(F)) row(k, base.filter(f));
console.log('=== top tier candidates ===');
const all = simulate({ slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' }).filter(t => t.f); prep(all); const pool = all.filter(t => t.wk);
const days = (Math.max(...all.map(t => t.t)) - Math.min(...all.map(t => t.t))) / 86400;
for (const [lab, f] of [['A: cl>=3 wk stop<2%', t => true], ['B: + cluster >= 4', t => t.cl >= 4], ['C: + cluster >= 4 + volume >= 2x', t => t.cl >= 4 && t.f.volR >= 2]]) {
  const a = base.filter(f), m = a.reduce((x, t) => x + t.R, 0) / a.length; let ge = 0; for (let i = 0; i < 20000; i++) { let s2 = 0; for (let j = 0; j < a.length; j++) s2 += pool[Math.floor(Math.random() * pool.length)].R; if (s2 / a.length >= m) ge++; }
  const q = {}; a.forEach(t => { const d = new Date(t.t * 1000); const k = d.getUTCFullYear() + 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1); q[k] = (q[k] || 0) + t.R; });
  let run = 0, worst = 0; a.slice().sort((x, y) => x.t - y.t).forEach(t => { run = t.R < 0 ? run + 1 : 0; worst = Math.max(worst, run); });
  row(lab, a); console.log('   per month ' + (a.length / days * 30).toFixed(1) + ' | p ' + (ge / 200).toFixed(2) + '% | quarters + ' + Object.values(q).filter(v => v > 0).length + '/' + Object.keys(q).length + ' | worst losing run ' + worst);
}
