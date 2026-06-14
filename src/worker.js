/* MarginPad Cloudflare Worker:
   - /api/*            → public JSON calculator API (CORS-enabled)
   - /api/prices       → live prices (proxied + cached + fallback)
   - /telegram/webhook → Telegram bot with inline-button UI (needs TELEGRAM_TOKEN secret)
   - everything else   → static assets (the website) */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, OPTIONS',
  'access-control-allow-headers': 'Content-Type',
};
const round = (n, d = 6) => { if (!isFinite(n)) return null; const f = Math.pow(10, d); return Math.round(n * f) / f; };
const J = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2) + '\n', {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS },
  });
const num = (p, k) => { const v = parseFloat(p.get(k)); return isFinite(v) ? v : NaN; };

// ---------- calculations ----------
function calcLiquidation(p) {
  const entry = num(p, 'entry'), lev = num(p, 'leverage');
  const mmr = (isFinite(num(p, 'mmr')) ? num(p, 'mmr') : 0.5) / 100;
  const side = (p.get('side') || 'long').toLowerCase();
  if (!isFinite(entry) || !isFinite(lev) || lev <= 0) return J({ error: 'Required: entry, leverage (>0). Optional: mmr, side.' }, 400);
  const long = side !== 'short';
  const liq = long ? entry * (1 - 1 / lev + mmr) : entry * (1 + 1 / lev - mmr);
  return J({ entry, leverage: lev, maintenanceMarginRate: mmr * 100, side: long ? 'long' : 'short', liquidationPrice: round(liq, 2), distancePct: round((liq - entry) / entry * 100, 2) });
}
function calcPositionSize(p) {
  const balance = num(p, 'balance'), risk = num(p, 'risk') / 100, entry = num(p, 'entry'), stop = num(p, 'stop'), lev = num(p, 'leverage');
  const dist = Math.abs(entry - stop);
  if (!isFinite(balance) || !isFinite(risk) || !isFinite(entry) || !isFinite(stop) || dist === 0) return J({ error: 'Required: balance, risk, entry, stop (entry≠stop). Optional: leverage.' }, 400);
  const riskAmount = balance * risk, size = riskAmount / dist, notional = size * entry;
  return J({ balance, riskPct: risk * 100, entry, stop, positionSize: round(size), notional: round(notional, 2), riskAmount: round(riskAmount, 2), stopDistancePct: round(dist / entry * 100, 2), marginRequired: (isFinite(lev) && lev > 0) ? round(notional / lev, 2) : null });
}
function calcPnl(p) {
  const entry = num(p, 'entry'), exit = num(p, 'exit'), size = num(p, 'size'), lev = num(p, 'leverage');
  const side = (p.get('side') || 'long').toLowerCase();
  if (!isFinite(entry) || !isFinite(exit) || !isFinite(size)) return J({ error: 'Required: entry, exit, size. Optional: leverage, side.' }, 400);
  const long = side !== 'short';
  const pnl = (long ? (exit - entry) : (entry - exit)) * size;
  const roi = (long ? (exit - entry) : (entry - exit)) / entry * 100;
  return J({ entry, exit, size, side: long ? 'long' : 'short', pnl: round(pnl, 2), roiPct: round(roi, 2), roePct: (isFinite(lev) && lev > 0) ? round(roi * lev, 2) : null, entryNotional: round(entry * size, 2) });
}
function calcRiskReward(p) {
  const entry = num(p, 'entry'), stop = num(p, 'stop'), tp = num(p, 'tp');
  const riskV = Math.abs(entry - stop), reward = Math.abs(tp - entry);
  if (!isFinite(entry) || !isFinite(stop) || !isFinite(tp) || riskV === 0) return J({ error: 'Required: entry, stop, tp (entry≠stop).' }, 400);
  const ratio = reward / riskV;
  return J({ entry, stop, tp, riskPerUnit: round(riskV, 2), rewardPerUnit: round(reward, 2), riskRewardRatio: round(ratio, 2), breakevenWinRatePct: round(riskV / (riskV + reward) * 100, 2) });
}
function calcTakeProfit(p) {
  const entry = num(p, 'entry'), lev = (isFinite(num(p, 'leverage')) && num(p, 'leverage') > 0) ? num(p, 'leverage') : 1, roe = num(p, 'roe');
  const side = (p.get('side') || 'long').toLowerCase();
  if (!isFinite(entry) || entry <= 0 || !isFinite(roe)) return J({ error: 'Required: entry (>0), roe. Optional: leverage, side.' }, 400);
  const long = side !== 'short';
  const exit = long ? entry * (1 + roe / 100 / lev) : entry * (1 - roe / 100 / lev);
  return J({ entry, leverage: lev, targetRoePct: roe, side: long ? 'long' : 'short', targetExitPrice: round(exit, 2), priceMovePct: round(roe / lev * (long ? 1 : -1), 2) });
}
function handleApi(url) {
  const p = url.searchParams;
  switch (url.pathname) {
    case '/api/liquidation': return calcLiquidation(p);
    case '/api/position-size': return calcPositionSize(p);
    case '/api/pnl': return calcPnl(p);
    case '/api/risk-reward': return calcRiskReward(p);
    case '/api/take-profit': return calcTakeProfit(p);
    default: return J({ error: 'Unknown endpoint. See https://marginpad.io/api/' }, 404);
  }
}

// ---------- live prices (proxied + cached + fallback) ----------
const PRICE_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];
async function handlePrices() {
  const cache = caches.default;
  const cacheKey = new Request('https://marginpad.io/__prices_cache_v1');
  const hit = await cache.match(cacheKey);
  if (hit) return hit;
  const qs = '?symbols=' + encodeURIComponent(JSON.stringify(PRICE_SYMBOLS));
  const sources = [
    'https://data-api.binance.vision/api/v3/ticker/24hr' + qs,
    'https://api.binance.com/api/v3/ticker/24hr' + qs,
    'https://api.bybit.com/v5/market/tickers?category=spot',
  ];
  let pairs = null;
  for (const u of sources) {
    try {
      const r = await fetch(u, { cf: { cacheTtl: 15, cacheEverything: true } });
      if (!r.ok) continue;
      const data = await r.json();
      if (Array.isArray(data)) {
        pairs = data.map(d => ({ symbol: d.symbol, price: d.lastPrice, changePct: d.priceChangePercent }));
      } else if (data && data.result && Array.isArray(data.result.list)) {
        const want = new Set(PRICE_SYMBOLS);
        pairs = data.result.list.filter(d => want.has(d.symbol)).map(d => ({ symbol: d.symbol, price: d.lastPrice, changePct: (parseFloat(d.price24hPcnt) * 100).toFixed(2) }));
      }
      if (pairs && pairs.length) break;
    } catch (e) {}
  }
  if (!pairs || !pairs.length) return J({ error: 'upstream temporarily unavailable' }, 503);
  const resp = new Response(JSON.stringify({ pairs, ts: Date.now() }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=15', ...CORS },
  });
  try { await cache.put(cacheKey, resp.clone()); } catch (e) {}
  return resp;
}
// single-symbol live price (for the Telegram bot price/alert features)
async function fetchPrice(sym) {
  const s = String(sym || '').toUpperCase().replace(/USDT$/, '').replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  const pair = s + 'USDT';
  for (const b of ['https://data-api.binance.vision', 'https://api.binance.com']) {
    try {
      const r = await fetch(b + '/api/v3/ticker/24hr?symbol=' + pair, { cf: { cacheTtl: 10 } });
      if (r.ok) { const d = await r.json(); const p = +d.lastPrice; if (isFinite(p) && p > 0) return { sym: s, price: p, chg: +d.priceChangePercent }; }
    } catch (e) {}
  }
  // Bybit fallback (Binance blocks some datacenter IPs)
  try {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + pair, { cf: { cacheTtl: 10 } });
    if (r.ok) { const d = await r.json(); const it = d && d.result && d.result.list && d.result.list[0]; if (it) { const p = +it.lastPrice; if (isFinite(p) && p > 0) return { sym: s, price: p, chg: +(parseFloat(it.price24hPcnt) * 100) }; } }
  } catch (e) {}
  return null;
}
// price candles for the interactive heatmap chart (Binance + Bybit fallback, normalized)
async function handleKlines(url) {
  const sym = String(url.searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const iv = String(url.searchParams.get('interval') || '60');
  if (!sym) return J({ error: 'no symbol' }, 400);
  const pair = sym + 'USDT';
  const end = parseInt(url.searchParams.get('end') || '', 10); // optional endTime (ms) for back-paginating history
  const hasEnd = isFinite(end) && end > 0;
  // Binance is hard-blocked (403) from Cloudflare egress, so it's not used. Gate.io is the primary source:
  // reachable from CF, deep history in one call (BTC weekly back to 2013), and supports `to` for back-pagination.
  // Bybit is the fallback (works from CF but only goes back to ~2021 and returns nothing for old `end`).
  const gMap = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', '1440': '1d', '10080': '7d' };
  try {
    const g = 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=' + sym + '_USDT&interval=' + (gMap[iv] || '1h') + '&limit=1000' + (hasEnd ? '&to=' + Math.floor(end / 1000) : '');
    const r = await fetch(g, { cf: { cacheTtl: hasEnd ? 600 : 20 } });
    if (r.ok) { const d = await r.json(); // Gate row: [t, quoteVol, close, high, low, open, baseVol, closed]
      if (Array.isArray(d) && d.length) return J(d.map(k => ({ time: +k[0], open: +k[5], high: +k[3], low: +k[4], close: +k[2] })).sort((a, b) => a.time - b.time)); }
  } catch (e) {}
  try {
    const byMap = { '1': '1', '5': '5', '15': '15', '60': '60', '240': '240', '1440': 'D', '10080': 'W' };
    const r = await fetch('https://api.bybit.com/v5/market/kline?category=spot&symbol=' + pair + '&interval=' + (byMap[iv] || '60') + '&limit=1000' + (hasEnd ? '&end=' + end : ''), { cf: { cacheTtl: hasEnd ? 600 : 30 } });
    if (r.ok) { const d = await r.json(); const list = d && d.result && d.result.list; if (list && list.length) return J(list.map(k => ({ time: Math.floor(+k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4] })).sort((a, b) => a.time - b.time)); }
  } catch (e) {}
  return J({ error: 'no data' }, 404);
}

// Proxy to the separate liquidation collector service (its own VPS). The site reads it through here so it
// stays same-origin + versioned, aggregates are edge-cached, and the page degrades gracefully if it's down.
// Set COLLECTOR_URL (wrangler var/secret) to the service base, e.g. https://collector.marginpad.io.
// While unset/unreachable, returns {fallback:true} 503 -> the frontend shows theoretical lines + a notice.
async function handleCollectorProxy(url, request, env) {
  const base = (env && env.COLLECTOR_URL || '').replace(/\/$/, '');
  if (!base) return J({ error: 'collector_unconfigured', fallback: true }, 503);
  const isAgg = url.pathname.endsWith('/recent');
  try {
    const r = await fetch(base + url.pathname + url.search, {
      headers: { 'x-api-key': request.headers.get('x-api-key') || '' },
      cf: isAgg ? { cacheTtl: 45, cacheEverything: true } : { cacheTtl: 0 },
    });
    if (!r.ok) return J({ error: 'collector_unreachable', fallback: true }, 503); // DNS/origin/5xx -> clean fallback
    const body = await r.text();
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': isAgg ? 'public, max-age=45' : 'no-store',
      },
    });
  } catch (e) {
    return J({ error: 'collector_unreachable', fallback: true }, 503);
  }
}
// cron: scan price alerts, fire the ones that hit, delete them
async function checkAlerts(env) {
  if (!env || !env.STATS || !env.TELEGRAM_TOKEN) return;
  try { if (!(await env.STATS.get('al:on'))) return; } catch (e) { return; } // skip listing when no alerts exist
  const keys = []; let cursor;
  try { do { const l = await env.STATS.list({ prefix: 'al:', cursor, limit: 1000 }); l.keys.forEach(k => keys.push(k.name)); cursor = l.list_complete ? null : l.cursor; } while (cursor); } catch (e) { return; }
  if (!keys.length) return;
  const items = [];
  for (const key of keys) { try { const a = JSON.parse(await env.STATS.get(key)); if (a && a.sym) { a._key = key; items.push(a); } } catch (e) {} }
  const syms = {}; items.forEach(a => syms[a.sym] = 1);
  const prices = {};
  for (const s in syms) { const p = await fetchPrice(s); if (p) prices[s] = p.price; }
  for (const a of items) {
    const cur = prices[a.sym]; if (cur == null) continue;
    if ((a.dir === 'up' && cur >= a.target) || (a.dir === 'down' && cur <= a.target)) {
      await tgApi(env.TELEGRAM_TOKEN, 'sendMessage', { chat_id: a.chat, text: `🔔 <b>${a.sym} alert!</b>\n${a.sym} is now <b>$${tgfmt(cur)}</b> (${a.dir === 'up' ? '≥' : '≤'} $${tgfmt(a.target)}).\n\n➡️ <a href="https://marginpad.io">Plan your trade on MarginPad</a>`, parse_mode: 'HTML', disable_web_page_preview: true });
      try { await env.STATS.delete(a._key); } catch (e) {}
    }
  }
}

