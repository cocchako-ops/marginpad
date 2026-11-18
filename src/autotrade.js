// ─── MarginPad Autopilot: the Premium signal, executed on a member's own Binance USD-M account (2026-11-18) ──────────
// Owner: "18 coin-a, 2% po trejdu ... API integracija sa njihovim menjacnicama (prvo Binance) ... poseban dashboard ...
// sigurnost api kljuceva na najvecem mogucem nivou ... nigde se ne pominje na sajtu ... pristup dajem licno kroz mp-ops".
//
// THE RULES THIS FILE IS BUILT ON, each enforced in code:
//  1. NOBODY GETS HERE WITHOUT THE OWNER. Every route checks KV ap:allow:<uid>, written only from mp-ops. The page is not
//     a static file at all (it is served by the worker from source to a granted member, a plain 404 to everyone else).
//  2. A KEY THAT CAN MOVE MONEY OUT IS REFUSED. connect() asks Binance what the key may do and accepts only Reading +
//     USD-M Futures, bound to our one fixed IP. Withdrawals, transfers, spot, margin, options: any of them = refused.
//  3. THE SECRET NEVER LEAVES THE WORKER IN THE CLEAR. AES-GCM under AP_KEK (its own secret, NOT the journal's), bound to
//     the member, opened in memory only to sign, never returned to a browser.
//  4. ONE FIXED ADDRESS, ITS OWN DOOR. Orders go out through the droplet's /api/v1/xtrade, a separate route with its own
//     key (TRADE_FWD_KEY) and an allowlist of USD-M futures paths only - a withdrawal path cannot be forwarded.
//  5. NO POSITION WITHOUT A STOP. If the stop cannot be placed after an entry, the position is closed at once. Every
//     minute the bot checks its stop is still on the exchange and puts it back if it is not.
//  6. IT NEVER TOUCHES WHAT IT DID NOT OPEN. A symbol with a position the member opened by hand is skipped.
//  7. EVERY CALL IS WRITTEN DOWN. Each request to Binance lands in the member's execution log with its answer and time.
//  8. SHADOW FIRST. A new account starts in shadow mode (a virtual exchange, same code path); Live needs an email code.
export const AP_IP = '167.172.98.147';
export const AP_COINS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'HYPE', 'ZEC', 'TRX', 'HBAR', 'DOGE', 'ADA', 'AVAX', 'LINK', 'SUI', 'LTC', 'DOT', 'NEAR', 'APT'];
export const AP_HOST = { live: 'fapi.binance.com', test: 'testnet.binancefuture.com', shadow: 'fapi.binance.com' };
export const AP_DEF = { mode: 'shadow', risk: 2, levCap: 20, maxOpen: 6, maxRisk: 12, dayLoss: 6, coins: AP_COINS.slice(), longs: true, shorts: true, paused: false, vstart: 10000 };
export const AP_LIM = { risk: [0.25, 3], levCap: [1, 20], maxOpen: [1, 10], maxRisk: [1, 25], dayLoss: [1, 20], vstart: [100, 1000000] };
const TAKER = 0.0005; // the virtual exchange's taker fee (Binance VIP-0 USD-M 0.05%)
const DAY = 86400000;
const enc = new TextEncoder();
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const ub64 = (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)))).map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function sha256Hex(s) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(String(s))))).map(b => b.toString(16).padStart(2, '0')).join(''); }
async function kek(env) {
  if (!env.AP_KEK) throw new Error('no_kek');
  return crypto.subtle.importKey('raw', ub64(String(env.AP_KEK).trim()), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
export async function apSeal(env, uid, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode('autopilot|' + uid) }, await kek(env), enc.encode(plain)));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12); return b64(out);
}
async function apOpen(env, uid, sealed) {
  const all = ub64(sealed);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12), additionalData: enc.encode('autopilot|' + uid) }, await kek(env), all.slice(12)));
}
export const apMask = (k) => { k = String(k || ''); return k.length <= 10 ? '****' : k.slice(0, 5) + '…' + k.slice(-4); };

// ---------- settings ----------
export function apCfgNorm(c) {
  c = Object.assign({}, AP_DEF, c || {});
  const out = { mode: ['shadow', 'live', 'test'].includes(c.mode) ? c.mode : 'shadow' };
  for (const k of ['risk', 'levCap', 'maxOpen', 'maxRisk', 'dayLoss', 'vstart']) { const v = +c[k]; out[k] = clamp(isFinite(v) ? v : AP_DEF[k], AP_LIM[k][0], AP_LIM[k][1]); }
  out.levCap = Math.floor(out.levCap); out.maxOpen = Math.floor(out.maxOpen);
  out.risk = Math.round(out.risk * 100) / 100;
  out.coins = (Array.isArray(c.coins) ? c.coins : AP_COINS).map(s => String(s).toUpperCase()).filter(s => AP_COINS.includes(s));
  out.longs = c.longs !== false; out.shorts = c.shorts !== false; out.paused = !!c.paused;
  return out;
}

// ---------- exchange filters ----------
const decOf = (step) => { const s = String(step); if (/e-/i.test(s)) return +s.split(/e-/i)[1]; const i = s.indexOf('.'); return i < 0 ? 0 : s.replace(/0+$/, '').length - i - 1; };
export function floorStep(x, step) { const d = decOf(step), n = Math.floor(x / step + 1e-9) * step; return +n.toFixed(Math.max(0, d)); }
export function roundTick(x, tick) { const d = decOf(tick), n = Math.round(x / tick) * tick; return +n.toFixed(Math.max(0, d)); }
export function filtersOf(sym) { // from one exchangeInfo symbol row
  const f = { step: 0.001, minQty: 0.001, tick: 0.01, minNotional: 5, maxQty: 1e12 };
  for (const x of (sym && sym.filters) || []) {
    if (x.filterType === 'MARKET_LOT_SIZE') { if (+x.stepSize > 0) f.step = +x.stepSize; if (+x.minQty > 0) f.minQty = +x.minQty; if (+x.maxQty > 0) f.maxQty = +x.maxQty; }
    else if (x.filterType === 'LOT_SIZE' && !f._m) { if (+x.stepSize > 0) f.lstep = +x.stepSize; }
    else if (x.filterType === 'PRICE_FILTER' && +x.tickSize > 0) f.tick = +x.tickSize;
    else if (x.filterType === 'MIN_NOTIONAL' && +(x.notional || x.minNotional) > 0) f.minNotional = +(x.notional || x.minNotional);
  }
  if (f.lstep && f.lstep > f.step) f.step = f.lstep; // a market order must also respect the LOT step
  return f;
}

// ---------- the plan: how big, how levered, or why not (PURE - the suite drives exactly this) ----------
export function apPlan(sig, mark, bal, avail, f, cfg, openRiskUsd) {
  const long = !!sig.long, sl = +sig.sl, tp1 = +sig.tp1, e0 = +sig.entry;
  if (!(mark > 0)) return { ok: false, why: 'no_price' };
  if (!(bal > 0)) return { ok: false, why: 'no_balance' };
  if (long ? mark <= sl : mark >= sl) return { ok: false, why: 'past_stop' };
  if (long ? mark >= tp1 : mark <= tp1) return { ok: false, why: 'past_target' };
  const chase = (long ? mark - e0 : e0 - mark) / Math.abs(tp1 - e0); // how much of the way to TP1 price already went before we could enter
  if (chase > 0.4) return { ok: false, why: 'price_ran', chase };
  const stopPct = Math.abs(mark - sl) / mark * 100;
  if (stopPct >= 2.5) return { ok: false, why: 'stop_too_wide', stopPct };
  if (stopPct < 0.12) return { ok: false, why: 'stop_too_tight', stopPct };
  const riskUsd = bal * cfg.risk / 100;
  if ((openRiskUsd || 0) + riskUsd > bal * cfg.maxRisk / 100 + 1e-9) return { ok: false, why: 'risk_budget', openRiskUsd, riskUsd };
  const lev = clamp(Math.floor(40 / stopPct), 1, cfg.levCap); // liquidation ~2.5x further than the stop (isolated margin)
  let qty = floorStep(riskUsd / Math.abs(mark - sl), f.step);
  const maxByMargin = floorStep((Math.max(0, avail) * 0.9 * lev) / mark, f.step);
  let capped = false; if (qty > maxByMargin) { qty = maxByMargin; capped = true; }
  if (qty > f.maxQty) { qty = floorStep(f.maxQty, f.step); capped = true; }
  if (!(qty >= f.minQty) || qty * mark < f.minNotional) return { ok: false, why: 'too_small', qty, minQty: f.minQty, minNotional: f.minNotional };
  const notional = qty * mark;
  return { ok: true, qty, lev, riskUsd: qty * Math.abs(mark - sl), notional, margin: notional / lev, stopPct, capped, mark };
}

