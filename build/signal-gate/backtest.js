// Walk-forward backtest of the Premium signal rule (1h Supertrend 10/3 flip on close, 4h aligned, vol >= 1.2x avg20)
// and its variants, on 9 coins x Jan 2026 -> now, with the PRODUCTION indicator code sliced out of worker.js.
const fs = require('fs');
const src = fs.readFileSync('D:/part1/money-mission/src/worker.js', 'utf8');
function fnSrc(name) { const i = src.indexOf('function ' + name + '('); if (i < 0) throw new Error('no ' + name); let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } }
const _sanitizeSigBars = eval('(' + fnSrc('_sanitizeSigBars') + ')');
const _supertrend = eval('(' + fnSrc('_supertrend') + ')');
const _adxLast = eval('(' + fnSrc('_adxLast') + ')');
const _rsi = eval('(' + fnSrc('_rsi') + ')');
const K = JSON.parse(fs.readFileSync(__dirname + '/klines.json', 'utf8'));
const COINS = Object.keys(K['60']);
const WIN = 1000, FEE = 0.0011; // engine window; taker 0.055% x 2 legs on notional
const LIVE_FROM = Date.UTC(2026, 6, 24) / 1000, OOS_FROM = Date.UTC(2026, 4, 15) / 1000;

// ---- precompute per coin: sliding-window ST (dir, atr, line) on 1h; 4h + 1d dir at each 1h bar; ADX; RSI; volR ----
const P = {};
function slidingST(bars) {
  const n = bars.length, dir = new Array(n).fill(null), atr = new Array(n).fill(null), line = new Array(n).fill(null);
  for (let i = 30; i < n; i++) {
    const w = bars.slice(Math.max(0, i - WIN + 1), i + 1); const st = _supertrend(w, 10, 3); if (!st) continue;
    const li = w.length - 1; dir[i] = st.dir[li]; atr[i] = st.atr[li];
    // reconstruct the active band (the stop the indicator itself uses)
    const hl2 = (w[li].high + w[li].low) / 2; line[i] = st.dir[li] === 1 ? hl2 - 3 * st.atr[li] : hl2 + 3 * st.atr[li];
  }
  // the ST band ratchets; recompute the ratcheted line properly (final lower band / upper band) from the last window
  return { dir, atr, line };
}
for (const c of COINS) {
  const b1 = K['60'][c].map(b => ({ ...b })), b4 = K['240'][c].map(b => ({ ...b })), bd = K['1440'][c].map(b => ({ ...b }));
  _sanitizeSigBars(b1); _sanitizeSigBars(b4); _sanitizeSigBars(bd);
  const st1 = slidingST(b1), st4 = slidingST(b4), std = slidingST(bd);
  const n = b1.length; const d4 = new Array(n).fill(null), dd = new Array(n).fill(null), adx = new Array(n).fill(null), rsi = new Array(n).fill(null), volR = new Array(n).fill(0), sinceFlip = new Array(n).fill(999);
  let j4 = 0, jd = 0, last = -1;
  for (let i = 0; i < n; i++) {
    const t = b1[i].time;
    while (j4 + 1 < b4.length && b4[j4 + 1].time + 14400 <= t + 3600) j4++; d4[i] = (b4[j4].time + 14400 <= t + 3600) ? st4.dir[j4] : null;
    while (jd + 1 < bd.length && bd[jd + 1].time + 86400 <= t + 3600) jd++; dd[i] = (bd[jd].time + 86400 <= t + 3600) ? std.dir[jd] : null;
    if (i >= 200) { const w = b1.slice(Math.max(0, i - WIN + 1), i + 1); adx[i] = _adxLast(w, 14); rsi[i] = _rsi(w.map(b => b.close), 14); }
    if (i >= 20) { let s = 0; for (let k = i - 19; k <= i; k++) s += +b1[k].vol || 0; volR[i] = s ? (+b1[i].vol || 0) / (s / 20) : 0; }
    if (i > 0 && st1.dir[i] != null && st1.dir[i - 1] != null && st1.dir[i] !== st1.dir[i - 1]) { sinceFlip[i] = last < 0 ? 999 : i - last; last = i; } else sinceFlip[i] = last < 0 ? 999 : i - last;
  }
  P[c] = { b: b1, st: st1, d4, dd, adx, rsi, volR, sinceFlip };
}

