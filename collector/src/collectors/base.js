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
    this.silenceMs = 35000;        // force reconnect if no message (incl. pings) in this long
    this.maxLifeMs = 12 * 60 * 1000; // proactively recycle the socket every ~12 min (backstop vs zombies)
    this.staleMs = 0;              // if >0: reconnect when an exchange that HAS delivered events goes this long
                                   // with no NEW event. Safe only with broad symbol coverage (market always
                                   // liquidates something), so a long event-gap reliably means a dead subscription.
    this.lastMsgAt = 0;
    this.lastEventAt = 0;
    this.eventsTotal = 0;
    this.connectMs = 20000;        // handshake must produce 'open' within this long, or the attempt is retried
    this._silenceTimer = null;
    this._pingTimer = null;
    this._lifeTimer = null;
    this._staleTimer = null;
    this._connectTimer = null;
    this._gen = 0;                 // socket generation — handlers of a superseded socket must never touch the live one
    this._reconnPending = false;   // one reconnect per socket, whichever of error/close/timeout fires first
    this.msgsTotal = 0; this.pingsSent = 0; this.pingsSkipped = 0; this.pingsFailed = 0; this.lastPingAt = 0; this.reconnects = 0; // /status diagnostics
  }

  // ---- subclass surface (override these) ----
  url() { throw new Error(`${this.name}: url() not implemented`); }
  wsOptions() { return undefined; }    // optional 2nd WebSocket arg (e.g. { dispatcher } to route via a proxy)
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
    const gen = ++this._gen;
    this._reconnPending = false;
    const url = this.url();
    log.info(`[${this.name}] connecting`, { url });
    let ws;
    try { const opt = this.wsOptions(); ws = opt ? new WebSocket(url, opt) : new WebSocket(url); } catch (e) { return this._reconnect('construct: ' + e.message, gen); }
    this.ws = ws;
    // The connecting phase had no watchdog at all: every timer below is armed on 'open', and a handshake
    // that never opens fires no 'close'. Four venues sat dead for days that way (2026-08-23..29).
    clearTimeout(this._connectTimer);
    this._connectTimer = setTimeout(() => {
      if (gen !== this._gen || this.connected) return;
      log.warn(`[${this.name}] no 'open' within ${this.connectMs}ms — retrying`);
      try { ws.close(); } catch {}
      this._reconnect('connect timeout', gen);
    }, this.connectMs);

    ws.addEventListener('open', () => {
      if (gen !== this._gen) { try { ws.close(); } catch {} return; } // a superseded socket opening late must not take over
      clearTimeout(this._connectTimer);
      this.connected = true;
      this.backoff = 1000;
      this.lastMsgAt = Date.now();
      log.info(`[${this.name}] open`);
      for (const f of this.subscribeFrames()) { try { ws.send(JSON.stringify(f)); } catch (e) { log.warn(`[${this.name}] subscribe send failed`, { e: String(e) }); } }
      this._armSilence();
      this._armPing();
      this._armLife();
      this._armStale();
      this.onState();
    });

    ws.addEventListener('message', (ev) => {
      if (gen !== this._gen) return;
      this.lastMsgAt = Date.now();
      this.msgsTotal++;
      this._armSilence();
      let events;
      try { events = this.parse(ev.data); } catch (err) { log.warn(`[${this.name}] parse error`, { err: String(err) }); return; }
      if (events && events.length) {
        for (const e of events) { this.eventsTotal++; this.lastEventAt = Date.now(); this.onEvent(e); }
      }
    });

    ws.addEventListener('close', (ev) => {
      if (gen !== this._gen) return;
      this.connected = false;
      this.onState();
      this._reconnect(`close ${ev && ev.code}`, gen);
    });

    ws.addEventListener('error', (ev) => {
      log.warn(`[${this.name}] ws error`, { msg: ev && ev.message });
      // A failed handshake ("network error or non-101 status code") fires 'error' WITHOUT a 'close' in
      // Node's WebSocket — so the reconnect cannot be left to the close handler. Ask for one here; if a
      // close does follow, the pending guard in _reconnect makes the second request a no-op.
      if (gen !== this._gen) return;
      this.connected = false;
      this._reconnect('error: ' + ((ev && ev.message) || 'unknown'), gen);
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
        if (this.ws && this.ws.readyState === 1) { this.ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame)); this.pingsSent++; this.lastPingAt = Date.now(); }
        else this.pingsSkipped++;
      } catch (e) { this.pingsFailed++; }
    }, this.pingIntervalMs());
  }

  _armLife() {
    clearTimeout(this._lifeTimer);
    this._lifeTimer = setTimeout(() => {
      log.info(`[${this.name}] scheduled socket refresh (${Math.round(this.maxLifeMs / 60000)}min)`);
      try { this.ws && this.ws.close(); } catch {}
    }, this.maxLifeMs);
  }
  _armStale() {
    clearInterval(this._staleTimer);
    if (!this.staleMs) return;
    this._staleTimer = setInterval(() => {
      if (this.connected && this.lastEventAt && Date.now() - this.lastEventAt > this.staleMs) {
        log.warn(`[${this.name}] no events for ${Math.round((Date.now() - this.lastEventAt) / 1000)}s — reconnecting (likely a dead subscription)`);
        try { this.ws && this.ws.close(); } catch {}
      }
    }, 30000);
  }
  _clearTimers() { clearTimeout(this._silenceTimer); clearInterval(this._pingTimer); clearTimeout(this._lifeTimer); clearInterval(this._staleTimer); clearTimeout(this._connectTimer); }

  _reconnect(reason, gen) {
    if (gen != null && gen !== this._gen) return; // a stale socket's late close/error must not restart the live one
    if (this._reconnPending) return;              // error + close (or timeout + close) from one socket = one reconnect
    this._reconnPending = true;
    this._clearTimers();
    if (this.stopped) return;
    this.reconnects++;
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
      msgsTotal: this.msgsTotal, reconnects: this.reconnects, pingsSent: this.pingsSent, pingsSkipped: this.pingsSkipped, pingsFailed: this.pingsFailed,
      lastPingMs: this.lastPingAt ? Date.now() - this.lastPingAt : null,
    };
  }
}
