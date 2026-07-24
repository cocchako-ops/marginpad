// REST-polling liquidation collectors (2026-07-25) — exchanges with PUBLIC liquidation data over REST but no
// public WS liq stream we can use: Gate.io (futures liq_orders), HTX (linear-swap v3), dYdX v4 (trades with
// type=LIQUIDATED). Same normalized event shape as the WS collectors; polled every few seconds per symbol.
// Verified from this droplet before building: Gate returns live rows, HTX responds 200 (public), dYdX flags liqs.
import { log } from '../logger.js';

class RestPoller {
  constructor(name, { symbols, onEvent, intervalMs }) {
    this.name = name; this.symbols = symbols || []; this.onEvent = onEvent || (() => {});
    this.intervalMs = intervalMs || 10000;
    this.connected = false; this.lastMsgAt = null; this.lastEventAt = null; this.eventsTotal = 0;
    this.seen = new Set(); // poll windows overlap — local dedupe on top of storage.insert's
  }
  status() { const now = Date.now(); return { name: this.name, connected: this.connected, lastMsgAt: this.lastMsgAt, lastEventAt: this.lastEventAt, eventsTotal: this.eventsTotal, silentMs: this.lastMsgAt ? now - this.lastMsgAt : null }; }
  emit(e) {
    const k = e.ts + '|' + e.symbol + '|' + e.price + '|' + e.qty;
    if (this.seen.has(k)) return;
    this.seen.add(k); if (this.seen.size > 3000) this.seen.clear();
    this.lastEventAt = Date.now(); this.eventsTotal++; this.onEvent(e);
  }
  start() {
    const tick = async () => { try { await this.poll(); this.connected = true; this.lastMsgAt = Date.now(); } catch (e) { this.connected = false; log.warn('[' + this.name + '] poll failed', { e: String(e).slice(0, 120) }); } };
    tick(); this.timer = setInterval(tick, this.intervalMs);
  }
  stop() { if (this.timer) clearInterval(this.timer); }
  shutdown() { this.stop(); } // index.js graceful-exit calls shutdown() on every collector
  async getJson(url, opts) { const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 80)); return r.json(); }
}

// Gate.io USDT futures — GET /futures/usdt/liq_orders?contract=X_USDT (public). qty is in CONTRACTS, so the
// quanto_multiplier per contract (fetched once) converts to coin size. order_size < 0 = forced sell = LONG liquidated.
export class GateLiqCollector extends RestPoller {
  constructor(opts) { super('gate', { ...opts, intervalMs: 12000 }); this.mult = {}; this.from = Math.floor(Date.now() / 1000) - 300; }
  async multiplier(c) {
    if (this.mult[c]) return this.mult[c];
    try { const d = await this.getJson('https://api.gateio.ws/api/v4/futures/usdt/contracts/' + c); this.mult[c] = +d.quanto_multiplier || 1; } catch (e) { this.mult[c] = 1; }
    return this.mult[c];
  }
  async poll() {
    const from = this.from; this.from = Math.floor(Date.now() / 1000) - 60; // small overlap; emit() dedupes
    for (const s of this.symbols) {
      const c = s + '_USDT';
      let rows; try { rows = await this.getJson('https://api.gateio.ws/api/v4/futures/usdt/liq_orders?contract=' + c + '&from=' + from + '&limit=100'); } catch (e) { continue; }
      if (!Array.isArray(rows) || !rows.length) { await new Promise(r => setTimeout(r, 120)); continue; }
      const m = await this.multiplier(c);
      for (const o of rows) {
        const px = +o.fill_price || +o.order_price; if (!(px > 0)) continue;
        const qty = Math.abs(+o.size || +o.order_size || 0) * m; if (!(qty > 0)) continue;
        this.emit({ ts: (+o.time || 0) * 1000, exchange: 'gate', symbol: s, side: (+o.order_size || -1) < 0 ? 'long_liquidated' : 'short_liquidated', price: px, qty, notional: qty * px });
      }
      await new Promise(r => setTimeout(r, 120));
    }
  }
}

// HTX linear swaps — GET /linear-swap-api/v3/swap_liquidation_orders (public). direction 'sell' = LONG liquidated.
// `amount` is the coin quantity when present; falls back to volume (contracts) which for HTX linear is coin-ish.
export class HtxLiqCollector extends RestPoller {
  constructor(opts) { super('htx', { ...opts, intervalMs: 20000 }); this.since = Date.now() - 300000; }
  async poll() {
    const start = this.since; this.since = Date.now() - 60000;
    for (const s of this.symbols) {
      let d; try { d = await this.getJson('https://api.hbdm.com/linear-swap-api/v3/swap_liquidation_orders?contract=' + s + '-USDT&trade_type=0&start_time=' + start); } catch (e) { continue; }
      const rows = (d && d.data) || [];
      for (const o of rows) {
        const px = +o.price; if (!(px > 0)) continue;
        const qty = +o.amount || +o.volume || 0; if (!(qty > 0)) continue;
        this.emit({ ts: +o.created_at || Date.now(), exchange: 'htx', symbol: s, side: String(o.direction).toLowerCase() === 'sell' ? 'long_liquidated' : 'short_liquidated', price: px, qty, notional: qty * px });
      }
      await new Promise(r => setTimeout(r, 150));
    }
  }
}

// dYdX v4 — GET /v4/trades/perpetualMarket/X-USD (public); liquidations arrive as trades with type LIQUIDATED.
// SELL liquidation trade = a long got closed. Markets exist for the majors; missing ones just 404 and are skipped.
export class DydxLiqCollector extends RestPoller {
  constructor(opts) { super('dydx', { ...opts, intervalMs: 12000 }); }
  async poll() {
    for (const s of this.symbols) {
      let d; try { d = await this.getJson('https://indexer.dydx.trade/v4/trades/perpetualMarket/' + s + '-USD?limit=100'); } catch (e) { continue; }
      for (const t of (d && d.trades) || []) {
        if (t.type !== 'LIQUIDATED' && t.type !== 'DELEVERAGED') continue;
        const px = +t.price, qty = +t.size; if (!(px > 0) || !(qty > 0)) continue;
        this.emit({ ts: Date.parse(t.createdAt) || Date.now(), exchange: 'dydx', symbol: s, side: t.side === 'SELL' ? 'long_liquidated' : 'short_liquidated', price: px, qty, notional: qty * px });
      }
      await new Promise(r => setTimeout(r, 120));
    }
  }
}
