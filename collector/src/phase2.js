// PHASE 2 — Estimated liquidation clusters (a MODEL, labelled as such in the UI).
// Polls Open Interest per symbol, and on every positive OI change distributes the new notional across an
// assumed leverage distribution to estimate where future liquidations cluster. Clusters decay over time and
// are CONSUMED when price trades through them. All model parameters live in config.js.
//
// Exchange-specific REST quirks are isolated in the three fetchers below (same principle as the collectors).
import { config, bucketSizeFor } from '../config.js';
import { log } from './logger.js';

async function biOi(sym) {
  const pair = sym + 'USDT';
  const [oiR, pxR] = await Promise.all([
    fetch('https://fapi.binance.com/fapi/v1/openInterest?symbol=' + pair),
    fetch('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=' + pair),
  ]);
  if (!oiR.ok || !pxR.ok) return null;
  const oi = await oiR.json(), px = await pxR.json();
  const oiBase = parseFloat(oi.openInterest), price = parseFloat(px.markPrice);   // openInterest is in base units
  return oiBase > 0 && price > 0 ? { oiBase, price } : null;
}
async function bybitOi(sym) {
  const pair = sym + 'USDT';
  const r = await fetch('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=' + pair + '&intervalTime=5min&limit=1');
  if (!r.ok) return null;
  const j = await r.json();
  const it = j && j.result && j.result.list && j.result.list[0];
  const oiBase = it ? parseFloat(it.openInterest) : 0;                            // linear OI is in base units
  const t = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=' + pair).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const price = t && t.result && t.result.list && t.result.list[0] ? parseFloat(t.result.list[0].lastPrice) : 0;
  return oiBase > 0 && price > 0 ? { oiBase, price } : null;
}
async function okxOi(sym, ctVal) {
  const inst = sym + '-USDT-SWAP';
  const r = await fetch('https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=' + inst);
  if (!r.ok) return null;
  const j = await r.json();
  const d = j && j.data && j.data[0];
  if (!d) return null;
  const oiBase = parseFloat(d.oiCcy) || parseFloat(d.oi) * (ctVal || 1);          // oiCcy = base currency OI
  const t = await fetch('https://www.okx.com/api/v5/market/ticker?instId=' + inst).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const price = t && t.data && t.data[0] ? parseFloat(t.data[0].last) : 0;
  return oiBase > 0 && price > 0 ? { oiBase, price } : null;
}

export function startPhase2(storage, okxCtVal) {
  const syms = config.symbols;
  let idx = 0;
  const prevOi = {};   // symbol -> previous total OI (base) for ΔOI
  const prevPx = {};   // symbol -> previous price (for consumption)
  const halfLifeMs = config.clusterHalfLifeDays * 86400000;
  const decayFactor = Math.pow(0.5, config.oiPollMs / halfLifeMs);

  async function pollSymbol(sym) {
    const now = Date.now();
    const exNames = ['binance', 'bybit', 'okx'];
    const res = await Promise.allSettled([biOi(sym), bybitOi(sym), okxOi(sym, okxCtVal && okxCtVal[sym + '-USDT-SWAP'])]);
    let price = 0, n = 0;
    res.forEach((r, i) => { if (r.status === 'fulfilled' && r.value) { storage.insertOi(sym, exNames[i], now, r.value.oiBase, r.value.price); price += r.value.price; n++; } });
    if (!n) return;
    price /= n;

    const totalOi = (await storage.async.latestOi(sym)).reduce((s, r) => s + r.oi, 0);
    const dOi = prevOi[sym] != null ? totalOi - prevOi[sym] : 0;
    const pPrev = prevPx[sym];
    prevOi[sym] = totalOi; prevPx[sym] = price;

    // 1) slow time decay so stale clusters fade
    storage.decayClusters(sym, decayFactor, now, 1);
    // 2) consumption: price traded through buckets -> that liquidity is spent
    if (pPrev && pPrev !== price) storage.consumeClusters(sym, Math.min(pPrev, price), Math.max(pPrev, price));
    // 3) new positions from positive ΔOI -> spread over the leverage distribution (naive 50/50 long/short)
    if (dOi > 0) {
      const newNotional = dOi * price;
      const bs = bucketSizeFor(sym, price);
      for (const { lev, w } of config.leverageDistribution) {
        const longLiq = price * (1 - 1 / lev + config.mmr);
        const shortLiq = price * (1 + 1 / lev - config.mmr);
        storage.addCluster(sym, Math.floor(longLiq / bs) * bs, 'long_liquidated', newNotional * w * 0.5, now);
        storage.addCluster(sym, Math.floor(shortLiq / bs) * bs, 'short_liquidated', newNotional * w * 0.5, now);
      }
    }
  }

  const everyMs = Math.max(2000, Math.floor(config.oiPollMs / syms.length)); // stagger: one symbol at a time
  const timer = setInterval(() => {
    const sym = syms[idx++ % syms.length];
    pollSymbol(sym).catch((e) => log.warn('[phase2] poll failed', { sym, e: String(e) }));
  }, everyMs);
  log.info('[phase2] OI poller started', { everyMs, symbols: syms.length, decayFactor: decayFactor.toFixed(4) });
  return { stop: () => clearInterval(timer) };
}
