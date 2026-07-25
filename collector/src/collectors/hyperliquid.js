// Hyperliquid liquidation collector (2026-07-25; v3 full-universe 2026-07-24). HL has NO public liquidation
// stream: core-perp liqs are engine-internal (their tx hash resolves to the SetGlobalAction oracle update,
// verified empirically), and the ONLY public evidence is a fill carrying `liquidation:{liquidatedUser,markPx,
// method}` metadata in userFills. Detection strategy ("counterparty harvest"):
//   1. WS `trades` for EVERY listed coin gives [buyer, seller] on each trade — one side of a liquidation trade
//      IS the liquidated user (their forced market order crosses the book).
//   2. Sizeable trades become candidates; a worker polls `userFillsByTime` for those users (rate-limited
//      ~43/min, largest-notional first) and checks each fill's `liquidation` field.
//   3. Confirmed fills are emitted in the normalized shape; dedupe by fill tid.
// v3: coverage = the FULL universe — core perps (~180 live) + every builder dex (xyz stocks/commodities, flx,
// vntl, ...; coin names arrive prefixed "xyz:CL" → emitted uppercased "XYZ:CL", same display as Coinglass).
// Coverage stays notional-weighted: whales and cascades are caught; dust may slip under HL's API weight limits.
import { log } from '../logger.js';

const INFO = 'https://api.hyperliquid.xyz/info';
const MIN_NOTIONAL = 1000;    // candidate threshold ($) — the 15-min fills window amortizes one check across ALL the user's recent liqs
const CHECK_MS = 1400;        // one userFillsByTime per 1.4s ≈ 43/min (HL weight ceiling is ~60/min)
const RECHECK_USER_MS = 600000; // a checked user is silent for 10 min — their window already covered it
const FILLS_WINDOW_MS = 900000; // look at the user's last 15 min of fills (proven in the 8-min diagnostic: 210 liqs found)
const MAX_SUBS = 900;         // HL allows 1000 WS subscriptions/IP — keep headroom
const REFRESH_COINS_MS = 6 * 3600000; // re-pull the universe every 6h (new listings join automatically)