// ---------- the transport: one signed Binance call through the fixed address ----------
export function realTransport(env, net, key, secret) {
  const host = AP_HOST[net] || AP_HOST.live;
  const base = String(env.COLLECTOR_URL || 'https://collector.marginpad.io').replace(/\/$/, '');
  return async function X(method, path, params, opt) {
    params = params || {}; opt = opt || {};
    const t0 = Date.now();
    let qs = Object.keys(params).filter(k => params[k] !== '' && params[k] != null).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    const headers = {};
    if (!opt.pub) { qs += (qs ? '&' : '') + 'recvWindow=10000&timestamp=' + Date.now(); qs += '&signature=' + await hmacHex(secret, qs); headers['X-MBX-APIKEY'] = key; }
    const url = 'https://' + (opt.host || host) + path + (qs ? '?' + qs : '');
    let r, txt = '', j = null;
    try {
      r = await fetch(base + '/api/v1/xtrade', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.TRADE_FWD_KEY || '' }, body: JSON.stringify({ method, url, headers }), signal: AbortSignal.timeout(opt.timeout || 12000) });
      txt = await r.text(); try { j = JSON.parse(txt); } catch (e) {}
    } catch (e) { return { ok: false, unknown: true, why: 'forwarder_unreachable', ms: Date.now() - t0, msg: String(e).slice(0, 120) }; }
    const ms = Date.now() - t0;
    if (r.status === 400 && j && j.error === 'path_not_allowed') return { ok: false, why: 'path_not_allowed', ms };
    if (r.status === 403 && j && j.error === 'forbidden') return { ok: false, why: 'forwarder_key', ms };
    if (r.status >= 500 && !(j && j.code)) return { ok: false, unknown: true, why: 'upstream_' + r.status, ms, msg: txt.slice(0, 160) };
    if (!j) return { ok: false, why: 'bad_body', status: r.status, ms, msg: txt.slice(0, 160) };
    if (!r.ok || (j && typeof j.code === 'number' && j.code < 0)) return { ok: false, why: 'binance_' + (j.code || r.status), code: j.code, msg: String(j.msg || '').slice(0, 200), status: r.status, ms };
    return { ok: true, res: j, ms };
  };
}

// ---------- the virtual exchange (shadow mode AND the test suite run the SAME bot against it) ----------
// Fills at the mark price with a 0.02% slip and the 0.05% taker fee; conditional orders trigger when the mark crosses them
// on the minute the bot looks (a wick between two looks is missed - shadow mode says so on the page).
export function virtualTransport(vx, markOf, filtersFor) {
  vx.pos = vx.pos || {}; vx.algos = vx.algos || []; vx.fills = vx.fills || []; vx.orders = vx.orders || {}; vx.lev = vx.lev || {};
  const posOf = (s) => vx.pos[s] || (vx.pos[s] = { amt: 0, entry: 0 });
  const usedMargin = () => Object.keys(vx.pos).reduce((a, s) => { const p = vx.pos[s]; return a + (p.amt ? Math.abs(p.amt) * p.entry / (vx.lev[s] || 20) : 0); }, 0);
  const upnl = async () => { let u = 0; for (const s of Object.keys(vx.pos)) { const p = vx.pos[s]; if (p.amt) { const m = await markOf(s); if (m > 0) u += p.amt * (m - p.entry); } } return u; };
  function trade(s, side, qty, px, cid, ts) {
    const p = posOf(s), sgn = side === 'BUY' ? 1 : -1, d = sgn * qty; let rpnl = 0;
    if (p.amt && Math.sign(p.amt) !== sgn) { const close = Math.min(Math.abs(p.amt), qty); rpnl = close * (px - p.entry) * Math.sign(p.amt); p.amt += sgn * close; if (Math.abs(p.amt) < 1e-12) { p.amt = 0; p.entry = 0; } const rest = qty - close; if (rest > 1e-12) { p.amt = sgn * rest; p.entry = px; } }
    else { const na = p.amt + d; p.entry = (Math.abs(p.amt) * p.entry + qty * px) / Math.abs(na); p.amt = na; }
    const fee = qty * px * TAKER; vx.bal += rpnl - fee;
    const id = (vx.seq = (vx.seq || 0) + 1);
    vx.fills.push({ id, symbol: s, side, price: px, qty, realizedPnl: rpnl, commission: fee, commissionAsset: 'USDT', time: ts || Date.now(), orderId: id, clientOrderId: cid || '' });
    if (vx.fills.length > 600) vx.fills = vx.fills.slice(-600);
    return id;
  }
  async function tick(s) {
    const m = await markOf(s); if (!(m > 0)) return;
    for (const a of vx.algos.filter(x => x.symbol === s && x.algoStatus === 'NEW')) {
      const up = a.side === 'BUY';
      const hit = a.orderType === 'STOP_MARKET' ? (up ? m >= a.triggerPrice : m <= a.triggerPrice) : (up ? m <= a.triggerPrice : m >= a.triggerPrice);
      if (!hit) continue;
      const p = posOf(s); const open = Math.abs(p.amt);
      if (!open) { a.algoStatus = 'CANCELED'; continue; }
      const q = a.closePosition ? open : Math.min(open, a.quantity);
      if ((up && p.amt > 0) || (!up && p.amt < 0)) { a.algoStatus = 'CANCELED'; continue; } // reduce-only: never opens
      trade(s, a.side, q, a.triggerPrice, a.clientAlgoId); a.algoStatus = 'FINISHED'; a.triggerTime = Date.now();
    }
    vx.algos = vx.algos.filter(x => x.algoStatus === 'NEW' || Date.now() - (x.triggerTime || x.createTime || 0) < 7 * DAY).slice(-300);
  }
  const X = async function (method, path, p) {
    p = p || {}; const t0 = Date.now(); const ok = (res) => ({ ok: true, res, ms: Date.now() - t0 + 1 }); const no = (code, msg) => ({ ok: false, why: 'binance_' + code, code, msg, ms: 1 });
    const s = p.symbol;
    if (path === '/fapi/v1/exchangeInfo') return ok({ symbols: [] });
    if (path === '/fapi/v1/premiumIndex') { const m = await markOf(s); return m > 0 ? ok({ symbol: s, markPrice: String(m) }) : no(-1121, 'Invalid symbol.'); }
    if (path === '/fapi/v1/positionSide/dual') return ok({ dualSidePosition: false });
    if (path === '/fapi/v2/balance') { const u = await upnl(); return ok([{ asset: 'USDT', balance: String(vx.bal), crossUnPnl: String(u), availableBalance: String(vx.bal - usedMargin()) }]); }
    if (path === '/fapi/v2/positionRisk') { const out = []; for (const k of Object.keys(vx.pos).filter(k => !s || k === s)) { const q = vx.pos[k]; const m = await markOf(k); out.push({ symbol: k, positionAmt: String(q.amt), entryPrice: String(q.entry), markPrice: String(m), unRealizedProfit: String(q.amt * (m - q.entry)), leverage: String(vx.lev[k] || 20), positionSide: 'BOTH' }); } if (s && !out.length) out.push({ symbol: s, positionAmt: '0', entryPrice: '0', positionSide: 'BOTH' }); return ok(out); }
    if (path === '/fapi/v1/leverage') { vx.lev[s] = +p.leverage; return ok({ symbol: s, leverage: +p.leverage }); }
    if (path === '/fapi/v1/marginType') return no(-4046, 'No need to change margin type.');
    if (path === '/fapi/v1/order' && method === 'POST') {
      if (p.newClientOrderId && vx.orders[p.newClientOrderId]) return no(-4116, 'ClientOrderId is duplicated.');
      const m = await markOf(s); if (!(m > 0)) return no(-1121, 'Invalid symbol.');
      const pos = posOf(s); let qty = +p.quantity;
      if (p.reduceOnly === 'true') { if (!pos.amt || (p.side === 'BUY') === (pos.amt > 0)) return no(-2022, 'ReduceOnly Order is rejected.'); qty = Math.min(qty, Math.abs(pos.amt)); }
      const px = m * (p.side === 'BUY' ? 1.0002 : 0.9998);
      const id = trade(s, p.side, qty, px, p.newClientOrderId);
      const o = { orderId: id, clientOrderId: p.newClientOrderId || '', symbol: s, status: 'FILLED', avgPrice: String(px), executedQty: String(qty), origQty: String(qty), side: p.side, type: 'MARKET', updateTime: Date.now() };
      if (p.newClientOrderId) vx.orders[p.newClientOrderId] = o;
      return ok(o);
    }
    if (path === '/fapi/v1/order' && method === 'GET') { const o = vx.orders[p.origClientOrderId]; return o ? ok(o) : no(-2013, 'Order does not exist.'); }
    if (path === '/fapi/v1/algoOrder' && method === 'POST') {
      if (vx.algos.some(a => a.clientAlgoId === p.clientAlgoId && a.algoStatus === 'NEW')) return no(-4116, 'ClientOrderId is duplicated.');
      const a = { algoId: (vx.seq = (vx.seq || 0) + 1), clientAlgoId: p.clientAlgoId, symbol: s, side: p.side, orderType: p.type, triggerPrice: +p.triggerPrice, quantity: +(p.quantity || 0), closePosition: p.closePosition === 'true', reduceOnly: p.reduceOnly === 'true', algoStatus: 'NEW', createTime: Date.now() };
      vx.algos.push(a); return ok(a);
    }
    if (path === '/fapi/v1/algoOrder' && method === 'DELETE') { const a = vx.algos.find(x => x.clientAlgoId === p.clientAlgoId && x.algoStatus === 'NEW'); if (!a) return no(-2011, 'Unknown order sent.'); a.algoStatus = 'CANCELED'; return ok({ clientAlgoId: a.clientAlgoId, code: '200', msg: 'success' }); }
    if (path === '/fapi/v1/openAlgoOrders') return ok(vx.algos.filter(a => a.algoStatus === 'NEW' && (!s || a.symbol === s)));
    if (path === '/fapi/v1/openOrders') return ok([]);
    if (path === '/fapi/v1/userTrades') return ok(vx.fills.filter(x => x.symbol === s && x.time >= (+p.startTime || 0)));
    return no(-5000, 'Path not modelled: ' + path);
  };
  X.tick = tick; X.virtual = true;
  return X;
}

