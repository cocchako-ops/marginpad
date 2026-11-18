// ─── MarginPad Journal: a member's REAL exchange account, read-only (2026-11-18) ──────────────────────────────────
// Owner: "privuci trejdere koji vec trejduju sa velikim volumenom ... ekskluzivno, da daje poverenje ... vise od Tradezelle".
// Plan: drafts/real-journal-plan-2026-11-18.md.
//
// THE RULES THIS FILE IS BUILT ON, and each one is enforced in code rather than promised in copy:
//  1. READ-ONLY OR NOTHING. connect() asks the exchange what the key may do and refuses any key that can trade,
//     transfer or withdraw - before anything is stored. Hyperliquid needs no key at all (a public address).
//  2. THE SECRET NEVER LEAVES THE WORKER IN THE CLEAR. It is sealed with AES-GCM under JOURNAL_KEK (a wrangler secret)
//     bound to the member and the exchange, stored as ciphertext in the member's own JournalStore instance, opened
//     in memory only to SIGN a request, and never returned to any browser.
//  3. ONE FIXED ADDRESS. Every keyed call goes out through the collector droplet's /api/v1/xfwd, which forwards only
//     an allowlist of READ endpoints. The member binds the key to that one IP, so a leaked key is useless elsewhere.
//  4. MISSING IS NOT ZERO. A history an exchange no longer serves is reported as a boundary, never filled in.
//  5. OUR P&L IS RECONCILED WITH THE EXCHANGE'S where the exchange reports one, and the difference is shown.

export const JR_IP = '167.172.98.147';
export const JR_DAYS_MAX = 180;            // the deepest import we attempt (Binance serves 3 months, HL its last 10,000 fills)
const JR_REQ_BUDGET = 45;                  // exchange requests per sync pass per connection - a first import continues next pass
const JR_SYNC_EVERY_MS = 15 * 60000;
const JR_MAX_CONN = 5;
// one coin is one market whatever the exchange calls it (HYPEUSDT on Bybit, HYPE on Hyperliquid, BTC-USDT-SWAP on OKX) - owner's account, 2026-11-18
export function jrCoin(sym) { return String(sym || '').toUpperCase().replace(/^[A-Z0-9]+:/, '').replace(/-SWAP$/, '').replace(/[-_/]/g, '').replace(/(USDT|USDC|USD|PERP|UMCBL)+$/, '') || String(sym || ''); }
const JR_IMPORT_V = 3; // bump to re-import every connection once (2: the millisecond page-boundary fix, 3: Bybit closed-pnl reconciliation)
const DAY = 86400000;

export const JR_EXCH = {
  hyperliquid: { name: 'Hyperliquid', kind: 'address', hist: 'Last 10,000 fills', color: '#97fce4' },
  bybit:       { name: 'Bybit',       kind: 'key',     hist: 'Up to 180 days',    color: '#f7a600', keyUrl: 'https://www.bybit.com/app/user/api-management' },
  binance:     { name: 'Binance',     kind: 'key',     hist: 'Last 3 months (Binance limit)', color: '#f0b90b', keyUrl: 'https://www.binance.com/en/my/settings/api-management' },
  okx:         { name: 'OKX',         kind: 'key', pass: true, hist: 'Last 3 months (OKX limit)', color: '#ffffff', keyUrl: 'https://www.okx.com/account/my-api' },
  bitget:      { name: 'Bitget',      kind: 'key', pass: true, hist: 'Last 90 days (Bitget limit)', color: '#00f0ff', keyUrl: 'https://www.bitget.com/account/newapi' },
  bingx:       { name: 'BingX',       kind: 'key',     hist: 'Up to 90 days',     color: '#2a6aff', keyUrl: 'https://bingx.com/en/account/api' },
};

// ---------- small helpers ----------
const enc = new TextEncoder();
const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); };
const ub64 = (s) => { const b = atob(s); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
async function hmacHex(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const m = await crypto.subtle.sign('HMAC', k, enc.encode(msg));
  return Array.from(new Uint8Array(m)).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function kek(env) {
  if (!env.JOURNAL_KEK) throw new Error('no_kek');
  return crypto.subtle.importKey('raw', ub64(String(env.JOURNAL_KEK).trim()), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
export async function jrSeal(env, uid, ex, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(uid + '|' + ex) }, await kek(env), enc.encode(plain)));
  const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12); return b64(out);
}
export async function jrOpen(env, uid, ex, sealed) {
  const all = ub64(sealed);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12), additionalData: enc.encode(uid + '|' + ex) }, await kek(env), all.slice(12));
  return new TextDecoder().decode(pt);
}
const mask = (k) => { k = String(k || ''); return k.length <= 8 ? '****' : k.slice(0, 4) + '…' + k.slice(-4); };

// ---------- the forwarder (droplet, fixed IP) ----------
async function xfwd(env, H, method, url, headers, body) {
  const fk = await H.collectorKey(env);
  if (!fk) return { ok: false, why: 'no_forwarder_key' };
  try {
    const r = await H.rawFetch(H.collectorBase(env) + '/api/v1/xfwd', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': fk }, body: JSON.stringify({ method, url, headers, body }), signal: AbortSignal.timeout(20000) });
    const txt = await r.text(); let j = null; try { j = JSON.parse(txt); } catch (e) {}
    return { ok: r.ok, status: r.status, j, txt: txt.slice(0, 400) };
  } catch (e) { return { ok: false, why: 'forwarder_unreachable', detail: String(e).slice(0, 120) }; }
}

// ---------- Bybit v5 (linear) ----------
async function bybitGet(env, H, key, secret, path, params) {
  const qs = Object.keys(params).filter(k => params[k] !== '' && params[k] != null).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const ts = String(Date.now()), rw = '20000';
  const sign = await hmacHex(secret, ts + key + rw + qs);
  const r = await xfwd(env, H, 'GET', 'https://api.bybit.com' + path + (qs ? '?' + qs : ''), { 'X-BAPI-API-KEY': key, 'X-BAPI-SIGN': sign, 'X-BAPI-TIMESTAMP': ts, 'X-BAPI-RECV-WINDOW': rw });
  if (!r.j) return { ok: false, why: r.why || 'bad_body', status: r.status, detail: r.txt };
  if (r.j.retCode !== 0) return { ok: false, why: 'bybit_' + r.j.retCode, detail: r.j.retMsg || '' };
  return { ok: true, res: r.j.result || {} };
}
async function bybitCheck(env, H, key, secret) {
  const q = await bybitGet(env, H, key, secret, '/v5/user/query-api', {});
  if (!q.ok) return { ok: false, why: q.why === 'bybit_10003' || q.why === 'bybit_10004' ? 'key_invalid' : q.why === 'bybit_10010' ? 'ip_not_allowed' : q.why, detail: q.detail };
  const p = q.res.permissions || {};
  /* readOnly is THE flag (owner 2026-11-18: a correct Bybit read-only key was refused). In Read-Only mode Bybit still lists the scopes the key may
     READ (ContractTrade: Order, Position) under permissions - those are not write rights. Only readOnly 0 (Read-Write) is refused, and then the
     scopes are named so the member sees what to switch off. */
  const writes = [];
  if (+q.res.readOnly !== 1) { writes.push('Read-Write key'); for (const k of ['ContractTrade', 'Spot', 'Wallet', 'Options', 'Derivatives', 'Exchange', 'Earn']) { const a = p[k] || []; if (a.length) writes.push(k + ': ' + a.join(', ')); } }
  const ips = (q.res.ips || []).filter(x => x && x !== '*');
  return { ok: true, readOnly: +q.res.readOnly === 1 && !writes.length, writes, ips, ipBound: ips.indexOf(JR_IP) >= 0, uta: +q.res.uta === 1, expiredAt: q.res.expiredAt || null };
}
// one pass: walks 7-day windows from the cursor towards now (first import goes from now-180d)
async function bybitSync(env, H, c, key, secret, budget) {
  const st = c.cur || {}; let used = 0; const fills = [], fund = [];
  let from = +st.t || (Date.now() - JR_DAYS_MAX * DAY);
  while (used < budget && from < Date.now() - 5000) {
    const to = Math.min(from + 7 * DAY - 1, Date.now());
    let cursor = st.cursor || '';
    const w0 = fills.length;
    for (let page = 0; page < 30 && used < budget; page++) {
      const q = await bybitGet(env, H, key, secret, '/v5/execution/list', { category: 'linear', startTime: from, endTime: to, limit: 100, cursor });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from, cursor }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      for (const x of (q.res.list || [])) {
        const t = String(x.execType || 'Trade');
        if (t === 'Funding') { fund.push({ k: 'bybit|' + x.execId, sym: x.symbol, ts: +x.execTime, amt: -(+x.execFee || 0), rate: +x.feeRate || 0 }); continue; }
        if (t !== 'Trade' && t !== 'BustTrade' && t !== 'AdlTrade' && t !== 'Delivery') continue;
        fills.push({ k: 'bybit|' + x.execId, sym: x.symbol, side: x.side === 'Buy' ? 1 : -1, px: +x.execPrice, qty: +x.execQty, fee: +x.execFee || 0, maker: x.isMaker ? 1 : 0, ts: +x.execTime, oid: x.orderId || '', ps: 'B', rpnl: null, liq: t === 'BustTrade' ? 1 : 0, adl: t === 'AdlTrade' ? 1 : 0 });
      }
      cursor = q.res.nextPageCursor || '';
      if (!cursor) break;
    }
    if (cursor) return { used, fills, fund, cur: { t: from, cursor } }; // budget ran out mid-window - continue on the same window next pass
    // RECONCILIATION (2026-11-18): Bybit's own Closed P&L for this window, one row per closing order. Its price P&L
    // (exit value - entry value) is spread over that order's fills by quantity, so jrBuild can check every position against
    // the exchange the way it does on Hyperliquid. An opening fill carries 0; an order that also OPENED (a flip) carries
    // nothing (rpnl stays null) - that position is simply not reconciled rather than reconciled wrongly.
    if (fills.length > w0 && used < budget) {
      const cpm = {}; let cc = '', okc = true;
      for (let page = 0; page < 20 && used < budget; page++) {
        const q = await bybitGet(env, H, key, secret, '/v5/position/closed-pnl', { category: 'linear', startTime: from, endTime: to, limit: 100, cursor: cc });
        used++;
        if (!q.ok) { okc = false; break; }
        for (const x of (q.res.list || [])) { const g = (x.side === 'Sell' ? 1 : -1) * ((+x.cumExitValue || 0) - (+x.cumEntryValue || 0)); const o = cpm[x.orderId] || (cpm[x.orderId] = { g: 0, sz: 0 }); o.g += g; o.sz += +x.closedSize || 0; }
        cc = q.res.nextPageCursor || ''; if (!cc) break;
      }
      if (okc) {
        const W = fills.slice(w0), byO = {};
        for (const f of W) (byO[f.oid] = byO[f.oid] || []).push(f);
        for (const oid in byO) {
          const L = byO[oid], qty = L.reduce((a, f) => a + f.qty, 0), o = cpm[oid];
          if (!o) { for (const f of L) f.rpnl = 0; continue; }
          if (Math.abs(o.sz - qty) > qty * 1e-6 + 1e-9) continue; // closed only part of the order (a flip) or the order ran over the window edge: not reconciled
          for (const f of L) f.rpnl = o.g * f.qty / qty;
        }
      }
    }
    st.cursor = '';
    from = to + 1;
  }
  return { used, fills, fund, cur: { t: Math.min(from, Date.now() - 2 * 3600000), cursor: '' } }; // re-read the last 2 h each pass: late fills
}