// ---- simulate one config ----
// cfg: {slM (ATR mult), tp1R, tp2R, exit:'plan'|'trail'|'flipOnly', entry:'next'|'pb:<atr>', f:{adx,daily,volR,hoursEx:[..],gapMin,longOnly,shortOnly,rsiMax}}
function simulate(cfg) {
  const trades = [];
  for (const c of COINS) {
    const { b, st, d4, dd, adx, rsi, volR, sinceFlip } = P[c]; const n = b.length;
    let open = null; // one signal per symbol at a time, like the engine
    for (let i = 201; i < n - 1; i++) {
      // manage open trade on bar i (bars strictly after entry)
      if (open && i > open.iEntry) {
        const o = open, L = o.long, hi = b[i].high, lo = b[i].low;
        if (o.pending) { // pullback limit not filled yet
          if (i - o.iSig > o.pbBars) { open = null; }
          else if (L ? lo <= o.limit : hi >= o.limit) { o.pending = false; o.entry = o.limit; o.iEntry = i; o.sl = L ? o.entry - o.slM * o.atr : o.entry + o.slM * o.atr; o.risk = Math.abs(o.entry - o.sl); o.tp1 = L ? o.entry + cfg.tp1R * o.risk : o.entry - cfg.tp1R * o.risk; o.tp2 = L ? o.entry + cfg.tp2R * o.risk : o.entry - cfg.tp2R * o.risk; }
          continue;
        }
        const flipBack = st.dir[i] != null && st.dir[i] !== (L ? 1 : -1);
        let done = false, R = null, tag = '';
        const Rof = px => (L ? px - o.entry : o.entry - px) / o.risk;
        if (cfg.exit === 'flipOnly') { if (flipBack) { R = Rof(b[i].close); tag = 'flip'; done = true; } }
        else {
          if (o.phase === 0) {
            if (L ? lo <= o.sl : hi >= o.sl) { R = -1; tag = 'loss'; done = true; }
            else if (L ? hi >= o.tp1 : lo <= o.tp1) { o.phase = 1; o.bank = 0.5 * Rof(o.tp1); o.sl = cfg.exit === 'trail' ? o.entry : o.entry; tag = 'tp1'; }
            else if (flipBack) { R = Rof(b[i].close); tag = 'exit'; done = true; }
          }
          if (!done && o.phase === 1 && !(tag === 'tp1')) {
            if (cfg.exit === 'trail' && st.line[i - 1] != null) { o.sl = L ? Math.max(o.sl, st.line[i - 1]) : Math.min(o.sl, st.line[i - 1]); }
            if (L ? lo <= o.sl : hi >= o.sl) { R = o.bank + 0.5 * Rof(o.sl); tag = o.sl === o.entry ? 'be' : 'trailstop'; done = true; }
            else if (L ? hi >= o.tp2 : lo <= o.tp2) { R = o.bank + 0.5 * Rof(o.tp2); tag = 'tp2'; done = true; }
            else if (flipBack) { R = o.bank + 0.5 * Rof(b[i].close); tag = 'flip'; done = true; }
          }
        }
        if (done) { trades.push({ c, t: b[o.iSig].time, long: L, R: R - FEE * o.entry / o.risk, gross: R, tag, slPct: o.risk / o.entry * 100, hours: i - o.iEntry, f: o.feat }); open = null; }
      }
      // new flip on closed bar i?
      if (st.dir[i] == null || st.dir[i - 1] == null || st.dir[i] === st.dir[i - 1]) continue;
      const long = st.dir[i] === 1, f = cfg.f || {};
      if (d4[i] !== st.dir[i]) continue; // 4h aligned (engine gate)
      if (volR[i] < 1.2) continue; // volume gate (engine)
      if (f.adx && !(adx[i] >= f.adx)) continue;
      if (f.daily && dd[i] !== st.dir[i]) continue;
      if (f.dailyOpp && dd[i] === st.dir[i]) continue;
      if (f.volR && !(volR[i] >= f.volR)) continue;
      if (f.gapMin && sinceFlip[i] < f.gapMin) continue;
      if (f.longOnly && !long) continue;
      if (f.shortOnly && long) continue;
      if (f.rsiMax && rsi[i] != null && (long ? rsi[i] > f.rsiMax : rsi[i] < 100 - f.rsiMax)) continue;
      if (f.hoursEx) { const h = new Date(b[i].time * 1000).getUTCHours(); if (f.hoursEx.includes(h)) continue; }
      if (f.maxExt) { const ext = Math.abs(b[i].close - st.line[i]) / st.atr[i]; if (ext > f.maxExt) continue; }
      if (f.flipBodyMax) { if (Math.abs(b[i].close - b[i].open) / st.atr[i] > f.flipBodyMax) continue; }
      if (open) { // engine: a new flip abandons the tracked one (opposite flip) - already handled by flipBack exit, but same-dir can't happen
        continue;
      }
      const atr = st.atr[i], sigPx = b[i].close;
      const dt = new Date(b[i].time * 1000);
      const feat = { adx: adx[i], rsi: rsi[i], volR: volR[i], dd: dd[i] === st.dir[i] ? 1 : 0, gap: sinceFlip[i], hour: dt.getUTCHours(), dow: dt.getUTCDay(), ext: Math.abs(sigPx - st.line[i]) / atr, body: Math.abs(b[i].close - b[i].open) / atr, range: (b[i].high - b[i].low) / atr, run6: (long ? 1 : -1) * (sigPx - b[i - 6].close) / atr, run24: (long ? 1 : -1) * (sigPx - b[i - 24].close) / atr, atrPct: atr / sigPx * 100, ema200: (() => { let e = b[i - 199].close, k = 2 / 201; for (let q = i - 198; q <= i; q++) e = b[q].close * k + e * (1 - k); return (long ? 1 : -1) * (sigPx - e) / atr; })(), prevFlipR: null };
      if (cfg.entry && cfg.entry.startsWith('pb:')) {
        const k = +cfg.entry.slice(3); const limit = long ? sigPx - k * atr : sigPx + k * atr;
        open = { iSig: i, iEntry: i, pending: true, limit, pbBars: cfg.pbBars || 4, long, atr, slM: cfg.slM, phase: 0, bank: 0 };
      } else {
        const entry = cfg.entry === 'close' ? sigPx : b[i + 1].open; // realistic fill = next bar open
        const sl = long ? sigPx - cfg.slM * atr : sigPx + cfg.slM * atr; // levels from the SIGNAL price like the engine
        const risk = Math.abs(entry - sl); if (!(risk > 0)) continue;
        open = { feat, iSig: i, iEntry: i, entry, sl, risk, tp1: long ? sigPx + cfg.tp1R * 1.0 * (cfg.slM * atr) : sigPx - cfg.tp1R * (cfg.slM * atr), tp2: long ? sigPx + cfg.tp2R * (cfg.slM * atr) : sigPx - cfg.tp2R * (cfg.slM * atr), long, atr, slM: cfg.slM, phase: 0, bank: 0 };
        open.iEntry = i; // entered at open of i+1; management starts at bar i+1 (strictly after)
      }
    }
  }
  return trades;
}
function summarize(tr, label) {
  const seg = (a) => { const n = a.length; if (!n) return 'n0'; const w = a.filter(t => t.R > 0).length; const sum = a.reduce((s, t) => s + t.R, 0), g = a.reduce((s, t) => s + t.gross, 0); const sd = Math.sqrt(a.reduce((s, t) => s + (t.R - sum / n) ** 2, 0) / n); return 'n' + String(n).padStart(4) + ' WR' + String(Math.round(w / n * 100)).padStart(3) + '% avgR' + (sum / n >= 0 ? '+' : '') + (sum / n).toFixed(3) + ' (gross' + (g / n >= 0 ? '+' : '') + (g / n).toFixed(3) + ') sumR' + (sum >= 0 ? '+' : '') + sum.toFixed(0) + ' t' + (sd ? (sum / n / sd * Math.sqrt(n)).toFixed(1) : '-'); };
  const is = tr.filter(t => t.t < OOS_FROM), oos = tr.filter(t => t.t >= OOS_FROM), live = tr.filter(t => t.t >= LIVE_FROM);
  console.log(label.padEnd(46), '| ALL ' + seg(tr), '| IS ' + seg(is), '| OOS ' + seg(oos), '| LIVEwin ' + seg(live));
}
module.exports = { simulate, summarize, P, COINS };
if (require.main === module) {
  const base = { slM: 1.5, tp1R: 1.5, tp2R: 3, exit: 'plan', entry: 'next' };
  console.log('=== BASELINE (engine rule, realistic next-open fill, fee 0.11%) ===');
  const T0 = simulate(base); summarize(T0, 'baseline');
  const tags = {}; T0.filter(t => t.t >= LIVE_FROM).forEach(t => tags[t.tag] = (tags[t.tag] || 0) + 1); console.log('  live-window tags', JSON.stringify(tags));
  summarize(simulate({ ...base, entry: 'close' }), 'baseline @flip close (engine quote)');
  console.log('  per coin (ALL):'); for (const c of COINS) summarize(T0.filter(t => t.c === c), '  ' + c);
  console.log('  longs / shorts:'); summarize(T0.filter(t => t.long), '  longs'); summarize(T0.filter(t => !t.long), '  shorts');
  console.log('=== STOP WIDTH (same R geometry) ===');
  for (const m of [1.5, 2, 2.5, 3, 4]) summarize(simulate({ ...base, slM: m }), 'sl ' + m + ' ATR');
  console.log('=== EXIT STYLE ===');
  summarize(simulate({ ...base, exit: 'trail' }), 'plan + trail runner on ST line');
  summarize(simulate({ ...base, exit: 'flipOnly' }), 'flip-to-flip (no TP/SL), R=1.5ATR');
  summarize(simulate({ ...base, slM: 3, exit: 'flipOnly' }), 'flip-to-flip, R=3ATR');
  summarize(simulate({ ...base, tp1R: 1, tp2R: 2 }), 'tp1 1R / tp2 2R');
  summarize(simulate({ ...base, tp1R: 2, tp2R: 4 }), 'tp1 2R / tp2 4R');
  summarize(simulate({ ...base, slM: 2.5, tp1R: 1, tp2R: 2 }), 'sl 2.5 ATR, tp1 1R / tp2 2R');
  console.log('=== ENTRY ===');
  for (const k of [0.5, 1, 1.5]) summarize(simulate({ ...base, entry: 'pb:' + k, pbBars: 4 }), 'pullback limit -' + k + ' ATR, 4 bars');
  for (const k of [1, 1.5]) summarize(simulate({ ...base, entry: 'pb:' + k, pbBars: 8 }), 'pullback limit -' + k + ' ATR, 8 bars');
  console.log('=== FILTERS on baseline ===');
  summarize(simulate({ ...base, f: { adx: 25 } }), 'ADX>=25');
  summarize(simulate({ ...base, f: { adx: 20 } }), 'ADX>=20');
  summarize(simulate({ ...base, f: { daily: 1 } }), 'daily ST aligned');
  summarize(simulate({ ...base, f: { dailyOpp: 1 } }), 'daily ST OPPOSED (counter-trend)');
  summarize(simulate({ ...base, f: { volR: 2 } }), 'vol>=2x');
  summarize(simulate({ ...base, f: { gapMin: 12 } }), 'gap since prev flip>=12 bars');
  summarize(simulate({ ...base, f: { gapMin: 24 } }), 'gap since prev flip>=24 bars');
  summarize(simulate({ ...base, f: { longOnly: 1 } }), 'longs only');
  summarize(simulate({ ...base, f: { rsiMax: 70 } }), 'RSI not > 70 / < 30');
  summarize(simulate({ ...base, f: { hoursEx: [20, 21, 22, 23] } }), 'exclude 20-23 UTC');
  summarize(simulate({ ...base, f: { hoursEx: [8, 9, 10, 11, 12, 13] } }), 'exclude 08-13 UTC');
  summarize(simulate({ ...base, f: { maxExt: 3.5 } }), 'entry ext <= 3.5 ATR from line');
  summarize(simulate({ ...base, f: { flipBodyMax: 1.5 } }), 'flip body <= 1.5 ATR');
  console.log('=== COMBOS ===');
  summarize(simulate({ ...base, slM: 3, exit: 'trail' }), 'sl 3 + trail');
  summarize(simulate({ ...base, slM: 3, f: { gapMin: 12 } }), 'sl 3 + gap12');
  summarize(simulate({ ...base, slM: 3, tp1R: 1, tp2R: 2, f: { gapMin: 12 } }), 'sl 3 + tp 1/2 + gap12');
  summarize(simulate({ ...base, slM: 2.5, exit: 'trail', f: { daily: 1 } }), 'sl 2.5 + trail + daily');
  summarize(simulate({ ...base, slM: 3, exit: 'flipOnly', f: { daily: 1 } }), 'flip-to-flip R=3ATR + daily');
  summarize(simulate({ ...base, slM: 3, exit: 'flipOnly', f: { gapMin: 12 } }), 'flip-to-flip R=3ATR + gap12');
  summarize(simulate({ ...base, slM: 3, exit: 'flipOnly', f: { daily: 1, gapMin: 12 } }), 'flip-to-flip R=3ATR + daily + gap12');
}
