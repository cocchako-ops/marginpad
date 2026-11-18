// 2026-11-18: the channel's real signals (csig:results, Sep-Nov) - what separated the hits from the misses, with the data
// only we have at signal time: liquidations both sides (vs that coin's own trailing 14 days), OI change, BTC's move, how
// many channel coins flipped the same way, plus the chart readings. Win = TP1 before the stop (the channel's definition).
const fs = require('fs');
const D = JSON.parse(fs.readFileSync(__dirname + '/liq90.json', 'utf8'));
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const A = JSON.parse(st.results || '[]').filter(x => x.r === 'win' || x.r === 'loss');
const k5 = {}, lq = {}, oi = {}; for (const [c, d] of Object.entries(D)) { k5[c] = d.k5; lq[c] = new Map(d.liq.map(b => [Math.floor(b.t / 1000), b])); oi[c] = d.oi; }
const liqSum = (c, t0, t1, side) => { let s = 0; for (let t = t0; t < t1; t += 300) { const b = lq[c].get(t); if (b) s += b[side]; } return s; };
const oiAt = (c, ms) => { const a = oi[c]; for (let i = a.length - 1; i >= 0; i--) if (a[i][0] <= ms) return a[i][1]; return null; };
const pxAt = (c, t) => { const a = k5[c]; let lo = 0, hi = a.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (a[m].time <= t) lo = m; else hi = m - 1; } return a[lo] && a[lo].time <= t ? a[lo].close : null; };
// channel-coin flips per hour from the 1h closes we hold (5m -> 1h), Supertrend 10/3 is not recomputed here: use the signal log itself
const sigHour = {}; for (const x of JSON.parse(st.results || '[]')) { const h = Math.floor((x.sigTs || x.ts) / 3600e3); const k = h + (x.dir === 'long' ? 'L' : 'S'); sigHour[k] = (sigHour[k] || 0) + 1; }
const rows = [];
for (const x of A) {
  const c = x.sym; if (!k5[c]) continue; const t = Math.floor((x.sigTs || x.ts) / 300000) * 300; if (t < k5[c][0].time + 15 * 86400) continue;
  const L1 = liqSum(c, t - 3600, t, 'long'), S1 = liqSum(c, t - 3600, t, 'short');
  // that coin's typical hourly liquidation over the prior 14 days (median of hourly sums)
  const hs = []; for (let h = 1; h <= 14 * 24; h++) hs.push(liqSum(c, t - (h + 1) * 3600, t - h * 3600, 'long') + liqSum(c, t - (h + 1) * 3600, t - h * 3600, 'short')); hs.sort((a, b) => a - b);
  const med = hs[Math.floor(hs.length / 2)] || 1;
  const long = x.dir === 'long';
  const against = long ? L1 : S1, withSide = long ? S1 : L1; // longs liquidated hurt a long entry? or fuel it?
  const o0 = oiAt(c, t * 1000), o4 = oiAt(c, t * 1000 - 4 * 3600e3);
  const b0 = pxAt('BTC', t), b4 = pxAt('BTC', t - 4 * 3600), p0 = pxAt(c, t), p24 = pxAt(c, t - 24 * 3600);
  rows.push({ win: x.r === 'win', src: x.src || 'conf', long, c, liqX: (L1 + S1) / med, fuel: withSide / med, pain: against / med, oiChg: o0 && o4 ? (o0 / o4 - 1) * 100 : null, btc4: b0 && b4 ? (b0 / b4 - 1) * 100 * (long ? 1 : -1) : null, run24: p0 && p24 ? (p0 / p24 - 1) * 100 * (long ? 1 : -1) : null, sameHour: sigHour[Math.floor(t / 3600) + (long ? 'L' : 'S')] || 1, slPct: Math.abs(x.entry - x.sl) / x.entry * 100 });
}
const wr = (a) => a.length ? (a.filter(r => r.win).length / a.length * 100).toFixed(0) + '% of ' + a.length : '-';
const split = (lab, a, f, cuts) => { const parts = cuts.map((c, i) => [c[0], a.filter(r => f(r) != null && c[1](f(r)))]); console.log(lab.padEnd(36) + parts.map(p => p[0] + ': ' + wr(p[1])).join('  |  ')); };
for (const grp of ['conf', 'live']) {
  const a = rows.filter(r => r.src === grp); console.log('\n=== ' + (grp === 'conf' ? 'Premium/Balanced (confirmed)' : 'Fast (live)') + ' - ' + wr(a) + ' win ===');
  split('liquidations last 1h vs typical hour', a, r => r.liqX, [['<1x', v => v < 1], ['1-3x', v => v >= 1 && v < 3], ['>=3x', v => v >= 3]]);
  split('opposite side liquidated (fuel)', a, r => r.fuel, [['<0.5x', v => v < 0.5], ['0.5-2x', v => v >= 0.5 && v < 2], ['>=2x', v => v >= 2]]);
  split('own side liquidated (pain)', a, r => r.pain, [['<0.5x', v => v < 0.5], ['0.5-2x', v => v >= 0.5 && v < 2], ['>=2x', v => v >= 2]]);
  split('OI change 4h before', a, r => r.oiChg, [['fell >1%', v => v < -1], ['flat', v => v >= -1 && v <= 1], ['rose >1%', v => v > 1]]);
  split('BTC 4h move in signal direction', a, r => r.btc4, [['against <-0.5%', v => v < -0.5], ['flat', v => v >= -0.5 && v <= 0.5], ['with >0.5%', v => v > 0.5]]);
  split('coin 24h run in signal direction', a, r => r.run24, [['against', v => v < -1], ['flat', v => v >= -1 && v <= 1], ['with >1%', v => v > 1], ['with >4%', v => v > 4]]);
  split('signals same hour same side', a, r => r.sameHour, [['1', v => v === 1], ['2', v => v === 2], ['3+', v => v >= 3]]);
  split('stop distance', a, r => r.slPct, [['<1%', v => v < 1], ['1-2%', v => v >= 1 && v < 2], ['>=2%', v => v >= 2]]);
  split('side', a, r => r.long ? 1 : 0, [['long', v => v === 1], ['short', v => v === 0]]);
}
