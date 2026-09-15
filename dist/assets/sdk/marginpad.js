/* MarginPad Bot API client - one file, zero dependencies. Node 18+ (global fetch) or any browser.
 *
 *   const { MarginPad } = require('./marginpad.js');          // or: import { MarginPad } from './marginpad.js'
 *   const mp = new MarginPad('mpb_...');                       // key from https://marginpad.io/trading-api/
 *   console.log(await mp.price('BTC'));                        // keyless market data
 *   const { position } = await mp.open({ symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10,
 *                                        sl: 58000, tp: 66000, client_order_id: 'sig-2026-09-11-1403' });
 *   await mp.sltp(position.id, { trail_pct: 1.5 });            // trailing stop, ratcheted server-side
 *   mp.stream(ev => console.log(ev.type, ev.data));            // WebSocket push (Node 22+ or a browser; else npm i ws)
 *
 * Every method resolves with the `data` part of the v2 envelope and rejects with MarginPadError on {ok:false}.
 * On 429 the client waits Retry-After and retries ONCE (autoRetry, default on).
 * Docs: https://marginpad.io/trading-api/  ·  Spec: https://marginpad.io/api/openapi.json
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MarginPadSDK = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var VERSION = '2.6.0';

  function MarginPadError(code, message, status, extra) {
    var e = new Error(code + ': ' + (message || code));
    e.name = 'MarginPadError'; e.code = code; e.message = message || code; e.status = status || 0; e.extra = extra || {};
    return e;
  }

  function MarginPad(apiKey, opts) {
    opts = opts || {};
    this.apiKey = apiKey || null;
    this.base = (opts.base || 'https://marginpad.io').replace(/\/+$/, '');
    this.autoRetry = opts.autoRetry !== false;
    this.timeout = opts.timeout || 15000;
    this.lastHeaders = {};
    this._etag = null;
  }

  MarginPad.prototype._call = async function (method, path, params, body, keyed, headers, retried) {
    var url = this.base + path;
    if (params) { var q = Object.keys(params).filter(function (k) { return params[k] != null; }).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&'); if (q) url += (url.indexOf('?') > 0 ? '&' : '?') + q; }
    var h = { accept: 'application/json', 'user-agent': 'marginpad-js/' + VERSION };
    if (keyed !== false && this.apiKey) h['x-api-key'] = this.apiKey;
    if (body != null) h['content-type'] = 'application/json';
    if (headers) for (var k in headers) if (headers[k] != null) h[k] = headers[k];
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, to = ctl ? setTimeout(function () { ctl.abort(); }, this.timeout) : null;
    var r;
    try { r = await fetch(url, { method: method, headers: h, body: body != null ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined }); }
    finally { if (to) clearTimeout(to); }
    var lh = {}; try { r.headers.forEach(function (v, k) { lh[k] = v; }); } catch (e) {}
    this.lastHeaders = lh;
    if (r.status === 304) return null;
    if (r.status === 429 && this.autoRetry && !retried) { var ra = parseInt(r.headers.get('retry-after') || '5', 10); await new Promise(function (res) { setTimeout(res, Math.min(60000, Math.max(1000, (isNaN(ra) ? 5 : ra) * 1000))); }); return this._call(method, path, params, body, keyed, headers, true); }
    var text = await r.text(); var j = null; try { j = JSON.parse(text); } catch (e) { j = null; }
    if (!r.ok) { var err = j && j.error; if (err && typeof err === 'object') throw MarginPadError(err.code || 'error', err.message, r.status, err); throw MarginPadError(String(err || ('http_' + r.status)), (j && j.hint) || text.slice(0, 200), r.status, j || {}); }
    if (j && j.ok === false) { var e2 = j.error || {}; throw MarginPadError(e2.code || 'error', e2.message, r.status, e2); }
    return j && Object.prototype.hasOwnProperty.call(j, 'data') ? j.data : j;
  };
  MarginPad.prototype._get = function (path, params, keyed) { return this._call('GET', path, params, null, keyed); };
  MarginPad.prototype._post = function (path, body) { var b = {}; for (var k in (body || {})) if (body[k] !== undefined) b[k] = body[k]; return this._call('POST', path, null, b); };

  // ── market data (keyless; with a key it counts against your per-key budget instead of the per-IP one) ──
  MarginPad.prototype.price = function (symbol) { return this._get('/api/v1/price', { symbol: symbol }); };
  MarginPad.prototype.prices = function () { return this._get('/api/v1/prices'); };
  MarginPad.prototype.klines = function (symbol, interval, endMs) { return this._get('/api/v1/klines', { symbol: symbol, interval: interval || 60, end: endMs }); };
  MarginPad.prototype.markets = function (assetClass) { return this._get('/api/bot/v2/markets', { 'class': assetClass }); };
  MarginPad.prototype.screener = function () { return this._get('/api/v1/screener'); };
  MarginPad.prototype.funding = function () { return this._get('/api/v1/funding'); };
  MarginPad.prototype.openInterest = function () { return this._get('/api/v1/open-interest'); };
  MarginPad.prototype.liquidations = function () { return this._get('/api/v1/liquidations'); };
  MarginPad.prototype.fearGreed = function () { return this._get('/api/v1/fear-greed'); };
  MarginPad.prototype.calendar = function (year) { return this._get('/api/v1/calendar', { year: year }); };
  MarginPad.prototype.serverTime = function () { return this._get('/api/bot/v2/time', { client_ts: Date.now() }, false); };

  // ── paper trading ────────────────────────────────────────────────────────────────────────────────────
  // open({symbol, side, margin_usd, leverage, sl, tp, trail_pct, client_order_id, dry_run})
  MarginPad.prototype.open = function (o) { return this._post('/api/bot/v2/open', o); };
  // limitOrder({symbol, side, limit_price, ...}) = pullback entry; stopOrder({..., stop_price}) = breakout entry
  MarginPad.prototype.limitOrder = function (o) { return this._post('/api/bot/v2/open', Object.assign({ type: 'limit' }, o)); };
  MarginPad.prototype.stopOrder = function (o) { var b = Object.assign({ type: 'stop' }, o); if (b.stop_price != null && b.limit_price == null) { b.limit_price = b.stop_price; delete b.stop_price; } return this._post('/api/bot/v2/open', b); };
  MarginPad.prototype.orders = function () { return this._get('/api/bot/v2/orders'); };
  MarginPad.prototype.modifyOrder = function (orderId, changes) { return this._post('/api/bot/v2/modify_order', Object.assign({ order_id: orderId }, changes || {})); };
  MarginPad.prototype.cancelOrder = function (orderId) { return this._post('/api/bot/v2/cancel_order', { order_id: orderId }); };
  // close(id, {symbol, pct, client_order_id}) - pass symbol: one price fetch, one round trip
  MarginPad.prototype.close = function (id, o) { return this._post('/api/bot/v2/close', Object.assign({ id: id }, o || {})); };
  MarginPad.prototype.closeAll = function () { return this._post('/api/bot/v2/close_all', {}); };
  // sltp(id, {sl, tp, trail_pct}) - null clears a level, an omitted key keeps it
  MarginPad.prototype.sltp = function (id, o) { return this._post('/api/bot/v2/sltp', Object.assign({ id: id }, o || {})); };
  // positions({status:'open'|'closed', since}) - resolves null when nothing changed (ETag / 304)
  MarginPad.prototype.positions = async function (o) { o = o || {}; var d = await this._call('GET', '/api/bot/v2/positions', { status: o.status, since: o.since }, null, true, this._etag && o.useEtag !== false ? { 'if-none-match': this._etag } : null); var et = this.lastHeaders.etag; if (et) this._etag = et; return d; };
  MarginPad.prototype.trades = function (limit, beforeMs) { return this._get('/api/bot/v2/trades', { limit: limit || 100, before: beforeMs }); };
  MarginPad.prototype.account = function () { return this._get('/api/bot/v2/account'); };
  MarginPad.prototype.balance = function () { return this._get('/api/bot/v2/balance'); };
  MarginPad.prototype.usage = function () { return this._get('/api/bot/v2/usage'); };
  MarginPad.prototype.report = function (days) { return this._get('/api/bot/v2/report', { days: days || 30 }); };
  // 2.5 books, reset, equity · 2.6 replay
  MarginPad.prototype.accounts = function () { return this._get('/api/bot/v2/accounts'); };
  MarginPad.prototype.reset = function () { return this._post('/api/bot/v2/reset', { confirm: true }); };
  MarginPad.prototype.equity = function (days, stepMin) { return this._get('/api/bot/v2/equity', { days: days || 30, step_min: stepMin }); };
  MarginPad.prototype.replayStart = function (o) { return this._post('/api/bot/v2/replay', { symbol: o.symbol, day: o.day, speed: o.speed }); };
  MarginPad.prototype.replay = function (o) { o = o || {}; return this._get('/api/bot/v2/replay', { interval: o.interval, bars: o.bars }); };
  MarginPad.prototype.replayStop = function () { return this._post('/api/bot/v2/replay', { act: 'stop' }); };
  // ai({symbol, interval, question, lang}) - Premium; educational, not advice
  MarginPad.prototype.ai = function (o) { return this._post('/api/bot/v2/ai', Object.assign({}, o, { interval: String((o && o.interval) || 60) })); };

  // ── fee schedule and fill realism (2.9) ──────────────────────────────────
  // fees() reads the table and your default; fees('binance') sets it; fees('') goes back to ours.
  MarginPad.prototype.fees = function (venue) { return venue === undefined ? this._get('/api/bot/v2/fees') : this._post('/api/bot/v2/fees', { venue: venue }); };

  // Fill realism. Both switches are OFF by default: a market order fills at the live price and maintenance
  // margin is a flat 0.5%, which is easier than a real venue and increasingly so as a position grows.
  //   await c.realism()                                       -> your setting, every venue rate, the tier ladder
  //   await c.realism({ slippage: true, margin_tiers: true })   -> test against something closer to a real book
  //   await c.realism({ margin_venue: 'binance' })             -> liquidate where Binance would
  // Pass the same fields to open() to override the account for one fill only.
  MarginPad.prototype.realism = function (o) { return o === undefined ? this._get('/api/bot/v2/realism') : this._post('/api/bot/v2/realism', o); };

  // ── webhooks (API Pro and up) ───────────────────────────────────────────────────────────────────────────────
  MarginPad.prototype.webhooks = function () { return this._get('/api/bot/v2/webhooks'); };
  MarginPad.prototype.addWebhook = function (url, events) { return this._post('/api/bot/v2/webhooks', { act: 'add', url: url, events: events }); };
  MarginPad.prototype.deleteWebhook = function (id) { return this._post('/api/bot/v2/webhooks', { act: 'delete', id: id }); };
  MarginPad.prototype.testWebhook = function (id) { return this._post('/api/bot/v2/webhooks', { act: 'test', id: id }); };

  // ── WebSocket stream ─────────────────────────────────────────────────────────────────────────────────
  // stream(onEvent, {channels:['positions','prices'], reconnect:true}) -> returns { close() }
  MarginPad.prototype.stream = function (onEvent, o) {
    o = o || {}; var self = this, stopped = false, ws = null;
    var WS = (typeof WebSocket !== 'undefined') ? WebSocket : null;
    if (!WS && typeof require === 'function') { try { WS = require('ws'); } catch (e) { WS = null; } }
    if (!WS) throw new Error('No WebSocket available: use Node 22+, a browser, or npm i ws');
    var url = self.base.replace(/^http/, 'ws') + '/api/bot/v2/stream?api_key=' + encodeURIComponent(self.apiKey || '');
    function connect() {
      if (stopped) return;
      ws = new WS(url);
      ws.onopen = function () { try { ws.send(JSON.stringify({ op: 'subscribe', channels: o.channels || ['positions', 'prices'] })); } catch (e) {} };
      ws.onmessage = function (m) { var d = null; try { d = JSON.parse(typeof m.data === 'string' ? m.data : String(m.data)); } catch (e) { return; } try { onEvent(d); } catch (e) {} };
      ws.onclose = function () { if (!stopped && o.reconnect !== false) setTimeout(connect, 3000); };
      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }
    connect();
    var ping = setInterval(function () { try { if (ws && ws.readyState === 1) ws.send(JSON.stringify({ op: 'ping' })); } catch (e) {} }, 25000);
    return { close: function () { stopped = true; clearInterval(ping); try { ws && ws.close(); } catch (e) {} } };
  };

  // ── webhook receiver helper: verify X-MP-Signature over the RAW body before parsing it ───────────────
  async function verifyWebhook(secret, rawBody, signatureHeader) {
    var want;
    if (typeof require === 'function') { try { var c = require('crypto'); want = 'sha256=' + c.createHmac('sha256', secret).update(rawBody).digest('hex'); } catch (e) { want = null; } }
    if (!want) { var enc = new TextEncoder(); var key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); var sig = await crypto.subtle.sign('HMAC', key, typeof rawBody === 'string' ? enc.encode(rawBody) : rawBody); want = 'sha256=' + Array.prototype.map.call(new Uint8Array(sig), function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); }
    return want === String(signatureHeader || '');
  }

  return { MarginPad: MarginPad, MarginPadError: MarginPadError, verifyWebhook: verifyWebhook, VERSION: VERSION };
});
