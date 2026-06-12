// Binance COIN-margined futures liquidations. Endpoint: wss://dstream.binance.com/ws/!forceOrder@arr
// Why this exists: Binance's USDT-margined futures WS (fstream) geo-restricts its market DATA in every region
// we can reach (subscribe is ACKed but zero data) — even where coin-margined works. dstream (COIN-margined)
// is NOT gated and delivers directly, so it's our reachable Binance liquidation source. Verified live.
//   Message: { e:'forceOrder', E, o:{ s:'BTCUSD_PERP', S:'SELL'|'BUY', q:<contracts>, p, ap, T } }
// SIDE:  o.S === 'SELL' => a LONG was force-closed => long_liquidated; 'BUY' => short_liquidated.
// SIZE:  COIN-margined quantity is in CONTRACTS. Contract value = $100 for BTC, $10 for everything else.
//        notional(USD) = contracts * contractValue ; qty(base) = notional / price.
import { BaseCollector } from './base.js';

export class BinanceCoinCollector extends BaseCollector {
  constructor(opts) {
    super('binance-coin', opts);
    this.silenceMs = 6 * 60 * 1000; // coin-M liquidations are sparse; protocol ping/pong keeps the socket alive
  }
  url() { return 'wss://dstream.binance.com/ws/!forceOrder@arr'; }
  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    const arr = Array.isArray(j) ? j : [j];
    const out = [];
    for (const m of arr) {
      const o = m && m.o; if (!o) continue;
      const base = this._norm(o.s); if (!base) continue;
      const side = o.S === 'SELL' ? 'long_liquidated' : 'short_liquidated';
      const price = parseFloat(o.ap || o.p);
      const contracts = parseFloat(o.q);
      if (!(price > 0) || !(contracts > 0)) continue;
      const cv = /^BTC/.test(base) ? 100 : 10;          // coin-M contract value in USD
      const notional = contracts * cv, qty = notional / price;
      out.push({ ts: Number(o.T) || Number(m.E) || Date.now(), exchange: 'binance-coin', symbol: base, side, price, qty, notional });
    }
    return out;
  }
  _norm(instr) {
    const mm = /^([A-Z0-9]+)USD_/.exec(instr || ''); // BTCUSD_PERP / ETHUSD_240628 -> BTC / ETH
    return mm ? mm[1] : null;
  }
}
