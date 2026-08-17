// Bitfinex liquidations. Endpoint: wss://api-pub.bitfinex.com/ws/2
// Channel: status, key 'liq:global' — a PUBLIC market-wide feed of every derivative liquidation.
// Verified live from this region. Each entry (prefixed "pos"):
//   ["pos", POS_ID, MTS, _, SYMBOL, AMOUNT, BASE_PRICE, _, IS_MATCH, IS_MARKET_SOLD, _, PRICE_ACQUIRED]
//   SYMBOL: tBTCF0:USTF0 -> BTC, tTONF0:USTF0 -> TON (perp = t<BASE>F0:USTF0).
//   AMOUNT: position size in base units; sign = direction. >0 long liquidated, <0 short liquidated.
//   PRICE:  use PRICE_ACQUIRED when present (actual fill), else BASE_PRICE.
// Keepalive: server sends per-channel 'hb' heartbeats (~15s) so the silence watchdog stays fed; no app ping.
import { BaseCollector } from './base.js';

const SYM_RE = /^t([A-Z0-9]+)F0:/; // t<BASE>F0:USTF0

export class BitfinexCollector extends BaseCollector {
  constructor(opts) {
    super('bitfinex', opts);
    this.silenceMs = 40000; // 'hb' every ~15s keeps this well-fed
    this.staleMs = 0;       // liquidations are sparse; don't event-stale
  }
  url() { return 'wss://api-pub.bitfinex.com/ws/2'; }
  subscribeFrames() { return [{ event: 'subscribe', channel: 'status', key: 'liq:global' }]; }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (!Array.isArray(j)) return [];        // {event:info|subscribed|...}
    const payload = j[1];
    if (!Array.isArray(payload)) return [];   // 'hb' heartbeat or empty
    // update = a single ["pos", ...]; snapshot = [ ["pos",...], ["pos",...] ]
    const rows = Array.isArray(payload[0]) ? payload : [payload];
    const out = [];
    for (const row of rows) {
      if (!Array.isArray(row) || row[0] !== 'pos') continue;
      const m = SYM_RE.exec(row[4] || ''); if (!m) continue;
      // TESTBTC/TESTUSD etc. are Bitfinex PAPER-TRADING instruments — real fills, but not a real
      // market. They were inflating our 24h totals and one of them surfaced as "the single largest
      // liquidation" on /rekt/ (2026-08-17). Never emit them.
      if (/^TEST/i.test(m[1])) continue;
      const amount = parseFloat(row[5]);
      const price = parseFloat(row[11] != null ? row[11] : row[6]);
      if (!(price > 0) || !(amount !== 0)) continue;
      const side = amount > 0 ? 'long_liquidated' : 'short_liquidated';
      const qty = Math.abs(amount);
      out.push({ ts: Number(row[2]) || Date.now(), exchange: 'bitfinex', symbol: m[1], side, price, qty, notional: qty * price });
    }
    return out;
  }
}
