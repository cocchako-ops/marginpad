// UNWIRED 2026-08-16 — NOT loaded by index.js. Deribit no longer publishes liquidations.
// Measured that day, all three ways: (1) 3,000 recent trades over REST (BTC/ETH/USDC futures) carry no
// `liquidation` key and no liquidation-ish key at all — the payload now has starbase_match_id /
// starbase_timestamp / combo_id, i.e. a new matching engine; (2) live WS trade payloads show the same key
// set; (3) every candidate channel (liquidations.*, liquidation.*, forced_liquidations.*,
// trades.*.liquidation) subscribes to [] while control channels (deribit_price_index.btc_usd,
// platform_state.public_methods_state) echo back fine, and public/get_liquidations* is method_not_found.
// Result before unwiring: 0 events in 13.6 days of collector uptime. Re-wire this file (import + the
// collectors[] entry in index.js) if Deribit ever exposes them again — the parser below is unchanged and
// still correct for the OLD schema, so it will need the new flag wired in first.
//
// Deribit liquidations. Endpoint: wss://www.deribit.com/ws/api/v2 (JSON-RPC).
// Deribit has no public liquidation channel, but its `trades` stream flags liquidation fills, so we subscribe
// to the trades channel of EVERY active PERPETUAL and emit the ones carrying a `liquidation` flag.
// Covers the inverse BTC/ETH perps + ~19 USDC-linear alt perps (ADA, AVAX, BNB, DOGE, SOL, XRP, TRX, ...).
//   trade: { instrument_name, price, amount, direction:'buy'|'sell', liquidation:'M'|'T'|'MT', timestamp }
// AMOUNT: inverse perps (BTC-PERPETUAL) => amount is USD => notional = amount, qty = amount/price.
//         linear perps  (SOL_USDC-PERPETUAL) => amount is base coin => qty = amount, notional = amount*price.
// SIDE:  `direction` is the TAKER side; `liquidation` says who got liquidated. If only the maker was
//        liquidated ('M') the liquidated side is opposite the taker; otherwise it's the taker side.
//        sell-side liquidated => long_liquidated, buy-side => short_liquidated.
// Keepalive: public/set_heartbeat(30s); reply to each test_request with public/test.
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

export class DeribitCollector extends BaseCollector {
  constructor(opts) {
    super('deribit', opts);
    this.silenceMs = 40000;       // trades + 30s heartbeat keep messages flowing
    this.staleMs = 0;             // liquidations are sparse; trade flow (not liq events) feeds the watchdog
    this.channels = ['trades.BTC-PERPETUAL.100ms', 'trades.ETH-PERPETUAL.100ms']; // fallback until init()
    this._rpc = 100;
  }
  url() { return 'wss://www.deribit.com/ws/api/v2'; }

  async init() {
    const names = new Set();
    for (const ccy of ['USDC', 'BTC', 'ETH', 'USDT']) {
      try {
        const r = await fetch(`https://www.deribit.com/api/v2/public/get_instruments?currency=${ccy}&kind=future`);
        const j = await r.json();
        for (const it of (j.result || [])) {
          if (it.is_active && /-PERPETUAL$/.test(it.instrument_name)) names.add(it.instrument_name);
        }
      } catch (e) { log.warn('[deribit] instrument fetch failed', { ccy, e: String(e) }); }
    }
    if (names.size) this.channels = [...names].map((n) => 'trades.' + n + '.100ms');
    log.info('[deribit] subscribing to perpetual trade channels', { count: this.channels.length });
  }

  subscribeFrames() {
    const frames = [{ jsonrpc: '2.0', id: 1, method: 'public/set_heartbeat', params: { interval: 30 } }];
    for (let i = 0; i < this.channels.length; i += 20) {
      frames.push({ jsonrpc: '2.0', id: this._rpc++, method: 'public/subscribe', params: { channels: this.channels.slice(i, i + 20) } });
    }
    return frames;
  }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }

    // Heartbeat: reply to test_request so Deribit keeps the connection open.
    if (j.method === 'heartbeat') {
      if (j.params && j.params.type === 'test_request') {
        try { this.ws && this.ws.send(JSON.stringify({ jsonrpc: '2.0', id: this._rpc++, method: 'public/test', params: {} })); } catch {}
      }
      return [];
    }
    if (j.method !== 'subscription' || !j.params || !/^trades\./.test(j.params.channel || '')) return [];

    const out = [];
    for (const t of (Array.isArray(j.params.data) ? j.params.data : [])) {
      if (!t.liquidation) continue;
      const name = t.instrument_name || '';
      const base = name.split(/[-_]/)[0]; if (!base) continue;
      const price = parseFloat(t.price), amount = parseFloat(t.amount);
      if (!(price > 0) || !(amount > 0)) continue;
      const linear = /_USD[CT]-/.test(name);
      const qty = linear ? amount : amount / price;
      const notional = linear ? amount * price : amount;
      const liqDir = t.liquidation === 'M' ? (t.direction === 'buy' ? 'sell' : 'buy') : t.direction;
      const side = liqDir === 'sell' ? 'long_liquidated' : 'short_liquidated';
      out.push({ ts: Number(t.timestamp) || Date.now(), exchange: 'deribit', symbol: base, side, price, qty, notional });
    }
    return out;
  }
}
