// 2026-11-18: the one candidate from hunt.js over 2024-2026 (Bybit 4h open interest + candles, 80 coins):
// "OI in CONTRACTS up the most over 24h while the price fell (fresh shorts piling in)" -> SHORT, and its neighbours.
// Market-neutral (minus the average coin over the same window), entry at the next 4h open, one event per coin per 24h,
// mean AND median AND a trimmed mean (2% each tail off), per half-year, minus 0.15% costs where it says "net".
const fs = require('fs'), path = require('path');
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'arch', 'oi4h.json'), 'utf8'));
const C = Object.keys(D), H4 = 4 * 3600000;
const P = {}; for (const s of C) { const k = new Map(), o = new Map(); D[s].k.forEach(x => k.set(x[0], x)); D[s].oi.forEach(x => o.set(x[0], x[1])); P[s] = { k, o }; }
const times = [...new Set(C.flatMap(s => D[s].k.map(x => x[0])))].sort((a, b) => a - b);
const LB = +(process.env.LB || 6), HZ = (process.env.HZ || '3,6,12').split(',').map(Number);
const fwd = (s, t, h) => { const a = P[s].k.get(t + H4), b = P[s].k.get(t + h * H4); return a && b ? (b[4] / a[1] - 1) * 100 : null; };
const mcache = new Map();
const mkt = (t, h) => { const key = t + ':' + h; if (mcache.has(key)) return mcache.get(key); let s = 0, n = 0; for (const c of C) { const r = fwd(c, t, h); if (r != null && Math.abs(r) < 80) { s += r; n++; } } const v = n >= 20 ? s / n : null; mcache.set(key, v); return v; };
const rules = {
  'OI up most & price DOWN -> SHORT': (x) => x.oiR >= 0.9 && x.px < 0 ? -1 : 0,
  'OI up most & price UP -> SHORT': (x) => x.oiR >= 0.9 && x.px > 0 ? -1 : 0,
  'OI up most (any price) -> SHORT': (x) => x.oiR >= 0.9 ? -1 : 0,
  'OI up +20% & price down -> SHORT': (x) => x.oi > 0.2 && x.px < 0 ? -1 : 0,
  'OI down most & price DOWN -> LONG': (x) => x.oiR <= 0.1 && x.px < 0 ? 1 : 0,
  'OI down most (any price) -> LONG': (x) => x.oiR <= 0.1 ? 1 : 0,
};
const ev = {}; for (const r of Object.keys(rules)) ev[r] = [];
const lastEv = {};
for (const t of times) {
  const rows = [];
  for (const s of C) { const k0 = P[s].k.get(t), k1 = P[s].k.get(t - LB * H4), o0 = P[s].o.get(t), o1 = P[s].o.get(t - LB * H4); if (!k0 || !k1 || !(o0 > 0) || !(o1 > 0)) continue; rows.push({ s, oi: o0 / o1 - 1, px: k0[4] / k1[4] - 1 }); }
  if (rows.length < 30) continue;
  rows.sort((a, b) => a.oi - b.oi); rows.forEach((x, i) => { x.oiR = i / (rows.length - 1); });
  for (const [name, f] of Object.entries(rules)) for (const x of rows) { const d = f(x); if (!d) continue; const lk = name + x.s; if (lastEv[lk] && t - lastEv[lk] < 6 * H4) continue; lastEv[lk] = t; ev[name].push({ s: x.s, t, d }); }
}
const stat = (xs) => { const n = xs.length; if (!n) return null; const s = xs.slice().sort((a, b) => a - b), mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, n - 1)), cut = Math.floor(n * 0.02), tr = s.slice(cut, n - cut); return { n, mu, med: s[Math.floor(n / 2)], trim: tr.reduce((a, b) => a + b, 0) / tr.length, t: mu / (sd / Math.sqrt(n)), hit: xs.filter(v => v > 0).length / n }; };
const f2 = (v) => (v >= 0 ? '+' : '') + v.toFixed(2);
console.log('coins', C.length, '| 4h bars', times.length, '| from', new Date(times[0]).toISOString().slice(0, 10), '| lookback', LB * 4 + 'h');
for (const [name, E] of Object.entries(ev)) {
  console.log('\n=== ' + name + ' (' + E.length + ' events) ===');
  for (const h of HZ) {
    const get = (f) => E.filter(f).map(e => { const r = fwd(e.s, e.t, h), m = mkt(e.t, h); return r == null || m == null || Math.abs(r) > 80 ? null : (r - m) * e.d; }).filter(v => v != null);
    const all = stat(get(() => true)); if (!all) continue;
    let line = (h * 4 + 'h').padEnd(5) + 'n' + all.n + ' mean ' + f2(all.mu) + '% (net ' + f2(all.mu - 0.15) + '%) median ' + f2(all.med) + '% trimmed ' + f2(all.trim) + '% t' + all.t.toFixed(1) + ' hit ' + Math.round(all.hit * 100) + '% |';
    const halves = {}; E.forEach(e => { const d = new Date(e.t); halves[d.getUTCFullYear() + (d.getUTCMonth() < 6 ? 'a' : 'b')] = 1; });
    for (const hk of Object.keys(halves).sort()) { const y = +hk.slice(0, 4), a = hk.slice(4) === 'a'; const st = stat(get(e => { const d = new Date(e.t); return d.getUTCFullYear() === y && (d.getUTCMonth() < 6) === a; })); if (st) line += ' ' + hk + ' ' + f2(st.mu) + '/' + f2(st.med); }
    console.log(line);
  }
}

