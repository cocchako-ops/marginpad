// BitMEX liquidations. Endpoint: wss://www.bitmex.com/realtime
// Topic: `liquidation` (ONE subscription = ALL symbols, market-wide). Verified from BitMEX API at build time.
//   table 'liquidation', action 'partial'|'insert'|'update'|'delete', data:[{orderID, symbol, side, price, leavesQty}]
//   We emit on action==='insert' only — a NEW liquidation order. (partial = snapshot of standing orders on
//   connect; emitting it would re-ingest the same orders on every reconnect/recycle.)
// SIDE:  the liquidation ORDER side. side==='Sell' liquidates a LONG => long_liquidated; 'Buy' => short_liquidated.
// SIZE:  leavesQty is in CONTRACTS. We fetch instrument metadata once to convert to base qty + USD notional:
//   - inverse USD perp (XBTUSD): 1 contract = 1 USD  => notional = contracts, qty = contracts / price
//   - linear  (e.g. SOLUSDT):    qty = contracts / underlyingToPositionMultiplier, notional = qty * price
//   - quanto: skipped (multiplier semantics don't give a clean USD notional).
// Keepalive: send literal 'ping' (server replies 'pong'); keeps the silence watchdog fed during calm periods
//   because the liquidation table is push-only and goes quiet when nothing is liquidating.
import { BaseCollector } from './base.js';
import { log } from '../logger.js';

export class BitmexCollector extends BaseCollector {
  constructor(opts) {
    super('bitmex', opts);
    this.silenceMs = 40000;  // fed by ping/pong (~15s) — no reconnect storms during calm
    this.staleMs = 0;        // liquidations are sparse here; do NOT event-stale (would thrash when quiet)
    this.meta = {};          // symbol -> { base, isInverse, isQuanto, u2pm }
  }
  url() { return 'wss://www.bitmex.com/realtime'; }
  subscribeFrames() { return [{ op: 'subscribe', args: ['liquidation'] }]; }
  pingFrame() { return 'ping'; }
  pingIntervalMs() { return 15000; }

  async init() {
    try {
      const cols = 'symbol,underlying,quoteCurrency,isInverse,isQuanto,underlyingToPositionMultiplier';
      const r = await fetch('https://www.bitmex.com/api/v1/instrument/active?columns=' + encodeURIComponent(cols));
      const arr = await r.json();
      let n = 0;
      for (const it of (Array.isArray(arr) ? arr : [])) {
        if (!it.symbol) continue;
        const base = (it.underlying === 'XBT' ? 'BTC' : it.underlying) || it.symbol;
        this.meta[it.symbol] = { base, isInverse: !!it.isInverse, isQuanto: !!it.isQuanto, u2pm: parseFloat(it.underlyingToPositionMultiplier) || 0 };
        n++;
      }
      log.info('[bitmex] loaded instrument metadata', { count: n });
    } catch (e) {
      log.warn('[bitmex] failed to load instrument metadata — will skip unknown symbols', { e: String(e) });
    }
  }

  parse(raw) {
    const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw);
    if (text === 'pong' || text === 'ping') return [];
    let j; try { j = JSON.parse(text); } catch { return []; }
    if (j.table !== 'liquidation' || j.action !== 'insert' || !Array.isArray(j.data)) return []; // ignore welcome/subscribe/partial/update/delete
    const out = [];
    for (const d of j.data) {
      const m = this.meta[d.symbol];
      if (!m || m.isQuanto) continue;                 // skip unknown + quanto (no clean USD notional)
      const price = parseFloat(d.price), contracts = parseFloat(d.leavesQty);
      if (!(price > 0) || !(contracts > 0)) continue;
      let qty, notional;
      if (m.isInverse) { notional = contracts; qty = contracts / price; }      // 1 contract = 1 USD
      else { if (!(m.u2pm > 0)) continue; qty = contracts / m.u2pm; notional = qty * price; }
      const side = d.side === 'Sell' ? 'long_liquidated' : 'short_liquidated';
      out.push({ ts: Date.now(), exchange: 'bitmex', symbol: m.base, side, price, qty, notional });
    }
    return out;
  }
}
