// 2026-11-18 (owner: "da li ovo sto imamo mozes da iskoristis da napravimo novu strategiju ... da li negde ima prostora").
// Event studies over OUR archived data. Every result is MARKET-NEUTRAL: a coin's forward return minus the average forward return
// of all coins over the same hours, so a bull or bear stretch cannot pass for an edge (the regime trap of 2026-10-16). Entry at
// the NEXT hour's open. Reported per half of the period, with a t-stat; an edge must show in BOTH halves and beat ~0.15% costs.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const A = path.join(__dirname, 'arch');
const K = JSON.parse(fs.readFileSync(path.join(A, 'k1h.json'), 'utf8'));
const H = 3600000;
const idx = {}; for (const s of Object.keys(K)) { const m = new Map(); K[s].forEach((k, i) => m.set(k[0], i)); idx[s] = m; }
const hourOf = (t) => Math.floor(t / H) * H;
// forward return from the open of hour (t+1h) to the close of hour (t+h) - in %
function fwd(s, t, h) { const a = K[s], i = idx[s] && idx[s].get(hourOf(t) + H); if (i == null || i + h - 1 >= a.length) return null; return (a[i + h - 1][4] / a[i][1] - 1) * 100; }
// the market's average forward return over the same window (all coins with data)
const mktCache = new Map();
function mkt(t, h) { const k = hourOf(t) + ':' + h; if (mktCache.has(k)) return mktCache.get(k); let s = 0, n = 0; for (const c of Object.keys(K)) { const r = fwd(c, t, h); if (r != null && Math.abs(r) < 60) { s += r; n++; } } const v = n > 20 ? s / n : null; mktCache.set(k, v); return v; }
function study(name, events, horizons) { // events: [{s, t, dir:+1|-1}]
  const T = events.map(e => e.t).sort((a, b) => a - b); if (!T.length) { console.log(name.padEnd(54) + 'no events'); return; }
  const mid = T[Math.floor(T.length / 2)];
  const line = [];
  for (const h of horizons) {
    const part = (f) => { const x = []; for (const e of events.filter(f)) { const r = fwd(e.s, e.t, h), m = mkt(e.t, h); if (r == null || m == null || Math.abs(r) > 60) continue; x.push((r - m) * e.dir); } const n = x.length; if (!n) return { n: 0 }; const mu = x.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(x.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, n - 1)); return { n, mu, t: sd ? mu / (sd / Math.sqrt(n)) : 0, hit: x.filter(v => v > 0).length / n }; };
    const all = part(() => true), a = part(e => e.t < mid), b = part(e => e.t >= mid);
    const f = (p) => p.n ? (p.mu >= 0 ? '+' : '') + p.mu.toFixed(2) + '% t' + p.t.toFixed(1) : '-';
    line.push(h + 'h: n' + all.n + ' ' + f(all) + ' hit ' + (all.n ? Math.round(all.hit * 100) : 0) + '% [' + f(a) + ' | ' + f(b) + ']');
  }
  console.log(name.padEnd(54) + line.join('   '));
}
const csvDays = (ds) => fs.readdirSync(path.join(A, ds)).sort().map(f => zlib.gunzipSync(fs.readFileSync(path.join(A, ds, f))).toString().trim().split('\n').slice(1).map(l => l.split(',')));
const HZ = [4, 24];
const sym = (s) => String(s).toUpperCase().replace(/^1000+/, '').replace(/^XYZ:/, '');
const ok = (s) => !!K[s];

// ================= A. LIQUIDATIONS (117 days, every venue) =================
console.log('\n=== A. liquidations: a coin\'s hour of heavy one-sided liquidation, vs its own 7-day normal ===');
const liqH = {}; // sym -> Map(hour -> [long, short])
for (const day of csvDays('liquidations')) for (const r of day) { const s = sym(r[2]); if (!ok(s)) continue; const h = hourOf(+r[0]), u = +r[6]; if (!(u > 0) || u > 5e7) continue; const m = liqH[s] || (liqH[s] = new Map()); const v = m.get(h) || [0, 0]; if (r[3] === 'long_liquidated') v[0] += u; else v[1] += u; m.set(h, v); }
const evLL = [], evSS = [], evLL10 = [], evSS10 = [];
for (const s of Object.keys(liqH)) {
  const m = liqH[s], hs = [...m.keys()].sort((a, b) => a - b);
  for (const h of hs) {
    let tot = 0, n = 0; for (let k = 1; k <= 168; k++) { const v = m.get(h - k * H); if (v) tot += v[0] + v[1]; n++; } const norm = tot / n; if (!(norm > 0)) continue;
    const [L, S] = m.get(h);
    if (L > 5 * norm && L > 3 * S) evLL.push({ s, t: h, dir: 1 }); if (L > 10 * norm && L > 3 * S) evLL10.push({ s, t: h, dir: 1 });
    if (S > 5 * norm && S > 3 * L) evSS.push({ s, t: h, dir: -1 }); if (S > 10 * norm && S > 3 * L) evSS10.push({ s, t: h, dir: -1 });
  }
}
study('longs flushed 5x normal -> LONG (bounce)', evLL, HZ);
study('longs flushed 10x normal -> LONG (bounce)', evLL10, HZ);
study('shorts squeezed 5x normal -> SHORT (fade)', evSS, HZ);
study('shorts squeezed 10x normal -> SHORT (fade)', evSS10, HZ);

