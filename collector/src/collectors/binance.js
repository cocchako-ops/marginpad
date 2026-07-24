// Binance USDT-M Futures liquidations. Stream: wss://fstream.binance.com/market/ws/!forceOrder@arr
// MIGRATED 2026-07-24: Binance split futures WS into /public /market /private (notice 2026-03-06) and KILLED
// the legacy /ws/ paths on 2026-04-23 — legacy connects fine but pushes NOTHING (that silent mute looked
// exactly like a geo-block and cost us a proxy-hunting detour; it was just a dead endpoint).
// Schema verified at build time from Binance derivatives docs.
//   Message: { e:'forceOrder', E:eventTime, o:{ s:symbol, S:side, q:origQty, p:price, ap:avgPrice, T:tradeTime, ... } }
// QUIRK: this is a SNAPSHOT stream — only the largest liquidation per symbol per ~1000ms is pushed,
//        so totals undercount true liquidation flow. Documented in UI tooltip.
// SIDE:  o.S === 'SELL'  => a LONG position was force-closed (sold)  => 'long_liquidated'
//        o.S === 'BUY'   => a SHORT position was force-closed (bought) => 'short_liquidated'
import { BaseCollector } from './base.js';
import { config } from '../../config.js';
import { log } from '../logger.js';

const SUFFIX = 'USDT';

// Build an HTTP(S)-CONNECT proxy dispatcher from a URL, supporting embedded credentials
// (http://user:pass@host:port). undici's ProxyAgent does HTTP CONNECT — NOT SOCKS.
function makeProxyAgent(ProxyAgent, u) {
  const url = new URL(u);
  const opts = { uri: url.origin };
  if (url.username || url.password) {
    const creds = Buffer.from(decodeURIComponent(url.username) + ':' + decodeURIComponent(url.password)).toString('base64');
    opts.token = 'Basic ' + creds;
  }
  return new ProxyAgent(opts);
}

export class BinanceCollector extends BaseCollector {
  constructor(opts) {
    super('binance', opts);
    // Binance can be genuinely quiet; protocol-level ping/pong keeps the socket alive, so allow long silence.
    this.silenceMs = 6 * 60 * 1000;
    this._set = new Set(this.symbols);
    this._dispatcher = null; // set in init() when a proxy is configured
  }
  url() { return 'wss://fstream.binance.com/market/ws/!forceOrder@arr'; } // /market category since the 2026-04 URL split — forceOrder lives there (verified: legacy /ws/ = mute, /market/ws/ = data)
  wsOptions() { return this._dispatcher ? { dispatcher: this._dispatcher } : undefined; }

  async init() {
    // Binance fstream is geo-restricted in some regions (handshake opens, ZERO data). If a proxy in an
    // allowed region is set, route ONLY this socket through it. Lazy import so a missing `undici` (e.g. the
    // VPS skipped `npm install`) just logs and connects directly instead of crashing the whole collector.
    if (!config.binanceProxy) return;
    try {
      const { ProxyAgent } = await import('undici');
      this._dispatcher = makeProxyAgent(ProxyAgent, config.binanceProxy);
      log.info('[binance] routing via proxy', { proxy: new URL(config.binanceProxy).host });
    } catch (e) {
      log.warn('[binance] proxy setup failed (run `npm install` for undici?) — connecting directly', { e: String(e) });
    }
  }
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
    return instr.slice(0, -SUFFIX.length);   // all-market stream: keep every USDT-margined liquidation
  }
}