// ---------- privacy-friendly self-hosted analytics (hashed visitor id — no cookies, no raw IP stored) ----------
const STATS_KEY = 'mp_9f3c7e21b84d4a6f';
async function sha8(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; }
}
function deviceOf(ua) { return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ? 'Mobile' : 'Desktop'; }
function browserOf(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
async function handleTrack(url, request, env) {
  const ok = new Response('', { status: 204, headers: CORS });
  if (!env || !env.STATS) return ok;
  const p = url.searchParams;
  const type = (p.get('t') || 'event').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
  const label = (p.get('e') || '').replace(/[^a-zA-Z0-9 #:._/-]/g, '').slice(0, 48);
  const inc = async (k, ttl) => { try { const c = await env.STATS.getWithMetadata(k); const v = ((c && c.metadata && c.metadata.c) || 0) + 1; const o = { metadata: { c: v } }; if (ttl) o.expirationTtl = ttl; await env.STATS.put(k, String(v), o); } catch (e) {} };
  if (type === 'pageview') {
    const day = new Date().toISOString().slice(0, 10);
    await inc('pv:total'); // raw page views (every load)
    await inc('pv:day:' + day, 3456000);                                  // daily page views (40d TTL) — for trends/compare
    await inc('hr:' + String(new Date().getUTCHours()).padStart(2, '0')); // hour-of-day traffic pattern (all-time)
    const pth0 = (p.get('p') || '/'); const lm = pth0.match(/^\/([a-z]{2})(\/|$)/);
    await inc('lang:' + (lm ? lm[1] : 'en'));                             // language (from /xx/ path prefix)
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '';
    const ua = request.headers.get('user-agent') || '';
    const vid = await sha8(ip + '|' + ua);
    if (vid) {
      try { await env.STATS.put('on:' + vid, '1', { expirationTtl: 180 }); } catch (e) {} // "online now" presence (3-min window)
      const seen = await env.STATS.get('uvd:' + day + ':' + vid);
      if (!seen) { // first visit today from this person
        await env.STATS.put('uvd:' + day + ':' + vid, '1', { expirationTtl: 172800 });
        await inc('uv:day:' + day);
        const ever = await env.STATS.get('v:' + vid);
        if (!ever) { await env.STATS.put('v:' + vid, day); await inc('uv:total'); await inc('uv:new:' + day); }
        else { await inc('uv:ret:' + day); }
        const cc = request.cf && request.cf.country; if (cc) await inc('geo:' + cc);
        const ref = p.get('r'); if (ref) { try { const h = new URL(ref).hostname.replace(/^www\./, ''); if (h && h !== 'marginpad.io') await inc('ref:' + h.slice(0, 40)); } catch (e) {} }
        await inc('pv:path:' + (p.get('p') || '/').slice(0, 60));
        await inc('dev:' + deviceOf(ua));
        await inc('br:' + browserOf(ua));
      }
    }
  } else {
    await inc('ev:' + type + (label ? ':' + label : ''));
    if (type === 'exchange' || type === 'tool' || type === 'hotpair') {
      const d2 = new Date().toISOString().slice(0, 10);
      await inc('aff:total'); await inc('aff:day:' + d2, 3456000);        // affiliate-click totals + daily series
    }
    if (type === 'exchange' || type === 'paper' || type === 'hotpair' || type === 'tool') { // live activity ring buffer
      try {
        const cc = (request.cf && request.cf.country) || '';
        let log = []; try { log = JSON.parse(await env.STATS.get('evlog') || '[]'); } catch (e) {}
        log.unshift({ t: type, e: label, cc: cc, ts: Date.now() });
        if (log.length > 22) log = log.slice(0, 22);
        await env.STATS.put('evlog', JSON.stringify(log), { expirationTtl: 86400 });
      } catch (e) {}
    }
  }
  return ok;
}
// ---------- blog comments (KV-backed, basic anti-spam) ----------
async function handleComments(url, request, env) {
  const C2 = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'Content-Type' };
  const jr = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...C2 } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: C2 });
  if (!env || !env.STATS) return jr([]);
  const clean = s => (s || '').replace(/[^a-z0-9-]/gi, '').slice(0, 80);
  if (request.method === 'GET') {
    const slug = clean(url.searchParams.get('post'));
    if (!slug) return jr([]);
    let arr = []; try { arr = JSON.parse(await env.STATS.get('cm:' + slug) || '[]'); } catch (e) {}
    return jr(arr);
  }
  if (request.method === 'POST') {
    let body = {}; try { body = await request.json(); } catch (e) {}
    if (body.website) return jr({ ok: true }); // honeypot
    const slug = clean(body.post);
    let name = String(body.name || '').replace(/[<>]/g, '').trim().slice(0, 40) || 'Anonymous';
    let text = String(body.text || '').replace(/[<>]/g, '').trim().slice(0, 1000);
    if (!slug || text.length < 2) return jr({ ok: false, error: 'invalid' }, 400);
    text = text.replace(/https?:\/\/\S+/gi, '[link]').replace(/\bwww\.\S+/gi, '[link]');
    const ip = request.headers.get('cf-connecting-ip') || '';
    const ua = request.headers.get('user-agent') || '';
    const vid = await sha8(ip + '|' + ua);
    const rk = 'cmrate:' + vid + ':' + Math.floor(Date.now() / 36e5);
    let rc = 0; try { rc = parseInt(await env.STATS.get(rk) || '0', 10) || 0; } catch (e) {}
    if (rc >= 6) return jr({ ok: false, error: 'rate' }, 429);
    try { await env.STATS.put(rk, String(rc + 1), { expirationTtl: 7200 }); } catch (e) {}
    let arr = []; try { arr = JSON.parse(await env.STATS.get('cm:' + slug) || '[]'); } catch (e) {}
    const c = { n: name, t: text, ts: Date.now() };
    arr.push(c);
    if (arr.length > 300) arr = arr.slice(arr.length - 300);
    try { await env.STATS.put('cm:' + slug, JSON.stringify(arr)); } catch (e) {}
    const inc = async k => { try { const cur = await env.STATS.getWithMetadata(k); const v = ((cur && cur.metadata && cur.metadata.c) || 0) + 1; await env.STATS.put(k, String(v), { metadata: { c: v } }); } catch (e) {} };
    await inc('cmt:total'); await inc('cmt:' + slug);
    return jr({ ok: true, comment: c });
  }
  return jr({ ok: false }, 405);
}
async function handleStatsReset(env) {
  if (!env || !env.STATS) return new Response('na', { status: 503 });
  const prefixes = ['pv:', 'uv:', 'ev:', 'geo:', 'ref:', 'dev:', 'br:', 'v:', 'uvd:'];
  let n = 0;
  for (const pre of prefixes) {
    let cursor;
    do {
      const l = await env.STATS.list({ prefix: pre, cursor, limit: 1000 });
      for (const k of l.keys) { try { await env.STATS.delete(k.name); n++; } catch (e) {} }
      cursor = l.list_complete ? null : l.cursor;
    } while (cursor);
  }
  return new Response('cleared ' + n + ' analytics keys (bot + league kept)');
}
// Live health of the liquidation collector (its own VPS), rendered into the stats dashboard.
async function collectorHealth(env) {
  const base = (env && env.COLLECTOR_URL || '').replace(/\/$/, '');
  const fail = (msg) => `<div class="hp hp-down"><div class="hp-h"><span class="hp-dot"></span><span class="hp-st">LIQUIDATION MAP — DOWN</span></div><div class="hp-sub">${msg}</div></div>`;
  if (!base) return fail('COLLECTOR_URL not configured');
  let st, cl;
  try {
    const [r1, r2] = await Promise.all([
      fetch(base + '/api/v1/status', { cf: { cacheTtl: 0 } }),
      fetch(base + '/api/v1/clusters?symbol=BTC', { cf: { cacheTtl: 0 } }).catch(() => null),
    ]);
    if (!r1.ok) return fail('collector unreachable (HTTP ' + r1.status + ')');
    st = await r1.json();
    cl = r2 && r2.ok ? await r2.json() : null;
  } catch (e) { return fail('collector unreachable'); }
  if (!st || !Array.isArray(st.exchanges)) return fail('bad status response');
  const now = Date.now();
  const conn = st.exchanges.filter((e) => e.connected).length, total = st.exchanges.length;
  const anyRecent = st.exchanges.some((e) => e.lastEventAt && now - e.lastEventAt < 30 * 60000);
  const status = conn === 0 ? ['DOWN', 'hp-down'] : conn < total ? ['DEGRADED', 'hp-warn'] : ['LIVE', 'hp-live'];
  const up = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + 'h ' : '') + m + 'm'; };
  const ago = (t) => !t ? 'never' : (now - t < 60000 ? '<1m' : Math.round((now - t) / 60000) + 'm') + ' ago';
  const idleLbl = (e) => e.name === 'binance' ? 'idle (geo-restricted)' : 'connected · awaiting';
  const exHtml = st.exchanges.map((e) => `<div class="hp-ex"><span class="hp-edot ${!e.connected ? 'off' : e.lastEventAt ? 'on' : 'idle'}"></span><b>${e.name}</b><small>${!e.connected ? 'OFFLINE' : e.lastEventAt ? 'live · ' + ago(e.lastEventAt) : idleLbl(e)} · ${e.eventsPerMin || 0}/min</small></div>`).join('');
  const clN = cl && Array.isArray(cl.clusters) ? cl.clusters.length : 0;
  return `<div class="hp ${status[1]}">
    <div class="hp-h"><span class="hp-dot"></span><span class="hp-st">LIQUIDATION MAP — ${status[0]}</span><span class="hp-up">uptime ${up(st.uptimeSec || 0)}</span></div>
    <div class="hp-grid">${exHtml}</div>
    <div class="hp-meta">${Number(st.db && st.db.events24h || 0).toLocaleString('en-US')} liquidations · ${clN} BTC clusters · ${(st.symbols || []).length} symbols${anyRecent ? '' : ' · <i>quiet — no liqs in 30m (normal when price is flat)</i>'}</div>
  </div>`;
}