// ================= B/C. FUNDING + OPEN INTEREST (hourly, 22 days, every Bybit perp) =================
console.log('\n=== B. funding (cross-section each hour: the most and least crowded coins) ===');
const fo = {}; for (const day of csvDays('funding_oi')) for (const r of day) { const s = sym(r[1]); if (!ok(s)) continue; const h = hourOf(+r[0]); (fo[h] || (fo[h] = {}))[s] = { oi: +r[2], f: +r[3] }; }
const hours = Object.keys(fo).map(Number).sort((a, b) => a - b);
const evFhi = [], evFlo = [], evOIup = [], evOIdn = [], evOIupPdn = [], evOIdnPdn = [];
for (const h of hours) {
  if ((h / H) % 4) continue; // every 4th hour: neighbouring hours are the same reading
  const rows = Object.entries(fo[h]).filter(([s, v]) => isFinite(v.f));
  if (rows.length < 40) continue;
  rows.sort((a, b) => b[1].f - a[1].f); const k = Math.max(3, Math.floor(rows.length / 10));
  rows.slice(0, k).forEach(([s]) => evFhi.push({ s, t: h, dir: -1 })); rows.slice(-k).forEach(([s]) => evFlo.push({ s, t: h, dir: 1 }));
  const prev = fo[h - 24 * H]; if (!prev) continue;
  const ch = []; for (const [s, v] of rows) { const p = prev[s]; const a = K[s], i0 = idx[s] && idx[s].get(h), i1 = idx[s] && idx[s].get(h - 24 * H); if (!p || !(p.oi > 0) || i0 == null || i1 == null) continue; const px = a[i0][4] / a[i1][4] - 1, oi = v.oi / p.oi - 1; ch.push({ s, c: (1 + oi) / (1 + px) - 1, px }); } // contracts, not dollars
  if (ch.length < 40) continue; ch.sort((a, b) => b.c - a.c); const q = Math.floor(ch.length / 10);
  ch.slice(0, q).forEach(x => { evOIup.push({ s: x.s, t: h, dir: 1 }); if (x.px < 0) evOIupPdn.push({ s: x.s, t: h, dir: -1 }); });
  ch.slice(-q).forEach(x => { evOIdn.push({ s: x.s, t: h, dir: 1 }); if (x.px < 0) evOIdnPdn.push({ s: x.s, t: h, dir: 1 }); });
}
study('highest funding -> SHORT', evFhi, HZ);
study('lowest funding -> LONG', evFlo, HZ);
console.log('\n=== C. open interest in contracts, 24h change (cross-section) ===');
study('OI surged most -> LONG', evOIup, HZ);
study('OI surged + price fell (fresh shorts) -> SHORT', evOIupPdn, HZ);
study('OI fell most -> LONG', evOIdn, HZ);
study('OI fell + price fell (capitulation) -> LONG', evOIdnPdn, HZ);

// ================= D/E. HYPERLIQUID WHALES (20 days) =================
console.log('\n=== D. whale trades (Hyperliquid, $500k+) ===');
const evWo = [], evWo2 = [], evWc = [], evWliq = [];
for (const day of csvDays('whale_fills')) for (const r of day) { const s = sym(r[3]); if (!ok(s)) continue; const usd = +r[6], long = r[5] === '1', act = r[4]; if (!(usd >= 5e5)) continue; const e = { s, t: +r[0], dir: long ? 1 : -1 };
  if (act === 'open') { evWo.push(e); if (usd >= 2e6) evWo2.push(e); } else if (act === 'close') evWc.push({ s, t: +r[0], dir: long ? -1 : 1 }); if (+r[12] > 0) evWliq.push({ s, t: +r[0], dir: long ? 1 : -1 }); }
study('whale OPENS $500k+ -> follow', evWo, HZ);
study('whale OPENS $2M+ -> follow', evWo2, HZ);
study('whale CLOSES $500k+ -> follow the exit', evWc, HZ);
study('whale got LIQUIDATED -> bounce their way', evWliq, HZ);
console.log('\n=== E. whale positioning (hourly snapshot): net whale dollars added over 6h ===');
const wp = {}; for (const day of csvDays('whale_pos')) for (const r of day) { const s = sym(r[2]); if (!ok(s)) continue; const h = hourOf(+r[0]); const m = wp[h] || (wp[h] = {}); m[s] = (m[s] || 0) + (r[3] === '1' ? 1 : -1) * (+r[4]); }
const evWadd = [], evWcut = [];
const wh = Object.keys(wp).map(Number).sort((a, b) => a - b);
for (const h of wh) { const p = wp[h - 6 * H]; if (!p) continue; const ch = []; for (const s of Object.keys(wp[h])) { if (p[s] == null) continue; const d = wp[h][s] - p[s]; if (Math.abs(d) > 2e6) ch.push({ s, d }); }
  for (const x of ch) (x.d > 0 ? evWadd : evWcut).push({ s: x.s, t: h, dir: x.d > 0 ? 1 : -1 }); }
study('whales added $2M+ net LONG in 6h -> follow', evWadd, HZ);
study('whales added $2M+ net SHORT in 6h -> follow', evWcut, HZ);