// ---------- conditional orders: the Algo Service first, the legacy order path where a venue (testnet) lacks it ----------
async function condPlace(X, p, log) {
  const a = await X('POST', '/fapi/v1/algoOrder', Object.assign({ algoType: 'CONDITIONAL', workingType: 'MARK_PRICE', priceProtect: 'true' }, p));
  log('algo', p.symbol, (a.ok ? 'placed ' : 'refused ') + p.type + ' ' + p.side + ' @' + p.triggerPrice + (p.closePosition ? ' (close all)' : ' qty ' + p.quantity) + (a.ok ? '' : ' - ' + (a.msg || a.why)), a.ok, a.ms, { cid: p.clientAlgoId });
  if (a.ok) return { ok: true, via: 'algo' };
  if (!/^binance_-(5000|1121|4120|1104)$|path_not_allowed|404/.test(String(a.why))) return { ok: false, why: a.why, msg: a.msg };
  if (a.code === -4120) return { ok: false, why: a.why, msg: a.msg }; // the venue WANTS the algo path - nothing older to fall back to
  const q = { symbol: p.symbol, side: p.side, type: p.type, stopPrice: p.triggerPrice, workingType: 'MARK_PRICE', priceProtect: 'TRUE', newClientOrderId: p.clientAlgoId };
  if (p.closePosition) q.closePosition = 'true'; else { q.quantity = p.quantity; if (p.reduceOnly) q.reduceOnly = 'true'; }
  if (p.positionSide) q.positionSide = p.positionSide;
  const o = await X('POST', '/fapi/v1/order', q);
  log('order', p.symbol, (o.ok ? 'placed legacy ' : 'refused legacy ') + p.type + ' @' + p.triggerPrice + (o.ok ? '' : ' - ' + (o.msg || o.why)), o.ok, o.ms, { cid: p.clientAlgoId });
  return o.ok ? { ok: true, via: 'legacy' } : { ok: false, why: o.why, msg: o.msg };
}
async function condCancel(X, sym, cid, via, log) {
  const r = via === 'legacy' ? await X('DELETE', '/fapi/v1/order', { symbol: sym, origClientOrderId: cid }) : await X('DELETE', '/fapi/v1/algoOrder', { clientAlgoId: cid });
  const gone = r.ok || /-(2011|2013)$/.test(String(r.why));
  log('cancel', sym, (gone ? 'cancelled ' : 'cancel failed ') + cid + (r.ok || gone ? '' : ' - ' + (r.msg || r.why)), gone, r.ms, { cid });
  return gone;
}
async function condOpen(X, sym) { // our open conditional orders on this symbol, both paths
  const out = [];
  const a = await X('GET', '/fapi/v1/openAlgoOrders', { symbol: sym }); if (a.ok) for (const x of (Array.isArray(a.res) ? a.res : (a.res && a.res.orders) || [])) out.push(x.clientAlgoId || '');
  const o = await X('GET', '/fapi/v1/openOrders', { symbol: sym }); if (o.ok && Array.isArray(o.res)) for (const x of o.res) out.push(x.clientOrderId || '');
  return { ok: a.ok || o.ok, cids: out };
}
const sideOf = (long, closing) => (long ? (closing ? 'SELL' : 'BUY') : (closing ? 'BUY' : 'SELL'));

