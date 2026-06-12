// OKX SWAP liquidations. Endpoint: wss://ws.okx.com:8443/ws/v5/public
// Channel: liquidation-orders, instType SWAP. Verified from OKX V5 docs at build time.
//   data[]: { instId, details:[ { side, posSide, sz, bkPx, ts } ] }
// SIDE:  use posSide directly. posSide === 'long' => 'long_liquidated', 'short' => 'short_liquidated'.
//        (Fallback to order `side`: sell => long liquidated, buy => short liquidated.)
// QUIRK: `sz` is in CONTRACTS, not base units. Multiply by the instrument's contract value (ctVal),
//        fetched once from REST /api/v5/public/instruments, to get base quantity + correct notional.
// Keepalive: send the literal text 'ping' every ~25s; server replies 'pong'.
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

export class OkxCollector extends BaseCollector {
  constructor(opts) {
    super('okx', opts);
    this.silenceMs = 35000;
    this._set = new Set(this.symbols);
    this.ctVal = {};            // instId -> contract value (base units per contract)
  }
  url() { return 'wss://ws.okx.com:8443/ws/v5/public'; }
  subscribeFrames() { return [{ op: 'subscribe', args: [{ channel: 'liquidation-orders', instType: 'SWAP' }] }]; }
  pingFrame() { return 'ping'; }
  pingIntervalMs() { return 25000; }

  async init() {
    // Load contract values for tracked USDT swaps so we can convert contracts -> base qty.
    try {
      const r = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP');
      const j = await r.json();
      let n = 0;
      for (const it of (j.data || [])) {
        const m = /^([A-Z0-9]+)-USDT-SWAP$/.exec(it.instId || '');
        if (m && this._set.has(m[1])) { this.ctVal[it.instId] = parseFloat(it.ctVal) || 1; n++; }
      }
      log.info('[okx] loaded contract values', { count: n });
    } catch (e) {
      log.warn('[okx] failed to load contract values — notionals may be off until next start', { e: String(e) });
    }
  }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    if (text === 'pong') return [];
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.event) return []; // subscribe ack / error
    if (!j.arg || j.arg.channel !== 'liquidation-orders' || !Array.isArray(j.data)) return [];
    const out = [];
    for (const row of j.data) {
      const sym = this._norm(row.instId); if (!sym) continue;
      const ct = this.ctVal[row.instId] || 1;
      for (const d of (row.details || [])) {
        const side = d.posSide === 'long' ? 'long_liquidated'
          : d.posSide === 'short' ? 'short_liquidated'
          : d.side === 'sell' ? 'long_liquidated' : 'short_liquidated';
        const price = parseFloat(d.bkPx);
        const qty = parseFloat(d.sz) * ct;
        if (!(price > 0) || !(qty > 0)) continue;
        out.push({ ts: Number(d.ts) || Date.now(), exchange: 'okx', symbol: sym, side, price, qty, notional: price * qty });
      }
    }
    return out;
  }
  _norm(instId) {
    const m = /^([A-Z0-9]+)-USDT-SWAP$/.exec(instId || '');
    return m && this._set.has(m[1]) ? m[1] : null;
  }
}