async function handleStats(url, env) {
  if (url.searchParams.get('key') !== STATS_KEY) return new Response('Forbidden', { status: 403 });
  if (!env || !env.STATS) return new Response('No storage', { status: 500 });
  const htmlResp = (h) => new Response(h, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  // Serve a recent cached render. Each full render does a paginated KV `list`, and the free tier allows only
  // 1000 lists/day — so without this, auto-refresh (every 60s) + manual reloads blow the quota by midday. The
  // cache (5-min TTL) caps fresh renders to a few per hour regardless of how often the dashboard refreshes.
  const noCache = url.searchParams.get('nc') === '1'; // ?nc=1 forces a fresh render (skips the short cache)
  if (!noCache) { try { const hot = await env.STATS.get('st:cache'); if (hot) return htmlResp(hot); } catch (e) {} }
  const all = []; let cursor, pg = 0;
  try {
    do {
      const l = await env.STATS.list({ cursor, limit: 1000 });
      l.keys.forEach(k => all.push({ n: k.name, c: (k.metadata && k.metadata.c) || 0 }));
      cursor = l.list_complete ? null : l.cursor; pg++;
    } while (cursor && pg < 10);
  } catch (e) {
    if (!all.length) {
      try { const last = await env.STATS.get('st:cache:last'); if (last) return htmlResp(last); } catch (e2) {} // serve last good render if quota is exhausted
      // No cached render + list quota exhausted: a lite view from DIRECT key reads (no `list`) so the essentials
      // + collector health stay visible. Full analytics return once the daily list quota resets at UTC midnight.
      try {
        const gc = async (k) => { try { const r = await env.STATS.getWithMetadata(k); return (r && r.metadata && r.metadata.c) || (r && r.value ? parseInt(r.value, 10) : 0) || 0; } catch (e3) { return 0; } };
        const today = new Date().toISOString().slice(0, 10);
        const [pvT, uvT, uvTod, bmsg, busers, cmt] = await Promise.all([gc('pv:total'), gc('uv:total'), gc('uv:day:' + today), gc('bot:msg'), gc('bot:users'), gc('cmt:total')]);
        const hh = await collectorHealth(env);
        const c2 = (v, l) => `<div class="card"><div class="cv">${v.toLocaleString('en-US')}</div><div class="cl">${l}</div></div>`;
        const css = `*{box-sizing:border-box}body{background:#0a0b0d;color:#e9e7df;font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:880px;margin:0 auto;padding:26px 18px 60px}h1{font-size:22px;margin:0 0 2px}.muted{color:#5c656f;font-size:12px;margin-bottom:22px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:620px){.cards{grid-template-columns:repeat(2,1fr)}}.card{background:#111419;border:1px solid #232932;border-radius:14px;padding:16px}.cv{font-size:28px;font-weight:800;color:#c2f64a;line-height:1;letter-spacing:-1px}.cl{color:#9aa3ad;font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:.08em}.note{margin-top:22px;color:#cdd3da;font-size:13px;line-height:1.6;background:#111419;border:1px solid #5e521d;border-radius:12px;padding:13px 16px}.hp{border:1px solid #232932;border-radius:14px;padding:15px 17px;margin-bottom:22px;background:#111419}.hp-live{border-color:#1d5e3f;background:linear-gradient(180deg,rgba(46,189,133,.09),#111419)}.hp-warn{border-color:#5e521d;background:linear-gradient(180deg,rgba(255,179,71,.09),#111419)}.hp-down{border-color:#6e2020;background:linear-gradient(180deg,rgba(255,98,88,.11),#111419)}.hp-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.hp-dot{width:10px;height:10px;border-radius:50%;background:#2ebd85;animation:hpp 1.8s infinite}.hp-down .hp-dot{background:#ff6258;animation:none}.hp-warn .hp-dot{background:#ffb347;animation:none}@keyframes hpp{0%,100%{box-shadow:0 0 0 0 rgba(46,189,133,.55)}50%{box-shadow:0 0 0 7px rgba(46,189,133,0)}}.hp-st{font-weight:800;font-size:15px}.hp-up{margin-left:auto;color:#5c656f;font-size:11px;font-family:monospace}.hp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0 11px}@media(max-width:620px){.hp-grid{grid-template-columns:1fr}}.hp-ex{display:flex;align-items:center;gap:7px;font-size:13px;background:#0d0f12;border:1px solid #232932;border-radius:9px;padding:8px 11px}.hp-ex b{text-transform:capitalize}.hp-ex small{color:#5c656f;font-size:10px;margin-left:auto;font-family:monospace;text-align:right}.hp-edot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.hp-edot.on{background:#2ebd85}.hp-edot.off{background:#ff6258}.hp-edot.idle{background:#5c656f}.hp-meta{color:#9aa3ad;font-size:12.5px;font-family:monospace}.hp-meta i{color:#ffb347;font-style:normal}.hp-sub{color:#9aa3ad;font-size:13px;margin-top:8px}`;
        const lite = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="120"><title>MarginPad Stats</title><style>${css}</style></head><body><h1>MarginPad — Live Stats</h1><div class="muted">Lite view · collector + headline metrics live</div>${hh}<div class="cards">${c2(uvTod, 'Visitors today')}${c2(uvT, 'Total visitors')}${c2(pvT, 'Page views')}${c2(cmt, 'Comments')}</div><div class="cards" style="margin-top:12px">${c2(bmsg, 'Bot messages')}${c2(busers, 'Bot users')}</div><div class="note"><b>Detailed analytics paused</b> — today's free KV list quota is used up; full breakdowns (devices, countries, pages, clicks) return automatically at <b>UTC midnight</b>. Tracking never stopped, and from now on the dashboard caches its render so this won't recur.</div></body></html>`;
        return htmlResp(lite);
      } catch (e4) {
        return new Response('Stats temporarily unavailable — daily KV list quota reached (resets at UTC midnight). Your data is still being recorded.', { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' } });
      }
    }
  }
  let pvTotal = 0, uvTotal = 0, botMsg = 0, botUsers = 0, cmtTotal = 0;
  const pages = [], geo = [], refs = [], uvDays = {}, grid = {}, devices = [], browsers = [], newD = {}, retD = {};
  const ex = [], tools = [], tabs = [], els = [], other = [], botCmds = [], cmtPosts = [];
  const pvDays = {}, affDays = {}, hours = {}, langs = [], paperSym = [], paperLev = [], scrollD = [], timeD = []; let online = 0;
  all.forEach(k => {
    const n = k.n, c = k.c;
    if (n === 'pv:total') pvTotal = c;
    else if (n === 'uv:total') uvTotal = c;
    else if (n === 'cmt:total') cmtTotal = c;
    else if (n.indexOf('cmt:') === 0) cmtPosts.push([n.slice(4), c]);
    else if (n === 'bot:msg') botMsg = c;
    else if (n === 'bot:users') botUsers = c;
    else if (n.indexOf('bot:cmd:') === 0) botCmds.push([n.slice(8), c]);
    else if (n.indexOf('uv:day:') === 0) uvDays[n.slice(7)] = c;
    else if (n.indexOf('uv:new:') === 0) newD[n.slice(7)] = c;
    else if (n.indexOf('uv:ret:') === 0) retD[n.slice(7)] = c;
    else if (n.indexOf('pv:path:') === 0) pages.push([n.slice(8), c]);
    else if (n.indexOf('geo:') === 0) geo.push([n.slice(4), c]);
    else if (n.indexOf('ref:') === 0) refs.push([n.slice(4), c]);
    else if (n.indexOf('dev:') === 0) devices.push([n.slice(4), c]);
    else if (n.indexOf('br:') === 0) browsers.push([n.slice(3), c]);
    else if (n.indexOf('pv:day:') === 0) pvDays[n.slice(7)] = c;
    else if (n.indexOf('aff:day:') === 0) affDays[n.slice(8)] = c;
    else if (n.indexOf('hr:') === 0) hours[n.slice(3)] = c;
    else if (n.indexOf('lang:') === 0) langs.push([n.slice(5), c]);
    else if (n.indexOf('on:') === 0) online++;
    else if (n.indexOf('ev:exchange:') === 0) ex.push([n.slice(12), c]);
    else if (n.indexOf('ev:tool:') === 0) tools.push([n.slice(8), c]);
    else if (n.indexOf('ev:tab:') === 0) tabs.push([n.slice(7), c]);
    else if (n.indexOf('ev:grid:') === 0) grid[n.slice(8)] = c;
    else if (n.indexOf('ev:el:') === 0) els.push([n.slice(6), c]);
    else if (n.indexOf('ev:paper:') === 0) paperSym.push([n.slice(9), c]);
    else if (n.indexOf('ev:plev:') === 0) paperLev.push([n.slice(8), c]);
    else if (n.indexOf('ev:scroll:') === 0) scrollD.push([n.slice(10), c]);
    else if (n.indexOf('ev:time:') === 0) timeD.push([n.slice(8), c]);
    else if (n.indexOf('ev:') === 0) other.push([n.slice(3), c]);
  });
  const sum = a => a.reduce((s, x) => s + x[1], 0);
  [pages, geo, refs, ex, tools, tabs, els, other, botCmds, devices, browsers, cmtPosts, langs, paperSym].forEach(a => a.sort((x, y) => y[1] - x[1]));
  // Map legacy raw click descriptors (canvas, span, div.wrap, button#planSave…) to friendly names and merge.
  // New clicks already arrive friendly from the client; this keeps the historical data readable too.
  const prettyEl = raw => {
    const s = String(raw);
    const M = { 'canvas': 'Price chart', 'button#planSave': 'Open position (Long/Short)', 'button#jrOpen': 'My Trades (header)', 'button#jrClose': 'Close My Trades', 'div#jrBackdrop': 'Close My Trades (tap-away)', 'button#ptSig': 'Signals toggle', 'button#planSym': 'Symbol picker', 'select#planSym': 'Symbol picker', 'input#planLev': 'Leverage input', 'input#planAmt': 'Amount input', 'button#chatOpen': 'Open chat' };
    if (M[s]) return M[s];
    if (/^button/.test(s) && /Paper Trade/i.test(s)) return 'Product card: Paper Trade';
    if (/^button/.test(s) && /Liquidation Heatmap/i.test(s)) return 'Product card: Liquidation Heatmap';
    if (/^button/.test(s) && /Liquidation Calculator/i.test(s)) return 'Product card: Liquidation Calculator';
    if (/^button/.test(s) && /Swap/i.test(s)) return 'Product card: Swap Crypto';
    if (/^a /.test(s)) return 'Link: ' + s.slice(2);
    if (/^(button|label) /.test(s)) return 'Button: ' + s.replace(/^\w+ /, '');
    if (/^(body|html|section|div|main|header|footer|span|em|i|small|p|h\d|ul|li|nav|svg|path|img|aside)(\.|#|$)/.test(s)) return 'Empty space / background';
    if (s === 'button') return 'Button (unlabeled)';
    if (s === 'other' || s === 'Other') return 'Other';
    return s;
  };
  const elAgg = {}; els.forEach(([k, c]) => { const p = prettyEl(k); elAgg[p] = (elAgg[p] || 0) + c; });
  const elsPretty = Object.keys(elAgg).map(k => [k, elAgg[k]]).sort((a, b) => b[1] - a[1]);
  let gmax = 1; for (const gk in grid) { if (grid[gk] > gmax) gmax = grid[gk]; }
  let hcells = '';
  for (let r = 0; r < 40; r++) for (let cc = 0; cc < 20; cc++) {
    const v = grid[cc + '_' + r] || 0, i = v / gmax;
    hcells += '<i style="background:' + (v ? 'rgba(' + Math.round(120 + 135 * i) + ',' + Math.round(246 - 190 * i) + ',' + Math.round(74 - 60 * i) + ',' + (0.22 + 0.78 * i).toFixed(2) + ')' : 'transparent') + '"></i>';
  }
  const affiliate = sum(ex) + sum(tools) + sum(other.filter(x => x[0].indexOf('hotpair') === 0));
  const todayStr = new Date().toISOString().slice(0, 10);
  const dl = []; let dmax = 1, uvToday = 0;
  for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); const c = uvDays[d] || 0; if (c > dmax) dmax = c; if (d === todayStr) uvToday = c; dl.push([d.slice(5), c]); }
  const newT = newD[todayStr] || 0, retT = retD[todayStr] || 0;
  const ctr = uvTotal ? (affiliate / uvTotal * 100) : 0;
  const ppv = uvTotal ? (pvTotal / uvTotal) : 0;
  const directV = Math.max(0, uvTotal - sum(refs)); const refD = refs.slice(); if (directV) refD.push(['direct / none', directV]); refD.sort((a, b) => b[1] - a[1]);
  const esc = s => String(s).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  const flag = cc => /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(127397 + cc.charCodeAt(0), 127397 + cc.charCodeAt(1)) : '';
  const barlist = (arr, fmt) => arr.length ? arr.slice(0, 12).map(x => `<div class="row"><div class="lbl">${fmt ? fmt(x[0]) : esc(x[0])}</div><div class="track"><div class="fill" style="width:${Math.max(4, x[1] / arr[0][1] * 100)}%"></div></div><div class="cnt">${x[1]}</div></div>`).join('') : '<div class="empty">no data yet</div>';
  const daychart = dl.map(x => `<div class="dcol"><div class="dbar" style="height:${Math.max(2, x[1] / dmax * 100)}%" title="${x[0]}: ${x[1]}"></div><div class="dlbl">${x[0].slice(3)}</div></div>`).join('');
  const card = (v, l) => `<div class="card"><div class="cv">${v}</div><div class="cl">${l}</div></div>`;
  // ---- derived analytics (revenue, funnel, goals, hourly, deltas, sparklines, languages) ----
  const N = x => (x || 0).toLocaleString('en-US');
  const epc = { bybit: 0.55, binance: 0.45, okx: 0.5, kucoin: 0.4, gate: 0.4, kraken: 0.35 }; // rough $/click
  let revenue = 0; ex.forEach(([nm, c]) => { revenue += c * (epc[String(nm).toLowerCase()] || 0.4); });
  const yday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const uvY = uvDays[yday] || 0, pvTod = pvDays[todayStr] || 0, pvY = pvDays[yday] || 0;
  const affTod = affDays[todayStr] || 0, affY = affDays[yday] || 0;
  const dpc = (t, y) => { if (!y) return ''; const d = Math.round((t - y) / y * 100); return `<span class="dlt ${d >= 0 ? 'up' : 'dn'}">${d >= 0 ? '▲' : '▼'} ${Math.abs(d)}%</span>`; };
  const spark = map => { const v = []; for (let i = 13; i >= 0; i--) v.push(map[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] || 0); const mx = Math.max(1, ...v); const pts = v.map((x, i) => `${(i / 13 * 100).toFixed(1)},${(26 - x / mx * 24).toFixed(1)}`).join(' '); return `<svg class="kspark" viewBox="0 0 100 28" preserveAspectRatio="none"><polyline points="${pts}"/></svg>`; };
  const hrMax = Math.max(1, ...Object.keys(hours).map(k => hours[k]));
  let hrBars = ''; for (let h = 0; h < 24; h++) { const hh = String(h).padStart(2, '0'); const v = hours[hh] || 0; hrBars += `<div class="hcol"><div class="hbar" style="height:${Math.max(2, v / hrMax * 100).toFixed(0)}%" title="${hh}:00 UTC — ${v} views"></div><div class="hlbl">${h % 4 === 0 ? hh : ''}</div></div>`; }
  const exClicks = sum(ex);
  const fstage = (lbl, val, base, col) => `<div class="fn-row"><div class="fn-bar" style="width:${base ? Math.max(6, val / base * 100).toFixed(1) : 6}%;background:${col}"></div><div class="fn-lbl">${lbl}</div><div class="fn-val">${N(val)}${(base && base !== val) ? ' <small>' + (val / base * 100).toFixed(1) + '%</small>' : ''}</div></div>`;
  const funnel = fstage('Visitors', uvTotal, uvTotal, '#3a4a5e') + fstage('Affiliate clicks', affiliate, uvTotal, '#7fae12') + fstage('Exchange link-outs', exClicks, uvTotal, '#c2f64a');
  const goalRow = (lbl, val, tgt, col) => `<div class="goal"><div class="goal-h"><span>${lbl}</span><b>${N(val)} <small>/ ${tgt}</small></b></div><div class="goal-tr"><div class="goal-f" style="width:${Math.min(100, val / tgt * 100).toFixed(0)}%;background:${col}"></div></div></div>`;
  const langName = { en: '🇬🇧 English', es: '🇪🇸 Español', pt: '🇧🇷 Português', fr: '🇫🇷 Français', de: '🇩🇪 Deutsch', ru: '🇷🇺 Русский', tr: '🇹🇷 Türkçe', zh: '🇨🇳 中文', ja: '🇯🇵 日本語', ko: '🇰🇷 한국어', ar: '🇸🇦 العربية', id: '🇮🇩 Bahasa', nl: '🇳🇱 Nederlands' };
  const kcard = (v, l, sp, dl) => `<div class="card"><div class="cv">${v}</div><div class="cl">${l}${dl || ''}</div>${sp || ''}</div>`;
  // live activity feed (ring buffer) + per-exchange revenue + ordered engagement metrics
  let evlog = []; try { evlog = JSON.parse(await env.STATS.get('evlog') || '[]'); } catch (e) {}
  const ago = ts => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'; };
  const verb = t => t === 'exchange' ? 'went to an exchange' : t === 'paper' ? 'opened a paper trade' : t === 'hotpair' ? 'traded a pair' : t === 'tool' ? 'opened a tool' : t;
  const feed = evlog.length ? evlog.map(x => `<div class="fe"><span class="fe-f">${flag(x.cc) || '🌐'}</span><span class="fe-t">${esc(x.e || '') ? '<b>' + esc(x.e) + '</b> ' : ''}${verb(x.t)}</span><span class="fe-a">${ago(x.ts)} ago</span></div>`).join('') : '<div class="empty">no recent activity yet</div>';
  const exRevList = ex.length ? ex.slice(0, 12).map(([nm, c]) => { const r = c * (epc[String(nm).toLowerCase()] || 0.4); return `<div class="row"><div class="lbl">${esc(nm)}</div><div class="track"><div class="fill" style="width:${Math.max(4, c / ex[0][1] * 100).toFixed(1)}%"></div></div><div class="cnt">${c} <small style="color:#5c656f">$${r.toFixed(0)}</small></div></div>`; }).join('') : '<div class="empty">no data yet</div>';
  const ordered = (arr, ord) => ord.map(k => [k, (arr.find(x => x[0] === k) || [k, 0])[1]]);
  const scrollO = ordered(scrollD, ['25', '50', '75', '100']).map(x => [x[0] + '%', x[1]]);
  const timeO = ordered(timeD, ['0-10s', '10-30s', '30-60s', '1-3m', '3-10m', '10m+']);
  const levO = ordered(paperLev, ['1-5x', '5-20x', '20-50x', '50-100x', '100x+']);
  // bounce ≈ sessions that left within 10s
  const tSum = timeD.reduce((s, x) => s + x[1], 0);
  const bounce = tSum ? ((timeD.find(x => x[0] === '0-10s') || [0, 0])[1] / tSum * 100) : 0;
  // country "treemap" (boxes scaled by share)
  const geoTotal = sum(geo);
  const geoTree = geo.length ? geo.slice(0, 14).map(([cc, c]) => { const sh = geoTotal ? c / geoTotal : 0; const fs = (12 + sh * 42).toFixed(0); const op = (0.07 + sh * 0.5).toFixed(2); return `<div class="gt" style="font-size:${fs}px;background:rgba(194,246,74,${op})" title="${esc(cc)}: ${c}">${flag(cc)} <b>${esc(cc)}</b> <small>${c}</small></div>`; }).join('') : '<div class="empty">no data yet</div>';
  // date-range selector (uses the daily series we keep)
  const rng = url.searchParams.get('range') || '7d';
  const rDays = rng === 'today' ? 1 : rng === '30d' ? 30 : 7;
  const rsum = map => { let s = 0; for (let i = 0; i < rDays; i++) s += map[new Date(Date.now() - i * 864e5).toISOString().slice(0, 10)] || 0; return s; };
  const uvR = rsum(uvDays), pvR = rsum(pvDays), affR = rsum(affDays);
  const rlink = r => `?key=${esc(url.searchParams.get('key') || '')}&amp;range=${r}`;
  const rbtn = (r, lbl) => `<a class="rbtn ${rng === r ? 'on' : ''}" href="${rlink(r)}">${lbl}</a>`;
  const rangeBar = `<div class="rangebar">${rbtn('today', 'Today')}${rbtn('7d', '7 days')}${rbtn('30d', '30 days')}</div>`;
  if (url.searchParams.get('format') === 'csv') {
    let csv = 'metric,value\nvisitors_total,' + uvTotal + '\nvisitors_today,' + uvToday + '\npage_views,' + pvTotal + '\naffiliate_clicks,' + affiliate + '\nexchange_clicks,' + exClicks + '\nest_revenue_usd,' + Math.round(revenue) + '\n\nexchange,clicks,est_usd\n';
    ex.forEach(([n, c]) => csv += n + ',' + c + ',' + (c * (epc[String(n).toLowerCase()] || 0.4)).toFixed(0) + '\n');
    csv += '\npage,visitors\n'; pages.forEach(([n, c]) => csv += '"' + String(n).replace(/"/g, '') + '",' + c + '\n');
    csv += '\ncountry,visitors\n'; geo.forEach(([n, c]) => csv += n + ',' + c + '\n');
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="marginpad-stats.csv"', 'cache-control': 'no-store' } });
  }
  const healthHtml = await collectorHealth(env);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60"><title>MarginPad Stats</title><style>*{box-sizing:border-box}body{background:#0a0b0d;color:#e9e7df;font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:880px;margin:0 auto;padding:26px 18px 60px}h1{font-size:22px;margin:0 0 2px}.muted{color:#5c656f;font-size:12px;margin-bottom:22px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:620px){.cards{grid-template-columns:repeat(2,1fr)}}.card{background:#111419;border:1px solid #232932;border-radius:14px;padding:16px}.cv{font-size:28px;font-weight:800;color:#c2f64a;line-height:1;letter-spacing:-1px}.cl{color:#9aa3ad;font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:.08em}h2{font-size:13px;color:#9aa3ad;margin:34px 0 12px;text-transform:uppercase;letter-spacing:.12em}h2 span{color:#5c656f;text-transform:none;letter-spacing:0}.chart{display:flex;align-items:flex-end;gap:5px;height:140px;background:#111419;border:1px solid #232932;border-radius:14px;padding:14px 12px}.dcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px}.dbar{width:100%;max-width:30px;background:linear-gradient(180deg,#c2f64a,#7fae12);border-radius:4px 4px 0 0;min-height:2px}.dlbl{font-size:10px;color:#5c656f;font-family:monospace}.list{background:#111419;border:1px solid #232932;border-radius:14px;padding:8px 16px}.row{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #232932}.row:last-child{border-bottom:none}.lbl{width:36%;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.track{flex:1;height:8px;background:#1a1f27;border-radius:6px;overflow:hidden}.fill{height:100%;background:#c2f64a;border-radius:6px}.cnt{font-family:monospace;color:#c2f64a;font-size:14px;width:54px;text-align:right}.empty{color:#5c656f;padding:10px 0;font-size:14px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:620px){.two{grid-template-columns:1fr}}.heatrow{display:grid;grid-template-columns:240px 1fr;gap:16px;align-items:start}@media(max-width:620px){.heatrow{grid-template-columns:1fr;justify-items:center}}.heat{display:grid;grid-template-columns:repeat(20,1fr);width:240px;aspect-ratio:1/2;gap:1px;background:#0d0f12;border:1px solid #232932;border-radius:10px;overflow:hidden}.heat i{display:block}.cap{color:#5c656f;font-size:11px;text-align:center;margin-top:8px}.sl{color:#9aa3ad;font-size:13px;margin-top:13px;line-height:1.7}.sl b{color:#c2f64a;font-family:monospace}.hp{border:1px solid #232932;border-radius:14px;padding:15px 17px;margin-bottom:22px;background:#111419}.hp-live{border-color:#1d5e3f;background:linear-gradient(180deg,rgba(46,189,133,.09),#111419)}.hp-warn{border-color:#5e521d;background:linear-gradient(180deg,rgba(255,179,71,.09),#111419)}.hp-down{border-color:#6e2020;background:linear-gradient(180deg,rgba(255,98,88,.11),#111419)}.hp-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.hp-dot{width:10px;height:10px;border-radius:50%;background:#2ebd85;animation:hpp 1.8s infinite}.hp-down .hp-dot{background:#ff6258;animation:none}.hp-warn .hp-dot{background:#ffb347;animation:none}@keyframes hpp{0%,100%{box-shadow:0 0 0 0 rgba(46,189,133,.55)}50%{box-shadow:0 0 0 7px rgba(46,189,133,0)}}.hp-st{font-weight:800;font-size:15px;letter-spacing:.02em}.hp-up{margin-left:auto;color:#5c656f;font-size:11px;font-family:monospace}.hp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0 11px}@media(max-width:620px){.hp-grid{grid-template-columns:1fr}}.hp-ex{display:flex;align-items:center;gap:7px;font-size:13px;background:#0d0f12;border:1px solid #232932;border-radius:9px;padding:8px 11px}.hp-ex b{text-transform:capitalize}.hp-ex small{color:#5c656f;font-size:10px;margin-left:auto;font-family:monospace;text-align:right}.hp-edot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.hp-edot.on{background:#2ebd85}.hp-edot.off{background:#ff6258}.hp-edot.idle{background:#5c656f}.hp-meta{color:#9aa3ad;font-size:12.5px;font-family:monospace}.hp-meta i{color:#ffb347;font-style:normal}.hp-sub{color:#9aa3ad;font-size:13px;margin-top:8px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}.rt{display:flex;gap:14px;align-items:center;font-size:12px;font-family:monospace}.onln{color:#2ebd85;display:inline-flex;align-items:center;gap:6px}.od{width:8px;height:8px;border-radius:50%;background:#2ebd85;animation:hpp 1.8s infinite}.fresh{color:#5c656f}.card{position:relative;overflow:hidden}.kspark{position:absolute;left:0;right:0;bottom:0;width:100%;height:24px;opacity:.5}.kspark polyline{fill:none;stroke:#c2f64a;stroke-width:1.6;vector-effect:non-scaling-stroke}.dlt{font-size:10px;font-family:monospace;margin-left:6px}.dlt.up{color:#2ebd85}.dlt.dn{color:#ff6258}.card.rev .cv{color:#2ebd85}.goals{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}@media(max-width:620px){.goals{grid-template-columns:1fr}}.goal{background:#111419;border:1px solid #232932;border-radius:12px;padding:13px 15px}.goal-h{display:flex;justify-content:space-between;font-size:12px;color:#9aa3ad;margin-bottom:8px}.goal-h b{color:#e9e7df;font-family:monospace}.goal-h small{color:#5c656f}.goal-tr{height:8px;background:#1a1f27;border-radius:6px;overflow:hidden}.goal-f{height:100%;border-radius:6px;transition:width .4s}.funnel{background:#111419;border:1px solid #232932;border-radius:14px;padding:6px 16px}.fn-row{position:relative;display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #232932}.fn-row:last-child{border-bottom:none}.fn-bar{position:absolute;left:0;top:7px;bottom:7px;border-radius:6px;opacity:.2;z-index:0}.fn-lbl{position:relative;z-index:1;font-size:13px;flex:1}.fn-val{position:relative;z-index:1;font-family:monospace;color:#c2f64a;font-size:14px}.fn-val small{color:#5c656f;font-size:11px}.hourchart{display:flex;align-items:flex-end;gap:2px;height:120px;background:#111419;border:1px solid #232932;border-radius:14px;padding:12px 10px}.hcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px}.hbar{width:100%;background:linear-gradient(180deg,#c2f64a,#5f7d12);border-radius:3px 3px 0 0;min-height:2px}.hlbl{font-size:8px;color:#5c656f;font-family:monospace}.feed{background:#111419;border:1px solid #232932;border-radius:14px;padding:4px 16px}.fe{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid #232932;font-size:13px}.fe:last-child{border-bottom:none}.fe-f{font-size:16px}.fe-t{flex:1;color:#cdd3da}.fe-t b{color:#c2f64a}.fe-a{font-family:monospace;color:#5c656f;font-size:11px;white-space:nowrap}.csv{color:#9aa3ad;text-decoration:none;border:1px solid #232932;border-radius:7px;padding:4px 9px}.csv:hover{color:#c2f64a;border-color:#c2f64a}.geotree{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#111419;border:1px solid #232932;border-radius:14px;padding:16px}.gt{display:inline-flex;align-items:center;gap:5px;border:1px solid #2a313b;border-radius:10px;padding:7px 11px;line-height:1;color:#e9e7df}.gt b{font-family:monospace}.gt small{color:#9aa3ad;font-size:.62em}.rangebar{display:inline-flex;gap:4px;background:#0d0f12;border:1px solid #232932;border-radius:10px;padding:3px;margin-bottom:12px}.rbtn{font-size:12px;color:#9aa3ad;text-decoration:none;padding:6px 13px;border-radius:7px}.rbtn.on{background:#c2f64a;color:#0a0b0d;font-weight:700}@media(max-width:620px){body{padding:18px 12px 50px}h1{font-size:19px}.hourchart{gap:1px;height:100px}.fe{font-size:12px;gap:8px}.topbar{flex-direction:column;align-items:flex-start;gap:8px}}</style></head><body><h1>MarginPad — Live Stats</h1><div class="topbar"><div class="muted">Private · hashed IDs, no cookies, no raw IP · auto-refresh 60s</div><div class="rt"><span class="onln"><span class="od"></span>${online} online now</span><span class="fresh" id="fresh">updated just now</span><a class="csv" href="?key=${esc(url.searchParams.get('key') || '')}&amp;format=csv">⬇ CSV</a></div></div>${healthHtml}<div class="cards">${kcard(N(uvToday), 'Visitors today', spark(uvDays), dpc(uvToday, uvY))}${kcard(N(uvTotal), 'Total visitors')}${kcard(N(pvTotal), 'Page views', spark(pvDays), dpc(pvTod, pvY))}${kcard(N(affiliate), 'Affiliate clicks', spark(affDays), dpc(affTod, affY))}</div><div class="sl">${newT} new · ${retT} returning today · <b>${ppv.toFixed(1)}</b> pages / visitor · <b>${ctr.toFixed(1)}%</b> affiliate click rate · <b>${bounce.toFixed(0)}%</b> bounce</div><h2>Revenue &amp; goals <span>(estimated)</span></h2><div class="cards" style="grid-template-columns:1fr 1fr"><div class="card rev"><div class="cv">$${N(Math.round(revenue))}</div><div class="cl">Est. affiliate revenue (all-time)</div></div>${kcard('$' + N(Math.round(affTod * 0.45)), 'Est. revenue today')}</div><div class="goals">${goalRow('Visitors today', uvToday, 500, '#c2f64a')}${goalRow('Affiliate clicks today', affTod, 50, '#7fae12')}</div><h2>Conversion funnel</h2><div class="funnel">${funnel}</div><h2>Live activity <span>(most recent)</span></h2><div class="feed">${feed}</div><h2>Date range</h2>${rangeBar}<div class="cards">${card(N(uvR), 'Visitors')}${card(N(pvR), 'Page views')}${card(N(affR), 'Affiliate clicks')}${card('$' + N(Math.round(affR * 0.45)), 'Est. revenue')}</div><h2>Unique visitors — last 14 days</h2><div class="chart">${daychart}</div><div class="two"><div><h2>Devices</h2><div class="list">${barlist(devices)}</div></div><div><h2>Browsers</h2><div class="list">${barlist(browsers)}</div></div></div><div class="two"><div><h2>Traffic by hour <span>(UTC)</span></h2><div class="hourchart">${hrBars}</div></div><div><h2>Languages</h2><div class="list">${barlist(langs, l => langName[l] || l)}</div></div></div><h2>Where people click <span>(what they tap, most → least)</span></h2><div class="heatrow"><div><div class="heat">${hcells}</div><div class="cap">page heatmap · top = page top · brighter = more clicks</div></div><div><div class="list">${barlist(elsPretty)}</div></div></div><h2>Exchanges clicked <span>(clicks · est. $)</span></h2><div class="list">${exRevList}</div><div class="two"><div><h2>Tools clicked</h2><div class="list">${barlist(tools)}</div></div><div><h2>Calculators used</h2><div class="list">${barlist(tabs)}</div></div></div><div class="two"><div><h2>Paper Trade — symbols</h2><div class="list">${barlist(paperSym)}</div></div><div><h2>Paper Trade — leverage</h2><div class="list">${barlist(levO)}</div></div></div><div class="two"><div><h2>Scroll depth <span>(% reached)</span></h2><div class="list">${barlist(scrollO)}</div></div><div><h2>Time on page</h2><div class="list">${barlist(timeO)}</div></div></div><h2>Top pages <span>(unique visitors)</span></h2><div class="list">${barlist(pages)}</div><h2>Countries <span>(box size = share of visitors)</span></h2><div class="geotree">${geoTree}</div><h2>Traffic sources</h2><div class="list">${barlist(refD)}</div><h2>Blog comments <span>(engagement)</span></h2><div class="cards" style="margin-bottom:14px">${card(cmtTotal.toLocaleString('en-US'), 'Total comments')}</div>${cmtPosts.length ? '<div class="list">' + barlist(cmtPosts) + '</div>' : '<div class="empty" style="padding:0 0 4px">no comments yet</div>'}<h2>Telegram bot</h2><div class="cards" style="margin-bottom:14px">${card(botMsg.toLocaleString('en-US'), 'Bot messages')}${card(botUsers.toLocaleString('en-US'), 'Bot users')}</div>${botCmds.length ? '<div class="list">' + barlist(botCmds) + '</div>' : '<div class="empty" style="padding:0 0 4px">no bot activity yet</div>'}${other.length ? '<h2>Other events</h2><div class="list">' + barlist(other) + '</div>' : ''}<script>(function(){var t=Date.now();setInterval(function(){var s=Math.round((Date.now()-t)/1000),f=document.getElementById('fresh');if(f)f.textContent='updated '+(s<60?s+'s':Math.floor(s/60)+'m')+' ago';},1000);})();</script></body></html>`;
  try { await env.STATS.put('st:cache', html, { expirationTtl: 25 }); await env.STATS.put('st:cache:last', html, { expirationTtl: 86400 }); } catch (e) {}
  return htmlResp(html);
}

// ---------- telegram bot ----------
const DIV = '━━━━━━━━━━━';
const TG_HELP =
  '👋 <b>MarginPad</b>\n<i>Crypto futures calculators, right in your chat.</i>\n\n' +
  '<b>📋 Commands</b>\n' +
  '🔥 <code>/liq</code> entry leverage [long|short]\n' +
  '📊 <code>/pnl</code> entry exit size [lev] [long|short]\n' +
  '📏 <code>/size</code> balance risk% entry stop\n' +
  '⚖️ <code>/rr</code> entry stop takeprofit\n\n' +
  '<b>💲 Prices & alerts</b>\n' +
  '<code>/price</code> BTC — live price\n' +
  '<code>/alert</code> BTC 70000 — ping me when it hits\n' +
  '<code>/alerts</code> — your alerts\n\n' +
  '<b>🏆 Trade League — win USDT weekly</b>\n' +
  '<code>/trade</code> BTC long +320 — log a trade\n' +
  '<code>/leaderboard</code> — top 10 this week\n' +
  '<code>/me</code> — your rank\n\n' +
  '💡 <b>Try:</b> <code>/liq 60000 10 long</code>\n\n' +
  'Tap a button below 👇';
const TG_KB = {
  inline_keyboard: [
    [{ text: '🔥 Liquidation', callback_data: 'liq' }, { text: '📊 PnL / ROI', callback_data: 'pnl' }],
    [{ text: '📏 Position size', callback_data: 'size' }, { text: '⚖️ Risk / Reward', callback_data: 'rr' }],
    [{ text: '💲 Price & alerts', callback_data: 'price' }, { text: '🏆 Trade League', callback_data: 'lb' }],
    [{ text: '🌐 Open MarginPad.io', url: 'https://marginpad.io' }],
  ],
};
const TG_FORMATS = {
  liq: '🔥 <b>Liquidation price</b>\n\nSend:\n<code>/liq &lt;entry&gt; &lt;leverage&gt; [long|short]</code>\n\nExample:\n<code>/liq 60000 10 long</code>',
  pnl: '📊 <b>PnL / ROI</b>\n\nSend:\n<code>/pnl &lt;entry&gt; &lt;exit&gt; &lt;size&gt; [lev] [long|short]</code>\n\nExample:\n<code>/pnl 60000 66000 0.5 10 long</code>',
  size: '📏 <b>Position size</b>\n\nSend:\n<code>/size &lt;balance&gt; &lt;risk%&gt; &lt;entry&gt; &lt;stop&gt;</code>\n\nExample:\n<code>/size 5000 1 60000 58800</code>',
  rr: '⚖️ <b>Risk / Reward</b>\n\nSend:\n<code>/rr &lt;entry&gt; &lt;stop&gt; &lt;takeprofit&gt;</code>\n\nExample:\n<code>/rr 60000 58000 66000</code>',
  price: '💲 <b>Prices & alerts</b>\n\nLive price:\n<code>/price BTC</code>\n\nSet an alert:\n<code>/alert BTC 70000</code>\n<i>I\'ll message you the moment it hits.</i>\n\nYour alerts: <code>/alerts</code>',
};
const tgfmt = v => isFinite(v) ? (Math.abs(v) >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toLocaleString('en-US', { maximumFractionDigits: 6 })) : '—';

function tgCommand(text) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase().replace(/@.*$/, '');
  const n = i => parseFloat(parts[i]);
  try {
    if (cmd === '/liq') {
      const entry = n(1), lev = n(2); if (!isFinite(entry) || !isFinite(lev)) return TG_FORMATS.liq;
      const long = (parts[3] || 'long').toLowerCase() !== 'short';
      const mmr = (isFinite(n(4)) ? n(4) : 0.5) / 100;
      const liq = long ? entry * (1 - 1 / lev + mmr) : entry * (1 + 1 / lev - mmr);
      const dist = (liq - entry) / entry * 100;
      return `🔥 <b>Liquidation · ${long ? 'Long' : 'Short'} ${lev}×</b>\n${DIV}\nEntry      <code>$${tgfmt(entry)}</code>\n💥 Liq      <b>$${tgfmt(liq)}</b>\n📐 Distance <code>${dist.toFixed(2)}%</code>`;
    }
    if (cmd === '/pnl') {
      const entry = n(1), exit = n(2), size = n(3); if (!isFinite(entry) || !isFinite(exit) || !isFinite(size)) return TG_FORMATS.pnl;
      const lev = n(4); const long = (parts[5] || 'long').toLowerCase() !== 'short';
      const pnl = (long ? exit - entry : entry - exit) * size; const roi = (long ? exit - entry : entry - exit) / entry * 100;
      return `📊 <b>PnL · ${long ? 'Long' : 'Short'}</b>\n${DIV}\n${pnl >= 0 ? '🟢' : '🔴'} <b>${pnl >= 0 ? '+' : '−'}$${tgfmt(Math.abs(pnl))}</b>\n📈 ROI     <code>${roi.toFixed(2)}%</code>${isFinite(lev) && lev > 0 ? `\n⚡ ROE     <code>${(roi * lev).toFixed(2)}%</code>` : ''}`;
    }
    if (cmd === '/size') {
      const bal = n(1), risk = n(2) / 100, entry = n(3), stop = n(4); const dist = Math.abs(entry - stop);
      if (!isFinite(bal) || !isFinite(risk) || !isFinite(entry) || !isFinite(stop) || dist === 0) return TG_FORMATS.size;
      const amt = bal * risk, qty = amt / dist;
      return `📏 <b>Position size</b>\n${DIV}\n📦 Size     <b>${tgfmt(qty)} units</b>\n💵 Notional <code>$${tgfmt(qty * entry)}</code>\n🎯 Risk     <code>$${tgfmt(amt)}</code>`;
    }
    if (cmd === '/rr') {
      const entry = n(1), stop = n(2), tp = n(3); const rk = Math.abs(entry - stop), rw = Math.abs(tp - entry);
      if (!isFinite(entry) || !isFinite(stop) || !isFinite(tp) || rk === 0) return TG_FORMATS.rr;
      return `⚖️ <b>Risk / Reward</b>\n${DIV}\n🎲 Ratio    <b>${(rw / rk).toFixed(2)} : 1</b>\n🔻 Risk     <code>$${tgfmt(rk)}</code>\n🔺 Reward   <code>$${tgfmt(rw)}</code>\n✅ Break-even win rate  <code>${(rk / (rk + rw) * 100).toFixed(2)}%</code>`;
    }
    return null; // unknown → caller shows help
  } catch (e) { return null; }
}

async function tgApi(token, method, body) {
  try { await fetch('https://api.telegram.org/bot' + token + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch (e) {}
}
async function bumpBot(env, cmd, userId) {
  if (!env || !env.STATS) return;
  const inc = async k => { try { const cur = await env.STATS.getWithMetadata(k); const c = ((cur && cur.metadata && cur.metadata.c) || 0) + 1; await env.STATS.put(k, String(c), { metadata: { c } }); } catch (e) {} };
  await inc('bot:msg');
  if (cmd) await inc('bot:cmd:' + cmd.slice(0, 24));
  if (userId) { try { const seen = await env.STATS.get('bu:' + userId); if (!seen) { await env.STATS.put('bu:' + userId, '1'); await inc('bot:users'); } } catch (e) {} }
}
// ---- Trade League (weekly leaderboard, stored in KV) ----
function tlWeek() { return Math.floor(Date.now() / (7 * 864e5)); }
async function tradeLog(env, msg) {
  if (!env.STATS) return 'Trade League is temporarily unavailable.';
  const parts = msg.text.trim().split(/\s+/);
  if (parts.length < 4) return '🏆 <b>Log a trade</b>\n\nFormat:\n<code>/trade PAIR long|short RESULT</code>\n\nExamples:\n<code>/trade BTC long +320</code>\n<code>/trade ETH short -45</code>';
  const pair = parts[1].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const side = parts[2].toLowerCase();
  if (side !== 'long' && side !== 'short') return 'Direction must be <code>long</code> or <code>short</code>.\nExample: <code>/trade BTC long +320</code>';
  const res = parseFloat(parts[3].replace(/[,$%+]/g, ''));
  if (!isFinite(res)) return 'Result must be a number, e.g. <code>+320</code> or <code>-45</code>.';
  const uid = msg.from && msg.from.id; if (!uid) return 'ok';
  const key = 'tl:' + tlWeek() + ':' + uid;
  const cur = await env.STATS.getWithMetadata(key);
  const m = (cur && cur.metadata) || { n: 0, pnl: 0 };
  const now = Date.now();
  if (m.t && now - m.t < 15 * 60 * 1000) return '⏳ Easy — you can log another trade in a few minutes.';
  const uname = (msg.from.username ? '@' + msg.from.username : (msg.from.first_name || 'trader')).slice(0, 20);
  const nm = { n: (m.n || 0) + 1, pnl: Math.round(((m.pnl || 0) + res) * 100) / 100, u: uname, t: now };
  await env.STATS.put(key, String(nm.n), { metadata: nm });
  return `✅ Logged: <b>${pair} ${side}</b> ${res >= 0 ? '+' : ''}${res}\n${DIV}\nTrades this week: <b>${nm.n}</b>\nReported PnL: <b>${nm.pnl >= 0 ? '+' : ''}${nm.pnl}</b>\n\nSee the <code>/leaderboard</code> 🏆`;
}
async function leaderboard(env) {
  if (!env.STATS) return 'Leaderboard temporarily unavailable.';
  const list = await env.STATS.list({ prefix: 'tl:' + tlWeek() + ':', limit: 1000 });
  const rows = list.keys.map(k => k.metadata || {}).filter(m => m.n).sort((a, b) => (b.n - a.n) || (b.pnl - a.pnl)).slice(0, 10);
  if (!rows.length) return '🏆 <b>Trade League — this week</b>\n' + DIV + '\nNo trades yet. Be the first:\n<code>/trade BTC long +320</code>';
  const medal = ['🥇', '🥈', '🥉'];
  let out = '🏆 <b>Trade League — this week</b>\n' + DIV + '\n';
  rows.forEach((m, i) => { out += (medal[i] || (i + 1) + '.') + ' ' + m.u + ' — <b>' + m.n + '</b> trades (' + (m.pnl >= 0 ? '+' : '') + m.pnl + ')\n'; });
  out += '\n🎁 Top 10 each week win USDT. Log yours with <code>/trade</code>.';
  return out;
}
async function myStats(env, msg) {
  if (!env.STATS) return 'Temporarily unavailable.';
  const uid = msg.from && msg.from.id; if (!uid) return 'ok';
  const list = await env.STATS.list({ prefix: 'tl:' + tlWeek() + ':', limit: 1000 });
  const all = list.keys.map(k => ({ id: k.name.split(':').pop(), m: k.metadata || {} })).filter(x => x.m.n).sort((a, b) => b.m.n - a.m.n);
  const idx = all.findIndex(x => String(x.id) === String(uid));
  if (idx < 0) return '📊 You have no trades logged this week yet.\nLog one: <code>/trade BTC long +320</code>';
  const me = all[idx].m;
  return '📊 <b>Your week</b>\n' + DIV + '\n🏅 Rank: <b>#' + (idx + 1) + '</b> of ' + all.length + '\n📈 Trades: <b>' + me.n + '</b>\n💰 Reported PnL: <b>' + (me.pnl >= 0 ? '+' : '') + me.pnl + '</b>';
}
async function handleTelegram(request, env) {
  if (!env || !env.TELEGRAM_TOKEN) return new Response('ok');
  if (request.method !== 'POST') return new Response('ok');
  let update; try { update = await request.json(); } catch (e) { return new Response('ok'); }
  const token = env.TELEGRAM_TOKEN;
  const base = { parse_mode: 'HTML', disable_web_page_preview: true };

  if (update.callback_query) {
    const cq = update.callback_query;
    await bumpBot(env, 'btn-' + cq.data, cq.from && cq.from.id);
    await tgApi(token, 'answerCallbackQuery', { callback_query_id: cq.id });
    const cbText = cq.data === 'lb' ? await leaderboard(env) : (TG_FORMATS[cq.data] || TG_HELP);
    await tgApi(token, 'sendMessage', { chat_id: cq.message.chat.id, text: cbText, ...base });
    return new Response('ok');
  }
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return new Response('ok');
  const cmd = msg.text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  await bumpBot(env, cmd.replace(/^\//, '') || 'msg', msg.from && msg.from.id);
  if (cmd === '/start' || cmd === '/help') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: TG_HELP, ...base, reply_markup: TG_KB });
    return new Response('ok');
  }
  if (cmd === '/trade') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: await tradeLog(env, msg), ...base });
    return new Response('ok');
  }
  if (cmd === '/leaderboard' || cmd === '/lb') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: await leaderboard(env), ...base });
    return new Response('ok');
  }
  if (cmd === '/me') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: await myStats(env, msg), ...base });
    return new Response('ok');
  }
  if (cmd === '/price' || cmd === '/p') {
    const p = await fetchPrice(msg.text.split(/\s+/)[1]);
    const text = p ? `💲 <b>${p.sym}/USDT</b>\n${DIV}\nPrice  <b>$${tgfmt(p.price)}</b>\n24h    ${p.chg >= 0 ? '🟢 +' : '🔴 '}${(+p.chg).toFixed(2)}%` : '❓ Couldn\'t find that coin. Try <code>/price BTC</code>.';
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text, ...base });
    return new Response('ok');
  }
  if (cmd === '/alert') {
    const parts = msg.text.split(/\s+/);
    const target = parseFloat(String(parts[2] || '').replace(/[,$]/g, ''));
    if (!parts[1] || !isFinite(target) || target <= 0) {
      await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '🔔 <b>Price alert</b>\nSend: <code>/alert BTC 70000</code>\nI\'ll message you when BTC reaches that price.', ...base });
      return new Response('ok');
    }
    const p = await fetchPrice(parts[1]);
    if (!p) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '❓ Couldn\'t find that coin.', ...base }); return new Response('ok'); }
    let cnt = 0; try { const l = await env.STATS.list({ prefix: 'al:' + msg.chat.id + ':' }); cnt = l.keys.length; } catch (e) {}
    if (cnt >= 20) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '⚠️ You already have 20 alerts. See /alerts.', ...base }); return new Response('ok'); }
    const dir = target >= p.price ? 'up' : 'down';
    const id = Date.now() + '' + Math.floor(Math.random() * 1e4);
    try { await env.STATS.put('al:' + msg.chat.id + ':' + id, JSON.stringify({ sym: p.sym, target, dir, chat: msg.chat.id })); await env.STATS.put('al:on', '1', { expirationTtl: 7776000 }); } catch (e) {}
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: `🔔 Alert set! I'll ping you when <b>${p.sym}</b> goes ${dir === 'up' ? '≥' : '≤'} <b>$${tgfmt(target)}</b>.\n<i>(now $${tgfmt(p.price)})</i>`, ...base });
    return new Response('ok');
  }
  if (cmd === '/alerts') {
    const items = [];
    try { const l = await env.STATS.list({ prefix: 'al:' + msg.chat.id + ':' }); for (const k of l.keys) { const a = JSON.parse(await env.STATS.get(k.name)); if (a) items.push(a); } } catch (e) {}
    const text = items.length ? '🔔 <b>Your alerts</b>\n' + DIV + '\n' + items.map(a => `${a.sym} ${a.dir === 'up' ? '≥' : '≤'} $${tgfmt(a.target)}`).join('\n') + '\n\nClear all: /clearalerts' : 'No alerts yet. Set one: <code>/alert BTC 70000</code>';
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text, ...base });
    return new Response('ok');
  }
  if (cmd === '/clearalerts') {
    let n = 0; try { const l = await env.STATS.list({ prefix: 'al:' + msg.chat.id + ':' }); for (const k of l.keys) { await env.STATS.delete(k.name); n++; } } catch (e) {}
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '🗑 Cleared ' + n + ' alert(s).', ...base });
    return new Response('ok');
  }
  const reply = tgCommand(msg.text);
  if (reply === null) {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '🤔 Not sure what that is.\n\n' + TG_HELP, ...base, reply_markup: TG_KB });
  } else {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: reply, ...base });
  }
  return new Response('ok');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/api/prices') return handlePrices();
    if (url.pathname === '/api/price') { const p = await fetchPrice(url.searchParams.get('symbol')); return J(p || { error: 'not found' }, p ? 200 : 404); }
    if (url.pathname === '/api/klines') return handleKlines(url);
    if (url.pathname.startsWith('/api/v1/')) return handleCollectorProxy(url, request, env);
    if (url.pathname === '/api/track') return handleTrack(url, request, env);
    if (url.pathname === '/api/stats/reset' && url.searchParams.get('key') === STATS_KEY) return handleStatsReset(env);
    if (url.pathname === '/api/stats') return handleStats(url, env);
    if (url.pathname === '/api/comments') return handleComments(url, request, env);
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/') return handleApi(url);
    if (url.pathname === '/telegram/webhook') return handleTelegram(request, env);
    if (url.pathname === '/chat/reset' && url.searchParams.get('key') === STATS_KEY) {
      if (!env.CHAT) return new Response('na', { status: 503 });
      return env.CHAT.get(env.CHAT.idFromName('global')).fetch(new Request('https://do/reset'));
    }
    if (url.pathname === '/chat/ws') {
      if (!env.CHAT) return new Response('chat unavailable', { status: 503 });
      return env.CHAT.get(env.CHAT.idFromName('global')).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAlerts(env));
  },
};

