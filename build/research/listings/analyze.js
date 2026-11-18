// 2026-11-18: what a Binance announcement does to the coin's Bybit perp, minute by minute, and what a trade would have kept.
// Entry at the OPEN of the minute D minutes after the announcement's minute (D=1 = at most ~60 s late), exit after H minutes,
// direction by kind (spot / futures listing = LONG, delisting / monitoring tag = SHORT), minus BTC over the same window,
// minus COST (0.20% round trip: taker both sides + slippage at a busy moment). One row per event.
const fs = require('fs'), path = require('path');
const E = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'arch', 'bn-events.json'), 'utf8'));
const BTC = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'arch', 'bn-btc.json'), 'utf8'));
const COST = +(process.env.COST || 0.20), M = 60000;
const DIR = { spot: 1, futures: 1, delist: -1, tag: -1 };
const st = (xs) => { const n = xs.length; if (!n) return null; const s = xs.slice().sort((a, b) => a - b), mu = xs.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(xs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, n - 1)); return { n, mu, med: s[n >> 1], t: sd ? mu / (sd / Math.sqrt(n)) : 0, hit: xs.filter(v => v > 0).length / n }; };
const f = (v) => v == null ? '   -  ' : ((v >= 0 ? '+' : '') + v.toFixed(2)).padStart(6);
for (const e of E) { e.m = new Map(e.k.map(b => [b[0], b])); e.t0 = Math.floor(e.t / M) * M; }
const bar = (e, ms) => e.m.get(ms);
const btcAt = (ms) => BTC[ms];
function ret(e, D, H, stop) { // % for the trade, BTC-relative, net
  const a = bar(e, e.t0 + D * M); if (!a) return null; const ent = a[1], dir = DIR[e.kind]; let x = null;
  for (let i = 0; i < H; i++) { const b = bar(e, e.t0 + (D + i) * M); if (!b) continue;
    if (stop && (dir > 0 ? b[3] <= ent * (1 - stop / 100) : b[2] >= ent * (1 + stop / 100))) { x = dir > 0 ? ent * (1 - stop / 100) : ent * (1 + stop / 100); break; }
    x = b[4]; }
  if (x == null) return null;
  const b0 = btcAt(e.t0 + D * M - M), b1 = btcAt(e.t0 + (D + H) * M - M); const br = b0 && b1 ? (b1 / b0 - 1) * 100 : 0;
  return ((x / ent - 1) * 100 - br) * dir - COST;
}
const kinds = ['spot', 'futures', 'delist', 'tag'];
console.log('events with a Bybit perp already trading:', E.length, Object.fromEntries(kinds.map(k => [k, E.filter(e => e.kind === k).length])), '| cost ' + COST + '%');
for (const kind of kinds) {
  const K = E.filter(e => e.kind === kind); if (K.length < 5) continue;
  console.log('\n=== ' + kind.toUpperCase() + ' (' + (DIR[kind] > 0 ? 'LONG' : 'SHORT') + ') n=' + K.length + ' ===');
  // what happened before and right at the announcement (no costs): leak and the first minute
  const pre = st(K.map(e => { const a = bar(e, e.t0 - 59 * M), b = bar(e, e.t0 - M); return a && b ? (b[4] / a[1] - 1) * 100 * DIR[kind] : null; }).filter(v => v != null));
  const m0 = st(K.map(e => { const a = bar(e, e.t0); return a ? (a[4] / a[1] - 1) * 100 * DIR[kind] : null; }).filter(v => v != null));
  console.log('  hour before (no cost) mean ' + f(pre.mu) + '% | announcement minute ' + f(m0.mu) + '% median ' + f(m0.med) + '%');
  console.log('  entry late by:   hold 5m              15m                  60m                  4h                   24h');
  for (const D of [1, 2, 3, 5, 10]) {
    let line = ('  ' + D + ' min').padEnd(18);
    for (const H of [5, 15, 60, 240, 1440]) { const s = st(K.map(e => ret(e, D, H)).filter(v => v != null)); line += (s ? f(s.mu) + '/' + f(s.med) + ' ' + String(Math.round(s.hit * 100)).padStart(2) + '%' : '   -  ').padEnd(21); }
    console.log(line);
  }
  // by year, at a 2-minute delay, 60m hold
  const yrs = {}; K.forEach(e => { const v = ret(e, 2, 60); if (v != null) (yrs[new Date(e.t).getUTCFullYear()] = yrs[new Date(e.t).getUTCFullYear()] || []).push(v); });
  console.log('  by year (2 min late, 60m hold, mean/median/n): ' + Object.keys(yrs).map(y => { const s = st(yrs[y]); return y + ' ' + f(s.mu).trim() + '/' + f(s.med).trim() + ' n' + s.n; }).join('  '));
}

// ---- per year, the candidates (futures listing traded as a SHORT: the pop fades) ----
console.log('\n=== per year ===');
for (const [kind, dir, D, H] of [['futures', -1, 2, 60], ['futures', -1, 2, 1440], ['futures', -1, 5, 1440], ['delist', -1, 2, 240], ['delist', -1, 2, 1440], ['delist', -1, 5, 240], ['spot', 1, 2, 240], ['spot', 1, 3, 60]]) {
  DIR[kind] = dir; const K = E.filter(e => e.kind === kind), yrs = {};
  const vs = K.map(e => ({ y: new Date(e.t).getUTCFullYear(), v: ret(e, D, H) })).filter(x => x.v != null); vs.forEach(x => (yrs[x.y] = yrs[x.y] || []).push(x.v));
  const a = st(vs.map(x => x.v));
  console.log((kind + (dir > 0 ? ' LONG' : ' SHORT') + ' late ' + D + 'm hold ' + H + 'm').padEnd(34) + 'all ' + f(a.mu) + '/' + f(a.med) + ' hit ' + Math.round(a.hit * 100) + '% n' + a.n + ' | ' + Object.keys(yrs).map(y => { const s = st(yrs[y]); return y + ' ' + f(s.mu).trim() + '/' + f(s.med).trim() + ' hit' + Math.round(s.hit * 100) + ' n' + s.n; }).join('  '));
}

// ---- delisting short: the worst cases, a stop, and which coins ----
console.log('\n=== delisting SHORT, 2 min late, 4h hold ===');
DIR.delist = -1;
const DL = E.filter(e => e.kind === 'delist').map(e => ({ e, v: ret(e, 2, 240), v10: ret(e, 2, 240, 10), v20: ret(e, 2, 240, 20) })).filter(x => x.v != null);
for (const k of ['v', 'v10', 'v20']) { const s = st(DL.map(x => x[k])); console.log((k === 'v' ? 'no stop' : 'stop ' + k.slice(1) + '%').padEnd(10) + 'mean ' + f(s.mu) + ' median ' + f(s.med) + ' hit ' + Math.round(s.hit * 100) + '% worst ' + f(Math.min(...DL.map(x => x[k])))); }
DL.sort((a, b) => a.v - b.v);
console.log('worst 6: ' + DL.slice(0, 6).map(x => x.e.sym + ' ' + new Date(x.e.t).toISOString().slice(0, 10) + ' ' + f(x.v).trim()).join(' | '));
console.log('best 6: ' + DL.slice(-6).map(x => x.e.sym + ' ' + new Date(x.e.t).toISOString().slice(0, 10) + ' ' + f(x.v).trim()).join(' | '));
console.log('2026 events: ' + DL.filter(x => x.e.t > Date.UTC(2026, 0, 1)).map(x => x.e.sym + ' ' + f(x.v).trim()).join(', '));
