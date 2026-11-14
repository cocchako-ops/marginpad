// BITGET USDT-FUTURES liquidations (2026-11-14, owner: "Kako ne mozemo da vidimo BingX, Bitget, Mexc ... njihove likvidacije?").
// Bitget publishes a PUBLIC liquidation channel in its Unified Account (UTA) WebSocket API - the Classic v2 API has none, which is
// why it was missing until now. MEXC and BingX publish no public liquidation feed at all (checked the same day), so they stay out.
// Endpoint: wss://ws.bitget.com/v3/ws/public, subscribe { op:'subscribe', args:[{ instType:'usdt-futures', topic:'liquidation' }] }.
// Measured from here before writing this: subscribe ack, then one update per liquidation about 1.5 s after it happened.
//   data[]: { symbol:'BTWUSDT', side:'buy'|'sell', price, amount, ts }
// SIDE (Bitget doc: "Position side"): buy = a LONG position was liquidated, sell = a SHORT one.
// AMOUNT IS THE BASE QUANTITY, WHATEVER THE DOC SAYS. The doc calls it "quote coin"; measured against live data it is not: BTC
// rows carry 0.0055 and 0.0105 (dollars that small do not exist on a 66,000 BTC), every amount is a multiple of the
// contract's lot step, and a 964.5 AVAX liquidation matched the 975-1004 AVAX of sells the tape printed in the same
// millisecond. Notional = price x amount, the OKX bkPx shape (price is the liquidation price, not the fill).
// Keepalive: the literal text 'ping' every 25 s; the server answers 'pong'.
import { BaseCollector } from './base.js';

export class BitgetCollector extends BaseCollector {
  constructor(opts) {
    super('bitget', opts);
    this.silenceMs = 40000;   // pongs arrive every 25 s, so 40 s of nothing is a dead socket
  }
  url() { return 'wss://ws.bitget.com/v3/ws/public'; }
  subscribeFrames() { return [{ op: 'subscribe', args: [{ instType: 'usdt-futures', topic: 'liquidation' }] }]; }
  pingFrame() { return 'ping'; }
  pingIntervalMs() { return 25000; }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    if (text === 'pong') return [];
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.event || !j.arg || j.arg.topic !== 'liquidation' || !Array.isArray(j.data)) return [];
    const out = [];
    for (const d of j.data) {
      const m = /^([A-Z0-9]+)USDT$/.exec(String(d.symbol || '')); if (!m) continue;
      const price = parseFloat(d.price), qty = parseFloat(d.amount);
      if (!(price > 0) || !(qty > 0)) continue;
      const side = d.side === 'buy' ? 'long_liquidated' : d.side === 'sell' ? 'short_liquidated' : null;
      if (!side) continue;
      out.push({ ts: Number(d.ts) || Date.now(), exchange: 'bitget', symbol: m[1], side, price, qty, notional: price * qty });
    }
    return out;
  }
}
