// 2026-11-18: does the same-direction cluster (>=3 coins flipping one way in one hour) beat the 8-point gate, alone or combined?
const { P, COINS } = require('./backtest.js');
const T = JSON.parse(require('fs').readFileSync(__dirname + '/scan-trades.json', 'utf8'));
const flips = {}; for (const c of COINS) { const { b, st } = P[c]; for (let i = 1; i < b.length; i++) if (st.dir[i] != null && st.dir[i - 1] != null && st.dir[i] !== st.dir[i - 1]) { const k = b[i].time; flips[k] = flips[k] || { 1: 0, '-1': 0 }; flips[k][st.dir[i]]++; } }
T.forEach(t => { const f = flips[t.t] || { 1: 0, '-1': 0 }; t.f.rawSame = f[t.long ? 1 : -1]; });
const OOS = Date.UTC(2026, 4, 15) / 1000, LIVE = Date.UTC(2026, 6, 24) / 1000;
const C = { adx18: t => t.f.adx >= 18, vol2: t => t.f.volR >= 2, noWknd: t => t.f.dow !== 0 && t.f.dow !== 6, hr20: t => t.f.hour < 20, cl2: t => t.f.rawSame >= 2, ema3: t => Math.abs(t.f.ema200) < 3 || t.f.ema200 == null, atr06: t => t.f.atrPct >= 0.6, long: t => t.long };
const score = t => Object.keys(C).reduce((s, k) => s + (C[k](t) ? 1 : 0), 0);
const st = (a) => { const w = a.filter(t => t.R > 0).length, l = a.filter(t => t.tag === 'loss').length, R = a.reduce((s, t) => s + t.R, 0); return 'n' + String(a.length).padStart(4) + ' WR ' + String(a.length ? Math.round(w / a.length * 100) : 0).padStart(3) + '% R/sig ' + (a.length ? (R / a.length >= 0 ? '+' : '') + (R / a.length).toFixed(2) : '  -') + ' sumR ' + (R >= 0 ? '+' : '') + R.toFixed(1); };
const row = (lab, keep) => { const k = T.filter(keep); console.log(lab.padEnd(40) + '| ALL ' + st(k) + ' | IS ' + st(k.filter(t => t.t < OOS)) + ' | OOS ' + st(k.filter(t => t.t >= OOS)) + ' | LIVE ' + st(k.filter(t => t.t >= LIVE))); };
console.log('WR = share of signals with R > 0 (TP1 reached, runner be/tp2) ; months covered', new Date(T[0].t * 1000).toISOString().slice(0, 7), '->', new Date(T[T.length - 1].t * 1000).toISOString().slice(0, 7));
row('every confirmed signal', () => true);
row('current gate: score >= 4 of 8', t => score(t) >= 4);
row('cluster >= 3 (same dir)', t => t.f.rawSame >= 3);
row('cluster >= 3 AND score >= 4', t => t.f.rawSame >= 3 && score(t) >= 4);
row('cluster >= 3 AND no weekend', t => t.f.rawSame >= 3 && C.noWknd(t));
row('cluster >= 3 AND atr >= 0.6%', t => t.f.rawSame >= 3 && C.atr06(t));
row('cluster >= 4', t => t.f.rawSame >= 4);
row('score>=4 OR cluster>=3', t => score(t) >= 4 || t.f.rawSame >= 3);
row('score >= 5', t => score(t) >= 5);
row('score >= 4, cluster>=3 counts double', t => score(t) + (t.f.rawSame >= 3 ? 1 : 0) >= 5);
const months = {}; T.forEach(t => { const m = new Date(t.t * 1000).toISOString().slice(0, 7); (months[m] = months[m] || []).push(t); });
console.log('\nmonthly: gate vs cluster>=3');
for (const [m, a] of Object.entries(months)) console.log(m, 'gate', st(a.filter(t => score(t) >= 4)), '| cl3', st(a.filter(t => t.f.rawSame >= 3)));