// ---------- entering a signal ----------
// book = { cfg, open: [trades], day: {d, start, pnl}, log(kind, sym, msg, ok, ms, data) }  ->  { ok, trade } | { ok:false, why }
export async function apEnter(X, book, sig, f, tid) {
  const cfg = book.cfg, sym = sig.sym, symbol = sym + 'USDT', log = book.log, long = !!sig.long;
  if (cfg.paused) return { ok: false, why: 'paused' };
  if (!cfg.coins.includes(sym)) return { ok: false, why: 'coin_off' };
  if (long ? !cfg.longs : !cfg.shorts) return { ok: false, why: long ? 'longs_off' : 'shorts_off' };
  if (book.open.some(t => t.sym === sym)) return { ok: false, why: 'already_in' };
  if (book.open.length >= cfg.maxOpen) return { ok: false, why: 'max_open' };
  const dual = await X('GET', '/fapi/v1/positionSide/dual', {});
  if (!dual.ok) return { ok: false, why: 'exchange_' + (dual.msg || dual.why) };
  const hedge = !!(dual.res && dual.res.dualSidePosition), ps = hedge ? (long ? 'LONG' : 'SHORT') : null;
  const pr = await X('GET', '/fapi/v2/positionRisk', { symbol });
  if (!pr.ok) return { ok: false, why: 'exchange_' + (pr.msg || pr.why) };
  const mine = (Array.isArray(pr.res) ? pr.res : []).filter(p => p.symbol === symbol && (!hedge || p.positionSide === ps) && Math.abs(+p.positionAmt) > 0);
  if (mine.length) return { ok: false, why: 'manual_position' };
  const bq = await X('GET', '/fapi/v2/balance', {});
  if (!bq.ok) return { ok: false, why: 'exchange_' + (bq.msg || bq.why) };
  const u = (Array.isArray(bq.res) ? bq.res : []).find(x => x.asset === 'USDT') || {};
  const bal = +u.balance + (+u.crossUnPnl || 0), avail = +u.availableBalance;
  const day = new Date().toISOString().slice(0, 10);
  if (!book.day || book.day.d !== day) book.day = { d: day, start: bal, pnl: 0 };
  if (book.day.pnl <= -(book.day.start * cfg.dayLoss / 100)) return { ok: false, why: 'day_loss_limit' };
  const mq = await X('GET', '/fapi/v1/premiumIndex', { symbol }, { pub: true });
  const mark = mq.ok ? +mq.res.markPrice : 0;
  const openRisk = book.open.reduce((a, t) => a + (t.phase === 0 ? (+t.riskUsd || 0) : 0), 0);
  const plan = apPlan(sig, mark, bal, avail, f, cfg, openRisk);
  if (!plan.ok) return { ok: false, why: plan.why, plan };
  const mt = await X('POST', '/fapi/v1/marginType', { symbol, marginType: 'ISOLATED' });
  if (!mt.ok && !/-4046$/.test(String(mt.why))) log('warn', sym, 'isolated margin not set (' + (mt.msg || mt.why) + ') - continuing on the account\'s margin mode', false, mt.ms);
  let lev = plan.lev, lv = null;
  for (const L of [lev, 15, 10, 5, 3, 2, 1].filter((x, i, a) => x <= lev && a.indexOf(x) === i)) { lv = await X('POST', '/fapi/v1/leverage', { symbol, leverage: L }); if (lv.ok) { lev = L; break; } }
  if (!lv || !lv.ok) { log('error', sym, 'leverage refused: ' + ((lv && (lv.msg || lv.why)) || '?'), false); return { ok: false, why: 'leverage' }; }
  log('info', sym, 'leverage ' + lev + 'x', true, lv.ms);
  const qty = plan.qty, cidE = 'mpa' + tid + 'e';
  const eo = { symbol, side: sideOf(long, false), type: 'MARKET', quantity: qty, newClientOrderId: cidE, newOrderRespType: 'RESULT' };
  if (ps) eo.positionSide = ps;
  let er = await X('POST', '/fapi/v1/order', eo);
  if (!er.ok && er.unknown) { // the answer was lost on the way back: ask Binance whether it happened before deciding anything
    const q = await X('GET', '/fapi/v1/order', { symbol, origClientOrderId: cidE }); if (q.ok) er = { ok: true, res: q.res, ms: q.ms };
  }
  log('order', sym, er.ok ? 'entry MARKET ' + eo.side + ' ' + qty + ' filled @' + (+er.res.avgPrice || mark) : 'entry refused - ' + (er.msg || er.why), er.ok, er.ms, { cid: cidE });
  if (!er.ok) return { ok: false, why: 'entry_' + (er.msg || er.why) };
  let fq = +er.res.executedQty || 0, avg = +er.res.avgPrice || 0;
  if (!(fq > 0)) { // a market order that reports no fill yet: read the position instead of guessing
    const p2 = await X('GET', '/fapi/v2/positionRisk', { symbol }); const row = p2.ok && (p2.res || []).find(p => p.symbol === symbol && (!hedge || p.positionSide === ps));
    fq = row ? Math.abs(+row.positionAmt) : 0; avg = row ? +row.entryPrice : mark;
  }
  if (!(fq > 0)) { log('error', sym, 'entry reported no fill', false); return { ok: false, why: 'no_fill' }; }
  if (!(avg > 0)) avg = mark;
  const trade = { id: tid, sig: sig.sigId || '', sym, symbol, long, qty: fq, entry: avg, sl: roundTick(+sig.sl, f.tick), tp1: roundTick(+sig.tp1, f.tick), tp2: roundTick(+sig.tp2, f.tick), lev, riskUsd: fq * Math.abs(avg - +sig.sl), opened: Date.now(), status: 'open', phase: 0, hedge, ps, via: {}, cids: { e: cidE, s: 'mpa' + tid + 's', t1: 'mpa' + tid + 't1', t2: 'mpa' + tid + 't2', b: 'mpa' + tid + 'b', x: 'mpa' + tid + 'x' }, sigBar: +sig.bar || 0, mode: cfg.mode, half: 0 };
  // THE STOP, before anything else - and twice if the first try fails. No stop = no position.
  const stopP = { symbol, side: sideOf(long, true), type: 'STOP_MARKET', triggerPrice: trade.sl, closePosition: 'true', clientAlgoId: trade.cids.s }; if (ps) stopP.positionSide = ps;
  let sp = await condPlace(X, stopP, log);
  if (!sp.ok) { stopP.clientAlgoId = trade.cids.s = 'mpa' + tid + 's2'; sp = await condPlace(X, stopP, log); }
  if (!sp.ok) {
    log('error', sym, 'STOP COULD NOT BE PLACED - closing the position now', false);
    await marketClose(X, trade, log, 'no_stop');
    return { ok: false, why: 'stop_refused_closed', trade };
  }
  trade.via.s = sp.via;
  const half = floorStep(fq / 2, f.step);
  if (half >= f.minQty && half * avg >= f.minNotional && fq - half >= f.minQty) {
    const t1 = { symbol, side: sideOf(long, true), type: 'TAKE_PROFIT_MARKET', triggerPrice: trade.tp1, quantity: half, clientAlgoId: trade.cids.t1 };
    if (ps) t1.positionSide = ps; else t1.reduceOnly = 'true';
    const r1 = await condPlace(X, t1, log); trade.via.t1 = r1.via; trade.half = half; if (!r1.ok) trade.warn = 'tp1_missing';
    const t2 = { symbol, side: sideOf(long, true), type: 'TAKE_PROFIT_MARKET', triggerPrice: trade.tp2, closePosition: 'true', clientAlgoId: trade.cids.t2 }; if (ps) t2.positionSide = ps;
    const r2 = await condPlace(X, t2, log); trade.via.t2 = r2.via; if (!r2.ok) trade.warn = (trade.warn ? trade.warn + ',' : '') + 'tp2_missing';
  } else { // too small to split: the whole position takes profit at TP1 and the runner rule does not apply
    const t1 = { symbol, side: sideOf(long, true), type: 'TAKE_PROFIT_MARKET', triggerPrice: trade.tp1, closePosition: 'true', clientAlgoId: trade.cids.t1 }; if (ps) t1.positionSide = ps;
    const r1 = await condPlace(X, t1, log); trade.via.t1 = r1.via; trade.noSplit = true; if (!r1.ok) trade.warn = 'tp1_missing';
  }
  return { ok: true, trade, plan };
}
async function marketClose(X, t, log, why) {
  const pr = await X('GET', '/fapi/v2/positionRisk', { symbol: t.symbol });
  const row = pr.ok && (pr.res || []).find(p => p.symbol === t.symbol && (!t.hedge || p.positionSide === t.ps));
  const amt = row ? Math.abs(+row.positionAmt) : 0;
  if (!(amt > 0)) return { ok: true, none: true };
  const o = { symbol: t.symbol, side: sideOf(t.long, true), type: 'MARKET', quantity: amt, newClientOrderId: t.cids.x + (Date.now() % 1000), newOrderRespType: 'RESULT' };
  if (t.ps) o.positionSide = t.ps; else o.reduceOnly = 'true';
  const r = await X('POST', '/fapi/v1/order', o);
  log('order', t.sym, (r.ok ? 'closed at market (' + why + ') ' + amt + ' @' + (+r.res.avgPrice || '?') : 'MARKET CLOSE FAILED (' + why + ') - ' + (r.msg || r.why)), r.ok, r.ms, { cid: o.newClientOrderId });
  return r;
}
async function cancelOurs(X, t, log) { for (const k of ['s', 't1', 't2', 'b']) if (t.via[k]) await condCancel(X, t.symbol, t.cids[k], t.via[k], log); }