// ---------- live chat (Durable Object + WebSocket hibernation) ----------
export class ChatRoom {
  constructor(state, env) { this.state = state; }
  broadcast(obj) {
    const out = JSON.stringify(obj);
    for (const s of this.state.getWebSockets()) { try { s.send(out); } catch (e) {} }
  }
  async fetch(request) {
    if (new URL(request.url).pathname.endsWith('/reset')) { await this.state.storage.put('hist', []); return new Response('cleared'); }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server);
    const hist = (await this.state.storage.get('hist')) || [];
    try { server.send(JSON.stringify({ type: 'history', messages: hist, online: this.state.getWebSockets().length })); } catch (e) {}
    this.broadcast({ type: 'presence', online: this.state.getWebSockets().length });
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, message) {
    let m; try { m = JSON.parse(message); } catch (e) { return; }
    if (!m || m.type !== 'msg') return;
    const text = String(m.t || '').replace(/\s+/g, ' ').trim().slice(0, 280);
    const user = String(m.u || 'anon').replace(/[<>&]/g, '').trim().slice(0, 20) || 'anon';
    if (!text) return;
    const now = Date.now();
    let last = 0; try { last = ws.deserializeAttachment() || 0; } catch (e) {}
    if (now - last < 1200) return; // 1 message / 1.2s per connection
    try { ws.serializeAttachment(now); } catch (e) {}
    const msg = { u: user, t: text, ts: now };
    let hist = (await this.state.storage.get('hist')) || [];
    hist.push(msg); if (hist.length > 60) hist = hist.slice(-60);
    await this.state.storage.put('hist', hist);
    this.broadcast({ type: 'msg', message: msg, online: this.state.getWebSockets().length });
  }
  async webSocketClose(ws, code, reason) {
    try { ws.close(code, reason); } catch (e) {}
    this.broadcast({ type: 'presence', online: this.state.getWebSockets().length });
  }
  async webSocketError(ws) { try { ws.close(); } catch (e) {} }
}
