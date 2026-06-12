// BaseCollector: resilient single-websocket manager. Subclasses (one per exchange) only declare
// the URL, subscribe frames, ping, and a parse() that returns normalized events. ALL exchange-specific
// quirks live in the subclass — so an API change is a one-file fix.
//
// Normalized event shape emitted via onEvent:
//   { ts, exchange, symbol, side: 'long_liquidated'|'short_liquidated', price, qty, notional }
//
// Uses the global WebSocket (Node >=21) — no 'ws' dependency.
import { log } from '../logger.js';

export class BaseCollector {
  constructor(name, { symbols, onEvent, onState } = {}) {
    this.name = name;
    this.symbols = symbols || [];
    this.onEvent = onEvent || (() => {});
    this.onState = onState || (() => {});
    this.ws = null;
    this.connected = false;
    this.stopped = false;
    this.backoff = 1000;
    this.maxBackoff = 30000;
    this.silenceMs = 35000;        // force reconnect if no message in this long (override per exchange)
    this.lastMsgAt = 0;
    this.lastEventAt = 0;
    this.eventsTotal = 0;
    this._silenceTimer = null;
    this._pingTimer = null;
  }

  // ---- subclass surface (override these) ----
  url() { throw new Error(`${this.name}: url() not implemented`); }
  subscribeFrames() { return []; }     // JSON frames sent on open
  pingFrame() { return null; }         // app-level keepalive ('ping' string or object); null = rely on protocol ping
  pingIntervalMs() { return 20000; }
  async init() {}                       // optional async setup (e.g. OKX contract values)
  parse() { return []; }               // raw message -> array of normalized events

  // ---- lifecycle ----
  start() { this.stopped = false; this._connect(); }
  shutdown() { this.stopped = true; this._clearTimers(); try { this.ws && this.ws.close(); } catch {} }

  _connect() {
    if (this.stopped) return;
    const url = this.url();
    log.info(`[${this.name}] connecting`, { url });
    let ws;
    try { ws = new WebSocket(url); } catch (e) { return this._reconnect('construct: ' + e.message); }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.connected = true;
      this.backoff = 1000;
      this.lastMsgAt = Date.now();
      log.info(`[${this.name}] open`);
      for (const f of this.subscribeFrames()) { try { ws.send(JSON.stringify(f)); } catch (e) { log.warn(`[${this.name}] subscribe send failed`, { e: String(e) }); } }
      this._armSilence();
      this._armPing();
      this.onState();
    });

    ws.addEventListener('message', (ev) => {
      this.lastMsgAt = Date.now();
      this._armSilence();
      let events;
      try { events = this.parse(ev.data); } catch (err) { log.warn(`[${this.name}] parse error`, { err: String(err) }); return; }
      if (events && events.length) {
        for (const e of events) { this.eventsTotal++; this.lastEventAt = Date.now(); this.onEvent(e); }
      }
    });

    ws.addEventListener('close', (ev) => {
      this.connected = false;
      this.onState();
      this._reconnect(`close ${ev && ev.code}`);
    });

    ws.addEventListener('error', (ev) => {
      log.warn(`[${this.name}] ws error`, { msg: ev && ev.message });
      // a 'close' event follows; reconnect is handled there
    });
  }

  _armSilence() {
    clearTimeout(this._silenceTimer);
    this._silenceTimer = setTimeout(() => {
      log.warn(`[${this.name}] silent > ${this.silenceMs}ms — forcing reconnect`);
      try { this.ws && this.ws.close(); } catch {}
    }, this.silenceMs);
  }

  _armPing() {
    clearInterval(this._pingTimer);
    const frame = this.pingFrame();
    if (!frame) return; // protocol-level ping handled by the WebSocket implementation
    this._pingTimer = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === 1) this.ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
      } catch {}
    }, this.pingIntervalMs());
  }

  _clearTimers() { clearTimeout(this._silenceTimer); clearInterval(this._pingTimer); }

  _reconnect(reason) {
    this._clearTimers();
    if (this.stopped) return;
    const wait = Math.min(this.backoff, this.maxBackoff) + Math.floor(Math.random() * 1000); // backoff + jitter
    log.warn(`[${this.name}] reconnect in ${wait}ms`, { reason });
    setTimeout(() => { this.backoff = Math.min(this.backoff * 2, this.maxBackoff); this._connect(); }, wait);
  }

  status() {
    return {
      name: this.name,
      connected: this.connected,
      lastMsgAt: this.lastMsgAt || null,
      lastEventAt: this.lastEventAt || null,
      eventsTotal: this.eventsTotal,
      silentMs: this.lastMsgAt ? Date.now() - this.lastMsgAt : null,
    };
  }
}