// ---------- managing an open trade, every minute ----------
// flip = { dir, bar } - the latest CLOSED 1h Supertrend flip on this coin (signal engine). Returns the trade, changed in place.
export async function apManage(X, book, t, flip) {
  const log = book.log;
  if (X.tick) await X.tick(t.symbol);
  const pr = await X('GET', '/fapi/v2/positionRisk', { symbol: t.symbol });
  if (!pr.ok) { t.lastErr = pr.msg || pr.why; return t; }
  const row = (pr.res || []).find(p => p.symbol === t.symbol && (!t.hedge || p.positionSide === t.ps));
  const amt = row ? Math.abs(+row.positionAmt) : 0;
  t.mark = row ? +row.markPrice || t.mark : t.mark; t.upnl = row ? +row.unRealizedProfit || 0 : 0; t.liq = row ? +row.liquidationPrice || null : null;
  if (!(amt > 0)) return apSettle(X, book, t);
  // the market flipped against us on a closed 1h candle -> the runner rule: out at market
  if (flip && flip.dir !== (t.long ? 1 : -1) && +flip.bar > (t.sigBar || 0)) {
    t.closing = 'flip'; await cancelOurs(X, t, log); await marketClose(X, t, log, 'Supertrend flipped against the trade');
    return apSettle(X, book, t);
  }
  // TP1 filled (the position shrank by ~the half) -> stop to entry: the rest is risk-free
  if (t.phase === 0 && !t.noSplit && t.half && amt <= t.qty - t.half * 0.9) {
    if (t.via.s) await condCancel(X, t.symbol, t.cids.s, t.via.s, log);
    const be = { symbol: t.symbol, side: sideOf(t.long, true), type: 'STOP_MARKET', triggerPrice: t.entry, closePosition: 'true', clientAlgoId: t.cids.b }; if (t.ps) be.positionSide = t.ps;
    let r = await condPlace(X, be, log); if (!r.ok) { be.clientAlgoId = t.cids.b = t.cids.b + '2'; r = await condPlace(X, be, log); }
    if (r.ok) { t.via.b = r.via; delete t.via.s; t.phase = 1; t.tp1At = Date.now(); log('info', t.sym, 'TP1 hit - stop moved to entry ' + t.entry + ', the rest is risk-free', true); }
    else { log('error', t.sym, 'breakeven stop refused - closing the rest', false); t.closing = 'be_refused'; await cancelOurs(X, t, log); await marketClose(X, t, log, 'breakeven stop refused'); return apSettle(X, book, t); }
    return t;
  }
  // the stop must still be on the exchange; if it is not, put it back (or close if that fails)
  if (!t._chk || Date.now() - t._chk > 4.5 * 60000) {
    t._chk = Date.now();
    const oc = await condOpen(X, t.symbol);
    const stopCid = t.phase === 1 ? t.cids.b : t.cids.s;
    if (oc.ok && !oc.cids.includes(stopCid)) {
      log('warn', t.sym, 'the stop is missing on the exchange - placing it again', false);
      const p = { symbol: t.symbol, side: sideOf(t.long, true), type: 'STOP_MARKET', triggerPrice: t.phase === 1 ? t.entry : t.sl, closePosition: 'true', clientAlgoId: stopCid + 'r' + (Date.now() % 1000) }; if (t.ps) p.positionSide = t.ps;
      const r = await condPlace(X, p, log);
      if (r.ok) { if (t.phase === 1) { t.cids.b = p.clientAlgoId; t.via.b = r.via; } else { t.cids.s = p.clientAlgoId; t.via.s = r.via; } }
      else { t.closing = 'stop_lost'; await cancelOurs(X, t, log); await marketClose(X, t, log, 'stop could not be restored'); return apSettle(X, book, t); }
    }
  }
  return t;
}
// the position is gone: read what really happened from the fills, tidy our orders, write the result
async function apSettle(X, book, t) {
  const log = book.log;
  await cancelOurs(X, t, log);
  const ut = await X('GET', '/fapi/v1/userTrades', { symbol: t.symbol, startTime: t.opened - 5000, limit: 500 });
  let pnl = 0, fees = 0, lastPx = 0, n = 0;
  if (ut.ok && Array.isArray(ut.res)) for (const x of ut.res) {
    if (x.time < t.opened - 5000) continue;
    const ours = !t.hedge || (x.positionSide || 'BOTH') === (t.ps || 'BOTH');
    if (!ours) continue;
    pnl += +x.realizedPnl || 0; fees += /^(USDT|USDC)$/.test(x.commissionAsset || 'USDT') ? (+x.commission || 0) : 0; n++;
    if (+x.realizedPnl) lastPx = +x.price;
  }
  const net = pnl - fees;
  let why = t.closing || '';
  if (!why) { const near = (a, b) => b && Math.abs(a - b) / b < 0.004; why = t.phase === 1 ? (near(lastPx, t.tp2) ? 'tp2' : near(lastPx, t.entry) ? 'tp1_be' : 'tp1_other') : (near(lastPx, t.sl) ? 'sl' : near(lastPx, t.tp1) && t.noSplit ? 'tp1' : 'closed_outside'); }
  Object.assign(t, { status: 'closed', closed: Date.now(), exitPx: lastPx || t.mark || 0, pnl: +net.toFixed(4), gross: +pnl.toFixed(4), fees: +fees.toFixed(4), R: t.riskUsd ? +(net / t.riskUsd).toFixed(3) : 0, result: why, fillsSeen: n });
  if (book.day) book.day.pnl += net;
  log('close', t.sym, 'closed - ' + why + ' - net ' + (net >= 0 ? '+' : '') + net.toFixed(2) + ' USDT (' + (t.R >= 0 ? '+' : '') + t.R + 'R)', net >= 0, 0);
  return t;
}
export async function apCloseAll(X, book, why) { const out = []; for (const t of book.open) { t.closing = why || 'manual'; await cancelOurs(X, t, book.log); await marketClose(X, t, book.log, why || 'closed by the member'); out.push(await apSettle(X, book, t)); } return out; }

