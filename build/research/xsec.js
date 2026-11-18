// 2026-11-18: cross-sectional momentum and reversal over 80 coins, 2024-2026 (oi4h.json candles). Every 24h: rank coins by their
// return over the lookback; the top / bottom 10% -> trade, hold, market-neutral (minus the average coin), net of 0.15%.
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'arch', 'oi4h.json'), 'utf8'));
const C = Object.keys(D), H4 = 4 * 3600000;
const K = {}; for (const s of C) { const m = new Map(); D[s].k.forEach(x => m.set(x[0], x)); K[s] = m; }
const times = [...new Set(C.flatMap(s => D[s].k.map(x => x[0])))].sort((a, b) => a - b).filter(t => new Date(t).getUTCHours() === 0);
const st = (xs) => { const n = xs.length, mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / (n - 1)); return { n, mu, t: mu / (sd / Math.sqrt(n)), hit: xs.filter(v => v > 0).length / n }; };
for (const [lbD, holdD] of [[1, 1], [3, 3], [7, 7], [14, 7], [30, 7]]) {
  const res = { 'winners -> LONG': [], 'losers -> LONG (bounce)': [] };
  for (let ti = 0; ti < times.length; ti += holdD) { const t = times[ti];
    const rows = []; for (const s of C) { const a = K[s].get(t), b = K[s].get(t - lbD * 6 * H4), e = K[s].get(t + H4), x = K[s].get(t + holdD * 6 * H4); if (!a || !b || !e || !x) continue; rows.push({ s, lb: a[4] / b[4] - 1, f: (x[4] / e[1] - 1) * 100 }); }
    if (rows.length < 30) continue; const mk = rows.reduce((q, r) => q + r.f, 0) / rows.length; rows.sort((a, b) => b.lb - a.lb); const q = Math.floor(rows.length / 10);
    const w = rows.slice(0, q).reduce((s, r) => s + r.f - mk, 0) / q, l = rows.slice(-q).reduce((s, r) => s + r.f - mk, 0) / q;
    res['winners -> LONG'].push({ t, v: w - 0.15 }); res['losers -> LONG (bounce)'].push({ t, v: l - 0.15 });
  }
  for (const [k, xs] of Object.entries(res)) { const a = st(xs.map(x => x.v)); const yrs = {}; xs.forEach(x => { const y = new Date(x.t).getUTCFullYear(); (yrs[y] = yrs[y] || []).push(x.v); });
    console.log(('look ' + lbD + 'd hold ' + holdD + 'd  ' + k).padEnd(44) + 'n' + a.n + ' per period ' + (a.mu >= 0 ? '+' : '') + a.mu.toFixed(2) + '% t' + a.t.toFixed(1) + ' hit ' + Math.round(a.hit * 100) + '% | ' + Object.keys(yrs).map(y => y + ' ' + st(yrs[y]).mu.toFixed(2)).join('  ')); }
}
