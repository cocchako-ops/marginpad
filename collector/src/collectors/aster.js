// ASTER perp liquidations (2026-11-14, owner: "Da li ima jos nesto sto mozemo da nabavimo?"). Aster runs a Binance-compatible
// futures API, and its all-market force-order stream is the Binance shape exactly - measured from here before writing this:
//   wss://fstream.asterdex.com/ws/!forceOrder@arr  ->  { e:'forceOrder', E, o:{ s:'ZECUSDT', S:'SELL', q, p, ap, T } }
// Same reading as binance.js: S SELL = a long force-sold, q is the BASE quantity, ap the average fill price. Coinglass carries Aster
// at about 1% of the market (4h, 11-14: $5.05M of $492.6M) and we had none of it. USDT and USDC margined pairs both kept.
import { BaseCollector } from './base.js';

export class AsterCollector extends BaseCollector {
  constructor(opts) {
    super('aster', opts);
    this.silenceMs = 6 * 60 * 1000;   // a quiet market pushes nothing for minutes; protocol ping keeps the socket alive
  }
  url() { return 'wss://fstream.asterdex.com/ws/!forceOrder@arr'; }
  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    const out = [];
    for (const m of (Array.isArray(j) ? j : [j])) {
      const o = m && m.o; if (!o) continue;
      const mm = /^([A-Z0-9]+)(USDT|USDC|USD1)$/.exec(String(o.s || '')); if (!mm) continue;
      const price = parseFloat(o.ap || o.p), qty = parseFloat(o.q);
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({ ts: Number(o.T) || Number(m.E) || Date.now(), exchange: 'aster', symbol: mm[1], side: o.S === 'SELL' ? 'long_liquidated' : 'short_liquidated', price, qty, notional: price * qty });
    }
    return out;
  }
}
