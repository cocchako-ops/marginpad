// 2026-11-18 (owner: "strategija za likvidacionu kaskadu ... da cena nastavi da pada ako pokrene kaskadu").
// 90 days, 18 coins, 5-minute candles + 5-minute liquidations (liq90.json). A cascade START = a 5m bar whose long (or short)
// liquidations are >= X times that coin's trailing-24h average 5m bar, after a quiet previous bar (so it is the beginning,
// not the middle). Trade WITH the cascade (short a long-cascade) at the NEXT bar's open; exit after N minutes, or at a stop.
// Compared with the same trade on random bars. Costs 0.10% round trip (taker both sides) taken off.
const D = JSON.parse(require('fs').readFileSync(__dirname + '/liq90.json', 'utf8'));
const COST = 0.10;
const st = (xs) => { const n = xs.length; if (!n) return null; const s = xs.slice().sort((a, b) => a - b), mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, n - 1)); return { n, mu, med: s[n >> 1], t: sd ? mu / (sd / Math.sqrt(n)) : 0, hit: xs.filter(v => v > 0).length / n }; };
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(3);
const T0 = Math.min(...Object.values(D).map(d => d.k5.length ? d.k5[0].time : Infinity)), MID = T0 + 45 * 86400;
const ev = { L: {}, S: {} };
const prep = {};
for (const [c, d] of Object.entries(D)) {
  const k = d.k5; if (!k.length) continue; const L = new Map(d.liq.map(b => [Math.floor(b.t / 1000), b]));
  const lo = k.map(b => (L.get(b.time) || {}).long || 0), sh = k.map(b => (L.get(b.time) || {}).short || 0);
  prep[c] = k;
  for (let i = 300; i < k.length - 14; i++) {
    let a = 0; for (let j = i - 288; j < i; j++) a += lo[j] + sh[j]; a /= 288; if (!(a > 0)) continue;
    for (const X of [5, 10, 20]) {
      if (lo[i] >= X * a && lo[i] > 3 * sh[i] && lo[i - 1] < 2 * a) (ev.L[X] = ev.L[X] || []).push({ c, i, dir: -1 });
      if (sh[i] >= X * a && sh[i] > 3 * lo[i] && sh[i - 1] < 2 * a) (ev.S[X] = ev.S[X] || []).push({ c, i, dir: 1 });
    }
  }
}
// one trade: enter at the open of bar i+1 in direction dir, hold n bars (5m each) or until the stop (% adverse, on highs/lows)
function trade(c, i, dir, n, stop) {
  const k = prep[c], e = k[i + 1].open; let x = null;
  for (let j = i + 1; j <= Math.min(k.length - 1, i + n); j++) {
    const b = k[j];
    if (stop && (dir < 0 ? b.high >= e * (1 + stop / 100) : b.low <= e * (1 - stop / 100))) { x = dir < 0 ? e * (1 + stop / 100) : e * (1 - stop / 100); break; }
    x = b.close;
  }
  return (x / e - 1) * 100 * dir - COST;
}
const rnd = []; for (const c of Object.keys(prep)) for (let r = 0; r < 3000; r++) { const i = 300 + Math.floor(Math.random() * (prep[c].length - 320)); rnd.push({ c, i }); }
for (const side of ['L', 'S']) {
  console.log('\n=== ' + (side === 'L' ? 'LONG liquidation cascade starts -> SHORT (ride it down)' : 'SHORT liquidation cascade starts -> LONG (ride it up)') + ' ===');
  for (const X of [5, 10, 20]) {
    const E = ev[side][X] || []; if (!E.length) continue;
    for (const n of [1, 3, 6, 12]) for (const stop of [0, 1]) {
      const r = E.map(e => ({ t: prep[e.c][e.i].time, v: trade(e.c, e.i, e.dir, n, stop) }));
      const a = st(r.map(x => x.v)), h1 = st(r.filter(x => x.t < MID).map(x => x.v)), h2 = st(r.filter(x => x.t >= MID).map(x => x.v));
      const base = st(rnd.map(q => trade(q.c, q.i, side === 'L' ? -1 : 1, n, stop)));
      console.log(('x' + X + ' hold ' + (n * 5) + 'm' + (stop ? ' stop ' + stop + '%' : '')).padEnd(24) + 'n' + String(a.n).padStart(5) + '  mean ' + f2(a.mu) + '% median ' + f2(a.med) + '% hit ' + Math.round(a.hit * 100) + '% t' + a.t.toFixed(1) + '  [1st ' + f2(h1.mu) + ' | 2nd ' + f2(h2.mu) + ']  random bars ' + f2(base.mu) + '%');
    }
  }
}