// ---------- verifying a key before it is ever stored ----------
export async function apCheckKey(env, net, k, s) {
  const X = realTransport(env, net, k, s);
  const perms = {};
  if (net === 'live') {
    const q = await X('GET', '/sapi/v1/account/apiRestrictions', {}, { host: 'api.binance.com' });
    if (!q.ok) return { ok: false, why: /-(2015|2014|2008)$/.test(String(q.why)) ? 'key_invalid' : q.why, msg: q.msg };
    const a = q.res, bad = [];
    if (!a.enableReading) bad.push('Enable Reading must be ON');
    if (!a.enableFutures) bad.push('Enable Futures must be ON');
    if (a.enableWithdrawals) bad.push('Withdrawals must be OFF');
    if (a.enableInternalTransfer) bad.push('Internal transfer must be OFF');
    if (a.permitsUniversalTransfer) bad.push('Universal transfer must be OFF');
    if (a.enableMargin) bad.push('Margin loan must be OFF');
    if (a.enableSpotAndMarginTrading) bad.push('Spot & Margin trading must be OFF');
    if (a.enableVanillaOptions) bad.push('Options must be OFF');
    if (a.enablePortfolioMarginTrading) bad.push('Portfolio margin must be OFF');
    if (!a.ipRestrict) bad.push('Restrict access to trusted IPs only: ' + AP_IP);
    Object.assign(perms, { reading: !!a.enableReading, futures: !!a.enableFutures, withdrawals: !!a.enableWithdrawals, transfer: !!(a.enableInternalTransfer || a.permitsUniversalTransfer), spot: !!a.enableSpotAndMarginTrading, ipBound: !!a.ipRestrict, expires: a.tradingAuthorityExpirationTime || null });
    if (bad.length) return { ok: false, why: 'key_permissions', bad, perms };
  }
  const b = await X('GET', '/fapi/v2/balance', {});
  if (!b.ok) return { ok: false, why: b.why === 'binance_-2015' ? 'futures_ip' : b.why, msg: b.msg, perms };
  const u = (Array.isArray(b.res) ? b.res : []).find(x => x.asset === 'USDT') || {};
  return { ok: true, perms, usdt: +u.balance || 0 };
}

// ---------- the member's Telegram lines ----------
const fpx = (v) => { v = +v; if (!isFinite(v) || !v) return '-'; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 1 : v >= 1 ? 4 : 6 }); };
const fus = (v, sign) => { v = +v || 0; return (sign && v > 0 ? '+' : v < 0 ? '-' : '') + '$' + Math.abs(v).toFixed(2); };
const mtag = (m) => m === 'live' ? '' : m === 'test' ? ' <i>[testnet]</i>' : ' <i>[shadow]</i>';
const hold = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? m + 'm' : Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };
export const AP_RES = { tp2: 'TP2 reached', tp1_be: 'TP1, then breakeven', tp1: 'TP1 reached', tp1_other: 'TP1, then closed', sl: 'Stop loss', flip: 'Trend flipped - closed at market', closed_outside: 'Closed on Binance', no_stop: 'Closed: the stop could not be placed', stop_lost: 'Closed: the stop could not be restored', be_refused: 'Closed: breakeven stop refused' };
export function apMsgOpen(t, m) { const side = t.long ? 'LONG' : 'SHORT'; return '<b>OPENED</b> · ' + t.sym + ' ' + side + ' · ' + t.lev + 'x' + mtag(m) + '\n'
  + 'Entry <code>' + fpx(t.entry) + '</code> · size ' + (+t.qty) + ' ' + t.sym + ' (' + fpx(t.qty * t.entry) + ')\n'
  + 'Stop <code>' + fpx(t.sl) + '</code> · risk ' + fus(t.riskUsd) + '\n'
  + 'TP1 <code>' + fpx(t.tp1) + '</code> (half) · TP2 <code>' + fpx(t.tp2) + '</code>\n'
  + 'The stop and both targets are on Binance now.' + (t.sig ? '\n<code>#' + t.sig + '</code>' : ''); }
export function apMsgTp1(t, m) { return '<b>TP1 HIT</b> · ' + t.sym + ' ' + (t.long ? 'LONG' : 'SHORT') + mtag(m) + '\nHalf closed at <code>' + fpx(t.tp1) + '</code>. The stop moved to entry <code>' + fpx(t.entry) + '</code> - the rest is risk-free.'; }
export function apMsgClose(t, m) { const bad = /no_stop|stop_lost|be_refused/.test(t.result || ''); return (t.pnl >= 0 ? '<b>CLOSED</b>' : '<b>CLOSED</b>') + ' · ' + t.sym + ' ' + (t.long ? 'LONG' : 'SHORT') + mtag(m) + '\n'
  + (AP_RES[t.result] || t.result || 'Closed') + (bad ? ' (a protective close)' : '') + '\n'
  + 'Exit <code>' + fpx(t.exitPx) + '</code> · net <b>' + fus(t.pnl, 1) + '</b> (' + (t.R >= 0 ? '+' : '') + (+t.R).toFixed(2) + 'R) · fees ' + fus(t.fees) + ' · held ' + hold((t.closed || Date.now()) - t.opened); }

