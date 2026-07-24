// Hyperliquid liquidation collector (2026-07-25). HL has NO public liquidation stream: core-perp liqs are
// engine-internal (their tx hash resolves to the SetGlobalAction oracle update, verified empirically), and
// the ONLY public evidence is a fill carrying `liquidation:{liquidatedUser,markPx,method}` metadata in
// userFills. Detection strategy ("counterparty harvest"):
//   1. WS `trades` for our coins gives [buyer, seller] on EVERY trade — the aggressor of a liquidation trade
//      IS the liquidated user (their forced market order crosses the book).
//   2. Sizeable trades become candidates; a worker polls `userFillsByTime` for the aggressor around the trade
//      time (rate-limited ~45/min, largest-notional first) and checks the fill's `liquidation` field.
//   3. Confirmed fills are emitted in the normalized shape; dedupe by fill tid.
// Coverage is deliberately notional-weighted: whales and cascades (what Rekt/heatmap care about) are caught;
// sub-$3k dust may slip — an honest trade-off vs HL's API weight limits. Full coverage would need an HL node.
import { log } from '../logger.js';

const INFO = 'https://api.hyperliquid.xyz/info';
const MIN_NOTIONAL = 3000;    // candidate threshold ($) — below this we don't spend rate-limit budget
const CHECK_MS = 1400;        // one userFillsByTime per 1.4s ≈ 43/min (HL weight ceiling is ~60/min)
const RECHECK_USER_MS = 60000;

export class HyperliquidLiqCollector {
  constructor({ symbols, onEvent } = {}) {
    this.name = 'hyperliquid';
    this.symbols = symbols || [];
    this.onEvent = onEvent || (() => {});
    this.connected = false; this.lastMsgAt = null; this.lastEventAt = null; this.eventsTotal = 0;
    this.candidates = [];            // {user, time, coin, notional}
    this.checked = new Map();        // user -> last checked ts
    this.seenTid = new Set();        // emitted fill tids
    this.ws = null; this.workerT = null; this.reT = null;
  }
  async init() {}
  status() { const now = Date.now(); return { name: this.name, connected: this.connected, lastMsgAt: this.lastMsgAt, lastEventAt: this.lastEventAt, eventsTotal: this.eventsTotal, silentMs: this.lastMsgAt ? now - this.lastMsgAt : null }; }

  start() {
    this.connect();
    this.workerT = setInterval(() => this.checkNext().catch(() => {}), CHECK_MS);
  }
  shutdown() { try { if (this.ws) { this.ws.onclose = null; this.ws.close(); } } catch (e) {} if (this.workerT) clearInterval(this.workerT); if (this.reT) clearTimeout(this.reT); }

  connect() {
    try { this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws'); } catch (e) { return this.reconnect(); }
    this.ws.onopen = () => {
      this.connected = true;
      for (const s of this.symbols) { try { this.ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin: s } })); } catch (e) {} }
      log.info('[hyperliquid] subscribed trades', { coins: this.symbols.length });
    };
    this.ws.onmessage = (ev) => {
      this.lastMsgAt = Date.now();
      try {
        const d = JSON.parse(ev.data);
        if (d.channel !== 'trades' || !Array.isArray(d.data)) return;
        for (const t of d.data) {
          const px = +t.px, sz = +t.sz; if (!(px > 0) || !(sz > 0)) continue;
          const notional = px * sz; if (notional < MIN_NOTIONAL) continue;
          // aggressor = the forced order in a liquidation: side 'B' → buyer (users[0]), side 'A' → seller (users[1])
          const user = t.side === 'B' ? (t.users && t.users[0]) : (t.users && t.users[1]); if (!user) continue;
          const last = this.checked.get(user) || 0; if (Date.now() - last < RECHECK_USER_MS) continue;
          this.candidates.push({ user, time: +t.time, coin: String(t.coin), notional });
          if (this.candidates.length > 300) { this.candidates.sort((a, b) => b.notional - a.notional); this.candidates.length = 150; }
        }
      } catch (e) {}
    };
    this.ws.onclose = () => { this.connected = false; this.reconnect(); };
    this.ws.onerror = () => { try { this.ws.close(); } catch (e) {} };
  }
  reconnect() { if (this.reT) return; this.reT = setTimeout(() => { this.reT = null; this.connect(); }, 3000); }

  async checkNext() {
    if (!this.candidates.length) return;
    this.candidates.sort((a, b) => b.notional - a.notional);
    const c = this.candidates.shift();
    if (Date.now() - (this.checked.get(c.user) || 0) < RECHECK_USER_MS) return;
    this.checked.set(c.user, Date.now());
    if (this.checked.size > 4000) this.checked.clear();
    let fills;
    try {
      const r = await fetch(INFO, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ type: 'userFillsByTime', user: c.user, startTime: c.time - 30000, endTime: c.time + 30000 }) });
      if (!r.ok) return;
      fills = await r.json();
    } catch (e) { return; }
    if (!Array.isArray(fills)) return;
    for (const f of fills) {
      if (!f || !f.liquidation) continue;
      const coin = String(f.coin || ''); if (coin.indexOf(':') >= 0) continue; // builder-dex assets (xyz:ORCL…) are not our market
      if (this.symbols.indexOf(coin) < 0) continue;
      const tid = String(f.tid || f.hash + f.time); if (this.seenTid.has(tid)) continue;
      this.seenTid.add(tid); if (this.seenTid.size > 5000) this.seenTid.clear();
      const px = +f.px, sz = +f.sz; if (!(px > 0) || !(sz > 0)) continue;
      // this user's own fill: liquidated LONG is force-SOLD (side 'A'), liquidated SHORT force-BOUGHT ('B').
      // dir strings ("Close Long"/"Long > Short"…) agree, but side is the stable field.
      const side = f.side === 'A' ? 'long_liquidated' : 'short_liquidated';
      this.lastEventAt = Date.now(); this.eventsTotal++;
      this.onEvent({ ts: +f.time || Date.now(), exchange: 'hyperliquid', symbol: coin, side, price: px, qty: sz, notional: px * sz });
    }
  }
}
