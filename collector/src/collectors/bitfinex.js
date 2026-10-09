// Bitfinex liquidations. Endpoint: wss://api-pub.bitfinex.com/ws/2
// Channel: status, key 'liq:global' - a PUBLIC market-wide feed of every derivative liquidation.
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
    // POS_ID -> first-seen ts. liq:global re-reports the SAME position many times while it is being
    // ground down (and re-lists everything in-progress in the snapshot on every reconnect), and each
    // update carries a fresh MTS/price - so the DB dedup key (ts,price,qty) never catches it. One
    // 2314-BTC position was re-counted into ~$848M of phantom longs in a single day (found
    // 2026-08-21). A liquidation is ONE event: emit each POS_ID once, remember it for 7 days.
    this._seenPos = new Map();
  }

  // AND THAT MEMORY HAS TO OUTLIVE THE PROCESS (2026-10-09). The Map above stops a position being counted
  // twice inside one run, and it is RAM - so every restart forgot it, while Bitfinex re-lists everything
  // still in progress in its subscribe snapshot with a fresh MTS and a fresh PRICE_ACQUIRED, which the DB
  // dedup key (ts, price, qty) cannot catch. Measured on production: the same ~2284-BTC BTC long was
  // written twice two days apart, $195.4M and $192.6M - 15.9% of the published 24h total, 34% of the
  // 7-day one, Bitfinex third on the venue table at 16% of all flow, and the newer of the two served as
  // "the biggest liquidation today" on an SSR page that assistants cite. The 2026-08-21 fix was right and
  // only half applied: it was never persisted, and this collector reconnects dozens of times a day.
  // Dumped with the tape rings every two minutes and read back once before the socket opens; a few hundred
  // entries, so it costs neither time nor bytes worth measuring.
  dump() { return { v: 1, pos: Array.from(this._seenPos.entries()) }; }
  restore(obj) {
    const rows = (obj && Array.isArray(obj.pos)) ? obj.pos : [];
    const cut = Date.now() - 7 * 86400000;   // the same 7-day memory the live prune keeps
    let n = 0;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length < 2) continue;
      const ts = Number(row[1]);
      if (!(ts >= cut)) continue;            // older than the memory window: it can no longer be re-reported as new
      this._seenPos.set(row[0], ts); n++;
    }
    return n;
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
    const now = Date.now();
    if (this._seenPos.size > 5000 || (this._lastPrune || 0) < now - 3600000) { // hourly prune, 7-day memory
      this._lastPrune = now;
      for (const [id, ts] of this._seenPos) if (ts < now - 7 * 86400000) this._seenPos.delete(id);
    }
    for (const row of rows) {
      if (!Array.isArray(row) || row[0] !== 'pos') continue;
      const posId = row[1];
      if (posId != null) {
        if (this._seenPos.has(posId)) continue; // an update/snapshot re-report of a position we already counted
        this._seenPos.set(posId, now);
      }
      const m = SYM_RE.exec(row[4] || ''); if (!m) continue;
      // TESTBTC/TESTUSD etc. are Bitfinex PAPER-TRADING instruments - real fills, but not a real
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