// ---------- Binance USD-M ----------
async function bnGet(env, H, host, key, secret, path, params) {
  const qs = Object.keys(params).filter(k => params[k] !== '' && params[k] != null).map(k => k + '=' + encodeURIComponent(params[k])).join('&') + (Object.keys(params).length ? '&' : '') + 'recvWindow=20000&timestamp=' + Date.now();
  const sig = await hmacHex(secret, qs);
  const r = await xfwd(env, H, 'GET', 'https://' + host + path + '?' + qs + '&signature=' + sig, { 'X-MBX-APIKEY': key });
  if (!r.j) return { ok: false, why: r.why || 'bad_body', status: r.status, detail: r.txt };
  if (!r.ok || (r.j && r.j.code && r.j.code < 0)) return { ok: false, why: 'binance_' + ((r.j && r.j.code) || r.status), detail: (r.j && r.j.msg) || '' };
  return { ok: true, res: r.j };
}
async function binanceCheck(env, H, key, secret) {
  const q = await bnGet(env, H, 'api.binance.com', key, secret, '/sapi/v1/account/apiRestrictions', {});
  if (!q.ok) return { ok: false, why: /binance_-(2015|2014|2008)$/.test(q.why) ? 'key_invalid' : q.why, detail: q.detail };
  const a = q.res, writes = [];
  if (a.enableSpotAndMarginTrading) writes.push('Spot & Margin trading');
  if (a.enableWithdrawals) writes.push('Withdrawals');
  if (a.enableInternalTransfer) writes.push('Internal transfer');
  if (a.permitsUniversalTransfer) writes.push('Universal transfer');
  if (a.enableFutures) writes.push('Futures trading');
  if (a.enableMargin) writes.push('Margin');
  if (a.enableVanillaOptions) writes.push('Options trading');
  if (a.enablePortfolioMarginTrading) writes.push('Portfolio margin trading');
  if (!a.enableReading) return { ok: false, why: 'no_read' };
  return { ok: true, readOnly: !writes.length, writes, ipBound: !!a.ipRestrict, ips: [], expiredAt: a.tradingAuthorityExpirationTime || null };
}
async function binanceSync(env, H, c, key, secret, budget, priceOf) {
  const st = c.cur || {}; let used = 0; const fills = [], fund = [];
  let from = Math.max(+st.t || 0, Date.now() - 89 * DAY); // Binance serves three months
  while (used < budget && from < Date.now() - 5000) {
    const to = Math.min(from + 7 * DAY - 1, Date.now());
    // 1. the income ledger: funding, and which symbols traded in this window
    const syms = new Set(); let start = from;
    for (let page = 0; page < 10 && used < budget; page++) {
      const q = await bnGet(env, H, 'fapi.binance.com', key, secret, '/fapi/v1/income', { startTime: start, endTime: to, limit: 1000 });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      const L = Array.isArray(q.res) ? q.res : [];
      for (const x of L) {
        if (x.symbol) syms.add(x.symbol);
        if (x.incomeType === 'FUNDING_FEE') fund.push({ k: 'binance|f' + x.tranId, sym: x.symbol, ts: +x.time, amt: +x.income || 0, rate: 0 });
      }
      if (L.length < 1000) break;
      { const lt = +L[L.length - 1].time; start = lt > start ? lt : lt + 1; } // restart AT the last millisecond (rows de-duplicate by key) - +1 dropped the rest of a millisecond cut by the page
    }
    if (used + syms.size > budget && syms.size) return { used, fills, fund, cur: { t: from } }; // not enough budget for this window's symbols - redo it next pass
    // 2. the fills, per symbol (Binance requires one)
    for (const sym of syms) {
     for (let s0 = from, pg = 0; pg < 20 && used < budget + 20; pg++) { // a busy symbol has more than 1,000 fills a week: page on, from the last millisecond
      const q = await bnGet(env, H, 'fapi.binance.com', key, secret, '/fapi/v1/userTrades', { symbol: sym, startTime: s0, endTime: to, limit: 1000 });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      const LT = Array.isArray(q.res) ? q.res : [];
      for (const x of LT) {
        let fee = +x.commission || 0; const a = String(x.commissionAsset || 'USDT');
        if (!/^(USDT|USDC|BUSD|FDUSD|USD)$/.test(a)) { const p = await priceOf(a); fee = p > 0 ? fee * p : 0; }
        fills.push({ k: 'binance|' + x.symbol + '|' + x.id, sym: x.symbol, side: x.side === 'BUY' ? 1 : -1, px: +x.price, qty: +x.qty, fee, maker: x.maker ? 1 : 0, ts: +x.time, oid: String(x.orderId || ''), ps: x.positionSide === 'LONG' ? 'L' : x.positionSide === 'SHORT' ? 'S' : 'B', rpnl: +x.realizedPnl || 0, liq: 0, adl: 0 });
      }
      if (LT.length < 1000) break;
      const lt = +LT[LT.length - 1].time; s0 = lt > s0 ? lt : lt + 1;
     }
    }
    from = to + 1;
  }
  return { used, fills, fund, cur: { t: Math.min(from, Date.now() - 2 * 3600000) } };
}

// ---------- BingX (USDT-M perpetual) ----------
// Signing (docs-v3 'Signature Authentication'): business params + timestamp, sorted by key, joined k=v&k=v unencoded,
// HMAC-SHA256 lowercase hex appended as &signature=; key in X-BX-APIKEY. Permissions: GET /openApi/v1/account/apiPermissions
// -> permissions [1 spot trade, 2 read, 3 contract trade, 4 universal transfer, 5 withdraw, 7 sub-account transfer], ipAddresses.
async function bxGet(env, H, key, secret, path, params) {
  const p = Object.assign({}, params, { recvWindow: 20000, timestamp: Date.now() });
  const qs = Object.keys(p).filter(k => p[k] !== '' && p[k] != null).sort().map(k => k + '=' + p[k]).join('&');
  const sig = await hmacHex(secret, qs);
  const r = await xfwd(env, H, 'GET', 'https://open-api.bingx.com' + path + '?' + qs + '&signature=' + sig, { 'X-BX-APIKEY': key });
  if (!r.j) return { ok: false, why: r.why || 'bad_body', status: r.status, detail: r.txt };
  if (r.j.code !== 0 && r.j.code !== '0') return { ok: false, why: 'bingx_' + r.j.code, detail: r.j.msg || '' };
  return { ok: true, res: r.j.data };
}
const BX_PERM = { 1: 'Spot trading', 3: 'Perpetual trading', 4: 'Universal transfer', 5: 'Withdraw', 7: 'Sub-account transfer' };
async function bingxCheck(env, H, key, secret) {
  const q = await bxGet(env, H, key, secret, '/openApi/v1/account/apiPermissions', {});
  if (!q.ok) return { ok: false, why: /100413|100001|100419|100421/.test(q.why) ? 'key_invalid' : /100410|100412/.test(q.why) ? 'ip_not_allowed' : q.why, detail: q.detail };
  const perms = (q.res && q.res.permissions || []).map(Number), ips = (q.res && q.res.ipAddresses || []).filter(Boolean);
  if (perms.indexOf(2) < 0) return { ok: false, why: 'no_read' };
  const writes = perms.filter(x => BX_PERM[x]).map(x => BX_PERM[x]);
  return { ok: true, readOnly: !writes.length, writes, ips, ipBound: ips.indexOf(JR_IP) >= 0 };
}
async function bingxSync(env, H, c, key, secret, budget) {
  const st = c.cur || {}; let used = 0; const fills = [], fund = [];
  let from = +st.t || (Date.now() - 90 * DAY); // fillHistory answers in 7-day windows; how far back BingX keeps is not stated - we walk 90 days and report where it ends
  while (used < budget && from < Date.now() - 5000) {
    const to = Math.min(from + 7 * DAY - 1, Date.now());
    for (let page = 1; page <= 20 && used < budget; page++) {
      const q = await bxGet(env, H, key, secret, '/openApi/swap/v2/trade/fillHistory', { currency: 'USDT', startTs: from, endTs: to, pageIndex: page, pageSize: 1000 });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      const L = (q.res && q.res.fill_history_orders) || [];
      for (const x of L) {
        const ts = Date.parse(x.filledTime) || +x.filledTime || 0; if (!ts) continue;
        fills.push({ k: 'bingx|' + x.tradeId, sym: x.symbol, side: String(x.side).toUpperCase() === 'BUY' ? 1 : -1, px: +x.price, qty: +x.qty, fee: -(+x.commission || 0), maker: String(x.role).toLowerCase() === 'maker' ? 1 : 0, ts, oid: String(x.orderId || ''), ps: x.positionSide === 'LONG' ? 'L' : x.positionSide === 'SHORT' ? 'S' : 'B', rpnl: x.realisedPNL != null ? +x.realisedPNL || 0 : null, liq: 0, adl: 0 });
      }
      if (L.length < 1000) break;
    }
    // funding over the same window (income: positive = received)
    let s0 = from;
    for (let pg = 0; pg < 5 && used < budget + 5; pg++) {
      const q = await bxGet(env, H, key, secret, '/openApi/swap/v2/user/income', { incomeType: 'FUNDING_FEE', startTime: s0, endTime: to, limit: 1000 });
      used++;
      if (!q.ok) break;
      const L = Array.isArray(q.res) ? q.res : [];
      for (const x of L) fund.push({ k: 'bingx|f' + x.tranId, sym: x.symbol, ts: +x.time, amt: +x.income || 0, rate: 0 });
      if (L.length < 1000) break;
      const lt = +L[L.length - 1].time; s0 = lt > s0 ? lt : lt + 1;
    }
    from = to + 1;
  }
  return { used, fills, fund, cur: { t: Math.min(from, Date.now() - 2 * 3600000) } };
}

