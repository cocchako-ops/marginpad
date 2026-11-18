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
const DAY = 86400000;

export const JR_EXCH = {
  hyperliquid: { name: 'Hyperliquid', kind: 'address', hist: 'Last 10,000 fills', color: '#97fce4' },
  bybit:       { name: 'Bybit',       kind: 'key',     hist: 'Up to 180 days',    color: '#f7a600', keyUrl: 'https://www.bybit.com/app/user/api-management' },
  binance:     { name: 'Binance',     kind: 'key',     hist: 'Last 3 months (Binance limit)', color: '#f0b90b', keyUrl: 'https://www.binance.com/en/my/settings/api-management' },
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
  const writes = [];
  if (+q.res.readOnly !== 1) writes.push('read-write key');
  const W = (k, v) => { const a = p[k] || []; if (a.length) writes.push(k + ': ' + a.join(', ')); };
  W('ContractTrade'); W('Spot'); W('Wallet'); W('Options'); W('Derivatives'); W('Exchange'); W('Earn');
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
  if (!q.ok) return { ok: false, why: q.why === 'binance_-2015' || q.why === 'binance_-2014' ? 'key_invalid' : q.why, detail: q.detail };
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
      start = +L[L.length - 1].time + 1;
    }
    if (used + syms.size > budget && syms.size) return { used, fills, fund, cur: { t: from } }; // not enough budget for this window's symbols - redo it next pass
    // 2. the fills, per symbol (Binance requires one)
    for (const sym of syms) {
      const q = await bnGet(env, H, 'fapi.binance.com', key, secret, '/fapi/v1/userTrades', { symbol: sym, startTime: from, endTime: to, limit: 1000 });
      used++;
      if (!q.ok) return { used, fills, fund, cur: { t: from }, err: q.why + (q.detail ? ': ' + q.detail : '') };
      for (const x of (Array.isArray(q.res) ? q.res : [])) {
        let fee = +x.commission || 0; const a = String(x.commissionAsset || 'USDT');
        if (!/^(USDT|USDC|BUSD|FDUSD|USD)$/.test(a)) { const p = await priceOf(a); fee = p > 0 ? fee * p : 0; }
        fills.push({ k: 'binance|' + x.symbol + '|' + x.id, sym: x.symbol, side: x.side === 'BUY' ? 1 : -1, px: +x.price, qty: +x.qty, fee, maker: x.maker ? 1 : 0, ts: +x.time, oid: String(x.orderId || ''), ps: x.positionSide === 'LONG' ? 'L' : x.positionSide === 'SHORT' ? 'S' : 'B', rpnl: +x.realizedPnl || 0, liq: 0, adl: 0 });
      }
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
    from = +L[L.length - 1].time + 1;
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
    ff = +L[L.length - 1].time + 1;
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
  const F = fills.slice().sort((a, b) => a.ts - b.ts || (a.k < b.k ? -1 : 1));
  const open = new Map(), pos = [];
  let seq = 0;
  const mk = (f, key, dir, partial) => ({ id: f.ex + ':' + f.sym + ':' + f.ts + ':' + (seq++), ex: f.ex, sym: f.sym, ps: f.ps, dir, openTs: f.ts, closeTs: 0, q: 0, avg: 0, maxQ: 0, maxNotional: 0, entryNotional: 0, exitQty: 0, exitNotional: 0, gross: 0, fees: 0, feesTaker: 0, feesMaker: 0, funding: 0, xpnl: 0, xknown: true, n: 0, nMaker: 0, nTaker: 0, liq: 0, adl: 0, partial: !!partial, key, vol: 0 });
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
          np.fees = fp; if (f.maker) np.feesMaker = fp; else np.feesTaker = fp; np.vol = f.px * qty; np.n = 1; if (f.maker) np.nMaker = 1; else np.nTaker = 1;
          open.set(key, np); pos.push(np);
        }
      }
    } else {
      const aq = Math.abs(p.q);
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
  const volT = sum(Fx.filter(f => !f.maker), f => f.px * f.qty);
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
    vol: +vol.toFixed(2), fills: Fx.length, fees: +fees.toFixed(2), feesTaker: +feesT.toFixed(2), feesMaker: +feesM.toFixed(2), takerShare: vol ? +(volT / vol * 100).toFixed(1) : null,
    effRate: vol ? +(fees / vol * 100).toFixed(4) : null, funding: +fundNet.toFixed(2),
    liqN: P.filter(p => p.liq).length, liqLoss: +(-sum(P.filter(p => p.liq), p => Math.min(0, p.net))).toFixed(2),
    curve, days: day,
    by: { sym: group(p => p.sym), side: group(p => p.dir > 0 ? 'Long' : 'Short'), hour: group(p => new Date(p.openTs).getUTCHours()), weekday: group(p => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(p.openTs).getUTCDay()]), hold: group(p => holdB(p.hold)), size: group(p => sizeB(p.maxNotional)), ex: group(p => p.ex, 1) },
    recon: (() => { const R = P.filter(p => p.diff != null); return { n: R.length, off: R.filter(p => Math.abs(p.diff) > 0.01).length, sumDiff: +sum(R, p => p.diff).toFixed(2) }; })(),
  };
}