export class HyperliquidLiqCollector {
  constructor({ symbols, onEvent } = {}) {
    this.name = 'hyperliquid';
    this.symbols = symbols || [];
    this.onEvent = onEvent || (() => {});
    this.connected = false; this.lastMsgAt = null; this.lastEventAt = null; this.eventsTotal = 0;
    this.coins = [];                 // full subscription list (core + builder dexs)
    this.candidates = [];            // {user, notional} — unique users seen on sizeable trades
    this.queued = new Set();
    this.checked = new Map();        // user -> last checked ts
    this.seenTid = new Set();        // emitted fill tids
    this.ws = null; this.workerT = null; this.reT = null; this.coinT = null; this.pingT = null; this.wdT = null; this.connStartedAt = null;
  }
  async info(body) {
    const r = await fetch(INFO, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(10000), body: JSON.stringify(body) });
    if (!r.ok) throw new Error('info ' + r.status);
    return r.json();
  }
  async loadCoins() {
    const coins = [];
    const core = await this.info({ type: 'meta' });
    (core.universe || []).forEach(u => { if (u && u.name && !u.isDelisted) coins.push(u.name); });
    let dexs = [];
    try { dexs = (await this.info({ type: 'perpDexs' }) || []).filter(d => d && d.name).map(d => d.name); } catch (e) {}
    for (const dx of dexs.slice(0, 12)) {
      try { const m = await this.info({ type: 'meta', dex: dx }); (m.universe || []).forEach(u => { if (u && u.name && !u.isDelisted) coins.push(u.name); }); } catch (e) {}
    }
    return coins.slice(0, MAX_SUBS);
  }
  async init() {
    try { this.coins = await this.loadCoins(); } catch (e) { this.coins = this.symbols.slice(); } // fallback: at least the majors
    log.info('[hyperliquid] universe', { coins: this.coins.length });
    // periodic refresh: reconnect only when the list actually changed (new listings / delistings)
    this.coinT = setInterval(async () => {
      try {
        const next = await this.loadCoins();
        if (next.length && next.join(',') !== this.coins.join(',')) { this.coins = next; try { if (this.ws) this.ws.close(); } catch (e) {} }
      } catch (e) {}
    }, REFRESH_COINS_MS);
  }
  status() { const now = Date.now(); return { name: this.name, connected: this.connected, lastMsgAt: this.lastMsgAt, lastEventAt: this.lastEventAt, eventsTotal: this.eventsTotal, silentMs: this.lastMsgAt ? now - this.lastMsgAt : null, coins: this.coins.length }; }

  start() {
    this.connect();
    this.workerT = setInterval(() => this.checkNext().catch(() => {}), CHECK_MS);
    this.pingT = setInterval(() => { try { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify({ method: 'ping' })); } catch (e) {} }, 30000); // HL drops idle sockets after ~60s — keep it warm (pong also refreshes lastMsgAt)
    this.wdT = setInterval(() => this.watchdog(), 15000); // self-heal backstop: force a reconnect if the socket is stuck-open or the feed went silent (the event-driven onclose reconnect can't catch those)
  }
  shutdown() { try { if (this.ws) { this.ws.onclose = null; this.ws.close(); } } catch (e) {} if (this.workerT) clearInterval(this.workerT); if (this.reT) clearTimeout(this.reT); if (this.coinT) clearInterval(this.coinT); if (this.pingT) clearInterval(this.pingT); if (this.wdT) clearInterval(this.wdT); }
  watchdog() {
    const now = Date.now();
    if (this.connected) {
      if (this.lastMsgAt && now - this.lastMsgAt > 70000) { log.info('[hyperliquid] watchdog: feed silent, reconnecting', { silentMs: now - this.lastMsgAt }); this.forceReconnect(); } // connected but no trade/pong in 70s across ~900 coins = dead socket
    } else if (!this.reT && (!this.connStartedAt || now - this.connStartedAt > 20000)) { // down with no reconnect pending, or a socket that opened but never fired onopen for 20s
      log.info('[hyperliquid] watchdog: down, forcing reconnect'); this.forceReconnect();
    }
  }
  forceReconnect() {
    try { if (this.ws) { this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null; this.ws.close(); } } catch (e) {}
    this.ws = null; this.connected = false; if (this.reT) { clearTimeout(this.reT); this.reT = null; }
    this.connect();
  }

  connect() {
    this.connStartedAt = Date.now();
    try { this.ws = new WebSocket('wss://api.hyperliquid.xyz/ws'); } catch (e) { return this.reconnect(); }
    this.ws.onopen = () => {
      this.connected = true;
      // stagger the subscribe burst (500+ msgs at once is rude to their gateway)
      const list = this.coins.length ? this.coins : this.symbols;
      let i = 0;
      const send = () => {
        if (!this.ws || this.ws.readyState !== 1) return;
        for (const s of list.slice(i, i + 50)) { try { this.ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'trades', coin: s } })); } catch (e) {} }
        i += 50; if (i < list.length) setTimeout(send, 120);
      };
      send();
      log.info('[hyperliquid] subscribed trades', { coins: list.length });
    };
    this.ws.onmessage = (ev) => {
      this.lastMsgAt = Date.now();
      try {
        const d = JSON.parse(ev.data);
        if (d.channel !== 'trades' || !Array.isArray(d.data)) return;
        for (const t of d.data) {
          const px = +t.px, sz = +t.sz; if (!(px > 0) || !(sz > 0)) continue;
          const notional = px * sz; if (notional < MIN_NOTIONAL) continue;
          // BOTH participants become candidates — a liquidation shows up in EITHER side's fills (the liquidated
          // user's own fill AND the counterparty's fill both carry the liquidation metadata)
          for (const user of (t.users || [])) {
            if (!user) continue;
            const last = this.checked.get(user) || 0; if (Date.now() - last < RECHECK_USER_MS) continue;
            if (this.queued.has(user)) continue; this.queued.add(user);
            this.candidates.push({ user, notional });
          }
          if (this.candidates.length > 500) { this.candidates.sort((a, b) => b.notional - a.notional); this.candidates.length = 250; this.queued = new Set(this.candidates.map(x => x.user)); }
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
    const c = this.candidates.shift(); this.queued.delete(c.user);
    if (Date.now() - (this.checked.get(c.user) || 0) < RECHECK_USER_MS) return;
    this.checked.set(c.user, Date.now());
    if (this.checked.size > 6000) this.checked.clear();
    let fills;
    try {
      const r = await fetch(INFO, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ type: 'userFillsByTime', user: c.user, startTime: Date.now() - FILLS_WINDOW_MS }) });
      if (!r.ok) return;
      fills = await r.json();
    } catch (e) { return; }
    if (!Array.isArray(fills)) return;
    for (const f of fills) {
      if (!f || !f.liquidation) continue;
      const coin = String(f.coin || '');
      if (!coin || coin.charAt(0) === '@' || coin.indexOf('/') >= 0) continue; // spot fills, not perps
      const tid = String(f.tid || f.hash + f.time); if (this.seenTid.has(tid)) continue;
      this.seenTid.add(tid); if (this.seenTid.size > 5000) this.seenTid.clear();
      const px = +f.px, sz = +f.sz; if (!(px > 0) || !(sz > 0)) continue;
      // this user's own fill: liquidated LONG is force-SOLD (side 'A'), liquidated SHORT force-BOUGHT ('B').
      // dir strings ("Close Long"/"Long > Short"…) agree, but side is the stable field.
      const side = f.side === 'A' ? 'long_liquidated' : 'short_liquidated';
      this.lastEventAt = Date.now(); this.eventsTotal++;
      // builder-dex coins arrive as "xyz:CL" → emit "XYZ:CL" (matches Coinglass display); core stay as-is
      this.onEvent({ ts: +f.time || Date.now(), exchange: 'hyperliquid', symbol: coin.toUpperCase(), side, price: px, qty: sz, notional: px * sz });
    }
  }
}