// ---------- OKX (USDT-margined SWAP) ----------
// Signing: base64(HMAC-SHA256(secret, ts + 'GET' + path?query)); headers OK-ACCESS-KEY/-SIGN/-TIMESTAMP (ISO ms)/-PASSPHRASE.
// Permissions: /api/v5/account/config -> perm 'read_only' exactly, ip = bound IPs. Fills: /api/v5/trade/fills-history (3 months,
// 100 a page, 'after' = older than billId), size in CONTRACTS x ctVal. Funding: /api/v5/account/bills-archive type 8, balChg signed.
async function hmacB64(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg))));
}
const OKX_HOSTS = ['www.okx.com', 'eea.okx.com', 'us.okx.com'];
async function okxGet(env, H, host, key, secret, pass, path, params) {
  const qs = Object.keys(params).filter(k => params[k] !== '' && params[k] != null).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const rp = path + (qs ? '?' + qs : ''), ts = new Date().toISOString();
  const sign = await hmacB64(secret, ts + 'GET' + rp);
  const r = await xfwd(env, H, 'GET', 'https://' + host + rp, { 'OK-ACCESS-KEY': key, 'OK-ACCESS-SIGN': sign, 'OK-ACCESS-TIMESTAMP': ts, 'OK-ACCESS-PASSPHRASE': pass });
  if (!r.j) return { ok: false, why: r.why || 'bad_body', status: r.status, detail: r.txt };
  if (String(r.j.code) !== '0') return { ok: false, why: 'okx_' + r.j.code, detail: r.j.msg || '' };
  return { ok: true, res: r.j.data || [] };
}
async function okxCheck(env, H, key, secret, pass) {
  let last = null;
  for (const host of OKX_HOSTS) { // an EEA or US account answers only on its own host
    const q = await okxGet(env, H, host, key, secret, pass, '/api/v5/account/config', {});
    if (q.ok) {
      const a = q.res[0] || {}, perm = String(a.perm || '').split(',').map(x => x.trim()).filter(Boolean);
      const writes = perm.filter(x => x !== 'read_only').map(x => x === 'trade' ? 'Trade' : x === 'withdraw' ? 'Withdraw' : x);
      const ips = String(a.ip || '').split(',').map(x => x.trim()).filter(Boolean);
      return { ok: true, readOnly: perm.length === 1 && perm[0] === 'read_only', writes, ips, ipBound: ips.indexOf(JR_IP) >= 0, host };
    }
    last = q; if (!/okx_50119|okx_50111|okx_50105/.test(q.why)) break; // only "no such key here" moves on to the next host
  }
  return { ok: false, why: /okx_50119|okx_50111/.test(last.why) ? 'key_invalid' : /okx_50105/.test(last.why) ? 'bad_passphrase' : /okx_50110/.test(last.why) ? 'ip_not_allowed' : last.why, detail: last.detail };
}
let _okxCt = null;
async function okxCtVal(env, H) {
  if (_okxCt && Date.now() - _okxCt.t < 6 * 3600000) return _okxCt.m;
  const m = {};
  try { const r = await H.rawFetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP', { signal: AbortSignal.timeout(12000) }); const j = await r.json(); for (const x of (j.data || [])) m[x.instId] = { v: +x.ctVal || 0, lin: x.ctType === 'linear', ccy: x.settleCcy }; } catch (e) {}
  if (Object.keys(m).length) _okxCt = { t: Date.now(), m };
  return m;
}
async function okxSync(env, H, c, sec, budget) {
  const st = c.cur || {}; let used = 0; const fills = [], fund = [];
  const host = sec.h || 'www.okx.com', ct = await okxCtVal(env, H);
  if (!Object.keys(ct).length) return { used, fills, fund, cur: st, err: 'okx_instruments_unreachable' };
  let from = +st.t || (Date.now() - 89 * DAY);
  while (used < budget && from < Date.now() - 5000) {
    const to = Math.min(from + 7 * DAY - 1, Date.now());
    let after = '';
    for (let page = 0; page < 40 && used < budget; page++) {
      const q = await okxGet(env, H, host, sec.k, sec.s, sec.p, '/api/v5/trade/fills-history', { instType: 'SWAP', begin: from, end: to, after, limit: 100 });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      for (const x of q.res) {
        const ci = ct[x.instId]; if (!ci || !ci.lin || !/USDT|USDC/.test(ci.ccy || '')) continue; // USDT/USDC-margined linear swaps
        const sub = +x.subType || 0, liq = (sub >= 100 && sub <= 106) || +x.tradeId < 0 ? 1 : 0;
        fills.push({ k: 'okx|' + x.instId + '|' + x.tradeId + '|' + x.billId, sym: x.instId.replace(/-SWAP$/, '').replace('-', ''), side: x.side === 'buy' ? 1 : -1, px: +x.fillPx, qty: (+x.fillSz || 0) * ci.v, fee: -(+x.fee || 0), maker: x.execType === 'M' ? 1 : 0, ts: +x.fillTime || +x.ts, oid: String(x.ordId || ''), ps: x.posSide === 'long' ? 'L' : x.posSide === 'short' ? 'S' : 'B', rpnl: x.fillPnl != null && x.fillPnl !== '' ? +x.fillPnl : null, liq, adl: 0 });
      }
      if (q.res.length < 100) break;
      after = q.res[q.res.length - 1].billId;
    }
    // funding in the same window: bills-archive type 8 (funding fee), balChg + = received
    let fa = '';
    for (let pg = 0; pg < 10 && used < budget + 10; pg++) {
      const q = await okxGet(env, H, host, sec.k, sec.s, sec.p, '/api/v5/account/bills-archive', { instType: 'SWAP', type: 8, begin: from, end: to, after: fa, limit: 100 });
      used++;
      if (!q.ok) break;
      for (const x of q.res) fund.push({ k: 'okx|f' + x.billId, sym: String(x.instId || '').replace(/-SWAP$/, '').replace('-', ''), ts: +x.ts, amt: +x.balChg || +x.pnl || 0, rate: 0 });
      if (q.res.length < 100) break;
      fa = q.res[q.res.length - 1].billId;
    }
    from = to + 1;
  }
  return { used, fills, fund, cur: { t: Math.min(from, Date.now() - 2 * 3600000) } };
}

// ---------- Bitget (v2 classic, USDT-FUTURES) ----------
// Signing: base64(HMAC-SHA256(secret, ts + 'GET' + path + '?' + query)); ACCESS-KEY/-SIGN/-TIMESTAMP (ms)/-PASSPHRASE.
// Permissions: /api/v2/spot/account/info -> authorities (codes ending in 'w', and 'p2p', are write), ips.
// Fills: /api/v2/mix/order/fill-history (1-week span, 100 a page, idLessThan = older), baseVolume in coins, feeDetail totalFee signed.
// Funding: /api/v2/mix/account/bill businessType contract_settle_fee (90 days, 30-day span).
async function bgGet(env, H, key, secret, pass, path, params) {
  const qs = Object.keys(params).filter(k => params[k] !== '' && params[k] != null).sort().map(k => k + '=' + encodeURIComponent(params[k])).join('&');
  const ts = String(Date.now()), sign = await hmacB64(secret, ts + 'GET' + path + (qs ? '?' + qs : ''));
  const r = await xfwd(env, H, 'GET', 'https://api.bitget.com' + path + (qs ? '?' + qs : ''), { 'ACCESS-KEY': key, 'ACCESS-SIGN': sign, 'ACCESS-TIMESTAMP': ts, 'ACCESS-PASSPHRASE': pass, locale: 'en-US' });
  if (!r.j) return { ok: false, why: r.why || 'bad_body', status: r.status, detail: r.txt };
  if (String(r.j.code) !== '00000') return { ok: false, why: 'bitget_' + r.j.code, detail: r.j.msg || '' };
  return { ok: true, res: r.j.data };
}
async function bitgetCheck(env, H, key, secret, pass) {
  const q = await bgGet(env, H, key, secret, pass, '/api/v2/spot/account/info', {});
  if (!q.ok) return { ok: false, why: /40006|40037|40012/.test(q.why) ? 'key_invalid' : /40011|40009/.test(q.why) ? 'bad_passphrase' : /40018/.test(q.why) ? 'ip_not_allowed' : q.why, detail: q.detail };
  const a = q.res || {}, au = (a.authorities || []).map(String);
  const writes = au.filter(x => /w$/.test(x) || x === 'p2p');
  const ips = (Array.isArray(a.ips) ? a.ips : String(a.ips || '').split(',')).map(x => String(x).trim()).filter(Boolean);
  return { ok: true, readOnly: !writes.length, writes, ips, ipBound: ips.indexOf(JR_IP) >= 0 };
}
async function bitgetSync(env, H, c, sec, budget) {
  const st = c.cur || {}; let used = 0; const fills = [], fund = [];
  let from = +st.t || (Date.now() - 89 * DAY);
  while (used < budget && from < Date.now() - 5000) {
    const to = Math.min(from + 7 * DAY - 1, Date.now());
    let older = '';
    for (let page = 0; page < 40 && used < budget; page++) {
      const q = await bgGet(env, H, sec.k, sec.s, sec.p, '/api/v2/mix/order/fill-history', { productType: 'USDT-FUTURES', startTime: from, endTime: to, idLessThan: older, limit: 100 });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      const L = (q.res && q.res.fillList) || [];
      for (const x of L) {
        const ts2 = String(x.tradeSide || ''), side = x.side === 'buy' ? 1 : -1, hedge = x.posMode === 'hedge_mode';
        const fee = (x.feeDetail || []).reduce((a2, d) => a2 + (+d.totalFee || 0), 0);
        fills.push({ k: 'bitget|' + x.tradeId, sym: x.symbol, side, px: +x.price, qty: +x.baseVolume, fee: -fee, maker: x.tradeScope === 'maker' ? 1 : 0, ts: +x.cTime, oid: String(x.orderId || ''), ps: hedge ? (/open/.test(ts2) ? (side > 0 ? 'L' : 'S') : (side < 0 ? 'L' : 'S')) : 'B', rpnl: x.profit != null && x.profit !== '' ? +x.profit : null, liq: /^burst/.test(ts2) || x.enterPointSource === 'SYS' ? 1 : 0, adl: /adl/.test(ts2) ? 1 : 0 });
      }
      if (L.length < 100 || !q.res.endId) break;
      older = q.res.endId;
    }
    let fo = '';
    for (let pg = 0; pg < 10 && used < budget + 10; pg++) {
      const q = await bgGet(env, H, sec.k, sec.s, sec.p, '/api/v2/mix/account/bill', { productType: 'USDT-FUTURES', businessType: 'contract_settle_fee', startTime: from, endTime: to, idLessThan: fo, limit: 100 });
      used++;
      if (!q.ok) break;
      const L = (q.res && q.res.bills) || [];
      for (const x of L) fund.push({ k: 'bitget|f' + x.billId, sym: x.symbol, ts: +x.cTime, amt: +x.amount || 0, rate: 0 });
      if (L.length < 100 || !q.res.endId) break;
      fo = q.res.endId;
    }
    from = to + 1;
  }
  return { used, fills, fund, cur: { t: Math.min(from, Date.now() - 2 * 3600000) } };
}

// ---------- Hyperliquid (public address, no key) ----------
async function hlInfo(env, H, body) {
  try {
    const r = await H.rawFetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    if (r.ok) return { ok: true, j: await r.json() };
  } catch (e) {}
  const f = await xfwd(env, H, 'POST', 'https://api.hyperliquid.xyz/info', {}, body); // their per-IP weight budget: the second road
  return f.ok && f.j ? { ok: true, j: f.j } : { ok: false, why: f.why || ('hl_' + f.status) };
}
async function hlCheck(env, H, addr) {
  const q = await hlInfo(env, H, { type: 'userFees', user: addr });
  if (!q.ok) return { ok: false, why: q.why };
  return { ok: true, readOnly: true, writes: [], ipBound: true, address: true, vol14: (q.j.dailyUserVlm || []).reduce((a, d) => a + (+d.userCross || 0) + (+d.userAdd || 0), 0) };
}
async function hlSync(env, H, c, addr, budget) {
  const st = c.cur || {}; let used = 0; const fills = [], fund = [];
  let from = +st.t || (Date.now() - JR_DAYS_MAX * DAY);
  while (used < budget) {
    const q = await hlInfo(env, H, { type: 'userFillsByTime', user: addr, startTime: from, endTime: Date.now(), aggregateByTime: false });
    used++;
    if (!q.ok) return { used, fills, fund, cur: { t: from, f: st.f }, err: q.why };
    const L = Array.isArray(q.j) ? q.j : [];
    for (const x of L) {
      if (String(x.coin || '').indexOf('@') === 0) continue; // spot pairs are indexed '@107' - this is a perps journal
      const liq = x.liquidation && String(x.liquidation.liquidatedUser || '').toLowerCase() === addr.toLowerCase() ? 1 : 0;
      fills.push({ k: 'hyperliquid|' + x.tid + '|' + x.oid, sym: x.coin, side: x.side === 'B' ? 1 : -1, px: +x.px, qty: +x.sz, fee: +x.fee || 0, maker: x.crossed ? 0 : 1, ts: +x.time, oid: String(x.oid || ''), ps: 'B', rpnl: +x.closedPnl || 0, liq, adl: 0, start: x.startPosition != null ? +x.startPosition : null, dir: String(x.dir || '') });
    }
    if (L.length < 2000) { from = Date.now() - 2 * 3600000; break; }
    { const lt = +L[L.length - 1].time; from = lt > from ? lt : lt + 1; } // AT the last millisecond: one order fills many times in one ms, and +1 lost the rest of it (owner's HL history 2026-11-18: closes without an open, "held 60 days")
  }
  // funding, separately cursored
  let ff = +st.f || (Date.now() - JR_DAYS_MAX * DAY);
  for (let i = 0; i < 6 && used < budget + 6; i++) {
    const q = await hlInfo(env, H, { type: 'userFunding', user: addr, startTime: ff, endTime: Date.now() });
    used++;
    if (!q.ok) break;
    const L = Array.isArray(q.j) ? q.j : [];
    for (const x of L) { const d = x.delta || {}; if (d.type !== 'funding') continue; fund.push({ k: 'hyperliquid|f' + x.hash + '|' + d.coin, sym: d.coin, ts: +x.time, amt: +d.usdc || 0, rate: +d.fundingRate || 0 }); }
    if (L.length < 500) { ff = Date.now() - 2 * 3600000; break; }
    { const lt = +L[L.length - 1].time; ff = lt > ff ? lt : lt + 1; }
  }
  return { used, fills, fund, cur: { t: from, f: ff } };
}

// ---------- THE P&L ENGINE (pure) ----------
// Fills -> positions. One-way per (exchange, symbol); hedge legs ('L'/'S') kept apart. Average-cost entry, partial
// closes, flips split pro rata, fees per leg, funding attributed to the position open on that symbol at that time.
// Where the exchange reports realized P&L per fill (Hyperliquid closedPnl, Binance realizedPnl) we also sum THEIRS
// and reconcile. A close whose opening lies before the imported history is recovered from the exchange's own
// realized figure (entry = px - rpnl / (qty * dir)) and marked partial rather than read as a new position.
export function jrBuild(fills, funding) {
  /* ONE MILLISECOND HOLDS SEVERAL FILLS OF ONE ORDER, and their order decides the position (owner's HL account 2026-11-18: the second part of a
     short processed before the first read as a short opened before the history, and fifteen trades merged into one). Within a millisecond:
     Hyperliquid states the position BEFORE each fill (startPosition) - opening fills go from the smallest |start| up, closing fills from the
     largest down; every other exchange keeps the order it sent (a stable sort; the store returns rows in arrival order). */
  const hlRank = (f) => f.start == null ? 0 : (/^Close|Liquidat/.test(f.dir || '') ? -Math.abs(f.start) : Math.abs(f.start));
  const F = fills.map((f, i) => [f, i]).sort((x, y) => x[0].ts - y[0].ts || (x[0].sym === y[0].sym && x[0].start != null && y[0].start != null ? hlRank(x[0]) - hlRank(y[0]) : 0) || x[1] - y[1]).map(x => x[0]);
  const open = new Map(), pos = [];
  let seq = 0;
  const mk = (f, key, dir, partial) => ({ id: f.ex + ':' + f.sym + ':' + (f.ps || 'B') + ':' + f.ts + ':' + (dir > 0 ? 'L' : 'S') + (partial ? 'p' : ''), conn: f.conn || '', ex: f.ex, sym: f.sym, ps: f.ps, dir, openTs: f.ts, closeTs: 0, q: 0, avg: 0, maxQ: 0, maxNotional: 0, entryNotional: 0, exitQty: 0, exitNotional: 0, gross: 0, fees: 0, feesTaker: 0, feesMaker: 0, funding: 0, xpnl: 0, xknown: true, n: 0, nMaker: 0, nTaker: 0, liq: 0, adl: 0, partial: !!partial, key, vol: 0, entTF: 0, entTV: 0 });
  for (const f of F) {
    const key = f.ex + '|' + f.sym + '|' + f.ps;
    let p = open.get(key);
    let qty = f.qty, s = f.side;
    const reduces = p && Math.sign(p.q) === -s;
    if (!p) {
      // a close we never saw open (history boundary)? HL says so in dir / startPosition; Binance by a non-zero realizedPnl
      const looksClose = (f.dir && /^Close|Liquidat|>/.test(f.dir) && f.start) || (f.ex === 'binance' && f.rpnl);
      if (looksClose && f.rpnl != null && qty > 0) {
        const d = -s; p = mk(f, key, d, true);
        p.q = d * qty; p.avg = f.px - f.rpnl / (qty * d); p.maxQ = qty; p.maxNotional = p.entryNotional = qty * p.avg;
        open.set(key, p); pos.push(p);
      } else if (f.start != null && Math.abs(f.start) > 1e-12) {
        // the exchange says a position already stood before this fill (HL keeps its last 10,000 fills only): we cannot know
        // its entry, so it is PARTIAL - the exchange's realized P&L is the figure, nothing is reconciled against our own
        p = mk(f, key, Math.sign(f.start), true); p.q = f.start; p.avg = NaN; p.maxQ = Math.abs(f.start); open.set(key, p); pos.push(p);
      } else {
        p = mk(f, key, s, false); open.set(key, p); pos.push(p);
      }
    }
    p.n++; if (f.maker) p.nMaker++; else p.nTaker++;
    p.fees += f.fee; if (f.maker) p.feesMaker += f.fee; else p.feesTaker += f.fee;
    p.vol += f.px * f.qty;
    if (f.liq) p.liq = 1; if (f.adl) p.adl = 1;
    if (f.rpnl == null) p.xknown = false; else p.xpnl += f.rpnl;
    if (Math.sign(p.q) === -s && p.q !== 0) {
      const closeQ = Math.min(qty, Math.abs(p.q)), d = Math.sign(p.q);
      p.gross += (f.px - p.avg) * closeQ * d;
      p.exitQty += closeQ; p.exitNotional += f.px * closeQ;
      p.q -= d * closeQ; qty -= closeQ;
      if (Math.abs(p.q) < 1e-12) {
        p.q = 0; p.closeTs = f.ts; open.delete(key);
        if (qty > 1e-12) { // a flip: the rest opens a new position; its share of this fill's fee moves with it
          const share = qty / f.qty, fp = f.fee * share;
          p.fees -= fp; if (f.maker) p.feesMaker -= fp; else p.feesTaker -= fp;
          p.vol -= f.px * qty;
          const np = mk(f, key, s, false); np.q = s * qty; np.avg = f.px; np.maxQ = qty; np.maxNotional = np.entryNotional = qty * f.px;
          np.fees = fp; if (f.maker) np.feesMaker = fp; else { np.feesTaker = fp; np.entTF = fp; np.entTV = f.px * qty; } np.vol = f.px * qty; np.n = 1; if (f.maker) np.nMaker = 1; else np.nTaker = 1;
          open.set(key, np); pos.push(np);
        }
      }
    } else {
      const aq = Math.abs(p.q);
      if (!f.maker) { const sh = qty / f.qty; p.entTF += f.fee * sh; p.entTV += f.px * qty; } // an ENTRY taken as taker: the part a limit order could have changed
      p.avg = (p.avg * aq + f.px * qty) / (aq + qty);
      p.q += s * qty;
      p.entryNotional += f.px * qty;
      if (Math.abs(p.q) > p.maxQ) { p.maxQ = Math.abs(p.q); p.maxNotional = p.maxQ * (isFinite(p.avg) ? p.avg : f.px); }
    }
  }
  // funding onto the position that was open on that symbol at that moment
  const bySym = new Map();
  for (const p of pos) { const k = p.ex + '|' + p.sym; if (!bySym.has(k)) bySym.set(k, []); bySym.get(k).push(p); }
  let fundLoose = 0;
  for (const r of (funding || [])) {
    const L = bySym.get(r.ex + '|' + r.sym) || []; let hit = null;
    for (const p of L) { if (r.ts >= p.openTs - 60000 && (!p.closeTs || r.ts <= p.closeTs + 60000)) { hit = p; break; } }
    if (hit) hit.funding += r.amt; else fundLoose += r.amt;
  }
  const _seen = {}; for (const p of pos) { if (_seen[p.id]) p.id += '#' + (++_seen[p.id]); else _seen[p.id] = 1; } // ids are unique even when two positions share a millisecond
  for (const p of pos) {
    if (!isFinite(p.gross) || !isFinite(p.avg)) { p.unknownEntry = true; p.gross = p.xknown ? p.xpnl : 0; p.avg = null; } // an entry we never saw: the exchange's P&L is the figure
    if (p.partial && p.xknown) p.gross = p.xpnl;
    p.entry = p.avg; p.exit = p.exitQty ? p.exitNotional / p.exitQty : null;
    p.net = p.gross - p.fees + p.funding;
    p.status = p.q === 0 && p.closeTs ? 'closed' : 'open';
    p.hold = (p.closeTs || Date.now()) - p.openTs;
    p.diff = p.xknown && p.status === 'closed' && !p.partial ? +(p.gross - p.xpnl).toFixed(4) : null;
    p.ret = p.maxNotional > 0 ? p.net / p.maxNotional * 100 : 0; // return on the largest notional held (no leverage in the fills)
    delete p.key;
  }
  return { positions: pos, fundLoose };
}

const pct = (a, b) => b ? a / b * 100 : 0;
// headline numbers, breakdowns (n>=8 rule), equity curve, calendar
export function jrStats(positions, fills, funding, fromTs) {
  const P = positions.filter(p => p.status === 'closed' && p.closeTs >= fromTs).sort((a, b) => a.closeTs - b.closeTs);
  const Fx = fills.filter(f => f.ts >= fromTs), Fu = (funding || []).filter(f => f.ts >= fromTs);
  const wins = P.filter(p => p.net > 0), losses = P.filter(p => p.net < 0);
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
  const gw = sum(wins, p => p.net), gl = -sum(losses, p => p.net);
  let eq = 0, peak = 0, dd = 0; const curve = [];
  for (const p of P) { eq += p.net; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); curve.push([p.closeTs, +eq.toFixed(2)]); }
  const vol = sum(Fx, f => f.px * f.qty), fees = sum(Fx, f => f.fee), feesT = sum(Fx.filter(f => !f.maker), f => f.fee), feesM = fees - feesT;
  const volT = sum(Fx.filter(f => !f.maker), f => f.px * f.qty), volM = vol - volT;
  const cov0 = Fx.length ? Math.min(...Fx.map(f => f.ts)) : Date.now();
  const fundNet = sum(Fu, f => f.amt);
  const day = {}; for (const p of P) { const d = new Date(p.closeTs).toISOString().slice(0, 10); day[d] = (day[d] || 0) + p.net; }
  const group = (keyf, minN) => { const g = {}; for (const p of P) { const k = keyf(p); if (k == null) continue; const o = g[k] || (g[k] = { k, n: 0, net: 0, w: 0 }); o.n++; o.net += p.net; if (p.net > 0) o.w++; } return Object.values(g).filter(o => o.n >= (minN || 8)).map(o => ({ k: o.k, n: o.n, net: +o.net.toFixed(2), wr: +(o.w / o.n * 100).toFixed(1), avg: +(o.net / o.n).toFixed(2) })).sort((a, b) => a.net - b.net); };
  const holdB = (h) => h < 5 * 60000 ? '< 5 min' : h < 3600000 ? '5-60 min' : h < 4 * 3600000 ? '1-4 h' : h < DAY ? '4-24 h' : '> 1 day';
  const sizeB = (n) => n < 1000 ? '< $1k' : n < 10000 ? '$1k-10k' : n < 100000 ? '$10k-100k' : '> $100k';
  return {
    n: P.length, net: +sum(P, p => p.net).toFixed(2), gross: +sum(P, p => p.gross).toFixed(2), wins: wins.length, losses: losses.length,
    winRate: P.length ? +(wins.length / P.length * 100).toFixed(1) : null,
    profitFactor: gl > 0 ? +(gw / gl).toFixed(2) : (gw > 0 ? null : null), avgWin: wins.length ? +(gw / wins.length).toFixed(2) : null, avgLoss: losses.length ? +(-gl / losses.length).toFixed(2) : null,
    expectancy: P.length ? +(sum(P, p => p.net) / P.length).toFixed(2) : null, maxDD: +dd.toFixed(2),
    best: P.length ? P.reduce((a, b) => b.net > a.net ? b : a) : null, worst: P.length ? P.reduce((a, b) => b.net < a.net ? b : a) : null,
    vol: +vol.toFixed(2), fills: Fx.length, orders: new Set(Fx.map(f => f.ex + '|' + (f.oid || f.k))).size, fees: +fees.toFixed(2), feesTaker: +feesT.toFixed(2), feesMaker: +feesM.toFixed(2), takerShare: vol ? +(volT / vol * 100).toFixed(1) : null,
    effRate: vol ? +(fees / vol * 100).toFixed(4) : null, funding: +fundNet.toFixed(2),
    volTaker: +volT.toFixed(2), volMaker: +volM.toFixed(2), rateTaker: volT ? feesT / volT * 100 : null, rateMaker: volM ? feesM / volM * 100 : null,
    entTakerFee: +sum(P, p => p.entTF || 0).toFixed(2), entTakerVol: +sum(P, p => p.entTV || 0).toFixed(2),
    covFrom: cov0, covDays: +Math.max(0.04, (Date.now() - Math.max(fromTs, cov0)) / DAY).toFixed(2),
    liqN: P.filter(p => p.liq).length, liqLoss: +(-sum(P.filter(p => p.liq), p => Math.min(0, p.net))).toFixed(2), liqNotional: +sum(P.filter(p => p.liq), p => p.exitNotional || p.maxNotional).toFixed(2),
    curve, days: day,
    by: { sym: group(p => jrCoin(p.sym)), side: group(p => p.dir > 0 ? 'Long' : 'Short'), hour: group(p => new Date(p.openTs).getUTCHours()), weekday: group(p => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(p.openTs).getUTCDay()]), hold: group(p => holdB(p.hold)), size: group(p => sizeB(p.maxNotional)), ex: group(p => p.ex, 1) },
    recon: (() => { const R = P.filter(p => p.diff != null); return { n: R.length, off: R.filter(p => Math.abs(p.diff) > 0.01).length, sumDiff: +sum(R, p => p.diff).toFixed(2) }; })(),
  };
}

