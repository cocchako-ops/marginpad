// 2026-11-18 (owner: "koji leverage se koristi ... nesto profitabilnije ako menjas leverage"): leverage does not change the
// edge per trade (R), only the size. This compounds the rule B trades (>=4 majors same way, weekday, stop < 2%) at a fixed
// share of the account risked per trade, and shows what the channel's suggested leverage means in that unit.
const fs = require('fs');
const { simulate, P, COINS } = require('./backtest.js');
let flips = {}; for (const c of COINS) { const { b, st } = P[c]; for (let i = 1; i < b.length; i++) if (st.dir[i] != null && st.dir[i - 1] != null && st.dir[i] !== st.dir[i - 1]) { const k = b[i].time; flips[k] = flips[k] || { 1: 0, '-1': 0 }; flips[k][st.dir[i]]++; } }
if (process.env.CLFILE) flips = JSON.parse(fs.readFileSync(__dirname + '/' + process.env.CLFILE, 'utf8'));
const T = simulate({ slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' }).filter(t => t.f);
T.forEach(t => { const f = flips[t.t] || { 1: 0, '-1': 0 }; t.cl = f[t.long ? 1 : -1]; t.wk = t.f.dow !== 0 && t.f.dow !== 6; });
const B = T.filter(t => t.cl >= 4 && t.wk && t.slPct < 2).sort((a, b) => a.t - b.t);
const months = (B[B.length - 1].t - B[0].t) / 86400 / 30;
const lev = t => Math.max(3, Math.min(20, Math.floor((100 / t.slPct) / 2.5)));
console.log('trades', B.length, 'over', months.toFixed(1), 'months | channel leverage: median ' + lev(B[Math.floor(B.length / 2)]) + 'x, range ' + Math.min(...B.map(lev)) + '-' + Math.max(...B.map(lev)) + 'x');
console.log('stop distance: median ' + B.map(t => t.slPct).sort((a, b) => a - b)[Math.floor(B.length / 2)].toFixed(2) + '%');
const run = (riskOf) => { let eq = 1, pk = 1, dd = 0; for (const t of B) { eq *= 1 + riskOf(t) * t.R; pk = Math.max(pk, eq); dd = Math.max(dd, 1 - eq / pk); } return { eq, dd }; };
const show = (lab, f) => { const r = run(f); console.log(lab.padEnd(46) + '$1,000 -> $' + Math.round(r.eq * 1000).toLocaleString('en-US').padStart(8) + ' | per month ' + ((Math.pow(r.eq, 1 / months) - 1) * 100).toFixed(1).padStart(5) + '% | worst drop ' + (r.dd * 100).toFixed(0) + '%'); };
console.log('\n=== fixed share of the account risked per trade (stop hit = that share lost) ===');
for (const p of [0.005, 0.01, 0.02, 0.03, 0.05]) show('risk ' + (p * 100) + '% per trade', () => p);
console.log('\n=== the channel\'s leverage on the WHOLE account as margin (stop hit = lev x stop% of it) ===');
show('channel leverage, 100% of account as margin', t => lev(t) * t.slPct / 100);
show('channel leverage, 10% of account as margin', t => lev(t) * t.slPct / 100 * 0.1);
if (process.env.DUMP) fs.writeFileSync(__dirname + '/' + process.env.DUMP, JSON.stringify(T.filter(t => t.cl >= 3 && t.wk && t.slPct < 2).map(t => ({ c: t.c, t: t.t, R: t.R, sl: t.slPct, cl: t.cl, long: t.long, vol: t.f.volR, adx: t.f.adx, hour: t.f.hour }))));
