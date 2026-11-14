// REST-polling liquidation collectors (2026-07-25) - exchanges with PUBLIC liquidation data over REST but no
// public WS liq stream we can use: Gate.io (futures liq_orders), HTX (linear-swap v3), dYdX v4 (trades with
// type=LIQUIDATED). Same normalized event shape as the WS collectors.
// EVERY MARKET, NOT TEN (2026-11-14 evening, owner: "hocu da budemo sigurni da ... pokrivamo i obradjujemo podatke 100%"). Until
// today all three polled config.symbols - BTC ETH SOL XRP DOGE BNB ADA LINK AVAX LTC - so every other coin on these venues was
// invisible (measured: in 35 minutes Gate liquidated on 224 contracts). Gate answers every contract in one call (paged with `to`),
// HTX and dYdX are walked market by market from their own contract lists. A poll never overlaps the previous one (`busy`), and a
// page that comes back full is either paged (Gate) or counted as `truncated` in /status (HTX, dYdX) - a cap is never silent.
import { log } from '../logger.js';

class RestPoller {
  constructor(name, { symbols, onEvent, intervalMs }) {
    this.name = name; this.symbols = symbols || []; this.onEvent = onEvent || (() => {});
    this.intervalMs = intervalMs || 10000;
    this.connected = false; this.lastMsgAt = null; this.lastEventAt = null; this.eventsTotal = 0;
    this.seen = new Set(); // poll windows overlap - local dedupe on top of storage.insert's
    this.busy = false; this.truncated = 0; this.markets = 0; this.lastCycleMs = 0;
  }
  status() { const now = Date.now(); return { name: this.name, connected: this.connected, lastMsgAt: this.lastMsgAt, lastEventAt: this.lastEventAt, eventsTotal: this.eventsTotal, silentMs: this.lastMsgAt ? now - this.lastMsgAt : null, markets: this.markets, cycleMs: this.lastCycleMs, truncated: this.truncated }; }
  emit(e) {
    const k = e.ts + '|' + e.symbol + '|' + e.side + '|' + e.price + '|' + e.qty;
    if (this.seen.has(k)) return;
    this.seen.add(k); if (this.seen.size > 40000) this.seen = new Set(Array.from(this.seen).slice(-20000)); // trim, never clear (a clear re-emits the overlap)
    this.lastEventAt = Date.now(); this.eventsTotal++; this.onEvent(e);
  }
  start() {
    const tick = async () => {
      if (this.busy) return; this.busy = true; const t0 = Date.now();
      try { await this.poll(); this.connected = true; this.lastMsgAt = Date.now(); this.lastCycleMs = Date.now() - t0; }
      catch (e) { this.connected = false; log.warn('[' + this.name + '] poll failed', { e: String(e).slice(0, 120) }); }
      finally { this.busy = false; }
    };
    tick(); this.timer = setInterval(tick, this.intervalMs);
  }
  async init() {} // BaseCollector API parity - index.js awaits init() on every collector before start()
  stop() { if (this.timer) clearInterval(this.timer); }
  shutdown() { this.stop(); } // index.js graceful-exit calls shutdown() on every collector
  async getJson(url, opts) { const r = await fetch(url, { signal: AbortSignal.timeout(8000), ...opts }); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 80)); return r.json(); }
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// Gate.io USDT futures - GET /futures/usdt/liq_orders (public). Without `contract` it answers EVERY contract, newest first, up to
// 1000 rows; a full page is paged back with `to`. size/order_size are in CONTRACTS -> quanto_multiplier per contract (whole list,
// refreshed hourly). order_size < 0 = a forced sell = LONG liquidated (size is the position: negative = a short).
export class GateLiqCollector extends RestPoller {
  constructor(opts) { super('gate', { ...opts, intervalMs: 10000 }); this.mult = {}; this.multAt = 0; this.from = Math.floor(Date.now() / 1000) - 300; }
  async loadMult() {
    if (Date.now() - this.multAt < 3600000 && this.multAt) return;
    try { const a = await this.getJson('https://api.gateio.ws/api/v4/futures/usdt/contracts'); for (const c of a || []) this.mult[c.name] = +c.quanto_multiplier || 1; this.markets = (a || []).length; this.multAt = Date.now(); }
    catch (e) { log.warn('[gate] contract list failed', { e: String(e).slice(0, 120) }); }
  }
  async poll() {
    await this.loadMult();
    const from = this.from; const now = Math.floor(Date.now() / 1000); this.from = now - 60; // a minute of overlap; emit() dedupes
    let to = null;
    for (let page = 0; page < 20; page++) {
      const rows = await this.getJson('https://api.gateio.ws/api/v4/futures/usdt/liq_orders?from=' + from + (to ? '&to=' + to : '') + '&limit=1000');
      if (!Array.isArray(rows) || !rows.length) break;
      for (const o of rows) {
        const m = /^([A-Z0-9]+)_USDT$/.exec(String(o.contract || '')); if (!m) continue;
        const px = +o.fill_price || +o.order_price; if (!(px > 0)) continue;
        const qty = Math.abs(+o.size || +o.order_size || 0) * (this.mult[o.contract] || 1); if (!(qty > 0)) continue;
        this.emit({ ts: (+o.time || 0) * 1000, exchange: 'gate', symbol: m[1], side: (+o.order_size || -1) < 0 ? 'long_liquidated' : 'short_liquidated', price: px, qty, notional: qty * px });
      }
      if (rows.length < 1000) break;
      const oldest = Math.min(...rows.map(o => +o.time || 0)); if (!(oldest > from)) break;
      to = oldest; if (page === 19) this.truncated++;
      await this.sleep(150);
    }
  }
}