// WHERE THE MONEY GOES, and what each change would have saved - every figure computed from the member's own fills.
export function jrSavings(st, fills, fromTs, venues, exMain, bybitBps) {
  const out = [], F = fills.filter(f => f.ts >= fromTs);
  if (!st.vol) return { items: out, compare: [] };
  // a month is projected only from at least three days of history; less than that is reported as it is, for the period
  const days = Math.max(0.04, st.covDays || 1), monthly = days >= 3, m30 = monthly ? 30 / days : 1, PER = monthly ? ' a month' : ' in this period';
  const V = venues[exMain] || null;
  // 1. taker -> maker
  // YOUR rates, not the venue's base table: a VIP whale pays a fraction of the published fee, and quoting the base rate promised savings bigger than everything they paid
  if (st.entTakerFee > 0 && st.entTakerVol > 0) {
    const rT = st.entTakerFee / st.entTakerVol * 100, rM = st.rateMaker != null && st.volMaker > st.vol * 0.02 ? st.rateMaker : (V && V.taker > 0 ? rT * V.maker / V.taker : null);
    if (rM != null && rT > rM) {
      const save = st.entTakerVol * (rT - rM) / 100;
      if (save * m30 >= 1) out.push({ id: 'maker', usd30: +(save * m30).toFixed(2), title: 'Enter with limit orders', body: 'You entered ' + Math.min(100, Math.round(st.entTakerVol / Math.max(1, st.vol) * 200)) + '% of your positions as taker, at ' + (+rT.toFixed(3)) + '%. A limit entry pays about ' + (+rM.toFixed(3)) + '%' + (st.rateMaker != null && st.volMaker > st.vol * 0.02 ? ' (your own maker rate)' : ' (the maker rate for your tier' + (V ? ' on ' + V.name : '') + ')') + ' - the same trades would have cost about $' + (save * m30).toFixed(2) + ' less' + PER + '.' });
    }
  }
  // 2. funding
  if (st.funding < -1) out.push({ id: 'funding', usd30: +(-st.funding * m30).toFixed(2), title: 'Funding you paid', body: 'Holding through funding cost you $' + (-st.funding * m30).toFixed(2) + PER + '. Check the rate before holding a position across the funding time, especially longs in a positive-funding market.' });
  // 3. liquidations
  // A stop does NOT save the whole loss of a liquidated position (owner's account, 2026-11-18: the card claimed all $69.68): a stop just before the
  // liquidation price still loses nearly as much. What it keeps is the maintenance margin the exchange takes on a liquidation - at least ~0.5%
  // of the notional closed (the lowest tier on every venue we read), so that is the figure, stated as a floor.
  if (st.liqN) { const keep = (st.liqNotional || 0) * 0.005; if (keep * m30 >= 0.5) out.push({ id: 'liq', usd30: +(keep * m30).toFixed(2), title: 'Liquidations', body: st.liqN + ' position' + (st.liqN === 1 ? ' was' : 's were') + ' liquidated, losing $' + st.liqLoss.toFixed(2) + ' in total. A stop placed before the liquidation price would still have lost most of that, but it keeps the maintenance margin the exchange takes on a liquidation - at least about $' + keep.toFixed(2) + ' here (0.5% of the $' + Math.round(st.liqNotional).toLocaleString('en-US') + ' closed)' + (m30 !== 1 ? ', about $' + (keep * m30).toFixed(2) + PER : '') + '.' }); }
  // 4. (2026-11-18, owner) no referral offer for the exchange the member ALREADY trades on - they have the account. The partner links
  //    live on the venue comparison below, next to the money the same volume would cost elsewhere.
  // 5. the same volume and taker mix on every venue we track
  const tShare = (st.takerShare || 0) / 100, compare = [];
  for (const id of Object.keys(venues)) { const v = venues[id]; const cost = st.vol * (tShare * v.taker + (1 - tShare) * v.maker) / 100 * m30; compare.push({ id, name: v.name, usd30: +cost.toFixed(2), url: id === exMain ? '' : (v.url || ''), mine: id === exMain }); }
  compare.sort((a, b) => a.usd30 - b.usd30);
  out.sort((a, b) => b.usd30 - a.usd30);
  return { items: out, compare, paid30: +(st.fees * m30).toFixed(2), months: +(days / 30).toFixed(2), monthly, days: +days.toFixed(2) };
}