// ---- one question, fixed in advance: does a stop cut the squeezes that eat the shorts' small wins? ----
// SHORT at the next 4h open, stop X% above (checked on 4h highs), hold 48h, market-neutral at the exit, 0.15% costs.
console.log('\n=== with a stop (SHORT, 48h hold, stop checked on 4h highs, net of 0.15%) ===');
for (const name of ['OI up most (any price) -> SHORT', 'OI up most & price UP -> SHORT', 'OI up most & price DOWN -> SHORT']) {
  for (const stop of [3, 5, 8]) {
    const res = [];
    for (const e of ev[name]) {
      const a = P[e.s].k.get(e.t + H4); if (!a) continue; const ent = a[1]; let exit = null, bars = 12;
      for (let i = 1; i <= 12; i++) { const b = P[e.s].k.get(e.t + i * H4); if (!b) { bars = i - 1; break; } if (b[2] >= ent * (1 + stop / 100)) { exit = ent * (1 + stop / 100); bars = i; break; } exit = b[4]; }
      if (exit == null) continue; const m = mkt(e.t, Math.max(1, bars)); if (m == null) continue;
      res.push({ t: e.t, r: (ent / exit - 1) * 100 + m - 0.15 }); // short return, plus the market's move (market-neutral), minus costs
    }
    const all = stat(res.map(x => x.r)); let line = name.padEnd(36) + ' stop ' + stop + '%: n' + all.n + ' mean ' + f2(all.mu) + '% median ' + f2(all.med) + '% t' + all.t.toFixed(1) + ' hit ' + Math.round(all.hit * 100) + '% |';
    const hk = {}; res.forEach(x => { const d = new Date(x.t); const k = d.getUTCFullYear() + (d.getUTCMonth() < 6 ? 'a' : 'b'); (hk[k] = hk[k] || []).push(x.r); });
    for (const k of Object.keys(hk).sort()) line += ' ' + k + ' ' + f2(stat(hk[k]).mu);
    console.log(line);
  }
}

// ---- the same trade as a bot would place it: (1) a plain short, no hedge; (2) the short hedged with an equal BTC long ----
console.log('\n=== tradeable: plain short (no hedge) and short + equal BTC long, stop 8%, 48h, net of costs ===');
const btc = P['BTC'];
for (const name of ['OI up most (any price) -> SHORT', 'OI up most & price UP -> SHORT', 'OI up most & price DOWN -> SHORT']) {
  const raw = [], hedged = [];
  for (const e of ev[name]) {
    const a = P[e.s].k.get(e.t + H4), b0 = btc && btc.k.get(e.t + H4); if (!a || !b0) continue; const ent = a[1]; let exit = null, bars = 12;
    for (let i = 1; i <= 12; i++) { const b = P[e.s].k.get(e.t + i * H4); if (!b) { bars = i - 1; break; } if (b[2] >= ent * 1.08) { exit = ent * 1.08; bars = i; break; } exit = b[4]; }
    const bx = btc.k.get(e.t + Math.max(1, bars) * H4); if (exit == null || !bx) continue;
    const sr = (ent / exit - 1) * 100, br = (bx[4] / b0[1] - 1) * 100;
    raw.push({ t: e.t, r: sr - 0.15 }); hedged.push({ t: e.t, r: sr + br - 0.30 });
  }
  for (const [lab, res] of [['plain short', raw], ['short + BTC long', hedged]]) {
    const all = stat(res.map(x => x.r)); let line = (name + ' ' + lab).padEnd(52) + ' n' + all.n + ' mean ' + f2(all.mu) + '% median ' + f2(all.med) + '% t' + all.t.toFixed(1) + ' hit ' + Math.round(all.hit * 100) + '% |';
    const hk = {}; res.forEach(x => { const d = new Date(x.t); const k = d.getUTCFullYear() + (d.getUTCMonth() < 6 ? 'a' : 'b'); (hk[k] = hk[k] || []).push(x.r); });
    for (const k of Object.keys(hk).sort()) line += ' ' + k + ' ' + f2(stat(hk[k]).mu);
    console.log(line);
  }
}