// HTX linear swaps - GET /linear-swap-api/v3/swap_liquidation_orders (public, `contract` REQUIRED). direction 'sell' = LONG
// liquidated. `amount` is the coin quantity. Contracts from swap_contract_info (status 1), refreshed hourly; ~420 of them, so a
// cycle is ~45 s and each window reaches back two minutes past its own start.
export class HtxLiqCollector extends RestPoller {
  constructor(opts) { super('htx', { ...opts, intervalMs: 15000 }); this.since = Date.now() - 300000; this.list = []; this.listAt = 0; }
  async loadList() {
    if (this.listAt && Date.now() - this.listAt < 3600000) return;
    try { const d = await this.getJson('https://api.hbdm.com/linear-swap-api/v1/swap_contract_info?business_type=swap'); const l = ((d && d.data) || []).filter(c => c.contract_status === 1 && /^[A-Z0-9]+-USDT$/.test(c.contract_code)).map(c => c.contract_code); if (l.length) { this.list = l; this.listAt = Date.now(); this.markets = l.length; } }
    catch (e) { log.warn('[htx] contract list failed', { e: String(e).slice(0, 120) }); }
    if (!this.list.length) this.list = this.symbols.map(s => s + '-USDT');
  }
  async poll() {
    await this.loadList();
    const start = this.since; this.since = Date.now() - 120000;
    const one = async (c) => {
      let d; try { d = await this.getJson('https://api.hbdm.com/linear-swap-api/v3/swap_liquidation_orders?contract=' + c + '&trade_type=0&start_time=' + start); } catch (e) { return; }
      const rows = (d && d.data) || [];
      if (rows.length >= 100) this.truncated++;
      const sym = c.replace(/-USDT$/, '');
      for (const o of rows) {
        const px = +o.price; if (!(px > 0)) continue;
        const qty = +o.amount || +o.volume || 0; if (!(qty > 0)) continue;
        this.emit({ ts: +o.created_at || Date.now(), exchange: 'htx', symbol: sym, side: String(o.direction).toLowerCase() === 'sell' ? 'long_liquidated' : 'short_liquidated', price: px, qty, notional: qty * px });
      }
    };
    // four at a time: one by one, 418 contracts took ~170 s a cycle (measured); public market endpoints allow far more than this
    for (let i = 0; i < this.list.length; i += 4) { await Promise.all(this.list.slice(i, i + 4).map(one)); await this.sleep(120); }
  }
}

// dYdX v4 - GET /v4/trades/perpetualMarket/X-USD (public); liquidations arrive as trades with type LIQUIDATED (DELEVERAGED kept:
// a forced close too). SELL = a long got closed. Every ACTIVE market from /v4/perpetualMarkets, refreshed hourly.
export class DydxLiqCollector extends RestPoller {
  constructor(opts) { super('dydx', { ...opts, intervalMs: 12000 }); this.list = []; this.listAt = 0; }
  async loadList() {
    if (this.listAt && Date.now() - this.listAt < 3600000) return;
    try { const d = await this.getJson('https://indexer.dydx.trade/v4/perpetualMarkets'); const l = Object.values((d && d.markets) || {}).filter(m => m.status === 'ACTIVE').map(m => m.ticker).filter(t => /^[A-Z0-9]+-USD$/.test(t)); if (l.length) { this.list = l; this.listAt = Date.now(); this.markets = l.length; } }
    catch (e) { log.warn('[dydx] market list failed', { e: String(e).slice(0, 120) }); }
    if (!this.list.length) this.list = this.symbols.map(s => s + '-USD');
  }
  async poll() {
    await this.loadList();
    this.prev = this.prev || {};
    for (const mk of this.list) {
      // the endpoint answers the newest 100 trades of ANY type; page back (createdBeforeOrAt) until the previous poll is reached,
      // or a busy market would hide liquidations between two polls behind its ordinary fills
      const prev = this.prev[mk] || (Date.now() - 300000); const pollAt = Date.now(); let trades = [], before = null, reached = false;
      for (let p = 0; p < 6; p++) {
        let d; try { d = await this.getJson('https://indexer.dydx.trade/v4/trades/perpetualMarket/' + mk + '?limit=100' + (before ? '&createdBeforeOrAt=' + encodeURIComponent(before) : '')); } catch (e) { break; }
        const page = (d && d.trades) || []; trades = trades.concat(page);
        if (page.length < 100) { reached = true; break; }
        const oldest = page[page.length - 1]; if (Date.parse(oldest.createdAt) <= prev) { reached = true; break; }
        before = oldest.createdAt; await this.sleep(80);
      }
      if (!reached) this.truncated++;
      this.prev[mk] = pollAt - 30000;
      // only the window since the previous poll (a quiet market's newest 100 trades reach back days - never backfill old days)
      const liq = trades.filter(t => (t.type === 'LIQUIDATED' || t.type === 'DELEVERAGED') && Date.parse(t.createdAt) >= prev - 60000);
      const sym = mk.replace(/-USD$/, '');
      for (const t of liq) {
        const px = +t.price, qty = +t.size; if (!(px > 0) || !(qty > 0)) continue;
        this.emit({ ts: Date.parse(t.createdAt) || Date.now(), exchange: 'dydx', symbol: sym, side: t.side === 'SELL' ? 'long_liquidated' : 'short_liquidated', price: px, qty, notional: qty * px });
      }
      await this.sleep(100);
    }
  }
}