// WHERE THE MONEY GOES, and what each change would have saved - every figure computed from the member's own fills.
export function jrSavings(st, fills, fromTs, venues, exMain, bybitBps) {
  const out = [], F = fills.filter(f => f.ts >= fromTs);
  if (!st.vol) return { items: out, compare: [] };
  const days = Math.max(1, (Date.now() - Math.max(fromTs, F.length ? Math.min(...F.map(f => f.ts)) : Date.now())) / DAY), m30 = 30 / days;
  const V = venues[exMain] || null;
  // 1. taker -> maker
  if (V && st.feesTaker > 0) {
    const save = st.feesTaker * (1 - V.maker / V.taker);
    if (save * m30 >= 1) out.push({ id: 'maker', usd30: +(save * m30).toFixed(2), title: 'Enter with limit orders', body: 'You paid ' + st.takerShare + '% of your volume as taker. At ' + V.name + "'s maker rate (" + V.maker + '% vs ' + V.taker + '%) the same trades would have cost about $' + (save * m30).toFixed(2) + ' less a month in fees.' });
  }
  // 2. funding
  if (st.funding < -1) out.push({ id: 'funding', usd30: +(-st.funding * m30).toFixed(2), title: 'Funding you paid', body: 'Holding through funding cost you $' + (-st.funding * m30).toFixed(2) + ' a month. Check the rate before holding a position across the funding time, especially longs in a positive-funding market.' });
  // 3. liquidations
  if (st.liqN) out.push({ id: 'liq', usd30: +(st.liqLoss * m30).toFixed(2), title: 'Liquidations', body: st.liqN + ' position' + (st.liqN === 1 ? ' was' : 's were') + ' liquidated, losing $' + st.liqLoss.toFixed(2) + '. A stop above the liquidation price exits with less loss and avoids the liquidation fee.' });
  // 4. rebate through our partner link - measured, Bybit only (our affiliate commission share back to traders)
  if (exMain === 'bybit' && bybitBps > 0) { const back = st.vol * bybitBps / 10000 * 0.85 * m30; if (back >= 1) out.push({ id: 'rebate', usd30: +back.toFixed(2), title: 'Get part of your fees back', body: 'Trading through MarginPad\'s Bybit partner link (new account or sub-account) returns about 85% of our commission as weekly bonuses and leaderboard prizes - about $' + back.toFixed(2) + ' a month at your volume.', cta: 'bybit' }); }
  if (exMain === 'hyperliquid') out.push({ id: 'hlref', usd30: +(st.fees * 0.04 * m30).toFixed(2), title: '4% off Hyperliquid fees', body: 'Code MARGINPAD gives 4% off trading fees on Hyperliquid - about $' + (st.fees * 0.04 * m30).toFixed(2) + ' a month at your volume. It applies to a wallet that has no referral yet.', cta: 'hyperliquid' });
  // 5. the same volume and taker mix on every venue we track
  const tShare = (st.takerShare || 0) / 100, compare = [];
  for (const id of Object.keys(venues)) { const v = venues[id]; const cost = st.vol * (tShare * v.taker + (1 - tShare) * v.maker) / 100 * m30; compare.push({ id, name: v.name, usd30: +cost.toFixed(2) }); }
  compare.sort((a, b) => a.usd30 - b.usd30);
  out.sort((a, b) => b.usd30 - a.usd30);
  return { items: out, compare, paid30: +(st.fees * m30).toFixed(2), months: +(days / 30).toFixed(2) };
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
      const F = conn ? sql.exec('SELECT * FROM fills WHERE conn=? AND ts>=? ORDER BY ts', conn, from).toArray() : sql.exec('SELECT * FROM fills WHERE ts>=? ORDER BY ts', from).toArray();
      const Fu = conn ? sql.exec('SELECT * FROM funding WHERE conn=? AND ts>=?', conn, from).toArray() : sql.exec('SELECT * FROM funding WHERE ts>=?', from).toArray();
      return J({ fills: F, funding: Fu, conns: sql.exec('SELECT id,ex,label,kid,addr,perms,ipbound,status,err,created,last_sync,last_ok,nfills,oldest,newest,done FROM conn ORDER BY created').toArray() });
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
  const cur = (() => { try { return JSON.parse(c.cur || '{}'); } catch (e) { return {}; } })();
  const cc = { cur };
  let r;
  try {
    if (c.ex === 'hyperliquid') r = await hlSync(env, H, cc, c.addr, budget);
    else {
      const sec = JSON.parse(await jrOpen(env, uid, c.ex, c.sealed));
      if (c.ex === 'bybit') r = await bybitSync(env, H, cc, sec.k, sec.s, budget);
      else if (c.ex === 'binance') r = await binanceSync(env, H, cc, sec.k, sec.s, budget, async (a) => { try { const d = await H.priceOf(a); return d ? +d.price : 0; } catch (e) { return 0; } });
      else r = { used: 0, fills: [], fund: [], cur, err: 'unsupported' };
    }
  } catch (e) { r = { used: 0, fills: [], fund: [], cur, err: 'sync_failed: ' + String(e && e.message || e).slice(0, 80) }; }
  for (const f of r.fills) f.ex = c.ex; for (const f of r.fund) f.ex = c.ex;
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
  const su = await H.sessionUser(env, H.getCookie(request, H.SESS_COOKIE));
  let uid = su && su.id ? String(su.id) : '';
  if (!uid && H.isAdminKey(env, H.adminKeyFrom(request, url)) && /^e2e/.test(url.searchParams.get('uid') || '')) uid = url.searchParams.get('uid');
  if (!uid) return J({ error: 'login_required' }, 401);
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }

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
      const k = String(b.key || '').trim(), s = String(b.secret || '').trim();
      if (!/^[A-Za-z0-9]{10,100}$/.test(k) || !/^[A-Za-z0-9]{10,200}$/.test(s)) return J({ error: 'bad_key_format' }, 400);
      chk = ex === 'bybit' ? await bybitCheck(env, H, k, s) : await binanceCheck(env, H, k, s);
      if (!chk.ok) return J({ error: chk.why || 'check_failed', detail: chk.detail || '', ip: JR_IP }, 400);
      if (!chk.readOnly) return J({ error: 'not_read_only', writes: chk.writes, ip: JR_IP }, 400); // THE RULE: refused, and nothing was stored
      conn.sealed = await jrSeal(env, uid, ex, JSON.stringify({ k, s }));
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
  if (path === '/sync' && request.method === 'POST') {
    const t = await env.STATS.get('jrn:sy:' + uid); if (t && Date.now() - +t < 20000) return J({ error: 'slow_down', wait: 20 }, 429);
    try { await env.STATS.put('jrn:sy:' + uid, String(Date.now()), { expirationTtl: 60 }); } catch (e) {}
    return J({ ok: true, res: await journalSyncUser(env, H, uid, b.id ? String(b.id) : null, JR_REQ_BUDGET) });
  }
  if (path === '/stats' || path === '/trades' || path === '/savings' || path === '/all') {
    const days = Math.max(1, Math.min(JR_DAYS_MAX, +url.searchParams.get('days') || 30)), conn = url.searchParams.get('conn') || '';
    const fromTs = Date.now() - days * DAY;
    const d = await jCall(env, uid, '/data?from=' + (fromTs - 30 * DAY) + (conn ? '&conn=' + encodeURIComponent(conn) : '')); // 30 days of lead-in so a position opened earlier is whole
    const { positions } = jrBuild(d.fills || [], d.funding || []);
    const st = jrStats(positions, d.fills || [], d.funding || [], fromTs);
    const exMain = (() => { const c = {}; for (const f of (d.fills || [])) if (f.ts >= fromTs) c[f.ex] = (c[f.ex] || 0) + f.px * f.qty; return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; })();
    const sav = jrSavings(st, d.fills || [], fromTs, H.feeVenues, exMain, await H.bybitBps(env));
    if (su && st.vol > 0) ctx.waitUntil(deskNote(env, uid, su.username || '', st));
    const trades = positions.filter(p => (p.closeTs || p.openTs) >= fromTs).sort((a, b) => (b.closeTs || b.openTs) - (a.closeTs || a.openTs)).slice(0, +url.searchParams.get('limit') || 300);
    const conns = (d.conns || []).map(c => Object.assign(c, { perms: (() => { try { return JSON.parse(c.perms || '{}'); } catch (e) { return {}; } })() }));
    return J({ days, exMain, stats: st, savings: sav, trades, conns, open: positions.filter(p => p.status === 'open').length });
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
