// LIGHTER perp liquidations (2026-11-14, owner: "Da li ima jos nesto sto mozemo da nabavimo?"). Lighter publishes every
// liquidation in its public trade channel, one subscription per market, as a separate array:
//   wss://mainnet.zklighter.elliot.ai/stream, { type:'subscribe', channel:'trade/<market_id>' }
//   -> { channel:'trade:0', liquidation_trades:[{ trade_id, type:'liquidation', market_symbol:'ETH', size, price, usd_amount,
//        is_maker_ask, taker_position_size_before, timestamp }] }
// Measured from here before writing this: the liquidated account is the TAKER (its forced order crosses the book, and
// taker_position_size_before is the position being closed). is_maker_ask false = the maker bid, the taker SOLD = a long
// force-sold; true = the taker bought = a short. usd_amount is the notional. Markets come from /api/v1/orderBooks (perps only,
// active). Coinglass carries Lighter at about 0.7% of the market (4h, 11-14: $3.55M of $492.6M).
// A subscription answers with recent history first, so trades older than the connection by more than two minutes are dropped
// and every trade id is remembered - a reconnect must not book the same liquidation twice.
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

const API = 'https://mainnet.zklighter.elliot.ai/api/v1/orderBooks';

export class LighterCollector extends BaseCollector {
  constructor(opts) {
    super('lighter', opts);
    this.silenceMs = 90000;     // trades print every second on the majors; ninety seconds of nothing is a dead socket
    this.markets = [];          // perp market ids
    this.seen = new Set();
    this.connAt = 0;
  }
  async init() {
    try {
      const j = await (await fetch(API)).json();
      this.markets = (j.order_books || []).filter(b => b && b.market_type === 'perp' && b.status === 'active').map(b => b.market_id);
      log.info('[lighter] markets', { perps: this.markets.length });
    } catch (e) { log.warn('[lighter] market list failed - majors only', { e: String(e) }); this.markets = [0, 1, 2]; }
  }
  url() { this.connAt = Date.now(); return 'wss://mainnet.zklighter.elliot.ai/stream'; }
  subscribeFrames() { return this.markets.map(id => ({ type: 'subscribe', channel: 'trade/' + id })); }
  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    const arr = j && Array.isArray(j.liquidation_trades) ? j.liquidation_trades : null; if (!arr) return [];
    const out = [];
    for (const t of arr) {
      if (!t || t.type !== 'liquidation') continue;
      const id = String(t.trade_id_str || t.trade_id || ''); if (!id || this.seen.has(id)) continue;
      this.seen.add(id); if (this.seen.size > 20000) this.seen = new Set(Array.from(this.seen).slice(-10000));
      const ts = Number(t.timestamp) || Date.now(); if (ts < this.connAt - 120000) continue;
      const sym = String(t.market_symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!sym) continue;
      const price = parseFloat(t.price), qty = parseFloat(t.size), usd = parseFloat(t.usd_amount);
      if (!(price > 0) || !(qty > 0)) continue;
      out.push({ ts, exchange: 'lighter', symbol: sym, side: t.is_maker_ask ? 'short_liquidated' : 'long_liquidated', price, qty, notional: usd > 0 ? usd : price * qty });
    }
    return out;
  }
}
