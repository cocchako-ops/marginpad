// 2026-11-18 (owner: "da li testiranjem tih novih dobijamo iste pozitivne rezultate pre nego sto ih dodamo"): the Premium v2
// rule exactly as it runs (>=4 of the 9 core coins flipping the same way in the same hour - measured on the CORE coins via
// CLFILE=flips-majors.json - weekday, stop < 2%) on candidate coins chosen BEFORE the test by one rule (largest open
// interest, history since mid-2024). KFILE=klines-new.json CLFILE=flips-majors.json node newcoins.js
const fs = require('fs');
const { simulate, P, COINS } = require('./backtest.js');
const flips = JSON.parse(fs.readFileSync(__dirname + '/' + (process.env.CLFILE || 'flips-majors.json'), 'utf8'));
const T = simulate({ slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' }).filter(t => t.f);
T.forEach(t => { const f = flips[t.t] || { 1: 0, '-1': 0 }; t.cl = f[t.long ? 1 : -1]; t.wk = t.f.dow !== 0 && t.f.dow !== 6; });
const R = T.filter(t => t.cl >= 4 && t.wk && t.slPct < 2);
const s = (a) => { const sum = a.reduce((x, t) => x + t.R, 0), w = a.filter(t => t.R > 0).length; return 'n' + String(a.length).padStart(4) + ' WR ' + String(a.length ? Math.round(w / a.length * 100) : 0).padStart(3) + '% R/trade ' + (a.length ? ((sum / a.length >= 0 ? '+' : '') + (sum / a.length).toFixed(2)) : '  -  ') + ' sum ' + sum.toFixed(1); };
const MID = Date.UTC(2025, 5, 1) / 1000;
console.log('candidates: ' + COINS.join(' '));
console.log('ALL candidates'.padEnd(16) + s(R) + ' | to May 2025 ' + s(R.filter(t => t.t < MID)) + ' | from Jun 2025 ' + s(R.filter(t => t.t >= MID)));
const months = (Math.max(...T.map(t => t.t)) - Math.min(...T.map(t => t.t))) / 86400 / 30;
console.log('signals per month added: ' + (R.length / months).toFixed(1));
const q = {}; R.forEach(t => { const d = new Date(t.t * 1000); const k = d.getUTCFullYear() + 'Q' + (Math.floor(d.getUTCMonth() / 3) + 1); (q[k] = q[k] || []).push(t.R); });
console.log('quarters positive ' + Object.values(q).filter(a => a.reduce((x, y) => x + y, 0) > 0).length + ' / ' + Object.keys(q).length);
console.log('\nper coin (small samples - read the group line, not these):');
for (const c of COINS) { const a = R.filter(t => t.c === c); console.log('  ' + c.padEnd(7) + s(a)); }
fs.writeFileSync(__dirname + '/tr-new.json', JSON.stringify(T.filter(t => t.cl >= 3 && t.wk && t.slPct < 2).map(t => ({ c: t.c, t: t.t, R: t.R, sl: t.slPct, cl: t.cl, long: t.long }))));