// ---------- the store: one instance per member ----------
export class AutoStore {
  constructor(state, env) { this.state = state; this.env = env; this.sql = state.storage.sql; this.init(); }
  init() {
    const q = this.sql;
    q.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    q.exec('CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, mode TEXT, sym TEXT, status TEXT, opened INTEGER, closed INTEGER, data TEXT)');
    q.exec('CREATE INDEX IF NOT EXISTS trades_st ON trades(status, opened)');
    q.exec('CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, mode TEXT, kind TEXT, sym TEXT, ok INTEGER, ms INTEGER, msg TEXT, data TEXT)');
    q.exec('CREATE TABLE IF NOT EXISTS sigs (sid TEXT PRIMARY KEY, ts INTEGER, sym TEXT, long INTEGER, action TEXT, why TEXT, data TEXT)');
  }
  g(k, d) { const r = this.sql.exec('SELECT v FROM kv WHERE k=?', k).toArray()[0]; if (!r) return d; try { return JSON.parse(r.v); } catch (e) { return d; } }
  p(k, v) { this.sql.exec('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)', k, JSON.stringify(v)); }
  j(o, s) { return new Response(JSON.stringify(o), { status: s || 200, headers: { 'content-type': 'application/json' } }); }
  logger(mode) { return (kind, sym, msg, ok, ms, data) => { try { this.sql.exec('INSERT INTO log (ts,mode,kind,sym,ok,ms,msg,data) VALUES (?,?,?,?,?,?,?,?)', Date.now(), mode, kind, sym || '', ok ? 1 : 0, Math.round(ms || 0), String(msg || '').slice(0, 400), data ? JSON.stringify(data).slice(0, 400) : null); } catch (e) {} }; }
  openTrades(mode) { return this.sql.exec("SELECT data FROM trades WHERE status='open' AND mode=?", mode).toArray().map(r => JSON.parse(r.data)); }
  saveTrade(t) { this.sql.exec('INSERT OR REPLACE INTO trades (id,mode,sym,status,opened,closed,data) VALUES (?,?,?,?,?,?,?)', t.id, t.mode, t.sym, t.status, t.opened, t.closed || null, JSON.stringify(t)); }
  async transport(mode) {
    const env = this.env;
    if (mode === 'shadow') {
      const cfg = apCfgNorm(this.g('cfg', null));
      const vx = this.g('vx', null) || { bal: cfg.vstart, created: Date.now() };
      const marks = {};
      const pub = realTransport(env, 'live', '', '');
      const markOf = async (s) => { if (marks[s]) return marks[s]; const r = await pub('GET', '/fapi/v1/premiumIndex', { symbol: s }, { pub: true }); return (marks[s] = r.ok ? +r.res.markPrice : 0); };
      const X = virtualTransport(vx, markOf); X.save = () => this.p('vx', vx); X.vx = vx; return X;
    }
    const c = this.g('conn', null); if (!c || c.net !== mode || !c.sealed) return null;
    const sec = JSON.parse(await apOpen(env, this.g('uid', ''), c.sealed));
    const X = realTransport(env, mode, sec.k, sec.s); X.save = () => {}; return X;
  }
  async filters(mode, symbol) {
    const env = this.env, ck = 'ap:xinfo:' + (mode === 'test' ? 'test' : 'live');
    let m = null; try { m = await env.STATS.get(ck, 'json'); } catch (e) {}
    if (!m || !m[symbol]) {
      const X = realTransport(env, mode === 'test' ? 'test' : 'live', '', '');
      const r = await X('GET', '/fapi/v1/exchangeInfo', {}, { pub: true, timeout: 20000 });
      if (r.ok && r.res && Array.isArray(r.res.symbols)) { m = {}; for (const s of r.res.symbols) if (/USDT$/.test(s.symbol) && s.contractType === 'PERPETUAL' && s.status === 'TRADING' && AP_COINS.includes(s.symbol.replace(/USDT$/, ''))) m[s.symbol] = filtersOf(s); try { await env.STATS.put(ck, JSON.stringify(m), { expirationTtl: 6 * 3600 }); } catch (e) {} }
    }
    return m && m[symbol] || null;
  }
  async tg(text) { // the member's own Telegram chat (linked from the dashboard): every open, TP1, close and protective action
    const t = this.g('tg', null); if (!t || !t.chat || !this.env.TELEGRAM_TOKEN) return false;
    try {
      const r = await fetch('https://api.telegram.org/bot' + this.env.TELEGRAM_TOKEN + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: t.chat, text, parse_mode: 'HTML', disable_web_page_preview: true }), signal: AbortSignal.timeout(6000) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) { this.logger(apCfgNorm(this.g('cfg', null)).mode)('warn', '', 'Telegram message not delivered: ' + String(j.description || r.status).slice(0, 120), false, 0); if (j.error_code === 403) { t.blocked = Date.now(); this.p('tg', t); } }
      return !!j.ok;
    } catch (e) { return false; }
  }
  book(mode) {
    const cfg = apCfgNorm(this.g('cfg', null));
    return { cfg, open: this.openTrades(mode), day: this.g('day:' + mode, null), log: this.logger(mode) };
  }
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
    if (b.uid && !this.g('uid', '')) this.p('uid', String(b.uid));
    if (b.uid && this.g('uid', '') !== String(b.uid)) return this.j({ error: 'wrong_store' }, 409);
    if (path === '/state') {
      const cfg = apCfgNorm(this.g('cfg', null)), conn = this.g('conn', null), mode = cfg.mode;
      const rows = this.sql.exec('SELECT data FROM trades ORDER BY opened DESC LIMIT 400').toArray().map(r => JSON.parse(r.data));
      const log = this.sql.exec('SELECT id,ts,mode,kind,sym,ok,ms,msg FROM log ORDER BY id DESC LIMIT 400').toArray();
      const sigs = this.sql.exec('SELECT sid,ts,sym,long,action,why,data FROM sigs ORDER BY ts DESC LIMIT 150').toArray().map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : null }));
      const vx = this.g('vx', null);
      return this.j({ ok: true, cfg, conn: conn ? { net: conn.net, kid: conn.kid, perms: conn.perms, created: conn.created, lastOk: conn.lastOk, lastErr: conn.lastErr || '', usdt: conn.usdt } : null, trades: rows, log, sigs, day: this.g('day:' + mode, null), acct: this.g('acct:' + mode, null), virtual: vx ? { bal: vx.bal, start: cfg.vstart, created: vx.created } : null, disabled: !!this.g('disabled', false), kill: !!b.kill, tg: (() => { const t = this.g('tg', null); return t && t.chat ? { linked: true, since: t.ts, blocked: !!t.blocked } : { linked: false }; })(), locked: cfg.mode === 'live' });
    }
    if (path === '/cfg') {
      const cur = apCfgNorm(this.g('cfg', null)), patch = b.patch || {};
      delete patch.mode; // the mode has its own guarded route
      if (cur.mode === 'live' && !b.admin && Object.keys(patch).some(k => k !== 'paused')) return this.j({ error: 'locked' }, 423); // Live: changes by email, made by MarginPad
      const next = apCfgNorm(Object.assign({}, cur, patch));
      if (patch.vstart != null && +patch.vstart !== cur.vstart && !this.openTrades('shadow').length) { this.p('vx', { bal: next.vstart, created: Date.now() }); }
      this.p('cfg', next); this.logger(next.mode)('info', '', (b.admin ? 'settings changed by MarginPad: ' : 'settings changed: ') + Object.keys(patch).join(', '), true, 0);
      return this.j({ ok: true, cfg: next });
    }
    if (path === '/mode') {
      const cur = apCfgNorm(this.g('cfg', null)), m = String(b.mode || '');
      if (!['shadow', 'live', 'test'].includes(m)) return this.j({ error: 'bad_mode' }, 400);
      if (cur.mode === 'live' && m !== 'live' && !b.admin) return this.j({ error: 'locked' }, 423);
      if (m !== 'shadow') { const c = this.g('conn', null); if (!c || c.net !== m) return this.j({ error: 'no_key_for_mode' }, 400); }
      if (this.openTrades(cur.mode).length && m !== cur.mode) return this.j({ error: 'close_positions_first', open: this.openTrades(cur.mode).length }, 409);
      cur.mode = m; this.p('cfg', cur); this.logger(m)('info', '', 'mode -> ' + m + (b.admin ? ' (by MarginPad)' : ''), true, 0);
      if (m === 'live') await this.tg('<b>Autopilot is LIVE</b>\nFrom the next Premium signal it places real orders on your Binance account at ' + cur.risk + '% risk per trade. Settings are now locked - to change anything, email support@marginpad.io.');
      return this.j({ ok: true, cfg: cur });
    }
    if (path === '/connect') {
      if (!b.sealed || !b.net) return this.j({ error: 'bad' }, 400);
      const cur = apCfgNorm(this.g('cfg', null));
      const old = this.g('conn', null);
      if (old && old.net === cur.mode && this.openTrades(cur.mode).length) return this.j({ error: 'close_positions_first' }, 409);
      this.p('conn', { net: b.net, kid: b.kid, sealed: b.sealed, perms: b.perms || {}, created: Date.now(), usdt: b.usdt || 0, lastOk: Date.now() });
      this.logger(b.net)('info', '', 'Binance ' + (b.net === 'test' ? 'TESTNET ' : '') + 'key connected (' + b.kid + ')', true, 0);
      return this.j({ ok: true });
    }
    if (path === '/disconnect') {
      const cur = apCfgNorm(this.g('cfg', null)), c = this.g('conn', null);
      if (cur.mode === 'live' && !b.admin) return this.j({ error: 'locked' }, 423);
      if (c && this.openTrades(c.net).length) return this.j({ error: 'close_positions_first' }, 409);
      this.sql.exec("DELETE FROM kv WHERE k='conn'"); if (cur.mode !== 'shadow') { cur.mode = 'shadow'; this.p('cfg', cur); }
      this.logger('shadow')('info', '', 'key deleted', true, 0);
      return this.j({ ok: true });
    }
    if (path === '/tg') {
      if (b.off) { this.sql.exec("DELETE FROM kv WHERE k='tg'"); this.logger(apCfgNorm(this.g('cfg', null)).mode)('info', '', 'Telegram disconnected', true, 0); return this.j({ ok: true }); }
      if (b.chat) { this.p('tg', { chat: String(b.chat), ts: Date.now() }); this.logger(apCfgNorm(this.g('cfg', null)).mode)('info', '', 'Telegram connected', true, 0); await this.tg('<b>Autopilot connected</b>\nEvery trade Autopilot opens or closes on your account arrives here, the moment it happens.'); return this.j({ ok: true }); }
      if (b.test) return this.j({ ok: await this.tg('<b>Test</b> - Autopilot can reach you here.') });
      return this.j({ error: 'bad' }, 400);
    }
    if (path === '/disable') { this.p('disabled', !!b.on); this.logger(apCfgNorm(this.g('cfg', null)).mode)('info', '', b.on ? 'access withdrawn by MarginPad - no new trades' : 'access restored', true, 0); return this.j({ ok: true }); }
    if (path === '/exec') { // one Premium signal
      const sig = b.sig || {}; const sid = String(sig.sigId || '');
      if (!sid || this.sql.exec('SELECT sid FROM sigs WHERE sid=?', sid).toArray().length) return this.j({ ok: true, dup: true });
      const cfg = apCfgNorm(this.g('cfg', null)), mode = cfg.mode;
      const rec = (action, why, data) => { this.sql.exec('INSERT OR REPLACE INTO sigs (sid,ts,sym,long,action,why,data) VALUES (?,?,?,?,?,?,?)', sid, Date.now(), sig.sym, sig.long ? 1 : 0, action, why || '', data ? JSON.stringify(data) : null); };
      if (this.g('disabled', false)) { rec('skipped', 'access_off'); return this.j({ ok: true, skipped: 'access_off' }); }
      if (b.kill) { rec('skipped', 'kill_switch'); return this.j({ ok: true, skipped: 'kill_switch' }); }
      const X = await this.transport(mode); if (!X) { rec('skipped', 'no_key'); return this.j({ ok: true, skipped: 'no_key' }); }
      const f = await this.filters(mode, sig.sym + 'USDT'); if (!f) { rec('skipped', 'not_on_binance'); return this.j({ ok: true, skipped: 'not_on_binance' }); }
      const book = this.book(mode);
      const tid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).slice(-9);
      let r; try { r = await apEnter(X, book, sig, f, tid); } catch (e) { r = { ok: false, why: 'error_' + String(e).slice(0, 80) }; book.log('error', sig.sym, 'entry crashed: ' + String(e).slice(0, 200), false); }
      if (r.trade) this.saveTrade(r.trade);
      this.p('day:' + mode, book.day); X.save();
      if (r.ok) await this.tg(apMsgOpen(r.trade, mode));
      else if (r.trade) await this.tg('<b>PROTECTIVE CLOSE</b> · ' + sig.sym + mtag(mode) + '\nBinance refused the stop right after the entry, so the position was closed at once. Nothing is open.');
      else if (!/^(paused|coin_off|longs_off|shorts_off|already_in|max_open|price_ran|past_stop|past_target|stop_too_wide|stop_too_tight)$/.test(r.why)) await this.tg('<b>Signal not taken</b> · ' + sig.sym + ' ' + (sig.long ? 'LONG' : 'SHORT') + mtag(mode) + '\nReason: ' + String(r.why).replace(/_/g, ' '));
      rec(r.ok ? 'taken' : 'skipped', r.ok ? '' : r.why, r.ok ? { qty: r.trade.qty, entry: r.trade.entry, lev: r.trade.lev, risk: r.trade.riskUsd } : (r.plan || null));
      if (!r.ok && !/^(paused|coin_off|longs_off|shorts_off|already_in|max_open|day_loss_limit|risk_budget|price_ran|past_stop|past_target|stop_too_wide|stop_too_tight|too_small)$/.test(r.why)) book.log('skip', sig.sym, 'signal ' + sid + ' not taken: ' + r.why, false, 0);
      else if (!r.ok) book.log('skip', sig.sym, 'signal ' + sid + ' skipped: ' + r.why, true, 0);
      return this.j({ ok: true, taken: !!r.ok, why: r.why || '', alarm: !r.ok && /stop_refused|entry_|leverage|no_fill/.test(r.why) });
    }
    if (path === '/manage') { // every minute while trades are open
      const cfg = apCfgNorm(this.g('cfg', null)), out = { managed: 0, closed: 0, alarms: [] };
      for (const mode of ['shadow', 'test', 'live']) {
        const open = this.openTrades(mode); if (!open.length) continue;
        const X = await this.transport(mode); if (!X) continue;
        const book = this.book(mode);
        for (const t of open) {
          const ph0 = t.phase;
          try { await apManage(X, book, t, (b.flips || {})[t.sym]); } catch (e) { book.log('error', t.sym, 'manage crashed: ' + String(e).slice(0, 200), false); }
          this.saveTrade(t);
          if (t.status === 'closed') await this.tg(apMsgClose(t, mode)); else if (t.phase === 1 && ph0 === 0) await this.tg(apMsgTp1(t, mode)); out.managed++; if (t.status === 'closed') { out.closed++; if (/stop_lost|be_refused/.test(t.result)) out.alarms.push(t.sym + ' ' + t.result); }
        }
        this.p('day:' + mode, book.day); X.save();
        if (mode === cfg.mode && !X.virtual) { const bq = await X('GET', '/fapi/v2/balance', {}); if (bq.ok) { const u = (bq.res || []).find(x => x.asset === 'USDT') || {}; this.p('acct:' + mode, { bal: +u.balance, avail: +u.availableBalance, upnl: +u.crossUnPnl, at: Date.now() }); } }
      }
      return this.j({ ok: true, ...out });
    }
    if (path === '/balance') { // the account figure for the page (one read, on open)
      const cfg = apCfgNorm(this.g('cfg', null)), X = await this.transport(cfg.mode); if (!X) return this.j({ ok: true, none: true });
      if (X.virtual) { for (const t of this.openTrades('shadow')) await X.tick(t.symbol); X.save(); }
      const bq = await X('GET', '/fapi/v2/balance', {});
      const pos = []; for (const t of this.openTrades(cfg.mode)) { const pr = await X('GET', '/fapi/v2/positionRisk', { symbol: t.symbol }); const row = pr.ok && (pr.res || []).find(p => p.symbol === t.symbol); if (row) pos.push({ id: t.id, mark: +row.markPrice, upnl: +row.unRealizedProfit, liq: +row.liquidationPrice || null }); }
      if (!bq.ok) return this.j({ ok: false, why: bq.msg || bq.why, pos });
      const u = (bq.res || []).find(x => x.asset === 'USDT') || {}; const acct = { bal: +u.balance, avail: +u.availableBalance, upnl: +u.crossUnPnl, at: Date.now() };
      this.p('acct:' + cfg.mode, acct); return this.j({ ok: true, acct, pos });
    }
    if (path === '/closeall') {
      const cfg = apCfgNorm(this.g('cfg', null)), mode = b.mode || cfg.mode, X = await this.transport(mode); if (!X) return this.j({ error: 'no_key' }, 400);
      const book = this.book(mode); const r = await apCloseAll(X, book, b.why || 'closed by the member');
      r.forEach(t => this.saveTrade(t)); this.p('day:' + mode, book.day); X.save();
      for (const t of r) await this.tg(apMsgClose(t, mode));
      return this.j({ ok: true, closed: r.length });
    }
    if (path === '/summary') { // mp-ops row
      const cfg = apCfgNorm(this.g('cfg', null)), conn = this.g('conn', null);
      const all = this.sql.exec("SELECT data FROM trades WHERE status='closed'").toArray().map(r => JSON.parse(r.data));
      const live = all.filter(t => t.mode === cfg.mode);
      return this.j({ ok: true, mode: cfg.mode, paused: cfg.paused, risk: cfg.risk, conn: conn ? { net: conn.net, kid: conn.kid, created: conn.created } : null, open: this.openTrades(cfg.mode).length, closed: live.length, pnl: live.reduce((a, t) => a + (+t.pnl || 0), 0), wins: live.filter(t => t.pnl > 0).length, disabled: !!this.g('disabled', false), tg: !!(this.g('tg', null) || {}).chat, cfg, acct: this.g('acct:' + cfg.mode, null), lastLog: (this.sql.exec('SELECT ts,msg FROM log ORDER BY id DESC LIMIT 1').toArray()[0]) || null });
    }
    return this.j({ error: 'not_found' }, 404);
  }
}
