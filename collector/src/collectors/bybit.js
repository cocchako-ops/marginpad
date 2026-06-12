// Bybit V5 linear-perp liquidations. Endpoint: wss://stream.bybit.com/v5/public/linear
// Topic: allLiquidation.{symbol}  (the CURRENT all-liquidation topic; the old `liquidation.{symbol}`
//        single-event topic is deprecated). Verified from Bybit V5 websocket docs at build time.
//   data[]: { T:ts(ms), s:symbol, S:'Buy'|'Sell', v:size, p:bankruptcyPrice }
// SIDE:  S === 'Buy'  => a LONG was liquidated  => 'long_liquidated'
//        S === 'Sell' => a SHORT was liquidated => 'short_liquidated'
// Keepalive: send {op:'ping'} every ~20s; server replies {op:'pong'}.
import { BaseCollector } from './base.js';

export class BybitCollector extends BaseCollector {
  constructor(opts) {
    super('bybit', opts);
    this.silenceMs = 35000;
    this._set = new Set(this.symbols);
  }
  url() { return 'wss://stream.bybit.com/v5/public/linear'; }
  subscribeFrames() { return [{ op: 'subscribe', args: this.symbols.map((s) => `allLiquidation.${s}USDT`) }]; }
  pingFrame() { return { op: 'ping' }; }
  pingIntervalMs() { return 20000; }
  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.op || j.success !== undefined) return []; // pong / subscribe ack
    if (!j.topic || !j.topic.startsWith('allLiquidation.')) return [];
    const data = Array.isArray(j.data) ? j.data : j.data ? [j.data] : [];
    const out = [];
    for (const d of data) {
      const sym = this._norm(d.s); if (!sym) continue;
      const side = d.S === 'Buy' ? 'long_liquidated' : 'short_liquidated';
      const price = parseFloat(d.p);
      const qty = parseFloat(d.v);
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({ ts: Number(d.T) || Number(j.ts) || Date.now(), exchange: 'bybit', symbol: sym, side, price, qty, notional: price * qty });
    }
    return out;
  }
  _norm(instr) {
    if (!instr || !instr.endsWith('USDT')) return null;
    const base = instr.slice(0, -4);
    return this._set.has(base) ? base : null;
  }
}
