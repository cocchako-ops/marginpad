// KRAKEN FUTURES liquidations (2026-11-14, owner: "Ajde ubaci kraken"). Kraken has no liquidation channel, but its PUBLIC trade
// feed classifies every trade, and liquidations are their own types - measured from here before writing this (all 209 live perps,
// one snapshot + 5 minutes): types fill / partialLiquidation / liquidation / assignment.
//   wss://futures.kraken.com/ws/v1, { event:'subscribe', feed:'trade', product_ids:[...] }
//   -> { feed:'trade', product_id:'PF_SOLUSD', uid, side:'sell', type:'partialLiquidation', time, qty, price, seq }
// SIDE is the taker side (Kraken doc), and the liquidated account is the taker - its forced order crosses the book. sell = a LONG
// force-sold. Measured on a falling day: 1,523 of 1,533 liquidations were sells. qty is the base amount (contractSize 1 on the
// PF_ multi-collateral perps), so notional = qty * price. XBT is Kraken's BTC. Coinglass does not carry Kraken; it is ~0.3% of
// futures open interest (CoinGecko, 11-14) - small, public, cheap.
// The subscription answers with a SNAPSHOT of recent trades (back days on a quiet market), so anything older than the connection by
// more than two minutes is dropped and every uid remembered - a reconnect must not book the same liquidation twice.
// Keepalive is the 'heartbeat' feed: a bare {event:'ping'} is answered "Bad websocket message".
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

const API = 'https://futures.kraken.com/derivatives/api/v3/instruments';

export class KrakenCollector extends BaseCollector {
  constructor(opts) {
    super('kraken', opts);
    this.silenceMs = 90000;   // the heartbeat feed pushes every few seconds
    this.products = [];
    this.seen = new Set();
    this.connAt = 0;
  }
  async init() {
    try {
      const j = await (await fetch(API)).json();
      this.products = (j.instruments || []).filter(i => i && i.tradeable && /^PF_/.test(i.symbol)).map(i => i.symbol);
      log.info('[kraken] perps', { n: this.products.length });
    } catch (e) { log.warn('[kraken] instrument list failed - majors only', { e: String(e) }); this.products = ['PF_XBTUSD', 'PF_ETHUSD', 'PF_SOLUSD', 'PF_XRPUSD']; }
  }
  url() { this.connAt = Date.now(); return 'wss://futures.kraken.com/ws/v1'; }
  subscribeFrames() { return [{ event: 'subscribe', feed: 'heartbeat' }, { event: 'subscribe', feed: 'trade', product_ids: this.products }]; }
  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    const arr = j.feed === 'trade_snapshot' ? (j.trades || []) : j.feed === 'trade' ? [j] : null;
    if (!arr) return [];
    const out = [];
    for (const t of arr) {
      if (!t || (t.type !== 'liquidation' && t.type !== 'partialLiquidation')) continue;
      const id = String(t.uid || ''); if (!id || this.seen.has(id)) continue;
      this.seen.add(id); if (this.seen.size > 20000) this.seen = new Set(Array.from(this.seen).slice(-10000));
      const ts = Number(t.time) || Date.now(); if (ts < this.connAt - 120000) continue;
      const m = /^PF_([A-Z0-9]+)USD$/.exec(String(t.product_id || t.product_id || '')); if (!m) continue;
      const sym = m[1] === 'XBT' ? 'BTC' : m[1];
      const price = parseFloat(t.price), qty = parseFloat(t.qty);
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({ ts, exchange: 'kraken', symbol: sym, side: t.side === 'sell' ? 'long_liquidated' : 'short_liquidated', price, qty, notional: price * qty });
    }
    return out;
  }
}
