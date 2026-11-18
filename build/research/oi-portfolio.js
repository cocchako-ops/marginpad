// 2026-11-18 (owner: "voleo bih da odradis ovu simulaciju"): the OI-surge SHORT as a real account, 2024-01 -> now, 80 coins.
// Every 4h: the coins in the top 10% of 24h open-interest change (contracts) get a SHORT at the next 4h open (one per coin
// per 24h), stop 8% above on 4h highs, out after 48h. Size = RISK% of equity lost at the stop. At most MAXOPEN at once.
// Equity is marked to market every 4h (drawdown is real, not only at exits). 0.15% costs per round trip on the notional.
// Then: correlation with the Premium v2 signal month by month (build/signal-gate/tr-chan.json + tr-alt.json, cl>=4).
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'arch', 'oi4h.json'), 'utf8'));
const C = Object.keys(D), H4 = 4 * 3600000, STOP = 8, HOLD = 12, COST = 0.0015;
const P = {}; for (const s of C) { const k = new Map(), o = new Map(); D[s].k.forEach(x => k.set(x[0], x)); D[s].oi.forEach(x => o.set(x[0], x[1])); P[s] = { k, o }; }
const times = [...new Set(C.flatMap(s => D[s].k.map(x => x[0])))].sort((a, b) => a - b);
function signals(filter) { // t -> [sym]
  const out = new Map(), last = {};
  for (const t of times) {
    const rows = []; for (const s of C) { const k0 = P[s].k.get(t), k1 = P[s].k.get(t - 6 * H4), o0 = P[s].o.get(t), o1 = P[s].o.get(t - 6 * H4); if (!k0 || !k1 || !(o0 > 0) || !(o1 > 0)) continue; rows.push({ s, oi: o0 / o1 - 1, px: k0[4] / k1[4] - 1 }); }
    if (rows.length < 30) continue; rows.sort((a, b) => b.oi - a.oi); const top = rows.slice(0, Math.floor(rows.length / 10)).filter(filter);
    const L = []; for (const x of top) { if (last[x.s] && t - last[x.s] < 6 * H4) continue; last[x.s] = t; L.push(x.s); } if (L.length) out.set(t, L);
  }
  return out;
}
function run(sig, RISK, MAXOPEN, hedge) {
  let eq = 1, peak = 1, dd = 0; const open = []; const monthly = {}; let trades = 0, wins = 0, skipped = 0, sumOpen = 0, bars = 0, maxGross = 0;
  const btc = P['BTC'].k;
  for (const t of times) {
    // manage: stops and time exits on bar t (the bar that starts at t)
    for (let i = open.length - 1; i >= 0; i--) { const p = open[i], b = P[p.s].k.get(t); if (!b) continue; let x = null;
      if (b[2] >= p.e * (1 + STOP / 100)) x = p.e * (1 + STOP / 100); else if (t >= p.t0 + HOLD * H4) x = b[1];
      if (x != null) { let r = (p.e / x - 1) - COST; if (hedge) { const bb = btc.get(t); if (bb) r += (bb[1] / p.be - 1) - COST; } const pnl = p.n * r; eq += pnl; trades++; if (pnl > 0) wins++; const m = new Date(t).toISOString().slice(0, 7); monthly[m] = (monthly[m] || 0) + pnl; open.splice(i, 1); } }
    // enter the signals of the PREVIOUS bar at this bar's open
    const L = sig.get(t - H4) || [];
    for (const s of L) { if (open.length >= MAXOPEN) { skipped++; continue; } if (open.some(p => p.s === s)) continue; const b = P[s].k.get(t), bb = btc.get(t); if (!b || !bb) continue; open.push({ s, e: b[1], t0: t, be: bb[1], n: eq * (RISK / 100) / (STOP / 100) }); }
    // mark to market at this bar's close
    let mtm = 0; for (const p of open) { const b = P[p.s].k.get(t); if (b) mtm += p.n * (p.e / b[4] - 1); }
    const v = eq + mtm; peak = Math.max(peak, v); dd = Math.max(dd, 1 - v / peak); sumOpen += open.length; bars++; maxGross = Math.max(maxGross, open.reduce((a, p) => a + p.n, 0) / Math.max(v, 1e-9));
  }
  const ms = Object.keys(monthly).sort(), months = ms.length, startEq = 1;
  const mret = []; let e2 = 1; for (const m of ms) { mret.push(monthly[m] / e2 * 100); e2 += monthly[m]; }
  return { eq, dd, trades, wins, skipped, avgOpen: sumOpen / bars, maxGross, months, perMonth: (Math.pow(eq, 1 / months) - 1) * 100, worst: Math.min(...mret), posMonths: mret.filter(x => x > 0).length, mret: Object.fromEntries(ms.map((m, i) => [m, mret[i]])) };
}
const days = (times[times.length - 1] - times[0]) / 86400000;
const S = { 'OI up most (any price)': signals(() => true), 'OI up most & price UP': signals(x => x.px > 0) };
console.log('80 coins, ' + new Date(times[0]).toISOString().slice(0, 10) + ' -> ' + new Date(times[times.length - 1]).toISOString().slice(0, 10) + ', stop 8%, hold 48h, costs 0.15%');
let keep = null;
for (const [name, sig] of Object.entries(S)) {
  console.log('\n=== ' + name + ' -> SHORT ===');
  for (const [risk, maxo] of [[0.5, 10], [1, 10], [1, 20], [2, 10]]) for (const hedge of [false, true]) {
    const r = run(sig, risk, maxo, hedge);
    console.log(('risk ' + risk + '% max ' + maxo + ' open' + (hedge ? ' +BTC hedge' : '')).padEnd(32) + '$1,000 -> $' + Math.round(r.eq * 1000).toLocaleString('en-US').padStart(7) + ' | /month ' + r.perMonth.toFixed(1).padStart(5) + '% | worst drop ' + (r.dd * 100).toFixed(0).padStart(2) + '% | worst month ' + r.worst.toFixed(1) + '% | months up ' + r.posMonths + '/' + r.months + ' | trades ' + r.trades + ' (' + (r.trades / days).toFixed(1) + '/day) win ' + Math.round(r.wins / r.trades * 100) + '% | open avg ' + r.avgOpen.toFixed(1) + ', max exposure ' + r.maxGross.toFixed(2) + 'x | skipped ' + r.skipped);
    if (name.startsWith('OI up most (any') && risk === 1 && maxo === 10 && !hedge) keep = r;
  }
}
// correlation with Premium v2, month by month
try {
  const load = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'signal-gate', f), 'utf8'));
  const pv = load('tr-chan.json').concat(load('tr-alt.json')).filter(t => t.cl >= 4);
  const pm = {}; for (const t of pv) { const m = new Date(t.t * 1000).toISOString().slice(0, 7); pm[m] = (pm[m] || 0) + t.R * 2; } // % at 2% risk, simple sum
  const ms = Object.keys(keep.mret).filter(m => pm[m] != null);
  const a = ms.map(m => keep.mret[m]), b = ms.map(m => pm[m]); const ma = a.reduce((x, y) => x + y, 0) / a.length, mb = b.reduce((x, y) => x + y, 0) / b.length;
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0), va = a.reduce((s, x) => s + (x - ma) ** 2, 0), vb = b.reduce((s, x) => s + (x - mb) ** 2, 0);
  console.log('\nPremium v2 vs OI short, month by month (' + ms.length + ' months): correlation ' + (cov / Math.sqrt(va * vb)).toFixed(2) + ' | both down in the same month: ' + ms.filter((m, i) => a[i] < 0 && b[i] < 0).length + ' | OI short down: ' + a.filter(x => x < 0).length + ', Premium down: ' + b.filter(x => x < 0).length);
  const comb = ms.map((m, i) => (a[i] + b[i]) / 2); console.log('half in each, per month: mean ' + (comb.reduce((x, y) => x + y, 0) / comb.length).toFixed(2) + '%, months down ' + comb.filter(x => x < 0).length + '/' + comb.length + ', worst month ' + Math.min(...comb).toFixed(1) + '%');
} catch (e) { console.log('premium comparison skipped: ' + e.message); }
