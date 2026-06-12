// Binance USDT-M Futures liquidations. Stream: wss://fstream.binance.com/ws/!forceOrder@arr
// Schema verified at build time from Binance derivatives docs.
//   Message: { e:'forceOrder', E:eventTime, o:{ s:symbol, S:side, q:origQty, p:price, ap:avgPrice, T:tradeTime, ... } }
// QUIRK: this is a SNAPSHOT stream — only the largest liquidation per symbol per ~1000ms is pushed,
//        so totals undercount true liquidation flow. Documented in UI tooltip.
// SIDE:  o.S === 'SELL'  => a LONG position was force-closed (sold)  => 'long_liquidated'
//        o.S === 'BUY'   => a SHORT position was force-closed (bought) => 'short_liquidated'
import { BaseCollector } from './base.js';

const SUFFIX = 'USDT';

export class BinanceCollector extends BaseCollector {
  constructor(opts) {
    super('binance', opts);
    // Binance can be genuinely quiet; protocol-level ping/pong keeps the socket alive, so allow long silence.
    this.silenceMs = 6 * 60 * 1000;
    this._set = new Set(this.symbols);
  }
  url() { return 'wss://fstream.binance.com/ws/!forceOrder@arr'; }
  // All-market stream is path-based — no subscribe frame, no app ping (protocol ping is auto-answered).
  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    const arr = Array.isArray(j) ? j : [j]; // all-market pushes single objects; be defensive
    const out = [];
    for (const m of arr) {
      const o = m && m.o; if (!o) continue;
      const sym = this._norm(o.s); if (!sym) continue;
      const side = o.S === 'SELL' ? 'long_liquidated' : 'short_liquidated';
      const price = parseFloat(o.ap || o.p);
      const qty = parseFloat(o.q);
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({ ts: Number(o.T) || Number(m.E) || Date.now(), exchange: 'binance', symbol: sym, side, price, qty, notional: price * qty });
    }
    return out;
  }
  _norm(instr) {
    if (!instr || !instr.endsWith(SUFFIX)) return null;
    const base = instr.slice(0, -SUFFIX.length);
    return this._set.has(base) ? base : null;
  }
}
