// OKX SWAP liquidations. Endpoint: wss://ws.okx.com:8443/ws/v5/public
// Channel: liquidation-orders, instType SWAP. Verified from OKX V5 docs at build time.
//   data[]: { instId, details:[ { side, posSide, sz, bkPx, ts } ] }
// SIDE:  use posSide directly. posSide === 'long' => 'long_liquidated', 'short' => 'short_liquidated'.
//        (Fallback to order `side`: sell => long liquidated, buy => short liquidated.)
// QUIRK: `sz` is in CONTRACTS, not base units. Multiply by the instrument's contract value (ctVal),
//        fetched once from REST /api/v5/public/instruments, to get base quantity + correct notional.
// Keepalive: send the literal text 'ping' every ~25s; server replies 'pong'.
import { BaseCollector } from './base.js';
import { config } from '../../config.js';
import { log } from '../logger.js';

// OKX edge-blocks some datacenter/region IPs (handshake refused). Two public endpoints exist (default + AWS);
// we rotate across them on every (re)connect so a block on one edge auto-heals onto the other — no manual change.
const OKX_ENDPOINTS = ['wss://ws.okx.com:8443/ws/v5/public', 'wss://wsaws.okx.com:8443/ws/v5/public'];

// HTTP-CONNECT proxy dispatcher (undici) — same helper Binance uses. NOT for SOCKS.
function makeProxyAgent(ProxyAgent, u) {
  const url = new URL(u);
  const opts = { uri: url.origin };
  if (url.username || url.password) opts.token = 'Basic ' + Buffer.from(decodeURIComponent(url.username) + ':' + decodeURIComponent(url.password)).toString('base64');
  return new ProxyAgent(opts);
}

export class OkxCollector extends BaseCollector {
  constructor(opts) {
    super('okx', opts);
    this.silenceMs = 35000;
    this.staleMs = 6 * 60 * 1000; // OKX streams ALL swaps — a 6-min event gap means a dead subscription
    this.ctVal = {};              // instId -> contract value (base units per contract)
    this._epi = 0;                // current endpoint index (sticky)
    this._gotData = false;        // did the CURRENT connection receive any frame?
    this._notFirst = false;       // url() has been called at least once
    this._dispatcher = null;      // set in init() when OKX_PROXY is configured
  }
  // Sticky-with-failover: stay on the endpoint that works; rotate to the other edge ONLY when the previous
  // connection delivered no frame at all (that edge is blocked for our IP). Stops the 12-min socket refresh
  // from bouncing us onto a blocked endpoint every other cycle.
  url() {
    if (this._notFirst && !this._gotData) this._epi++;   // previous edge was silent → try the other one
    this._notFirst = true;
    this._gotData = false;
    return OKX_ENDPOINTS[this._epi % OKX_ENDPOINTS.length];
  }
  wsOptions() { return this._dispatcher ? { dispatcher: this._dispatcher } : undefined; }
  subscribeFrames() { return [{ op: 'subscribe', args: [{ channel: 'liquidation-orders', instType: 'SWAP' }] }]; }
  pingFrame() { return 'ping'; }
  pingIntervalMs() { return 25000; }

  async init() {
    // Optional proxy: if OKX_PROXY is set, route this socket (and the REST below) through an allowed-region
    // HTTP CONNECT proxy — the definitive fix when OKX edge-blocks the server IP. Empty = connect directly.
    if (config.okxProxy) {
      try { const { ProxyAgent } = await import('undici'); this._dispatcher = makeProxyAgent(ProxyAgent, config.okxProxy); log.info('[okx] routing via proxy', { proxy: new URL(config.okxProxy).host }); }
      catch (e) { log.warn('[okx] proxy setup failed (run `npm install` for undici?) — connecting directly', { e: String(e) }); }
    }
    // Load contract values for tracked USDT swaps so we can convert contracts -> base qty.
    try {
      const r = await fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP', this._dispatcher ? { dispatcher: this._dispatcher } : undefined);
      const j = await r.json();
      let n = 0;
      for (const it of (j.data || [])) {
        if (/^[A-Z0-9]+-USDT-SWAP$/.test(it.instId || '')) { this.ctVal[it.instId] = parseFloat(it.ctVal) || 1; n++; }
      }
      log.info('[okx] loaded contract values', { count: n });
    } catch (e) {
      log.warn('[okx] failed to load contract values — notionals may be off until next start', { e: String(e) });
    }
  }

  parse(raw) {
    this._gotData = true;   // any frame (data / ack / pong) proves this endpoint is live → keep it
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    if (text === 'pong') return [];
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.event) { if (j.event === 'error') log.warn('[okx] error frame', { code: j.code, msg: j.msg, connId: j.connId }); return []; } // ack / error
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
    return m ? m[1] : null;   // capture EVERY USDT-swap liquidation, market-wide
  }
}
