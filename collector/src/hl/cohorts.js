// Cohort definitions and the aggregate over every open position. One table each, pure, so a test drives what ships.
export const PNL_TIERS = [
  { id: 'elite', name: 'Elite', min: 1e6 },
  { id: 'sharp', name: 'Sharp', min: 1e5 },
  { id: 'green', name: 'Green', min: 0 },
  { id: 'red', name: 'Red', min: -1e5 },
  { id: 'burned', name: 'Burned', min: -1e6 },
  { id: 'rekt', name: 'Rekt', min: -Infinity },
];
export const SIZE_TIERS = [
  { id: 'titan', name: 'Titan', min: 5e6 },
  { id: 'whale', name: 'Whale', min: 1e6 },
  { id: 'shark', name: 'Shark', min: 1e5 },
  { id: 'fish', name: 'Fish', min: 1e4 },
  { id: 'shrimp', name: 'Shrimp', min: -Infinity },
];
export const pnlTier = (p) => (p == null || !isFinite(p) ? 'unknown' : PNL_TIERS.find((t) => p >= t.min).id);
export const sizeTier = (a) => (a == null || !isFinite(a) ? 'unknown' : SIZE_TIERS.find((t) => a >= t.min).id);

// A wallet's own book, not a market view: these are excluded from the cohorts and reported beside them, so the
// columns plus the excluded row add up to open interest and the page can prove it. Turnover is the tell of a market
// maker: thirty days of volume against the capital behind it, on a volume no directional trader reaches.
export const MM_TURNOVER = 200, MM_MIN_VLM = 2e8;
export function kindOf(w, vaults) {
  if (vaults && vaults.has(w.addr)) return 'vault';
  if ((w.vlm_m || 0) >= MM_MIN_VLM && (w.vlm_m || 0) / Math.max(w.av || 0, 1) >= MM_TURNOVER) return 'mm';
  return 'user';
}
export function biasOf(l, s) {
  const t = l + s; if (!t) return 'none';
  const p = l / t;
  return p >= 0.7 ? 'very_bullish' : p >= 0.56 ? 'bullish' : p > 0.44 ? 'neutral' : p > 0.3 ? 'bearish' : 'very_bearish';
}
const blank = () => ({ long_ntl: 0, short_ntl: 0, long_n: 0, short_n: 0, prof_n: 0, loss_n: 0, upnl: 0 });
// positions: iterable of { addr, coin, szi, ntl, upnl }. wallets: Map addr -> wallet. Returns Map 'fam|cohort|coin' -> totals,
// with coin 'ALL' for the whole market, plus the wallet counts per cohort (a wallet counts once however many coins it holds).
export function aggregate(positions, wallets) {
  const out = new Map(), seen = new Map();
  const add = (fam, cohort, coin, p) => {
    const k = fam + '|' + cohort + '|' + coin;
    let a = out.get(k); if (!a) { a = blank(); out.set(k, a); }
    if (p.szi > 0) { a.long_ntl += p.ntl; a.long_n++; } else { a.short_ntl += p.ntl; a.short_n++; }
    if (p.upnl >= 0) a.prof_n++; else a.loss_n++;
    a.upnl += p.upnl || 0;
  };
  for (const p of positions) {
    const w = wallets.get(p.addr); if (!w) continue;
    const kind = w.kind || 'user';
    if (kind !== 'user') { add('excluded', kind, 'ALL', p); add('excluded', kind, p.coin, p); continue; }
    const a = pnlTier(w.pnl_all), b = sizeTier(w.av);
    for (const [fam, c] of [['pnl', a], ['size', b], ['all', 'all']]) {
      add(fam, c, 'ALL', p); add(fam, c, p.coin, p);
      const sk = fam + '|' + c; let st = seen.get(sk); if (!st) { st = new Set(); seen.set(sk, st); } st.add(p.addr);
    }
  }
  const wallets_n = {}; for (const [k, s] of seen) wallets_n[k] = s.size;
  return { rows: out, wallets_n };
}