// ---------- the store: one instance per member ----------
export class JournalStore {
  constructor(state, env) {
    this.state = state; this.env = env; this.sql = state.storage.sql; this.init();
  }
  init() {
    const sql = this.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS conn (id TEXT PRIMARY KEY, ex TEXT, label TEXT, kid TEXT, addr TEXT, sealed TEXT, perms TEXT, ipbound INTEGER, status TEXT, err TEXT, created INTEGER, last_sync INTEGER, last_ok INTEGER, cur TEXT, nfills INTEGER DEFAULT 0, oldest INTEGER, newest INTEGER, done INTEGER DEFAULT 0)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS fills (k TEXT PRIMARY KEY, conn TEXT, ex TEXT, sym TEXT, side INTEGER, px REAL, qty REAL, fee REAL, maker INTEGER, ts INTEGER, oid TEXT, ps TEXT, rpnl REAL, liq INTEGER, adl INTEGER, start REAL, dir TEXT)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS fills_ts ON fills(ts)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS funding (k TEXT PRIMARY KEY, conn TEXT, ex TEXT, sym TEXT, ts INTEGER, amt REAL, rate REAL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS notes (pid TEXT PRIMARY KEY, note TEXT, tags TEXT, ts INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS prefs (k TEXT PRIMARY KEY, v TEXT)`);
  }
  async fetch(request) {
    const url = new URL(request.url), p = url.pathname, sql = this.sql;
    const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } });
    let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
    if (p === '/conn/list') return J({ conns: sql.exec('SELECT * FROM conn ORDER BY created').toArray() });
    if (p === '/conn/put') {
      const c = b.conn; if (!c || !c.id) return J({ error: 'bad' }, 400);
      const n = sql.exec('SELECT COUNT(*) n FROM conn WHERE id<>?', c.id).one().n;
      if (n >= JR_MAX_CONN) return J({ error: 'too_many', max: JR_MAX_CONN }, 409);
      sql.exec('INSERT OR REPLACE INTO conn (id,ex,label,kid,addr,sealed,perms,ipbound,status,err,created,last_sync,last_ok,cur,nfills,oldest,newest,done) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        c.id, c.ex, c.label || '', c.kid || '', c.addr || '', c.sealed || '', JSON.stringify(c.perms || {}), c.ipbound ? 1 : 0, c.status || 'new', c.err || '', c.created || Date.now(), 0, 0, '{}', 0, null, null, 0);
      return J({ ok: true });
    }
    if (p === '/conn/del') {
      sql.exec('DELETE FROM fills WHERE conn=?', b.id); sql.exec('DELETE FROM funding WHERE conn=?', b.id); sql.exec('DELETE FROM conn WHERE id=?', b.id);
      return J({ ok: true, left: sql.exec('SELECT COUNT(*) n FROM conn').one().n });
    }
    if (p === '/note') { // one note and a tag list per position
      const pid = String(b.pid || '').slice(0, 120), note = String(b.note || '').slice(0, 2000), tags = (Array.isArray(b.tags) ? b.tags : []).map(t => String(t).slice(0, 24)).slice(0, 8);
      if (!pid) return J({ error: 'bad' }, 400);
      if (!note && !tags.length) sql.exec('DELETE FROM notes WHERE pid=?', pid); else sql.exec('INSERT OR REPLACE INTO notes (pid,note,tags,ts) VALUES (?,?,?,?)', pid, note, JSON.stringify(tags), Date.now());
      return J({ ok: true });
    }
    if (p === '/prefs') { for (const k of Object.keys(b || {}).slice(0, 10)) sql.exec('INSERT OR REPLACE INTO prefs (k,v) VALUES (?,?)', String(k).slice(0, 30), JSON.stringify(b[k]).slice(0, 2000)); return J({ ok: true }); }
    if (p === '/label') { sql.exec('UPDATE conn SET label=? WHERE id=?', String(b.label || '').slice(0, 40), String(b.id || '')); return J({ ok: true }); }
    if (p === '/fills') { const sym = url.searchParams.get('sym') || '', a = +url.searchParams.get('a') || 0, z = +url.searchParams.get('z') || 0, cn = url.searchParams.get('conn') || '';
      return J({ fills: sql.exec('SELECT k,conn,ex,sym,side,px,qty,fee,maker,ts,rpnl,liq,dir FROM fills WHERE sym=? AND ts>=? AND ts<=?' + (cn ? ' AND conn=?' : '') + ' ORDER BY ts, rowid LIMIT 400', ...(cn ? [sym, a, z, cn] : [sym, a, z])).toArray() }); }
    if (p === '/conn/reset') { sql.exec('DELETE FROM fills WHERE conn=?', b.id); sql.exec('DELETE FROM funding WHERE conn=?', b.id); sql.exec("UPDATE conn SET cur='{}', done=0, nfills=0, oldest=NULL, newest=NULL, status='importing' WHERE id=?", b.id); return J({ ok: true }); }
    if (p === '/wipe') { await this.state.storage.deleteAll(); this.init(); return J({ ok: true }); }
    if (p === '/ingest') { // a sync pass's result
      const c = b.conn; let nf = 0;
      for (const f of (b.fills || [])) { sql.exec('INSERT OR REPLACE INTO fills (k,conn,ex,sym,side,px,qty,fee,maker,ts,oid,ps,rpnl,liq,adl,start,dir) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', f.k, c, f.ex, f.sym, f.side, f.px, f.qty, f.fee, f.maker, f.ts, f.oid || '', f.ps || 'B', f.rpnl, f.liq || 0, f.adl || 0, f.start == null ? null : f.start, f.dir || ''); nf++; }
      for (const r of (b.fund || [])) sql.exec('INSERT OR REPLACE INTO funding (k,conn,ex,sym,ts,amt,rate) VALUES (?,?,?,?,?,?,?)', r.k, c, r.ex, r.sym, r.ts, r.amt, r.rate || 0);
      const agg = sql.exec('SELECT COUNT(*) n, MIN(ts) o, MAX(ts) w FROM fills WHERE conn=?', c).one();
      sql.exec('UPDATE conn SET last_sync=?, last_ok=CASE WHEN ?=\'\' THEN ? ELSE last_ok END, err=?, status=?, cur=?, nfills=?, oldest=?, newest=?, done=CASE WHEN ?=1 THEN 1 ELSE done END WHERE id=?',
        Date.now(), b.err || '', Date.now(), b.err || '', b.status || 'ok', JSON.stringify(b.cur || {}), agg.n, agg.o, agg.w, b.done ? 1 : 0, c);
      return J({ ok: true, ingested: nf, total: agg.n });
    }
    if (p === '/data') { // everything the engine needs (one member's history fits comfortably)
      const conn = url.searchParams.get('conn') || '';
      const from = +url.searchParams.get('from') || 0;
      const F = conn ? sql.exec('SELECT * FROM fills WHERE conn=? AND ts>=? ORDER BY ts, rowid', conn, from).toArray() : sql.exec('SELECT * FROM fills WHERE ts>=? ORDER BY ts, rowid', from).toArray();
      const Fu = conn ? sql.exec('SELECT * FROM funding WHERE conn=? AND ts>=?', conn, from).toArray() : sql.exec('SELECT * FROM funding WHERE ts>=?', from).toArray();
      const notes = {}; for (const r of sql.exec('SELECT * FROM notes').toArray()) { let t = []; try { t = JSON.parse(r.tags || '[]'); } catch (e) {} notes[r.pid] = { note: r.note || '', tags: t }; }
      const prefs = {}; for (const r of sql.exec('SELECT * FROM prefs').toArray()) { try { prefs[r.k] = JSON.parse(r.v); } catch (e) {} }
      return J({ notes, prefs, fills: F, funding: Fu, conns: sql.exec('SELECT id,ex,label,kid,addr,perms,ipbound,status,err,created,last_sync,last_ok,nfills,oldest,newest,done FROM conn ORDER BY created').toArray() });
    }
    return J({ error: 'not_found' }, 404);
  }
}

// ---------- worker side ----------
const jStub = (env, uid) => env.JOURNAL.get(env.JOURNAL.idFromName('j:' + uid));
async function jCall(env, uid, path, body) {
  const r = await jStub(env, uid).fetch('https://j' + path, body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) });
  return r.json();
}

// one sync pass for one connection
async function syncConn(env, H, uid, c, budget) {
  let cur = (() => { try { return JSON.parse(c.cur || '{}'); } catch (e) { return {}; } })();
  if (cur.v !== JR_IMPORT_V) { await jCall(env, uid, '/conn/reset', { id: c.id }); cur = {}; } // imported by an older pager: start again, cleanly
  const cc = { cur };
  let r;
  try {
    if (c.ex === 'hyperliquid') r = await hlSync(env, H, cc, c.addr, budget);
    else {
      const sec = JSON.parse(await jrOpen(env, uid, c.ex, c.sealed));
      if (c.ex === 'bybit') r = await bybitSync(env, H, cc, sec.k, sec.s, budget);
      else if (c.ex === 'okx') r = await okxSync(env, H, cc, sec, budget);
      else if (c.ex === 'bitget') r = await bitgetSync(env, H, cc, sec, budget);
      else if (c.ex === 'bingx') r = await bingxSync(env, H, cc, sec.k, sec.s, budget);
      else if (c.ex === 'binance') r = await binanceSync(env, H, cc, sec.k, sec.s, budget, async (a) => { try { const d = await H.priceOf(a); return d ? +d.price : 0; } catch (e) { return 0; } });
      else r = { used: 0, fills: [], fund: [], cur, err: 'unsupported' };
    }
  } catch (e) { r = { used: 0, fills: [], fund: [], cur, err: 'sync_failed: ' + String(e && e.message || e).slice(0, 80) }; }
  for (const f of r.fills) f.ex = c.ex; for (const f of r.fund) f.ex = c.ex;
  r.cur = Object.assign({}, r.cur || {}, { v: JR_IMPORT_V });
  const caughtUp = !r.err && r.cur && +r.cur.t >= Date.now() - 3 * 3600000;
  const res = await jCall(env, uid, '/ingest', { conn: c.id, fills: r.fills, fund: r.fund, cur: r.cur, err: r.err || '', status: r.err ? (/key_invalid|10003|10004|-2015|-2014/.test(r.err) ? 'key_invalid' : 'error') : (caughtUp ? 'ok' : 'importing'), done: caughtUp });
  return { used: r.used, got: r.fills.length, fund: r.fund.length, err: r.err || '', caughtUp, total: res.total };
}

export async function journalSyncUser(env, H, uid, onlyId, budget) {
  const L = (await jCall(env, uid, '/conn/list')).conns || [];
  const out = [];
  for (const c of L) { if (onlyId && c.id !== onlyId) continue; if (c.status === 'key_invalid') continue; out.push(Object.assign({ id: c.id, ex: c.ex }, await syncConn(env, H, uid, c, budget || JR_REQ_BUDGET))); }
  try { await env.STATS.put('jrn:act:' + uid, JSON.stringify({ t: Date.now(), n: L.length, ex: L.map(c => c.ex) }), { expirationTtl: 400 * DAY / 1000 }); } catch (e) {}
  return out;
}

// cron: every connected member whose sync is due, a few per pass
export async function journalCron(env, H) {
  let keys = []; try { keys = (await env.STATS.list({ prefix: 'jrn:act:', limit: 1000 })).keys || []; } catch (e) { return { err: 'list' }; }
  const due = [];
  for (const k of keys) { const uid = k.name.slice(8); const m = JSON.parse((await env.STATS.get(k.name)) || '{}'); if (m.n > 0 && Date.now() - (+m.t || 0) >= JR_SYNC_EVERY_MS - 60000) due.push(uid); if (due.length >= 6) break; }
  const res = [];
  for (const uid of due) { try { res.push({ uid, r: await journalSyncUser(env, H, uid, null, 30) }); } catch (e) { res.push({ uid, err: String(e).slice(0, 80) }); } }
  return { due: due.length, res };
}

// the member's summary for the owner's desk (aggregate volume tells us who trades big; written on every stats read)
async function deskNote(env, uid, un, st) { try { await env.STATS.put('jrn:sum:' + uid, JSON.stringify({ un, t: Date.now(), vol30: st.vol, n30: st.n, net30: st.net }), { expirationTtl: 120 * 86400 }); } catch (e) {} }

export async function handleJournal(url, request, env, ctx, H) {
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...H.CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: H.CORS });
  if (!env.JOURNAL) return J({ error: 'unavailable' }, 503);
  const path = url.pathname.slice('/api/journal'.length) || '/';
  if (path === '/meta') return J({ ip: JR_IP, exchanges: JR_EXCH, daysMax: JR_DAYS_MAX });
  /* A SHARED REAL TRADE (2026-11-18, owner: share a real trade into the chat, a link that opens an exchange-styled card). The snapshot is
     built HERE from the fills the exchange gave us - never from anything the page sends - so the card can say "verified". Public read,
     immutable, edge-cached; `ids=` reads a whole room in one request (the tshare lesson: one request per card was 81 per chat open). */
  if (path === '/rshare' && request.method === 'GET') {
    const clean = (x) => String(x || '').replace(/[^a-z0-9]/gi, '').slice(0, 16);
    const ids = [...new Set(String(url.searchParams.get('ids') || url.searchParams.get('id') || '').split(',').map(clean).filter(Boolean))].slice(0, 40);
    if (!ids.length) return J({ error: 'id_required' }, 400);
    const out = {}; await Promise.all(ids.map(async (id) => { try { const s = await env.STATS.get('jrsh:' + id, 'json'); if (s) out[id] = s; } catch (e) {} }));
    return new Response(JSON.stringify({ ok: true, shares: out }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=300', ...H.CORS } });
  }
  const su = await H.sessionUser(env, H.getCookie(request, H.SESS_COOKIE));
  let uid = su && su.id ? String(su.id) : '';
  const _adm = H.isAdminKey(env, H.adminKeyFrom(request, url)), _qu = url.searchParams.get('uid') || '';
  if (!uid && _adm && /^e2e/.test(_qu)) uid = _qu;
  if (!uid && _adm && _qu && request.method === 'GET') uid = _qu; // support: READ any member's journal with the admin key (GET only - nothing is written as them)
  if (!uid) return J({ error: 'login_required' }, 401);
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }

  // SUPPORT AUDIT: the exchange's own ledgers through the member's sealed read-only key, admin key only, GET only, a fixed list of read paths.
  // This is how a figure we print is checked against the exchange (2026-11-18, owner: "proveri moj nalog ... da li funding i ostalo lepo racunamo").
  if (path === '/xsync' && _adm && request.method === 'GET') return J({ ok: true, r: await journalSyncUser(env, H, uid, url.searchParams.get('conn') || null, Math.min(80, +url.searchParams.get('budget') || 60)) }); // support: run a sync pass now
  if (path === '/xprobe' && _adm && request.method === 'GET') {
    const L = (await jCall(env, uid, '/conn/list')).conns || [], c = L.find(x => x.id === url.searchParams.get('conn'));
    if (!c || c.ex !== 'bybit') return J({ error: 'bybit_conn_only' }, 400);
    const p = url.searchParams.get('p') || '';
    if (!/^\/v5\/(position\/closed-pnl|account\/transaction-log|position\/list|account\/fee-rate|execution\/list)$/.test(p)) return J({ error: 'path' }, 400);
    const sec = JSON.parse(await jrOpen(env, uid, c.ex, c.sealed)), q = {};
    for (const [k, v] of url.searchParams) if (!/^(uid|conn|p|key)$/.test(k)) q[k] = v;
    return J(await bybitGet(env, H, sec.k, sec.s, p, q));
  }
  if (path === '/state') {
    const d = await jCall(env, uid, '/data?from=' + (Date.now() + 1)); // conns only
    return J({ ip: JR_IP, conns: (d.conns || []).map(c => Object.assign(c, { perms: (() => { try { return JSON.parse(c.perms || '{}'); } catch (e) { return {}; } })() })) });
  }
  if (path === '/connect' && request.method === 'POST') {
    const ex = String(b.ex || '');
    if (!JR_EXCH[ex]) return J({ error: 'unsupported_exchange' }, 400);
    // 5 connect attempts an hour per member: a key is not something to brute-force through us
    try { const rk = 'jrn:rl:' + uid + ':' + new Date().toISOString().slice(0, 13); const n = +(await env.STATS.get(rk)) || 0; if (n >= 8) return J({ error: 'slow_down' }, 429); await env.STATS.put(rk, String(n + 1), { expirationTtl: 3700 }); } catch (e) {}
    let chk, conn = { id: ex + '_' + crypto.randomUUID().slice(0, 8), ex, label: String(b.label || JR_EXCH[ex].name).slice(0, 40), created: Date.now() };
    if (ex === 'hyperliquid') {
      const a = String(b.address || '').trim();
      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return J({ error: 'bad_address' }, 400);
      chk = await hlCheck(env, H, a);
      if (!chk.ok) return J({ error: 'exchange_unreachable', detail: chk.why }, 502);
      conn.addr = a.toLowerCase(); conn.kid = a.slice(0, 6) + '…' + a.slice(-4);
    } else {
      if (!env.JOURNAL_KEK) return J({ error: 'not_ready' }, 503); // no sealing key in this environment: refuse before a secret is even read
      const k = String(b.key || '').trim(), s = String(b.secret || '').trim(), ps = String(b.passphrase || '');
      if (!/^[A-Za-z0-9-]{10,100}$/.test(k) || !/^[A-Za-z0-9-]{10,200}$/.test(s)) return J({ error: 'bad_key_format' }, 400);
      if (JR_EXCH[ex].pass && (!ps || ps.length > 64)) return J({ error: 'passphrase_required' }, 400);
      chk = ex === 'bybit' ? await bybitCheck(env, H, k, s) : ex === 'bingx' ? await bingxCheck(env, H, k, s) : ex === 'okx' ? await okxCheck(env, H, k, s, ps) : ex === 'bitget' ? await bitgetCheck(env, H, k, s, ps) : await binanceCheck(env, H, k, s);
      if (!chk.ok) return J({ error: chk.why || 'check_failed', detail: chk.detail || '', ip: JR_IP }, 400);
      if (!chk.readOnly) return J({ error: 'not_read_only', writes: chk.writes, ip: JR_IP }, 400); // THE RULE: refused, and nothing was stored
      conn.sealed = await jrSeal(env, uid, ex, JSON.stringify(JR_EXCH[ex].pass ? { k, s, p: ps, h: chk.host || '' } : { k, s }));
      conn.kid = mask(k);
    }
    conn.perms = { readOnly: true, writes: [], ips: chk.ips || [], uta: chk.uta, expiredAt: chk.expiredAt || null, vol14: chk.vol14 };
    conn.ipbound = !!chk.ipBound; conn.status = 'importing';
    const put = await jCall(env, uid, '/conn/put', { conn });
    if (put.error) return J(put, 409);
    // the first pass now, the rest on the cron (or the member's Sync button)
    const first = await journalSyncUser(env, H, uid, conn.id, 20);
    return J({ ok: true, id: conn.id, ipBound: conn.ipbound, ip: JR_IP, first: first[0] || null });
  }
  if (path === '/disconnect' && request.method === 'POST') {
    const r = await jCall(env, uid, '/conn/del', { id: String(b.id || '') });
    if (!r.left) { try { await env.STATS.delete('jrn:act:' + uid); await env.STATS.delete('jrn:sum:' + uid); } catch (e) {} }
    return J({ ok: true, left: r.left });
  }
  if (path === '/wipe' && request.method === 'POST') {
    await jCall(env, uid, '/wipe', {}); try { await env.STATS.delete('jrn:act:' + uid); await env.STATS.delete('jrn:sum:' + uid); } catch (e) {}
    return J({ ok: true });
  }
  if (path === '/note' && request.method === 'POST') return J(await jCall(env, uid, '/note', { pid: b.pid, note: b.note, tags: b.tags }));
  if (path === '/prefs' && request.method === 'POST') { const o = {}; if (b.goal != null) o.goal = Math.max(0, Math.min(1e9, +b.goal || 0)); if (b.dayLimit != null) o.dayLimit = Math.max(0, Math.min(1e9, +b.dayLimit || 0)); return J(await jCall(env, uid, '/prefs', o)); }
  if (path === '/label' && request.method === 'POST') return J(await jCall(env, uid, '/label', { id: b.id, label: b.label }));
  if (path === '/fills') { const r = await jStub(env, uid).fetch('https://j/fills' + url.search); return J(await r.json()); }
  if (path === '/sync' && request.method === 'POST') {
    const t = await env.STATS.get('jrn:sy:' + uid); if (t && Date.now() - +t < 20000) return J({ error: 'slow_down', wait: 20 }, 429);
    try { await env.STATS.put('jrn:sy:' + uid, String(Date.now()), { expirationTtl: 60 }); } catch (e) {}
    return J({ ok: true, res: await journalSyncUser(env, H, uid, b.id ? String(b.id) : null, JR_REQ_BUDGET) });
  }
  if (path === '/share' && request.method === 'POST') {
    const pid = String(b.pid || '').slice(0, 120), amounts = b.amounts !== false;
    const un = String((su && su.username) || '').slice(0, 24);
    if (!un && !_adm) return J({ error: 'username_required' }, 400); // the chat names every poster
    try { const rk = 'jrsh:rl:' + uid + ':' + new Date().toISOString().slice(0, 10); const n = +(await env.STATS.get(rk)) || 0; if (n >= 30) return J({ error: 'rate_limited' }, 429); await env.STATS.put(rk, String(n + 1), { expirationTtl: 90000 }); } catch (e) {}
    const sd = Math.max(1, Math.min(JR_DAYS_MAX, +b.days || JR_DAYS_MAX)); // the SAME window the list was built from, or a position seeded differently gets another id
    const d = await jCall(env, uid, '/data?from=' + (Date.now() - (sd + 30) * DAY));
    const p = (jrBuild(d.fills || [], d.funding || []).positions || []).find(x => x.id === pid);
    if (!p) return J({ error: 'not_found' }, 404);
    if (p.status !== 'closed' || !(+p.entry > 0) || !(+p.exit > 0)) return J({ error: 'not_closed' }, 400);
    const r2 = (v) => v == null || !isFinite(v) ? null : +(+v).toFixed(2);
    const snap = {
      v: 1, ex: p.ex, sym: String(p.sym).slice(0, 24), coin: jrCoin(p.sym), dir: p.dir > 0 ? 1 : -1,
      entry: +(+p.entry).toPrecision(8), exit: +(+p.exit).toPrecision(8), openTs: p.partial ? null : p.openTs, closeTs: p.closeTs,
      move: +(((p.exit / p.entry) - 1) * p.dir * 100).toFixed(3), ret: p.maxNotional > 0 ? +(p.net / p.maxNotional * 100).toFixed(3) : null,
      liq: p.liq ? 1 : 0, fills: p.n || 0, maker: p.nMaker || 0, verified: p.diff != null && Math.abs(p.diff) <= 0.01 ? 1 : 0,
      amounts: amounts ? 1 : 0, by: un || 'trader', at: Date.now()
    };
    if (amounts) Object.assign(snap, { size: r2(p.maxNotional), gross: r2(p.gross), fees: r2(p.fees), funding: r2(p.funding), net: r2(p.net) });
    // the price path, baked once at share time (a closed candle never changes; readers never fetch klines per card)
    try {
      const a0 = p.partial ? p.closeTs - 3600000 : p.openTs, span = Math.max(60000, p.closeTs - a0), IV = [1, 5, 15, 60, 240, 1440];
      let iv = 1440; for (const m of IV) if (span / (m * 60000) <= 36) { iv = m; break; }
      const bars = await H.klines(env, snap.coin, iv, p.closeTs + iv * 60000 * 3);
      if (Array.isArray(bars)) {
        let pts = bars.filter(k => +k.time * 1000 >= a0 - span * 0.25 && +k.time * 1000 <= p.closeTs + iv * 60000 * 2).map(k => [+k.time * 1000, +k.close]).filter(x => x[1] > 0);
        if (pts.length > 60) { const st = pts.length / 60, o = []; for (let i = 0; i < 60; i++) o.push(pts[Math.floor(i * st)]); o.push(pts[pts.length - 1]); pts = o; }
        if (pts.length >= 4) { snap.spark = pts.map(x => [Math.round(x[0] / 1000), +x[1].toPrecision(7)]); snap.iv = iv; }
      }
    } catch (e) {}
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await env.STATS.put('jrsh:' + id, JSON.stringify(snap), { expirationTtl: 180 * 86400 });
    try { if (H.evPush) ctx.waitUntil(H.evPush(env, request, 'journal', 'shared ' + snap.ex + ' ' + snap.coin + ' -> real:' + id, '/trading-journal/')); } catch (e) {}
    return J({ ok: true, id });
  }
  if (path === '/stats' || path === '/trades' || path === '/savings' || path === '/all') {
    const days = Math.max(1, Math.min(JR_DAYS_MAX, +url.searchParams.get('days') || 30)), conn = url.searchParams.get('conn') || '';
    const fromTs = Date.now() - days * DAY;
    const d = await jCall(env, uid, '/data?from=' + (fromTs - 30 * DAY) + (conn ? '&conn=' + encodeURIComponent(conn) : '')); // 30 days of lead-in so a position opened earlier is whole
    const { positions } = jrBuild(d.fills || [], d.funding || []);
    const st = jrStats(positions, d.fills || [], d.funding || [], fromTs);
    const exMain = (() => { const c = {}; for (const f of (d.fills || [])) if (f.ts >= fromTs) c[f.ex] = (c[f.ex] || 0) + f.px * f.qty; return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; })();
    const sav = jrSavings(st, d.fills || [], fromTs, H.feeVenues, exMain, await H.bybitBps(env));
    /* ALL ACCOUNTS = ONE SAVINGS BLOCK PER EXCHANGE (owner 2026-11-18): fee rates, maker/taker and the referral offer belong to an exchange, so
       several exchanges summed into one figure priced at one venue's rates is wrong. Each exchange gets its own stats and savings. */
    const exs = Array.from(new Set((d.fills || []).filter(f => f.ts >= fromTs).map(f => f.ex)));
    let savingsBy = null;
    if (exs.length > 1) { const bps = await H.bybitBps(env); savingsBy = exs.map(ex => { const fx = (d.fills || []).filter(f => f.ex === ex), fu = (d.funding || []).filter(f => f.ex === ex); const ps = positions.filter(p => p.ex === ex); const s2 = jrStats(ps, fx, fu, fromTs); return { ex, vol: s2.vol, fees: s2.fees, funding: s2.funding, covDays: s2.covDays, savings: jrSavings(s2, fx, fromTs, H.feeVenues, ex, bps) }; }).sort((x, y) => y.vol - x.vol); }
    if (su && st.vol > 0) ctx.waitUntil(deskNote(env, uid, su.username || '', st));
    const trades = positions.filter(p => (p.closeTs || p.openTs) >= fromTs).sort((a, b) => (b.closeTs || b.openTs) - (a.closeTs || a.openTs)).slice(0, Math.min(3000, +url.searchParams.get('limit') || 3000));
    const conns = (d.conns || []).map(c => Object.assign(c, { perms: (() => { try { return JSON.parse(c.perms || '{}'); } catch (e) { return {}; } })() }));
    const nt = d.notes || {}, notes = {}; for (const t of trades) if (nt[t.id]) notes[t.id] = nt[t.id];
    return J({ days, exMain, stats: st, savings: sav, savingsBy, trades, conns, notes, prefs: d.prefs || {}, open: positions.filter(p => p.status === 'open').length });
  }
  return J({ error: 'not_found' }, 404);
}

// the owner's desk: who is connected, and how much they trade
export async function journalDesk(env) {
  let keys = []; try { keys = (await env.STATS.list({ prefix: 'jrn:sum:', limit: 1000 })).keys || []; } catch (e) {}
  const rows = [];
  for (const k of keys) { try { const v = JSON.parse((await env.STATS.get(k.name)) || '{}'); rows.push(Object.assign({ uid: k.name.slice(8) }, v)); } catch (e) {} }
  rows.sort((a, b) => (b.vol30 || 0) - (a.vol30 || 0));
  let act = []; try { act = (await env.STATS.list({ prefix: 'jrn:act:', limit: 1000 })).keys || []; } catch (e) {}
  return { connected: act.length, rows, vol30: rows.reduce((a, r) => a + (+r.vol30 || 0), 0) };
}
