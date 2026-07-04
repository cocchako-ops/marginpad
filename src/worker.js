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
// market screener: a curated set of top USDT markets with 24h move + best-effort funding (edge-cached 30s)
// ---------- screener technical analysis (operates on close/high/low/volume arrays from 4h candles) ----------
function _smaLast(c, p) { if (c.length < p) return null; let s = 0; for (let i = c.length - p; i < c.length; i++) s += c[i]; return s / p; }
function _emaSeries(c, p) { const k = 2 / (p + 1), o = [c[0]]; for (let i = 1; i < c.length; i++) o.push(c[i] * k + o[i - 1] * (1 - k)); return o; }
function _rsi(c, p) { if (c.length <= p) return null; let g = 0, l = 0; for (let i = 1; i <= p; i++) { const d = c[i] - c[i - 1]; if (d >= 0) g += d; else l -= d; } g /= p; l /= p; for (let i = p + 1; i < c.length; i++) { const d = c[i] - c[i - 1]; g = (g * (p - 1) + (d > 0 ? d : 0)) / p; l = (l * (p - 1) + (d < 0 ? -d : 0)) / p; } return 100 - 100 / (1 + (l === 0 ? 100 : g / l)); }
function _macd(c) { if (c.length < 35) return null; const f = _emaSeries(c, 12), s = _emaSeries(c, 26), ml = c.map((_, i) => f[i] - s[i]), sig = _emaSeries(ml, 9), n = c.length - 1; return { hist: ml[n] - sig[n], prevHist: ml[n - 1] - sig[n - 1] }; }
function _atr(h, l, c, p) { if (c.length <= p) return null; const tr = []; for (let i = 0; i < c.length; i++) tr.push(i === 0 ? h[i] - l[i] : Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))); let a = 0; for (let i = 0; i < p; i++) a += tr[i]; a /= p; for (let i = p; i < tr.length; i++) a = (a * (p - 1) + tr[i]) / p; return a; }
function _verdict(s) { return s >= 90 ? 'Extremely Bullish' : s >= 75 ? 'Bullish' : s >= 60 ? 'Neutral Bullish' : s >= 40 ? 'Neutral' : s >= 25 ? 'Neutral Bearish' : s >= 10 ? 'Bearish' : 'Extremely Bearish'; }
function _screenScore(d) {
  const c = d.closes, n = c.length, price = d.price;
  const sma50 = _smaLast(c, 50), sma200 = _smaLast(c, 200), rsi = _rsi(c, 14), macd = _macd(c), atr = _atr(d.highs, d.lows, c, 14);
  const recHigh = Math.max.apply(null, d.highs.slice(-31, -1)), recLow = Math.min.apply(null, d.lows.slice(-31, -1));
  const volMA = d.vols.length >= 20 ? d.vols.slice(-20).reduce((a, b) => a + b, 0) / 20 : null, curVol = d.vols[n - 1];
  let score = 50; const sig = [];
  if (sma200 != null) { if (price > sma200) { score += 10; sig.push('Above 200MA'); } else { score -= 10; sig.push('Below 200MA'); } }
  if (sma50 != null && sma200 != null) { if (sma50 > sma200) { score += 12; sig.push('Golden cross (50>200)'); } else { score -= 12; sig.push('Death cross (50<200)'); } }
  if (rsi != null) { if (rsi < 30) { score += 8; sig.push('RSI oversold ' + rsi.toFixed(0)); } else if (rsi > 70) { score -= 8; sig.push('RSI overbought ' + rsi.toFixed(0)); } }
  if (macd) { if (macd.hist > 0) { score += macd.hist > macd.prevHist ? 10 : 5; sig.push('MACD bullish'); } else { score -= macd.hist < macd.prevHist ? 10 : 5; sig.push('MACD bearish'); } }
  if (isFinite(recHigh) && price > recHigh) { score += 10; sig.push('Breakout above range'); }
  else if (isFinite(recLow) && price <= recLow * 1.015) { score += 6; sig.push('At support'); }
  if (d.funding < 0) { score += 6; sig.push('Negative funding'); } else if (d.funding > 0.05) { score -= 6; sig.push('High positive funding'); }
  if (volMA && curVol > volMA * 1.5) { if (d.chg >= 0) { score += 8; sig.push('Volume spike (up)'); } else { score -= 8; sig.push('Volume spike (down)'); } }
  if (d.chg > 3) score += 4; else if (d.chg < -3) score -= 4;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const trend = (sma50 != null && sma200 != null) ? (sma50 > sma200 && price > sma50 ? 'up' : sma50 < sma200 && price < sma50 ? 'down' : 'side') : 'side';
  let setup = null;
  if (atr && (score >= 62 || score <= 38)) {
    const long = score >= 50, dir = long ? 1 : -1;
    const stopPct = atr / price, mmr = 0.005;                                     // stop is 1×ATR from entry
    const conv = Math.round(50 + (Math.abs(score - 50) - 12) / 38 * 50);          // conviction-scaled wish (50–100)
    // CRITICAL: leverage must be sized to the stop, NOT fixed high — otherwise liquidation hits BEFORE the stop-loss.
    // (a) keep loss-at-stop ≈ 50% of margin, (b) hard-guard the stop inside the liquidation price (stopPct < 1/lev − mmr).
    const maxByRisk = Math.floor(0.5 / stopPct);
    const maxByLiq = Math.floor(1 / (stopPct * 1.25 + mmr));
    const lev = Math.max(3, Math.min(conv, maxByRisk, maxByLiq));
    const slLossPct = +Math.min(1, stopPct * lev).toFixed(2);                     // fraction of margin lost if the stop triggers
    setup = { dir: long ? 'long' : 'short', entry: price, sl: price - dir * atr, tp1: price + dir * 1.5 * atr, tp2: price + dir * 3 * atr, tp3: price + dir * 4.5 * atr, rrr: 1.5, lev, levAgg: lev, slLossPct };
  }
  return { score, trend, rsi: rsi != null ? Math.round(rsi) : null, macd: macd ? (macd.hist > 0 ? 'bull' : 'bear') : null, sig: sig.slice(0, 6), setup, atrPct: atr ? +(atr / price * 100).toFixed(2) : null };
}
// Aggregate Coinglass `pairs-markets` for one coin across all USDT-perp exchanges → compact derivatives snapshot.
async function cgCoinAgg(sym, env) {
  const H = { headers: { 'CG-API-KEY': env.COINGLASS_API_KEY } };
  try {
    const [pmR, lsR] = await Promise.all([
      fetch('https://open-api-v4.coinglass.com/api/futures/pairs-markets?symbol=' + sym, H).then(r => r.json()).catch(() => null),
      // real trader positioning (% of accounts long vs short) — varies per coin, unlike taker volume which is ~50/50
      fetch('https://open-api-v4.coinglass.com/api/futures/global-long-short-account-ratio/history?exchange=Binance&symbol=' + sym + 'USDT&interval=4h&limit=1', H).then(r => r.json()).catch(() => null),
    ]);
    let longPct = null, shortPct = null;
    if (lsR && lsR.code == 0 && Array.isArray(lsR.data) && lsR.data[0]) {
      const lp = +lsR.data[0].global_account_long_percent, sp = +lsR.data[0].global_account_short_percent;
      if (isFinite(lp) && isFinite(sp) && (lp + sp) > 0) { longPct = +lp.toFixed(1); shortPct = +sp.toFixed(1); }
    }
    if (pmR && pmR.code == 0 && Array.isArray(pmR.data) && pmR.data.length) {
      const usdt = pmR.data.filter(x => /USDT/i.test(x.instrument_id || x.symbol || ''));
      const rows = usdt.length ? usdt : pmR.data;
      let oi = 0, longLiq = 0, shortLiq = 0, vol = 0, top = null, topOi = -1;
      for (const x of rows) {
        const o = +x.open_interest_usd || 0;
        oi += o; longLiq += +x.long_liquidation_usd_24h || 0; shortLiq += +x.short_liquidation_usd_24h || 0;
        vol += +x.volume_usd || 0;
        if (o > topOi) { topOi = o; top = x; } // funding/price taken from the deepest (most representative) market
      }
      return { symbol: sym, price: top ? +top.current_price : null, chg24h: top ? +top.price_change_percent_24h : null,
        oiUsd: oi, oiChg24h: top ? +top.open_interest_change_percent_24h : null, funding: top ? +top.funding_rate : null,
        longLiq24h: longLiq, shortLiq24h: shortLiq, vol24h: vol, longPct, shortPct };
    }
  } catch (e) {}
  return null;
}
// Real derivatives data for one coin (key stays server-side; edge-cached 60s so one call serves unlimited users).
async function handleCgCoin(url, env) {
  const sym = String(url.searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const jr = (o, s = 200, cc = 'no-store') => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  if (!sym) return jr({ error: 'no_symbol' }, 400);
  if (!env.COINGLASS_API_KEY) return jr({ error: 'not_configured' }, 503);
  const ck = new Request('https://marginpad.io/__cg2_' + sym);
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const data = await cgCoinAgg(sym, env);
  const out = data || { symbol: sym, error: 'no_data' };
  const resp = jr(out, 200, out.error ? 'no-store' : 'public, max-age=60');
  if (!out.error) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Derivatives board: a basket of major coins with funding / long-short tilt / OI — homepage content. Edge-cached 5 min.
// ---------- Crypto news (CryptoCompare, free public) + Fear & Greed (alternative.me, free) ----------
function _rssPick(block, tag) { const m = block.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>', 'i')); let v = m ? m[1] : ''; const c = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/); return (c ? c[1] : v).trim(); }
function _xmlDec(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&apos;/g, "'").replace(/&amp;/g, '&'); }
async function handleNews(env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  const ck = new Request('https://marginpad.io/__news2');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const out = { ts: Date.now(), items: [] };
  const feeds = [['Cointelegraph', 'https://cointelegraph.com/rss'], ['CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'], ['Decrypt', 'https://decrypt.co/feed']];
  try {
    const xmls = await Promise.all(feeds.map(async f => { try { const r = await fetch(f[1], { headers: { accept: 'application/rss+xml, application/xml, text/xml', 'user-agent': 'Mozilla/5.0 MarginPad' }, cf: { cacheTtl: 240 } }); return r.ok ? await r.text() : ''; } catch (e) { return ''; } }));
    const items = [];
    for (let fi = 0; fi < xmls.length; fi++) {
      const xml = xmls[fi], src = feeds[fi][0]; const re = /<item[\s\S]*?<\/item>/gi; let m, n = 0;
      while ((m = re.exec(xml)) && n < 25) { n++; const block = m[0];
        const title = _xmlDec(_rssPick(block, 'title'));
        const link = _xmlDec(_rssPick(block, 'link') || _rssPick(block, 'guid'));
        const pub = _rssPick(block, 'pubDate'); const img = (block.match(/<media:content[^>]*url="([^"]+)"/i) || block.match(/<media:thumbnail[^>]*url="([^"]+)"/i) || block.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || '';
        const desc = _xmlDec(_rssPick(block, 'description')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 170);
        if (title && /^https?:/.test(link)) items.push({ title, url: link, src, img, ts: pub ? (Date.parse(pub) || 0) : 0, body: desc });
      }
    }
    items.sort((a, b) => b.ts - a.ts);
    out.items = items.slice(0, 45);
  } catch (e) {}
  const resp = jr(out, out.items.length ? 'public, max-age=300' : 'no-store');
  if (out.items.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
async function handleFng(env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  const ck = new Request('https://marginpad.io/__fng1');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const out = { data: [] };
  try {
    const r = await fetch('https://api.alternative.me/fng/?limit=60&format=json', { headers: { accept: 'application/json' }, cf: { cacheTtl: 1800 } });
    if (r.ok) { const j = await r.json(); out.data = ((j && j.data) || []).map(d => ({ v: +d.value, c: d.value_classification, ts: (+d.timestamp) * 1000 })); }
  } catch (e) {}
  const resp = jr(out, out.data.length ? 'public, max-age=1800' : 'no-store');
  if (out.data.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
async function handleCgBoard(url, env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  if (!env.COINGLASS_API_KEY) return jr({ error: 'not_configured' }, 'no-store');
  const ck = new Request('https://marginpad.io/__cg_board2');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK'];
  let coins = [];
  try { coins = (await Promise.all(SYMS.map(s => cgCoinAgg(s, env)))).filter(Boolean); } catch (e) {}
  const out = { ts: Date.now(), coins };
  const resp = jr(out, coins.length ? 'public, max-age=300' : 'no-store');
  if (coins.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Full liquidations breakdown for the /liquidations page: market totals + top coins (24h long/short). Edge-cached 5 min.
async function handleCgLiquidations(url, env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  if (!env.COINGLASS_API_KEY) return jr({ error: 'not_configured' }, 'no-store');
  const ck = new Request('https://marginpad.io/__cg_liq');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const out = { ts: Date.now() };
  try {
    const r = await fetch('https://open-api-v4.coinglass.com/api/futures/liquidation/coin-list', { headers: { 'CG-API-KEY': env.COINGLASS_API_KEY } });
    const j = await r.json();
    if (j && j.code == 0 && Array.isArray(j.data)) {
      const coins = j.data.map(x => ({ s: x.symbol, liq: +x.liquidation_usd_24h || 0, long: +x.long_liquidation_usd_24h || 0, short: +x.short_liquidation_usd_24h || 0 })).filter(c => c.liq > 0);
      let L = 0, S = 0; coins.forEach(c => { L += c.long; S += c.short; });
      coins.sort((a, b) => b.liq - a.liq);
      out.market = { long: L, short: S, total: L + S, count: coins.length };
      out.coins = coins.slice(0, 30);
    } else { out.error = 'no_data'; }
  } catch (e) { out.error = 'fetch_failed'; }
  const resp = jr(out, out.error ? 'no-store' : 'public, max-age=300');
  if (!out.error) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Funding scanner for the /funding page: funding rate + price + OI for a basket, sorted by extreme. Edge-cached 5 min.
async function handleCgFunding(url, env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  const ck = new Request('https://marginpad.io/__cg_funding_v2');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK', 'AVAX', 'LTC', 'DOT', 'TRX', 'NEAR', 'UNI', 'APT', 'ARB', 'OP', 'SUI', 'INJ', 'TIA'];
  const H = { headers: { 'CG-API-KEY': env.COINGLASS_API_KEY } };
  async function one(sym) {
    try {
      const r = await fetch('https://open-api-v4.coinglass.com/api/futures/pairs-markets?symbol=' + sym, H);
      const j = await r.json();
      if (j && j.code == 0 && Array.isArray(j.data) && j.data.length) {
        const usdt = j.data.filter(x => /USDT/i.test(x.instrument_id || x.symbol || ''));
        const rows = usdt.length ? usdt : j.data;
        let top = null, topOi = -1, oi = 0;
        for (const x of rows) { const o = +x.open_interest_usd || 0; oi += o; if (o > topOi) { topOi = o; top = x; } }
        if (top && isFinite(+top.funding_rate)) return { s: sym, funding: +top.funding_rate, price: +top.current_price, chg24h: +top.price_change_percent_24h, oiUsd: oi };
      }
    } catch (e) {}
    return null;
  }
  let agg = [];
  if (env.COINGLASS_API_KEY) { try { agg = (await Promise.all(SYMS.map(one))).filter(Boolean); } catch (e) {} }
  agg.forEach(c => { c.agg = true; });
  const have = {}; agg.forEach(c => { have[c.s] = 1; });
  let coins = agg.slice();
  try { // free breadth: every Bybit USDT-perp's funding + OI in one call (Coinglass covers only the ~20 majors on this plan)
    const br = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', { cf: { cacheTtl: 300 } });
    const bj = await br.json();
    ((bj && bj.result && bj.result.list) || []).forEach(t => {
      if (!/USDT$/.test(t.symbol)) return; const s = t.symbol.replace(/USDT$/, ''); if (have[s]) return;
      const oi = +t.openInterestValue || 0, vol = +t.turnover24h || 0; if (oi < 2e6 && vol < 5e6) return;
      have[s] = 1; coins.push({ s, funding: (+t.fundingRate || 0) * 100, price: +t.lastPrice, chg24h: (+t.price24hPcnt || 0) * 100, oiUsd: oi, agg: false });
    });
  } catch (e) {}
  coins.sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding));
  coins = coins.slice(0, 160);
  const out = { ts: Date.now(), coins };
  const resp = jr(out, coins.length ? 'public, max-age=300' : 'no-store');
  if (coins.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Long/short account-ratio scanner for the /long-short page (crowd positioning per coin). Edge-cached 5 min.
async function handleCgLongShort(url, env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  if (!env.COINGLASS_API_KEY) return jr({ error: 'not_configured' }, 'no-store');
  const ck = new Request('https://marginpad.io/__cg_ls');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK', 'AVAX', 'LTC', 'DOT', 'TRX', 'NEAR', 'UNI', 'APT', 'ARB', 'OP', 'SUI', 'INJ', 'TIA'];
  const H = { headers: { 'CG-API-KEY': env.COINGLASS_API_KEY } };
  async function one(sym) {
    try {
      const r = await fetch('https://open-api-v4.coinglass.com/api/futures/global-long-short-account-ratio/history?exchange=Binance&symbol=' + sym + 'USDT&interval=4h&limit=1', H);
      const j = await r.json();
      if (j && j.code == 0 && Array.isArray(j.data) && j.data[0]) {
        const lp = +j.data[0].global_account_long_percent, sp = +j.data[0].global_account_short_percent;
        if (isFinite(lp) && isFinite(sp) && (lp + sp) > 0) return { s: sym, longPct: +lp.toFixed(1), shortPct: +sp.toFixed(1) };
      }
    } catch (e) {}
    return null;
  }
  let coins = [];
  try { coins = (await Promise.all(SYMS.map(one))).filter(Boolean); } catch (e) {}
  coins.sort((a, b) => b.longPct - a.longPct);
  const out = { ts: Date.now(), coins };
  const resp = jr(out, coins.length ? 'public, max-age=300' : 'no-store');
  if (coins.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Open-interest scanner for the /open-interest page: OI + 24h OI change per coin, sorted by OI. Edge-cached 5 min.
async function handleCgOpenInterest(url, env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  const ck = new Request('https://marginpad.io/__cg_oi');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'LINK', 'AVAX', 'LTC', 'DOT', 'TRX', 'NEAR', 'UNI', 'APT', 'ARB', 'OP', 'SUI', 'INJ', 'TIA'];
  const H = { headers: { 'CG-API-KEY': env.COINGLASS_API_KEY } };
  async function one(sym) {
    try {
      const r = await fetch('https://open-api-v4.coinglass.com/api/futures/pairs-markets?symbol=' + sym, H);
      const j = await r.json();
      if (j && j.code == 0 && Array.isArray(j.data) && j.data.length) {
        const usdt = j.data.filter(x => /USDT/i.test(x.instrument_id || x.symbol || ''));
        const rows = usdt.length ? usdt : j.data;
        let oi = 0, top = null, topOi = -1;
        for (const x of rows) { const o = +x.open_interest_usd || 0; oi += o; if (o > topOi) { topOi = o; top = x; } }
        if (top && oi > 0) return { s: sym, oiUsd: oi, oiChg24h: +top.open_interest_change_percent_24h, price: +top.current_price, chg24h: +top.price_change_percent_24h };
      }
    } catch (e) {}
    return null;
  }
  let agg = [];
  if (env.COINGLASS_API_KEY) { try { agg = (await Promise.all(SYMS.map(one))).filter(Boolean); } catch (e) {} }
  agg.forEach(c => { c.agg = true; });
  const have = {}; agg.forEach(c => { have[c.s] = 1; });
  let coins = agg.slice();
  try { // free breadth: every Bybit USDT-perp's open interest in one call
    const br = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', { cf: { cacheTtl: 300 } });
    const bj = await br.json();
    ((bj && bj.result && bj.result.list) || []).forEach(t => {
      if (!/USDT$/.test(t.symbol)) return; const s = t.symbol.replace(/USDT$/, ''); if (have[s]) return;
      const oi = +t.openInterestValue || 0, vol = +t.turnover24h || 0; if (oi < 2e6 && vol < 5e6) return;
      have[s] = 1; coins.push({ s, oiUsd: oi, oiChg24h: null, price: +t.lastPrice, chg24h: (+t.price24hPcnt || 0) * 100, agg: false });
    });
  } catch (e) {}
  coins.sort((a, b) => b.oiUsd - a.oiUsd);
  coins = coins.slice(0, 160);
  const out = { ts: Date.now(), coins };
  const resp = jr(out, coins.length ? 'public, max-age=300' : 'no-store');
  if (coins.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Market Pulse: market-wide 24h liquidations (long/short) + Fear & Greed + most-liquidated coins. Edge-cached 5 min.
async function handleCgPulse(url, env) {
  const jr = (o, cc) => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  if (!env.COINGLASS_API_KEY) return jr({ error: 'not_configured' }, 'no-store');
  const ck = new Request('https://marginpad.io/__cg_pulse2');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  const H = { headers: { 'CG-API-KEY': env.COINGLASS_API_KEY } };
  const out = { ts: Date.now() };
  try {
    const [liqR, fgR] = await Promise.all([
      fetch('https://open-api-v4.coinglass.com/api/futures/liquidation/coin-list', H).then(r => r.json()).catch(() => null),
      fetch('https://open-api-v4.coinglass.com/api/index/fear-greed-history?limit=2', H).then(r => r.json()).catch(() => null),
    ]);
    if (liqR && liqR.code == 0 && Array.isArray(liqR.data)) {
      const coins = liqR.data.map(x => ({ s: x.symbol, liq: +x.liquidation_usd_24h || 0, long: +x.long_liquidation_usd_24h || 0, short: +x.short_liquidation_usd_24h || 0 }));
      let L = 0, S = 0; coins.forEach(c => { L += c.long; S += c.short; });
      coins.sort((a, b) => b.liq - a.liq);
      out.liq24h = { total: L + S, long: L, short: S };
      out.topLiq = coins.slice(0, 6);
    }
    if (fgR && fgR.code == 0 && fgR.data && Array.isArray(fgR.data.data_list) && fgR.data.data_list.length) {
      const dl = fgR.data.data_list, v = +dl[dl.length - 1], prev = dl.length > 1 ? +dl[dl.length - 2] : null;
      out.fearGreed = { value: v, prev: (prev != null && isFinite(prev)) ? prev : null, label: v <= 24 ? 'Extreme Fear' : v <= 44 ? 'Fear' : v <= 55 ? 'Neutral' : v <= 75 ? 'Greed' : 'Extreme Greed' };
    }
  } catch (e) { out.error = 'fetch_failed'; }
  const resp = jr(out, out.error ? 'no-store' : 'public, max-age=300');
  if (!out.error) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Big tradable-symbol list for the symbol pickers / dropdowns — every Bybit USDT-perp by 24h volume (~500). Edge-cached 10 min.
async function handleSymbols() {
  const ck = new Request('https://marginpad.io/__symbols');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  let syms = [];
  try {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear', { cf: { cacheTtl: 600 } });
    const j = await r.json();
    syms = ((j && j.result && j.result.list) || [])
      .filter(t => /USDT$/.test(t.symbol) && (+t.turnover24h || 0) > 0)
      .sort((a, b) => (+b.turnover24h || 0) - (+a.turnover24h || 0))
      .map(t => t.symbol.replace(/USDT$/, ''))
      .slice(0, 500);
  } catch (e) {}
  const out = { ts: Date.now(), symbols: syms };
  const resp = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': syms.length ? 'public, max-age=600' : 'no-store', ...CORS } });
  if (syms.length) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// CoinGecko proxies (demo key bypasses the worker-IP block) — cached server-side so the homepage/coins don't hit per-user CG rate limits.
async function handleGeckoMarkets(url, env) {
  const cat = (url.searchParams.get('cat') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
  const ck = new Request('https://marginpad.io/__gecko_markets_' + (cat || 'all'));
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  let data = null;
  try {
    const h = { headers: { accept: 'application/json' } };
    if (env.COINGECKO_API_KEY) h.headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=' + (cat ? 100 : 250) + '&page=1&sparkline=true&price_change_percentage=1h,24h,7d' + (cat ? '&category=' + cat : ''), h);
    if (r.ok) data = await r.json();
  } catch (e) {}
  const ok = Array.isArray(data) && data.length;
  const resp = new Response(JSON.stringify(ok ? data : { error: 'unavailable' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': ok ? 'public, max-age=120' : 'no-store', ...CORS } });
  if (ok) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// One coin's CoinGecko market data (market cap, volume, ATH/ATL, supply, multi-window change, sparkline). Symbol-keyed; takes the highest-mcap match. Cached 2 min.
async function handleGeckoCoin(url, env) {
  const sym = String(url.searchParams.get('sym') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16);
  if (!sym) return new Response(JSON.stringify({ error: 'no_symbol' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  const ck = new Request('https://marginpad.io/__gecko_coin_' + sym);
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  let out = null;
  try {
    const h = { headers: { accept: 'application/json' } };
    if (env.COINGECKO_API_KEY) h.headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
    const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&symbols=' + sym + '&sparkline=true&price_change_percentage=1h,24h,7d,30d', h);
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j) && j.length) {
        const c = j.sort((a, b) => (+b.market_cap || 0) - (+a.market_cap || 0))[0];
        out = {
          sym: String(c.symbol || '').toUpperCase(), name: c.name, img: c.image, price: c.current_price,
          rank: c.market_cap_rank, mcap: c.market_cap, vol: c.total_volume,
          ath: c.ath, athChg: c.ath_change_percentage, athDate: c.ath_date, atl: c.atl, atlChg: c.atl_change_percentage,
          circ: c.circulating_supply, total: c.total_supply, max: c.max_supply,
          ch1h: c.price_change_percentage_1h_in_currency, ch24h: c.price_change_percentage_24h_in_currency,
          ch7d: c.price_change_percentage_7d_in_currency, ch30d: c.price_change_percentage_30d_in_currency,
          spark: (c.sparkline_in_7d && c.sparkline_in_7d.price) || null
        };
      }
    }
  } catch (e) {}
  const resp = new Response(JSON.stringify(out || { error: 'unavailable' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': out ? 'public, max-age=120' : 'no-store', ...CORS } });
  if (out) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}

// DefiLlama overview — total DeFi TVL, top chains, top protocols, stablecoin supply. Free, no key. Edge-cached 10 min.
async function handleDefiOverview(env) {
  const ck = new Request('https://marginpad.io/__defi_overview');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  let out = null;
  try {
    const h = { headers: { accept: 'application/json' } };
    const [cR, pR, sR] = await Promise.all([ // per-fetch .catch so one dead endpoint degrades gracefully instead of rejecting all three
      fetch('https://api.llama.fi/v2/chains', h).catch(() => null),
      fetch('https://api.llama.fi/protocols', h).catch(() => null),
      fetch('https://stablecoins.llama.fi/stablecoins?includePrices=false', h).catch(() => null)
    ]);
    const chainsRaw = cR && cR.ok ? await cR.json() : [];
    const protosRaw = pR && pR.ok ? await pR.json() : [];
    const stableRaw = sR && sR.ok ? await sR.json() : null;
    const chains = (Array.isArray(chainsRaw) ? chainsRaw : [])
      .filter(c => +c.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl);
    const totalTvl = chains.reduce((s, c) => s + (+c.tvl || 0), 0);
    const topChains = chains.slice(0, 12).map(c => ({ name: c.name, tvl: +c.tvl, sym: c.tokenSymbol || null }));
    // protocols: drop CEX / chain-aggregate buckets, keep real DeFi protocols
    const SKIP = { CEX: 1, 'Chain': 1 };
    const protos = (Array.isArray(protosRaw) ? protosRaw : [])
      .filter(p => +p.tvl > 0 && !SKIP[p.category])
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 12)
      .map(p => ({ name: p.name, tvl: +p.tvl, cat: p.category || '', chain: p.chain || '', chg1d: (p.change_1d != null ? +p.change_1d : null), chg7d: (p.change_7d != null ? +p.change_7d : null), logo: p.logo || null, url: p.url || null }));
    let stableTotal = 0, topStables = [];
    if (stableRaw && Array.isArray(stableRaw.peggedAssets)) {
      const sa = stableRaw.peggedAssets
        .map(a => ({ name: a.name, sym: a.symbol, peg: a.pegType, mech: a.pegMechanism, circ: (a.circulating && +a.circulating.peggedUSD) || 0 }))
        .filter(a => a.circ > 0)
        .sort((a, b) => b.circ - a.circ);
      stableTotal = sa.reduce((s, a) => s + a.circ, 0);
      topStables = sa.slice(0, 8);
    }
    if (totalTvl > 0 || topChains.length) {
      out = { totalTvl, chainCount: chains.length, topChains, topProtos: protos, stableTotal, topStables };
    }
  } catch (e) {}
  const resp = new Response(JSON.stringify(out || { error: 'unavailable' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': out ? 'public, max-age=600' : 'no-store', ...CORS } });
  if (out) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
async function handleGeckoTrending(env) {
  const ck = new Request('https://marginpad.io/__gecko_trending');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  let out = null;
  try {
    const h = { headers: { accept: 'application/json' } };
    if (env.COINGECKO_API_KEY) h.headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
    const r = await fetch('https://api.coingecko.com/api/v3/search/trending', h);
    if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.coins)) out = { coins: j.coins.slice(0, 12).map(c => { const i = c.item || {}, d = i.data || {}; return { sym: String(i.symbol || '').toUpperCase(), name: i.name, img: i.thumb || i.small, chg24h: (d.price_change_percentage_24h && d.price_change_percentage_24h.usd != null) ? +d.price_change_percentage_24h.usd : null }; }) }; }
  } catch (e) {}
  const ok = out && out.coins && out.coins.length;
  const resp = new Response(JSON.stringify(ok ? out : { error: 'unavailable' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': ok ? 'public, max-age=300' : 'no-store', ...CORS } });
  if (ok) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
async function handleGeckoGlobal(env) {
  const ck = new Request('https://marginpad.io/__gecko_global');
  try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
  let data = null;
  try {
    const h = { headers: { accept: 'application/json' } };
    if (env.COINGECKO_API_KEY) h.headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
    const r = await fetch('https://api.coingecko.com/api/v3/global', h);
    if (r.ok) data = await r.json();
  } catch (e) {}
  const ok = data && data.data;
  const resp = new Response(JSON.stringify(ok ? data : { error: 'unavailable' }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': ok ? 'public, max-age=300' : 'no-store', ...CORS } });
  if (ok) try { await caches.default.put(ck, resp.clone()); } catch (e) {}
  return resp;
}
// Merge USDT-perp tickers across Bybit + OKX + Gate → aggregated 24h USD volume, venue count, and a
// cross-checked median price (flags cross-exchange spread). Bybit is primary for funding/OI/24h%.
async function _multiBase(env) {
  const map = new Map();
  function add(sym, price, volUsd, opt) {
    if (!(price > 0) || !(volUsd > 0)) return;
    let m = map.get(sym);
    if (!m) { m = { s: sym, prices: [], vol: 0, vens: 0, p: 0, chg: null, f: null, oi: 0, hi: 0, lo: 0 }; map.set(sym, m); }
    m.prices.push(price); m.vol += volUsd; m.vens++;
    opt = opt || {};
    if (opt.primary || m.p === 0) {
      m.p = price;
      if (opt.chg != null && isFinite(opt.chg)) m.chg = opt.chg;
      if (opt.f != null && isFinite(opt.f)) m.f = opt.f;
      if (opt.oi != null && isFinite(opt.oi)) m.oi = opt.oi;
      if (opt.hi) m.hi = opt.hi;
      if (opt.lo) m.lo = opt.lo;
    } else {
      if (m.f == null && opt.f != null && isFinite(opt.f)) m.f = opt.f; // fill funding from a secondary venue if primary lacked it
    }
  }
  const [byR, okR, gaR, mxR, bxR] = await Promise.all([
    fetch('https://api.bybit.com/v5/market/tickers?category=linear', { cf: { cacheTtl: 30, cacheEverything: true } }).catch(() => null),
    fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP', { cf: { cacheTtl: 30 } }).catch(() => null),
    fetch('https://api.gateio.ws/api/v4/futures/usdt/tickers', { cf: { cacheTtl: 30 } }).catch(() => null),
    fetch('https://contract.mexc.com/api/v1/contract/ticker', { cf: { cacheTtl: 30 } }).catch(() => null),
    fetch('https://open-api.bingx.com/openApi/swap/v2/quote/ticker', { cf: { cacheTtl: 30 } }).catch(() => null),
  ]); // Bybit/OKX/Gate/MEXC/BingX — the big USDT-perp venues reachable from Cloudflare's edge. Binance + Bitget 403-ban CF IPs → they come via the VPS collector (below). Each fetch is fail-soft.
  try {
    if (byR && byR.ok) {
      const j = await byR.json();
      const list = j && j.result && Array.isArray(j.result.list) ? j.result.list : [];
      for (const t of list) {
        if (!/^[A-Z0-9]+USDT$/.test(t.symbol)) continue;
        add(t.symbol.replace(/USDT$/, ''), +t.lastPrice, +t.turnover24h, { primary: true, chg: +t.price24hPcnt * 100, f: +t.fundingRate * 100, oi: +t.openInterestValue, hi: +t.highPrice24h, lo: +t.lowPrice24h });
      }
    }
  } catch (e) {}
  try {
    if (okR && okR.ok) {
      const j = await okR.json();
      const list = (j && Array.isArray(j.data)) ? j.data : [];
      for (const t of list) {
        const m = /^([A-Z0-9]+)-USDT-SWAP$/.exec(t.instId || ''); if (!m) continue;
        const px = +t.last, op = +t.open24h;
        add(m[1], px, (+t.volCcy24h) * px, { chg: (op > 0 ? (px - op) / op * 100 : null), hi: +t.high24h, lo: +t.low24h });
      }
    }
  } catch (e) {}
  try {
    if (gaR && gaR.ok) {
      const list = await gaR.json();
      if (Array.isArray(list)) for (const t of list) {
        const m = /^([A-Z0-9]+)_USDT$/.exec(t.contract || ''); if (!m) continue;
        const fr = (t.funding_rate != null ? +t.funding_rate * 100 : null);
        add(m[1], +t.last, +t.volume_24h_settle, { chg: (t.change_percentage != null ? +t.change_percentage : null), f: fr, hi: +t.high_24h, lo: +t.low_24h });
      }
    }
  } catch (e) {}
  try { // MEXC perp (amount24 = quote/USD vol)
    if (mxR && mxR.ok) {
      const j = await mxR.json();
      const list = (j && Array.isArray(j.data)) ? j.data : [];
      for (const t of list) {
        const m = /^([A-Z0-9]+)_USDT$/.exec(t.symbol || ''); if (!m) continue;
        add(m[1], +t.lastPrice, +t.amount24, { chg: (t.riseFallRate != null ? +t.riseFallRate * 100 : null), f: (t.fundingRate != null ? +t.fundingRate * 100 : null), hi: +t.high24Price, lo: +t.lower24Price });
      }
    }
  } catch (e) {}
  try { // BingX perp (quoteVolume = USD vol; priceChangePercent already in %)
    if (bxR && bxR.ok) {
      const j = await bxR.json();
      const list = (j && Array.isArray(j.data)) ? j.data : [];
      for (const t of list) {
        const m = /^([A-Z0-9]+)-USDT$/.exec(t.symbol || ''); if (!m) continue;
        add(m[1], +t.lastPrice, +t.quoteVolume, { chg: (t.priceChangePercent != null ? +t.priceChangePercent : null), hi: +t.highPrice, lo: +t.lowPrice });
      }
    }
  } catch (e) {}
  try { // Binance + Bitget via the VPS collector — both 403-ban CF's edge IPs, so the collector (a non-banned IP) fetches them for us
    const COLL = (env && env.COLLECTOR_URL) || '';
    if (COLL) {
      const cr = await fetch(COLL + '/api/v1/perp-tickers', { cf: { cacheTtl: 30 } }).catch(() => null);
      if (cr && cr.ok) {
        const j = await cr.json();
        ['binance', 'bitget'].forEach(function (k) { const arr = j && Array.isArray(j[k]) ? j[k] : []; for (const t of arr) { if (t && t.s) add(t.s, +t.p, +t.vol, { chg: t.chg, f: t.f, oi: t.oi, hi: t.hi, lo: t.lo }); } });
      }
    }
  } catch (e) {}
  const out = [];
  for (const m of map.values()) {
    const ps = m.prices.slice().sort((a, b) => a - b);
    const med = ps.length % 2 ? ps[(ps.length - 1) / 2] : (ps[ps.length / 2 - 1] + ps[ps.length / 2]) / 2;
    const spread = (med > 0 && ps.length > 1) ? (ps[ps.length - 1] - ps[0]) / med * 100 : 0;
    out.push({ s: m.s, p: med || m.p, chg: m.chg != null ? m.chg : 0, vol: m.vol, f: m.f != null ? m.f : 0, oi: m.oi, hi: m.hi, lo: m.lo, vens: m.vens, spread: +spread.toFixed(2) });
  }
  return out;
}

async function handleScreener(env) {
  const cache = caches.default;
  const ck = new Request('https://marginpad.io/__screener_v12');
  try { const hit = await cache.match(ck); if (hit) return hit; } catch (e) {}
  // colo cache missed → fall back to the GLOBAL KV snapshot the cron keeps warm (caches.default is per-colo, so a cold colo
  // otherwise pays the full ~33-subrequest compute → the "top signals take ages to load" lag). KV is global + instant.
  if (env && env.STATS) { try { const kv = await env.STATS.get('scr:cache5'); if (kv) { const o = JSON.parse(kv); if (o && o.body && (Date.now() - (o.ts || 0) < 900000)) { const r = new Response(o.body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', ...CORS } }); try { await cache.put(ck, r.clone()); } catch (e) {} return r; } } } catch (e) {} }
  // Multi-exchange (Bybit + OKX + Gate) USDT-perp universe: aggregated USD volume + venue count + median-price cross-check
  let universe = [];
  try {
    universe = (await _multiBase(env))
      .filter(t => t.p > 0 && t.vol > 0)
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 200); // show the top ~200 by aggregated volume (like a real screener) — cheap fields (price/24h%/vol/funding/OI) come for free from the ticker merge
  } catch (e) {}
  if (!universe.length) return J({ error: 'upstream temporarily unavailable' }, 503);
  // Only the top N get the EXPENSIVE technical score (one 4h-klines fetch each → RSI/MACD/MA/ATR + 0-100 score + setup).
  // The long tail ships with the cheap fields + score:null (frontend renders "—"). Klines are cf-cached so re-runs are cheap.
  const SCORE_N = 50;
  const toScore = universe.slice(0, SCORE_N), tail = universe.slice(SCORE_N);
  const scored = await Promise.all(toScore.map(async t => {
    try {
      const kr = await fetch('https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=' + t.s + '_USDT&interval=4h&limit=210', { cf: { cacheTtl: 180 } });
      if (kr.ok) {
        const kd = await kr.json();
        if (Array.isArray(kd) && kd.length > 40) {
          const closes = [], highs = [], lows = [], vols = [];
          for (const k of kd) { closes.push(+k[2]); highs.push(+k[3]); lows.push(+k[4]); vols.push(+k[1]); }
          const a = _screenScore({ price: t.p, closes, highs, lows, vols, chg: t.chg, funding: t.f });
          return { ...t, score: a.score, verdict: _verdict(a.score), trend: a.trend, rsi: a.rsi, macd: a.macd, atrPct: a.atrPct, sig: a.sig, setup: a.setup };
        }
      }
    } catch (e) {}
    return { ...t, score: null };
  }));
  const rows = scored.concat(tail.map(t => ({ ...t, score: null })));
  const body = JSON.stringify({ ts: Date.now(), hasFunding: true, scored: true, multi: true, venues: ['Bybit', 'OKX', 'Gate', 'MEXC', 'BingX', 'Binance', 'Bitget'], rows });
  const resp = new Response(body, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=600', ...CORS },
  });
  try { await cache.put(ck, resp.clone()); } catch (e) {}
  // keep a global KV snapshot so other colos (and the next cold load) serve instantly instead of recomputing
  if (env && env.STATS) { try { await env.STATS.put('scr:cache5', JSON.stringify({ ts: Date.now(), body }), { expirationTtl: 1800 }); } catch (e) {} }
  return resp;
}
// Telegram channel signals: when a top-30 screener pair scores ≥95 (extremely bullish), auto-post a high-leverage
// LONG signal (50–100x band) to the announcement channel. Dedup 6h per symbol, cap 3/run, kill-switch KV `sig:on`='0'.
async function checkSignals(env) {
  try {
    if (!env || !env.STATS || !env.TELEGRAM_TOKEN) return;
    if ((await env.STATS.get('sig:on')) === '0') return;                       // kill-switch
    const channel = await env.STATS.get('tg:channel'); if (!channel) return;   // no channel configured yet
    // Pacing → aim for ~3-5/day: at most SIG_DAILY per UTC day, and ≥SIG_GAP between posts, one per cron run.
    const SIG_DAILY = +(await env.STATS.get('sig:daily') || 5);                 // admin-tunable (KV sig:daily)
    const SIG_GAP = 2.5 * 3600 * 1000;                                          // 2.5h between signals → spreads them out
    const day = new Date().toISOString().slice(0, 10), dayKey = 'sig:day:' + day;
    const dayN = +(await env.STATS.get(dayKey) || 0); if (dayN >= SIG_DAILY) return;
    const last = +(await env.STATS.get('sig:last') || 0); if (Date.now() - last < SIG_GAP) return;
    let rows = [];
    try { const r = await handleScreener(env); const j = await r.json(); rows = (j && j.rows) || []; } catch (e) { return; }
    // Candidates = any pair with a decisive trade setup (the screener only builds a setup at score ≥62 long / ≤38 short),
    // both directions, most-decisive (furthest from 50) first. Pick the single best one that isn't on its 6h cooldown.
    const cand = rows.filter(x => x && typeof x.score === 'number' && x.setup && (x.setup.dir === 'long' || x.setup.dir === 'short'))
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50));
    const token = env.TELEGRAM_TOKEN;
    const fpx = v => { v = +v; return '$' + v.toLocaleString('en-US', { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6 }); };
    for (const x of cand) {
      const sym = String(x.s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!sym) continue;
      const dkey = 'sig:dd:' + sym;
      if (await env.STATS.get(dkey)) continue;                                  // already posted in the last 6h
      const s = x.setup, score = x.score, long = s.dir === 'long';
      const lev = Math.max(20, Math.min(100, Math.round(s.lev || 50)));
      const liqPct = (100 / lev).toFixed(1);
      const text = '🚨 <b>TRADE SIGNAL</b> · ' + sym + '/USDT\n' + DIV + '\n'
        + (long ? '📈 <b>LONG</b>' : '📉 <b>SHORT</b>') + ' · Score <b>' + score + '/100</b> (' + (x.verdict || (long ? 'Bullish' : 'Bearish')) + ')\n'
        + '⚡ Suggested leverage <b>' + lev + 'x</b>\n\n'
        + '🎯 Entry  <code>' + fpx(s.entry) + '</code>\n'
        + '🛑 Stop   <code>' + fpx(s.sl) + '</code>\n'
        + '✅ TP1    <code>' + fpx(s.tp1) + '</code>\n'
        + '✅ TP2    <code>' + fpx(s.tp2) + '</code>\n'
        + '✅ TP3    <code>' + fpx(s.tp3) + '</code>\n'
        + (x.sig && x.sig.length ? '\n🔎 ' + x.sig.slice(0, 4).join(' · ') + '\n' : '')
        + '\n⚠️ <b>' + lev + 'x is high risk.</b> A ~' + liqPct + '% move against you = liquidation. Use the stop and size small.\n'
        + '📊 <a href="https://marginpad.io/screener">Live screener</a> · 🧪 <a href="https://marginpad.io/paper-trade?coin=' + sym + '&side=' + (long ? 'long' : 'short') + '&lev=' + lev + '">Practice on Paper Trade</a>\n'
        + '<i>Educational only — not financial advice.</i>';
      await tgApi(token, 'sendMessage', { chat_id: channel, text, parse_mode: 'HTML', disable_web_page_preview: true });
      try { await env.STATS.put(dkey, String(Date.now()), { expirationTtl: 21600 }); } catch (e) {} // 6h per-symbol cooldown
      try { await env.STATS.put(dayKey, String(dayN + 1), { expirationTtl: 172800 }); } catch (e) {}
      try { await env.STATS.put('sig:last', String(Date.now())); } catch (e) {}
      try { const c = (+(await env.STATS.get('sig:count') || 0)) + 1; await env.STATS.put('sig:count', String(c)); } catch (e) {}
      break;                                                                    // one signal per run — the gap + daily cap spread them across the day
    }
  } catch (e) {}
}
// single-symbol live price (for the Telegram bot price/alert features)
async function fetchPrice(sym) {
  const s = String(sym || '').toUpperCase().replace(/USDT$/, '').replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  const pair = s + 'USDT';
  // Bybit USDT-perp (linear) FIRST — SAME market as the live WS feed + chart candles, so the REST fallback never reintroduces a spot-vs-perp price mismatch.
  try {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear&symbol=' + pair, { cf: { cacheTtl: 8 } });
    if (r.ok) { const d = await r.json(); const it = d && d.result && d.result.list && d.result.list[0]; if (it) { const p = +it.lastPrice; if (isFinite(p) && p > 0) return { sym: s, price: p, chg: +(parseFloat(it.price24hPcnt) * 100) }; } }
  } catch (e) {}
  for (const b of ['https://data-api.binance.vision', 'https://api.binance.com']) {
    try {
      const r = await fetch(b + '/api/v3/ticker/24hr?symbol=' + pair, { cf: { cacheTtl: 10 } });
      if (r.ok) { const d = await r.json(); const p = +d.lastPrice; if (isFinite(p) && p > 0) return { sym: s, price: p, chg: +d.priceChangePercent }; }
    } catch (e) {}
  }
  // Bybit spot fallback
  try {
    const r = await fetch('https://api.bybit.com/v5/market/tickers?category=spot&symbol=' + pair, { cf: { cacheTtl: 10 } });
    if (r.ok) { const d = await r.json(); const it = d && d.result && d.result.list && d.result.list[0]; if (it) { const p = +it.lastPrice; if (isFinite(p) && p > 0) return { sym: s, price: p, chg: +(parseFloat(it.price24hPcnt) * 100) }; } }
  } catch (e) {}
  // Gate.io fallback — same source as the screener/klines, so anything the screener lists resolves a live price
  try {
    const r = await fetch('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=' + s + '_USDT', { cf: { cacheTtl: 10 } });
    if (r.ok) { const d = await r.json(); const it = Array.isArray(d) && d[0]; if (it) { const p = +it.last; if (isFinite(p) && p > 0) return { sym: s, price: p, chg: +it.change_percentage }; } }
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
  // Edge-cache the assembled response: identical for every user for a given symbol/interval, so polling clients
  // and chart loads share one upstream fetch instead of hammering Gate/Bybit on every request.
  const cacheKey = new Request('https://marginpad.io/__klines_v2_' + pair + '_' + iv + '_' + (hasEnd ? end : 'live'));
  try { const hit = await caches.default.match(cacheKey); if (hit) return hit; } catch (e) {}
  // Binance is hard-blocked (403) from Cloudflare egress, so it's not used. Gate.io is the primary source:
  // reachable from CF, deep history in one call (BTC weekly back to 2013), and supports `to` for back-pagination.
  // Bybit is the fallback (works from CF but only goes back to ~2021 and returns nothing for old `end`).
  const gMap = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', '240': '4h', '1440': '1d', '10080': '7d' };
  const byMap = { '1': '1', '5': '5', '15': '15', '60': '60', '240': '240', '1440': 'D', '10080': 'W' };
  let out = null;
  // Bybit USDT-perp (linear) FIRST — SAME market as the live WS feed, so the chart candles, the form's live price and the position lines all agree (spot vs perp mismatch was making them disagree).
  try {
    const r = await fetch('https://api.bybit.com/v5/market/kline?category=linear&symbol=' + pair + '&interval=' + (byMap[iv] || '60') + '&limit=1000' + (hasEnd ? '&end=' + end : ''), { cf: { cacheTtl: hasEnd ? 600 : 8 } });
    if (r.ok) { const d = await r.json(); const list = d && d.result && d.result.list; if (list && list.length) out = list.map(k => ({ time: Math.floor(+k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], vol: +k[5] })).sort((a, b) => a.time - b.time); }
  } catch (e) {}
  // Gate.io (spot) — fallback: deep history + coins not on Bybit linear
  if (!out) try {
    const g = 'https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=' + sym + '_USDT&interval=' + (gMap[iv] || '1h') + '&limit=1000' + (hasEnd ? '&to=' + Math.floor(end / 1000) : '');
    const r = await fetch(g, { cf: { cacheTtl: hasEnd ? 600 : 20 } });
    if (r.ok) { const d = await r.json(); // Gate row: [t, quoteVol, close, high, low, open, baseVol, closed]
      if (Array.isArray(d) && d.length) out = d.map(k => ({ time: +k[0], open: +k[5], high: +k[3], low: +k[4], close: +k[2], vol: +k[6] })).sort((a, b) => a.time - b.time); }
  } catch (e) {}
  // Bybit spot — last resort
  if (!out) try {
    const r = await fetch('https://api.bybit.com/v5/market/kline?category=spot&symbol=' + pair + '&interval=' + (byMap[iv] || '60') + '&limit=1000' + (hasEnd ? '&end=' + end : ''), { cf: { cacheTtl: hasEnd ? 600 : 30 } });
    if (r.ok) { const d = await r.json(); const list = d && d.result && d.result.list; if (list && list.length) out = list.map(k => ({ time: Math.floor(+k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], vol: +k[5] })).sort((a, b) => a.time - b.time); }
  } catch (e) {}
  if (!out) return J({ error: 'no data' }, 404);
  const maxAge = hasEnd ? 600 : 8; // historical pages are effectively immutable; live tail refreshes ~8s (the client also seeds the forming candle from the WS, so the visible price is always live)
  const resp = new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=' + maxAge, ...CORS } });
  try { await caches.default.put(cacheKey, resp.clone()); } catch (e) {}
  return resp;
}

// Proxy to the separate liquidation collector service (its own VPS). The site reads it through here so it
// stays same-origin + versioned, aggregates are edge-cached, and the page degrades gracefully if it's down.
// Set COLLECTOR_URL (wrangler var/secret) to the service base, e.g. https://collector.marginpad.io.
// While unset/unreachable, returns {fallback:true} 503 -> the frontend shows theoretical lines + a notice.
async function handleCollectorProxy(url, request, env) {
  const base = (env && env.COLLECTOR_URL || '').replace(/\/$/, '');
  if (!base) return J({ error: 'collector_unconfigured', fallback: true }, 503);
  // Edge-cache TTL per path: /recent aggregate is slow-moving (45s); the live /feed gets a tiny 3s cache so a
  // crowd of rekt pollers (every ~4s each) collapses to one collector fetch per 3s instead of N — protects the VPS.
  const p = url.pathname;
  const ttl = p.endsWith('/recent') ? 45 : p.endsWith('/feed') ? 3 : 0;
  try {
    const r = await fetch(base + p + url.search, {
      headers: { 'x-api-key': request.headers.get('x-api-key') || '' },
      cf: ttl ? { cacheTtl: ttl, cacheEverything: true } : { cacheTtl: 0 },
    });
    if (!r.ok) return J({ error: 'collector_unreachable', fallback: true }, 503); // DNS/origin/5xx -> clean fallback
    const body = await r.text();
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': ttl ? ('public, max-age=' + ttl) : 'no-store',
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
  // Fetch each unique symbol's price in parallel — the old serial loop (each fetchPrice = up to 4 upstream calls) could blow the cron CPU/subrequest budget under many alerts and stop firing mid-loop.
  await Promise.all(Object.keys(syms).map(async s => { try { const p = await fetchPrice(s); if (p) prices[s] = p.price; } catch (e) {} }));
  for (const a of items) {
    const cur = prices[a.sym]; if (cur == null) continue;
    if ((a.dir === 'up' && cur >= a.target) || (a.dir === 'down' && cur <= a.target)) {
      await tgApi(env.TELEGRAM_TOKEN, 'sendMessage', { chat_id: a.chat, text: `🔔 <b>${a.sym} alert!</b>\n${a.sym} is now <b>$${tgfmt(cur)}</b> (${a.dir === 'up' ? '≥' : '≤'} $${tgfmt(a.target)}).\n\n➡️ <a href="https://marginpad.io">Plan your trade on MarginPad</a>`, parse_mode: 'HTML', disable_web_page_preview: true });
      try { await env.STATS.delete(a._key); } catch (e) {}
    }
  }
}

// ---------- privacy-friendly self-hosted analytics (hashed visitor id — no cookies, no raw IP stored) ----------
const STATS_KEY = 'mp_9f3c7e21b84d4a6f'; // legacy read-only stats key (public by owner's choice); override via the Wrangler secret STATS_KEY
// Two-tier admin auth. The (public) stats key only opens the read-only dashboard view; every MUTATING/admin route
// requires the ADMIN_KEY Wrangler secret. Until ADMIN_KEY is set, admin routes fall back to the stats key so a
// deploy without the secret changes nothing.
const statsKeyOf = (env) => (env && env.STATS_KEY) || STATS_KEY;
const adminKeyOf = (env) => (env && (env.ADMIN_KEY || env.STATS_KEY)) || STATS_KEY;
const isAdminKey = (env, k) => !!k && k === adminKeyOf(env);
const isStatsKey = (env, k) => !!k && (k === statsKeyOf(env) || k === adminKeyOf(env));
async function sha8(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).slice(0, 8).map(x => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; }
}
function deviceOf(ua) { return /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua) ? 'Mobile' : 'Desktop'; }
// Heuristic VPN/proxy/datacenter flag from the Cloudflare ASN org name (no enterprise Bot Management needed).
// Residential ISPs don't match; hosting/VPN egress does. Labelled "likely" in the UI — it's a signal, not proof.
function isVpnOrg(org) {
  if (!org) return false;
  return /(vpn|proxy|hosting|datacenter|data center|colo|leaseweb|\bovh\b|hetzner|digitalocean|linode|vultr|m247|datacamp|choopa|contabo|scaleway|quadranet|psychz|frantech|\bpacket\b|amazon|\baws\b|google llc|google cloud|microsoft|azure|oracle|alibaba|tencent|mullvad|nordvpn|expressvpn|protonvpn|cyberghost|surfshark|ipvanish|private internet|\bg-core\b|\bzenlayer\b|\bdatawagon\b)/i.test(org);
}
function browserOf(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}
// Known crawlers, scrapers, preview-fetchers, AI bots and headless/script clients. Matched case-insensitively
// against the User-Agent. Real browsers never contain these tokens, so false positives are very unlikely.
function isBot(ua) {
  return !ua || /bot\b|crawl|spider|slurp|bingpreview|google(bot|-|\s)|adsbot|mediapartners|yandex|baidu|sogou|duckduckbot|facebookexternalhit|facebot|embedly|skypeuripreview|whatsapp|telegrambot|discordbot|slackbot|twitterbot|linkedinbot|pinterest|redditbot|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|oai-searchbot|chatgpt|ccbot|claudebot|claude-web|anthropic|perplexity|applebot|amazonbot|headless|phantomjs|puppeteer|playwright|selenium|python-requests|aiohttp|curl\/|wget|axios\/|node-fetch|got\s|okhttp|go-http-client|java\/|libwww|httpclient|scrapy|masscan|zgrab/i.test(ua);
}
const _trackHits = new Map(); // per-isolate IP throttle for /api/track — a UA-rotating flooder was ~15 KV writes/hit
async function handleTrack(url, request, env, ctx) {
  // persistent first-party DEVICE id (2y cookie): survives IP/UA changes, links multi-account Rewards abuse
  const okHeaders = { ...CORS };
  if (!getCookie(request, 'mp_did')) {
    try { okHeaders['set-cookie'] = 'mp_did=' + crypto.randomUUID().replace(/-/g, '') + '; Path=/; Max-Age=63072000; HttpOnly; Secure; SameSite=Lax'; } catch (e) {}
  }
  const ok = new Response('', { status: 204, headers: okHeaders });
  if (!env || !env.STATS) return ok;
  { // max 30 tracked hits / 10s / IP per isolate (a human clicking around sends a few; only floods trip this)
    const tip = request.headers.get('cf-connecting-ip') || '';
    if (tip) {
      const now = Date.now(); let th = _trackHits.get(tip);
      if (!th || now - th.t > 10000) { th = { t: now, n: 0 }; _trackHits.set(tip, th); if (_trackHits.size > 5000) _trackHits.clear(); }
      if (++th.n > 30) return ok;
    }
  }
  const p = url.searchParams;
  const type = (p.get('t') || 'event').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
  const label = (p.get('e') || '').replace(/[^a-zA-Z0-9 #:._/-]/g, '').slice(0, 48);
  const inc = async (k, ttl) => { try { const c = await env.STATS.getWithMetadata(k); const v = ((c && c.metadata && c.metadata.c) || 0) + 1; const o = { metadata: { c: v } }; if (ttl) o.expirationTtl = ttl; await env.STATS.put(k, String(v), o); } catch (e) {} };
  // Bot/crawler filtering — keep them out of the visitor numbers so CTR/bounce/countries stay honest.
  // We still tally how many we filtered (botf:*) so the dashboard can show "X bots filtered today".
  if (isBot(request.headers.get('user-agent') || '')) {
    if (type === 'pageview') { await inc('botf:total'); await inc('botf:day:' + new Date().toISOString().slice(0, 10), 3456000); }
    return ok;
  }
  if (type === 'pageview') {
    const day = new Date().toISOString().slice(0, 10);
    await inc('pv:total'); // raw page views (every load)
    await inc('pv:day:' + day, 3456000);                                  // daily page views (40d TTL) — for trends/compare
    const pth0 = (p.get('p') || '/'); const lm = pth0.match(/^\/([a-z]{2})(\/|$)/);
    const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '';
    const ua = request.headers.get('user-agent') || '';
    const cc = (request.cf && request.cf.country) || '';
    let src = 'direct';
    { const ref = p.get('r'); if (ref) { try { const h = new URL(ref).hostname.replace(/^www\./, ''); if (h && h !== 'marginpad.io') src = h.slice(0, 40); } catch (e) {} } }
    // Analytics Engine — one cheap, non-blocking data point per pageview (no KV quota, captures full dimensions).
    try { if (env.AE) env.AE.writeDataPoint({ indexes: [cc || 'XX'], blobs: ['pageview', cc, pth0.slice(0, 90), src, deviceOf(ua), browserOf(ua), (lm ? lm[1] : 'en')], doubles: [1] }); } catch (e) {}
    const vid = await sha8(ip + '|' + ua);
    if (vid) {
      try { await env.STATS.put('on:' + vid, '1', { expirationTtl: 180 }); } catch (e) {} // "online now" presence (3-min window)
      const seen = await env.STATS.get('uvd:' + day + ':' + vid);
      if (!seen) { // first visit today from this person — the per-visit counters live here so repeat pageviews stay cheap
        await env.STATS.put('uvd:' + day + ':' + vid, '1', { expirationTtl: 172800 });
        await inc('uv:day:' + day);
        await inc('hr:' + String(new Date().getUTCHours()).padStart(2, '0')); // hour-of-day (by unique visit)
        await inc('lang:' + (lm ? lm[1] : 'en'));                            // language (from /xx/ path prefix)
        const ever = await env.STATS.get('v:' + vid);
        if (!ever) { await env.STATS.put('v:' + vid, day); await inc('uv:total'); await inc('uv:new:' + day); }
        else { await inc('uv:ret:' + day); }
        if (cc) await inc('geo:' + cc);
        if (src !== 'direct') await inc('ref:' + src);
        await inc('pv:path:' + pth0.slice(0, 60));
        await inc('dev:' + deviceOf(ua));
        await inc('br:' + browserOf(ua));
      }
      // Navigation stream — log EVERY pageview (not just the first of the day) so the admin can follow each visitor
      // page → page. `v` (short visitor id) groups one person's hops; `f` = where they came from (previous page in the
      // session, sent by the client as &f, or the external referrer on the first hit).
      try {
        const fromPath = (p.get('f') || '').replace(/[^a-zA-Z0-9/_?=&#:. -]/g, '').slice(0, 44);
        let vlog = []; try { vlog = JSON.parse(await env.STATS.get('pvlog') || '[]'); } catch (e) {}
        vlog.unshift({ v: vid.slice(0, 6), cc: cc || '', u: (getCookie(request, 'mp_un') || '').slice(0, 24), s: src, p: pth0.slice(0, 44), f: fromPath, d: deviceOf(ua), ts: Date.now() });
        if (vlog.length > 150) vlog = vlog.slice(0, 150);
        await env.STATS.put('pvlog', JSON.stringify(vlog), { expirationTtl: 86400 });
      } catch (e) {}
    }
  } else {
    await inc('ev:' + type + (label ? ':' + label : ''));
    const evIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '';
    const evVid = await sha8(evIp + '|' + (request.headers.get('user-agent') || ''));
    if (type === 'jserr') { const de = new Date().toISOString().slice(0, 10); await inc('err:total'); await inc('err:day:' + de, 3456000); await inc('ev:jserrbr:' + browserOf(request.headers.get('user-agent') || '')); } // client crash/JS-error beacon: total + daily series + which browser broke
    try { if (env.AE) env.AE.writeDataPoint({ indexes: [type], blobs: ['event', type, label, (request.cf && request.cf.country) || '', (p.get('p') || '/').slice(0, 90)], doubles: [1] }); } catch (e) {}
    if (type === 'exchange' || type === 'tool') { // affiliate click-outs only (exchange = Bybit/Binance/…, tool = TradingView/Koinly/3Commas). NOT 'hotpair' — Trending now opens Paper Trade, it is not a money click.
      const d2 = new Date().toISOString().slice(0, 10);
      await inc('aff:total'); await inc('aff:day:' + d2, 3456000);        // affiliate-click totals + daily series
    }
    if (type === 'exchange') await inc('xpath:' + (p.get('p') || '/').slice(0, 48)); // which page/tool drove this exchange link-out (revenue path)
    if (type === 'exchange' || type === 'paper' || type === 'hotpair' || type === 'tool' || type === 'tab' || type === 'el' || type === 'nav' || type === 'prod') { // live activity ring buffer — now includes every meaningful CLICK (calculator tabs, product opens, element clicks) with a visitor id so the journeys view can show WHAT each person does, not just where they go
      try {
        const cc = (request.cf && request.cf.country) || '';
        let log = []; try { log = JSON.parse(await env.STATS.get('evlog') || '[]'); } catch (e) {}
        log.unshift({ t: type, e: label, cc: cc, v: evVid.slice(0, 6), u: (getCookie(request, 'mp_un') || '').slice(0, 24), p: (p.get('p') || '').slice(0, 48), ts: Date.now() });
        if (log.length > 80) log = log.slice(0, 80);
        await env.STATS.put('evlog', JSON.stringify(log), { expirationTtl: 86400 });
      } catch (e) {}
    }
  }
  // attribute this hit to a signed-in user (best-effort, off the hot path) → powers the admin Users activity trail
  try {
    const uid = getCookie(request, 'mp_uid');
    if (uid && env.USERS && ctx) {
      const ua3 = request.headers.get('user-agent') || '';
      const ev = { uid, type, label, path: (p.get('p') || '/').slice(0, 60), cc: (request.cf && request.cf.country) || '', dev: deviceOf(ua3) };
      ctx.waitUntil(env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(ev) })).catch(() => {}));
    }
  } catch (e) {}
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
  const exs = st.exchanges.filter((e) => ['bybit', 'okx', 'bitmex', 'bitfinex'].indexOf((e.name || '').toLowerCase()) >= 0); // only the active sources — the rest are deactivated/not working
  const conn = exs.filter((e) => e.connected).length, total = exs.length;
  const anyRecent = exs.some((e) => e.lastEventAt && now - e.lastEventAt < 30 * 60000);
  const status = conn === 0 ? ['DOWN', 'hp-down'] : conn < total ? ['DEGRADED', 'hp-warn'] : ['LIVE', 'hp-live'];
  const up = (s) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + 'h ' : '') + m + 'm'; };
  const ago = (t) => !t ? 'never' : (now - t < 60000 ? '<1m' : Math.round((now - t) / 60000) + 'm') + ' ago';
  const idleLbl = (e) => e.name === 'binance' ? 'idle (geo-restricted)' : 'connected · awaiting';
  const exHtml = exs.map((e) => `<div class="hp-ex"><span class="hp-edot ${!e.connected ? 'off' : e.lastEventAt ? 'on' : 'idle'}"></span><b>${e.name}</b><small>${!e.connected ? 'OFFLINE' : e.lastEventAt ? 'live · ' + ago(e.lastEventAt) : idleLbl(e)} · ${e.eventsPerMin || 0}/min</small></div>`).join('');
  const clN = cl && Array.isArray(cl.clusters) ? cl.clusters.length : 0;
  return `<div class="hp ${status[1]}">
    <div class="hp-h"><span class="hp-dot"></span><span class="hp-st">LIQUIDATION MAP — ${status[0]}</span><span class="hp-up">uptime ${up(st.uptimeSec || 0)}</span></div>
    <div class="hp-grid">${exHtml}</div>
    <div class="hp-meta">${Number(st.db && st.db.events24h || 0).toLocaleString('en-US')} liquidations · ${clN} BTC clusters · ${(st.symbols || []).length} symbols${anyRecent ? '' : ' · <i>quiet — no liqs in 30m (normal when price is flat)</i>'}</div>
  </div>`;
}

// Daily snapshot — KV day-counters (pv:day:, uv:day:, aff:day:) expire after ~40d, so long-term history is
// lost. The cron (every 10 min) overwrites snap:<day> with today's running totals; the last write before UTC
// midnight is the day's final figure. Totals live in the KV metadata so the dashboard's single list() reads
// them for free (no extra GET per day). TTL ~1y keeps history bounded.
async function snapshotDaily(env) {
  if (!env || !env.STATS) return;
  const gc = async k => { try { const r = await env.STATS.getWithMetadata(k); return (r && r.metadata && r.metadata.c) || (r && r.value ? parseInt(r.value, 10) : 0) || 0; } catch (e) { return 0; } };
  const day = new Date().toISOString().slice(0, 10);
  const [uv, pv, aff, nw, rt] = await Promise.all([gc('uv:day:' + day), gc('pv:day:' + day), gc('aff:day:' + day), gc('uv:new:' + day), gc('uv:ret:' + day)]);
  const rev = Math.round(aff * 0.45); // same per-click estimate the dashboard uses
  try { await env.STATS.put('snap:' + day, '1', { metadata: { uv, pv, aff, rev, nw, rt }, expirationTtl: 31536000 }); } catch (e) {}
}
// Query Analytics Engine via the SQL API (read). Returns an array of row objects, or null if unavailable
// (no token / API error) so callers can fall back to KV. Token = Wrangler secret CF_API_TOKEN.
async function aeQuery(env, sql) {
  if (!env || !env.CF_API_TOKEN || !env.CF_ACCOUNT_ID) return null;
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 4000); // don't let a hung SQL API call stall the whole dashboard render
    const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + env.CF_ACCOUNT_ID + '/analytics_engine/sql', {
      method: 'POST', headers: { Authorization: 'Bearer ' + env.CF_API_TOKEN }, body: sql, signal: ctl.signal,
    }).finally(() => clearTimeout(tm));
    if (!r.ok) return null;
    const j = await r.json();
    return (j && Array.isArray(j.data)) ? j.data : null;
  } catch (e) { return null; }
}
// "Message Claude" admin inbox. Items (bug/task/question) are stored in KV STATS as `bug:<id>` with a message
// thread. The bro writes from the password-locked /api/bug page; a local Claude Code watcher polls /api/bug/list,
// handles each open item in the repo, deploys, and replies in the thread — so things get done even while the bro
// is away (dev PC on + watcher running). Auth: a login cookie (password) OR the STATS_KEY in the URL/body (used by
// the watcher). Password = env BUG_ADMIN_PASS, falling back to STATS_KEY until a secret is set.
// ── Shared admin password gate (set-on-first-use). The password's SHA-256 lives in KV; the login cookie carries
// that same hash. STATS_KEY in ?key= always works as a master/recovery key + for the watcher. Used by BOTH the
// bug inbox (cookie path /api/bug) and the stats dashboard (cookie path /api/stats).
async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function adminCookieHash(request, cookieName) {
  const cookies = (request && request.headers.get('cookie')) || '';
  const c = cookies.split(/;\s*/).find(x => x.indexOf(cookieName + '=') === 0);
  return c ? c.slice(cookieName.length + 1) : '';
}
async function adminDoLogin(request, env, kvKey, cookieName, pathScope, go) {
  const jh = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  let b = {}; try { b = await request.json(); } catch (e) {}
  const pass = String(b.password || '');
  if (pass.length < 4) return new Response(JSON.stringify({ error: 'weak' }), { status: 400, headers: jh });
  const hash = await sha256hex(pass);
  const stored = (env.STATS && await env.STATS.get(kvKey)) || '';
  if (!stored) { if (env.STATS) await env.STATS.put(kvKey, hash); } // first run → whatever he types becomes the password
  else if (hash !== stored) return new Response(JSON.stringify({ error: 'bad_password' }), { status: 401, headers: jh });
  const cookie = cookieName + '=' + hash + '; HttpOnly; Secure; SameSite=Lax; Path=' + pathScope + '; Max-Age=31536000';
  return new Response(JSON.stringify({ ok: true, go, firstRun: !stored }), { headers: { ...jh, 'set-cookie': cookie } });
}
function adminLogout(cookieName, pathScope) {
  const jh = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  return new Response(JSON.stringify({ ok: true }), { headers: { ...jh, 'set-cookie': cookieName + '=; HttpOnly; Secure; SameSite=Lax; Path=' + pathScope + '; Max-Age=0' } });
}
function adminLoginHTML(title, firstRun, loginPath) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>${title} · MarginPad</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0b0d;color:#e8ecf1;font-family:-apple-system,system-ui,sans-serif;padding:20px}
.box{width:100%;max-width:330px;text-align:center}h1{font-size:21px;margin:0 0 6px}p{color:#8b94a0;font-size:13px;margin:0 0 18px;line-height:1.5}
input{width:100%;background:#0e1116;border:1px solid #2a323c;border-radius:11px;color:#e8ecf1;font-size:16px;padding:13px;margin-bottom:12px;text-align:center}
button{width:100%;background:#c2f64a;color:#0a0b0d;border:none;border-radius:11px;font-weight:700;font-size:15px;padding:13px;cursor:pointer}#e{color:#ff8a80;font-size:13px;margin-top:10px;min-height:16px}</style></head>
<body><div class="box"><h1>🔒 ${title}</h1><p>${firstRun ? 'First time here, bro — set a password you will use from now on.' : 'Enter your password to continue.'}</p>
<input id="p" type="password" placeholder="${firstRun ? 'Choose a password' : 'Password'}" autofocus>${firstRun ? '<input id="p2" type="password" placeholder="Confirm password">' : ''}
<button id="go">${firstRun ? 'Set password' : 'Unlock'}</button><div id="e"></div></div>
<script>var FR=${firstRun ? 'true' : 'false'},P='${loginPath}';
var p=document.getElementById('p'),p2=document.getElementById('p2'),go=document.getElementById('go'),e=document.getElementById('e');
function submit(){var v=p.value;if(v.length<4){e.textContent='At least 4 characters.';return;}if(FR&&p2&&v!==p2.value){e.textContent='Passwords do not match.';return;}go.disabled=true;e.textContent='';fetch(P,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:v})}).then(function(r){return r.json();}).then(function(d){if(d&&d.ok){location.href=d.go||location.pathname;}else{go.disabled=false;e.textContent=(d&&d.error==='weak')?'At least 4 characters.':'Wrong password.';p.value='';if(p2)p2.value='';p.focus();}}).catch(function(){go.disabled=false;e.textContent='Network error.';});}
go.addEventListener('click',submit);[p,p2].forEach(function(el){if(el)el.addEventListener('keydown',function(ev){if(ev.key==='Enter')submit();});});</script></body></html>`;
}

async function handleBug(url, request, env) {
  const qkey = url.searchParams.get('key') || '';
  const path = url.pathname;
  const jh = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const STATS = env.STATS;
  if (!STATS) return new Response(JSON.stringify({ error: 'no_storage' }), { status: 500, headers: jh });
  const bugPass = (await STATS.get('cfg:bugpass2')) || ''; // SHA-256 of the bro's password (set on first login), '' until set
  const cookOk = !!bugPass && adminCookieHash(request, 'mp_badm') === bugPass;
  const authed = (k) => isStatsKey(env, k) || isStatsKey(env, qkey) || cookOk; // stats/admin key (watcher/recovery) OR the password cookie (browser)
  const readBody = async () => { try { return await request.json(); } catch (e) { return {}; } };
  if (request.method === 'POST' && path === '/api/bug/login') return adminDoLogin(request, env, 'cfg:bugpass2', 'mp_badm', '/api/bug', '/api/bug');
  if (request.method === 'POST' && path === '/api/bug/logout') return adminLogout('mp_badm', '/api/bug');
  async function listBugs() {
    const out = [];
    try { const r = await STATS.list({ prefix: 'bug:' });
      for (const k of r.keys) { try { const v = JSON.parse((await STATS.get(k.name)) || 'null'); if (v) out.push(v); } catch (e) {} } } catch (e) {}
    out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    return out;
  }
  if (request.method === 'POST' && path === '/api/bug') {
    const b = await readBody();
    if (!authed(b.key)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: jh });
    const text = String(b.text || '').trim().slice(0, 4000);
    if (!text) return new Response(JSON.stringify({ error: 'empty' }), { status: 400, headers: jh });
    const id = (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 10) : (Date.now().toString(36) + Math.round(Math.random() * 1e6).toString(36)));
    const now = Date.now();
    const rec = { id, ts: now, text, page: String(b.page || '').slice(0, 400), status: 'open', thread: [{ from: 'owner', text, ts: now }] };
    await STATS.put('bug:' + id, JSON.stringify(rec));
    return new Response(JSON.stringify({ ok: true, id }), { headers: jh });
  }
  if (request.method === 'POST' && (path === '/api/bug/resolve' || path === '/api/bug/status')) {
    const b = await readBody();
    if (!authed(b.key)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: jh });
    const id = String(b.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    let rec = null; try { rec = JSON.parse((await STATS.get('bug:' + id)) || 'null'); } catch (e) {}
    if (!rec) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: jh });
    rec.status = String(b.status || 'fixed').slice(0, 16);
    if (b.note != null) rec.note = String(b.note).slice(0, 4000);
    rec.updTs = Date.now();
    if (rec.status === 'fixed') rec.fixedTs = Date.now();
    await STATS.put('bug:' + id, JSON.stringify(rec));
    return new Response(JSON.stringify({ ok: true }), { headers: jh });
  }
  if (request.method === 'POST' && path === '/api/bug/reply') {
    const b = await readBody();
    if (!authed(b.key)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: jh });
    const id = String(b.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    const text = String(b.text || '').trim().slice(0, 4000);
    if (!text) return new Response(JSON.stringify({ error: 'empty' }), { status: 400, headers: jh });
    let rec = null; try { rec = JSON.parse((await STATS.get('bug:' + id)) || 'null'); } catch (e) {}
    if (!rec) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: jh });
    if (!Array.isArray(rec.thread)) rec.thread = rec.text ? [{ from: 'owner', text: rec.text, ts: rec.ts }] : [];
    const from = b.from === 'claude' ? 'claude' : 'owner';
    rec.thread.push({ from, text, ts: Date.now() });
    rec.updTs = Date.now();
    // an owner follow-up on a done/in-progress item re-opens it so the watcher addresses it again
    if (from === 'owner' && rec.status !== 'open') rec.status = 'open';
    await STATS.put('bug:' + id, JSON.stringify(rec));
    return new Response(JSON.stringify({ ok: true }), { headers: jh });
  }
  if (request.method === 'POST' && path === '/api/bug/delete') {
    const b = await readBody();
    if (!authed(b.key)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: jh });
    const id = String(b.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    if (id) await STATS.delete('bug:' + id);
    return new Response(JSON.stringify({ ok: true }), { headers: jh });
  }
  if (path === '/api/bug/list') {
    if (!authed('')) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: jh });
    return new Response(JSON.stringify({ bugs: await listBugs(), ts: Date.now() }), { headers: jh });
  }
  const inj = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
  if (!authed('')) return new Response(adminLoginHTML('Message Claude', !bugPass, '/api/bug/login'), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  const bugs = await listBugs();
  const LINKS = [
    ['📊', 'Stats dashboard', '/api/stats?key=' + encodeURIComponent(adminKeyOf(env))],
    ['💬', 'This inbox', '/api/bug'],
    ['🌐', 'Live site', '/'],
    ['🗺️', 'Sitemap', '/sitemap.xml'],
  ];
  const linksHtml = LINKS.map(l => `<a href="${l[2]}" target="_blank" rel="noopener">${l[0]} ${l[1]}</a>`).join('\n');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Message Claude · MarginPad</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0a0b0d;color:#e8ecf1;font-family:-apple-system,system-ui,'Familjen Grotesk',sans-serif;padding:max(env(safe-area-inset-top),18px) 16px 60px;-webkit-text-size-adjust:100%}
.wrap{max-width:680px;margin:0 auto}
h1{font-size:24px;letter-spacing:-.02em;margin:6px 0 4px}.sub{color:#8b94a0;font-size:13.5px;margin:0 0 20px;line-height:1.5}
.form{background:#14171c;border:1px solid #242b34;border-radius:16px;padding:16px;margin-bottom:24px}
label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#8b94a0;margin:0 0 6px}
textarea,input{width:100%;background:#0e1116;border:1px solid #2a323c;border-radius:11px;color:#e8ecf1;font:inherit;font-size:15px;padding:12px;resize:vertical}
textarea{min-height:110px;margin-bottom:14px}input{margin-bottom:14px}
#send{background:#c2f64a;color:#0a0b0d;border:none;border-radius:11px;font-weight:700;font-size:15px;padding:13px 22px;cursor:pointer;width:100%}
#send:disabled{opacity:.5}#msg{color:#2ebd85;font-size:13px;margin-top:10px;min-height:16px}
.card{background:#14171c;border:1px solid #242b34;border-radius:14px;padding:14px;margin-bottom:11px}
.crow{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.bdg{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.06em;border:1px solid;border-radius:6px;padding:2px 7px}
.tm{color:#6b7480;font-size:12px}
.pg{color:#8b94a0;font-size:11.5px;font-family:'Space Mono',monospace;margin-left:auto;max-width:48%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.thread{display:flex;flex-direction:column;gap:8px}
.bub{font-size:14px;line-height:1.5;padding:9px 12px;border-radius:11px;white-space:pre-wrap;word-break:break-word;max-width:93%}
.bub .who{display:block;font-size:10px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:4px;opacity:.65;font-family:'Space Mono',monospace}
.bub.ow{align-self:flex-end;background:#1b2410;border:1px solid #2f3d18;color:#eaf4d4}
.bub.cl{align-self:flex-start;background:#0e1116;border:1px solid #233040;color:#d6e4ef}
.reply{display:flex;gap:8px;margin-top:11px}
.reply input{margin:0;font-size:13.5px;padding:9px 11px}
.reply button{background:#1c222b;border:1px solid #2a323c;color:#cfd6de;border-radius:9px;font-size:12.5px;padding:0 14px;cursor:pointer;flex-shrink:0}
.acts{display:flex;gap:8px;margin-top:10px}
.acts button{background:none;border:1px solid #2a323c;color:#8b94a0;border-radius:9px;font-size:12px;padding:6px 12px;cursor:pointer}
.acts .del{color:#ff8a80;border-color:#5a2a28}
.empty{color:#6b7480;text-align:center;padding:30px}
h2{font-size:15px;color:#8b94a0;margin:0 0 14px;font-weight:600}
.links{background:#101319;border:1px solid #222a33;border-radius:14px;padding:11px 12px;margin-bottom:20px}
.links-h{font-family:'Space Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#6b7480;margin:2px 4px 7px}
.links a{display:flex;align-items:center;gap:9px;color:#9fe0ff;text-decoration:none;font-size:14px;padding:8px;border-radius:9px}
.links a:hover{background:#172029}
.seg{display:flex;gap:6px;background:#0e1116;border:1px solid #2a323c;border-radius:11px;padding:4px;margin-bottom:16px}
.seg button{flex:1;background:none;border:none;color:#8b94a0;font:inherit;font-size:13.5px;font-weight:600;padding:9px;border-radius:8px;cursor:pointer}
.seg button.on{background:#c2f64a;color:#0a0b0d}
.row2{display:flex;gap:10px}.row2>div{flex:1}
.foot{text-align:center;margin-top:26px}.foot a{color:#6b7480;font-size:12px;text-decoration:none}
</style></head><body><div class="wrap">
<h1>Message Claude</h1>
<p class="sub">Yo bro — drop a bug, a task, a change you want, or just a question. I pick it up on the dev machine (checks ~hourly while Claude Code is running), do it, and reply below. Reply on any item to follow up — that re-opens it. We're building this together. 🤝</p>
<div class="links">
<div class="links-h">Admin links</div>
${linksHtml}
</div>
<div class="form">
<div class="seg" id="typeSeg"><button class="on" data-type="bug">🐞 Bug</button><button data-type="task">🛠 Task / change</button><button data-type="question">❓ Question</button></div>
<div id="bugFields">
<label>Which page / URL</label>
<input id="f_page" placeholder="/charts  ·  marginpad.io/…">
<div class="row2"><div><label>Device</label><input id="f_dev" placeholder="iPhone 13"></div><div><label>Browser</label><input id="f_br" placeholder="Chrome / Safari"></div></div>
<label>What you did (steps)</label>
<textarea id="f_steps" placeholder="1) opened Charts  2) rotated the phone  3) tapped ✕"></textarea>
<label>What went wrong</label>
<textarea id="f_bad" placeholder="Browse menu showed up huge / it crashed / nothing happened…"></textarea>
<label>What you expected instead</label>
<input id="f_exp" placeholder="normal-size Browse">
</div>
<label id="msgLab">Anything else (optional)</label>
<textarea id="text" placeholder="extra context, or 'sending a screenshot next'…"></textarea>
<button id="send">Send to Claude</button>
<div id="msg"></div>
</div>
<h2>Conversation</h2>
<div id="list"></div>
<div class="foot"><a href="#" id="lo">Lock / sign out</a></div>
</div>
<script>
var BUGS=${inj(bugs)};var QK=${inj(qkey)};
function qs(s){return document.querySelector(s);}
function gv(id){var el=document.getElementById(id);return el?el.value.trim():'';}
function api(p,body){var d=Object.assign(QK?{key:QK}:{},body||{});return fetch(p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)}).then(function(r){return r.json();});}
function tm(ts){try{return new Date(ts).toLocaleString();}catch(e){return '';}}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function badge(st){var c=st==='fixed'?'#2ebd85':st==='wip'?'#3fd8e6':'#ffb347';var t=st==='fixed'?'DONE':st==='wip'?'IN PROGRESS':'OPEN';return '<span class="bdg" style="color:'+c+';border-color:'+c+'55">'+t+'</span>';}
function thread(b){var th=(b.thread&&b.thread.length)?b.thread:[{from:'owner',text:b.text,ts:b.ts}];
  var h=th.map(function(m){var cl=m.from==='claude';return '<div class="bub '+(cl?'cl':'ow')+'"><span class="who">'+(cl?'Claude':'You')+' · '+tm(m.ts)+'</span>'+esc(m.text)+'</div>';}).join('');
  if(b.note&&!th.some(function(m){return m.from==='claude';}))h+='<div class="bub cl"><span class="who">Claude</span>'+esc(b.note)+'</div>';
  return h;}
function render(){var box=qs('#list');if(!BUGS.length){box.innerHTML='<p class="empty">No messages yet.</p>';return;}
  box.innerHTML=BUGS.map(function(b){return '<div class="card"><div class="crow">'+badge(b.status)+'<span class="tm">'+tm(b.ts)+'</span>'+(b.page?'<span class="pg">'+esc(b.page)+'</span>':'')+'</div><div class="thread">'+thread(b)+'</div><div class="reply"><input class="rin" data-rin="'+b.id+'" placeholder="Reply / follow-up…"><button data-reply="'+b.id+'">Send</button></div><div class="acts"><button data-fix="'+b.id+'">Mark done</button><button data-del="'+b.id+'" class="del">Delete</button></div></div>';}).join('');}
function reload(){var a=document.activeElement;if(a&&a.classList&&a.classList.contains('rin')&&a.value)return;fetch('/api/bug/list'+(QK?('?key='+encodeURIComponent(QK)):'')).then(function(r){return r.json();}).then(function(d){if(d&&d.bugs){BUGS=d.bugs;render();}}).catch(function(){});}
var TYPE='bug';
qs('#typeSeg').addEventListener('click',function(e){var b=e.target.closest('[data-type]');if(!b)return;TYPE=b.getAttribute('data-type');this.querySelectorAll('button').forEach(function(x){x.classList.toggle('on',x===b);});qs('#bugFields').style.display=TYPE==='bug'?'':'none';qs('#msgLab').textContent=TYPE==='bug'?'Anything else (optional)':(TYPE==='question'?'Your question':'What do you want done');});
function compose(){
  if(TYPE!=='bug'){var t=gv('text');return {text:(TYPE==='question'?'[QUESTION] ':'[TASK] ')+t,page:'',ok:!!t};}
  var page=gv('f_page'),dev=gv('f_dev'),br=gv('f_br'),steps=gv('f_steps'),bad=gv('f_bad'),exp=gv('f_exp'),more=gv('text');
  var L=['[BUG]'];if(page)L.push('Page: '+page);var dv=[dev,br].filter(Boolean).join(' · ');if(dv)L.push('Device: '+dv);if(steps)L.push('Steps:\\n'+steps);if(bad)L.push('What went wrong: '+bad);if(exp)L.push('Expected: '+exp);if(more)L.push('Notes: '+more);
  return {text:L.join('\\n'),page:page,ok:!!(bad||steps||more)};}
qs('#send').addEventListener('click',function(){var c=compose();var self=this;if(!c.ok){qs('#msg').style.color='#ff8a80';qs('#msg').textContent=(TYPE==='bug'?'Tell me at least what went wrong.':'Write something first.');return;}self.disabled=true;qs('#msg').style.color='#2ebd85';qs('#msg').textContent='Sending…';api('/api/bug',{text:c.text,page:c.page}).then(function(d){self.disabled=false;if(d&&d.ok){['f_page','f_dev','f_br','f_steps','f_bad','f_exp','text'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});qs('#msg').textContent='Sent ✓ — on it.';reload();}else{qs('#msg').style.color='#ff8a80';qs('#msg').textContent='Error: '+((d&&d.error)||'failed');}}).catch(function(){self.disabled=false;qs('#msg').style.color='#ff8a80';qs('#msg').textContent='Network error.';});});
function sendReply(id){var inp=qs('[data-rin="'+id+'"]');var v=inp&&inp.value.trim();if(!v)return;if(inp)inp.disabled=true;api('/api/bug/reply',{id:id,text:v,from:'owner'}).then(function(){reload();}).catch(function(){if(inp)inp.disabled=false;});}
qs('#list').addEventListener('click',function(e){var t=e.target;var rp=t.getAttribute&&t.getAttribute('data-reply'),f=t.getAttribute&&t.getAttribute('data-fix'),d=t.getAttribute&&t.getAttribute('data-del');if(rp){sendReply(rp);}else if(f){api('/api/bug/resolve',{id:f,status:'fixed'}).then(reload);}else if(d){if(confirm('Delete this thread?'))api('/api/bug/delete',{id:d}).then(reload);}});
qs('#list').addEventListener('keydown',function(e){if(e.key==='Enter'&&e.target.classList&&e.target.classList.contains('rin')){e.preventDefault();sendReply(e.target.getAttribute('data-rin'));}});
qs('#lo').addEventListener('click',function(e){e.preventDefault();api('/api/bug/logout',{}).then(function(){location.href='/api/bug';});});
render();setInterval(reload,15000);
</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

async function handleStats(url, env, request) {
  if (!isStatsKey(env, url.searchParams.get('key'))) {
    // password gate (set-on-first-use). Logged-in cookie → hand the key over in the URL so the dashboard's own
    // client JS (which polls with ?key=) keeps working untouched; otherwise show the password / first-run screen.
    // The password login gets the ADMIN key (full dashboard); the bare stats key still opens the read-only view.
    const _stored = (env.STATS && await env.STATS.get('cfg:statspass')) || '';
    if (_stored && adminCookieHash(request, 'mp_sadm') === _stored) return Response.redirect(url.origin + '/api/stats?key=' + encodeURIComponent(adminKeyOf(env)), 302);
    return new Response(adminLoginHTML('Stats dashboard', !_stored, '/api/stats/login'), { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  }
  if (!env || !env.STATS) return new Response('No storage', { status: 500 });
  if (url.searchParams.get('clearerr') && isAdminKey(env, url.searchParams.get('key'))) { try { await env.STATS.delete('srverrlog'); await env.STATS.delete('st:cache'); } catch (e) {} return Response.redirect(url.origin + url.pathname + '?key=' + encodeURIComponent(url.searchParams.get('key') || '') + '&nc=1', 302); } // dismiss the resolved error log (admin key only — it deletes data)
  const htmlResp = (h) => new Response(h, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  // #6 — lightweight live feed for the dashboard's 12s poller. Direct key reads only (NO list) so it never
  // touches the 1000/day list quota. "online" is approximated from recent ring-buffer activity (exact count
  // shows on full page reload). Lets the headline numbers + visitor/activity feeds update live without a reload.
  if (url.searchParams.get('format') === 'json') {
    const gc = async k => { try { const r = await env.STATS.getWithMetadata(k); return (r && r.metadata && r.metadata.c) || (r && r.value ? parseInt(r.value, 10) : 0) || 0; } catch (e) { return 0; } };
    const day = new Date().toISOString().slice(0, 10);
    const [uvTod, uvTot, pvTot, affTot, affTod, botTod, pvTod2, newTod, retTod] = await Promise.all([gc('uv:day:' + day), gc('uv:total'), gc('pv:total'), gc('aff:total'), gc('aff:day:' + day), gc('botf:day:' + day), gc('pv:day:' + day), gc('uv:new:' + day), gc('uv:ret:' + day)]);
    let pvl = [], evl = []; try { pvl = JSON.parse(await env.STATS.get('pvlog') || '[]'); } catch (e) {} try { evl = JSON.parse(await env.STATS.get('evlog') || '[]'); } catch (e) {}
    const now = Date.now(), recent = new Set();
    // "online" = DISTINCT visitors (by short vid) active in the last 5 min. Was keyed by event timestamp, which
    // counted pageviews+events (not people) — one active visitor or an event burst spiked it to a fake number.
    // evlog has no visitor id, so it's excluded from the count (it only inflated it).
    pvl.forEach(v => { if (v && v.v && now - v.ts < 300000) recent.add(v.v); });
    return new Response(JSON.stringify({ online: recent.size, uvToday: uvTod, uvTotal: uvTot, pv: pvTot, aff: affTot, revToday: Math.round(affTod * 0.45), botToday: botTod, pvToday: pvTod2, newToday: newTod, retToday: retTod, affToday: affTod, visitors: pvl.slice(0, 120), feed: evl.slice(0, 80), ts: now }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  // Serve a recent cached render. Each full render does a paginated KV `list`, and the free tier allows only
  // 1000 lists/day — so without this, auto-refresh (every 60s) + manual reloads blow the quota by midday. The
  // cache (5-min TTL) caps fresh renders to a few per hour regardless of how often the dashboard refreshes.
  const noCache = url.searchParams.get('nc') === '1'; // ?nc=1 forces a fresh render (skips the short cache)
  if (!noCache) { try { const hot = await env.STATS.get('st:cache'); if (hot) return htmlResp(hot); } catch (e) {} }
  const all = []; let cursor, pg = 0;
  try {
    do {
      const l = await env.STATS.list({ cursor, limit: 1000 });
      l.keys.forEach(k => all.push({ n: k.name, c: (k.metadata && k.metadata.c) || 0, m: k.metadata }));
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
        const lite = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="120"><title>MarginPad Admin</title><style>${css}</style></head><body><h1>MarginPad — Admin</h1><div class="muted">Lite view · collector + headline metrics live</div>${hh}<div class="cards">${c2(uvTod, 'Visitors today')}${c2(uvT, 'Total visitors')}${c2(pvT, 'Page views')}${c2(cmt, 'Comments')}</div><div class="cards" style="margin-top:12px">${c2(bmsg, 'Bot messages')}${c2(busers, 'Bot users')}</div><div class="note"><b>Detailed analytics paused</b> — today's free KV list quota is used up; full breakdowns (devices, countries, pages, clicks) return automatically at <b>UTC midnight</b>. Tracking never stopped, and from now on the dashboard caches its render so this won't recur.</div></body></html>`;
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
  const snaps = [], xPaths = []; const botfDays = {}; let botfTotal = 0;
  const errMsgs = [], errBrowsers = []; const errDays = {}, srvErrDays = {}; let errTotal = 0, srvErrTotal = 0;
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
    else if (n.indexOf('xpath:') === 0) xPaths.push([n.slice(6), c]);
    else if (n.indexOf('ev:jserrbr:') === 0) errBrowsers.push([n.slice(11), c]); // crashes grouped by browser
    else if (n.indexOf('ev:jserr:') === 0) errMsgs.push([n.slice(9), c]);         // crashes grouped by error message
    else if (n === 'err:total') errTotal = c;
    else if (n.indexOf('err:day:') === 0) errDays[n.slice(8)] = c;
    else if (n === 'srverr:total') srvErrTotal = c;
    else if (n.indexOf('srverr:day:') === 0) srvErrDays[n.slice(11)] = c;
    else if (n === 'botf:total') botfTotal = c;
    else if (n.indexOf('botf:day:') === 0) botfDays[n.slice(9)] = c;
    else if (n.indexOf('snap:') === 0) snaps.push([n.slice(5), k.m || {}]);
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
  const affiliate = sum(ex) + sum(tools); // affiliate clicks = exchange link-outs + affiliate tool cards. Trending ('hotpair') is excluded — it opens Paper Trade now, not an affiliate link.
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
  const TIPS = { 'Visitors today': 'Unique people who opened the site today (bots removed).', 'Total visitors': 'All-time unique visitors since launch.', 'Page views': 'Total pages opened — every load counts, including repeat views.', 'Affiliate clicks': 'Times someone clicked through to an exchange via your referral link. This is what earns commission.', 'Exchange clicks': 'Clicks that left to an exchange via your referral link — the money clicks.', 'Broken pages today': 'Times a page crashed for a visitor today (a script error broke the page). 0 is healthy.', 'Broken pages total': 'All-time count of pages that crashed for a visitor.', 'Server errors today': 'Times our server failed to answer a request today. 0 is healthy.', 'Server errors total': 'All-time server failures.', 'Est. revenue today': 'Rough estimate of affiliate commission earned today (about $0.45 per exchange click).', 'Visitors': 'Unique people in the selected date range.', 'Est. revenue': 'Rough affiliate commission estimate for the selected range.', 'Total comments': 'Comments left on blog posts.', 'Bot messages': 'Messages handled by the Telegram bot.', 'Bot users': 'People who have used the Telegram bot.', 'Returning today': 'Visitors seen on an earlier day who came BACK today — the retention number. The % is their share of today’s visitors.', 'Affiliate clicks today': 'Exchange link-outs today via your referral links — the money clicks.', 'Est. revenue today': 'Rough guess: today’s clicks × ~$0.45. NOT real commission — check the exchange dashboards for actual earnings.', 'Pageviews today': 'Pages opened today, every load counts.', 'Signups today': 'New registered accounts today (email sign-in).', 'Faucet dispensed today': 'USDT credited by the reward faucet today vs the daily budget cap.', 'Bots filtered today': 'Crawler/bot hits kept OUT of every number on this page today.' };
  const cardTip = l => { const t = TIPS[l]; return t ? ' data-tip="' + esc(t) + '"' : ''; };
  const card = (v, l) => `<div class="card${TIPS[l] ? ' has-tip' : ''}"${cardTip(l)}><div class="cv">${v}</div><div class="cl">${l}</div></div>`;
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
  const kcard = (v, l, sp, dl) => `<div class="card${TIPS[l] ? ' has-tip' : ''}"${cardTip(l)}><div class="cv">${v}</div><div class="cl">${l}${dl || ''}</div>${sp || ''}</div>`;
  // --- Site health: client crashes (JS errors) + server-side errors, so we can see how many users hit a broken page ---
  const errToday = errDays[todayStr] || 0, errYd = errDays[yday] || 0, srvToday = srvErrDays[todayStr] || 0;
  errMsgs.sort((a, b) => b[1] - a[1]); errBrowsers.sort((a, b) => b[1] - a[1]);
  let srvErrLog = []; try { srvErrLog = JSON.parse(await env.STATS.get('srverrlog') || '[]'); } catch (e) {}
  const _ERR_RESOLVED_MS = 30 * 60000, _enow = Date.now(); // an error not seen in 30 min is treated as resolved (green)
  const _errG = {};
  srvErrLog.forEach(x => { const k = (x.mth || '') + ' ' + (x.p || '/') + ' :: ' + (x.m || ''); if (!_errG[k]) _errG[k] = { mth: x.mth || '', p: x.p || '/', m: x.m || '', n: 0, last: 0, first: _enow * 2 }; const g = _errG[k]; g.n++; g.last = Math.max(g.last, x.ts); g.first = Math.min(g.first, x.ts); });
  const _errGroups = Object.keys(_errG).map(k => _errG[k]).sort((a, b) => b.last - a.last);
  const _errActive = _errGroups.filter(g => _enow - g.last < _ERR_RESOLVED_MS).length;
  const _eAgo = t => { const s = Math.round((_enow - t) / 1000); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : Math.floor(s / 86400) + 'd'; };
  const _eKey = esc(url.searchParams.get('key') || '');
  const srvErrList = _errGroups.length ? (
    `<h2 style="font-size:14px;margin-top:14px">Server errors <span>(${_errActive ? _errActive + ' active · ' : 'all clear · '}${_errGroups.length} distinct)</span> <a href="?key=${_eKey}&amp;clearerr=1" class="csv" style="margin-left:8px">clear log</a></h2>`
    + `<div class="feedcap">Each distinct failure, newest first. <b style="color:#41e3a3">✓ Resolved</b> = not seen in 30 min — safe to ignore. <b style="color:#ffb347">⚠ Active</b> = happened in the last 30 min — worth a look.</div>`
    + `<div class="list">${_errGroups.map(g => { const rv = _enow - g.last >= _ERR_RESOLVED_MS; return `<div class="fe" style="${rv ? 'opacity:.7' : ''}"><span class="fe-t">${rv ? '<span style="color:#41e3a3;font-weight:700">✓ Resolved</span>' : '<span style="color:#ffb347;font-weight:700">⚠ Active</span>'} <code style="color:${rv ? '#9aa3ad' : '#ff8c7a'}">${esc(g.mth)} ${esc(g.p)}</code> — ${esc(g.m)}${g.n > 1 ? ` <b style="color:#7f8893">×${g.n}</b>` : ''}</span><span class="fe-a">last ${_eAgo(g.last)} ago</span></div>`; }).join('')}</div>`
  ) : '';
  const errHtml = `<div class="feedcap">A <b>broken page</b> = a visitor's browser hit a script error, so they may have seen a broken or frozen page. <b>0 is healthy.</b> Server errors = our server failed to answer a request.</div><div class="cards" style="grid-template-columns:repeat(4,1fr)">${kcard(N(errToday), 'Broken pages today', spark(errDays), dpc(errToday, errYd))}${kcard(N(errTotal), 'Broken pages total')}${kcard(N(srvToday), 'Server errors today')}${kcard(N(srvErrTotal), 'Server errors total')}</div>` + srvErrList + ((errMsgs.length || errBrowsers.length) ? `<div class="two"><div><h2 style="font-size:14px;margin-top:14px">Top error messages</h2><div class="list">${barlist(errMsgs)}</div></div><div><h2 style="font-size:14px;margin-top:14px">Crashes by browser</h2><div class="list">${barlist(errBrowsers)}</div></div></div>` : (srvErrList ? '' : `<div class="sl" style="margin-top:8px">No broken pages recorded — every visitor's page has loaded cleanly. ✅</div>`));
  // live activity feed (ring buffer) + per-exchange revenue + ordered engagement metrics
  let evlog = []; try { evlog = JSON.parse(await env.STATS.get('evlog') || '[]'); } catch (e) {}
  const ago = ts => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? s + 's' : s < 3600 ? Math.floor(s / 60) + 'm' : Math.floor(s / 3600) + 'h'; };
  const verb = t => t === 'tab' ? 'used a calculator' : (t === 'nav' || t === 'el') ? 'clicked a link' : ('did ' + t);
  // friendly, plain-English page name for inline sentences (e.g. "BTC coin page", "the homepage")
  const pageShort = pth => { const s = String(pth || '').replace(/^\/[a-z]{2}\//, '/'); if (s === '/' || s === '') return 'the homepage'; let m; if ((m = s.match(/^\/coin\/([a-z0-9]+)\/?$/i))) return m[1].toUpperCase() + ' coin page'; const M = { '/funding/': 'the Funding page', '/liquidations/': 'the Liquidations page', '/long-short/': 'the Long/Short page', '/open-interest/': 'the Open Interest page', '/screener': 'the Screener', '/screener/': 'the Screener', '/paper-trade': 'Paper Trade', '/paper-trade/': 'Paper Trade', '/charts': 'Charts', '/charts/': 'Charts', '/rekt/': 'the Rekt feed', '/rewards/': 'Rewards', '/calculators': 'Calculators', '/calculators/': 'Calculators', '/blog/': 'the Blog' }; if (M[s]) return M[s]; if ((m = s.match(/^\/([a-z0-9-]+)\/?$/i))) return m[1].replace(/-/g, ' ') + ' page'; return s; };
  // turn a raw event into a clear sentence: WHAT they did + WHERE
  const evLine = x => { const where = x.p ? ` <span class="fe-on">on ${esc(pageShort(x.p))}</span>` : ''; const tg = esc(x.e || ''); if (x.t === 'exchange') return `clicked through to <b class="fe-ex">${tg || 'an exchange'}</b>${where} <span class="fe-rev">💰 money click</span>`; if (x.t === 'paper') return `opened a paper trade${tg ? ' <b>' + tg + '</b>' : ''}`; if (x.t === 'hotpair') return `opened <b>${tg}</b> from Trending`; if (x.t === 'tool') return `opened ${tg ? '<b>' + tg + '</b> ' : 'a '}tool${where}`; return `${verb(x.t)}${tg ? ' <b>' + tg + '</b>' : ''}${where}`; };
  const feed = evlog.length ? evlog.map(x => `<div class="fe"><span class="fe-f">${x.u ? '👤' : (flag(x.cc) || '🌐')}</span><span class="fe-t">${x.u ? ('<b>@' + esc(x.u) + '</b> ') : 'A visitor '}${evLine(x)}</span><span class="fe-a">${ago(x.ts)} ago</span></div>`).join('') : '<div class="empty">no activity in the last few minutes</div>';
  // last visitors — who (country) + from which source (referrer), most recent 5
  let pvlog = []; try { pvlog = JSON.parse(await env.STATS.get('pvlog') || '[]'); } catch (e) {}
  const ccName = { US: 'United States', GB: 'UK', DE: 'Germany', FR: 'France', RS: 'Serbia', ES: 'Spain', BR: 'Brazil', RU: 'Russia', TR: 'Turkey', IN: 'India', CN: 'China', JP: 'Japan', KR: 'Korea', NL: 'Netherlands', CA: 'Canada', AU: 'Australia', IT: 'Italy', PL: 'Poland', UA: 'Ukraine', ID: 'Indonesia', VN: 'Vietnam', PH: 'Philippines', NG: 'Nigeria', MX: 'Mexico', AR: 'Argentina', PT: 'Portugal' };
  const srcName = s => { if (!s || s === 'direct') return 'Direct (typed the URL or bookmark)'; if (/syndicatedsearch|googlesyndication|googleadservices|doubleclick/.test(s)) return 'Google Ads / search partner'; if (/google\./.test(s)) return 'Google search'; if (/bing\./.test(s)) return 'Bing'; if (/yahoo/.test(s)) return 'Yahoo'; if (/yandex/.test(s)) return 'Yandex'; if (/duckduckgo/.test(s)) return 'DuckDuckGo'; if (/ecosia/.test(s)) return 'Ecosia'; if (/brave/.test(s)) return 'Brave Search'; if (/t\.co|twitter|x\.com/.test(s)) return 'X / Twitter'; if (/reddit/.test(s)) return 'Reddit'; if (/youtu/.test(s)) return 'YouTube'; if (/facebook|fb\./.test(s)) return 'Facebook'; if (/instagram/.test(s)) return 'Instagram'; if (/tiktok/.test(s)) return 'TikTok'; if (/linkedin/.test(s)) return 'LinkedIn'; if (/t\.me|telegram/.test(s)) return 'Telegram'; if (/discord/.test(s)) return 'Discord'; return s; };
  const vcol = v => { let h = 0; const s = String(v || ''); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return 'hsl(' + (h % 360) + ',70%,62%)'; };
  const lastV = pvlog.length ? pvlog.slice(0, 30).map(v => `<div class="lv"><span class="lv-vid" style="background:${vcol(v.v)}" title="visitor ${esc(v.v || '')}"></span><span class="lv-f">${flag(v.cc) || '🌐'}</span><div class="lv-b"><div class="lv-2"><span class="lv-from">${esc(v.f ? pageShort(v.f) : srcName(v.s))}</span> <span class="lv-arr">→</span> <span class="lv-p">${esc(pageShort(v.p || '/'))}</span></div><div class="lv-1">${v.cc ? esc(ccName[v.cc] || v.cc) : 'Unknown'} <span class="lv-dev">${(v.d || '').toLowerCase() === 'mobile' ? '📱' : (v.d || '').toLowerCase() === 'tablet' ? '📲' : '🖥'}</span></div></div><span class="lv-a">${ago(v.ts)} ago</span></div>`).join('') : '<div class="empty">no visits logged yet</div>';
  // #10 — exchange link-outs grouped by the page that produced them (which page/tool actually drives revenue)
  const prettyPage = pth => { const s = String(pth).replace(/^\/[a-z]{2}\//, '/'); let cm; if ((cm = s.match(/^\/coin\/([a-z0-9]+)\/?$/i))) return '🪙 ' + cm[1].toUpperCase() + ' coin page'; const M = { '/': '🏠 Homepage', '/rekt/': '💥 Rekt — Liquidations', '/liquidations/': '💥 Liquidations', '/funding/': '📊 Funding rates', '/long-short/': '⚖️ Long/Short', '/open-interest/': '📈 Open Interest', '/screener': '🔍 Screener', '/screener/': '🔍 Screener', '/liquidation-heatmap/': '🔥 Liquidation Heatmap', '/paper-trade/': '📝 Paper Trade', '/paper-trade': '📝 Paper Trade', '/charts': '📉 Charts', '/charts/': '📉 Charts', '/rewards/': '🎁 Rewards', '/api/': '🔌 API page', '/blog/': '✍️ Blog' }; if (M[s]) return M[s]; const m = s.match(/^\/([a-z0-9-]+)\/?$/); return m ? m[1].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : esc(s); };
  xPaths.sort((a, b) => b[1] - a[1]);
  const xPageList = xPaths.length ? barlist(xPaths, prettyPage) : '<div class="empty">no exchange link-outs tracked yet</div>';
  // #5 — bots filtered (kept out of the visitor numbers)
  const botToday = botfDays[todayStr] || 0;
  // #9 — daily history from the cron snapshots (survives the 40-day counter TTL)
  snaps.sort((a, b) => a[0] < b[0] ? -1 : 1);
  const snTail = snaps.slice(-60);
  const snUvMax = Math.max(1, ...snTail.map(s => +s[1].uv || 0)), snRevMax = Math.max(1, ...snTail.map(s => +s[1].rev || 0));
  const histUv = snTail.map(s => `<div class="dcol"><div class="dbar" style="height:${Math.max(2, (+s[1].uv || 0) / snUvMax * 100)}%" title="${s[0]}: ${N(+s[1].uv || 0)} visitors"></div></div>`).join('');
  const histRev = snTail.map(s => `<div class="dcol"><div class="dbar" style="height:${Math.max(2, (+s[1].rev || 0) / snRevMax * 100)}%;background:linear-gradient(180deg,#2ebd85,#1d7a57)" title="${s[0]}: $${N(+s[1].rev || 0)}"></div></div>`).join('');
  const snTotUv = snaps.reduce((s, x) => s + (+x[1].uv || 0), 0), snTotRev = snaps.reduce((s, x) => s + (+x[1].rev || 0), 0);
  const histHtml = snaps.length ? `<h2>Daily history <span>(since launch · ${snaps.length} day${snaps.length === 1 ? '' : 's'} · ${N(snTotUv)} visitors · $${N(snTotRev)} est.)</span></h2><div class="sl" style="margin:0 0 8px">Visitors / day</div><div class="chart">${histUv}</div><div class="sl" style="margin:14px 0 8px">Est. revenue / day</div><div class="chart">${histRev}</div>` : '';
  // Analytics Engine — scale-safe view queried live from AE (no KV quota, no races). Cached with the render (25s),
  // so these 6 API calls run only on a fresh render. Falls back to a notice if the CF_API_TOKEN secret isn't set.
  const aeW = "timestamp > NOW() - INTERVAL '7' DAY";
  const aeR = await Promise.all([
    aeQuery(env, `SELECT sum(_sample_interval) AS n FROM marginpad_events WHERE blob1='pageview' AND ${aeW}`),
    aeQuery(env, `SELECT sum(_sample_interval) AS n FROM marginpad_events WHERE blob1='event' AND ${aeW}`),
    aeQuery(env, `SELECT blob3 AS k, sum(_sample_interval) AS n FROM marginpad_events WHERE blob1='pageview' AND ${aeW} GROUP BY k ORDER BY n DESC LIMIT 12`),
    aeQuery(env, `SELECT blob2 AS k, sum(_sample_interval) AS n FROM marginpad_events WHERE blob1='pageview' AND blob2 != '' AND ${aeW} GROUP BY k ORDER BY n DESC LIMIT 12`),
    aeQuery(env, `SELECT blob5 AS k, sum(_sample_interval) AS n FROM marginpad_events WHERE blob1='pageview' AND ${aeW} GROUP BY k ORDER BY n DESC LIMIT 8`),
    aeQuery(env, `SELECT blob2 AS k, sum(_sample_interval) AS n FROM marginpad_events WHERE blob1='event' AND ${aeW} GROUP BY k ORDER BY n DESC LIMIT 12`),
  ]);
  const aeNum = r => (r && r[0] && +r[0].n) || 0;
  const aeArr = r => (r || []).map(x => [x.k || '(none)', +x.n || 0]);
  const aeOk = aeR.some(r => r !== null);
  const aeSection = aeOk
    ? `<h2>Analytics Engine <span>(scale-safe · last 7 days · no KV quota / no races)</span></h2><div class="cards" style="grid-template-columns:1fr 1fr">${card(N(aeNum(aeR[0])), 'Pageviews · AE')}${card(N(aeNum(aeR[1])), 'Events · AE')}</div><div class="two"><div><h2>Top pages <span>(AE)</span></h2><div class="list">${barlist(aeArr(aeR[2]), prettyPage)}</div></div><div><h2>Countries <span>(AE)</span></h2><div class="list">${barlist(aeArr(aeR[3]), c => (flag(c) || '🌐') + ' ' + esc(c))}</div></div></div><div class="two"><div><h2>Devices <span>(AE)</span></h2><div class="list">${barlist(aeArr(aeR[4]))}</div></div><div><h2>Top events <span>(AE)</span></h2><div class="list">${barlist(aeArr(aeR[5]))}</div></div></div>`
    : `<h2>Analytics Engine</h2><div class="empty" style="padding:14px 16px;background:#111419;border:1px solid #232932;border-radius:14px">Events are being captured in Analytics Engine. This scale-safe view activates once the <b>CF_API_TOKEN</b> secret is set.</div>`;
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
  // ---- "today-first" overview: retention + money tiles, honesty captions, server-seeded alerts ----
  const retY = retD[yday] || 0;
  const retPct = uvToday ? Math.round(retT / uvToday * 100) : 0;
  const revTodayEst = Math.round(affTod * 0.45);
  const admSeed = [];
  if (_errActive) admSeed.push({ cls: 'red', sub: 'health', html: '⚠ <b>' + _errActive + '</b> active server error' + (_errActive > 1 ? 's' : '') });
  if (errToday > 3) admSeed.push({ cls: 'amber', sub: 'health', html: '⚠ <b>' + N(errToday) + '</b> broken pages today' });
  const tile = (id, v, l, sp, dl, cls) => `<div class="card${cls ? ' ' + cls : ''}${TIPS[l] ? ' has-tip' : ''}"${cardTip(l)}><div class="cv" id="${id}">${v}</div><div class="cl">${l}${dl || ''}</div>${sp || ''}</div>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="300"><title>MarginPad Admin</title><style>*{box-sizing:border-box}body{background:#0a0b0d;color:#e9e7df;font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:880px;margin:0 auto;padding:26px 18px 60px}h1{font-size:22px;margin:0 0 2px}.muted{color:#5c656f;font-size:12px;margin-bottom:22px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}@media(max-width:620px){.cards{grid-template-columns:repeat(2,1fr)}}.card{background:#111419;border:1px solid #232932;border-radius:14px;padding:16px}.cv{font-size:28px;font-weight:800;color:#c2f64a;line-height:1;letter-spacing:-1px;transition:color .3s}.cl{color:#9aa3ad;font-size:11px;margin-top:6px;text-transform:uppercase;letter-spacing:.08em}h2{font-size:13px;color:#9aa3ad;margin:34px 0 12px;text-transform:uppercase;letter-spacing:.12em}h2 span{color:#5c656f;text-transform:none;letter-spacing:0}.chart{display:flex;align-items:flex-end;gap:5px;height:140px;background:#111419;border:1px solid #232932;border-radius:14px;padding:14px 12px}.dcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px}.dbar{width:100%;max-width:30px;background:linear-gradient(180deg,#c2f64a,#7fae12);border-radius:4px 4px 0 0;min-height:2px}.dlbl{font-size:10px;color:#5c656f;font-family:monospace}.list{background:#111419;border:1px solid #232932;border-radius:14px;padding:8px 16px;max-height:360px;overflow-y:auto}.row{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid #232932}.row:last-child{border-bottom:none}.lbl{width:36%;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.track{flex:1;height:8px;background:#1a1f27;border-radius:6px;overflow:hidden}.fill{height:100%;background:#c2f64a;border-radius:6px}.cnt{font-family:monospace;color:#c2f64a;font-size:14px;width:54px;text-align:right}.empty{color:#5c656f;padding:10px 0;font-size:14px}.two{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:620px){.two{grid-template-columns:1fr}}.heatrow{display:grid;grid-template-columns:240px 1fr;gap:16px;align-items:start}@media(max-width:620px){.heatrow{grid-template-columns:1fr;justify-items:center}}.heat{display:grid;grid-template-columns:repeat(20,1fr);width:240px;aspect-ratio:1/2;gap:1px;background:#0d0f12;border:1px solid #232932;border-radius:10px;overflow:hidden}.heat i{display:block}.cap{color:#5c656f;font-size:11px;text-align:center;margin-top:8px}.sl{color:#9aa3ad;font-size:13px;margin-top:13px;line-height:1.7}.sl b{color:#c2f64a;font-family:monospace}.hp{border:1px solid #232932;border-radius:14px;padding:15px 17px;margin-bottom:22px;background:#111419}.hp-live{border-color:#1d5e3f;background:linear-gradient(180deg,rgba(46,189,133,.09),#111419)}.hp-warn{border-color:#5e521d;background:linear-gradient(180deg,rgba(255,179,71,.09),#111419)}.hp-down{border-color:#6e2020;background:linear-gradient(180deg,rgba(255,98,88,.11),#111419)}.hp-h{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.hp-dot{width:10px;height:10px;border-radius:50%;background:#2ebd85;animation:hpp 1.8s infinite}.hp-down .hp-dot{background:#ff6258;animation:none}.hp-warn .hp-dot{background:#ffb347;animation:none}@keyframes hpp{0%,100%{box-shadow:0 0 0 0 rgba(46,189,133,.55)}50%{box-shadow:0 0 0 7px rgba(46,189,133,0)}}.hp-st{font-weight:800;font-size:15px;letter-spacing:.02em}.hp-up{margin-left:auto;color:#5c656f;font-size:11px;font-family:monospace}.hp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:14px 0 11px}@media(max-width:620px){.hp-grid{grid-template-columns:1fr}}.hp-ex{display:flex;align-items:center;gap:7px;font-size:13px;background:#0d0f12;border:1px solid #232932;border-radius:9px;padding:8px 11px}.hp-ex b{text-transform:capitalize}.hp-ex small{color:#5c656f;font-size:10px;margin-left:auto;font-family:monospace;text-align:right}.hp-edot{width:8px;height:8px;border-radius:50%;flex-shrink:0}.hp-edot.on{background:#2ebd85}.hp-edot.off{background:#ff6258}.hp-edot.idle{background:#5c656f}.hp-meta{color:#9aa3ad;font-size:12.5px;font-family:monospace}.hp-meta i{color:#ffb347;font-style:normal}.hp-sub{color:#9aa3ad;font-size:13px;margin-top:8px}.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:22px}.rt{display:flex;gap:14px;align-items:center;font-size:12px;font-family:monospace}.onln{color:#2ebd85;display:inline-flex;align-items:center;gap:6px}.od{width:8px;height:8px;border-radius:50%;background:#2ebd85;animation:hpp 1.8s infinite}.fresh{position:fixed;bottom:10px;right:12px;z-index:60;color:#5c656f;font-family:'Space Mono',monospace;font-size:10px;background:rgba(10,13,17,.72);border:1px solid #1c2230;border-radius:8px;padding:4px 9px;-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);pointer-events:none}.card{position:relative;overflow:hidden}.kspark{position:absolute;left:0;right:0;bottom:0;width:100%;height:24px;opacity:.5}.kspark polyline{fill:none;stroke:#c2f64a;stroke-width:1.6;vector-effect:non-scaling-stroke}.dlt{font-size:10px;font-family:monospace;margin-left:6px}.dlt.up{color:#2ebd85}.dlt.dn{color:#ff6258}.cvsub{font-size:13px;color:#7f8893;font-weight:700;letter-spacing:0}
.vj-ck{display:inline-block;font-family:monospace;font-size:10px;color:#8fa0b3;background:rgba(255,255,255,.05);border:1px solid #232b36;border-radius:6px;padding:1px 6px;vertical-align:1px}
.vj-ck.money{color:#0a0b0d;background:#c2f64a;border-color:#c2f64a;font-weight:700}
.opsu{border:1px solid #1c2230;border-radius:12px;background:#0b0e13;margin-bottom:10px;overflow:hidden}
.opsu-h{display:flex;align-items:center;gap:8px;padding:9px 13px;background:#0e1218;border-bottom:1px solid #161c26;font-size:12.5px}
.opsu-h b{color:#e9e7df}.opsu-h .em{color:#5c656f;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px}
.opsu-agg{margin-left:auto;font-family:monospace;font-size:11.5px;display:flex;gap:12px;align-items:center;flex-shrink:0}
.opsp{display:grid;grid-template-columns:48px minmax(84px,1fr) 66px minmax(160px,1.6fr) minmax(110px,1.1fr) minmax(104px,1fr) 44px;gap:8px;align-items:center;padding:7px 13px;border-bottom:1px solid #10151d;font-family:monospace;font-size:11.5px}
.opsp:last-child{border-bottom:none}
.opsp .side{font-weight:800;font-size:10.5px;letter-spacing:.04em}
.opsp .sym{color:#e9e7df;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opsp .sym small{color:#5c656f;font-weight:400}
.opsp .sym .liqb{font-style:normal;font-size:9px;font-weight:800;color:#ff6258;border:1px solid rgba(255,98,88,.4);border-radius:4px;padding:0 4px;margin-left:4px;vertical-align:1px}
.opsp .pm{color:#9aa3ad;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opsp .pm .arr{font-style:normal;color:#5c656f}
.opsp .pnl{font-weight:700;text-align:right;white-space:nowrap}
.opsp .pnl small{font-weight:400;opacity:.8}
.ops-liq{display:flex;align-items:center;gap:7px;white-space:nowrap}
.ops-meter{flex:0 0 52px;height:5px;border-radius:4px;background:#1a212c;overflow:hidden}
.ops-meter i{display:block;height:100%;border-radius:4px}
.opsp .age{color:#5c656f;text-align:right}
@media(max-width:760px){.opsp{grid-template-columns:44px 1fr auto;row-gap:4px}.opsp .pm,.opsp .age{display:none}.opsu-h .em{display:none}}.card.rev .cv{color:#2ebd85}.goals{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}@media(max-width:620px){.goals{grid-template-columns:1fr}}.goal{background:#111419;border:1px solid #232932;border-radius:12px;padding:13px 15px}.goal-h{display:flex;justify-content:space-between;font-size:12px;color:#9aa3ad;margin-bottom:8px}.goal-h b{color:#e9e7df;font-family:monospace}.goal-h small{color:#5c656f}.goal-tr{height:8px;background:#1a1f27;border-radius:6px;overflow:hidden}.goal-f{height:100%;border-radius:6px;transition:width .4s}.funnel{background:#111419;border:1px solid #232932;border-radius:14px;padding:6px 16px}.fn-row{position:relative;display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #232932}.fn-row:last-child{border-bottom:none}.fn-bar{position:absolute;left:0;top:7px;bottom:7px;border-radius:6px;opacity:.2;z-index:0}.fn-lbl{position:relative;z-index:1;font-size:13px;flex:1}.fn-val{position:relative;z-index:1;font-family:monospace;color:#c2f64a;font-size:14px}.fn-val small{color:#5c656f;font-size:11px}.hourchart{display:flex;align-items:flex-end;gap:2px;height:120px;background:#111419;border:1px solid #232932;border-radius:14px;padding:12px 10px}.hcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:5px}.hbar{width:100%;background:linear-gradient(180deg,#c2f64a,#5f7d12);border-radius:3px 3px 0 0;min-height:2px}.hlbl{font-size:8px;color:#5c656f;font-family:monospace}.feed{background:#111419;border:1px solid #232932;border-radius:14px;padding:4px 16px;max-height:380px;overflow-y:auto}.fe{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid #232932;font-size:13px}.fe:last-child{border-bottom:none}.fe-f{font-size:16px}.fe-t{flex:1;color:#cdd3da}.fe-t b{color:#c2f64a}.fe-a{font-family:monospace;color:#5c656f;font-size:11px;white-space:nowrap}
.fe-t b{color:#e9e7df}.fe-on{color:#7f8893}.fe-ex{color:#c2f64a}
.fe-rev{display:inline-block;color:#0a0b0d;background:#c2f64a;font-size:9px;font-weight:700;padding:1px 6px;border-radius:5px;letter-spacing:.03em;white-space:nowrap;vertical-align:middle}
.feedcap{font-size:11.5px;color:#5c656f;margin:2px 0 9px;line-height:1.5}.feedcap b{color:#9aa3ad;font-weight:700}.lv{display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid #232932}.lv:last-child{border-bottom:none}.lv-f{font-size:21px;flex-shrink:0}.lv-b{flex:1;min-width:0}.lv-1{font-size:13.5px;color:#e9e7df;font-weight:600}.lv-dev{font-size:11px;margin-left:3px}.lv-2{font-size:12.5px;color:#9aa3ad;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lv-2 b{color:#c2f64a;font-weight:600}.lv-p{font-family:monospace;color:#c2f64a;font-weight:600}.lv-from{font-family:monospace;color:#9aa3ad}.lv-arr{color:#5c656f;font-weight:700;margin:0 2px}.lv-vid{width:8px;height:8px;border-radius:50%;flex-shrink:0;box-shadow:0 0 6px -1px currentColor}.lv-a{font-family:monospace;color:#5c656f;font-size:11px;white-space:nowrap;flex-shrink:0}.csv{color:#9aa3ad;text-decoration:none;border:1px solid #232932;border-radius:7px;padding:4px 9px}.csv:hover{color:#c2f64a;border-color:#c2f64a}.geotree{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#111419;border:1px solid #232932;border-radius:14px;padding:16px}.gt{display:inline-flex;align-items:center;gap:5px;border:1px solid #2a313b;border-radius:10px;padding:7px 11px;line-height:1;color:#e9e7df}.gt b{font-family:monospace}.gt small{color:#9aa3ad;font-size:.62em}.rangebar{display:inline-flex;gap:4px;background:#0d0f12;border:1px solid #232932;border-radius:10px;padding:3px;margin-bottom:12px}.rbtn{font-size:12px;color:#9aa3ad;text-decoration:none;padding:6px 13px;border-radius:7px}.rbtn.on{background:#c2f64a;color:#0a0b0d;font-weight:700}@media(max-width:620px){body{padding:18px 12px 50px}h1{font-size:19px}.hourchart{gap:1px;height:100px}.fe{font-size:12px;gap:8px}.topbar{flex-direction:column;align-items:flex-start;gap:8px}}.tabbar{display:flex;gap:4px;margin:6px 0 22px;border-bottom:1px solid #232932;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}.tabbar::-webkit-scrollbar{display:none}.tab{font-size:13px;font-weight:700;color:#9aa3ad;background:none;border:none;border-bottom:2px solid transparent;padding:11px 15px;cursor:pointer;margin-bottom:-1px;white-space:nowrap;flex:0 0 auto}.tab.on{color:#c2f64a;border-bottom-color:#c2f64a}
.tab{position:relative}
.noti-dot{position:absolute;top:4px;right:5px;width:8px;height:8px;border-radius:50%;background:#39ff14;box-shadow:0 0 5px #39ff14,0 0 11px rgba(57,255,20,.75);display:none;animation:notiPulse 1.5s ease-in-out infinite}
.tab.has-noti .noti-dot{display:block}
/* ===== command-center sidebar shell (desktop ≥861px) — restructures the tab bar into a grouped left nav; mobile keeps the existing pill row ===== */
.adm-brand,.adm-group{display:none}
.adm-alert{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}
/* visitor journeys — per-visitor page path, split desktop/mobile */
.vj-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:0 0 8px}
@media(max-width:760px){.vj-cols{grid-template-columns:1fr}}
.vj-col{background:#0c0f14;border:1px solid #1c2230;border-radius:13px;padding:12px;min-height:70px}
.vj-h{font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;color:#cdd3da;margin:0 2px 11px;display:flex;align-items:center;gap:6px}
.vj-h span{color:#5c656f;font-weight:400}
.vj{border:1px solid #1c2230;border-radius:10px;padding:9px 11px;margin-bottom:8px;background:#0a0d12}
.vj-top{display:flex;align-items:center;gap:8px;margin-bottom:7px;font-size:12px}
.vj-dot{width:9px;height:9px;border-radius:50%;flex:0 0 auto}
.vj-cc{color:#cdd3da;font-weight:600;white-space:nowrap;flex:0 0 auto}
.vj-src{color:#7f8893;font-family:'Space Mono',monospace;font-size:10.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.vj-a{color:#5c656f;font-family:'Space Mono',monospace;font-size:10px;flex:0 0 auto}
.vj-path{display:flex;flex-wrap:wrap;align-items:center;gap:5px}
.vj-pg{background:#12161d;border:1px solid #232b35;border-radius:6px;padding:3px 8px;font-size:11.5px;color:#e9e7df}
.vj-path .vj-pg:first-of-type{border-color:rgba(63,216,230,.4);color:#9fe0ff}
.vj-path .vj-pg:last-of-type{border-color:rgba(194,246,74,.4);color:#d4f87a}
.vj-arr{color:#5c656f;font-size:12px}
.adm-al{display:inline-flex;align-items:center;gap:7px;border-radius:11px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid #2a323c;background:#0e1116}
.adm-al b{font-family:'Space Mono',monospace}
.adm-al.red{color:#ff8a80;border-color:rgba(255,98,88,.45);background:rgba(255,98,88,.08)}
.adm-al.amber{color:#ffc371;border-color:rgba(255,179,71,.45);background:rgba(255,179,71,.07)}
.adm-al.ok{color:#7fe7bd;border-color:rgba(46,189,133,.4);background:rgba(46,189,133,.07);cursor:default}
@media(max-width:860px){.tab svg{display:none}}
@media(min-width:861px){
  body{padding-left:244px!important;max-width:1252px}
  .tabbar{position:fixed;left:0;top:0;bottom:0;width:208px;margin:0;border:none;border-right:1px solid #1c2230;border-radius:0;background:#0b0e13;padding:18px 12px;overflow-y:auto;display:flex;flex-direction:column;gap:2px;z-index:50;align-items:stretch}
  .adm-brand{display:block;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:15px;color:#e9e7df;padding:2px 10px 14px;letter-spacing:-.01em}
  .adm-brand b{color:#c2f64a}
  .adm-group{display:block;font-family:'Space Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:#5c656f;padding:16px 10px 6px}
  .tab{display:flex;align-items:center;gap:11px;width:100%;text-align:left;font-size:13.5px;font-weight:600;padding:10px 12px;border-radius:9px;color:#9aa3ad;background:none}
  .tab svg{width:17px;height:17px;flex:0 0 auto;opacity:.85}
  .tab.on{background:rgba(194,246,74,.12);color:#c2f64a}
  .tab.on svg{opacity:1}
  .tab:hover:not(.on){background:#12161d;color:#e9e7df}
  .tab .noti-dot{top:13px;right:10px}
}
@keyframes notiPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.6);opacity:.5}}.subbar{display:flex;gap:6px;flex-wrap:wrap;margin:2px 0 20px}.subtab{font-size:12px;font-weight:700;color:#9aa3ad;background:#111419;border:1px solid #232932;border-radius:9px;padding:8px 14px;cursor:pointer}.subtab.on{color:#0a0b0d;background:#c2f64a;border-color:#c2f64a}.subtab:hover:not(.on){border-color:#3a434f;color:#cdd3da}.setwrap{background:#111419;border:1px solid #232932;border-radius:14px;padding:6px 18px;max-width:540px}.setrow{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 0;border-bottom:1px solid #232932}.setrow:last-child{border-bottom:none}.setrow label{font-size:13.5px;color:#cdd3da}.setrow input[type=number]{width:120px;background:#0c0f13;border:1px solid #2f3742;border-radius:8px;padding:9px 11px;color:#e9e7df;font-family:monospace;font-size:14px;text-align:right}.sw{position:relative;width:46px;height:26px;flex-shrink:0}.sw input{opacity:0;width:0;height:0}.sw>span{position:absolute;inset:0;background:#2a313b;border-radius:999px;transition:.2s;cursor:pointer}.sw>span::before{content:'';position:absolute;height:20px;width:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}.sw input:checked+span{background:#2ebd85}.sw input:checked+span::before{transform:translateX(20px)}.sbtn{background:#c2f64a;color:#0a0b0d;font-weight:700;border:none;border-radius:9px;padding:11px 20px;cursor:pointer;font-size:13px}.smsg{font-size:12.5px;color:#9aa3ad;margin-left:12px}.rwd-accts,.rwd-wd{background:#111419;border:1px solid #232932;border-radius:14px;padding:4px 16px;max-height:400px;overflow-y:auto}.rwd-a,.wd-row{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #232932;font-size:13px}.rwd-a:last-child,.wd-row:last-child{border-bottom:none}.mono{font-family:monospace}.rwd-a .addr,.wd-row .addr{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#cdd3da;font-size:12px}.rwd-a .bal,.wd-row .bal{color:#c2f64a;font-family:monospace;white-space:nowrap}.rwd-a .meta{color:#5c656f;font-family:monospace;font-size:11px;white-space:nowrap}.wd-row .pay{background:#0c0f13;border:1px solid #2f3742;color:#c2f64a;border-radius:7px;padding:6px 11px;font-size:11px;font-family:monospace;cursor:pointer}.chatpost{display:flex;gap:8px;margin-top:12px}.chatpost input{flex:1;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:11px 13px;color:#e9e7df;font-size:14px}.chatpost input:focus{outline:none;border-color:#c2f64a}.rwd-a{cursor:pointer}.rwd-a:hover{background:rgba(255,255,255,.03)}.amodal{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.65);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px)}.amodal[hidden]{display:none}.amod-panel{width:100%;max-width:440px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#13171d,#0d1014);border:1px solid #2f3742;border-radius:16px;padding:18px 20px;box-shadow:0 30px 80px -20px rgba(0,0,0,.9)}.amod-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.amod-addr{font-family:monospace;font-size:12px;color:#cdd3da;word-break:break-all}.amod-x{background:none;border:none;color:#5c656f;font-size:18px;cursor:pointer;flex-shrink:0;padding:2px 6px}.amod-x:hover{color:#e9e7df}.amod-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.amod-cell{background:#0c0f13;border:1px solid #232932;border-radius:10px;padding:10px 12px}.amod-cell .k{font-family:monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.06em;color:#5c656f;margin-bottom:4px}.amod-cell .v{font-size:13.5px;color:#e9e7df;font-family:monospace;word-break:break-all}.amod-sec{font-family:monospace;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#5c656f;margin:15px 0 8px}.amod-actions{display:flex;gap:8px;margin-top:16px}.amod-btn{flex:1;background:#0c0f13;border:1px solid #2f3742;color:#cdd3da;border-radius:9px;padding:11px;font-size:13px;font-weight:700;cursor:pointer}.amod-btn:hover{border-color:#5c656f;color:#fff}.amod-btn.danger{color:#ff8a80;border-color:rgba(255,98,88,.4)}.amod-btn.danger:hover{background:rgba(255,98,88,.12);border-color:#ff6258}.amod-msg{font-size:12.5px;color:#9aa3ad;margin-top:10px;text-align:center;min-height:16px}.amod-ta{width:100%;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:10px 12px;color:#e9e7df;font-size:13px;font-family:inherit;resize:vertical;min-height:62px;box-sizing:border-box}.amod-ta:focus{outline:none;border-color:#c2f64a}.sup-item{background:#111419;border:1px solid #232932;border-radius:12px;padding:13px 15px;margin-bottom:10px}.sup-h{display:flex;align-items:center;gap:8px}.sup-email{color:#cdd3da;font-size:13.5px;font-weight:700;word-break:break-all}.sup-addr{color:#7f8893;font-family:monospace;font-size:11px;margin-top:3px;word-break:break-all}.sup-msg{color:#9aa3ad;font-size:13px;margin:8px 0 11px;white-space:pre-wrap;line-height:1.5}.sup-reply{border-top:1px solid #232932;padding-top:11px;display:flex;flex-direction:column;gap:8px}.sup-subj,.sup-body{background:#0c0f13;border:1px solid #2f3742;border-radius:8px;padding:9px 11px;color:#e9e7df;font-family:inherit;font-size:13px;width:100%;box-sizing:border-box}.sup-body{min-height:72px;resize:vertical}.sup-subj:focus,.sup-body:focus{outline:none;border-color:#c2f64a}.sup-rbtn{display:flex;align-items:center;gap:10px}.sup-badge{color:#2ebd85;font-family:monospace;font-size:11px}
.sup-bar{display:flex;align-items:center;gap:8px;margin:0 0 12px}
.sup-tab{background:#111419;border:1px solid #232932;border-radius:8px;color:#9aa3ad;font:inherit;font-size:13px;font-weight:700;padding:7px 14px;cursor:pointer}
.sup-tab.on{background:#1c2330;border-color:#2f72ff;color:#e9eef7}
.sup-ct{display:inline-block;min-width:16px;text-align:center;background:#232932;border-radius:20px;font-size:11px;padding:1px 6px;margin-left:5px;color:#cdd3da}
.sup-tab.on .sup-ct{background:#2f72ff;color:#fff}
.sbtn.ghost{background:transparent;border:1px solid #2f3742;color:#9aa3ad}
.sup-compose{border:1px solid #2f72ff}
.sup-nemail{background:#0c0f13;border:1px solid #2f3742;border-radius:8px;padding:9px 11px;color:#e9e7df;font:inherit;font-size:13px;width:100%;box-sizing:border-box}
.sup-mine{background:#22303f;color:#7fb0ff;font-size:10.5px;font-weight:700;border-radius:5px;padding:2px 7px;margin-left:8px}
.sup-done{opacity:.8}.rwd-risk{display:flex;flex-wrap:wrap;gap:8px 16px;background:#111419;border:1px solid #232932;border-radius:12px;padding:11px 15px;font-size:12.5px;color:#9aa3ad;margin-bottom:4px}.rwd-risk b{font-family:monospace;color:#e9e7df}.rwd-controls{display:flex;gap:8px;margin-bottom:9px}.rwd-controls #rwdSearch{flex:1;min-width:0;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:10px 13px;color:#e9e7df;font-size:13px}.rwd-controls #rwdSearch:focus{outline:none;border-color:#c2f64a}.rwd-controls select{background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:10px 11px;color:#e9e7df;font-size:13px;cursor:pointer}.rwd-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.rwd-chips button{font-size:12px;font-weight:700;color:#9aa3ad;background:#111419;border:1px solid #232932;border-radius:8px;padding:6px 12px;cursor:pointer}.rwd-chips button.on{color:#0a0b0d;background:#c2f64a;border-color:#c2f64a}.rwd-chips button:hover:not(.on){border-color:#3a434f;color:#cdd3da}.rbadge{font-family:monospace;font-size:10px;border-radius:5px;padding:1px 5px;margin-left:4px;white-space:nowrap}.rwd-a .badges{display:flex;gap:0;flex-shrink:0}.setrow label small{display:block;color:#5c656f;font-weight:400;font-size:11px;margin-top:2px}.shintbox{font-size:12px;color:#9aa3ad;font-family:monospace;background:#0c0f13;border:1px solid #232932;border-radius:10px;padding:10px 13px;margin:8px 0 0;line-height:1.8;max-width:540px}.shintbox b{color:#c2f64a}</style><link rel="stylesheet" href="/assets/fonts.css"><style>/* admin visual refresh v2 — override layer */
body{background:radial-gradient(1100px 520px at 50% -160px,#13181f 0%,#0a0b0d 62%) no-repeat #0a0b0d;max-width:1040px;padding:30px 22px 90px;font-family:'Familjen Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
h1{font-family:'Bricolage Grotesque',sans-serif;font-size:26px;font-weight:800;letter-spacing:-.025em;margin:0 0 3px}
h2{font-family:'Bricolage Grotesque',sans-serif;font-size:16.5px;font-weight:700;color:#eef1f4;text-transform:none;letter-spacing:-.01em;margin:32px 0 13px;padding-left:13px;border-left:3px solid #c2f64a;line-height:1.18}
h2 span{color:#6b7480;font-size:12.5px;font-weight:400;letter-spacing:0}
.muted{font-size:12px;color:#6b7480}
.topbar{background:linear-gradient(180deg,#14181f,#0e1116);border:1px solid #242b34;border-radius:16px;padding:15px 20px;margin-bottom:20px}
.cards{gap:13px}
.card{background:linear-gradient(180deg,#14181f,#0e1116);border:1px solid #242b34;border-radius:16px;padding:17px 18px;transition:border-color .15s ease,transform .15s ease}
.card:hover{border-color:#3a4450;transform:translateY(-2px)}
.cv{font-family:'Space Mono',monospace;font-size:30px;font-weight:700;letter-spacing:-1.5px}
.cl{font-size:10.5px;color:#8893a0;margin-top:8px;letter-spacing:.07em}
.tabbar{gap:5px;border-bottom:none;background:#0e1116;border:1px solid #242b34;border-radius:14px;padding:5px;margin:6px 0 22px}
.tab{font-size:13px;font-weight:700;border:none;border-radius:10px;padding:9px 16px;margin:0;color:#9aa3ad;transition:background .13s,color .13s}
.tab:hover{color:#eef1f4}
.tab.on{color:#0a0b0d;background:#c2f64a;border-bottom:none}
.tab .noti-dot{top:6px;right:8px}
.subbar{gap:7px;margin:2px 0 20px}
.subtab{border-radius:999px;padding:7px 15px;background:#13171d;border-color:#242b34}
.feed,.list,.funnel,.chart,.hourchart,.geotree,.rwd-accts,.rwd-wd,.setwrap{background:linear-gradient(180deg,#13171d,#0e1116);border-color:#242b34;border-radius:16px}
.fe,.lv,.row,.wd-row,.rwd-a{border-color:#1c232b}
.fe:hover,.lv:hover{background:rgba(255,255,255,.02)}
.fe-t{color:#d3d9df;font-size:13px}.fe-t b{color:#eef1f4}
.goals{gap:13px}.goal{background:linear-gradient(180deg,#14181f,#0e1116);border-color:#242b34;border-radius:14px;padding:15px 17px}
.hp{border-radius:16px;background:linear-gradient(180deg,#13171d,#0e1116);border-color:#242b34}
.amod-panel{border-radius:18px}.csv{border-radius:9px;border-color:#242b34}.sl{font-size:13px}
.sup-item,.sup-compose{background:linear-gradient(180deg,#13171d,#0e1116);border-color:#242b34;border-radius:16px}
.sup-tab{border-radius:999px}.sup-tab.on{background:#1c2330;border-color:#c2f64a;color:#eef1f4}
.rwd-risk{border-radius:14px;background:linear-gradient(180deg,#13171d,#0e1116);border-color:#242b34}
.card.has-tip{cursor:help;overflow:visible}
.card.has-tip .cl::after{content:'?';display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;border:1px solid #3a4450;color:#8893a0;font-size:8.5px;font-weight:700;margin-left:6px;vertical-align:middle;transition:.13s}
.card.has-tip:hover,.card.has-tip.tipon{border-color:#c2f64a}
.card.has-tip:hover .cl::after,.card.has-tip.tipon .cl::after{border-color:#c2f64a;color:#c2f64a}
.card[data-tip]:hover::before,.card[data-tip].tipon::before{content:attr(data-tip);position:absolute;left:14px;right:14px;bottom:calc(100% + 7px);z-index:30;background:#0c0f13;border:1px solid #3a4450;border-radius:11px;padding:10px 13px;font-family:'Familjen Grotesk',sans-serif;font-size:11.5px;font-weight:400;line-height:1.5;color:#cdd3da;box-shadow:0 14px 34px -10px rgba(0,0,0,.85);white-space:normal;text-transform:none;letter-spacing:0}
@media(max-width:620px){body{padding:20px 13px 70px}h1{font-size:22px}}
</style></head><body><h1>MarginPad — Admin</h1><div class="topbar"><div class="muted">Private · hashed IDs, no cookies, no raw IP · auto-refresh 60s</div><div class="rt"><span class="onln"><span class="od"></span><span id="onln">${online}</span> online now</span><span class="fresh" id="fresh">updated just now</span><a class="csv" href="/api/bug" target="_blank">💬 Message Claude</a><a class="csv" href="?key=${esc(url.searchParams.get('key') || '')}&amp;format=csv">⬇ CSV</a></div></div><nav class="tabbar"><div class="adm-brand">MARGIN<b>PAD</b> · ops</div><button class="tab on" data-tab="stats"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg><span>Dashboard</span></button><div class="adm-group">Operations</div><button class="tab" data-tab="rewards"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg><span>Faucet &amp; Rewards</span><span class="noti-dot"></span></button><button class="tab" data-tab="users"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/></svg><span>Users</span><span class="noti-dot"></span></button><button class="tab" data-tab="ops"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg><span>Live trades</span></button><button class="tab" data-tab="support"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.38 8.38 0 0 1 8.5-8.5 8.5 8.5 0 0 1 8.5 8.5z"/></svg><span>Support</span><span class="noti-dot"></span></button><button class="tab" data-tab="chat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="13" y2="13"/></svg><span>Chat</span><span class="noti-dot"></span></button><div class="adm-group">Security</div><button class="tab" data-tab="security"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v5.5c0 4.5-3.2 7.7-8 9.5-4.8-1.8-8-5-8-9.5V6z"/><path d="M9 12l2 2 4-4.2"/></svg><span>Security</span></button><div class="adm-group">Configure</div><button class="tab" data-tab="settings"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg><span>Settings</span></button></nav><div id="tab-stats"><div id="admAlert" class="adm-alert"></div><div class="subbar"><button class="subtab on" data-sub="overview">Overview</button><button class="subtab" data-sub="traffic">Traffic</button><button class="subtab" data-sub="behavior">Behavior</button><button class="subtab" data-sub="pages">Pages</button><button class="subtab" data-sub="channels">Channels</button><button class="subtab" data-sub="health">Health</button></div><div class="substat" data-sub="overview"><h2 style="margin-top:0">Today <span>(UTC · ▲▼ vs yesterday · updates live)</span></h2><div class="cards" id="topCards" style="grid-template-columns:repeat(4,1fr)">${tile('tUv', N(uvToday), 'Visitors today', spark(uvDays), dpc(uvToday, uvY))}${tile('tRet', N(retT) + ' <small class="cvsub">' + retPct + '%</small>', 'Returning today', spark(retD), dpc(retT, retY))}${tile('tAff', N(affTod), 'Affiliate clicks today', spark(affDays), dpc(affTod, affY))}${tile('tRev', '$' + N(revTodayEst), 'Est. revenue today', '', '', 'rev')}${tile('tPv', N(pvTod), 'Pageviews today', spark(pvDays), dpc(pvTod, pvY))}${tile('tSign', '…', 'Signups today')}${tile('tFauc', '…', 'Faucet dispensed today')}${tile('botf', N(botToday), 'Bots filtered today')}</div><div class="feedcap" style="margin:8px 0 0">How to read: every tile is <b>today only</b>. <b>Returning</b> = a visitor already seen on an earlier day (your retention number). <b>Est. revenue</b> = clicks × ~$0.45 — a rough guess, NOT real commission. All-time: <b id="tUvTot">${N(uvTotal)}</b> visitors · <b id="tPvTot">${N(pvTotal)}</b> pageviews · <b id="tAffTot">${N(affiliate)}</b> affiliate clicks. Tap a tile for its explanation.</div><h2>Data feed <span>(collector + market data)</span></h2>${healthHtml}<h2>Live activity <span>(what people are DOING right now)</span></h2><div class="feedcap">Tools opened, paper trades, and <b>💰 exchange click-outs</b> — the money clicks. Updates every 12s.</div><div class="feed" id="evFeed">${feed}</div><h2>Visitor journeys <span>(where each person goes — grouped by visitor, split by device)</span></h2><div class="feedcap"><b>Follow each visitor's path through the site.</b> Every coloured row is one person: where they landed (the <span class="lv-from">source/entry</span>), then each page they opened — <span style="color:#9fe0ff">cyan = first page</span>, <span style="color:#d4f87a">lime = latest</span>. <b>Desktop</b> and <b>mobile</b> are split so you see how each behaves.</div><div class="vj-cols"><div class="vj-col"><div class="vj-h">🖥 Desktop <span id="vjDeskN"></span></div><div id="vjDesk"><div class="empty">loading…</div></div></div><div class="vj-col"><div class="vj-h">📱 Mobile <span id="vjMobN"></span></div><div id="vjMob"><div class="empty">loading…</div></div></div></div></div><div class="substat" data-sub="traffic" hidden><h2>Date range</h2>${rangeBar}<div class="cards">${card(N(uvR), 'Visitors')}</div><h2>Unique visitors — last 14 days</h2><div class="chart">${daychart}</div>${histHtml}<h2>Conversion funnel <span>(all-time)</span></h2><div class="funnel">${funnel}</div><div class="sl"><b>${ppv.toFixed(1)}</b> pages per visitor · <b>${ctr.toFixed(1)}%</b> ever clicked an exchange · <b>${bounce.toFixed(0)}%</b> left after one page (all-time)</div></div><div class="substat" data-sub="behavior" hidden><h2>Where people click <span>(what they tap, most → least)</span></h2><div class="heatrow"><div><div class="heat">${hcells}</div><div class="cap">page heatmap · top = page top · brighter = more clicks</div></div><div><div class="list">${barlist(elsPretty)}</div></div></div><h2>Exchanges clicked <span>(clicks · est. $)</span></h2><div class="list">${exRevList}</div><h2>Exchange link-outs by page <span>(which page drives the money clicks)</span></h2><div class="list">${xPageList}</div><div class="two"><div><h2>Tools clicked</h2><div class="list">${barlist(tools)}</div></div><div><h2>Calculators used</h2><div class="list">${barlist(tabs)}</div></div></div><div class="two"><div><h2>Paper Trade — symbols</h2><div class="list">${barlist(paperSym)}</div></div><div><h2>Paper Trade — leverage</h2><div class="list">${barlist(levO)}</div></div></div><div class="two"><div><h2>Scroll depth <span>(% reached)</span></h2><div class="list">${barlist(scrollO)}</div></div><div><h2>Time on page</h2><div class="list">${barlist(timeO)}</div></div></div></div><div class="substat" data-sub="pages" hidden>${aeSection}<h2>Top pages <span>(unique visitors)</span></h2><div class="list">${barlist(pages)}</div><h2>Countries <span>(box size = share of visitors)</span></h2><div class="geotree">${geoTree}</div><h2>Traffic sources</h2><div class="list">${barlist(refD)}</div></div><div class="substat" data-sub="channels" hidden><h2>Blog comments <span>(engagement)</span></h2><div class="cards" style="margin-bottom:14px">${card(cmtTotal.toLocaleString('en-US'), 'Total comments')}</div>${cmtPosts.length ? '<div class="list">' + barlist(cmtPosts) + '</div>' : '<div class="empty" style="padding:0 0 4px">no comments yet</div>'}<h2>Telegram bot</h2><div class="cards" style="margin-bottom:14px">${card(botMsg.toLocaleString('en-US'), 'Bot messages')}${card(botUsers.toLocaleString('en-US'), 'Bot users')}</div>${botCmds.length ? '<div class="list">' + barlist(botCmds) + '</div>' : '<div class="empty" style="padding:0 0 4px">no bot activity yet</div>'}${other.length ? '<h2>Other events</h2><div class="list">' + barlist(other) + '</div>' : ''}</div><div class="substat" data-sub="health" hidden><h2 style="margin-top:0">Site health <span>(client crashes + server errors)</span></h2>${errHtml}</div></div><div id="tab-settings" hidden><h2>Master switches <span>(applies instantly — no deploy)</span></h2><div class="setwrap"><div class="setrow"><label for="sEnabled">Faucet enabled<small>users can claim</small></label><label class="sw"><input type="checkbox" id="sEnabled"><span></span></label></div><div class="setrow"><label for="sWdEnabled">Withdrawals enabled<small>users can cash out</small></label><label class="sw"><input type="checkbox" id="sWdEnabled"><span></span></label></div><div class="setrow"><label for="sPromoEnabled">Promo posts enabled<small>the earn-per-post panel on /rewards</small></label><label class="sw"><input type="checkbox" id="sPromoEnabled"><span></span></label></div></div><h2>Claim economics</h2><div class="setwrap"><div class="setrow"><label for="sAmount">Amount per claim ($)</label><input type="number" id="sAmount" step="0.01" min="0"></div><div class="setrow"><label for="sCooldown">Cooldown (seconds)</label><input type="number" id="sCooldown" step="30" min="0"></div><div class="setrow"><label for="sPerDay">Daily cap per address ($)</label><input type="number" id="sPerDay" step="0.5" min="0"></div><div class="setrow"><label for="sCap">Global daily budget ($)</label><input type="number" id="sCap" step="1" min="0"></div><div class="setrow"><label for="sWelcome">Sign-up welcome bonus ($)<small>one-time, credited on registration · 0 = off</small></label><input type="number" id="sWelcome" step="0.05" min="0"></div><div class="setrow"><label for="sPromo">Promo post reward ($)<small>per approved X / TikTok post · manual review on the Rewards tab</small></label><input type="number" id="sPromo" step="0.5" min="0"></div></div><div class="shintbox" id="sHints"></div><h2>Withdrawals</h2><div class="setwrap"><div class="setrow"><label for="sMinWd">Minimum withdrawal ($)</label><input type="number" id="sMinWd" step="0.5" min="0"></div><div class="setrow"><label for="sMinClaimsWd">Min claims before withdrawal<small>0 = no requirement</small></label><input type="number" id="sMinClaimsWd" step="1" min="0"></div></div><h2>Anti-abuse</h2><div class="setwrap"><div class="setrow"><label for="sIpCap">Max new wallets / IP / day</label><input type="number" id="sIpCap" step="1" min="0"></div><div class="setrow"><label for="sRequireOnchain">Require on-chain wallet<small>must have BNB-chain activity</small></label><label class="sw"><input type="checkbox" id="sRequireOnchain"><span></span></label></div></div><h2>Pause message <span>(shown to users when claims are off · optional)</span></h2><div class="setwrap" style="padding:14px 18px"><textarea id="sPauseMsg" class="amod-ta" rows="2" maxlength="300" placeholder="e.g. Back tomorrow at 09:00 UTC — the daily budget refills then." style="max-width:none"></textarea></div><h2>Site announcement <span>(banner shown to every visitor · for outages / issues)</span></h2><div class="setwrap" style="padding:14px 18px"><div class="setrow" style="border:none;padding:0 0 8px"><label for="sAnnLevel">Severity</label><select id="sAnnLevel" style="background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:8px 10px;color:#e9e7df;font-family:inherit"><option value="">Off — no banner</option><option value="fix">Fix / small bug — green</option><option value="blocker">Blocker — orange</option><option value="severe">Severe — red</option></select></div><textarea id="sAnnMsg" class="amod-ta" rows="2" maxlength="300" placeholder="e.g. We are aware of an issue with withdrawals and are fixing it now." style="max-width:none"></textarea><div class="setrow" style="border:none;padding:8px 0 0"><button class="sbtn" id="sAnnBtn" type="button">Publish banner</button><span id="sAnnSt" class="smsg"></span></div></div><h2>AI assistant <span>(Ask AI on Charts · daily questions per user)</span></h2><div class="setwrap"><div class="setrow"><label for="sAiLimit">Default questions / user / day<small>everyone without a per-user override</small></label><input type="number" id="sAiLimit" step="1" min="0" style="width:120px"></div><div class="setrow" style="border:none;padding:10px 0 4px"><button class="sbtn" id="sAiSave" type="button">Save AI limit</button><span id="sAiSt" class="smsg"></span><span class="smsg" style="margin-left:auto">Per-user limits: set on a user's profile (Users tab)</span></div></div><h2>Leaderboard prizes <span>(weekly · shown on /rewards &amp; Telegram)</span></h2><div class="setwrap"><div class="setrow"><label for="sPrize1">🥇 1st place ($)</label><input type="number" id="sPrize1" step="1" min="0"></div><div class="setrow"><label for="sPrize2">🥈 2nd place ($)</label><input type="number" id="sPrize2" step="1" min="0"></div><div class="setrow"><label for="sPrize3">🥉 3rd place ($)</label><input type="number" id="sPrize3" step="1" min="0"></div></div><div class="setrow" style="max-width:540px;border:none;margin-top:14px"><button class="sbtn" id="sSave">Save all settings</button><span id="sMsg" class="smsg"></span></div></div><div id="tab-rewards" hidden><div class="cards" id="rwdCards" style="margin-bottom:8px"></div><div id="rwdRisk" class="rwd-risk"></div><h2>Needs attention <span>(possible multi-accounting / abuse · click to inspect)</span></h2><div class="rwd-accts" id="rwdFlagged" style="max-height:300px"><div class="empty">loading…</div></div><h2>Pending withdrawals <span>(send USDT on BSC, then mark paid)</span></h2><div class="rwd-wd" id="rwdWd"><div class="empty">loading…</div></div><h2>Promo posts <span>(X / TikTok · $ per approved post · open the link, check it mentions the site, approve only after 24h live)</span></h2><div class="promo-rej" style="display:flex;gap:8px;align-items:flex-start;margin:0 0 10px;flex-wrap:wrap"><textarea id="promoRejMsg" rows="2" maxlength="200" placeholder="Saved reject reason — e.g. 'Post must mention marginpad.io and stay public 24h.' Reused for every reject." style="flex:1;min-width:240px;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:9px 11px;color:#e9e7df;font-size:12.5px;font-family:inherit;resize:vertical"></textarea><button class="sbtn" id="promoRejSave" type="button" style="flex:0 0 auto">Save reason</button><span id="promoRejSt" class="smsg"></span></div><div class="rwd-wd" id="rwdPromo"><div class="empty">loading…</div></div><h2>Leaderboard — this week <span>(top ROE · eject anyone abusing it)</span></h2><div class="rwd-wd" id="rwdLb"><div class="empty">loading…</div></div><h2>Leaderboard history <span>(past weekly winners)</span></h2><div style="margin:0 0 9px"><select id="rwdLbHistSel" style="background:#12161d;color:#e9e7df;border:1px solid #242b34;border-radius:8px;padding:8px 11px;font-size:13px;font-weight:600;cursor:pointer;width:100%;max-width:360px"></select></div><div class="rwd-wd" id="rwdLbHist"><div class="empty">loading…</div></div><h2>All accounts <span id="rwdAcctCount">(loading…)</span></h2><div class="rwd-controls"><input id="rwdSearch" type="text" placeholder="Search username, email or country…" autocomplete="off"><select id="rwdSort"><option value="new">Newest</option><option value="claims">Most claims</option><option value="bal">Highest balance</option><option value="risk">Highest risk</option></select></div><div class="rwd-chips" id="rwdFilters"><button type="button" data-f="all" class="on">All</button><button type="button" data-f="flagged">Flagged</button><button type="button" data-f="banned">Banned</button><button type="button" data-f="balance">Has balance</button></div><div class="rwd-accts" id="rwdAccts"><div class="empty">loading…</div></div><div class="two" style="margin-top:8px"><div><h2>Live claims <span>(latest · every 6s)</span></h2><div class="rwd-wd" id="rwdLog"><div class="empty">loading…</div></div></div><div><h2>Paid withdrawals <span>(with tx hash)</span></h2><div class="rwd-wd" id="rwdPaid"><div class="empty">loading…</div></div></div></div></div><div id="tab-security" hidden><div class="cards" id="secCards" style="margin-bottom:8px"></div><h2>Risk-ranked accounts <span>(0–100 risk score · Green/Yellow/Orange/Red · click to inspect)</span></h2><div class="rwd-accts" id="secList"><div class="empty">loading…</div></div><h2>IP-sharing accounts <span>(multiple wallets from one IP — likely the same person · click to inspect)</span></h2><div class="rwd-wd" id="secClusters"><div class="empty">loading…</div></div></div><div id="tab-support" hidden><h2>Support inbox <span>(messages from the contact form · reply by email)</span></h2><div class="smsg" id="supSetup" style="margin:0 0 12px"></div><div class="sup-bar"><button class="sup-tab on" id="supTabActive">Active</button><button class="sup-tab" id="supTabClosed">Closed</button><button class="sbtn sup-new-btn" id="supNewBtn" style="margin-left:auto">+ New ticket</button></div><div id="supCompose" hidden class="sup-item sup-compose"><div class="sup-h"><span class="sup-email">New ticket — reach a user by email</span></div><input class="sup-nemail" placeholder="user@email.com" autocomplete="off"><input class="sup-subj sup-nsubj" value="MarginPad Support" style="margin-top:8px"><textarea class="sup-body sup-nbody" placeholder="Write your message — sent from support@marginpad.io"></textarea><div class="sup-rbtn"><button class="sbtn sup-nsend">Send &amp; open ticket</button><button class="sbtn ghost sup-ncancel">Cancel</button><span class="smsg sup-nst"></span></div></div><div id="supList"><div class="empty">loading…</div></div></div><div id="tab-chat" hidden><h2>Trader chat <span>(live — moderate, post as MarginPad)</span></h2><div class="rwd-wd" id="chatMsgs" style="max-height:440px"><div class="empty">loading…</div></div><div class="chatpost"><input id="chatPostIn" type="text" placeholder="Post as MarginPad…" maxlength="280"><button class="sbtn" id="chatPostBtn">Send</button></div><button class="pay" id="chatClearBtn" style="margin-top:12px">Clear all messages</button><h2 style="margin-top:26px">📢 Telegram channel <span>(broadcast an announcement to your channel)</span></h2><div class="setrow" style="border:none;padding:2px 0 8px;max-width:540px;flex-wrap:wrap;gap:8px"><button class="sbtn" id="tgNewsBtn" type="button" style="background:#1a1f27;color:#e9e7df">📰 Insert a news article…</button><button class="sbtn" id="tgTplBtn" type="button" style="background:#1a1f27;color:#e9e7df">+ MarginPad footer</button><span id="tgNewsMsg" class="smsg"></span></div><div id="tgNewsList" hidden style="max-height:300px;overflow:auto;margin:0 0 10px"></div><div class="setwrap" style="padding:14px 18px"><textarea id="tgBcIn" class="amod-ta" rows="4" maxlength="1000" placeholder="Write an announcement — posts to your Telegram channel. Basic HTML (&lt;b&gt;, &lt;a href&gt;) works." style="max-width:none"></textarea></div><div class="setrow" style="max-width:540px;border:none;padding:8px 0 0"><input id="tgBcImg" type="text" autocomplete="off" placeholder="Image URL (optional) — attaches a small photo above the post" style="width:100%;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:9px 12px;color:#e9e7df;font-size:12.5px;font-family:inherit"></div><div class="setrow" style="max-width:540px;border:none;margin-top:10px"><button class="sbtn" id="tgBcBtn">Post to channel</button><span id="tgBcMsg" class="smsg"></span></div></div><div id="tab-ops" hidden><div class="cards" id="opsKpis" style="margin-bottom:12px"></div><div style="border:1px solid #1c2230;border-radius:14px;background:#0e1116;padding:14px 16px"><div class="row" style="margin-bottom:12px;align-items:center"><h2 style="margin:0;flex:1;font-size:16px">Live trades <span class="muted" style="font-weight:400;font-size:12px">· signed-in users' open positions · auto-refresh 12s</span></h2><select id="opsSort" style="background:#12161d;color:#e9e7df;border:1px solid #242b34;border-radius:8px;padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer"><option value="pnl">Sort: P&amp;L</option><option value="liq">Sort: Closest to liq</option><option value="age">Sort: Newest</option><option value="margin">Sort: Margin</option></select></div><div id="opsBody"><div class="empty">loading…</div></div></div></div><div id="tab-users" hidden><div class="cards" id="uCards" style="margin-bottom:10px"></div><h2>Registered users <span>(newest first · click to inspect)</span></h2><div class="rwd-controls"><input id="uSearch" type="text" placeholder="Search by email…" autocomplete="off"></div><div class="rwd-accts" id="uList"><div class="empty">loading…</div></div><button class="sbtn" id="uMore" style="margin-top:12px;background:#1a1f27;color:#e9e7df;display:none">Load more</button></div><div class="amodal" id="acctModal" hidden><div class="amod-panel"><div class="amod-head"><span class="amod-addr" id="amAddr"></span><button class="amod-x" id="amClose" type="button">✕</button></div><div id="amBody"><div class="amod-msg">loading…</div></div><div class="amod-sec">Adjust balance</div><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input id="amAdjAmt" type="number" step="0.01" min="0" placeholder="USD amount" style="flex:1;min-width:110px;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:9px 12px;color:#e9e7df;font-size:14px;outline:none"><button class="amod-btn" id="amAdjAdd" type="button" style="flex:none;width:auto;padding:9px 16px;color:#2ebd85;border-color:rgba(46,189,133,.5)">+ Add</button><button class="amod-btn danger" id="amAdjSub" type="button" style="flex:none;width:auto;padding:9px 16px">− Subtract</button></div><div style="font-size:11px;color:#7f8893;margin:5px 0 2px">Add or remove USD on this user's balance (tournament / claim corrections). Clamps at \$0, logged for audit.</div><div class="amod-sec">Private note (only you see this)</div><textarea id="amNote" class="amod-ta" placeholder="Notes about this address…" rows="3"></textarea><button class="amod-btn" id="amNoteSave" type="button" style="margin-top:8px;flex:none;width:auto;padding:9px 16px">Save note</button><div class="amod-sec">Message to user <span style="text-transform:none;letter-spacing:0;color:#7f8893">(shows as a banner on /rewards)</span></div><textarea id="amUserMsg" class="amod-ta" placeholder="Write a message this user will see when they open /rewards…" rows="3"></textarea><div style="display:flex;align-items:center;gap:10px;margin-top:8px"><button class="amod-btn" id="amMsgSend" type="button" style="flex:none;width:auto;padding:9px 16px">Send message</button><span class="amod-msg" id="amMsgState" style="margin:0;text-align:left;flex:1;min-width:0"></span></div><div class="amod-actions"><button class="amod-btn" id="amUnlock" type="button">Unlock device</button><button class="amod-btn danger" id="amBan" type="button">Ban from faucet</button><button class="amod-btn danger" id="amLbBan" type="button">Remove from leaderboard</button><button class="amod-btn danger" id="amRemove" type="button">Remove account</button></div><div class="amod-msg" id="amMsg"></div></div></div><div class="amodal" id="userModal" hidden><div class="amod-panel"><div class="amod-head"><span class="amod-addr" id="umEmail"></span><button class="amod-x" id="umClose" type="button">✕</button></div><div id="umBody"><div class="amod-msg">loading…</div></div></div></div><script>(function(){
  var key=${JSON.stringify(url.searchParams.get('key') || '')},t=Date.now(),CC=${JSON.stringify(ccName)};
  function ago(ts){var s=Math.round((Date.now()-ts)/1000);return s<60?s+'s':s<3600?Math.floor(s/60)+'m':Math.floor(s/3600)+'h';}
  function flag(cc){return /^[A-Z]{2}$/.test(cc)?String.fromCodePoint(127397+cc.charCodeAt(0),127397+cc.charCodeAt(1)):'';}
  function srcName(s){if(!s||s==='direct')return 'Direct (typed the URL or bookmark)';if(/syndicatedsearch|googlesyndication|googleadservices|doubleclick/.test(s))return 'Google Ads / search partner';if(/google\\./.test(s))return 'Google search';if(/bing\\./.test(s))return 'Bing';if(/yahoo/.test(s))return 'Yahoo';if(/yandex/.test(s))return 'Yandex';if(/duckduckgo/.test(s))return 'DuckDuckGo';if(/ecosia/.test(s))return 'Ecosia';if(/brave/.test(s))return 'Brave Search';if(/t\\.co|twitter|x\\.com/.test(s))return 'X / Twitter';if(/reddit/.test(s))return 'Reddit';if(/youtu/.test(s))return 'YouTube';if(/facebook|fb\\./.test(s))return 'Facebook';if(/instagram/.test(s))return 'Instagram';if(/tiktok/.test(s))return 'TikTok';if(/linkedin/.test(s))return 'LinkedIn';if(/t\\.me|telegram/.test(s))return 'Telegram';if(/discord/.test(s))return 'Discord';return s;}
  function pageShort(pth){var s=String(pth||'').replace(/^\\/[a-z]{2}\\//,'/');if(s==='/'||s==='')return 'the homepage';var m;if((m=s.match(/^\\/coin\\/([a-z0-9]+)\\/?$/i)))return m[1].toUpperCase()+' coin page';var M={'/funding/':'the Funding page','/liquidations/':'the Liquidations page','/long-short/':'the Long/Short page','/open-interest/':'the Open Interest page','/screener':'the Screener','/screener/':'the Screener','/paper-trade':'Paper Trade','/paper-trade/':'Paper Trade','/charts':'Charts','/charts/':'Charts','/rekt/':'the Rekt feed','/rewards/':'Rewards','/calculators':'Calculators','/calculators/':'Calculators','/blog/':'the Blog'};if(M[s])return M[s];if((m=s.match(/^\\/([a-z0-9-]+)\\/?$/i)))return m[1].replace(/-/g,' ')+' page';return s;}
  function verb(t){return t==='tab'?'used a calculator':(t==='nav'||t==='el')?'clicked a link':('did '+t);}
  function evLine(x){var where=x.p?' <span class="fe-on">on '+esc(pageShort(x.p))+'</span>':'';var tg=x.e?esc(x.e):'';if(x.t==='exchange')return 'clicked through to <b class="fe-ex">'+(tg||'an exchange')+'</b>'+where+' <span class="fe-rev">💰 money click</span>';if(x.t==='paper')return 'opened a paper trade'+(tg?' <b>'+tg+'</b>':'');if(x.t==='hotpair')return 'opened <b>'+tg+'</b> from Trending';if(x.t==='tool')return 'opened '+(tg?'<b>'+tg+'</b> ':'a ')+'tool'+where;return verb(x.t)+(tg?' <b>'+tg+'</b>':'')+where;}
  function esc(s){return String(s).replace(/[<>&]/g,function(m){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
  function N(x){return (x||0).toLocaleString('en-US');}
  function dev(d){return d==='mobile'?'📱':d==='tablet'?'📲':'🖥';}
  function vidColor(v){var h=0,s=String(v||'');for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return 'hsl('+(h%360)+',70%,62%)';}
  function renderJourneys(arr,feed){var de=document.getElementById('vjDesk'),mo=document.getElementById('vjMob');if(!de&&!mo)return;arr=arr||[];feed=feed||[];var by={},order=[];for(var i=0;i<arr.length;i++){var v=arr[i],id=v.v||'?';if(!by[id]){by[id]={v:id,cc:v.cc,u:v.u,d:(v.d||''),s:v.s,f:v.f,last:v.ts,items:[]};order.push(id);}var g=by[id];if(v.ts>g.last)g.last=v.ts;g.items.push({k:'pg',p:v.p||'/',ts:v.ts});g.s=v.s;g.f=v.f;if(v.u)g.u=v.u;}
    for(var fi=0;fi<feed.length;fi++){var ev=feed[fi];if(!ev.v||!by[ev.v])continue;var gg=by[ev.v];if(ev.ts>gg.last)gg.last=ev.ts;gg.items.push({k:'ck',t:ev.t,e:ev.e||ev.t,ts:ev.ts});}
    for(var oi=0;oi<order.length;oi++){by[order[oi]].items.sort(function(a,b){return a.ts-b.ts;});}
    function ckLbl(it){var e=String(it.e||'');if(it.t==='tab')return 'calc: '+e;if(it.t==='exchange')return '💰 '+e;if(it.t==='paper')return 'trade '+e;if(it.t==='tool')return 'tool: '+e;if(it.t==='hotpair')return 'trending '+e;if(it.t==='prod')return 'open '+e;return e;}
    function jcard(g){var its=g.items.slice(-16);var path=its.map(function(it){return it.k==='pg'?'<span class="vj-pg">'+esc(pageShort(it.p))+'</span>':'<span class="vj-ck'+(it.t==='exchange'?' money':'')+'">'+esc(ckLbl(it))+'</span>';}).join('<span class="vj-arr">›</span>');var src=g.f?('from '+esc(pageShort(g.f))):('via '+esc(srcName(g.s)||'direct'));return '<div class="vj"><div class="vj-top"><span class="vj-dot" style="background:'+vidColor(g.v)+'"></span><span class="vj-cc">'+(g.u?('👤 @'+esc(g.u)):((flag(g.cc)||'🌐')+' '+(g.cc?esc(CC[g.cc]||g.cc):'Unknown')))+'</span><span class="vj-src">'+src+'</span><span class="vj-a">'+ago(g.last)+' ago</span></div><div class="vj-path">'+path+'</div></div>';}
    var rows=order.map(function(id){return by[id];}).sort(function(a,b){return b.last-a.last;});var dk=rows.filter(function(g){var x=g.d.toLowerCase();return x!=='mobile'&&x!=='tablet';}),mb=rows.filter(function(g){var x=g.d.toLowerCase();return x==='mobile'||x==='tablet';});var dn=document.getElementById('vjDeskN'),mn=document.getElementById('vjMobN');if(dn)dn.textContent='· '+dk.length;if(mn)mn.textContent='· '+mb.length;if(de)de.innerHTML=dk.length?dk.slice(0,25).map(jcard).join(''):'<div class="empty">no desktop visits yet</div>';if(mo)mo.innerHTML=mb.length?mb.slice(0,25).map(jcard).join(''):'<div class="empty">no mobile visits yet</div>';}
  function cv(sel,i,val){var e=document.querySelectorAll(sel);if(e[i])e[i].textContent=val;}
  function fresh(){var s=Math.round((Date.now()-t)/1000),f=document.getElementById('fresh');if(f)f.textContent='updated '+(s<60?s+'s':Math.floor(s/60)+'m')+' ago';}
  setInterval(fresh,1000);
  document.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('.card.has-tip');document.querySelectorAll('.card.tipon').forEach(function(x){if(x!==c)x.classList.remove('tipon');});if(c)c.classList.toggle('tipon');});
  function poll(){fetch('/api/stats?key='+encodeURIComponent(key)+'&format=json',{cache:'no-store'}).then(function(r){return r.json();}).then(function(d){
    t=Date.now();fresh();
    var o=document.getElementById('onln');if(o)o.textContent=d.online;
    function sid(id,v){var e=document.getElementById(id);if(e)e.innerHTML=v;}
    sid('tUv',N(d.uvToday));
    if(d.retToday!=null)sid('tRet',N(d.retToday)+' <small class="cvsub">'+(d.uvToday?Math.round(d.retToday/d.uvToday*100):0)+'%</small>');
    if(d.affToday!=null){sid('tAff',N(d.affToday));sid('tRev','$'+N(Math.round(d.affToday*0.45)));}
    if(d.pvToday!=null)sid('tPv',N(d.pvToday));
    sid('botf',N(d.botToday));sid('tUvTot',N(d.uvTotal));sid('tPvTot',N(d.pv));sid('tAffTot',N(d.aff));
    renderJourneys(d.visitors,d.feed);
    var ev=document.getElementById('evFeed');if(ev)ev.innerHTML=(d.feed&&d.feed.length)?d.feed.map(function(x){return '<div class="fe"><span class="fe-f">'+(x.u?'👤':(flag(x.cc)||'🌐'))+'</span><span class="fe-t">'+(x.u?('<b>@'+esc(x.u)+'</b> '):'A visitor ')+evLine(x)+'</span><span class="fe-a">'+ago(x.ts)+' ago</span></div>';}).join(''):'<div class="empty">no activity in the last few minutes</div>';
  }).catch(function(){});}
  poll();setInterval(poll,12000);
})();</script><script>window.ADM_SEED=${JSON.stringify(admSeed)};(function(){var key=new URLSearchParams(location.search).get('key')||'';function flag(c){return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(127397+c.charCodeAt(0),127397+c.charCodeAt(1)):'🌐';}function esc(s){return String(s).replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}function N(x){return (+x||0).toLocaleString('en-US');}function ago(t){var s=Math.round((Date.now()-t)/1000);return s<60?s+'s':s<3600?Math.floor(s/60)+'m':s<86400?Math.floor(s/3600)+'h':Math.floor(s/86400)+'d';}function card(v,l){return '<div class="card"><div class="cv">'+v+'</div><div class="cl">'+l+'</div></div>';}function addrColor(a){if(!a)return '#9aa3ad';var h=0;for(var i=2;i<a.length;i++)h=(h*31+a.charCodeAt(i))>>>0;return 'hsl('+(h%360)+',75%,66%)';}var tabs=document.querySelectorAll('.tab'),loaded={},rwdTimer=null,chatTimer=null,opsTimer=null,opsPrT=null;function show(t){curTab=t;try{markSeen(t);}catch(e){}tabs.forEach(function(b){b.classList.toggle('on',b.getAttribute('data-tab')===t);});['stats','settings','rewards','users','support','chat','security','ops'].forEach(function(x){var el=document.getElementById('tab-'+x);if(el)el.hidden=(x!==t);});if(t==='support')loadSupport();if(t==='security')loadSecurity();if(t==='users'){usersState.offset=0;usersState.end=false;loadUsers(true);}if(t==='settings'&&!loaded.settings){loadSettings();loaded.settings=1;}if(t==='rewards'){loadRewards();if(!rwdTimer)rwdTimer=setInterval(loadRewards,6000);}else if(rwdTimer){clearInterval(rwdTimer);rwdTimer=null;}if(t==='chat'){loadChat();if(!chatTimer)chatTimer=setInterval(loadChat,5000);}else if(chatTimer){clearInterval(chatTimer);chatTimer=null;}if(t==='ops'){loadOps();if(!opsTimer)opsTimer=setInterval(loadOps,12000);if(!opsPrT)opsPrT=setInterval(opsPrices,6000);}else{if(opsTimer){clearInterval(opsTimer);opsTimer=null;}if(opsPrT){clearInterval(opsPrT);opsPrT=null;}}}tabs.forEach(function(b){b.addEventListener('click',function(){show(b.getAttribute('data-tab'));});});var curTab='stats';
var OPS={pos:[],PR:{},traders:0,sort:'pnl'};
function opsPrices(){fetch('/api/prices').then(function(r){return r.json();}).then(function(d){if(d&&d.pairs)d.pairs.forEach(function(x){OPS.PR[String(x.symbol||'').replace('USDT','').toUpperCase()]=+x.price;});renderOps();}).catch(function(){});}
function loadOps(){fetch('/api/auth/opentrades?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){OPS.pos=(d&&d.positions)||[];OPS.traders=(d&&d.traders)||0;renderOps();}).catch(function(){var el=document.getElementById('opsBody');if(el&&!OPS.pos.length)el.innerHTML='<div class="empty">could not load</div>';});}
function opsCalc(t){var long=t.side!=='short',dir=long?1:-1;var live=OPS.PR[String(t.sym||'').toUpperCase()],hasLive=isFinite(live)&&live>0;var entry=+t.entry,margin=+t.margin||0,lev=(+t.lev>0)?+t.lev:1;var qty=(t.qty!=null&&isFinite(+t.qty))?+t.qty:((margin&&entry)?margin*lev/entry:0);var pnl=hasLive?qty*(live-entry)*dir:null;if(pnl!=null&&margin>0&&pnl<-margin)pnl=-margin;var roe=(pnl!=null&&margin>0)?pnl/margin*100:null;var liq=+t.liq||(long?entry*(1-(1-(t.mmr||0.005))/lev):entry*(1+(1-(t.mmr||0.005))/lev));var liqDist=hasLive&&live>0?(live-liq)/live*100*dir:null;var dead=hasLive&&isFinite(liq)&&(long?live<=liq:live>=liq);return {long:long,live:live,hasLive:hasLive,entry:entry,margin:margin,lev:lev,pnl:pnl,roe:roe,liq:liq,liqDist:liqDist,dead:dead};}
function opsPosRow(t,dead){var c=opsCalc(t);var sc=c.long?'#2ebd85':'#ff6258';var pcol=c.pnl==null?'#9aa3ad':(c.pnl>=0?'#2ebd85':'#ff6258');
  var buf=c.liqDist,bw=0,bcol='#2ebd85';
  if(buf!=null){bw=Math.max(4,Math.min(100,buf*10));bcol=buf<3?'#ff6258':(buf<10?'#ffb347':'#2ebd85');}
  var fmn=function(x){return (+x).toLocaleString('en-US',{maximumFractionDigits:x>=100?2:6});};
  return '<div class="opsp'+(dead?' deadp':'')+'">'
    +'<span class="side" style="color:'+sc+'">'+(c.long?'LONG':'SHORT')+'</span>'
    +'<span class="sym">'+esc(t.sym||'-')+' <small>'+c.lev+'x</small>'+(dead?' <i class="liqb">LIQ</i>':'')+'</span>'
    +'<span class="pm">'+(c.margin>100000?'<i class="liqb" style="color:#ffb347;border-color:rgba(255,179,71,.4)">&gt;CAP</i> ':'')+'$'+c.margin.toLocaleString('en-US',{maximumFractionDigits:0})+'</span>'
    +'<span class="pm">'+(isFinite(c.entry)?fmn(c.entry):'?')+' <i class="arr">&#8594;</i> <b style="color:#cdd3da">'+(c.hasLive?fmn(c.live):'&#8212;')+'</b></span>'
    +'<span class="pnl" style="color:'+pcol+'">'+((c.pnl!=null&&c.margin<=100000)?((c.pnl>=0?'+':'&#8722;')+'$'+Math.abs(c.pnl).toLocaleString('en-US',{maximumFractionDigits:2})+(c.roe!=null?' <small>'+(c.roe>=0?'+':'')+c.roe.toFixed(0)+'%</small>':'')):'&#8212;')+'</span>'
    +'<span class="ops-liq" title="distance to liquidation"><span class="ops-meter"><i style="width:'+bw+'%;background:'+bcol+'"></i></span><span style="color:'+bcol+'">'+(buf!=null?buf.toFixed(buf<10?1:0)+'%':'&#8212;')+'</span></span>'
    +'<span class="age">'+(t.ts?ago(t.ts):'')+'</span>'
  +'</div>';}
function renderOps(){var el=document.getElementById('opsBody');if(!el)return;
  var alive=[],dead=[];OPS.pos.forEach(function(t){(opsCalc(t).dead?dead:alive).push(t);}); // crossed-liq = effectively liquidated (client-side close pending)
  var totM=0,totP=0,nl=0,ns=0,worst=null,nOver=0;
  alive.forEach(function(t){var c=opsCalc(t);var over=c.margin>100000;if(over)nOver++;else{totM+=c.margin;if(c.pnl!=null)totP+=c.pnl;}if(c.long)nl++;else ns++;if(!over&&c.liqDist!=null&&(worst==null||c.liqDist<worst.d))worst={d:c.liqDist,t:t};});
  var kp=document.getElementById('opsKpis');
  if(kp)kp.innerHTML=card(alive.length,'Live positions')+card(OPS.traders||0,'Traders')
    +card('<span style="color:#2ebd85">'+nl+'</span><span class="muted" style="font-size:16px"> / </span><span style="color:#ff6258">'+ns+'</span>','Long / Short')
    +card('$'+totM.toLocaleString('en-US',{maximumFractionDigits:0}),'Margin (live)'+(nOver?' &middot; excl. '+nOver+' oversized':''))
    +card('<span style="color:'+(totP>=0?'#2ebd85':'#ff6258')+'">'+(totP>=0?'+':'&#8722;')+'$'+Math.abs(totP).toFixed(2)+'</span>','Unrealized P&L')
    +card(worst?('<span style="color:'+(worst.d<3?'#ff6258':(worst.d<10?'#ffb347':'#2ebd85'))+'">'+worst.d.toFixed(1)+'%</span>'):'&#8212;',worst?('Nearest liq &middot; '+esc(worst.t.username||(worst.t.email||'').split('@')[0]||'anon')+' ('+esc(worst.t.sym||'')+')'):'Nearest liq')
    +card('<span style="color:'+(dead.length?'#ff6258':'#e9e7df')+'">'+dead.length+'</span>','Liquidated &middot; pending');
  if(!alive.length&&!dead.length){el.innerHTML='<div class="empty">no open positions right now (signed-in users only)</div>';return;}
  // pull live prices for symbols the base /api/prices set doesn't cover, so P&L + liq distance are real for EVERY position
  var t0=Date.now();OPS._miss=OPS._miss||{};var need={};
  OPS.pos.forEach(function(t){var sy=String(t.sym||'').toUpperCase();if(sy&&!(OPS.PR[sy]>0)&&(!OPS._miss[sy]||t0-OPS._miss[sy]>30000))need[sy]=1;});
  Object.keys(need).slice(0,24).forEach(function(sy){OPS._miss[sy]=t0;fetch('/api/price?symbol='+encodeURIComponent(sy)).then(function(r){return r.json();}).then(function(j){if(j&&+j.price>0){OPS.PR[sy]=+j.price;renderOps();}}).catch(function(){});});
  var mkey=function(t){var c=opsCalc(t);if(OPS.sort==='age')return -(t.ts||0);if(OPS.sort==='margin')return -(c.margin||0);if(OPS.sort==='liq')return (c.liqDist==null?1e9:c.liqDist);return -(c.pnl==null?-1e9:c.pnl);};
  var srt=function(a,b){return mkey(a)-mkey(b);};
  function grouped(list){var by={},ord=[];
    list.forEach(function(t){var k=String(t.uid||t.email||t.username||'?');if(!by[k]){by[k]={t0:t,rows:[],m:0,p:0,hasP:false};ord.push(k);}var g=by[k];g.rows.push(t);var c=opsCalc(t);if(c.margin<=100000){g.m+=c.margin;if(c.pnl!=null){g.p+=c.pnl;g.hasP=true;}}});
    ord.sort(function(a,b){var ga=by[a],gb=by[b];
      if(OPS.sort==='margin')return gb.m-ga.m;
      if(OPS.sort==='age')return Math.max.apply(null,gb.rows.map(function(x){return x.ts||0;}))-Math.max.apply(null,ga.rows.map(function(x){return x.ts||0;}));
      if(OPS.sort==='liq')return Math.min.apply(null,ga.rows.map(mkey))-Math.min.apply(null,gb.rows.map(mkey));
      return gb.p-ga.p;});
    return ord.map(function(k){var g=by[k];g.rows.sort(srt);var t=g.t0;var who=esc(t.username||(t.email||'').split('@')[0]||'anon');var pc=g.hasP?(g.p>=0?'#2ebd85':'#ff6258'):'#9aa3ad';
      return '<div class="opsu"><div class="opsu-h">'+(flag(t.cc)||'&middot;')+' <b>'+who+'</b><span class="em">'+esc(t.email||'')+'</span><span class="opsu-agg">'+(t.email&&t.uid?'<button class="pay opsu-ping" data-ping="'+esc(t.uid)+'" data-pn="'+who+'" title="Email them their live ROE + a reminder">&#9993; Ping</button>':'')+'<span class="muted">'+g.rows.length+' pos</span><span class="muted">$'+g.m.toLocaleString('en-US',{maximumFractionDigits:0})+'</span><b style="color:'+pc+'">'+(g.hasP?((g.p>=0?'+':'&#8722;')+'$'+Math.abs(g.p).toFixed(2)):'&#8212;')+'</b></span></div>'
        +g.rows.map(function(x){return opsPosRow(x,opsCalc(x).dead);}).join('')+'</div>';}).join('');}
  var html=alive.length?grouped(alive):'<div class="empty">no genuinely-live positions right now</div>';
  if(dead.length){html+='<div style="margin:16px 0 9px;font-size:11.5px;color:#ff8a80;line-height:1.45;border-top:1px solid #1c2230;padding-top:12px"><b style="color:#ff6258">'+dead.length+' liquidated &middot; owner offline.</b> Price has already crossed liq, but the trade is still open because paper-trade liquidation runs in the user&#39;s browser &#8212; it closes to a loss the next time they visit.</div><div style="opacity:.55">'+grouped(dead)+'</div>';}
  el.innerHTML=html;}
var opsSortSel=document.getElementById('opsSort');if(opsSortSel)opsSortSel.addEventListener('change',function(){OPS.sort=this.value;renderOps();});
var opsBodyEl=document.getElementById('opsBody');if(opsBodyEl)opsBodyEl.addEventListener('click',function(ev){var b=ev.target.closest&&ev.target.closest('[data-ping]');if(!b)return;var uid=b.getAttribute('data-ping'),who=b.getAttribute('data-pn')||'this trader';
  if(!confirm('Email '+who+' their live ROE + a reminder to check the open position?'))return;
  b.disabled=true;b.textContent='…';
  fetch('/api/admin/pingpos?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({uid:uid})}).then(function(r){return r.json();}).then(function(d){
    if(d&&d.ok){b.textContent='Sent ✓';b.style.color='#2ebd85';}
    else if(d&&d.error==='cooldown'){b.textContent='Pinged '+(d.hoursAgo!=null?d.hoursAgo+'h ago':'today');b.style.color='#ffb347';}
    else{b.textContent='Failed';b.style.color='#ff6258';b.disabled=false;}
  }).catch(function(){b.textContent='Failed';b.disabled=false;});});function bSeen(){try{return JSON.parse(localStorage.getItem('mp_admin_seen')||'{}');}catch(e){return {};}}function markSeen(t){if(['rewards','users','support','chat'].indexOf(t)<0)return;var s=bSeen();s[t]=Date.now();try{localStorage.setItem('mp_admin_seen',JSON.stringify(s));}catch(e){}var b=document.querySelector('.tab[data-tab="'+t+'"]');if(b)b.classList.remove('has-noti');}function setNoti(t,on){var b=document.querySelector('.tab[data-tab="'+t+'"]');if(!b)return;if(t===curTab){markSeen(t);b.classList.remove('has-noti');return;}b.classList.toggle('has-noti',!!on);}function refreshBadges(){var seen=bSeen();var admA={};function renderAlert(){var box=document.getElementById('admAlert');if(!box)return;var items=(window.ADM_SEED||[]).map(function(a){return '<span class="adm-al '+a.cls+'" data-go="stats"'+(a.sub?' data-sub="'+a.sub+'"':'')+'>'+a.html+'</span>';});if(admA.pend>0)items.push('<span class="adm-al red" data-go="rewards">⚠ <b>'+admA.pend+'</b> withdrawal'+(admA.pend>1?'s':'')+' awaiting payout'+(admA.pendUsd?' · $'+admA.pendUsd.toFixed(2):'')+'</span>');if(admA.tickets>0)items.push('<span class="adm-al amber" data-go="support">✉ <b>'+admA.tickets+'</b> open support ticket'+(admA.tickets>1?'s':'')+'</span>');if(!items.length)items.push('<span class="adm-al ok">✓ All clear — nothing needs your attention</span>');box.innerHTML='<div style="font-family:monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:#5c656f;width:100%;margin-bottom:2px">Needs attention</div>'+items.join('');Array.prototype.forEach.call(box.querySelectorAll('[data-go]'),function(b){b.onclick=function(){show(b.getAttribute('data-go'));var sb=b.getAttribute('data-sub');if(sb){try{showSub(sb);}catch(e){}}window.scrollTo(0,0);};});}renderAlert();fetch('/api/reward/support?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var mx=0,op=0;(d.open||[]).forEach(function(t){if(t.address!=='admin'){op++;if(t.ts>mx)mx=t.ts;}});setNoti('support',mx>(seen.support||0));admA.tickets=op;renderAlert();}).catch(function(){});fetch('/chat/admin/history?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var mx=0;((d&&d.messages)||[]).forEach(function(m){if(!m.admin&&m.ts>mx)mx=m.ts;});setNoti('chat',mx>(seen.chat||0));}).catch(function(){});fetch('/api/auth/admin?key='+encodeURIComponent(key)+'&limit=1&offset=0').then(function(r){return r.json();}).then(function(d){var u=(d.users||[])[0];var mx=u?(u.created||0):0;setNoti('users',mx>(seen.users||0));var ts=document.getElementById('tSign');if(ts)ts.textContent=N(d.newToday||0);}).catch(function(){});fetch('/api/reward/admin?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var mx=0,pend=(d.pending||[]);pend.forEach(function(w){if((w.ts||0)>mx)mx=w.ts;});setNoti('rewards',!!(pend.length)&&mx>(seen.rewards||0));admA.pend=pend.length;admA.pendUsd=pend.reduce(function(s,w){return s+(+w.amountUsd||0);},0);var tf=document.getElementById('tFauc');if(tf)tf.innerHTML='$'+(+d.dispensedTodayUsd||0).toFixed(2)+' <small class="cvsub">/ $'+(+d.dailyCapUsd||0).toFixed(0)+'</small>';renderAlert();}).catch(function(){});}refreshBadges();setInterval(refreshBadges,30000);var subs=document.querySelectorAll('.subtab');function showSub(s){subs.forEach(function(b){b.classList.toggle('on',b.getAttribute('data-sub')===s);});Array.prototype.forEach.call(document.querySelectorAll('.substat'),function(el){el.hidden=(el.getAttribute('data-sub')!==s);});window.scrollTo(0,0);}subs.forEach(function(b){b.addEventListener('click',function(){showSub(b.getAttribute('data-sub'));});});function loadChat(){fetch('/chat/admin/history?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var el=document.getElementById('chatMsgs');if(!el)return;var ms=(d&&d.messages)||[];el.innerHTML=ms.length?ms.slice().reverse().map(function(m){var who=m.admin?'<b style="color:#e9e7df;font-weight:800">Margin<span style="color:#c2f64a">Pad</span></b>':'<b style="color:#cdd3da">'+esc(m.u||'anon')+'</b>';return '<div class="wd-row" style="align-items:flex-start"><div style="flex:1;min-width:0">'+who+' <span style="color:#9aa3ad">'+esc(m.t||'')+'</span></div><span class="meta">'+ago(m.ts)+'</span><button class="pay" data-delts="'+m.ts+'" style="padding:3px 8px">✕</button></div>';}).join(''):'<div class="empty">no messages yet</div>';Array.prototype.forEach.call(el.querySelectorAll('[data-delts]'),function(btn){btn.addEventListener('click',function(){fetch('/chat/admin/delete?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ts:+btn.getAttribute('data-delts')})}).then(function(){loadChat();});});});}).catch(function(){});}var cpb=document.getElementById('chatPostBtn');if(cpb)cpb.addEventListener('click',function(){var inp=document.getElementById('chatPostIn'),t=(inp.value||'').trim();if(!t)return;cpb.disabled=true;fetch('/chat/admin/post?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:t})}).then(function(){cpb.disabled=false;inp.value='';loadChat();});});var cpi=document.getElementById('chatPostIn');if(cpi)cpi.addEventListener('keydown',function(e){if(e.key==='Enter'&&cpb)cpb.click();});var ccb=document.getElementById('chatClearBtn');if(ccb)ccb.addEventListener('click',function(){if(!confirm('Clear ALL chat messages?'))return;fetch('/chat/reset?key='+encodeURIComponent(key)).then(function(){loadChat();});});var tbb=document.getElementById('tgBcBtn');if(tbb)tbb.addEventListener('click',function(){var inp=document.getElementById('tgBcIn'),msg=document.getElementById('tgBcMsg'),imE=document.getElementById('tgBcImg'),t=(inp.value||'').trim(),img=(imE&&imE.value||'').trim();if(!t){if(msg)msg.textContent='Write something first.';return;}if(!confirm('Post this announcement to your Telegram channel?'))return;tbb.disabled=true;if(msg)msg.textContent='Posting…';fetch('/api/admin/broadcast?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:t,photo:img})}).then(function(r){return r.json();}).then(function(d){tbb.disabled=false;if(d&&d.ok){inp.value='';if(imE)imE.value='';if(msg)msg.textContent='Posted to '+(d.channel||'channel')+' ✓';}else{if(msg)msg.textContent='Failed: '+((d&&d.error)||'unknown')+(d&&d.error==='no_channel'?' — add the bot to your channel and post one message there, then retry':'');}}).catch(function(){tbb.disabled=false;if(msg)msg.textContent='Network error.';});});
  var MP_SIG='📊 Trade it free on <a href="https://marginpad.io">MarginPad</a> — crypto futures tools, no sign-up.';
  function tgNewsDraft(it){function e(s){return String(s||'').replace(/[<>&]/g,function(m){return {'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}var t=e(it.title);var body=e((it.body||'').replace(/\\s+/g,' ').trim());if(body.length>220)body=body.slice(0,217).replace(/\\s+\\S*$/,'')+'…';return '<b>'+t+'</b>\\n\\n'+(body?body+'\\n\\n':'')+'<i>via '+e(it.src)+'</i>\\n\\n'+MP_SIG;}
  var tgNewsLoaded=false,tnb=document.getElementById('tgNewsBtn');
  if(tnb)tnb.addEventListener('click',function(){var list=document.getElementById('tgNewsList'),nmsg=document.getElementById('tgNewsMsg');if(!list)return;if(!list.hidden){list.hidden=true;if(nmsg)nmsg.textContent='';return;}list.hidden=false;if(tgNewsLoaded)return;list.innerHTML='<div class="empty" style="padding:8px">loading…</div>';fetch('/api/news').then(function(r){return r.json();}).then(function(d){var items=(d&&d.items)||[];if(!items.length){list.innerHTML='<div class="empty" style="padding:8px">no news right now</div>';return;}tgNewsLoaded=true;window.__tgNews=items;list.innerHTML=items.slice(0,30).map(function(it,i){return '<div class="tgnews-row" data-i="'+i+'" style="padding:9px 11px;border:1px solid #2f3742;border-radius:9px;margin-bottom:6px;cursor:pointer;background:#0c0f13"><div style="font-size:13px;color:#e9e7df;font-weight:600;line-height:1.35">'+esc(it.title)+'</div><div style="font-size:11px;color:#7f8893;margin-top:3px">'+esc(it.src)+(it.ts?' · '+ago(it.ts):'')+'</div></div>';}).join('');Array.prototype.forEach.call(list.querySelectorAll('.tgnews-row'),function(row){row.addEventListener('click',function(){var it=window.__tgNews[+row.getAttribute('data-i')];if(!it)return;var ta=document.getElementById('tgBcIn');if(ta){ta.value=tgNewsDraft(it);ta.focus();}var im=document.getElementById('tgBcImg');if(im)im.value=it.img||'';list.hidden=true;if(nmsg)nmsg.textContent='Draft loaded'+(it.img?' (with image)':'')+' — review, edit, then Post.';if(ta&&ta.scrollIntoView)ta.scrollIntoView({behavior:'smooth',block:'center'});});});}).catch(function(){list.innerHTML='<div class="empty" style="padding:8px">could not load news</div>';});});
  var ttb=document.getElementById('tgTplBtn');if(ttb)ttb.addEventListener('click',function(){var ta=document.getElementById('tgBcIn');if(!ta)return;var v=ta.value.replace(/\\s+$/,'');ta.value=v+(v?'\\n\\n':'')+MP_SIG;ta.focus();var nm=document.getElementById('tgNewsMsg');if(nm)nm.textContent='MarginPad footer added.';});function cell(k,v){return '<div class="amod-cell"><div class="k">'+k+'</div><div class="v">'+v+'</div></div>';}function renderAcct(d){var b=document.getElementById('amBody');if(!b)return;var banBtn=document.getElementById('amBan'),um0=document.getElementById('amUserMsg'),ms0=document.getElementById('amMsgState');var lbBtn=document.getElementById('amLbBan');if(lbBtn){lbBtn.style.display='';lbBtn.textContent=d.lbBanned?'Reinstate to leaderboard':'Remove from leaderboard';lbBtn.setAttribute('data-lbban',d.lbBanned?'1':'0');lbBtn.classList.toggle('danger',!d.lbBanned);}if(!d.exists){b.innerHTML='<div class="amod-msg">No account for this address (already removed?).</div>';if(banBtn)banBtn.style.display='none';if(um0)um0.value='';if(ms0)ms0.textContent='';return;}var _ttl=document.getElementById('amAddr');if(_ttl)_ttl.textContent=d.username?('@'+d.username):(d.email||d.address);var rc={high:'#ff6258',med:'#ffb347',low:'#2ebd85'},fr=d.fraud||{flags:[],riskLevel:'low',ipWallets:[]},rcol=rc[fr.riskLevel]||'#2ebd85';var h='';if(d.banned)h+='<div style="background:rgba(255,98,88,.12);border:1px solid rgba(255,98,88,.5);color:#ff8a80;border-radius:9px;padding:8px 12px;font-size:12.5px;font-weight:700;margin-bottom:12px">This wallet is BANNED — its claims are blocked.</div>';h+='<div class="amod-grid">'+cell('User',d.username?('@'+esc(d.username)):(d.email?esc(d.email):'—'))+cell('Linked wallet',d.payoutAddr?('<span style="font-family:monospace;font-size:10.5px;word-break:break-all">'+esc(d.payoutAddr)+'</span>'):'<span style="color:#5c656f">none linked yet</span>')+cell('Email',d.email?esc(d.email):'—')+cell('Telegram',d.tgLinked?'linked':'—')+cell('Balance','$'+(+d.balanceUsd||0).toFixed(2))+cell('Earned','$'+(+d.earnedUsd||0).toFixed(2))+cell('Claims',d.claims||0)+cell('Device lock',d.locked?'locked':'free')+cell('From',(flag(d.cc)||'')+' '+(d.cc||'?')+' · '+(d.dev||'?'))+cell('IP',(d.ip||'?')+(d.sameIp>1?' · '+d.sameIp+' wallets':''))+cell('Created',d.created?ago(d.created)+' ago':'—')+cell('Last claim',d.lastClaim?ago(d.lastClaim)+' ago':'never')+'</div>';h+='<div class="amod-sec">Fraud signals — risk <span style="color:'+rcol+';font-weight:800">'+(fr.riskLevel||'low').toUpperCase()+'</span></div>';if(fr.flags&&fr.flags.length){h+='<div style="display:flex;flex-direction:column;gap:6px">'+fr.flags.map(function(f){return '<div style="background:#0c0f13;border:1px solid #2f3742;border-left:3px solid '+rcol+';border-radius:8px;padding:7px 11px;font-size:12px;color:#e3c7a0">'+esc(f)+'</div>';}).join('')+'</div>';}else{h+='<div class="amod-msg" style="text-align:left;margin-top:0">No risk signals — looks clean.</div>';}if(fr.didWallets&&fr.didWallets.length){h+='<div class="amod-sec" style="color:#ff8a80">Same DEVICE — other wallets ('+fr.didWallets.length+')</div>'+fr.didWallets.map(function(w){return '<div class="wd-row" data-acct="'+esc(w.address)+'" style="cursor:pointer"><span class="addr mono" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#ffb3ac;font-size:11px">'+esc(w.address)+'</span><span class="meta">'+w.claims+'×</span>'+(w.banned?'<span style="color:#ff6258;font-size:10px;font-family:monospace">BANNED</span>':'')+'<span class="bal" style="color:#c2f64a;font-family:monospace">$'+(+w.balanceUsd||0).toFixed(2)+'</span></div>';}).join('');}if(fr.ipWallets&&fr.ipWallets.length){h+='<div class="amod-sec">Other wallets on this IP ('+fr.ipWallets.length+')</div>'+fr.ipWallets.map(function(w){return '<div class="wd-row" data-acct="'+esc(w.address)+'" style="cursor:pointer"><span class="addr mono" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#cdd3da;font-size:11px">'+esc(w.address)+'</span><span class="meta" style="color:#5c656f;font-family:monospace;font-size:11px">'+w.claims+'×</span>'+(w.banned?'<span style="color:#ff6258;font-size:10px;font-family:monospace">BANNED</span>':'')+'<span class="bal" style="color:#c2f64a;font-family:monospace">$'+(+w.balanceUsd||0).toFixed(2)+'</span></div>';}).join('');}if(d.lb){h+='<div class="amod-sec">Best trade this week</div>'+cell('ROE',((+d.lb.roe)>=0?'+':'')+(+d.lb.roe).toFixed(0)+'% on '+(d.lb.symbol||'?')+' '+(d.lb.side||''));}if(d.withdrawals&&d.withdrawals.length){h+='<div class="amod-sec">Withdrawals</div>'+d.withdrawals.map(function(w){var txid=(w.txid||'').replace(/[^0-9a-fA-Fx]/g,'');var c=w.status==='paid'?'#2ebd85':'#ffb347';return '<div class="wd-row"><span class="bal">$'+(+w.amountUsd||0).toFixed(2)+'</span><span style="font-family:monospace;font-size:11px;color:'+c+'">'+w.status+'</span>'+(txid?'<a href="https://bscscan.com/tx/'+txid+'" target="_blank" rel="noopener" style="margin-left:auto;color:#c2f64a">tx</a>':'<span class="meta" style="margin-left:auto">'+ago(w.ts)+'</span>')+'</div>';}).join('');}b.innerHTML=h;Array.prototype.forEach.call(b.querySelectorAll('[data-acct]'),function(row){row.addEventListener('click',function(){openAcct(row.getAttribute('data-acct'));});});var nt=document.getElementById('amNote');if(nt)nt.value=d.note||'';if(um0)um0.value=d.msg||'';if(ms0)ms0.textContent=d.msg?('Message active'+(d.msgSeen?' · read by user':' · not read yet')):'No message set';if(banBtn){banBtn.style.display='';banBtn.textContent=d.banned?'Unban wallet':'Ban from faucet';banBtn.setAttribute('data-banned',d.banned?'1':'0');banBtn.classList.toggle('danger',!d.banned);}}function openAcct(a){var mo=document.getElementById('acctModal');if(!mo)return;mo.setAttribute('data-a',a);document.getElementById('amAddr').textContent=a;document.getElementById('amMsg').textContent='';document.getElementById('amBody').innerHTML='<div class="amod-msg">loading…</div>';mo.hidden=false;fetch('/api/reward/detail?address='+a+'&key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(renderAcct).catch(function(){document.getElementById('amBody').innerHTML='<div class="amod-msg">Could not load.</div>';});}function closeAcct(){var mo=document.getElementById('acctModal');if(mo)mo.hidden=true;}var amClose=document.getElementById('amClose');if(amClose)amClose.addEventListener('click',closeAcct);var amModal=document.getElementById('acctModal');if(amModal)amModal.addEventListener('click',function(e){if(e.target===amModal)closeAcct();});var amUnlock=document.getElementById('amUnlock');if(amUnlock)amUnlock.addEventListener('click',function(){var a=document.getElementById('acctModal').getAttribute('data-a');document.getElementById('amMsg').textContent='Unlocking…';fetch('/api/reward/unlock?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a})}).then(function(){document.getElementById('amMsg').textContent='Device unlocked.';loadRewards();});});var amRemove=document.getElementById('amRemove');if(amRemove)amRemove.addEventListener('click',function(){var a=document.getElementById('acctModal').getAttribute('data-a');if(!confirm('Remove '+a+'? Deletes the account, its device lock and leaderboard entry.'))return;document.getElementById('amMsg').textContent='Removing…';fetch('/api/reward/remove?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a})}).then(function(){closeAcct();loadRewards();});});function amAdjust(sign){var a=document.getElementById('acctModal').getAttribute('data-a');var amt=parseFloat((document.getElementById('amAdjAmt')||{}).value);if(!(amt>0)){document.getElementById('amMsg').textContent='Enter a USD amount.';return;}if(sign<0&&!confirm('Subtract $'+amt.toFixed(2)+' from this balance?'))return;document.getElementById('amMsg').textContent=sign>0?'Adding…':'Subtracting…';fetch('/api/reward/adjust?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a,deltaUsd:sign*amt})}).then(function(r){return r.json();}).then(function(d){if(d&&d.ok){var inp=document.getElementById('amAdjAmt');if(inp)inp.value='';openAcct(a);loadRewards();}else{document.getElementById('amMsg').textContent='Failed: '+((d&&d.error)||'error');}});}var amAdjAdd=document.getElementById('amAdjAdd');if(amAdjAdd)amAdjAdd.addEventListener('click',function(){amAdjust(1);});var amAdjSub=document.getElementById('amAdjSub');if(amAdjSub)amAdjSub.addEventListener('click',function(){amAdjust(-1);});var amNoteSave=document.getElementById('amNoteSave');if(amNoteSave)amNoteSave.addEventListener('click',function(){var a=document.getElementById('acctModal').getAttribute('data-a'),nt=document.getElementById('amNote').value;document.getElementById('amMsg').textContent='Saving note…';fetch('/api/reward/note?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a,note:nt})}).then(function(){document.getElementById('amMsg').textContent='Note saved.';});});var amMsgSend=document.getElementById('amMsgSend');if(amMsgSend)amMsgSend.addEventListener('click',function(){var a=document.getElementById('acctModal').getAttribute('data-a'),m=document.getElementById('amUserMsg').value;document.getElementById('amMsg').textContent='Sending…';fetch('/api/reward/message?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a,message:m})}).then(function(){document.getElementById('amMsg').textContent=m.trim()?'Message sent — the user sees it on /rewards.':'Message cleared.';var ms=document.getElementById('amMsgState');if(ms)ms.textContent=m.trim()?'Message active · not read yet':'No message set';});});var amBan=document.getElementById('amBan');if(amBan)amBan.addEventListener('click',function(){var a=document.getElementById('acctModal').getAttribute('data-a'),banned=amBan.getAttribute('data-banned')==='1';if(!banned&&!confirm('Ban '+a+' from the faucet? Future claims are blocked (balance is kept for review).'))return;document.getElementById('amMsg').textContent=banned?'Lifting ban…':'Banning…';fetch('/api/reward/'+(banned?'unban':'ban')+'?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a})}).then(function(){document.getElementById('amMsg').textContent=banned?'Ban lifted.':'Wallet banned.';openAcct(a);loadRewards();});});var amLbBan=document.getElementById('amLbBan');if(amLbBan)amLbBan.addEventListener('click',function(){var a=document.getElementById('acctModal').getAttribute('data-a'),lbb=amLbBan.getAttribute('data-lbban')==='1';if(!lbb&&!confirm('Remove '+a+' from the leaderboard? Their entries are wiped and they can no longer compete.'))return;document.getElementById('amMsg').textContent=lbb?'Reinstating…':'Removing from leaderboard…';fetch('/api/reward/lbban?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a,unban:lbb?1:0})}).then(function(){document.getElementById('amMsg').textContent=lbb?'Reinstated to leaderboard.':'Removed from leaderboard.';openAcct(a);loadRewards();});});function set(id,v){var e=document.getElementById(id);if(e&&v!=null)e.value=v;}function val(id){return +document.getElementById(id).value;}function recalcHints(){var hb=document.getElementById('sHints');if(!hb)return;var amt=val('sAmount')||0,per=val('sPerDay')||0,cap=val('sCap')||0,cd=val('sCooldown')||0;var maxPerWallet=amt>0?Math.floor(per/amt):0;var budgetClaims=amt>0?Math.floor(cap/amt):0;var cdMin=cd/60;hb.innerHTML='Each wallet: up to <b>'+maxPerWallet+'</b> claims/day (= $'+per.toFixed(2)+').  Global budget <b>$'+cap.toFixed(0)+'</b> &asymp; <b>'+budgetClaims+'</b> claims/day total ('+(maxPerWallet>0?'&ge; '+Math.ceil(budgetClaims/maxPerWallet):'?')+' wallets).  Cooldown &asymp; <b>'+(cdMin%1===0?cdMin:cdMin.toFixed(1))+'</b> min between claims.';}
function loadSettings(){fetch('/api/reward/config?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var c=d.config||{};document.getElementById('sEnabled').checked=!!c.enabled;var we=document.getElementById('sWdEnabled');if(we)we.checked=(c.wdEnabled!==false);var pe=document.getElementById('sPromoEnabled');if(pe)pe.checked=(c.promoEnabled!==false);set('sPromo',c.promoUsd!=null?c.promoUsd:1);var ro=document.getElementById('sRequireOnchain');if(ro)ro.checked=(c.requireOnchain!==false);set('sCap',c.capUsd);set('sAmount',c.amountUsd);set('sPerDay',c.perDayUsd);set('sMinWd',c.minWdUsd);set('sCooldown',c.cooldownS);set('sIpCap',c.ipCap);set('sMinClaimsWd',c.minClaimsToWd||0);set('sWelcome',c.welcomeUsd!=null?c.welcomeUsd:0.5);var pm=document.getElementById('sPauseMsg');if(pm)pm.value=c.pauseMsg||'';set('sPrize1',c.prize1);set('sPrize2',c.prize2);set('sPrize3',c.prize3);recalcHints();['sAmount','sPerDay','sCap','sCooldown'].forEach(function(id){var e=document.getElementById(id);if(e)e.addEventListener('input',recalcHints);});});}var sSave=document.getElementById('sSave');if(sSave)sSave.addEventListener('click',function(){var b={enabled:document.getElementById('sEnabled').checked,wdEnabled:document.getElementById('sWdEnabled').checked,requireOnchain:document.getElementById('sRequireOnchain').checked,capUsd:val('sCap'),amountUsd:val('sAmount'),perDayUsd:val('sPerDay'),minWdUsd:val('sMinWd'),cooldownS:val('sCooldown'),ipCap:val('sIpCap'),minClaimsToWd:val('sMinClaimsWd'),welcomeUsd:val('sWelcome'),promoUsd:val('sPromo'),promoEnabled:!document.getElementById('sPromoEnabled')||document.getElementById('sPromoEnabled').checked,pauseMsg:document.getElementById('sPauseMsg').value,prize1:val('sPrize1'),prize2:val('sPrize2'),prize3:val('sPrize3')};var m=document.getElementById('sMsg');m.textContent='Saving…';fetch('/api/reward/config?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json();}).then(function(d){m.textContent=d.ok?'Saved ✓':'Error';setTimeout(function(){m.textContent='';},2500);});});var annL=document.getElementById('sAnnLevel'),annM=document.getElementById('sAnnMsg'),annB=document.getElementById('sAnnBtn'),annS=document.getElementById('sAnnSt');if(annB){fetch('/api/announce').then(function(r){return r.json();}).then(function(a){if(annL)annL.value=a.level||'';if(annM)annM.value=a.msg||'';}).catch(function(){});annB.addEventListener('click',function(){var bb={level:annL.value,msg:annM.value};annS.textContent='Saving…';fetch('/api/announce?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(bb)}).then(function(r){return r.json();}).then(function(d){annS.textContent=d.ok?(bb.level?'Live ✓':'Cleared ✓'):'Error';setTimeout(function(){annS.textContent='';},2500);}).catch(function(){annS.textContent='Network error';});});}var aiL=document.getElementById('sAiLimit'),aiB=document.getElementById('sAiSave'),aiSt=document.getElementById('sAiSt');if(aiB){fetch('/api/ai/admin?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){if(aiL)aiL.value=(d&&d.globalLimit!=null)?d.globalLimit:10;}).catch(function(){});aiB.addEventListener('click',function(){if(aiSt)aiSt.textContent='Saving...';fetch('/api/ai/admin?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({globalLimit:+aiL.value})}).then(function(r){return r.json();}).then(function(d){if(aiSt){aiSt.textContent=d.ok?'Saved':'Error';setTimeout(function(){aiSt.textContent='';},2500);}}).catch(function(){if(aiSt)aiSt.textContent='Network error';});});}var supTab='active';function renderSup(d){var el=document.getElementById('supList');if(!el)return;var open=d.open||[],closed=d.closed||[],rp=d.replies||[];var setup=document.getElementById('supSetup');if(setup)setup.innerHTML=d.emailReady?'<span style="color:#2ebd85">Replies are sent from <b>support@marginpad.io</b> &#10003;</span>':'<span style="color:#ffb347">Email replies not set up yet — add the <b>RESEND_API_KEY</b> secret to send mail (see CLAUDE.md). Messages still arrive here.</span>';var ta=document.getElementById('supTabActive'),tc=document.getElementById('supTabClosed');if(ta){ta.innerHTML='Active <span class="sup-ct">'+open.length+'</span>';ta.classList.toggle('on',supTab==='active');ta.onclick=function(){supTab='active';renderSup(d);};}if(tc){tc.innerHTML='Closed <span class="sup-ct">'+closed.length+'</span>';tc.classList.toggle('on',supTab==='closed');tc.onclick=function(){supTab='closed';renderSup(d);};}var nb=document.getElementById('supNewBtn'),cp=document.getElementById('supCompose');if(nb&&cp){nb.onclick=function(){cp.hidden=!cp.hidden;if(!cp.hidden)cp.querySelector('.sup-nemail').focus();};cp.querySelector('.sup-ncancel').onclick=function(){cp.hidden=true;};cp.querySelector('.sup-nsend').onclick=function(){var to=cp.querySelector('.sup-nemail').value.trim(),subj=cp.querySelector('.sup-nsubj').value,bd=cp.querySelector('.sup-nbody').value,st=cp.querySelector('.sup-nst');if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)){st.style.color='#ff6258';st.textContent='Enter a valid email';return;}if(!bd.trim()){st.style.color='#ff6258';st.textContent='Write a message first';return;}st.style.color='#9aa3ad';st.textContent='Sending…';fetch('/api/reward/reply?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({to:to,subject:subj,message:bd})}).then(function(r){return r.json();}).then(function(j){if(!j.ok){st.style.color=j.error==='email_not_configured'?'#ffb347':'#ff6258';st.textContent=j.error==='email_not_configured'?'Set RESEND_API_KEY first':('Failed: '+(j.error||j.detail||'error'));return;}fetch('/api/reward/support/new?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:to,message:bd})}).then(function(){st.style.color='#2ebd85';st.textContent='Sent ✓';cp.querySelector('.sup-nbody').value='';cp.querySelector('.sup-nemail').value='';supTab='active';cp.hidden=true;setTimeout(loadSupport,900);});}).catch(function(){st.style.color='#ff6258';st.textContent='Network error';});};}var list=supTab==='active'?open:closed;el.innerHTML=list.length?list.map(function(s){var rep=rp.filter(function(r){return r.email===s.email&&r.ts>=s.ts;}).sort(function(a,b){return b.ts-a.ts;})[0];var badge=rep?'<span class="sup-badge">&#10003; replied '+ago(rep.ts)+' ago</span>':'';var mine=s.address==='admin';var act=supTab==='active'?'<div class="sup-reply"><input class="sup-subj" value="Re: your message to MarginPad"><textarea class="sup-body" placeholder="Write your reply — sent from support@marginpad.io"></textarea><div class="sup-rbtn"><button class="sbtn sup-send" data-to="'+esc(s.email||'')+'">Send reply</button><button class="sbtn ghost sup-close" data-id="'+s.id+'">Close ticket</button><span class="smsg sup-st"></span>'+badge+'</div></div>':'<div class="sup-rbtn" style="margin-top:10px"><button class="sbtn ghost sup-reopen" data-id="'+s.id+'">Reopen</button>'+badge+'</div>';return '<div class="sup-item'+(supTab==='closed'?' sup-done':'')+'"><div class="sup-h"><span class="sup-email">'+esc(s.email||'(no email left)')+'</span>'+(mine?'<span class="sup-mine">you started</span>':'')+'<span class="meta" style="margin-left:auto">'+ago(s.ts)+' ago</span></div>'+(mine?'':(s.address?'<div class="sup-addr">'+esc(s.address)+'</div>':''))+'<div class="sup-msg">'+esc(s.message||'')+'</div>'+act+'</div>';}).join(''):'<div class="empty">'+(supTab==='active'?'no open tickets — all caught up':'no closed tickets')+'</div>';Array.prototype.forEach.call(el.querySelectorAll('.sup-send'),function(btn){btn.addEventListener('click',function(){var item=btn.closest('.sup-item'),to=btn.getAttribute('data-to'),subj=item.querySelector('.sup-subj').value,bd=item.querySelector('.sup-body').value,st=item.querySelector('.sup-st');if(!to){st.style.color='#ff6258';st.textContent='No email on file';return;}if(!bd.trim()){st.style.color='#ff6258';st.textContent='Write a message first';return;}btn.disabled=true;st.style.color='#9aa3ad';st.textContent='Sending…';fetch('/api/reward/reply?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({to:to,subject:subj,message:bd})}).then(function(r){return r.json();}).then(function(j){btn.disabled=false;if(j.ok){st.style.color='#2ebd85';st.textContent='Sent ✓';item.querySelector('.sup-body').value='';setTimeout(loadSupport,1300);}else if(j.error==='email_not_configured'){st.style.color='#ffb347';st.textContent='Set RESEND_API_KEY first';}else{st.style.color='#ff6258';st.textContent='Failed: '+(j.error||j.detail||'error');}}).catch(function(){btn.disabled=false;st.style.color='#ff6258';st.textContent='Network error';});});});Array.prototype.forEach.call(el.querySelectorAll('.sup-close'),function(btn){btn.addEventListener('click',function(){btn.disabled=true;fetch('/api/reward/support/close?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:btn.getAttribute('data-id')})}).then(function(r){return r.json();}).then(function(){loadSupport();});});});Array.prototype.forEach.call(el.querySelectorAll('.sup-reopen'),function(btn){btn.addEventListener('click',function(){btn.disabled=true;fetch('/api/reward/support/close?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:btn.getAttribute('data-id'),reopen:1})}).then(function(r){return r.json();}).then(function(){loadSupport();});});});}function loadSupport(){fetch('/api/reward/support?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(renderSup).catch(function(){});}
  var rwdAccounts=[],rwdQuery='',rwdSort='new',rwdFilter='all',rwdWired=false;
  function rwdRisk(x){var s=0;if(x.banned)s+=100;if(x.sameDid>1)s+=55;if(x.sameIp>2)s+=40;else if(x.sameIp>1)s+=20;var ageH=x.created?(Date.now()-x.created)/3600000:999;if(ageH<1&&x.claims>=5)s+=30;var cph=ageH>0.05?x.claims/ageH:x.claims;if(cph>9)s+=25;return s;}
  function rwdFlagsArr(x){var f=[];if(x.banned)f.push('banned');if(x.sameDid>1)f.push(x.sameDid+'@DEV');if(x.sameIp>1)f.push(x.sameIp+'@IP');var ageH=x.created?(Date.now()-x.created)/3600000:999;if(ageH<1&&x.claims>=5)f.push('new·'+x.claims+'×');var cph=ageH>0.05?x.claims/ageH:x.claims;if(cph>9)f.push(cph.toFixed(0)+'/hr');return f;}
  function acctName(x){return x.username?('@'+x.username):(x.email||String(x.address||'').replace(/^u:/,''));}
  function acctRow(x){var fl=rwdFlagsArr(x);var badges=fl.length?'<span class="badges">'+fl.map(function(f){var col=f==='banned'?'#ff6258':f.indexOf('@IP')>=0?'#ffb347':'#c2f64a';return '<span class="rbadge" style="color:'+col+';border:1px solid '+col+'">'+esc(f)+'</span>';}).join('')+'</span>':'';return '<div class="rwd-a" data-acct="'+esc(x.address)+'"><span>'+flag(x.cc)+'</span><span class="addr mono"'+(x.banned?' style="text-decoration:line-through;opacity:.65"':'')+'>'+esc(acctName(x))+'</span><span class="meta">'+(x.dev||'?')+' · '+x.claims+'×</span>'+badges+'<span class="bal">$'+(+x.balanceUsd||0).toFixed(2)+'</span></div>';}
  function bindAccts(el){Array.prototype.forEach.call(el.querySelectorAll('[data-acct]'),function(row){row.addEventListener('click',function(){openAcct(row.getAttribute('data-acct'));});});}
  function renderAccts(){var ac=document.getElementById('rwdAccts');if(!ac)return;var list=rwdAccounts.slice();if(rwdQuery)list=list.filter(function(x){return (x.address||'').toLowerCase().indexOf(rwdQuery)>=0||(x.cc||'').toLowerCase().indexOf(rwdQuery)>=0||(x.username||'').toLowerCase().indexOf(rwdQuery)>=0||(x.email||'').toLowerCase().indexOf(rwdQuery)>=0;});if(rwdFilter==='flagged')list=list.filter(function(x){return rwdRisk(x)>0;});else if(rwdFilter==='banned')list=list.filter(function(x){return x.banned;});else if(rwdFilter==='balance')list=list.filter(function(x){return (+x.balanceUsd||0)>0;});if(rwdSort==='new')list.sort(function(a,b){return (b.created||0)-(a.created||0);});else if(rwdSort==='claims')list.sort(function(a,b){return (b.claims||0)-(a.claims||0);});else if(rwdSort==='bal')list.sort(function(a,b){return (+b.balanceUsd||0)-(+a.balanceUsd||0);});else if(rwdSort==='risk')list.sort(function(a,b){return rwdRisk(b)-rwdRisk(a);});var total=rwdAccounts.length,shown=list.length,cap=120,slice=list.slice(0,cap);var cnt=document.getElementById('rwdAcctCount');if(cnt)cnt.textContent=shown===total?('('+total+' total)'):('('+shown+' of '+total+')');ac.innerHTML=slice.length?(slice.map(acctRow).join('')+(shown>cap?'<div class="empty" style="text-align:center">+ '+(shown-cap)+' more — refine your search</div>':'')):'<div class="empty">no accounts match</div>';bindAccts(ac);}
  function wireRwd(){if(rwdWired)return;rwdWired=true;var si=document.getElementById('rwdSearch');if(si)si.addEventListener('input',function(){rwdQuery=(si.value||'').trim().toLowerCase();renderAccts();});var so=document.getElementById('rwdSort');if(so)so.addEventListener('change',function(){rwdSort=so.value;renderAccts();});var fc=document.getElementById('rwdFilters');if(fc)Array.prototype.forEach.call(fc.querySelectorAll('[data-f]'),function(b){b.addEventListener('click',function(){rwdFilter=b.getAttribute('data-f');Array.prototype.forEach.call(fc.querySelectorAll('[data-f]'),function(x){x.classList.toggle('on',x===b);});renderAccts();});});}
  function loadLb(){var el=document.getElementById('rwdLb');if(!el)return;fetch('/api/reward/lbtop?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var rows=(d&&d.top)||[];if(!rows.length){el.innerHTML='<div class="empty">no leaderboard entries this week</div>';return;}el.innerHTML=rows.map(function(r){var who=r.name?('@'+esc(r.name)):esc(String(r.address||'').replace(/^u:/,'').slice(0,10)+'…');var roe=((+r.roe>=0?'+':'')+(+r.roe).toFixed(0))+'%';var st=r.banned?'color:#ffb347;border-color:#5a4a28':'color:#ff8a80;border-color:rgba(255,98,88,.4)';return '<div class="wd-row"'+(r.banned?' style="opacity:.55"':'')+'><span class="meta">#'+r.rank+'</span><span class="addr mono" style="color:'+addrColor(r.address)+'">'+who+'</span><span class="meta">'+esc(r.symbol||'')+' '+esc(r.side||'')+'</span><span class="bal">'+roe+'</span><button class="pay" data-lbej="'+esc(r.address)+'" data-on="'+(r.banned?1:0)+'" style="'+st+'">'+(r.banned?'reinstate':'eject')+'</button></div>';}).join('');Array.prototype.forEach.call(el.querySelectorAll('[data-lbej]'),function(b){b.addEventListener('click',function(){var a=b.getAttribute('data-lbej'),on=b.getAttribute('data-on')==='1';if(!on&&!confirm('Eject this account from the leaderboard? Their entries are wiped and they cannot compete this week.'))return;b.textContent='…';fetch('/api/reward/lbban?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:a,unban:on?1:0})}).then(function(){loadLb();});});});}).catch(function(){});}
  function loadLbHist(){var sel=document.getElementById('rwdLbHistSel'),box=document.getElementById('rwdLbHist');if(!sel||!box)return;fetch('/api/reward/lbhistory?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var weeks=(d&&d.weeks)||[];if(!weeks.length){box.innerHTML='<div class="empty">no leaderboard history yet</div>';return;}var O={month:'short',day:'numeric'};function lbl(w){var s=new Date(w.weekStart),e=new Date(w.weekEnd-1);return (w.current?'This week · ':'')+s.toLocaleDateString('en-US',O)+' – '+e.toLocaleDateString('en-US',O)+' ('+w.entries+')';}sel.innerHTML=weeks.map(function(w,i){return '<option value="'+i+'">'+lbl(w)+'</option>';}).join('');function renderWk(i){var w=weeks[i];if(!w){box.innerHTML='';return;}var medal=['🥇','🥈','🥉'];box.innerHTML=w.top.length?w.top.map(function(r,k){var who=r.who||'anon';var pre=/…$/.test(who)?'':'@';return '<div class="wd-row"><span style="width:34px;flex:0 0 auto">'+(medal[k]||((k+1)+'.'))+'</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+pre+esc(who)+'</span><span class="mono" style="color:'+((+r.roe>=0)?'#2ebd85':'#ff6258')+';font-weight:700">'+((+r.roe>=0?'+':'')+(+r.roe).toFixed(0))+'%</span><span class="muted" style="margin-left:10px;flex:0 0 auto">'+esc(r.symbol||'')+' '+(r.side||'')+'</span></div>';}).join(''):'<div class="empty">no entries this week</div>';}renderWk(0);sel.onchange=function(){renderWk(+this.value);};}).catch(function(){box.innerHTML='<div class="empty">could not load history</div>';});}
var PROMO_REJ_KEY='mp_promo_reject';
  (function(){var ta=document.getElementById('promoRejMsg'),bt=document.getElementById('promoRejSave'),st=document.getElementById('promoRejSt');if(!ta||ta._wired)return;ta._wired=1;try{ta.value=localStorage.getItem(PROMO_REJ_KEY)||'';}catch(e){}if(bt)bt.addEventListener('click',function(){try{localStorage.setItem(PROMO_REJ_KEY,ta.value||'');}catch(e){}if(st){st.textContent='Saved — used for every reject';st.style.color='#2ebd85';setTimeout(function(){st.textContent='';},2500);}});})();
  function loadPromo(){var el=document.getElementById('rwdPromo');if(!el)return;fetch('/api/reward/promo/list?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var pend=(d&&d.pending)||[],dec=(d&&d.decided)||[];var amt=(+((d&&d.promoUsd)||1)).toFixed(2);if(!pend.length&&!dec.length){el.innerHTML='<div class="empty">no promo submissions yet</div>';return;}var nowT=Date.now();function who(p){return p.username?('@'+esc(p.username)):(p.email?esc(p.email):esc(String(p.address||'').replace(/^u:/,'').slice(0,10)));}function plat(p){return p.platform==='x'?'<span style="font-weight:700;color:#e9e7df;flex:0 0 46px">X</span>':'<span style="font-weight:700;color:#5ad8e6;flex:0 0 46px">TikTok</span>';}function lnk(p){return '<a href="'+esc(p.url)+'" target="_blank" rel="noopener" style="color:#9fe0ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">'+esc(String(p.url||'').replace(/^https?:\\/\\//,''))+'</a>';}var html=pend.map(function(p){var age=nowT-p.ts,h=Math.floor(age/3600000),ready=age>=86400000;var abtn=ready?'<button class="pay" data-pra="'+esc(p.id)+'" title="Approve · $'+amt+'" style="color:#41e3a3;border-color:rgba(65,227,163,.5);width:36px;padding:7px 0;font-size:16px;font-weight:800;line-height:1;flex:0 0 auto">\u2713</button>':'<button class="pay" data-pra="'+esc(p.id)+'" data-force="1" title="Approve now (under 24h live) · $'+amt+'" style="color:#ffb347;border-color:rgba(255,179,71,.5);width:36px;padding:7px 0;font-size:16px;font-weight:800;line-height:1;flex:0 0 auto">\u2713</button>';return '<div class="wd-row">'+plat(p)+'<span class="addr mono" style="color:'+addrColor(p.address)+'">'+who(p)+'</span>'+lnk(p)+'<span class="meta">'+(h<1?'now':h+'h ago')+'</span>'+abtn+'<button class="pay" data-prr="'+esc(p.id)+'" title="Reject" style="color:#ff8a80;border-color:rgba(255,98,88,.5);width:36px;padding:7px 0;font-size:16px;font-weight:800;line-height:1;flex:0 0 auto">\u2715</button></div>';}).join('');html+=dec.slice(0,8).map(function(p){var st=p.status==='approved'?'<span class="meta" style="color:#2ebd85">approved +$'+(+p.amount||0).toFixed(2)+'</span>':'<span class="meta" style="color:#ff8a80">rejected'+(p.note?' · '+esc(p.note):'')+'</span>';return '<div class="wd-row" style="opacity:.55">'+plat(p)+'<span class="addr mono">'+who(p)+'</span>'+lnk(p)+st+'</div>';}).join('');el.innerHTML=html;Array.prototype.forEach.call(el.querySelectorAll('[data-pra]'),function(b){b.addEventListener('click',function(){var force=b.getAttribute('data-force')==='1';if(!confirm((force?'Approve NOW (post is under 24h live)? ':'Approve? ')+'$'+amt+' lands on their balance. Did you open the post and check it mentions MarginPad?'))return;b.textContent='…';fetch('/api/reward/promo/review?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:b.getAttribute('data-pra'),action:'approve',force:force})}).then(function(r){return r.json();}).then(function(j){if(j&&j.error)alert(j.error==='too_early'?'Less than 24h old — use the amber approve-now button.':j.error);loadPromo();});});});Array.prototype.forEach.call(el.querySelectorAll('[data-prr]'),function(b){b.addEventListener('click',function(){var saved='';try{saved=localStorage.getItem(PROMO_REJ_KEY)||'';}catch(e){}var note=prompt('Reject reason (the user sees this — edit if needed, or save a default above):',saved);if(note===null)return;b.textContent='…';fetch('/api/reward/promo/review?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:b.getAttribute('data-prr'),action:'reject',note:note})}).then(function(){loadPromo();});});});}).catch(function(){});}
  function loadRewards(){wireRwd();loadLb();loadPromo();if(!window.__lbHistDone){window.__lbHistDone=1;try{loadLbHist();}catch(e){}}Promise.all([fetch('/api/reward/accounts?key='+encodeURIComponent(key)).then(function(r){return r.json();}),fetch('/api/reward/admin?key='+encodeURIComponent(key)).then(function(r){return r.json();}),fetch('/api/reward/log?key='+encodeURIComponent(key)).then(function(r){return r.json();})]).then(function(res){var a=res[0]||{},ad=res[1]||{},lg=res[2]||{};rwdAccounts=a.accounts||[];var lf=document.getElementById('rwdLog');if(lf){var cl=(lg.log||[]).filter(function(e){return e.type==='claim';});lf.innerHTML=cl.length?cl.map(function(e){var who=e.username?('@'+esc(e.username)):(e.email?esc(e.email):(e.address?esc(String(e.address).replace(/^u:/,'')):'(anon)'));return '<div class="wd-row" data-acct="'+esc(e.address||'')+'" style="cursor:pointer"><span>'+flag(e.cc)+'</span><span class="addr mono" style="color:'+addrColor(e.address)+'">'+who+'</span><span class="meta">+$'+(+e.amountUsd||0).toFixed(2)+'</span><span class="meta" style="margin-left:auto">'+ago(e.ts)+'</span></div>';}).join(''):'<div class="empty">no claims yet</div>';bindAccts(lf);}var pend=ad.pending||[];var pendSum=pend.reduce(function(s,w){return s+(+w.amountUsd||0);},0);var flagged=rwdAccounts.filter(function(x){return rwdRisk(x)>0;}).length;var banned=(a.bannedCount!=null?a.bannedCount:rwdAccounts.filter(function(x){return x.banned;}).length);var cards=document.getElementById('rwdCards');if(cards)cards.innerHTML=card(N(a.count),'Addresses')+card(N(ad.newToday||0),'New today')+card(N(ad.activeToday||0),'Active today')+card(N(ad.claimsToday||0),'Claims today')+card('$'+(+ad.dispensedTodayUsd||0).toFixed(2)+' / $'+N(ad.dailyCapUsd),'Dispensed today')+card('$'+(+a.totalBalanceUsd||0).toFixed(2),'Unpaid balance')+card(N(pend.length)+(pend.length?' · $'+pendSum.toFixed(2):''),'Pending payouts')+card('$'+(+ad.totalPaidUsd||0).toFixed(2),'Total paid');var rs=document.getElementById('rwdRisk');if(rs)rs.innerHTML='Flagged <b style="color:#ffb347">'+flagged+'</b>  ·  Banned <b style="color:#ff6258">'+banned+'</b>  ·  Distinct IPs <b>'+(a.ipDistinct!=null?a.ipDistinct:'—')+'</b>  ·  Wallets sharing an IP <b style="color:#ffb347">'+(a.sharedIpWallets!=null?a.sharedIpWallets:'—')+'</b>';var fl2=rwdAccounts.filter(function(x){return rwdRisk(x)>0;}).sort(function(a2,b2){return rwdRisk(b2)-rwdRisk(a2);}).slice(0,15);var fe=document.getElementById('rwdFlagged');if(fe){fe.innerHTML=fl2.length?fl2.map(acctRow).join(''):'<div class="empty">nothing flagged — all clean</div>';bindAccts(fe);}var wd=document.getElementById('rwdWd');if(wd){wd.innerHTML=pend.length?pend.map(function(w){return '<div class="wd-row"><span class="addr mono">'+esc(w.address)+'</span><span class="bal">$'+(+w.amountUsd||0).toFixed(2)+'</span><button class="pay" data-id="'+esc(w.id)+'">mark paid</button></div>';}).join(''):'<div class="empty">no pending withdrawals</div>';Array.prototype.forEach.call(wd.querySelectorAll('.pay'),function(btn){btn.addEventListener('click',function(){var id=btn.getAttribute('data-id'),tx=prompt('Tx hash (optional):')||'';btn.textContent='…';fetch('/api/reward/admin/paid?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id,txid:tx})}).then(function(){loadRewards();});});});}var pd=document.getElementById('rwdPaid');if(pd)pd.innerHTML=(ad.paidHistory&&ad.paidHistory.length)?ad.paidHistory.map(function(w){var txid=(w.txid||'').replace(/[^0-9a-fA-Fx]/g,'');var tx=txid?'<a href="https://bscscan.com/tx/'+txid+'" target="_blank" rel="noopener" style="color:#c2f64a">tx</a>':'(no hash)';return '<div class="wd-row"><span class="addr mono">'+esc(w.address)+'</span><span class="bal">$'+(+w.amountUsd||0).toFixed(2)+'</span><span class="meta" style="margin-left:auto">'+tx+' · '+ago(w.paidTs||w.ts||Date.now())+'</span></div>';}).join(''):'<div class="empty">no payouts yet</div>';renderAccts();});}var usersState={q:'',offset:0,limit:50,loading:false,end:false,wired:false};
function uDevice(ua){if(!ua)return '';return /Mobi|Android|iPhone|iPad|iPod/i.test(ua)?'Mobile':'Desktop';}
function uVerb(t){return t==='exchange'?'clicked an exchange':t==='paper'?'opened Paper Trade':t==='tool'?'opened a tool':t==='tab'?'used a calculator':t==='hotpair'?'traded a pair':t==='pageview'?'viewed':(t||'did');}
function uBadge(u){var b='';if(u.status==='banned')b+=' <span style="font-size:9px;font-family:monospace;color:#ff6258;border:1px solid #ff6258;border-radius:4px;padding:0 4px">BANNED</span>';else if(u.status==='suspended')b+=' <span style="font-size:9px;font-family:monospace;color:#ffb347;border:1px solid #ffb347;border-radius:4px;padding:0 4px">SUSP</span>';if(u.muted)b+=' <span style="font-size:9px;font-family:monospace;color:#9aa3ad;border:1px solid #5c656f;border-radius:4px;padding:0 4px">MUTE</span>';if(u.vpn)b+=' <span style="font-size:9px;font-family:monospace;color:#9ab4ff;border:1px solid #9ab4ff;border-radius:4px;padding:0 4px">VPN</span>';return b;}
function userRow(u){var name=u.username?esc(u.username):esc((u.email||'').split('@')[0]);return '<div class="rwd-a" data-user="'+esc(u.email)+'"><span>'+flag(u.cc)+'</span><span class="addr" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;color:#e9e7df;font-size:13px;font-weight:600">'+name+uBadge(u)+' <span class="mono" style="color:#5c656f;font-size:11px;font-weight:400">'+esc(u.email)+'</span></span><span class="meta">'+(u.logins||0)+'× · '+(u.pv||0)+'pv'+(u.trades?' · '+u.trades+'tr':'')+'</span><span class="meta" style="margin-left:auto">'+ago(u.created)+'</span></div>';}
function wireUsers(){if(usersState.wired)return;usersState.wired=true;var si=document.getElementById('uSearch');if(si){var t;si.addEventListener('input',function(){clearTimeout(t);t=setTimeout(function(){usersState.q=(si.value||'').trim();usersState.offset=0;usersState.end=false;loadUsers(true);},300);});}var lm=document.getElementById('uMore');if(lm)lm.addEventListener('click',function(){if(usersState.loading||usersState.end)return;usersState.offset+=usersState.limit;loadUsers(false);});}
function loadUsers(reset){wireUsers();usersState.loading=true;var list=document.getElementById('uList');if(reset&&list)list.innerHTML='<div class="empty">loading…</div>';var u='/api/auth/admin?key='+encodeURIComponent(key)+'&limit='+usersState.limit+'&offset='+usersState.offset+(usersState.q?'&q='+encodeURIComponent(usersState.q):'');fetch(u).then(function(r){return r.json();}).then(function(d){usersState.loading=false;var c=document.getElementById('uCards');if(c)c.innerHTML=card(N(d.count||0),'Total users')+card(N(d.newToday||0),'New today')+card(N(d.activeToday||0),'Active today')+card(N(d.matched||0),usersState.q?'Search matches':'Listed');var us=d.users||[];if(reset&&list)list.innerHTML='';if(!us.length&&usersState.offset===0){if(list)list.innerHTML='<div class="empty">'+(usersState.q?'no users match':'no users yet')+'</div>';}else if(list){list.insertAdjacentHTML('beforeend',us.map(userRow).join(''));}if(us.length<usersState.limit)usersState.end=true;var more=document.getElementById('uMore');if(more)more.style.display=(usersState.end||!us.length)?'none':'block';if(list)Array.prototype.forEach.call(list.querySelectorAll('[data-user]'),function(row){if(row.getAttribute('data-bound'))return;row.setAttribute('data-bound','1');row.addEventListener('click',function(){openUser(row.getAttribute('data-user'));});});}).catch(function(){usersState.loading=false;});}
function openUser(email){window.open('/api/admin/user?key='+encodeURIComponent(key)+'&email='+encodeURIComponent(email),'_blank','noopener');}
function renderUser(d){var b=document.getElementById('umBody');if(!b)return;if(!d.exists){b.innerHTML='<div class="amod-msg">No such user.</div>';return;}var u=d.user;var h='<div class="amod-grid">'+cell('Joined',u.created?ago(u.created)+' ago':'—')+cell('Last seen',u.last_seen?ago(u.last_seen)+' ago':'—')+cell('Logins',u.logins||0)+cell('Page views',u.pv||0)+cell('Active sessions',d.activeSessions||0)+cell('Events',d.evTotal||0)+cell('From',(flag(u.cc)||'')+' '+(u.cc||'?')+' · '+(u.dev||'?')+(u.br?' · '+u.br:''))+cell('User ID',(u.id||'').slice(0,12)+'…')+'</div>';h+='<div class="amod-sec">Recent activity ('+(d.evTotal||0)+')</div>';if(d.events&&d.events.length){h+='<div style="max-height:230px;overflow:auto;margin:0 -2px">'+d.events.map(function(e){return '<div class="wd-row"><span>'+(flag(e.cc)||'·')+'</span><span style="flex:1;min-width:0;color:#cdd3da;font-size:12.5px">a visitor '+esc(uVerb(e.type))+(e.label?' <b style="color:#c2f64a">'+esc(e.label)+'</b>':'')+(e.path?' <span class="mono" style="color:#7f8893">'+esc(e.path)+'</span>':'')+'</span><span class="meta" style="margin-left:auto">'+ago(e.ts)+'</span></div>';}).join('')+'</div>';}else{h+='<div class="amod-msg" style="text-align:left;margin-top:0">No activity recorded yet. Page views &amp; clicks are tracked while the user is signed in.</div>';}if(d.sessions&&d.sessions.length){h+='<div class="amod-sec">Login history</div>'+d.sessions.map(function(s){return '<div class="wd-row"><span>'+(flag(s.cc)||'·')+'</span><span style="flex:1;color:#9aa3ad;font-size:12px">'+esc(uDevice(s.ua)||'?')+(s.active?' <span style="color:#2ebd85">· active</span>':'')+'</span><span class="meta" style="margin-left:auto">'+ago(s.created)+'</span></div>';}).join('');}b.innerHTML=h;}
var umClose=document.getElementById('umClose');if(umClose)umClose.addEventListener('click',function(){document.getElementById('userModal').hidden=true;});var userModalEl=document.getElementById('userModal');if(userModalEl)userModalEl.addEventListener('click',function(e){if(e.target===userModalEl)userModalEl.hidden=true;});
function secScore(x){return Math.min(100,rwdRisk(x));}function secCol(s){return s>=70?'#ff6258':s>=40?'#ff8c42':s>=20?'#ffd75a':'#2ebd85';}function secRow(x){var s=secScore(x),col=secCol(s),fl=rwdFlagsArr(x);return '<div class="rwd-a" data-acct="'+esc(x.address)+'"><span class="rbadge" style="color:'+col+';border:1px solid '+col+';min-width:26px;text-align:center;font-weight:800">'+s+'</span><span class="addr mono"'+(x.banned?' style="text-decoration:line-through;opacity:.65"':'')+'>'+esc(acctName(x))+'</span><span class="meta">'+flag(x.cc)+' '+(x.dev||'?')+' · '+x.claims+'×</span>'+(fl.length?'<span class="badges">'+fl.map(function(f){return '<span class="rbadge" style="color:#ffb347;border:1px solid #ffb347">'+esc(f)+'</span>';}).join('')+'</span>':'')+'<span class="bal">$'+(+x.balanceUsd||0).toFixed(2)+'</span></div>';}function loadSecurity(){var lst=document.getElementById('secList');if(lst)lst.innerHTML='<div class="empty">loading…</div>';fetch('/api/reward/accounts?key='+encodeURIComponent(key)).then(function(r){return r.json();}).then(function(d){var a=d.accounts||[];a.sort(function(x,y){return secScore(y)-secScore(x);});var red=0,orange=0,yellow=0,banned=0;a.forEach(function(x){var s=secScore(x);if(x.banned)banned++;if(s>=70)red++;else if(s>=40)orange++;else if(s>=20)yellow++;});var cc=document.getElementById('secCards');if(cc)cc.innerHTML=card('<span style="color:#ff6258">'+red+'</span>','Critical · red')+card('<span style="color:#ff8c42">'+orange+'</span>','High · orange')+card('<span style="color:#ffd75a">'+yellow+'</span>','Watch · yellow')+card('<span style="color:#ff6258">'+banned+'</span>','Banned')+card(N(d.ipDistinct!=null?d.ipDistinct:0),'Distinct IPs')+card('<span style="color:#ffb347">'+(d.sharedIpWallets!=null?d.sharedIpWallets:0)+'</span>','Wallets sharing IP');var risky=a.filter(function(x){return secScore(x)>=20;});if(lst){lst.innerHTML=risky.length?risky.slice(0,60).map(secRow).join(''):'<div class="empty">no risky accounts — all green ✓</div>';bindAccts(lst);}var shared=a.filter(function(x){return (x.sameIp||0)>1;}).sort(function(p,q){return (q.sameIp||0)-(p.sameIp||0);});var ce=document.getElementById('secClusters');if(ce){ce.innerHTML=shared.length?shared.map(function(x){return '<div class="wd-row" data-acct="'+esc(x.address)+'" style="cursor:pointer"><span>'+flag(x.cc)+'</span><span class="addr mono">'+esc(acctName(x))+'</span><span class="meta" style="color:#ffb347">'+x.sameIp+' wallets on this IP</span><span class="meta" style="margin-left:auto">'+x.claims+'× · $'+(+x.balanceUsd||0).toFixed(2)+'</span></div>';}).join(''):'<div class="empty">no IP-sharing accounts ✓</div>';bindAccts(ce);}}).catch(function(){if(lst)lst.innerHTML='<div class="empty">could not load</div>';});}
})();</script></body></html>`;
  const htmlOut = html;
  try { await env.STATS.put('st:cache', htmlOut, { expirationTtl: 25 }); await env.STATS.put('st:cache:last', htmlOut, { expirationTtl: 86400 }); } catch (e) {}
  return htmlResp(htmlOut);
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
  '<b>📈 Paper trade — right here</b>\n' +
  '<code>/open</code> BTC 100 x300 — open a demo position\n' +
  '<code>/positions</code> — live PnL on your positions\n' +
  '<code>/close</code> BTC — close & see the result\n\n' +
  '<b>💲 Prices & alerts</b>\n' +
  '<code>/price</code> BTC — live price\n' +
  '<code>/alert</code> BTC 70000 — ping me when it hits\n' +
  '<code>/alerts</code> — your alerts\n\n' +
  '<b>📈 Live market data</b>\n' +
  '<code>/rekt</code> — 24h liquidations\n' +
  '<code>/funding</code> — funding extremes\n' +
  '<code>/sentiment</code> — Fear &amp; Greed\n\n' +
  '<b>🏆 Paper Trade Leaderboard — win USDT weekly</b>\n' +
  '<code>/leaderboard</code> — this week’s top traders\n' +
  'Members only — sign up free at marginpad.io · 🥇 $30  🥈 $20  🥉 $10\n\n' +
  '💡 <b>Try:</b> <code>/liq 60000 10 long</code>\n\n' +
  'Tap a button below 👇';
const TG_KB = {
  inline_keyboard: [
    [{ text: '🔥 Liquidation', callback_data: 'liq' }, { text: '📊 PnL / ROI', callback_data: 'pnl' }],
    [{ text: '📏 Position size', callback_data: 'size' }, { text: '⚖️ Risk / Reward', callback_data: 'rr' }],
    [{ text: '💲 Price & alerts', callback_data: 'price' }, { text: '🏆 Leaderboard', callback_data: 'lb' }],
    [{ text: '📈 Paper trade', callback_data: 'paper' }],
    [{ text: '🌐 Open MarginPad.io', url: 'https://marginpad.io' }],
  ],
};
const TG_FORMATS = {
  liq: '🔥 <b>Liquidation price</b>\n\nSend:\n<code>/liq &lt;entry&gt; &lt;leverage&gt; [long|short]</code>\n\nExample:\n<code>/liq 60000 10 long</code>',
  pnl: '📊 <b>PnL / ROI</b>\n\nSend:\n<code>/pnl &lt;entry&gt; &lt;exit&gt; &lt;size&gt; [lev] [long|short]</code>\n\nExample:\n<code>/pnl 60000 66000 0.5 10 long</code>',
  size: '📏 <b>Position size</b>\n\nSend:\n<code>/size &lt;balance&gt; &lt;risk%&gt; &lt;entry&gt; &lt;stop&gt;</code>\n\nExample:\n<code>/size 5000 1 60000 58800</code>',
  rr: '⚖️ <b>Risk / Reward</b>\n\nSend:\n<code>/rr &lt;entry&gt; &lt;stop&gt; &lt;takeprofit&gt;</code>\n\nExample:\n<code>/rr 60000 58000 66000</code>',
  price: '💲 <b>Prices & alerts</b>\n\nLive price:\n<code>/price BTC</code>\n\nSet an alert:\n<code>/alert BTC 70000</code>\n<i>I\'ll message you the moment it hits.</i>\n\nYour alerts: <code>/alerts</code>',
  paper: '📈 <b>Paper trade — right in chat</b>\n\nOpen a demo position:\n<code>/open BTC 100 x300</code>\n<i>coin · margin in $ · leverage</i>\n\nShort it:\n<code>/open ETH 50 x20 short</code>\n\nTrack live PnL: <code>/positions</code>\nClose it: <code>/close BTC</code>\n\n<i>Risk-free — no real money. Best trades rank on /leaderboard.</i>',
};
const tgfmt = v => isFinite(v) ? (Math.abs(v) >= 1 ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : v.toLocaleString('en-US', { maximumFractionDigits: 6 })) : '—';
// Parse "/open btc 100 x300 [short]" → {sym, margin, lev, side}. Order-tolerant; side defaults long.
function parseOpen(text) {
  const parts = text.trim().split(/\s+/).slice(1);
  let sym = '', margin = NaN, lev = NaN, side = 'long';
  for (let raw of parts) {
    const t = raw.toLowerCase();
    if (t === 'long' || t === 'buy') { side = 'long'; continue; }
    if (t === 'short' || t === 'sell') { side = 'short'; continue; }
    const lm = t.match(/^x(\d+(?:\.\d+)?)$/) || t.match(/^(\d+(?:\.\d+)?)x$/); // x300 or 300x
    if (lm) { lev = parseFloat(lm[1]); continue; }
    const num = parseFloat(raw.replace(/[$,]/g, ''));
    if (isFinite(num) && /\d/.test(raw) && !/[a-z]/i.test(raw.replace(/[$,]/g, ''))) { if (!isFinite(margin)) margin = num; continue; }
    if (!sym && /^[a-z]{2,12}$/i.test(raw.replace(/[$,]/g, ''))) sym = raw.replace(/[$,]/g, '').toUpperCase();
  }
  if (!sym || !isFinite(margin) || margin <= 0) return null;
  if (!isFinite(lev) || lev <= 0) lev = 1;
  lev = Math.min(lev, 1000);
  return { sym, margin, lev, side };
}
// Live P&L math for a stored paper position given the current price.
function posCalc(x, cur) {
  const dir = x.side === 'long' ? 1 : -1;
  const ch = (cur - x.entry) / x.entry;
  const pnl = x.margin * x.lev * ch * dir;
  const roe = x.lev * ch * 100 * dir;
  const liq = x.side === 'long' ? x.entry * (1 - 1 / x.lev) : x.entry * (1 + 1 / x.lev);
  return { pnl, roe, liq, size: x.margin * x.lev };
}

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
async function leaderboard(env) {
  if (!env.REWARDS) return 'Leaderboard temporarily unavailable.';
  const pz = await rewardCfg(env);
  let top = [], weekEnd = 0;
  try { const r = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/lb')); const j = await r.json(); top = (j && j.top) || []; weekEnd = (j && j.weekEnd) || 0; } catch (e) {}
  let endStr = ''; if (weekEnd) { const ms = weekEnd - Date.now(); if (ms > 0) { const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000); endStr = (d > 0 ? d + 'd ' : '') + h + 'h'; } }
  const medal = ['🥇', '🥈', '🥉'];
  let out = '🏆 <b>Paper Trade Leaderboard — this week</b>\n' + DIV + '\n';
  if (!top.length) out += 'No trades on the board yet. Be the first!\n';
  else top.forEach((x, i) => { out += (medal[i] || (i + 1) + '. ') + ' <code>' + x.who + '</code> — <b>' + ((+x.roe) >= 0 ? '+' : '') + (+x.roe).toFixed(0) + '%</b> on ' + (x.symbol || '?') + ' ' + (x.side || '') + '\n'; });
  out += '\n⏳ Runs <b>Mon → Sun (UTC)</b>' + (endStr ? ' — ends in <b>' + endStr + '</b>' : '') + '. Winners paid Monday.\n';
  out += '\n🥇 $' + pz.prize1 + '  🥈 $' + pz.prize2 + '  🥉 $' + pz.prize3 + ' — paid in USDT every week.\n🔒 <b>Members only</b> — sign up free (email) at <a href="https://marginpad.io">marginpad.io</a>, close winning <a href="https://marginpad.io/?p=plan">Paper Trades</a>, and add a wallet on <a href="https://marginpad.io/rewards/">/rewards</a> to collect prizes.';
  return out;
}
async function handleTelegram(request, env) {
  if (!env || !env.TELEGRAM_TOKEN) return new Response('ok');
  if (request.method !== 'POST') return new Response('ok');
  // Anti-forgery: once TG_WEBHOOK_SECRET is set AND registered (GET /api/admin/tgsetwebhook?key=ADMIN_KEY),
  // Telegram sends it in this header on every update — forged POSTs (e.g. fake channel_post to hijack the
  // broadcast destination in KV tg:channel) are rejected. Fail-open while the secret is unset.
  if (env.TG_WEBHOOK_SECRET && request.headers.get('x-telegram-bot-api-secret-token') !== env.TG_WEBHOOK_SECRET) return new Response('forbidden', { status: 403 });
  let update; try { update = await request.json(); } catch (e) { return new Response('ok'); }
  const token = env.TELEGRAM_TOKEN;
  const base = { parse_mode: 'HTML', disable_web_page_preview: true };

  // Auto-capture the announcement channel id the moment the bot sees any activity there
  // (added as admin, or a post). Lets the owner broadcast with no manual config / no secret.
  const chEv = update.channel_post || update.edited_channel_post
    || (update.my_chat_member && update.my_chat_member.chat) || (update.chat_member && update.chat_member.chat);
  const chChat = (update.channel_post || update.edited_channel_post) ? (update.channel_post || update.edited_channel_post).chat : chEv;
  if (chChat && chChat.type === 'channel' && env.STATS) {
    try {
      await env.STATS.put('tg:channel', String(chChat.id));
      await env.STATS.put('tg:channel_name', chChat.username ? '@' + chChat.username : (chChat.title || String(chChat.id)));
    } catch (e) {}
    return new Response('ok');
  }

  if (update.callback_query) {
    const cq = update.callback_query;
    await bumpBot(env, 'btn-' + cq.data, cq.from && cq.from.id);
    await tgApi(token, 'answerCallbackQuery', { callback_query_id: cq.id });
    const cbText = cq.data === 'lb' ? await leaderboard(env) : (TG_FORMATS[cq.data] || TG_HELP);
    const cbChat = cq.message && cq.message.chat && cq.message.chat.id; // Telegram can deliver a callback_query without `message` (old/inline) — guard so it doesn't throw → 500 → webhook retry storm
    if (cbChat) await tgApi(token, 'sendMessage', { chat_id: cbChat, text: cbText, ...base });
    return new Response('ok');
  }
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return new Response('ok');
  const cmd = msg.text.trim().split(/\s+/)[0].toLowerCase().replace(/@.*$/, '');
  await bumpBot(env, cmd.replace(/^\//, '') || 'msg', msg.from && msg.from.id);
  if (cmd === '/start' || cmd === '/help') {
    const payload = msg.text.trim().split(/\s+/)[1] || ''; // deep-link token from t.me/MarginPadBot?start=<token> (account ↔ Telegram link for alerts)
    if (cmd === '/start' && /^[0-9a-f]{8,32}$/.test(payload) && env.STATS && env.USERS) {
      let uid = ''; try { uid = await env.STATS.get('tglink:' + payload) || ''; } catch (e) {}
      if (uid) {
        try { await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/tglink/set', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, chat: String(msg.chat.id) }) })); } catch (e) {}
        try { await env.STATS.delete('tglink:' + payload); } catch (e) {}
        await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '<b>Connected.</b> Your MarginPad price alerts will arrive right here.\n\nManage them at <a href="https://marginpad.io/alerts/">marginpad.io/alerts</a>.', ...base });
        return new Response('ok');
      }
    }
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: TG_HELP, ...base, reply_markup: TG_KB });
    return new Response('ok');
  }
  if (cmd === '/trade' || cmd === '/me') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: 'The leaderboard now ranks your real <b>paper trades</b> — no manual entry.\n\n📈 Trade free at <a href="https://marginpad.io/?p=plan">MarginPad Paper Trade</a>, add your wallet at <a href="https://marginpad.io/rewards/">marginpad.io/rewards</a>, and your best trade of the week ranks automatically.\n\nStandings: /leaderboard', ...base });
    return new Response('ok');
  }
  if (cmd === '/leaderboard' || cmd === '/lb') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: await leaderboard(env), ...base });
    return new Response('ok');
  }
  if (cmd === '/price' || cmd === '/p') {
    const p = await fetchPrice(msg.text.split(/\s+/)[1]);
    const text = p ? `💲 <b>${p.sym}/USDT</b>\n${DIV}\nPrice  <b>$${tgfmt(p.price)}</b>\n24h    ${p.chg >= 0 ? '🟢 +' : '🔴 '}${(+p.chg).toFixed(2)}%` : '❓ Couldn\'t find that coin. Try <code>/price BTC</code>.';
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text, ...base });
    return new Response('ok');
  }
  // --- live market data (Coinglass) — reuse the cached endpoints ---
  const big = x => { x = +x || 0; const a = Math.abs(x); return a >= 1e9 ? '$' + (x / 1e9).toFixed(2) + 'B' : a >= 1e6 ? '$' + (x / 1e6).toFixed(1) + 'M' : a >= 1e3 ? '$' + (x / 1e3).toFixed(0) + 'K' : '$' + x.toFixed(0); };
  if (cmd === '/rekt' || cmd === '/liquidations' || cmd === '/liqs') {
    let text = '⚠️ Liquidation data is unavailable right now — try again shortly.';
    try {
      const d = await (await handleCgLiquidations(new URL('https://marginpad.io/api/cg/liquidations'), env)).json();
      if (d && d.market) {
        const m = d.market, lp = m.total ? Math.round(m.long / m.total * 100) : 50;
        const top = (d.coins || []).slice(0, 5).map((c, i) => `${i + 1}. <b>${c.s}</b> — ${big(c.liq)}`).join('\n');
        text = `💥 <b>Liquidations · 24h</b>\n${DIV}\nTotal   <b>${big(m.total)}</b>\nLongs   🔴 ${big(m.long)} (${lp}%)\nShorts  🟢 ${big(m.short)} (${100 - lp}%)\n\n<b>Most rekt</b>\n${top}\n\n➡️ <a href="https://marginpad.io/liquidations/">Full liquidations tracker</a>`;
      }
    } catch (e) {}
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text, ...base });
    return new Response('ok');
  }
  if (cmd === '/funding' || cmd === '/fund') {
    let text = '⚠️ Funding data is unavailable right now — try again shortly.';
    try {
      const d = await (await handleCgFunding(new URL('https://marginpad.io/api/cg/funding'), env)).json();
      const c = (d && d.coins) || [];
      if (c.length) {
        const hi = c[0], lo = c[c.length - 1];
        const f = v => (v >= 0 ? '+' : '') + (+v).toFixed(4) + '%';
        const list = c.slice(0, 8).map(x => `${(x.s + '     ').slice(0, 5)} ${f(x.funding)}`).join('\n');
        text = `📊 <b>Funding rates</b>\n${DIV}\nCrowded longs:  <b>${hi.s}</b> ${f(hi.funding)}\nCrowded shorts: <b>${lo.s}</b> ${f(lo.funding)}\n\n<code>${list}</code>\n\n➡️ <a href="https://marginpad.io/funding/">Funding scanner</a>`;
      }
    } catch (e) {}
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text, ...base });
    return new Response('ok');
  }
  if (cmd === '/sentiment' || cmd === '/fear') {
    let text = '⚠️ Sentiment data is unavailable right now — try again shortly.';
    try {
      const d = await (await handleCgPulse(new URL('https://marginpad.io/api/cg/pulse'), env)).json();
      const fg = d && d.fearGreed, m = d && d.liq24h, lines = [];
      if (fg) lines.push(`Fear &amp; Greed  <b>${fg.value}</b> — ${fg.label}${fg.prev != null ? ` <i>(yest. ${fg.prev})</i>` : ''}`);
      if (m) lines.push(`24h liquidations  <b>${big(m.total)}</b>\n  🔴 ${big(m.long)} longs · 🟢 ${big(m.short)} shorts`);
      if (lines.length) text = `🧭 <b>Market sentiment</b>\n${DIV}\n${lines.join('\n')}\n\n➡️ <a href="https://marginpad.io/">Live market pulse</a>`;
    } catch (e) {}
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
  // ---- paper positions from Telegram: /open, /positions, /close ----
  if (cmd === '/open') {
    const o = parseOpen(msg.text);
    if (!o) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '📈 <b>Open a paper position</b>\nSend: <code>/open BTC 100 x300</code>\n<i>coin · margin in $ · leverage</i>\n\nGoing short? <code>/open ETH 50 x20 short</code>', ...base }); return new Response('ok'); }
    const p = await fetchPrice(o.sym);
    if (!p) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '❓ Couldn\'t find that coin. Try <code>/open BTC 100 x300</code>.', ...base }); return new Response('ok'); }
    let cnt = 0, pairCnt = 0; try { const l = await env.STATS.list({ prefix: 'pos:' + msg.chat.id + ':' }); cnt = l.keys.length; if (cnt < 50) for (const k of l.keys) { try { const v = JSON.parse(await env.STATS.get(k.name) || 'null'); if (v && v.sym === p.sym) pairCnt++; } catch (e) {} } } catch (e) {}
    if (cnt >= 50) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '⚠️ Limit reached — 50 open positions is the max. Close some first (/positions).', ...base }); return new Response('ok'); }
    if (pairCnt >= 10) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '⚠️ Limit reached — max 10 open ' + p.sym + ' positions. Close one first (<code>/close ' + p.sym + '</code>).', ...base }); return new Response('ok'); }
    const id = Date.now().toString(36).slice(-5) + Math.floor(Math.random() * 1296).toString(36);
    const pos = { id, sym: p.sym, side: o.side, margin: o.margin, lev: o.lev, entry: p.price, ts: Date.now() };
    // claim token → lets the user open this exact position in My Trades on the website (web or mobile), idempotent import
    const claimTok = (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-z0-9]/g, '');
    pos.claim = claimTok;
    try { await env.STATS.put('pos:' + msg.chat.id + ':' + id, JSON.stringify(pos)); } catch (e) {}
    try { await env.STATS.put('tgclaim:' + claimTok, JSON.stringify({ sym: pos.sym, side: pos.side, margin: pos.margin, lev: pos.lev, entry: pos.entry, ts: pos.ts }), { expirationTtl: 2592000 }); } catch (e) {}
    const c = posCalc(pos, p.price);
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: (o.side === 'long' ? '🟢' : '🔴') + ' <b>Opened ' + o.side.toUpperCase() + ' ' + p.sym + '</b>\n' + DIV + '\nMargin  <b>$' + tgfmt(o.margin) + '</b>\nLeverage  <b>' + o.lev + '×</b>\nSize  <b>$' + tgfmt(c.size) + '</b>\nEntry  <b>$' + tgfmt(p.price) + '</b>\nLiq.  ~$' + tgfmt(c.liq) + '\n\n🔗 <a href="https://marginpad.io/paper-trade?claim=' + claimTok + '">Open &amp; track it on MarginPad →</a>\n\n📊 In chat: /positions · close with <code>/close ' + id + '</code>', ...base });
    return new Response('ok');
  }
  if (cmd === '/positions' || cmd === '/pos' || cmd === '/positon') {
    const poss = [];
    try { const l = await env.STATS.list({ prefix: 'pos:' + msg.chat.id + ':' }); for (const k of l.keys) { const v = JSON.parse(await env.STATS.get(k.name) || 'null'); if (v) poss.push(v); } } catch (e) {}
    if (!poss.length) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '📊 No open positions yet.\nOpen one: <code>/open BTC 100 x300</code>', ...base }); return new Response('ok'); }
    const syms = {}; poss.forEach(x => { syms[x.sym] = 1; });
    const prices = {}; await Promise.all(Object.keys(syms).map(async s => { try { const pp = await fetchPrice(s); if (pp) prices[s] = pp.price; } catch (e) {} }));
    let tot = 0;
    const lines = poss.sort((a, b) => a.ts - b.ts).map(x => {
      const cur = prices[x.sym];
      if (!cur) return '• <b>' + x.sym + '</b> ' + x.side + ' — price unavailable  <code>' + x.id + '</code>';
      const c = posCalc(x, cur); tot += c.pnl;
      return (c.roe >= 0 ? '🟢' : '🔴') + ' <b>' + x.sym + '</b> ' + x.side + ' ' + x.lev + '×  <code>' + x.id + '</code>\n   Entry $' + tgfmt(x.entry) + ' → Now $' + tgfmt(cur) + '\n   PnL <b>' + (c.pnl >= 0 ? '+' : '') + '$' + tgfmt(c.pnl) + '</b> (' + (c.roe >= 0 ? '+' : '') + c.roe.toFixed(0) + '% ROE) · Liq ~$' + tgfmt(c.liq) + (x.claim ? '\n   🔗 <a href="https://marginpad.io/paper-trade?claim=' + x.claim + '">View on MarginPad</a>' : '');
    });
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '📊 <b>Your paper positions</b>\n' + DIV + '\n' + lines.join('\n\n') + '\n' + DIV + '\nTotal PnL  <b>' + (tot >= 0 ? '+' : '') + '$' + tgfmt(tot) + '</b>\n\nClose one: <code>/close ' + poss[0].id + '</code> (or <code>/close ' + poss[0].sym + '</code>)', ...base });
    return new Response('ok');
  }
  if (cmd === '/close') {
    const arg = (msg.text.trim().split(/\s+/)[1] || '').trim();
    if (!arg) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: 'Close a position: <code>/close &lt;id&gt;</code> or <code>/close BTC</code>\nSee /positions for IDs.', ...base }); return new Response('ok'); }
    let match = null, matchKey = '';
    try { const l = await env.STATS.list({ prefix: 'pos:' + msg.chat.id + ':' }); for (const k of l.keys) { const v = JSON.parse(await env.STATS.get(k.name) || 'null'); if (v && (v.id === arg || v.sym === arg.toUpperCase())) { match = v; matchKey = k.name; break; } } } catch (e) {}
    if (!match) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '❓ No matching position. See /positions.', ...base }); return new Response('ok'); }
    const pp = await fetchPrice(match.sym); const cur = pp ? pp.price : match.entry;
    const c = posCalc(match, cur);
    try { await env.STATS.delete(matchKey); } catch (e) {}
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: (c.pnl >= 0 ? '✅' : '❌') + ' <b>Closed ' + match.side.toUpperCase() + ' ' + match.sym + '</b>\n' + DIV + '\nEntry $' + tgfmt(match.entry) + ' → Exit $' + tgfmt(cur) + '\nPnL  <b>' + (c.pnl >= 0 ? '+' : '') + '$' + tgfmt(c.pnl) + '</b> (' + (c.roe >= 0 ? '+' : '') + c.roe.toFixed(0) + '% ROE)\n\n📈 Open another: <code>/open BTC 100 x300</code>', ...base });
    return new Response('ok');
  }
  if (cmd === '/whoami' || cmd === '/chatid') {
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: 'Your chat id: <code>' + msg.chat.id + '</code>', ...base });
    return new Response('ok');
  }
  if (cmd === '/announce') { // owner-only: post an announcement to the MarginPad channel
    const adminChat = String(env.TG_ADMIN_CHAT || '');
    if (!adminChat) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '⚙️ Announcements aren\'t wired yet. To enable, set the <code>TG_ADMIN_CHAT</code> secret to <code>' + msg.chat.id + '</code> (this chat).', ...base }); return new Response('ok'); }
    if (String(msg.chat.id) !== adminChat) return new Response('ok'); // silently ignore non-owners
    const channel = env.TG_CHANNEL || (env.STATS && await env.STATS.get('tg:channel'));
    const channelName = (env.STATS && await env.STATS.get('tg:channel_name')) || channel;
    if (!channel) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '⚙️ No channel detected yet. Add the bot as an admin of your channel and post one message there — I capture it automatically.', ...base }); return new Response('ok'); }
    const body = msg.text.replace(/^\/announce(@\S+)?\s*/i, '').trim();
    if (!body) { await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: '📢 Send: <code>/announce your message…</code> — it posts to ' + channelName + '. HTML is supported.', ...base }); return new Response('ok'); }
    let ok = false; try { const r = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: channel, text: body, parse_mode: 'HTML', disable_web_page_preview: true }) }); ok = (await r.json()).ok; } catch (e) {}
    await tgApi(token, 'sendMessage', { chat_id: msg.chat.id, text: ok ? '✅ Posted to ' + channelName + '.' : '❌ Couldn\'t post. Make sure the bot is an admin of ' + channelName + '.', ...base });
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

// ---------- reward faucet (Durable Object ledger + Turnstile + manual/batch payout) ----------
// The site only tracks off-chain credit + a withdrawal queue. Actual USDT is sent MANUALLY from the owner's
// wallet by reading /api/reward/admin — no private key ever touches the Worker. Amounts are integer USDT cents.
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;          // captcha OPTIONAL — enforced only once TURNSTILE_SECRET is set;
                                                   // until then the global $/day cap (REWARD_DAILY_CAP) is the budget guardrail
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token || '', remoteip: ip }),
    });
    const j = await r.json(); return !!(j && j.success);
  } catch (e) { return false; }
}
// Checks a BEP20 address is real (has on-chain history) so freshly-generated throwaway addresses are rejected.
// Result is edge-cached (existence is permanent). Fails OPEN if BSC RPC is unreachable — the $/day cap still guards budget.
async function addressExists(addr) {
  const a = String(addr || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) return false;
  const ck = new Request('https://marginpad.io/__addrok_' + a);
  try { const hit = await caches.default.match(ck); if (hit) return (await hit.text()) === '1'; } catch (e) {}
  let exists = true; // default-allow if no RPC answers
  for (const u of ['https://bsc-dataseed.binance.org', 'https://bsc-dataseed1.defibit.io', 'https://bsc-dataseed1.ninicoin.io']) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'eth_getTransactionCount', params: [a, 'latest'] }, { jsonrpc: '2.0', id: 2, method: 'eth_getBalance', params: [a, 'latest'] }]) });
      if (!r.ok) continue;
      const j = await r.json();
      const nonce = parseInt(((j.find(x => x.id === 1) || {}).result) || '0x0', 16);
      const bal = BigInt(((j.find(x => x.id === 2) || {}).result) || '0x0');
      exists = nonce > 0 || bal > 0n; // definitive on-chain answer (sent txns OR holds/held a balance)
      break;
    } catch (e) {}
  }
  try { await caches.default.put(ck, new Response(exists ? '1' : '0', { headers: { 'cache-control': 'public, max-age=' + (exists ? 2592000 : 180) } })); } catch (e) {}
  return exists;
}
// Effective faucet config = KV overrides (`rwd:cfg`, set live from the Settings tab) layered over env-var defaults.
async function rewardCfg(env) {
  const num = (v, d) => { const n = +v; return isFinite(n) ? n : d; };
  const base = { enabled: env.REWARD_ENABLED === '1', wdEnabled: env.REWARD_WD_ENABLED !== '0', requireOnchain: env.REWARD_REQUIRE_ONCHAIN !== '0', minClaimsToWd: num(env.REWARD_MIN_CLAIMS_WD, 0), pauseMsg: env.REWARD_PAUSE_MSG || '', amountUsd: num(env.REWARD_AMOUNT, 0.1), perDayUsd: num(env.REWARD_PER_DAY, 5), minWdUsd: num(env.REWARD_MIN_WD, 5), capUsd: num(env.REWARD_DAILY_CAP, 10), cooldownS: num(env.REWARD_COOLDOWN, 300), ipCap: num(env.REWARD_IP_CAP, 3), welcomeUsd: num(env.REWARD_WELCOME, 0.5), promoUsd: num(env.REWARD_PROMO_USD, 1), promoEnabled: env.REWARD_PROMO_ENABLED !== '0', prize1: num(env.REWARD_PRIZE1, 30), prize2: num(env.REWARD_PRIZE2, 20), prize3: num(env.REWARD_PRIZE3, 10) };
  let ov = {}; try { ov = JSON.parse(await env.STATS.get('rwd:cfg') || '{}'); } catch (e) {}
  const m = { ...base, ...ov }; const c = x => Math.round((+x) * 100);
  return { enabled: !!m.enabled, wdEnabled: m.wdEnabled !== false, requireOnchain: m.requireOnchain !== false, minClaimsToWd: num(m.minClaimsToWd, 0), pauseMsg: String(m.pauseMsg || ''), amountC: c(m.amountUsd), perDayC: c(m.perDayUsd), minWdC: c(m.minWdUsd), capC: c(m.capUsd), cooldown: num(m.cooldownS, 300) * 1000, ipCap: num(m.ipCap, 3), welcomeC: c(num(m.welcomeUsd, 0.5)), promoC: c(num(m.promoUsd, 1)), promoEnabled: m.promoEnabled !== false, prize1: num(m.prize1, 30), prize2: num(m.prize2, 20), prize3: num(m.prize3, 10), raw: m };
}
// Send a support reply email FROM support@marginpad.io via Resend (resend.com).
// Requires the RESEND_API_KEY secret + marginpad.io verified in Resend (SPF/DKIM DNS records).
async function sendSupportEmail(env, to, subject, message) {
  try {
    const html = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'MarginPad Support <support@marginpad.io>',
        to: [to],
        reply_to: 'support@marginpad.io',
        subject,
        text: message + '\n\n— MarginPad Support · marginpad.io',
        html: '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111">' + html + '<br><br>—<br><b>MarginPad Support</b> · <a href="https://marginpad.io">marginpad.io</a></div>',
      }),
    });
    if (r.ok) return { ok: true };
    const t = await r.text().catch(() => '');
    return { ok: false, detail: ('HTTP ' + r.status + ' ' + t).slice(0, 280) };
  } catch (e) { return { ok: false, detail: String(e).slice(0, 200) }; }
}
// ---------- optional accounts: passwordless email sign-in (6-digit code via Resend) ----------
function getCookie(request, name) { const h = request.headers.get('cookie') || ''; const m = h.match(new RegExp('(?:^|; )' + name + '=([^;]+)')); return m ? decodeURIComponent(m[1]) : ''; }
const SESS_COOKIE = 'mp_sess';
// Per-isolate session cache (30s TTL). Every authed request (AI, rewards) was a fetch to the SINGLE UserStore DO
// instance — a serialization bottleneck that grows with signed-in traffic. Worst case a revoked session lingers
// 30s in one isolate; ban/suspend still kill sessions at the DO so the next cache miss sees it.
const _sessCache = new Map(); // token → { user|null, exp }
async function sessionUser(env, tok) {
  if (!tok || !env.USERS) return null;
  const now = Date.now();
  const hit = _sessCache.get(tok);
  if (hit && hit.exp > now) return hit.user;
  let user = null;
  try { const sr = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/session?token=' + encodeURIComponent(tok))); const sd = await sr.json(); if (sd && sd.user && sd.user.id) user = sd.user; } catch (e) { return hit ? hit.user : null; } // DO hiccup → serve stale rather than logging everyone out
  _sessCache.set(tok, { user, exp: now + 30000 });
  if (_sessCache.size > 2000) _sessCache.clear();
  return user;
}
const SESS_MAXAGE = 2592000; // 30 days
async function sendAuthCode(env, to, code) {
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'MarginPad <login@marginpad.io>', to: [to], reply_to: 'support@marginpad.io',
        subject: code + ' is your MarginPad sign-in code',
        text: 'Your MarginPad sign-in code is ' + code + '\n\nIt expires in 10 minutes. If you did not request this, just ignore this email.\n\n— MarginPad · marginpad.io',
        html: '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:440px"><p style="margin:0 0 10px">Your MarginPad sign-in code:</p><p style="font-size:34px;font-weight:800;letter-spacing:7px;font-family:ui-monospace,Menlo,monospace;color:#0a0b0d;margin:6px 0 14px">' + code + '</p><p style="color:#555;margin:0 0 10px">It expires in 10 minutes. If you did not request this, just ignore this email.</p><p style="color:#999;font-size:13px;margin:0">&mdash; <a href="https://marginpad.io" style="color:#15a06a;text-decoration:none">MarginPad</a></p></div>'
      })
    });
    if (r.ok) return { ok: true };
    const t = await r.text().catch(() => ''); return { ok: false, detail: ('HTTP ' + r.status + ' ' + t).slice(0, 240) };
  } catch (e) { return { ok: false, detail: String(e).slice(0, 200) }; }
}
// ---- Web Push (RFC8291 aes128gcm payload + RFC8292 VAPID) ----
const VAPID_PUBLIC = 'BKdr8PcbZQWGE0c8QuauG1FHf0yEoHs4fm0ise_rm9kNftX_ABmg0oJyqK8GFw-rRW9MmGsQWjNOvVg9lEX9Bcg';
function _pcat(arrs) { let n = 0; for (const a of arrs) n += a.length; const o = new Uint8Array(n); let i = 0; for (const a of arrs) { o.set(a, i); i += a.length; } return o; }
function _b64u(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function _ub64u(str) { str = String(str || '').replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; const bin = atob(str); const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return u8; }
async function _vapidJwt(env, endpoint) {
  const jwk = JSON.parse(env.VAPID_JWK);
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const head = _b64u(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = _b64u(new TextEncoder().encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 43200, sub: 'mailto:cocchako@gmail.com' })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(head + '.' + body));
  return head + '.' + body + '.' + _b64u(new Uint8Array(sig));
}
async function sendWebPush(env, sub, payloadObj) {
  if (!env.VAPID_JWK) return { ok: false, status: 0 };
  const te = new TextEncoder();
  const uaPub = _ub64u(sub.p256dh), auth = _ub64u(sub.auth);
  const payload = te.encode(JSON.stringify(payloadObj));
  const asKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', asKeys.publicKey)); // 65
  const uaKey = await crypto.subtle.importKey('raw', uaPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asKeys.privateKey, 256));
  const ecdhKey = await crypto.subtle.importKey('raw', ecdh, 'HKDF', false, ['deriveBits']);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: auth, info: _pcat([te.encode('WebPush: info\0'), uaPub, asPub]) }, ecdhKey, 256));
  const ikmKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('Content-Encoding: aes128gcm\0') }, ikmKey, 128);
  const nonce = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('Content-Encoding: nonce\0') }, ikmKey, 96);
  const aesKey = await crypto.subtle.importKey('raw', new Uint8Array(cek), { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(nonce) }, aesKey, _pcat([payload, new Uint8Array([2])])));
  const body = _pcat([salt, new Uint8Array([0, 0, 0x10, 0]), new Uint8Array([asPub.length]), asPub, ct]); // salt | rs=4096 | idlen | as_public | ciphertext
  const jwt = await _vapidJwt(env, sub.endpoint);
  const res = await fetch(sub.endpoint, { method: 'POST', headers: { 'Authorization': 'vapid t=' + jwt + ', k=' + VAPID_PUBLIC, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', 'TTL': '86400' }, body });
  return { ok: res.ok, status: res.status };
}
// Price-alert email (account-based alerts). marginpad.io is verified in Resend so alerts@ works.
async function sendAlertEmail(env, to, sym, dir, target, cur, note) {
  if (!env.RESEND_API_KEY) return { ok: false };
  const arrow = dir === 'up' ? '≥' : '≤', noteH = note ? '<p style="color:#555;margin:0 0 12px">Your note: ' + String(note).replace(/[<>&]/g, '') + '</p>' : '';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'MarginPad Alerts <alerts@marginpad.io>', to: [to], reply_to: 'support@marginpad.io',
        subject: sym + ' hit $' + cur + ' (' + arrow + ' $' + target + ')',
        text: sym + ' is now $' + cur + ' (' + arrow + ' your $' + target + ' target).\n\nTrade it: https://marginpad.io/paper-trade?coin=' + sym + '\nManage alerts: https://marginpad.io/alerts/\n\n— MarginPad',
        html: '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:460px"><p style="font-size:20px;font-weight:800;margin:0 0 6px">' + sym + ' alert</p><p style="margin:0 0 12px"><b>' + sym + '</b> is now <b>$' + cur + '</b> — it crossed your ' + arrow + ' <b>$' + target + '</b> target.</p>' + noteH + '<p style="margin:0 0 16px"><a href="https://marginpad.io/paper-trade?coin=' + sym + '" style="display:inline-block;background:#c2f64a;color:#0a0b0d;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:10px">Trade ' + sym + ' &rarr;</a></p><p style="color:#999;font-size:13px;margin:0"><a href="https://marginpad.io/alerts/" style="color:#15a06a;text-decoration:none">Manage your alerts</a> &middot; MarginPad</p></div>'
      })
    });
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}
// Cron: evaluate account price-alerts (UserStore DO) and email the ones that trigger. Runs alongside the Telegram alert cron.
// Congratulate + notify a weekly leaderboard winner by email (Resend, from hello@marginpad.io).
async function sendLeaderboardEmail(env, to, info) {
  if (!env.RESEND_API_KEY || !to) return { ok: false };
  const medal = info.rank === 1 ? '\uD83E\uDD47' : info.rank === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49';
  const place = info.rank === 1 ? '1st' : info.rank === 2 ? '2nd' : '3rd';
  const prize = '$' + (Math.round(info.prizeUsd * 100) / 100).toFixed(2);
  const roe = (info.roe >= 0 ? '+' : '') + Math.round(info.roe).toLocaleString('en-US') + '%';
  const trade = (info.symbol ? String(info.symbol) : '') + (info.side ? ' ' + String(info.side) : '');
  const esc = x => String(x == null ? '' : x).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
  const hi = info.username ? ('@' + esc(info.username)) : 'trader';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'MarginPad <hello@marginpad.io>', to: [to], reply_to: 'support@marginpad.io',
        subject: medal + ' You finished ' + place + ' on the MarginPad leaderboard — ' + prize + ' is yours',
        text: 'Congrats ' + hi + '!\n\nYou finished ' + place + ' place in this week\'s Trade League with a best trade of ' + roe + (trade ? ' on ' + trade : '') + '.\n\n' + prize + ' USDT has been credited to your Rewards balance. Withdraw it at https://marginpad.io/rewards/\n\nThe board just reset \u2014 defend your spot: https://marginpad.io/paper-trade\n\n\u2014 MarginPad',
        html: '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:480px">'
          + '<p style="font-size:40px;margin:0 0 4px">' + medal + '</p>'
          + '<p style="font-size:22px;font-weight:800;margin:0 0 10px">You finished ' + place + ' place!</p>'
          + '<p style="margin:0 0 14px">Congrats ' + hi + ' \u2014 your best paper trade this week was <b>' + roe + '</b>' + (trade ? ' on <b>' + esc(trade) + '</b>' : '') + ', good enough for <b>' + place + '</b> on the weekly Trade League.</p>'
          + '<p style="margin:0 0 16px;background:#f2fbdf;border:1px solid #c2f64a;border-radius:12px;padding:14px 16px"><b style="font-size:18px">' + prize + ' USDT</b> has been credited to your Rewards balance.</p>'
          + '<p style="margin:0 0 18px"><a href="https://marginpad.io/rewards/" style="display:inline-block;background:#c2f64a;color:#0a0b0d;text-decoration:none;font-weight:800;padding:11px 20px;border-radius:10px">Withdraw your prize &rarr;</a></p>'
          + '<p style="margin:0 0 4px;color:#444">The board just reset for a new week.</p>'
          + '<p style="margin:0"><a href="https://marginpad.io/paper-trade" style="color:#15a06a;text-decoration:none;font-weight:700">Defend your spot &rarr;</a> &middot; <span style="color:#999">MarginPad \u2014 not financial advice</span></p></div>'
      })
    });
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}

// Auto-credit the weekly Trade League top 3 with their prizes (from LIVE rewardCfg — owner can change the
// budget from ops Settings and it applies at the next payout). Runs on the */10 cron. Idempotent: a KV flag
// per week + a (week,acct) PRIMARY KEY in the ledger. Never back-pays weeks that ended before the feature was
// armed (a `lbpay:since` anchor stamped on the first run), so enabling it won't retroactively pay old weeks.
async function payWeeklyPrizes(env) {
  if (!env.STATS || !env.REWARDS || !env.USERS) return;
  const WK = 604800000, MON = 4 * 86400000, now = Date.now();
  const thisWeekStart = Math.floor((now - MON) / WK) * WK + MON; // Monday 00:00 UTC anchor (same as /lb)
  let since = null; try { since = +(await env.STATS.get('lbpay:since')) || null; } catch (e) {}
  if (!since) { try { await env.STATS.put('lbpay:since', String(thisWeekStart)); } catch (e) {} return; } // first run: arm from this week; the current week pays out once it ends
  const cfg = await rewardCfg(env);
  const prizes = [cfg.prize1 || 0, cfg.prize2 || 0, cfg.prize3 || 0]; // USD, live from config/Settings
  for (let ws = since; ws < thisWeekStart; ws += WK) { // every ENDED week from the anchor up to (not incl.) this week
    const flag = 'lbpaid:' + ws;
    let done = false; try { done = !!(await env.STATS.get(flag)); } catch (e) {}
    if (done) continue;
    const we = ws + WK;
    let board = [];
    try { const ur = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/leaderboard?ws=' + ws + '&we=' + we + '&limit=10')); const ud = await ur.json(); board = (ud && ud.top) || []; } catch (e) {}
    const banned = {};
    try { const br = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/lbbans')); const bd = await br.json(); (bd.banned || []).forEach(a => { banned[a] = 1; }); } catch (e) {}
    const top3 = board.filter(x => x && x.uid && !banned[x.uid]).slice(0, 3);
    const payload = top3.map((x, i) => ({ acct: x.uid, cents: Math.round((prizes[i] || 0) * 100), rank: i + 1 })).filter(p => p.cents > 0);
    let paidOut = [];
    if (payload.length) {
      try { const pr = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/paywinners', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ week: ws, winners: payload }) })); const pj = await pr.json(); paidOut = (pj && pj.payouts) || []; } catch (e) {}
    }
    // email the winners who were JUST paid (idempotent — re-runs return no fresh payouts, so no duplicate emails)
    if (paidOut.length) {
      const prof = await resolveProfiles(env, paidOut.map(p => p.acct));
      const byAcct = {}; top3.forEach(x => { byAcct[x.uid] = x; });
      for (const p of paidOut) {
        const u = prof[String(p.acct).replace(/^u:/, '')]; const x = byAcct[p.acct] || {};
        if (u && u.email) { try { await sendLeaderboardEmail(env, u.email, { rank: p.rank, prizeUsd: (p.amount || 0) / 100, roe: +x.roe || 0, symbol: x.symbol || '', side: x.side || '', username: u.username || x.name || '' }); } catch (e) {} }
      }
    }
    try { await env.STATS.put(flag, JSON.stringify({ ts: now, n: payload.length })); } catch (e) {} // mark the week paid (even if 0 eligible winners) so we don't retry forever
  }
}

async function checkAccountAlerts(env) {
  if (!env || !env.USERS || (!env.RESEND_API_KEY && !env.TELEGRAM_TOKEN)) return;
  let alerts = [];
  try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/alerts/active')); const j = await r.json(); alerts = (j && j.alerts) || []; } catch (e) { return; }
  if (!alerts.length) return;
  const syms = {}; alerts.forEach(a => { syms[a.sym] = 1; });
  const prices = {};
  await Promise.all(Object.keys(syms).map(async s => { try { const p = await fetchPrice(s); if (p) prices[s] = p.price; } catch (e) {} }));
  const fired = [], pushTargets = [];
  for (const a of alerts) {
    const cur = prices[a.sym]; if (cur == null) continue;
    if ((a.dir === 'up' && cur >= a.target) || (a.dir === 'down' && cur <= a.target)) {
      if (a.uid) pushTargets.push({ uid: a.uid, sym: a.sym, dir: a.dir, target: a.target, cur });
      const ch = a.channel || 'email';
      if (ch === 'telegram' && a.tg_chat && env.TELEGRAM_TOKEN) {
        try { await tgApi(env.TELEGRAM_TOKEN, 'sendMessage', { chat_id: a.tg_chat, text: '<b>' + a.sym + ' alert</b>\n' + a.sym + ' is now <b>$' + tgfmt(cur) + '</b> (' + (a.dir === 'up' ? '≥' : '≤') + ' $' + tgfmt(a.target) + ')' + (a.note ? '\n<i>' + String(a.note).replace(/[<>&]/g, '') + '</i>' : '') + '\n\n<a href="https://marginpad.io/paper-trade?coin=' + a.sym + '">Trade ' + a.sym + ' on MarginPad</a>', parse_mode: 'HTML', disable_web_page_preview: true }); } catch (e) {}
      } else if (a.email && env.RESEND_API_KEY) {
        try { await sendAlertEmail(env, a.email, a.sym, a.dir, a.target, tgfmt(cur), a.note); } catch (e) {}
      }
      fired.push(a.id);
    }
  }
  if (fired.length) { try { await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/alerts/fire', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: fired }) })); } catch (e) {} }
  // additive: also push to every browser the user subscribed (in parallel with email/Telegram)
  if (pushTargets.length && env.VAPID_JWK) {
    const uids = [...new Set(pushTargets.map(t => t.uid))];
    let subs = [];
    try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/push/byuid', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uids }) })); const j = await r.json(); subs = (j && j.subs) || []; } catch (e) {}
    if (subs.length) {
      const byUid = {}; subs.forEach(s => { (byUid[s.uid] = byUid[s.uid] || []).push(s); });
      const dead = [];
      await Promise.all(pushTargets.map(async t => {
        const payload = { title: t.sym + ' price alert', body: t.sym + ' is now $' + tgfmt(t.cur) + ' (' + (t.dir === 'up' ? '≥' : '≤') + ' $' + tgfmt(t.target) + ')', url: 'https://marginpad.io/paper-trade?coin=' + t.sym };
        for (const s of (byUid[t.uid] || [])) { try { const res = await sendWebPush(env, s, payload); if (res.status === 404 || res.status === 410) dead.push(s.endpoint); } catch (e) {} }
      }));
      if (dead.length) { try { await Promise.all(dead.map(ep => env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/push/del', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: ep }) })))); } catch (e) {} }
    }
  }
}
// Web-push API (session-authenticated): /key (public VAPID key) · /subscribe · /unsubscribe · /status.
async function handlePush(url, env, request) {
  const jr = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  const sub = url.pathname.slice('/api/push'.length) || '/';
  if (sub === '/key') return jr({ key: VAPID_PUBLIC });
  if (!env.USERS) return jr({ error: 'unavailable' }, 503);
  const tok = getCookie(request, SESS_COOKIE);
  if (!tok) return jr({ error: 'not_signed_in' }, 401);
  const stub = env.USERS.get(env.USERS.idFromName('main'));
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
  if (sub === '/subscribe') { const r = await stub.fetch(new Request('https://do/push/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, sub: b.sub }) })); return jr(await r.json()); }
  if (sub === '/unsubscribe') { const r = await stub.fetch(new Request('https://do/push/del', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: b.endpoint }) })); return jr(await r.json()); }
  if (sub === '/status') { const r = await stub.fetch(new Request('https://do/push/has', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok }) })); return jr(await r.json()); }
  return jr({ error: 'bad' }, 404);
}
// Site-wide announcement banner: GET (public, edge-cached 20s) reads it; POST (admin key) sets it. KV `mp:announce`.
// Admin: read/set the AI usage limits. GET → {globalLimit}; GET ?uid= → {globalLimit,userLimit,usedToday}. POST {globalLimit} or {uid,userLimit} (userLimit null/'' clears the override).
async function handleAiAdmin(url, request, env) {
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (!isAdminKey(env, url.searchParams.get('key'))) return J({ error: 'forbidden' }, 403);
  const day = new Date().toISOString().slice(0, 10);
  let cfg = {}; try { cfg = JSON.parse(await env.STATS.get('ai:cfg') || '{}'); } catch (e) {}
  const globalLimit = (cfg && Number.isFinite(cfg.limit)) ? cfg.limit : 10;
  if (request.method === 'GET') {
    const uid = url.searchParams.get('uid') || '';
    if (uid) {
      let ul = null; try { const v = await env.STATS.get('ai:lim:' + uid); if (v != null && v !== '') { const n = parseInt(v, 10); if (!isNaN(n)) ul = n; } } catch (e) {}
      let used = 0; try { used = parseInt(await env.STATS.get('ai:u:' + uid + ':' + day) || '0', 10) || 0; } catch (e) {}
      return J({ globalLimit, userLimit: ul, usedToday: used });
    }
    return J({ globalLimit });
  }
  if (request.method !== 'POST') return J({ error: 'method' }, 405);
  let b = {}; try { b = await request.json(); } catch (e) {}
  if (b && b.globalLimit != null) {
    const n = Math.max(0, Math.min(1000, parseInt(b.globalLimit, 10) || 0));
    cfg.limit = n; try { await env.STATS.put('ai:cfg', JSON.stringify(cfg)); } catch (e) {}
    return J({ ok: true, globalLimit: n });
  }
  if (b && b.uid) {
    const uid = String(b.uid).slice(0, 64);
    if (b.userLimit === null || b.userLimit === '' || b.userLimit === undefined) { try { await env.STATS.delete('ai:lim:' + uid); } catch (e) {} return J({ ok: true, userLimit: null }); }
    const n = Math.max(0, Math.min(1000, parseInt(b.userLimit, 10) || 0));
    try { await env.STATS.put('ai:lim:' + uid, String(n)); } catch (e) {}
    return J({ ok: true, userLimit: n });
  }
  return J({ error: 'bad' }, 400);
}
// "Ask AI about this chart" — signed-in only, daily limit per user (admin-tunable). POST {context, question} → Claude (Haiku) → {answer,used,limit}. GET = status {signedIn,used,limit}.
async function handleAiChart(url, request, env) {
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (!env.USERS) return J({ error: 'unavailable' }, 503);
  const day = new Date().toISOString().slice(0, 10);
  const tok = getCookie(request, SESS_COOKIE);
  let uid = null;
  if (tok) { const su = await sessionUser(env, tok); if (su && su.id) uid = su.id; }
  // effective daily limit = per-user override (KV ai:lim:<uid>) ?? global default (KV ai:cfg.limit) ?? 10 — both set from the admin
  let LIMIT = 10; try { const c = JSON.parse(await env.STATS.get('ai:cfg') || '{}'); if (c && Number.isFinite(c.limit)) LIMIT = c.limit; } catch (e) {}
  if (uid) { try { const ov = await env.STATS.get('ai:lim:' + uid); if (ov != null && ov !== '') { const n = parseInt(ov, 10); if (!isNaN(n)) LIMIT = n; } } catch (e) {} }
  const rk = uid ? 'ai:u:' + uid + ':' + day : '';
  const usedNow = async () => { if (!rk) return 0; try { return parseInt(await env.STATS.get(rk) || '0', 10) || 0; } catch (e) { return 0; } };
  if (request.method === 'GET') { return J({ signedIn: !!uid, used: await usedNow(), limit: LIMIT, ai: !!env.ANTHROPIC_API_KEY }); }
  if (request.method !== 'POST') return J({ error: 'method' }, 405);
  if (!uid) return J({ error: 'login_required' }, 401);
  if (!env.ANTHROPIC_API_KEY) return J({ error: 'ai_unconfigured' }, 503);
  const gk = 'ai:g:' + day; let g = 0; try { g = parseInt(await env.STATS.get(gk) || '0', 10) || 0; } catch (e) {}
  if (g >= 6000) return J({ error: 'busy' }, 503); // global daily backstop (KV, approximate — the hard per-user gate is the DO below)
  // Atomically RESERVE a quota slot in the UserStore DO before calling Anthropic — the old KV read-then-write
  // let parallel requests all pass the check and over-spend the paid API. Refunded if the upstream call fails.
  const aiStub = env.USERS.get(env.USERS.idFromName('main'));
  const aiCall = (bodyObj) => aiStub.fetch(new Request('https://do/ailimit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(bodyObj) })).then(r => r.json()).catch(() => null);
  const resv = await aiCall({ uid, limit: LIMIT, day });
  if (!resv) return J({ error: 'unavailable' }, 503);
  if (!resv.ok) return J({ error: 'rate_limit', used: resv.used || 0, limit: LIMIT }, 429);
  const used = (resv.used || 1) - 1; // keep the "used before this call" semantics for the response fields below
  const refund = () => { try { return aiCall({ uid, day, refund: true }); } catch (e) {} };
  let body = {}; try { body = await request.json(); } catch (e) {}
  const ctx = (body && body.context && typeof body.context === 'object') ? body.context : {};
  const question = String((body && body.question) || '').slice(0, 280);
  const sys = "You are a friendly trading coach built into a chart. The person reading you may know NOTHING about trading — talk to them like a smart beginner. Each message includes a JSON BRIEF of the EXACT chart they are looking at: symbol, timeframe, price, recent move, swing high/low, moving averages, RSI, MACD, ATR volatility, Bollinger, a recentCloses path, and — ONLY if it is present — a position they have drawn on the chart. Talk ONLY about THIS chart and what its numbers show. Do NOT assume or ask whether they hold any position unless 'openPosition' appears in the brief.\n\nHOW TO WRITE (this matters most):\n- Plain English. Keep it SHORT — about 70-120 words. No walls of text, no long lists, no dumping every indicator.\n- If you use any trading term (RSI, support, EMA, etc.), explain it in 3-4 words right there in brackets.\n- Be direct and concrete. Name the timeframe and give a clear verdict: right now does this chart lean UP (better for a long), DOWN (better for a short), or SIDEWAYS / unclear (better to wait)? Give the ONE main reason in simple words. It is fine to commit to a direction and it is fine to be wrong — this is learning, not advice.\n- Teach ONE small useful idea so they leave a little smarter.\n- Use light markdown: a bold first line for the verdict, then 1-3 short bullets at most.\n\nReason from the ACTUAL numbers — never invent levels. Answer follow-ups about this same chart.\n\nEnd the written part with exactly this line: 'Not financial advice — learn and decide for yourself.'\n\nTHEN, only if the chart shows a reasonably clear setup, add a fenced block on a new line (and nothing after it):\n```plan\n{\"bias\":\"long\" or \"short\",\"reason\":\"one short sentence\",\"entry\":<number>,\"stop\":<number>,\"targets\":[<number>],\"levels\":[{\"price\":<number>,\"label\":\"<short>\"}]}\n```\nUse real prices from the brief (entry near current price, stop beyond the invalidation level, target toward the next swing). If there is no clear setup, omit the block entirely — never output the word plan in a fence without a real setup.";
  const um = 'CHART BRIEF (JSON): ' + JSON.stringify(ctx).slice(0, 3600) + '\n\nQUESTION: ' + (question || 'Read this chart for me in simple words — is it leaning long or short right now, and why?');
  // multi-turn: prior turns (text only) + the new user turn (which carries the live snapshot). Sanitize to strict user/assistant alternation starting with user.
  let msgs = [];
  const hist = Array.isArray(body && body.history) ? body.history.slice(-8) : [];
  hist.forEach(h => { if (!h || typeof h.text !== 'string' || !h.text) return; const role = h.role === 'assistant' ? 'assistant' : 'user'; if (msgs.length === 0 && role !== 'user') return; if (msgs.length && msgs[msgs.length - 1].role === role) return; msgs.push({ role, content: h.text.slice(0, 2000) }); });
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  msgs.push({ role: 'user', content: um });
  const wantStream = !!(body && body.stream);
  // reply in the user's language (UI language passed from the client; the model also matches the language they actually type in)
  const langCode = String((body && body.lang) || '').toLowerCase().replace(/[^a-z-]/g, '').slice(0, 8) || 'en';
  const langNames = { en: 'English', sr: 'Serbian written in the LATIN alphabet (latinica, e.g. "trend raste, momentum jača") — never Cyrillic', de: 'German', fr: 'French', es: 'Spanish', pt: 'Portuguese', ru: 'Russian', tr: 'Turkish', zh: 'Chinese', ja: 'Japanese', ko: 'Korean', ar: 'Arabic', id: 'Indonesian', nl: 'Dutch', sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', it: 'Italian', pl: 'Polish', uk: 'Ukrainian', ro: 'Romanian', hi: 'Hindi', vi: 'Vietnamese', th: 'Thai' };
  const langName = langNames[langCode] || langNames[langCode.split('-')[0]] || langCode;
  const sysFull = sys + "\n\nLANGUAGE: Write your ENTIRE reply (verdict, bullets, the disclaimer line, and any plan reason/label text) in " + langName + " — natural, fluent, native-sounding. If the user's latest message is clearly written in a different language, reply in THAT language instead. Keep the ```plan block's JSON keys and the \"bias\" value (exactly \"long\" or \"short\") in English; the \"reason\" and \"label\" values should be in the user's language.";
  const reqBody = JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, system: sysFull, messages: msgs, stream: wantStream });
  const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 30000);
  let ar;
  try { ar = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: reqBody }); }
  catch (e) { clearTimeout(to); await refund(); return J({ error: 'ai_error' }, 502); }
  if (!ar.ok) { clearTimeout(to); await refund(); return J({ error: 'ai_error', status: ar.status }, 502); }
  try { await env.STATS.put(rk, String(used + 1), { expirationTtl: 172800 }); } catch (e) {} // KV mirror only (admin panel reads it); the DO count is authoritative
  try { await env.STATS.put(gk, String(g + 1), { expirationTtl: 172800 }); } catch (e) {}
  if (wantStream) { clearTimeout(to); return new Response(ar.body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store', 'x-ai-used': String(used + 1), 'x-ai-limit': String(LIMIT), ...CORS } }); }
  clearTimeout(to);
  let answer = '';
  try { const d = await ar.json(); answer = (d && d.content && d.content[0] && d.content[0].text) || ''; } catch (e) {}
  if (!answer) return J({ error: 'ai_empty' }, 502);
  return J({ ok: true, answer, used: used + 1, limit: LIMIT });
}
// ---------- Bot trading API — free paper-trading endpoints so people can TEST THEIR TRADING BOT for free ----------
// Auth: X-API-Key header (create one signed-in via POST /api/bot/key). Simulator semantics: entry/exit at the live
// price, isolated margin, pnl clamped at -margin, liquidation swept lazily against the live price. Docs: /trading-api/.
async function handleBot(url, request, env, ctx) {
  const jb = (o, s = 200) => new Response(JSON.stringify(o, null, 1), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, 'access-control-allow-headers': 'Content-Type, X-API-Key', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: { ...CORS, 'access-control-allow-headers': 'Content-Type, X-API-Key', 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
  if (!env.USERS) return jb({ error: 'unavailable' }, 503);
  const path = url.pathname.slice('/api/bot'.length) || '/';
  const stub = env.USERS.get(env.USERS.idFromName('main'));
  const doCall = (p, body) => stub.fetch(new Request('https://do' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).then(r => r.json()).catch(() => null);
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }

  // --- key management (session-cookie auth, from the site) ---
  if (path === '/key') {
    const tok = getCookie(request, SESS_COOKIE);
    const su = await sessionUser(env, tok);
    let kuid = su && su.id;
    if (!kuid && isAdminKey(env, url.searchParams.get('key'))) kuid = 'owner-admin'; // owner can mint a key from the dashboard without a login session
    if (!kuid) return jb({ error: 'login_required', hint: 'Sign in on marginpad.io first, then generate your key on /trading-api/.' }, 401);
    const r = await doCall('/botkey', { uid: kuid, rotate: request.method === 'POST' && !!b.rotate });
    return jb(r || { error: 'unavailable' }, r && r.key ? 200 : 503);
  }

  // --- public: price (no key needed — lets people try instantly) ---
  if (path === '/v1/price') {
    const sym = (url.searchParams.get('symbol') || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    const pd = await fetchPrice(sym);
    if (!pd || !(+pd.price > 0)) return jb({ error: 'unknown_symbol', symbol: sym }, 404);
    return jb({ symbol: sym, price: +pd.price, change_24h_pct: (pd.chg != null ? +pd.chg : null), ts: Date.now() });
  }

  if (path === '/v1/klines') { // keyless, like /price — bots need candles before they have a key
    const ku = new URL(url.origin + '/api/klines');
    ku.searchParams.set('symbol', (url.searchParams.get('symbol') || 'BTC').toUpperCase().replace(/USDT$/, ''));
    ku.searchParams.set('interval', url.searchParams.get('interval') || '60');
    if (url.searchParams.get('end')) ku.searchParams.set('end', url.searchParams.get('end'));
    return handleKlines(ku);
  }
  // --- authenticated bot endpoints ---
  const key = request.headers.get('x-api-key') || url.searchParams.get('api_key') || '';
  if (!key) return jb({ error: 'missing_api_key', hint: 'Send your key in the X-API-Key header. Get one free at https://marginpad.io/trading-api/' }, 401);
  const auth = await doCall('/botauth', { key });
  if (!auth || auth.error === 'bad_key') return jb({ error: 'invalid_api_key' }, 401);
  if (auth.error === 'rate_limit') return jb({ error: 'rate_limit', limit: '120 requests / minute' }, 429);
  const uid = auth.uid;

  const priceMap = async (syms) => { const out = {}; await Promise.all(syms.slice(0, 12).map(sy => fetchPrice(sy).then(pd => { if (pd && +pd.price > 0) out[sy] = +pd.price; }).catch(() => {}))); return out; };
  const openSymsOf = async () => { const r = await doCall('/botpositions', { uid, prices: {} }); return r && r.positions ? Array.from(new Set(r.positions.filter(p => p.status === 'open').map(p => p.symbol))) : []; };

  if (path === '/v1/open' && request.method === 'POST') {
    const sym = String(b.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/USDT$/, '');
    const side = b.side === 'short' ? 'short' : 'long';
    const margin = +b.margin_usd || 0, lev = Math.min(1000, Math.max(1, +b.leverage || 1));
    if (!sym) return jb({ error: 'symbol_required' }, 400);
    if (!(margin >= 1)) return jb({ error: 'margin_usd_min_1' }, 400);
    if (margin > 100000) return jb({ error: 'margin_usd_max_100000' }, 400);
    const pd = await fetchPrice(sym);
    if (!pd || !(+pd.price > 0)) return jb({ error: 'unknown_symbol', symbol: sym }, 404);
    const entry = +pd.price, mmr = 0.005, long = side === 'long';
    const liq = long ? entry * (1 - (1 - mmr) / lev) : entry * (1 + (1 - mmr) / lev);
    const sl = (b.sl != null && isFinite(+b.sl)) ? +b.sl : null, tp = (b.tp != null && isFinite(+b.tp)) ? +b.tp : null;
    if (sl != null && (long ? sl >= entry : sl <= entry)) return jb({ error: 'sl_wrong_side', live: entry }, 400);
    if (tp != null && (long ? tp <= entry : tp >= entry)) return jb({ error: 'tp_wrong_side', live: entry }, 400);
    const pos = { id: 'bp' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), symbol: sym, side, entry_price: entry, margin_usd: margin, leverage: lev, qty: margin * lev / entry, liq_price: Math.round(liq * 1e6) / 1e6, sl, tp, status: 'open', opened_ts: Date.now() };
    const r = await doCall('/botopen', { uid, pos });
    if (r && r.error) return jb(r, 400);
    try { if (env.AE) env.AE.writeDataPoint({ indexes: ['botapi'], blobs: ['event', 'botapi', 'open ' + sym], doubles: [1] }); } catch (e) {}
    return jb({ ok: true, position: pos });
  }
  if (path === '/v1/close' && request.method === 'POST') {
    if (!b.id) return jb({ error: 'id_required' }, 400);
    const syms = await openSymsOf();
    const prices = await priceMap(syms);
    const r = await doCall('/botclose', { uid, id: String(b.id), pct: b.pct, prices });
    if (!r) return jb({ error: 'unavailable' }, 503);
    return jb(r, r.error ? 400 : 200);
  }
  if (path === '/v1/positions') {
    const syms = await openSymsOf();
    const prices = await priceMap(syms);
    const r = await doCall('/botpositions', { uid, prices });
    return jb(r || { error: 'unavailable' }, r ? 200 : 503);
  }
  if (path === '/v1/close_all' && request.method === 'POST') {
    const syms = await openSymsOf();
    const prices = await priceMap(syms);
    const r = await doCall('/botcloseall', { uid, prices });
    return jb(r || { error: 'unavailable' }, r ? 200 : 503);
  }
  if (path === '/v1/account') {
    const syms = await openSymsOf();
    const prices = await priceMap(syms);
    const r = await doCall('/botpositions', { uid, prices });
    if (!r || !r.positions) return jb({ error: 'unavailable' }, 503);
    let openN = 0, marginUse = 0, upnl = 0, realized = 0, wins = 0, losses = 0;
    r.positions.forEach(p => { if (p.status === 'open') { openN++; marginUse += p.margin_usd; upnl += (p.unrealized_pnl_usd || 0); } else { realized += (p.pnl_usd || 0); if ((p.pnl_usd || 0) >= 0) wins++; else losses++; } });
    return jb({ open_positions: openN, margin_in_use_usd: Math.round(marginUse * 100) / 100, unrealized_pnl_usd: Math.round(upnl * 100) / 100, realized_pnl_usd: Math.round(realized * 100) / 100, closed_trades: wins + losses, wins, losses, win_rate_pct: (wins + losses) ? Math.round(wins / (wins + losses) * 1000) / 10 : null });
  }
  return jb({ error: 'not_found', endpoints: ['GET /api/bot/v1/price?symbol=BTC', 'GET /api/bot/v1/klines?symbol=BTC&interval=60', 'POST /api/bot/v1/open', 'POST /api/bot/v1/close', 'POST /api/bot/v1/close_all', 'GET /api/bot/v1/positions', 'GET /api/bot/v1/account'] }, 404);
}
async function handleAnnounce(url, env, request) {
  const jr = (o, s = 200, cc = 'no-store') => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cc, ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (request.method === 'GET') {
    const ck = new Request('https://marginpad.io/__announce_v1');
    try { const hit = await caches.default.match(ck); if (hit) return new Response(await hit.text(), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', ...CORS } }); } catch (e) {}
    let a = {}; try { a = JSON.parse(await env.STATS.get('mp:announce') || '{}'); } catch (e) {}
    const body = JSON.stringify({ msg: a.msg || '', level: a.level || '', ts: a.ts || 0 });
    try { await caches.default.put(ck, new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20' } })); } catch (e) {}
    return new Response(body, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20', ...CORS } });
  }
  if (!isAdminKey(env, url.searchParams.get('key'))) return jr({ error: 'forbidden' }, 403);
  let b = {}; try { b = await request.json(); } catch (e) {}
  const level = ['severe', 'blocker', 'fix'].indexOf(b.level) >= 0 ? b.level : '';
  const rec = { msg: level ? String(b.msg || '').slice(0, 300) : '', level: level, ts: Date.now() };
  try { await env.STATS.put('mp:announce', JSON.stringify(rec)); } catch (e) {}
  try { await caches.default.delete(new Request('https://marginpad.io/__announce_v1')); } catch (e) {} // bust the edge cache so it goes live immediately
  return jr({ ok: true, ...rec });
}
// Account price-alert API (session-authenticated): GET list · POST create · POST /delete.
async function handleAlerts(url, env, request) {
  const jr = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (!env.USERS) return jr({ error: 'unavailable' }, 503);
  const tok = getCookie(request, SESS_COOKIE);
  if (!tok) return jr({ error: 'not_signed_in' }, 401);
  const stub = env.USERS.get(env.USERS.idFromName('main'));
  const sub = url.pathname.slice('/api/alerts'.length) || '/';
  if (sub === '/tglink') { // GET: a one-time Telegram connect link (t.me/MarginPadBot?start=<token>) so alerts can be delivered to their chat
    const ir = await stub.fetch(new Request('https://do/alerts/tginfo?token=' + encodeURIComponent(tok)));
    const info = await ir.json(); if (!info || !info.uid) return jr({ error: 'not_signed_in' }, 401);
    if (info.linked) return jr({ linked: true });
    const ltok = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(x => x.toString(16).padStart(2, '0')).join('');
    try { if (env.STATS) await env.STATS.put('tglink:' + ltok, info.uid, { expirationTtl: 900 }); } catch (e) {}
    return jr({ linked: false, url: 'https://t.me/MarginPadBot?start=' + ltok });
  }
  if (request.method === 'GET') { const r = await stub.fetch(new Request('https://do/alerts/list?token=' + encodeURIComponent(tok))); return jr(await r.json()); }
  let b = {}; try { b = await request.json(); } catch (e) {}
  if (sub === '/delete') { const r = await stub.fetch(new Request('https://do/alerts/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, id: b.id }) })); return jr(await r.json()); }
  if (sub === '/tgunlink') { const r = await stub.fetch(new Request('https://do/alerts/tgunlink', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok }) })); return jr(await r.json()); }
  const r = await stub.fetch(new Request('https://do/alerts/create', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, sym: b.sym, dir: b.dir, target: b.target, note: b.note, channel: b.channel }) }));
  const d = await r.json(); return jr(d, d.error ? (d.error === 'not_signed_in' ? 401 : 400) : 200);
}
// ---- weekly digest (re-engagement email) ----
async function digestContent(env) {
  let top = [];
  try { const r = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/lb')); const j = await r.json(); top = (j && j.top) || []; } catch (e) {}
  return { top: top.slice(0, 3) };
}
async function sendDigestEmail(env, to, uid, content) {
  if (!env.RESEND_API_KEY) return { ok: false };
  const unsub = 'https://marginpad.io/unsubscribe?u=' + encodeURIComponent(uid), medal = ['🥇', '🥈', '🥉'];
  const lb = (content.top || []).length
    ? '<p style="margin:0 0 8px;font-weight:700">Last week\'s top traders:</p>' + content.top.map((x, i) => '<div style="padding:4px 0;color:#333">' + medal[i] + ' <b>' + String(x.who || 'Trader').replace(/[<>&]/g, '') + '</b> &middot; ' + (x.roe >= 0 ? '+' : '') + Math.round(x.roe) + '% on ' + String(x.symbol || '').replace(/[^A-Z0-9]/g, '') + '</div>').join('') + '<p style="margin:10px 0 0;color:#555">A fresh week just started — your best single trade could be on top.</p>'
    : '<p style="margin:0;color:#333">A fresh Trade League week just started. Open a paper trade and your best winner of the week lands you on the board.</p>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'MarginPad <hello@marginpad.io>', to: [to], reply_to: 'support@marginpad.io',
        subject: 'Your weekly MarginPad recap 📈',
        text: 'A new Trade League week just started on MarginPad.\n\nTrade (free, no risk): https://marginpad.io/paper-trade\nSet price alerts: https://marginpad.io/alerts/\nClaim free USDT: https://marginpad.io/rewards/\n\nUnsubscribe: ' + unsub + '\n— MarginPad',
        html: '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:480px"><p style="font-size:20px;font-weight:800;margin:0 0 4px">Your weekly recap 📈</p><p style="color:#555;margin:0 0 16px">Here\'s what\'s happening on MarginPad this week.</p><div style="background:#f6f8f2;border:1px solid #e3ead0;border-radius:12px;padding:14px 16px;margin:0 0 16px">' + lb + '</div><p style="margin:0 0 8px"><a href="https://marginpad.io/paper-trade" style="display:inline-block;background:#0a0b0d;color:#c2f64a;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:10px">Open Paper Trade &rarr;</a></p><p style="margin:14px 0 0;color:#555">Don\'t miss a move &mdash; <a href="https://marginpad.io/alerts/" style="color:#15a06a">set a free price alert</a>, or <a href="https://marginpad.io/rewards/" style="color:#15a06a">claim free USDT</a>.</p><p style="color:#aaa;font-size:12px;margin:20px 0 0">You get this because you have a MarginPad account. <a href="' + unsub + '" style="color:#999">Unsubscribe</a> &middot; <a href="https://marginpad.io" style="color:#999">marginpad.io</a></p></div>'
      })
    });
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}
// Cron: once a week (Mon ≥09:00 UTC) email a recap to opted-in accounts. KV flag makes it idempotent across the 10-min cron.
async function checkDigest(env) {
  if (!env || !env.USERS || !env.RESEND_API_KEY || !env.STATS) return;
  const d = new Date();
  if (d.getUTCDay() !== 1 || d.getUTCHours() < 9) return;
  const WK = 604800000, MON = 4 * 86400000, weekStart = Math.floor((Date.now() - MON) / WK) * WK + MON, flag = 'digest:wk:' + weekStart;
  try { if (await env.STATS.get(flag)) return; } catch (e) { return; }
  try { await env.STATS.put(flag, '1', { expirationTtl: 1209600 }); } catch (e) {}
  let recips = [];
  try { const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/digest/recipients')); const j = await r.json(); recips = (j && j.users) || []; } catch (e) { return; }
  if (!recips.length) return;
  const content = await digestContent(env);
  let sent = 0;
  for (const u of recips) { if (!u.email) continue; try { await sendDigestEmail(env, u.email, u.id, content); sent++; } catch (e) {} if (sent >= 800) break; }
}
// One-click unsubscribe from the weekly digest (link in every email; uid is a random unguessable id).
async function handleUnsubscribe(url, env) {
  const uid = url.searchParams.get('u') || '';
  if (uid && env.USERS) { try { await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/digest/optout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid }) })); } catch (e) {} }
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed · MarginPad</title><body style="font-family:system-ui,sans-serif;background:#0a0b0d;color:#e9e7df;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0;text-align:center"><div style="max-width:360px;padding:24px"><div style="font-size:40px">✓</div><h1 style="font-size:22px;margin:8px 0">You\'re unsubscribed</h1><p style="color:#9aa3ad">You won\'t get the weekly recap anymore. Price alerts you set still arrive — manage them <a href="https://marginpad.io/alerts/" style="color:#c2f64a">here</a>.</p><a href="https://marginpad.io" style="color:#c2f64a">← Back to MarginPad</a></div></body>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
// Standalone admin profile page for ONE user (opened in a new tab from the Users list). Key-gated; renders client-side.
function handleUserPage(url, env) {
  if (!isAdminKey(env, url.searchParams.get('key'))) return new Response('Forbidden', { status: 403 });
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width,initial-scale=1"><title>User · MarginPad Admin</title><style>
*{box-sizing:border-box}html,body{margin:0}body{background:#0a0b0d;color:#e9e7df;font-family:system-ui,-apple-system,Segoe UI,sans-serif}
a{color:#c2f64a;text-decoration:none}
.app{display:flex;min-height:100vh}
.side{width:236px;flex:0 0 236px;background:#0c0f13;border-right:1px solid #1c2230;position:sticky;top:0;height:100vh;overflow:auto;padding:16px 12px 30px}
.side .back{font-size:12px;color:#9aa3ad;display:inline-block;margin-bottom:14px}.side .back:hover{color:#c2f64a}
.srch{display:flex;gap:6px;margin-bottom:16px}
.srch input{flex:1;min-width:0;background:#0a0c0f;border:1px solid #2f3742;border-radius:9px;padding:9px 11px;color:#e9e7df;font-size:13px}.srch input:focus{outline:none;border-color:#c2f64a}
.umini{display:flex;align-items:center;gap:10px;padding:12px 10px;background:#111419;border:1px solid #232932;border-radius:12px;margin-bottom:16px}
.umini .av{width:38px;height:38px;border-radius:10px;background:#1a2029;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;color:#c2f64a;flex:0 0 38px}
.umini .un{font-weight:800;font-size:14px;line-height:1.2;word-break:break-word}.umini .us{font-size:11px;color:#9aa3ad;margin-top:2px}
.navb{display:flex;flex-direction:column;gap:2px}
.navb button{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:#9aa3ad;font-size:13.5px;font-weight:600;padding:10px 12px;border-radius:9px;cursor:pointer;font-family:inherit}
.navb button:hover{background:rgba(255,255,255,.05);color:#e9e7df}
.navb button.on{background:rgba(194,246,74,.12);color:#c2f64a}
.navb button .nb-ic{width:17px;height:17px;flex:0 0 17px}
.navb button .nb-badge{margin-left:auto;font-family:monospace;font-size:11px;color:#5c656f}
main{flex:1;min-width:0;padding:22px clamp(16px,2.4vw,34px) 70px}
.topbar{border-bottom:1px solid #1c2230;padding-bottom:16px;margin-bottom:20px}
h1{font-size:24px;margin:0 0 3px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.email{color:#9aa3ad;font-size:12.5px;font-family:monospace;word-break:break-all}
.badge{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;border-radius:6px;padding:3px 9px}
.b-active{background:rgba(46,189,133,.16);color:#41e3a3}.b-suspended{background:rgba(255,179,71,.16);color:#ffb347}.b-banned{background:rgba(255,98,88,.16);color:#ff8a80}.b-muted{background:rgba(154,163,173,.16);color:#cdd3da}.b-vpn{background:rgba(120,160,255,.16);color:#9ab4ff}
.qstats{display:flex;flex-wrap:wrap;gap:18px;margin-top:14px}
.qstats .q{}.qstats .q .qv{font-size:18px;font-weight:800;font-family:monospace;line-height:1}.qstats .q .ql{font-size:10.5px;color:#9aa3ad;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
.view{display:none}.view.on{display:block;animation:fade .18s ease}@keyframes fade{from{opacity:0}to{opacity:1}}
h2{font-size:12px;color:#9aa3ad;margin:26px 0 11px;text-transform:uppercase;letter-spacing:.12em}h2:first-child{margin-top:0}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}@media(max-width:820px){.cards{grid-template-columns:repeat(2,1fr)}}
.card{background:#111419;border:1px solid #232932;border-radius:12px;padding:13px 14px}.card .v{font-size:20px;font-weight:800;color:#c2f64a;line-height:1;font-family:monospace}.card .l{color:#9aa3ad;font-size:10.5px;margin-top:6px;text-transform:uppercase;letter-spacing:.07em}
.panel{background:#111419;border:1px solid #232932;border-radius:14px;padding:14px 16px}
.ctrls{display:flex;flex-wrap:wrap;gap:8px}
.btn{background:#0c0f13;border:1px solid #2f3742;color:#cdd3da;border-radius:9px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}.btn:hover{border-color:#5c656f;color:#fff}
.btn.warn{color:#ffce8a;border-color:rgba(255,179,71,.4)}.btn.warn:hover{background:rgba(255,179,71,.12)}
.btn.danger{color:#ff8a80;border-color:rgba(255,98,88,.4)}.btn.danger:hover{background:rgba(255,98,88,.12)}
.btn.good{color:#41e3a3;border-color:rgba(46,189,133,.4)}.btn.good:hover{background:rgba(46,189,133,.12)}
.row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #232932;font-size:13px}.row:last-child{border-bottom:none}
.mono{font-family:monospace}.muted{color:#5c656f;font-size:11px;font-family:monospace}
.in{background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:9px 12px;color:#e9e7df;font-size:13px;font-family:inherit}.in:focus{outline:none;border-color:#c2f64a}
.chk{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:#cdd3da;cursor:pointer;background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:8px 12px}
.chk input{accent-color:#c2f64a;width:15px;height:15px}
.field{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
.msg{font-size:12.5px;color:#9aa3ad;min-height:16px;margin-top:8px}.msg.ok{color:#41e3a3}.msg.err{color:#ff8a80}
.empty{color:#5c656f;font-size:13px;padding:8px 0}
.heat{position:relative;width:100%;height:460px;background:linear-gradient(180deg,#0d1014,#0a0c0f);border:1px solid #232932;border-radius:12px;overflow:hidden;margin-top:10px}
.heat .dot{position:absolute;width:34px;height:34px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,90,77,.6),rgba(255,90,77,0) 70%);mix-blend-mode:screen;pointer-events:none}
.heat .gl{position:absolute;left:0;right:0;height:1px;background:#1a2029}
.sel{background:#0c0f13;border:1px solid #2f3742;border-radius:9px;padding:8px 11px;color:#e9e7df;font-size:13px}
.tl{max-height:460px;overflow:auto}
@media(max-width:800px){.app{flex-direction:column}.side{width:100%;height:auto;position:static;flex:none;border-right:none;border-bottom:1px solid #1c2230}.navb{flex-direction:row;flex-wrap:wrap}.navb button{width:auto}main{padding:16px}}
</style></head><body>
<div class="app">
<aside class="side">
<a class="back" href="javascript:history.length>1?history.back():window.close()">&larr; back to Users</a>
<div class="srch"><input id="uSearch" placeholder="Jump to username…" autocomplete="off"></div>
<div class="umini" id="umini"><div class="av" id="uav">·</div><div><div class="un" id="uun">Loading…</div><div class="us" id="uus"></div></div></div>
<nav class="navb" id="navb">
<button data-v="overview" class="on">Overview</button>
<button data-v="sessions">Sessions <span class="nb-badge" id="nbSess"></span></button>
<button data-v="trades">Trades <span class="nb-badge" id="nbTr"></span></button>
<button data-v="rewards">Rewards &amp; payouts <span class="nb-badge" id="nbWd"></span></button>
<button data-v="network">Network &amp; IPs <span class="nb-badge" id="nbIp"></span></button>
<button data-v="activity">Activity <span class="nb-badge" id="nbEv"></span></button>
<button data-v="controls">Controls</button>
</nav>
</aside>
<main>
<div class="topbar"><h1 id="title">Loading…</h1><div class="email" id="email"></div><div class="qstats" id="qstats"></div></div>

<section class="view on" data-view="overview">
<h2>Overview</h2><div class="cards" id="cards"></div>
<h2>Security &amp; network</h2><div class="panel" id="sec"></div>
</section>

<section class="view" data-view="sessions">
<h2>Sessions <span class="muted" id="sessCount"></span></h2><div class="panel"><div id="sessions"><div class="empty">loading…</div></div></div>
</section>

<section class="view" data-view="trades">
<h2>Open positions <span class="muted" id="opCount"></span></h2><div class="panel"><div id="openTrades"><div class="empty">loading…</div></div></div>
<h2>Trade history <span class="muted" id="trCount"></span></h2><div class="panel"><div id="trades"><div class="empty">loading…</div></div></div>
<h2>Time on page <span class="muted" id="dwTotal"></span></h2><div class="panel"><div id="dwell"><div class="empty">loading…</div></div></div>
</section>

<section class="view" data-view="rewards">
<h2>Reward balance</h2><div class="cards" id="rwdCards"><div class="empty">loading…</div></div>
<h2>Withdrawals <span class="muted" id="wdCount"></span></h2><div class="panel"><div id="withdrawals"><div class="empty">loading…</div></div></div>
</section>

<section class="view" data-view="network">
<h2>Network &amp; VPN</h2><div class="panel" id="netPanel"><div class="empty">loading…</div></div>
<h2>Accounts sharing this IP <span class="muted" id="sipCount"></span></h2><div class="panel"><div id="sharedIp"><div class="empty">loading…</div></div></div>
<h2>Session IP addresses</h2><div class="panel"><div id="sessIps"><div class="empty">loading…</div></div></div>
</section>

<section class="view" data-view="activity">
<h2>Activity <span class="muted" id="evCount"></span></h2><div class="panel"><div class="tl" id="activity"><div class="empty">loading…</div></div></div>
<h2>Click heatmap <span class="muted">(where they clicked · per page)</span></h2><div class="panel"><div class="field" style="margin-top:0"><span class="muted">Page:</span><select class="sel" id="heatPath"></select><span class="muted" id="heatCount"></span></div><div class="heat" id="heat"></div></div>
</section>

<section class="view" data-view="controls">
<div class="panel" id="ctrlPanel"><h2 style="margin-top:0">Controls</h2><div class="ctrls" id="statusCtrls"></div>
<div class="field"><label class="chk"><input type="checkbox" id="muteChk"> Muted (can't post in chat)</label></div>
<div class="field"><span class="muted">Restrictions:</span><label class="chk"><input type="checkbox" data-r="chat"> No chat</label><label class="chk"><input type="checkbox" data-r="rewards"> No rewards</label><label class="chk"><input type="checkbox" data-r="withdraw"> No withdraw</label><button class="btn" id="saveRestr">Save</button></div>
<div class="field"><input class="in" id="unameIn" placeholder="username" maxlength="20" style="width:180px"><button class="btn" id="saveUname">Set username</button></div>
<div class="field"><span class="muted">Ask AI / day:</span><input class="in" id="aiLimIn" type="number" min="0" placeholder="default" style="width:120px"><button class="btn" id="saveAiLim">Set AI limit</button><span class="muted" id="aiLimHint"></span></div>
<div class="field" style="align-items:flex-start"><textarea class="in" id="noteIn" rows="2" placeholder="Private admin note…" style="flex:1;min-width:220px;resize:vertical"></textarea><button class="btn" id="saveNote">Save note</button></div>
<div class="field"><button class="btn warn" id="logoutAll">Sign out everywhere</button><button class="btn danger" id="delUser">Delete account</button></div>
<div class="msg" id="cmsg"></div></div>
</section>
</main>
</div>
<script>(function(){
var qs=new URLSearchParams(location.search),key=qs.get('key')||'',email=qs.get('email')||'',id=qs.get('id')||'',uname0=qs.get('username')||'';
var DATA=null,CLICKS=null,PRICES={},RWD=null;
function esc(s){return String(s==null?'':s).replace(/[<>&]/g,function(m){return{'<':'&lt;','>':'&gt;','&':'&amp;'}[m];});}
function flag(c){return /^[A-Z]{2}$/.test(c)?String.fromCodePoint(127397+c.charCodeAt(0),127397+c.charCodeAt(1)):'';}
function ago(t){if(!t)return '—';var s=Math.round((Date.now()-t)/1000);return s<60?s+'s':s<3600?Math.floor(s/60)+'m':s<86400?Math.floor(s/3600)+'h':Math.floor(s/86400)+'d';}
function dt(t){if(!t)return '—';var d=new Date(t);return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function fmtDur(s){s=Math.round(s||0);if(s<60)return s+'s';var m=Math.floor(s/60);if(m<60)return m+'m '+(s%60)+'s';var h=Math.floor(m/60);return h+'h '+(m%60)+'m';}
function uDev(ua){return /Mobi|Android|iPhone|iPad|iPod/i.test(ua||'')?'Mobile':'Desktop';}
function verb(t){return t==='exchange'?'clicked an exchange':t==='paper'?'opened Paper Trade':t==='tool'?'opened a tool':t==='tab'?'used a calculator':t==='hotpair'?'traded a pair':t==='pageview'?'viewed':(t||'did');}
function uarg(){return key?('key='+encodeURIComponent(key)+(email?'&email='+encodeURIComponent(email):'')+(id?'&id='+encodeURIComponent(id):'')+(uname0?'&username='+encodeURIComponent(uname0):'')):'';}
// ---- sidebar nav ----
function showView(v){document.querySelectorAll('.view').forEach(function(s){s.classList.toggle('on',s.getAttribute('data-view')===v);});document.querySelectorAll('#navb button').forEach(function(b){b.classList.toggle('on',b.getAttribute('data-v')===v);});window.scrollTo(0,0);}
document.getElementById('navb').addEventListener('click',function(e){var b=e.target.closest('button[data-v]');if(b)showView(b.getAttribute('data-v'));});
(function(){var si=document.getElementById('uSearch');if(si)si.addEventListener('keydown',function(e){if(e.key==='Enter'){var v=si.value.trim();if(v)location.href='/api/admin/user?key='+encodeURIComponent(key)+'&username='+encodeURIComponent(v);}});})();
function aiWire(){if(!DATA||!DATA.user||!DATA.user.id)return;var uid=DATA.user.id,inp=document.getElementById('aiLimIn'),btn=document.getElementById('saveAiLim'),hint=document.getElementById('aiLimHint');if(!btn)return;fetch('/api/ai/admin?key='+encodeURIComponent(key)+'&uid='+encodeURIComponent(uid)).then(function(r){return r.json();}).then(function(d){if(inp&&d.userLimit!=null&&!inp.value)inp.value=d.userLimit;if(hint)hint.textContent='default '+(d.globalLimit!=null?d.globalLimit:10)+' / day · used '+(d.usedToday||0)+' today';}).catch(function(){});if(btn._w)return;btn._w=1;btn.addEventListener('click',function(){var v=String(inp.value).trim(),body={uid:uid,userLimit:(v===''?null:parseInt(v,10))},m=document.getElementById('cmsg');if(m){m.className='msg';m.textContent='Saving…';}fetch('/api/ai/admin?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(d){if(m){m.className='msg ok';m.textContent=(body.userLimit===null)?'AI limit reset to default':('AI limit set to '+d.userLimit+'/day');}aiWire();}).catch(function(){if(m){m.className='msg err';m.textContent='Error';}});});}
function load(){fetch('/api/auth/user?'+uarg()).then(function(r){return r.json();}).then(function(d){DATA=d;render();aiWire();loadReward();}).catch(function(){document.getElementById('title').textContent='Could not load user.';});
  fetch('/api/auth/clicks?'+uarg()).then(function(r){return r.json();}).then(function(d){CLICKS=d;renderHeat();}).catch(function(){});
  fetch('/api/prices').then(function(r){return r.json();}).then(function(d){if(d&&d.pairs)d.pairs.forEach(function(x){PRICES[String(x.symbol||'').replace('USDT','')]=+x.price;});if(DATA)renderOpen();}).catch(function(){});}
function loadReward(){if(!DATA||!DATA.user||!DATA.user.id)return;fetch('/api/reward/detail?key='+encodeURIComponent(key)+'&address=u:'+encodeURIComponent(DATA.user.id)).then(function(r){return r.json();}).then(function(d){RWD=d;renderReward();}).catch(function(){renderReward();});}
function renderReward(){
  var cardsEl=document.getElementById('rwdCards'),wdEl=document.getElementById('withdrawals'),sipEl=document.getElementById('sharedIp');
  function card(v,l){return '<div class="card"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>';}
  if(!RWD||RWD.exists===false){if(cardsEl)cardsEl.innerHTML='<div class="empty" style="grid-column:1/-1">no reward account (user never opened Rewards)</div>';if(wdEl)wdEl.innerHTML='<div class="empty">—</div>';if(sipEl)sipEl.innerHTML='<div class="empty">—</div>';return;}
  if(cardsEl)cardsEl.innerHTML=card('$'+(+RWD.balanceUsd||0).toFixed(2),'Balance')+card('$'+(+RWD.earnedUsd||0).toFixed(2),'Total earned')+card(RWD.claims||0,'Claims')+card((RWD.banned?'BANNED':RWD.locked?'device-locked':'ok'),'Faucet status')+card((RWD.payoutAddr?esc(RWD.payoutAddr.slice(0,6)+'…'+RWD.payoutAddr.slice(-4)):'—'),'Payout wallet')+card(ago(RWD.lastClaim),'Last claim')+card((RWD.fraud&&RWD.fraud.riskLevel?RWD.fraud.riskLevel.toUpperCase():'—'),'Risk')+card((RWD.fraud&&RWD.fraud.claimsPerHour!=null?(+RWD.fraud.claimsPerHour).toFixed(1):'—'),'Claims/hr');
  var wds=RWD.withdrawals||[];var wc=document.getElementById('wdCount');if(wc)wc.textContent=wds.length?('('+wds.length+')'):'';var nbw=document.getElementById('nbWd');if(nbw)nbw.textContent=wds.length||'';
  if(wdEl)wdEl.innerHTML=wds.length?wds.map(function(w){var st=w.status||'pending';var col=st==='paid'?'#41e3a3':st==='pending'?'#ffb347':'#9aa3ad';var tx=(w.txid||'').replace(/[^0-9a-fA-Fx]/g,'');return '<div class="row"><span class="mono" style="flex:1;min-width:0;word-break:break-all">'+esc(w.address||'')+'</span><span class="mono" style="width:80px;text-align:right">$'+(+w.amountUsd||+w.amount/100||0).toFixed(2)+'</span><span style="width:70px;text-align:right;color:'+col+';font-weight:700;font-size:12px">'+st+'</span><span class="muted" style="width:110px;text-align:right">'+(tx?'<a href="https://bscscan.com/tx/'+tx+'" target="_blank" rel="noopener">tx</a> · ':'')+dt(w.ts||w.paidTs||0)+'</span></div>';}).join(''):'<div class="empty">no withdrawals</div>';
  // network panel
  var f=RWD.fraud||{};var np=document.getElementById('netPanel');
  if(np&&DATA&&DATA.user){var u=DATA.user;np.innerHTML='<div class="row"><span style="flex:1">Country</span><span class="mono">'+flag(u.cc)+' '+esc(u.cc||'?')+'</span></div>'
    +'<div class="row"><span style="flex:1">Network (ASN org)</span><span class="mono" style="color:'+(u.vpn?"#9ab4ff":"#cdd3da")+'">'+esc(u.org||'unknown')+(u.asn?' · AS'+u.asn:'')+'</span></div>'
    +'<div class="row"><span style="flex:1">VPN / proxy / datacenter</span><span class="mono">'+(u.vpn?'<b style="color:#9ab4ff">Likely yes</b>':'No signal')+'</span></div>'
    +'<div class="row"><span style="flex:1">Last IP (auth)</span><span class="mono">'+esc(u.ip||'?')+'</span></div>'
    +'<div class="row"><span style="flex:1">Last IP (faucet)</span><span class="mono">'+esc(RWD.ip||'?')+'</span></div>'
    +'<div class="row"><span style="flex:1">Fraud risk</span><span class="mono" style="color:'+(f.riskLevel==='high'?'#ff8a80':f.riskLevel==='med'?'#ffb347':'#41e3a3')+'">'+esc((f.riskLevel||'low').toUpperCase())+(f.flags&&f.flags.length?' · '+f.flags.join(', '):'')+'</span></div>';}
  var ipw=f.ipWallets||[];var sc=document.getElementById('sipCount');if(sc)sc.textContent=ipw.length?('('+ipw.length+' on '+(RWD.ip||'this IP')+')'):'';var nbi=document.getElementById('nbIp');if(nbi)nbi.textContent=(f.sameIp||ipw.length)||'';
  if(sipEl)sipEl.innerHTML=ipw.length?ipw.map(function(w){var a=typeof w==='string'?w:(w.address||w.acct||'');var bn=(w&&w.banned);return '<div class="row"><span class="mono" style="flex:1;word-break:break-all">'+esc(String(a).replace(/^u:/,''))+'</span>'+(bn?'<span class="badge b-banned">banned</span>':'')+'</div>';}).join(''):'<div class="empty">no other accounts on this IP</div>';
  // session IPs
  var sess=(DATA&&DATA.sessions)||[];var siEl=document.getElementById('sessIps');
  if(siEl)siEl.innerHTML=sess.length?sess.map(function(s){return '<div class="row"><span>'+(flag(s.cc)||'·')+'</span><span class="mono" style="flex:1;word-break:break-all">'+esc(s.ip||'?')+'</span><span class="muted" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc((s.org||'').slice(0,36))+(s.vpn?' · VPN?':'')+'</span><span class="muted" style="width:90px;text-align:right">'+dt(s.created)+'</span></div>';}).join(''):'<div class="empty">no session IPs</div>';
}
function renderOpen(){var el=document.getElementById('openTrades');if(!el)return;var trd=(DATA&&DATA.trades)||[];var op=trd.filter(function(t){return (t.status||'open')==='open';});
  var c=document.getElementById('opCount');if(c)c.textContent=op.length?('('+op.length+')'):'';
  if(!op.length){el.innerHTML='<div class="empty">no open positions right now</div>';return;}
  el.innerHTML='<div style="max-height:400px;overflow:auto">'+op.slice().reverse().map(function(t){
    var long=t.side!=='short',dir=long?1:-1,sc=long?'#2ebd85':'#ff6258';
    var live=PRICES[String(t.sym||'').toUpperCase()],hasLive=isFinite(live)&&live>0;
    var entry=+t.entry,margin=+t.margin||0,lev=(+t.lev>0)?+t.lev:1,qty=(t.qty!=null&&isFinite(+t.qty))?+t.qty:((margin&&entry)?margin*lev/entry:0);
    var pnl=hasLive?qty*(live-entry)*dir:null;if(pnl!=null&&margin>0&&pnl<-margin)pnl=-margin;
    var roe=(pnl!=null&&margin>0)?pnl/margin*100:null;
    var liq=+t.liq||(long?entry*(1-(1-(t.mmr||0.005))/lev):entry*(1+(1-(t.mmr||0.005))/lev));
    var liqDist=hasLive&&live>0?(live-liq)/live*100*dir:null;
    var pcol=pnl==null?'#9aa3ad':(pnl>=0?'#2ebd85':'#ff6258');
    return '<div class="row" style="flex-wrap:wrap;row-gap:5px">'
      +'<span style="width:54px;color:'+sc+';font-weight:700;font-size:12px">'+(long?'LONG':'SHORT')+'</span>'
      +'<span class="mono" style="flex:1;min-width:90px">'+esc(t.sym||'-')+' <span class="muted">'+lev+'x</span></span>'
      +'<span style="text-align:right;color:'+pcol+';font-family:monospace;font-weight:700">'+(pnl!=null?((pnl>=0?'+':'')+'$'+pnl.toFixed(2)):'—')+(roe!=null?' <span style="font-weight:400;font-size:11px;color:'+pcol+'">'+(roe>=0?'+':'')+roe.toFixed(0)+'%</span>':'')+'</span>'
      +'<div class="muted" style="width:100%;display:flex;flex-wrap:wrap;gap:4px 12px;font-family:monospace;font-size:11px">'
        +'<span>entry '+(isFinite(entry)?entry.toLocaleString():'?')+'</span>'
        +'<span>mark '+(hasLive?live.toLocaleString():'—')+'</span>'
        +'<span style="color:#ff8a80">liq '+(isFinite(liq)?liq.toLocaleString():'?')+(liqDist!=null?' ('+liqDist.toFixed(Math.abs(liqDist)<10?2:1)+'%)':'')+'</span>'
        +'<span>margin $'+margin.toFixed(2)+'</span>'
        +(t.tp!=null?'<span>TP '+(+t.tp).toLocaleString()+'</span>':'')+(t.stop!=null?'<span>SL '+(+t.stop).toLocaleString()+'</span>':'')
        +'<span style="margin-left:auto">'+ago(t.ts)+'</span>'
      +'</div>'
    +'</div>';
  }).join('')+'</div>';}
function cmsg(t,k){var m=document.getElementById('cmsg');m.textContent=t;m.className='msg '+(k||'');}
function ctrl(action,extra,done){var body=Object.assign({email:email,id:id,action:action},extra||{});cmsg('Working…','');fetch('/api/auth/control?key='+encodeURIComponent(key),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}).then(function(r){return r.json();}).then(function(d){if(d.ok){cmsg('Done.','ok');if(done)done();else load();}else{cmsg('Error: '+(d.error||'failed'),'err');}}).catch(function(){cmsg('Network error','err');});}
function badge(cls,txt){return '<span class="badge '+cls+'">'+txt+'</span>';}
function render(){if(!DATA||!DATA.exists){document.getElementById('title').textContent='No such user.';document.getElementById('uun').textContent='Not found';return;}var u=DATA.user;
  var st=u.status||'active';var name=u.username||u.email.split('@')[0];
  document.getElementById('title').innerHTML=esc(name)+' '+badge('b-'+st,st)+(u.muted?badge('b-muted','muted'):'')+(u.vpn?badge('b-vpn','VPN?'):'');
  document.getElementById('email').textContent=u.email+'  ·  id '+(u.id||'').slice(0,12)+'…';
  document.getElementById('uav').textContent=(name[0]||'·').toUpperCase();
  document.getElementById('uun').textContent=name;document.getElementById('uus').textContent=st+(u.cc?' · '+flag(u.cc)+' '+u.cc:'');
  // quick stats strip
  var q=function(v,l){return '<div class="q"><div class="qv">'+v+'</div><div class="ql">'+l+'</div></div>';};
  var tsum0=DATA.tradeSummary||{n:0,pnl:0};
  document.getElementById('qstats').innerHTML=q(u.logins||0,'Logins')+q(u.pv||0,'Page views')+q(DATA.activeSessions||0,'Active sessions')+q(tsum0.n||0,'Trades')+q((tsum0.pnl>=0?'+':'')+'$'+(+tsum0.pnl||0).toFixed(0),'Paper P&L')+q(ago(u.last_seen),'Last seen');
  // status controls
  var sc=document.getElementById('statusCtrls');var h='';
  if(st!=='banned')h+='<button class="btn danger" id="banBtn">Ban from site</button>';else h+='<button class="btn good" id="unbanBtn">Unban</button>';
  if(st==='active')h+='<button class="btn warn" id="suspBtn">Suspend…</button>';
  if(st==='suspended')h+='<button class="btn good" id="actBtn">Lift suspension</button>';
  h+='<button class="btn" id="muteBtn">'+(u.muted?'Unmute':'Mute')+'</button>';
  sc.innerHTML=h;
  var ban=document.getElementById('banBtn');if(ban)ban.onclick=function(){if(confirm('Ban '+u.email+' from the site? Kills their sessions and blocks re-login.'))ctrl('ban');};
  var unban=document.getElementById('unbanBtn');if(unban)unban.onclick=function(){ctrl('unban');};
  var susp=document.getElementById('suspBtn');if(susp)susp.onclick=function(){var d=prompt('Suspend for how many days? (0 = indefinite)','7');if(d===null)return;ctrl('suspend',{days:+d||0});};
  var act=document.getElementById('actBtn');if(act)act.onclick=function(){ctrl('activate');};
  var mb=document.getElementById('muteBtn');if(mb)mb.onclick=function(){ctrl(u.muted?'unmute':'mute');};
  document.getElementById('muteChk').checked=!!u.muted;document.getElementById('muteChk').onchange=function(){ctrl(this.checked?'mute':'unmute');};
  var rset=(u.restrictions||'').split(',');document.querySelectorAll('[data-r]').forEach(function(c){c.checked=rset.indexOf(c.getAttribute('data-r'))>=0;});
  document.getElementById('saveRestr').onclick=function(){var arr=[];document.querySelectorAll('[data-r]').forEach(function(c){if(c.checked)arr.push(c.getAttribute('data-r'));});ctrl('restrict',{restrictions:arr});};
  document.getElementById('unameIn').value=u.username||'';
  document.getElementById('saveUname').onclick=function(){ctrl('username',{username:document.getElementById('unameIn').value.trim()});};
  document.getElementById('noteIn').value=u.note||'';
  document.getElementById('saveNote').onclick=function(){ctrl('note',{note:document.getElementById('noteIn').value});};
  document.getElementById('logoutAll').onclick=function(){if(confirm('Sign this user out of all devices?'))ctrl('logout_all');};
  document.getElementById('delUser').onclick=function(){if(confirm('DELETE '+u.email+' and all their data? This cannot be undone.'))ctrl('delete',{},function(){document.body.innerHTML='<p style="padding:40px;color:#9aa3ad">Account deleted. <a href="javascript:window.close()">Close</a></p>';});};
  function card(v,l){return '<div class="card"><div class="v">'+v+'</div><div class="l">'+l+'</div></div>';}
  document.getElementById('cards').innerHTML=card(u.logins||0,'Logins')+card(u.pv||0,'Page views')+card(DATA.evTotal||0,'Events')+card(DATA.activeSessions||0,'Active sessions')+card(ago(u.created),'Joined ago')+card(ago(u.last_seen),'Last seen ago')+card((u.dev||'?'),'Device')+card((u.br||'?'),'Browser');
  function ccFull(c){try{return new Intl.DisplayNames(['en'],{type:'region'}).of(c)||c;}catch(e){return c;}}
  document.getElementById('sec').innerHTML='<div class="row"><span style="flex:1">Country</span><span class="mono">'+flag(u.cc)+' '+esc(u.cc?(ccFull(u.cc)+' ('+u.cc+')'):'?')+'</span></div>'
    +'<div class="row"><span style="flex:1">Network (ASN org)</span><span class="mono" style="color:'+(u.vpn?'#9ab4ff':'#cdd3da')+'">'+esc(u.org||'unknown')+(u.asn?' · AS'+u.asn:'')+'</span></div>'
    +'<div class="row"><span style="flex:1">VPN / proxy / datacenter</span><span class="mono">'+(u.vpn?'<b style="color:#9ab4ff">Likely yes</b>':'No signal')+'</span></div>'
    +'<div class="row"><span style="flex:1">Last IP</span><span class="mono">'+esc(u.ip||'?')+'</span></div>'
    +(u.status==='suspended'&&u.susp_until?'<div class="row"><span style="flex:1">Suspended until</span><span class="mono">'+dt(u.susp_until)+'</span></div>':'');
  var sess=DATA.sessions||[];document.getElementById('sessCount').textContent='('+sess.length+')';var nbs=document.getElementById('nbSess');if(nbs)nbs.textContent=sess.length||'';
  document.getElementById('sessions').innerHTML=sess.length?sess.map(function(s){return '<div class="row"><span>'+(flag(s.cc)||'·')+'</span><span style="flex:1">'+esc(uDev(s.ua))+(s.vpn?' '+badge('b-vpn','VPN?'):'')+(s.active?' <span style="color:#2ebd85">· active</span>':' <span class="muted">· expired</span>')+'<div class="muted">'+esc((s.ip||'')+' · '+(s.org||'').slice(0,40))+'</div></span><span class="muted">'+dt(s.created)+'</span><button class="btn" data-rev="'+s.created+'" style="padding:5px 10px;font-size:11px">revoke</button></div>';}).join(''):'<div class="empty">no sessions</div>';
  document.querySelectorAll('[data-rev]').forEach(function(btn){btn.onclick=function(){ctrl('revoke',{created:+btn.getAttribute('data-rev')});};});
  var ev=DATA.events||[];document.getElementById('evCount').textContent='('+(DATA.evTotal||0)+')';var nbe=document.getElementById('nbEv');if(nbe)nbe.textContent=DATA.evTotal||'';
  document.getElementById('activity').innerHTML=ev.length?ev.map(function(e){return '<div class="row"><span>'+(flag(e.cc)||'·')+'</span><span style="flex:1;min-width:0">'+esc(verb(e.type))+(e.label?' <b style="color:#c2f64a">'+esc(e.label)+'</b>':'')+(e.path?' <span class="muted">'+esc(e.path)+'</span>':'')+'</span><span class="muted">'+ago(e.ts)+'</span></div>';}).join(''):'<div class="empty">no activity yet (tracked while signed in)</div>';
  renderOpen();
  var tsum=DATA.tradeSummary||{n:0,wins:0,losses:0,opens:0,pnl:0};var trd=DATA.trades||[];
  document.getElementById('trCount').textContent='('+(tsum.n||0)+(tsum.n?' · '+(tsum.wins||0)+'W/'+(tsum.losses||0)+'L · '+(tsum.pnl>=0?'+':'')+'$'+(+tsum.pnl||0).toFixed(2)+' P&L':'')+')';var nbt=document.getElementById('nbTr');if(nbt)nbt.textContent=tsum.n||'';
  document.getElementById('trades').innerHTML=trd.length?('<div style="max-height:420px;overflow:auto">'+trd.slice().reverse().map(function(t){var st=t.status||'open';var col=st==='win'?'#2ebd85':st==='loss'?'#ff6258':'#9aa3ad';var pn=+t.pnl;var sd=(t.side==='short'?'SHORT':'LONG');var scc=t.side==='short'?'#ff6258':'#2ebd85';return '<div class="row"><span style="width:56px;color:'+scc+';font-weight:700;font-size:12px">'+sd+'</span><span style="flex:1" class="mono">'+esc(t.sym||'-')+' <span class="muted">'+(t.lev?t.lev+'x':'')+'</span></span><span class="mono muted" style="font-size:11px">@'+(t.entry!=null?(+t.entry).toLocaleString():'?')+(t.exit!=null?' &rarr; '+(+t.exit).toLocaleString():'')+'</span><span style="width:90px;text-align:right;color:'+col+';font-family:monospace">'+(isFinite(pn)&&st!=='open'?((pn>=0?'+':'')+'$'+pn.toFixed(2)):st)+'</span><span class="muted" style="width:44px;text-align:right">'+ago(t.ts)+'</span></div>';}).join('')+'</div>'):'<div class="empty">no trades synced yet (captured when the user paper-trades while signed in)</div>';
  var dw=DATA.dwell||[];var dwt=DATA.dwellTotal||0;
  document.getElementById('dwTotal').textContent=dwt?('· total '+fmtDur(dwt)):'';
  var maxS=dw.reduce(function(m,d){return Math.max(m,d.secs);},1);
  document.getElementById('dwell').innerHTML=dw.length?dw.map(function(d){var w=Math.round(d.secs/maxS*100);return '<div class="row"><span class="mono" style="flex:1;color:#cdd3da;min-width:0;overflow:hidden;text-overflow:ellipsis">'+esc(d.path||'/')+'</span><span style="width:120px"><span style="display:inline-block;height:7px;width:'+Math.max(3,w)+'%;background:#c2f64a;border-radius:5px;vertical-align:middle"></span></span><span class="mono" style="width:74px;text-align:right">'+fmtDur(d.secs)+'</span><span class="muted" style="width:42px;text-align:right">'+(d.hits||0)+'x</span></div>';}).join(''):'<div class="empty">no page-time recorded yet (tracked while signed in)</div>';
}
function renderHeat(){if(!CLICKS)return;var sel=document.getElementById('heatPath');var paths=CLICKS.paths||[];
  if(sel&&!sel._f){sel._f=1;sel.innerHTML=paths.length?paths.map(function(p){return '<option value="'+esc(p.path)+'">'+esc(p.path)+' ('+p.n+')</option>';}).join(''):'<option>no clicks</option>';sel.onchange=drawHeat;}
  drawHeat();}
function drawHeat(){var box=document.getElementById('heat');var sel=document.getElementById('heatPath');if(!box||!CLICKS)return;var pth=sel?sel.value:'';var pts=(CLICKS.points||[]).filter(function(c){return !pth||c.path===pth;});
  document.getElementById('heatCount').textContent=pts.length?(pts.length+' clicks'):'no clicks on this page';
  var gl='';for(var i=1;i<5;i++)gl+='<div class="gl" style="top:'+(i*20)+'%"></div>';
  box.innerHTML=gl+pts.map(function(c){return '<div class="dot" style="left:'+c.x+'%;top:'+c.y+'%"></div>';}).join('');}
load();
})();</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function handleAuth(url, request, env, ctx) {
  const jr = (o, s = 200, extra = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS, ...extra } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (!env.USERS) return jr({ error: 'unavailable' }, 503);
  const path = url.pathname.slice('/api/auth'.length) || '/';
  const ip = request.headers.get('cf-connecting-ip') || '';
  const cc = (request.cf && request.cf.country) || '';
  const ua = request.headers.get('user-agent') || '';
  const org = (request.cf && request.cf.asOrganization) || '';
  const asn = (request.cf && request.cf.asn) || 0;
  const stub = env.USERS.get(env.USERS.idFromName('main'));
  let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }
  const isAdmin = isAdminKey(env, url.searchParams.get('key'));

  if (path === '/start') {
    const email = String(b.email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return jr({ error: 'bad_email' }, 400);
    if (!env.RESEND_API_KEY) return jr({ error: 'email_not_configured' }, 503);
    const r = await stub.fetch(new Request('https://do/otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, ip, cc }) }));
    const d = await r.json();
    if (d.error) return jr(d, 429);
    const sent = await sendAuthCode(env, email, d.code);
    if (!sent.ok) return jr({ error: 'send_failed', detail: sent.detail }, 502);
    return jr({ ok: true });
  }
  if (path === '/verify') {
    const email = String(b.email || '').trim().toLowerCase();
    const code = String(b.code || '').replace(/\D/g, '').slice(0, 6);
    if (!email || code.length !== 6) return jr({ error: 'bad_input' }, 400);
    const r = await stub.fetch(new Request('https://do/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code, ip, cc, ua, org, asn, dev: deviceOf(ua), br: browserOf(ua) }) }));
    const d = await r.json();
    if (d.error) return jr(d, (d.error === 'expired' || d.error === 'no_code') ? 410 : (d.error === 'banned' || d.error === 'suspended') ? 403 : 400);
    const opts = '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + SESS_MAXAGE;
    const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS });
    h.append('set-cookie', SESS_COOKIE + '=' + d.token + opts);
    h.append('set-cookie', 'mp_uid=' + d.user.id + opts); // non-auth attribution id so /api/track can credit activity without a DO read
    h.append('set-cookie', 'mp_un=' + String(d.user.username || (d.user.email || '').split('@')[0] || '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24) + opts); // display name so the admin logs show the username instead of just a country
    return new Response(JSON.stringify({ ok: true, user: d.user, isNew: d.isNew }), { status: 200, headers: h });
  }
  if (path === '/me') {
    const tok = getCookie(request, SESS_COOKIE);
    if (!tok) return jr({ user: null });
    // The DO connection can be severed mid-flight (deploys, DO resets) → "Network connection lost" surfaced as a 500
    // on the hottest auth probe. Retry once, then FAIL SOFT with {user:null, transient:true} — the client re-checks
    // on its own and a momentary signed-out beat is far better than an error page.
    let d = null;
    for (let attempt = 0; attempt < 2 && !d; attempt++) {
      try { const r = await stub.fetch(new Request('https://do/session?token=' + encodeURIComponent(tok))); d = await r.json(); }
      catch (e) { if (attempt === 0) await new Promise(rs => setTimeout(rs, 150)); }
    }
    if (!d) return jr({ user: null, transient: true });
    const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS });
    if (d.user) h.append('set-cookie', 'mp_un=' + String(d.user.username || (d.user.email || '').split('@')[0] || '').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 24) + '; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=' + SESS_MAXAGE); // keep the admin-log display name fresh for existing sessions (and on username change)
    return new Response(JSON.stringify({ user: d.user || null, banned: !!d.banned }), { headers: h });
  }
  if (path === '/username') { // user changes their own username
    const tok = getCookie(request, SESS_COOKIE);
    if (!tok) return jr({ error: 'not_signed_in' }, 401);
    const r = await stub.fetch(new Request('https://do/username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok, username: String(b.username || '') }) }));
    const d = await r.json();
    return jr(d, d.error ? (d.error === 'taken' ? 409 : 400) : 200);
  }
  if (path === '/click') { // signed-in user click → per-user heatmap (best-effort, off the hot path)
    const uid = getCookie(request, 'mp_uid');
    if (uid && ctx) ctx.waitUntil(stub.fetch(new Request('https://do/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, x: +b.x || 0, y: +b.y || 0, path: String(b.path || '/') }) })).catch(() => {}));
    return jr({ ok: true });
  }
  if (path === '/trades') { // signed-in user's paper-trade journal sync (POST = push & merge; GET = pull for cross-device sync)
    const uid = getCookie(request, 'mp_uid');
    if (!uid) return jr(request.method === 'GET' ? { journal: [] } : { ok: false });
    if (request.method === 'GET') {
      const r = await stub.fetch(new Request('https://do/gettrades?uid=' + encodeURIComponent(uid)));
      return jr(await r.json());
    }
    const r = await stub.fetch(new Request('https://do/trades', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, journal: b.journal }) }));
    return jr(await r.json());
  }
  if (path === '/dwell') { // time-on-page beacon (sendBeacon → application/json)
    const uid = getCookie(request, 'mp_uid');
    if (uid && ctx) ctx.waitUntil(stub.fetch(new Request('https://do/dwell', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uid, path: String(b.path || '/'), secs: +b.secs || 0 }) })).catch(() => {}));
    return jr({ ok: true });
  }
  if (path === '/control') { // admin moderation actions
    if (!isAdmin) return jr({ error: 'forbidden' }, 403);
    const r = await stub.fetch(new Request('https://do/control', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }));
    return jr(await r.json());
  }
  if (path === '/clicks') { // admin: per-user click heatmap data
    if (!isAdmin) return jr({ error: 'forbidden' }, 403);
    const r = await stub.fetch(new Request('https://do/clicks' + url.search));
    return jr(await r.json());
  }
  if (path === '/logout') {
    const tok = getCookie(request, SESS_COOKIE);
    if (tok) await stub.fetch(new Request('https://do/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: tok }) }));
    const clear = '=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
    const h = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS });
    h.append('set-cookie', SESS_COOKIE + clear); h.append('set-cookie', 'mp_uid' + clear);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: h });
  }
  if (path === '/admin') { // dashboard Users tab: paginated/searchable signups + counts
    if (!isAdmin) return jr({ error: 'forbidden' }, 403);
    const r = await stub.fetch(new Request('https://do/admin' + url.search)); // forwards q / limit / offset
    return jr(await r.json());
  }
  if (path === '/user') { // dashboard: one user's record + activity + login history
    if (!isAdmin) return jr({ error: 'forbidden' }, 403);
    const r = await stub.fetch(new Request('https://do/user' + url.search));
    return jr(await r.json());
  }
  if (path === '/opentrades') { // dashboard Ops tab: all signed-in users' OPEN paper positions
    if (!isAdmin) return jr({ error: 'forbidden' }, 403);
    const r = await stub.fetch(new Request('https://do/opentrades'));
    return jr(await r.json());
  }
  return jr({ error: 'not_found' }, 404);
}
async function handleReward(url, request, env) {
  const jr = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  if (request.method === 'OPTIONS') return new Response('', { status: 204, headers: CORS });
  if (!env.REWARDS) return jr({ error: 'unavailable' }, 503);
  const path = url.pathname.slice('/api/reward'.length) || '/';            // /claim /account /withdraw /admin /admin/paid /accounts /config
  const ip = request.headers.get('cf-connecting-ip') || '';
  const ua = request.headers.get('user-agent') || '';
  const cc = (request.cf && request.cf.country) || '';
  const vid = await sha8(ip + '|' + ua); // per-device id (same hashing as stats) — used for the one-address-per-device lock
  const adminOk = isAdminKey(env, url.searchParams.get('key'));
  const raw = request.method === 'POST' ? await request.text() : '';
  let b = {}; try { b = JSON.parse(raw || '{}'); } catch (e) {}
  // public address-existence check (the page calls this on Save for instant feedback)
  if (path === '/check') return jr({ exists: await addressExists(b.address || url.searchParams.get('address')) });
  // The faucet is account-based: resolve the signed-in user from the session cookie → 'u:<uid>'. Only for the account paths (avoids an extra UserStore call on /lb, /check, admin, /config).
  let acct = null;
  if (path === '/claim' || path === '/account' || path === '/me' || path === '/withdraw' || path === '/wdhistory' || path === '/visit' || path === '/msgseen' || path === '/promo/submit' || path === '/promo/mine' || (path === '/lb' && request.method === 'POST')) {
    const tok = getCookie(request, SESS_COOKIE);
    if (tok && env.USERS) { const su = await sessionUser(env, tok); if (su && su.id) acct = 'u:' + su.id; }
  }
  const full = await rewardCfg(env);
  // admin: read/write the live config (Settings tab) — applies instantly, no deploy
  if (path === '/config') {
    if (!adminOk) return jr({ error: 'forbidden' }, 403);
    if (request.method === 'POST') {
      let cur = {}; try { cur = JSON.parse(await env.STATS.get('rwd:cfg') || '{}'); } catch (e) {}
      const next = { ...cur };
      for (const k of ['enabled', 'wdEnabled', 'requireOnchain', 'promoEnabled']) if (k in b) next[k] = !!b[k];
      for (const k of ['amountUsd', 'perDayUsd', 'minWdUsd', 'capUsd', 'cooldownS', 'ipCap', 'minClaimsToWd', 'welcomeUsd', 'promoUsd', 'prize1', 'prize2', 'prize3']) if (k in b) next[k] = +b[k];
      if ('pauseMsg' in b) next.pauseMsg = String(b.pauseMsg || '').slice(0, 300);
      await env.STATS.put('rwd:cfg', JSON.stringify(next));
      return jr({ ok: true, config: { ...full.raw, ...next } });
    }
    return jr({ config: full.raw });
  }
  // admin: support inbox (+ reply history) with an email-config flag injected at the Worker (DO can't see secrets)
  if (path === '/support' && request.method === 'GET') {
    if (!adminOk) return jr({ error: 'forbidden' }, 403);
    const sst = env.REWARDS.get(env.REWARDS.idFromName('ledger'));
    const rr = await sst.fetch(new Request('https://do/support'));
    let sj = {}; try { sj = await rr.json(); } catch (e) {}
    sj.emailReady = !!env.RESEND_API_KEY;
    return jr(sj);
  }
  // admin: reply to a support message by email — sent FROM support@marginpad.io via Resend
  if (path === '/reply') {
    if (!adminOk) return jr({ error: 'forbidden' }, 403);
    const to = String(b.to || '').trim();
    const subject = (String(b.subject || '').trim() || 'Re: your message to MarginPad').slice(0, 160);
    const message = String(b.message || '').slice(0, 4000);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return jr({ error: 'bad_email' }, 400);
    if (!message.trim()) return jr({ error: 'empty' }, 400);
    if (!env.RESEND_API_KEY) return jr({ error: 'email_not_configured' }, 503);
    const sent = await sendSupportEmail(env, to, subject, message);
    if (!sent.ok) return jr({ error: 'send_failed', detail: sent.detail }, 502);
    try { const rst = env.REWARDS.get(env.REWARDS.idFromName('ledger')); await rst.fetch(new Request('https://do/reply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, subject, message }) })); } catch (e) {}
    return jr({ ok: true });
  }
  const cfg = { amountC: full.amountC, cooldown: full.cooldown, perDayC: full.perDayC, minWdC: full.minWdC, capC: full.capC, ipCap: full.ipCap, minClaimsToWd: full.minClaimsToWd, welcomeC: full.welcomeC, promoC: full.promoC, promoEnabled: full.promoEnabled, pauseMsg: full.pauseMsg, prize1: full.prize1, prize2: full.prize2, prize3: full.prize3 };
  if (path === '/claim' && !full.enabled) return jr({ error: 'paused', message: full.pauseMsg || '' }, 503);
  if (path === '/withdraw' && !full.wdEnabled) return jr({ error: 'wd_paused' }, 503);
  if ((path === '/claim' || path === '/withdraw') && !acct) return jr({ error: 'login_required' }, 401); // must be signed in (account-based faucet)
  if (path === '/claim') {
    if (!(await verifyTurnstile(env, b.token, ip))) return jr({ error: 'captcha' }, 403);
    // no on-chain wallet check at claim anymore — there is no wallet here; the BEP20 address is validated at /withdraw (full.requireOnchain still gates the payout address there if you wire it later)
  }
  if ((path === '/admin' || path === '/admin/paid' || path === '/accounts' || path === '/log' || path === '/unlock' || path === '/remove' || path === '/detail' || path === '/note' || path === '/ban' || path === '/unban' || path === '/adjust' || path === '/lbban' || path === '/lbtop' || path === '/lbhistory' || path === '/message' || path === '/support/close' || path === '/support/new' || path === '/promo/list' || path === '/promo/review' || (path === '/support' && request.method === 'GET')) && !adminOk) return jr({ error: 'forbidden' }, 403);
  // The leaderboard board (GET /lb) is polled by EVERY homepage visitor and only changes on a new submission — edge-cache it 20s so the flood collapses to ~one hit per colo per window. This is what was overloading the single `ledger` DO (all reward traffic shares it) and tripping the "storage operation exceeded timeout" reset.
  if (path === '/lb' && request.method === 'GET') {
    const lbCk = new Request('https://marginpad.io/__reward_lb_v2'); // v2 = authoritative board derived from synced journals (UserStore), not the old client-submitted lb table
    let bodyText = null;
    try { const hit = await caches.default.match(lbCk); if (hit) bodyText = await hit.text(); } catch (e) {}
    if (bodyText == null) {
      const WK = 604800000, MON = 4 * 86400000, nowMs = Date.now();
      const weekStart = Math.floor((nowMs - MON) / WK) * WK + MON, weekEnd = weekStart + WK, week = weekStart; // Monday 00:00 UTC anchor
      try {
        let board = [];
        if (env.USERS) {
          const ur = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/leaderboard?ws=' + weekStart + '&we=' + weekEnd + '&limit=40'));
          const ud = await ur.json(); board = (ud && ud.top) || [];
        }
        const banned = {};
        try { const br = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/lbbans')); const bd = await br.json(); (bd.banned || []).forEach(a => { banned[a] = 1; }); } catch (e) {}
        const mask = a => !a ? '' : (a.slice(0, 2) === 'u:' ? 'Trader' : a.slice(0, 6) + '…' + a.slice(-4));
        const top = board.filter(x => !banned[x.uid]).slice(0, 10).map((x, i) => ({ rank: i + 1, who: x.name || mask(x.uid), roe: x.roe, pnl: x.pnl, symbol: x.symbol, side: x.side }));
        bodyText = JSON.stringify({ week, weekStart, weekEnd, top });
        try { await caches.default.put(lbCk, new Response(bodyText, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=20' } })); } catch (e) {} // 20s edge cache → board computed at most once per colo per window
      } catch (e) { bodyText = '{"top":[],"week":' + week + ',"weekStart":' + weekStart + ',"weekEnd":' + weekEnd + ',"busy":true}'; } // fail soft, never a 500
    }
    let out = bodyText;
    try { const o = JSON.parse(bodyText); o.prizes = [cfg.prize1, cfg.prize2, cfg.prize3]; out = JSON.stringify(o); } catch (e) {} // prizes from live config (cfg already built above) — admin changes reflect immediately even though the board itself is edge-cached
    return new Response(out, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } }); // browser always re-requests but is served the ≤20s-cached board — DO stays protected, leaderboard stays fresh
  }
  if (path === '/lbtop') { // admin eject panel — same authoritative board as /lb (UserStore-derived) but with real account ids + ban state
    const WK = 604800000, MON = 4 * 86400000, nowMs = Date.now();
    const weekStart = Math.floor((nowMs - MON) / WK) * WK + MON, weekEnd = weekStart + WK, week = weekStart;
    let board = [];
    try { if (env.USERS) { const ur = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/leaderboard?ws=' + weekStart + '&we=' + weekEnd + '&limit=40')); const ud = await ur.json(); board = (ud && ud.top) || []; } } catch (e) {}
    const banned = {};
    try { const br = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/lbbans')); const bd = await br.json(); (bd.banned || []).forEach(a => { banned[a] = 1; }); } catch (e) {}
    const top = board.slice(0, 30).map((x, i) => ({ rank: i + 1, address: x.uid, name: x.name || '', roe: x.roe, pnl: x.pnl, symbol: x.symbol, side: x.side, banned: !!banned[x.uid] }));
    return jr({ week, top });
  }
  if (path === '/lbhistory') { // admin: past weeks' winners — reconstructed from the synced journals (UserStore /lbhist), ban-filtered
    let weeks = [];
    try { if (env.USERS) { const ur = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/lbhist?weeks=8')); const ud = await ur.json(); weeks = (ud && ud.weeks) || []; } } catch (e) {}
    const banned = {};
    try { const br = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/lbbans')); const bd = await br.json(); (bd.banned || []).forEach(a => { banned[a] = 1; }); } catch (e) {}
    const mask = a => !a ? '' : (a.slice(0, 2) === 'u:' ? 'Trader' : a.slice(0, 6) + '…' + a.slice(-4));
    const out = weeks.map(w => { const live = (w.top || []).filter(x => !banned[x.uid]); return { weekStart: w.weekStart, weekEnd: w.weekEnd, current: !!w.current, entries: live.length, top: live.slice(0, 10).map((x, i) => ({ rank: i + 1, who: x.name || mask(x.uid), roe: x.roe, pnl: x.pnl, symbol: x.symbol, side: x.side })) }; });
    return jr({ weeks: out });
  }
  // GET /admin (dashboard) is polled every 6s (Rewards tab) + 30s (badges) and runs heavy aggregations on the single
  // ledger DO → that flood was overloading it (timeout → reset → "internal error"). Edge-cache it 5s so the polls
  // collapse to ~one DO hit per colo per window, and fail soft so a transient never breaks the dashboard.
  if (path === '/admin' && request.method === 'GET') {
    const ck = new Request('https://marginpad.io/__reward_admin_v1');
    let txt = null;
    try { const hit = await caches.default.match(ck); if (hit) txt = await hit.text(); } catch (e) {}
    if (txt == null) {
      try {
        const rr = await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/admin', { headers: { 'x-cfg': JSON.stringify(cfg) } }));
        txt = await rr.text();
        if (rr.status === 200) try { await caches.default.put(ck, new Response(txt, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=5' } })); } catch (e) {}
      } catch (e) { txt = JSON.stringify({ pending: [], paidHistory: [], accounts: 0, busy: true }); }
    }
    return new Response(txt, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
  }
  const stub = env.REWARDS.get(env.REWARDS.idFromName('ledger'));
  const fwd = new Request('https://do' + path + (request.method === 'GET' ? url.search : ''), {
    method: request.method, headers: { 'content-type': 'application/json', 'x-cfg': JSON.stringify(cfg), 'x-ip': ip, 'x-cc': cc, 'x-dev': deviceOf(ua), 'x-vid': vid, 'x-did': (getCookie(request, 'mp_did') || '').slice(0, 40), 'x-acct': acct || '' },
    body: request.method === 'POST' ? raw : undefined,
  });
  let r, txt;
  try { r = await stub.fetch(fwd); txt = await r.text(); }
  catch (e) { return jr({ error: 'busy' }, 503); } // transient DO overload/reset — fail soft instead of a hard 500
  // Admin views: faucet accounts are keyed by 'u:<uid>'. Resolve those to the real username/email from UserStore so the dashboard shows who claimed.
  if (r.status === 200 && (path === '/log' || path === '/accounts' || path === '/detail' || path === '/promo/list')) {
    try {
      const data = JSON.parse(txt);
      const arr = path === '/log' ? data.log : path === '/accounts' ? data.accounts : path === '/promo/list' ? [...(data.pending || []), ...(data.decided || [])] : (data.address ? [data] : []);
      if (Array.isArray(arr) && arr.length) {
        const prof = await resolveProfiles(env, arr.map(e => e.address));
        arr.forEach(e => { const p = prof[String(e.address || '').replace(/^u:/, '')]; if (p) { e.username = p.username || ''; e.email = p.email || ''; e.tgLinked = !!p.tg; } });
        txt = JSON.stringify(data);
      }
    } catch (e) {}
  }
  return new Response(txt, { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...CORS } });
}
// account id ('u:<uid>') → {username,email} via UserStore, batched
async function resolveProfiles(env, acctKeys) {
  const ids = [...new Set((acctKeys || []).map(a => String(a || '')).filter(a => a.startsWith('u:')).map(a => a.slice(2)))];
  if (!ids.length || !env.USERS) return {};
  try {
    const r = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/profiles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }));
    const j = await r.json();
    return (j && j.profiles) || {};
  } catch (e) { return {}; }
}

export default {
  async fetch(request, env, ctx) {
   try {
    return await (async () => {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/api/prices') return handlePrices();
    if (url.pathname === '/api/screener') return handleScreener(env);
    if (url.pathname === '/api/symbols') return handleSymbols();
    if (url.pathname === '/api/gecko/markets') return handleGeckoMarkets(url, env);
    if (url.pathname === '/api/gecko/global') return handleGeckoGlobal(env);
    if (url.pathname === '/api/gecko/trending') return handleGeckoTrending(env);
    if (url.pathname === '/api/gecko/coin') return handleGeckoCoin(url, env);
    if (url.pathname === '/api/defi/overview') return handleDefiOverview(env);
    if (url.pathname === '/api/cg/coin') return handleCgCoin(url, env);
    if (url.pathname === '/api/news') return handleNews(env);
    if (url.pathname === '/api/fng') return handleFng(env);
    if (url.pathname === '/api/cg/pulse') return handleCgPulse(url, env);
    if (url.pathname === '/api/cg/board') return handleCgBoard(url, env);
    if (url.pathname === '/api/cg/liquidations') return handleCgLiquidations(url, env);
    if (url.pathname === '/api/cg/funding') return handleCgFunding(url, env);
    if (url.pathname === '/api/cg/longshort') return handleCgLongShort(url, env);
    if (url.pathname === '/api/cg/openinterest') return handleCgOpenInterest(url, env);
    if (url.pathname === '/api/price') {
      const sym = String(url.searchParams.get('symbol') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const ck = new Request('https://marginpad.io/__price_' + sym);
      try { const hit = await caches.default.match(ck); if (hit) return hit; } catch (e) {}
      const p = await fetchPrice(sym);
      const resp = new Response(JSON.stringify(p || { error: 'not found' }), { status: p ? 200 : 404, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': p ? 'public, max-age=5' : 'no-store', ...CORS } });
      if (p) try { await caches.default.put(ck, resp.clone()); } catch (e) {} // 5s edge cache: repeated polls share one upstream fetch (WS feed is the real-time path)
      return resp;
    }
    if (url.pathname === '/api/klines') return handleKlines(url);
    if (url.pathname.startsWith('/api/v1/')) return handleCollectorProxy(url, request, env);
    if (url.pathname === '/api/track') return handleTrack(url, request, env, ctx);
    if (url.pathname === '/api/stats/reset' && isAdminKey(env, url.searchParams.get('key'))) return handleStatsReset(env);
    if (url.pathname === '/api/stats/login') return adminDoLogin(request, env, 'cfg:statspass', 'mp_sadm', '/api/stats', url.origin + '/api/stats?key=' + encodeURIComponent(adminKeyOf(env)));
    if (url.pathname === '/api/stats/logout') return adminLogout('mp_sadm', '/api/stats');
    if (url.pathname === '/api/stats') return handleStats(url, env, request);
    if (url.pathname === '/api/bug' || url.pathname.startsWith('/api/bug/')) return handleBug(url, request, env);
    if (url.pathname === '/api/comments') return handleComments(url, request, env);
    if (url.pathname.startsWith('/api/reward/')) return handleReward(url, request, env);
    if (url.pathname === '/api/admin/user') return handleUserPage(url, env);
    if (url.pathname.startsWith('/api/auth/')) return handleAuth(url, request, env, ctx);
    if (url.pathname === '/api/alerts' || url.pathname.startsWith('/api/alerts/')) return handleAlerts(url, env, request);
    if (url.pathname === '/api/push' || url.pathname.startsWith('/api/push/')) return handlePush(url, env, request);
    if (url.pathname === '/api/bot' || url.pathname.startsWith('/api/bot/')) return handleBot(url, request, env, ctx);
    if (url.pathname === '/api/announce') return handleAnnounce(url, env, request);
    if (url.pathname === '/api/ai/chart') return handleAiChart(url, request, env);
    if (url.pathname === '/api/ai/admin') return handleAiAdmin(url, request, env);
    if (url.pathname === '/unsubscribe') return handleUnsubscribe(url, env);
    if (url.pathname === '/api/tgclaim') { // import a position opened from Telegram into the site's My Trades
      const tok = (url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 48);
      const hdr = { 'content-type': 'application/json', 'cache-control': 'no-store' };
      if (!tok) return new Response(JSON.stringify({ error: 'bad_token' }), { status: 400, headers: hdr });
      let pos = null; try { pos = JSON.parse((env.STATS && await env.STATS.get('tgclaim:' + tok)) || 'null'); } catch (e) {}
      if (!pos) return new Response(JSON.stringify({ error: 'not_found' }), { status: 404, headers: hdr });
      return new Response(JSON.stringify({ ok: true, pos }), { headers: hdr });
    }
    if (url.pathname === '/api/admin/pingpos' && isAdminKey(env, url.searchParams.get('key'))) { // owner pings a trader: email with their LIVE ROE + a nudge to come manage the open position
      const jh = { 'content-type': 'application/json' };
      if (!env.RESEND_API_KEY) return new Response(JSON.stringify({ error: 'email_not_configured' }), { status: 503, headers: jh });
      let pb = {}; try { pb = await request.json(); } catch (e) {}
      const uid = String(pb.uid || '').replace(/[^0-9a-f]/gi, '').slice(0, 64);
      if (!uid || !env.USERS) return new Response(JSON.stringify({ error: 'bad_uid' }), { status: 400, headers: jh });
      const cdKey = 'pingpos:' + uid;
      const prev = await env.STATS.get(cdKey);
      if (prev) return new Response(JSON.stringify({ error: 'cooldown', hoursAgo: Math.round((Date.now() - (+prev || 0)) / 3600000) }), { status: 429, headers: jh });
      const ur = await env.USERS.get(env.USERS.idFromName('main')).fetch(new Request('https://do/opentrades'));
      const ud = await ur.json();
      const mine = ((ud && ud.positions) || []).filter(x => x.uid === uid);
      if (!mine.length) return new Response(JSON.stringify({ error: 'no_open_positions' }), { status: 404, headers: jh });
      const email = mine[0].email, uname = mine[0].username || (email || '').split('@')[0] || 'trader';
      if (!email) return new Response(JSON.stringify({ error: 'no_email' }), { status: 404, headers: jh });
      // live ROE per position
      const syms = Array.from(new Set(mine.map(x => String(x.sym || '').toUpperCase()))).slice(0, 8);
      const PR = {}; await Promise.all(syms.map(sy => fetchPrice(sy).then(pd => { if (pd && +pd.price > 0) PR[sy] = +pd.price; }).catch(() => {})));
      const rows = mine.slice(0, 6).map(t => {
        const live = PR[String(t.sym || '').toUpperCase()], long = t.side !== 'short', lev = (+t.lev > 0) ? +t.lev : 1;
        const margin = +t.margin || 0, qty = (t.qty != null && isFinite(+t.qty)) ? +t.qty : ((margin && t.entry) ? margin * lev / t.entry : 0);
        let pnl = (live > 0) ? qty * (live - t.entry) * (long ? 1 : -1) : null;
        if (pnl != null && margin > 0 && pnl < -margin) pnl = -margin;
        const roe = (pnl != null && margin > 0) ? (pnl / margin * 100) : null;
        return { sym: t.sym, side: long ? 'LONG' : 'SHORT', lev, roe, pnl };
      });
      const esc2 = (x) => String(x == null ? '' : x).replace(/[<>&]/g, m => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[m]));
      const best = rows.filter(r2 => r2.roe != null).sort((a2, b2) => Math.abs(b2.roe) - Math.abs(a2.roe))[0];
      const subj = best ? ('Your ' + best.sym + ' ' + best.side + ' is at ' + (best.roe >= 0 ? '+' : '') + best.roe.toFixed(1) + '% ROE right now') : 'You have an open paper position on MarginPad';
      const list = rows.map(r2 => '<div style="display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #eee"><span><b>' + esc2(r2.sym) + '</b> ' + r2.side + ' ' + r2.lev + '&times;</span><span style="font-weight:800;color:' + ((r2.roe || 0) >= 0 ? '#15a06a' : '#d64541') + '">' + (r2.roe != null ? ((r2.roe >= 0 ? '+' : '') + r2.roe.toFixed(1) + '% ROE' + (r2.pnl != null ? ' (' + (r2.pnl >= 0 ? '+' : '-') + '$' + Math.abs(r2.pnl).toFixed(2) + ')' : '')) : '&mdash;') + '</span></div>').join('');
      let sent = false, detail = '';
      try {
        const rr = await fetch('https://api.resend.com/emails', {
          method: 'POST', headers: { 'authorization': 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
          body: JSON.stringify({
            from: 'MarginPad <hello@marginpad.io>', to: [email], reply_to: 'support@marginpad.io',
            subject: subj,
            text: 'Hi ' + uname + ', a friendly reminder: you have ' + rows.length + ' open paper position(s) on MarginPad. Check them here: https://marginpad.io/paper-trade — MarginPad',
            html: '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:480px"><p style="font-size:19px;font-weight:800;margin:0 0 4px">Hey ' + esc2(uname) + ' — your position update 👀</p><p style="color:#555;margin:0 0 14px">A friendly reminder that you still have ' + (rows.length > 1 ? rows.length + ' open paper positions' : 'an open paper position') + '. Here is where ' + (rows.length > 1 ? 'they stand' : 'it stands') + ' right now:</p><div style="background:#f6f8f2;border:1px solid #e3ead0;border-radius:12px;padding:6px 16px;margin:0 0 16px">' + list + '</div><p style="margin:0 0 8px"><a href="https://marginpad.io/paper-trade" style="display:inline-block;background:#0a0b0d;color:#c2f64a;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Manage my positions &rarr;</a></p><p style="color:#aaa;font-size:12px;margin:18px 0 0">Paper trading &mdash; no real funds. You get this because you have a MarginPad account. <a href="https://marginpad.io" style="color:#999">marginpad.io</a></p></div>'
          })
        });
        sent = rr.ok; if (!rr.ok) detail = 'resend_' + rr.status;
      } catch (e) { detail = String(e).slice(0, 80); }
      if (!sent) return new Response(JSON.stringify({ error: 'send_failed', detail }), { status: 502, headers: jh });
      try { await env.STATS.put(cdKey, String(Date.now()), { expirationTtl: 72000 }); } catch (e) {} // 20h cooldown — no accidental spam
      return new Response(JSON.stringify({ ok: true, to: email, positions: rows.length }), { headers: jh });
    }
    if (url.pathname === '/api/admin/tgsetwebhook' && isAdminKey(env, url.searchParams.get('key'))) { // (re)register the Telegram webhook WITH the anti-forgery secret token (see handleTelegram)
      const jh = { 'content-type': 'application/json' };
      if (!env.TELEGRAM_TOKEN) return new Response(JSON.stringify({ error: 'no_bot' }), { status: 503, headers: jh });
      if (!env.TG_WEBHOOK_SECRET) return new Response(JSON.stringify({ error: 'no_secret', hint: 'wrangler secret put TG_WEBHOOK_SECRET first' }), { status: 400, headers: jh });
      let ok = false, desc = '';
      try {
        const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/setWebhook', { method: 'POST', headers: jh, body: JSON.stringify({ url: url.origin + '/telegram/webhook', secret_token: env.TG_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query', 'channel_post', 'my_chat_member', 'chat_member'] }) });
        const j = await r.json(); ok = !!j.ok; desc = j.description || '';
      } catch (e) { desc = String(e); }
      return new Response(JSON.stringify({ ok, note: desc }), { headers: jh });
    }
    if (url.pathname === '/api/admin/tgphoto' && isAdminKey(env, url.searchParams.get('key'))) { // set the channel avatar to the MarginPad logo
      const jh = { 'content-type': 'application/json' };
      if (!env.TELEGRAM_TOKEN) return new Response(JSON.stringify({ error: 'no_bot' }), { status: 503, headers: jh });
      const channel = env.TG_CHANNEL || (env.STATS && await env.STATS.get('tg:channel'));
      if (!channel) return new Response(JSON.stringify({ error: 'no_channel' }), { status: 400, headers: jh });
      const img = (url.searchParams.get('img') || '/assets/icon-512.png').replace(/[^a-zA-Z0-9._\/-]/g, '');
      let buf; try { const ir = await env.ASSETS.fetch(new Request(url.origin + img)); if (ir.ok) buf = await ir.arrayBuffer(); } catch (e) {}
      if (!buf) { try { const ir2 = await fetch(url.origin + img); if (ir2.ok) buf = await ir2.arrayBuffer(); } catch (e) {} }
      if (!buf || buf.byteLength < 100) return new Response(JSON.stringify({ error: 'no_image', bytes: buf ? buf.byteLength : 0 }), { status: 500, headers: jh });
      const fd = new FormData(); fd.append('chat_id', String(channel)); fd.append('photo', new Blob([buf], { type: 'image/png' }), 'marginpad.png');
      let ok = false, desc = ''; try { const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/setChatPhoto', { method: 'POST', body: fd }); const j = await r.json(); ok = !!j.ok; desc = j.description || ''; } catch (e) { desc = String(e); }
      return new Response(JSON.stringify({ ok, error: ok ? undefined : (desc || 'failed') }), { headers: jh });
    }
    if (url.pathname === '/api/admin/broadcast' && isAdminKey(env, url.searchParams.get('key'))) { // owner posts an announcement to the Telegram channel from the admin panel
      const jh = { 'content-type': 'application/json' };
      if (!env.TELEGRAM_TOKEN) return new Response(JSON.stringify({ error: 'no_bot' }), { status: 503, headers: jh });
      const channel = env.TG_CHANNEL || (env.STATS && await env.STATS.get('tg:channel')); // secret OR auto-captured id
      const channelName = (env.STATS && await env.STATS.get('tg:channel_name')) || channel;
      if (!channel) return new Response(JSON.stringify({ error: 'no_channel' }), { status: 400, headers: jh });
      let text = '', photo = ''; try { const b = await request.json(); text = String(b.text || '').trim(); photo = String(b.photo || '').trim(); } catch (e) {}
      if (photo && !/^https?:\/\//i.test(photo)) photo = ''; // only real URLs; Telegram fetches the image
      if (!text) return new Response(JSON.stringify({ error: 'empty' }), { status: 400, headers: jh });
      // with a photo → sendPhoto (small image above the text); caption max ~1024, our textarea caps at 1000 so it fits
      const method = photo ? 'sendPhoto' : 'sendMessage';
      const payload = photo ? { chat_id: channel, photo, caption: text, parse_mode: 'HTML' } : { chat_id: channel, text, parse_mode: 'HTML', disable_web_page_preview: true };
      let ok = false, desc = ''; try { const r = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/' + method, { method: 'POST', headers: jh, body: JSON.stringify(payload) }); const j = await r.json(); ok = !!j.ok; desc = j.description || ''; } catch (e) { desc = String(e); }
      // photo URL Telegram couldn't fetch → retry as text so the post still goes out
      if (!ok && photo) { try { const r2 = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_TOKEN + '/sendMessage', { method: 'POST', headers: jh, body: JSON.stringify({ chat_id: channel, text, parse_mode: 'HTML', disable_web_page_preview: true }) }); const j2 = await r2.json(); if (j2.ok) { ok = true; desc = 'sent without image (image URL was rejected)'; } } catch (e) {} }
      return new Response(JSON.stringify({ ok, channel: channelName, note: ok ? desc : undefined, error: ok ? undefined : (desc || 'send_failed') }), { headers: jh });
    }
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/') return handleApi(url);
    if (url.pathname === '/telegram/webhook') return handleTelegram(request, env);
    if (url.pathname === '/chat/reset' && isAdminKey(env, url.searchParams.get('key'))) {
      if (!env.CHAT) return new Response('na', { status: 503 });
      return env.CHAT.get(env.CHAT.idFromName('global')).fetch(new Request('https://do/reset'));
    }
    if (url.pathname.startsWith('/chat/admin/') && isAdminKey(env, url.searchParams.get('key'))) { // dashboard chat moderation: /history /post /delete
      if (!env.CHAT) return new Response('na', { status: 503 });
      const sub = url.pathname.slice('/chat/admin'.length); // -> /history /post /delete
      const body = request.method === 'POST' ? await request.text() : undefined;
      return env.CHAT.get(env.CHAT.idFromName('global')).fetch(new Request('https://do' + sub, { method: request.method, headers: { 'content-type': 'application/json' }, body }));
    }
    if (url.pathname === '/chat/ws') {
      if (!env.CHAT) return new Response('chat unavailable', { status: 503 });
      // Browsers always send Origin on WebSocket upgrades — reject cross-site embeds/scripts opening our chat.
      // (Non-browser clients can fake it; this blocks the drive-by case, the DO adds per-IP limits.)
      const org = request.headers.get('origin') || '';
      if (org && !/^https:\/\/(www\.)?marginpad\.io$|^http:\/\/localhost(:\d+)?$/.test(org)) return new Response('forbidden', { status: 403 });
      return env.CHAT.get(env.CHAT.idFromName('global')).fetch(request);
    }
    if (url.pathname === '/charts' || url.pathname === '/charts/' || url.pathname === '/paper-trade' || url.pathname === '/paper-trade/' || url.pathname === '/calculators' || url.pathname === '/calculators/' || url.pathname === '/screener' || url.pathname === '/screener/' || url.pathname === '/heatmap' || url.pathname === '/heatmap/' || url.pathname === '/swap' || url.pathname === '/swap/') { // dedicated full-screen workspaces (serve the homepage; its JS switches to the right single-tool mode)
      const r = await env.ASSETS.fetch(new Request(url.origin + '/app', request)); // fetch the APP SHELL (was '/'; the homepage `/` is now the demo-home router since go-live 2026-07-03) — this is the full paper-trade/charts/calc/screener single-file app the SPA JS switches on
      const base = new Response(r.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      // Per-route <title>/description/canonical so each dedicated tool reads as its own keyword-matched page (Google Ads landing-page relevance + SEO). The page HTML is shared; only the head metadata is rewritten.
      const SPA_META = {
        '/paper-trade': { title: 'Crypto Paper Trading — Free Futures Demo Simulator | MarginPad', desc: 'Practice crypto futures with zero risk: live charts, real prices, leverage to 1000x and full P&L tracking. Free paper trading — no signup, no deposit.', canon: 'https://marginpad.io/paper-trade' },
        '/calculators': { title: 'Crypto Futures Calculators — Liquidation, PnL & Size | MarginPad', desc: 'Free crypto futures calculators: liquidation price, profit & loss, position size, take-profit and risk/reward. Instant, private, no signup.', canon: 'https://marginpad.io/calculators' },
        '/charts': { title: 'Multi-Chart Crypto Workspace — Live Futures Charts | MarginPad', desc: 'A free multi-window crypto charting workspace: live futures charts, indicators, drawing tools and quick paper trades on one board.', canon: 'https://marginpad.io/charts' },
        '/screener': { title: 'Crypto Futures Screener — Scored Setups, Funding & OI | MarginPad', desc: 'Free crypto futures screener: 0-100 technical scores with RSI, MACD, funding and open interest on top USDT perps, plus ready trade setups.', canon: 'https://marginpad.io/screener' },
        '/heatmap': { title: 'Crypto Liquidation Heatmap — Live Liquidation Levels | MarginPad', desc: 'Free live crypto liquidation heatmap: see where leveraged positions cluster and get liquidated on BTC and ETH. No signup.', canon: 'https://marginpad.io/heatmap' },
        '/swap': { title: 'Swap Crypto — 900+ Coins, No Account | MarginPad', desc: 'Swap 900+ cryptocurrencies instantly with no account and no signup. Fast, non-custodial crypto swaps.', canon: 'https://marginpad.io/swap' },
      };
      const m = SPA_META[url.pathname.replace(/\/$/, '') || '/'];
      if (!m) return base;
      return new HTMLRewriter()
        .on('title', { element(e) { e.setInnerContent(m.title); } })
        .on('meta[name="description"]', { element(e) { e.setAttribute('content', m.desc); } })
        .on('link[rel="canonical"]', { element(e) { e.setAttribute('href', m.canon); } })
        .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', m.title); } })
        .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', m.desc); } })
        .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', m.canon); } })
        .transform(base);
    }
    return env.ASSETS.fetch(request);
    })();
   } catch (err) { // an unhandled exception = a user got a broken/500 response. Count it AND log the detail so the dashboard/`wrangler tail` can show WHAT broke (not just that something did).
    const detail = String((err && (err.stack || err.message)) || err).replace(/\s+/g, ' ').slice(0, 280);
    let epath = '/', emethod = ''; try { const u = new URL(request.url); epath = u.pathname.slice(0, 80); emethod = request.method; } catch (e) {}
    try { console.error('srverr', emethod, epath, '—', detail); } catch (e) {} // surfaces in `wrangler tail` + CF dashboard logs
    try { if (env && env.STATS) {
      const d = new Date().toISOString().slice(0, 10);
      const bump = async (k, ttl) => { try { const c = await env.STATS.getWithMetadata(k); const v = ((c && c.metadata && c.metadata.c) || 0) + 1; const o = { metadata: { c: v } }; if (ttl) o.expirationTtl = ttl; await env.STATS.put(k, String(v), o); } catch (e) {} };
      const logErr = async () => { try { let lg = []; try { lg = JSON.parse(await env.STATS.get('srverrlog') || '[]'); } catch (e) {} lg.unshift({ p: epath, mth: emethod, m: detail, ts: Date.now() }); await env.STATS.put('srverrlog', JSON.stringify(lg.slice(0, 30)), { expirationTtl: 604800 }); } catch (e) {} };
      ctx.waitUntil(Promise.all([bump('srverr:total'), bump('srverr:day:' + d, 3456000), logErr()]));
    } } catch (e) {}
    return new Response('Server error', { status: 500, headers: { ...CORS } });
   }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(checkAlerts(env));
    ctx.waitUntil(checkAccountAlerts(env));
    ctx.waitUntil(payWeeklyPrizes(env));
    ctx.waitUntil(checkDigest(env));
    ctx.waitUntil(snapshotDaily(env));
    ctx.waitUntil(checkSignals(env));
    ctx.waitUntil(handleScreener(env).catch(() => {})); // keep the global KV screener snapshot warm so /charts "Top signals" loads instantly
  },
  // Inbound email (Cloudflare Email Routing → "Send to Worker"): store messages sent to support@marginpad.io in the admin Support tab.
  async email(message, env, ctx) {
    try {
      const from = String(message.from || '').slice(0, 120);
      let subject = ''; try { subject = String(message.headers.get('subject') || '').slice(0, 200); } catch (e) {}
      let raw = ''; try { raw = await new Response(message.raw).text(); } catch (e) {}
      const text = extractEmailText(raw);
      const msg = ((subject ? subject + '\n\n' : '') + text).slice(0, 1000) || '(no text body)';
      if (env.REWARDS) await env.REWARDS.get(env.REWARDS.idFromName('ledger')).fetch(new Request('https://do/support', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: from, message: msg, address: 'email' }) }));
      // optionally also forward to a verified inbox (set EMAIL_FORWARD to a Cloudflare-verified destination address)
      if (env.EMAIL_FORWARD) { try { await message.forward(env.EMAIL_FORWARD); } catch (e) {} }
    } catch (e) {}
  },
};
// Pull a readable text body out of a raw MIME email (best-effort, no library).
function decodeQP(s) { return String(s).replace(/=\r?\n/g, '').replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))); }
function extractEmailText(raw) {
  if (!raw) return '';
  const m = raw.search(/content-type:\s*text\/plain/i);
  if (m >= 0) {
    let part = raw.slice(m), bs = part.indexOf('\r\n\r\n'); if (bs < 0) bs = part.indexOf('\n\n');
    if (bs >= 0) { let body = part.slice(bs).replace(/^[\r\n]+/, ''); const bnd = body.search(/\r?\n--/); if (bnd > 0) body = body.slice(0, bnd); return decodeQP(body).trim().slice(0, 4000); }
  }
  let bs2 = raw.indexOf('\r\n\r\n'); if (bs2 < 0) bs2 = raw.indexOf('\n\n');
  let body2 = bs2 >= 0 ? raw.slice(bs2) : raw;
  return decodeQP(body2).replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim().slice(0, 4000);
}

// ---------- live chat (Durable Object + WebSocket hibernation) ----------
export class ChatRoom {
  constructor(state, env) { this.state = state; }
  broadcast(obj) {
    const out = JSON.stringify(obj);
    for (const s of this.state.getWebSockets()) { try { s.send(out); } catch (e) {} }
  }
  async fetch(request) {
    const cp = new URL(request.url).pathname, cj = o => new Response(JSON.stringify(o), { headers: { 'content-type': 'application/json' } });
    if (cp.endsWith('/reset')) { await this.state.storage.put('hist', []); this.broadcast({ type: 'history', messages: [] }); return new Response('cleared'); }
    if (cp.endsWith('/history')) { return cj({ messages: (await this.state.storage.get('hist')) || [] }); }
    if (cp.endsWith('/post')) { let b = {}; try { b = await request.json(); } catch (e) {} const text = String(b.text || '').replace(/\s+/g, ' ').trim().slice(0, 280); if (!text) return cj({ error: 'empty' }); const m = { u: 'MarginPad', t: text, ts: Date.now(), admin: true }; let hist = (await this.state.storage.get('hist')) || []; hist.push(m); if (hist.length > 60) hist = hist.slice(-60); await this.state.storage.put('hist', hist); this.broadcast({ type: 'msg', message: m, online: this.state.getWebSockets().length }); return cj({ ok: true }); }
    if (cp.endsWith('/delete')) { let b = {}; try { b = await request.json(); } catch (e) {} const ts = +b.ts; let hist = (await this.state.storage.get('hist')) || []; hist = hist.filter(x => x.ts !== ts); await this.state.storage.put('hist', hist); this.broadcast({ type: 'history', messages: hist }); return cj({ ok: true }); }
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    // Per-IP connection cap: N sockets from one IP is a flood/scrape, not a chat user. The IP rides in the
    // socket attachment (survives hibernation) so the count works across DO restarts.
    const ip = request.headers.get('cf-connecting-ip') || '';
    if (ip) {
      let same = 0;
      for (const s of this.state.getWebSockets()) { try { const a = s.deserializeAttachment(); if (a && typeof a === 'object' && a.ip === ip) same++; } catch (e) {} }
      if (same >= 4) return new Response('too many connections', { status: 429 });
    }
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server);
    try { server.serializeAttachment({ ip, last: 0 }); } catch (e) {}
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
    let att = null; try { att = ws.deserializeAttachment(); } catch (e) {}
    if (typeof att === 'number') att = { ip: '', last: att }; // pre-upgrade sockets stored a bare timestamp
    if (!att || typeof att !== 'object') att = { ip: '', last: 0 };
    if (now - (att.last || 0) < 1200) return; // 1 message / 1.2s per connection
    // …and 1 / 1.2s per IP across ALL its connections (in-memory; resets on hibernation — best-effort).
    if (att.ip) { if (!this.ipLast) this.ipLast = new Map(); const pl = this.ipLast.get(att.ip) || 0; if (now - pl < 1200) return; this.ipLast.set(att.ip, now); if (this.ipLast.size > 500) this.ipLast.clear(); }
    try { ws.serializeAttachment({ ip: att.ip || '', last: now }); } catch (e) {}
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

// ---------- reward faucet ledger (Durable Object, SQLite) ----------
// One global instance (idFromName 'ledger') serializes every claim/withdraw → atomic balances, no double-spend.
// All amounts are integer USDT cents. Caps/cooldown arrive per-request in the x-cfg header (from env vars).
export class RewardLedger {
  constructor(state, env) {
    this.state = state; this.env = env;
    const s = state.storage.sql;
    s.exec('CREATE TABLE IF NOT EXISTS accounts(address TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0, earned INTEGER NOT NULL DEFAULT 0, day TEXT, day_amt INTEGER NOT NULL DEFAULT 0, last_claim INTEGER NOT NULL DEFAULT 0, ip TEXT, created INTEGER NOT NULL DEFAULT 0)');
    s.exec("CREATE TABLE IF NOT EXISTS withdrawals(id TEXT PRIMARY KEY, address TEXT, amount INTEGER, status TEXT, ts INTEGER, paid_ts INTEGER DEFAULT 0, txid TEXT DEFAULT '')");
    s.exec('CREATE TABLE IF NOT EXISTS daily(day TEXT PRIMARY KEY, dispensed INTEGER NOT NULL DEFAULT 0)');
    s.exec('CREATE TABLE IF NOT EXISTS ipday(k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)');
    for (const col of ['cc TEXT', 'dev TEXT', 'claims INTEGER DEFAULT 0', 'banned INTEGER DEFAULT 0', 'payout_addr TEXT', 'welcome INTEGER DEFAULT 0', 'did TEXT']) { try { s.exec('ALTER TABLE accounts ADD COLUMN ' + col); } catch (e) {} } // idempotent migration. accounts keyed by account id ('u:<uid>'); payout_addr = withdrawal wallet; welcome = one-time sign-up bonus granted
    try { s.exec('ALTER TABLE withdrawals ADD COLUMN acct TEXT'); } catch (e) {} // which account a withdrawal belongs to (withdrawals.address now holds the payout wallet)
    s.exec('CREATE TABLE IF NOT EXISTS msgs(address TEXT PRIMARY KEY, message TEXT, ts INTEGER, seen INTEGER NOT NULL DEFAULT 0)'); // admin → user message, shown as a banner on /rewards when that address loads
    s.exec('CREATE TABLE IF NOT EXISTS log(ts INTEGER, type TEXT, address TEXT, cc TEXT, dev TEXT, amount INTEGER)'); // live activity feed: claim / visit / withdraw
    s.exec('CREATE TABLE IF NOT EXISTS vidlock(vid TEXT PRIMARY KEY, address TEXT, ts INTEGER)'); // one address per device; admin can unlock
    s.exec('CREATE TABLE IF NOT EXISTS support(ts INTEGER, email TEXT, address TEXT, message TEXT)'); // contact-us submissions from the rewards page
    try { s.exec('ALTER TABLE support ADD COLUMN closed INTEGER NOT NULL DEFAULT 0'); } catch (e) {} // open vs closed ticket state for the admin Support tab
    s.exec('CREATE TABLE IF NOT EXISTS sreply(ts INTEGER, email TEXT, subject TEXT, body TEXT)'); // email replies sent from the admin Support tab
    s.exec('CREATE TABLE IF NOT EXISTS lb(week INTEGER, address TEXT, roe REAL, pnl REAL, symbol TEXT, side TEXT, ts INTEGER, PRIMARY KEY(week,address))'); // weekly paper-trade leaderboard (best single-trade ROE per wallet)
    try { s.exec('ALTER TABLE lb ADD COLUMN name TEXT'); } catch (e) {} // registered-user display name (username) — league is members-only
    s.exec('CREATE TABLE IF NOT EXISTS notes(address TEXT PRIMARY KEY, note TEXT, ts INTEGER)'); // private admin notes per address
    s.exec('CREATE TABLE IF NOT EXISTS lbban(address TEXT PRIMARY KEY, ts INTEGER)'); // wallets barred from the weekly leaderboard competition
    s.exec("CREATE TABLE IF NOT EXISTS promos(id TEXT PRIMARY KEY, acct TEXT, platform TEXT, url TEXT, ts INTEGER, status TEXT DEFAULT 'pending', note TEXT DEFAULT '', decided_ts INTEGER DEFAULT 0, amount INTEGER DEFAULT 0, ip TEXT, cc TEXT)"); // social promo posts (X/TikTok $1 each, manual review, 24h min live)
    try { s.exec('CREATE INDEX IF NOT EXISTS idx_promos_acct ON promos(acct)'); } catch (e) {}
    s.exec('CREATE TABLE IF NOT EXISTS lbpayouts(week INTEGER, acct TEXT, rank INTEGER, amount INTEGER, ts INTEGER, PRIMARY KEY(week,acct))'); // weekly leaderboard prize payouts — idempotent (same week+acct never paid twice)
    // Indexes for the admin Rewards tab: /accounts groups by ip, /detail filters by ip, lists sort by created — without these they're full-table scans that grow with signups.
    for (const ix of ['CREATE INDEX IF NOT EXISTS idx_accounts_ip ON accounts(ip)', 'CREATE INDEX IF NOT EXISTS idx_accounts_created ON accounts(created)']) { try { s.exec(ix); } catch (e) {} }
  }
  j(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } }); }
  rows(q, ...b) { return this.state.storage.sql.exec(q, ...b).toArray(); }
  log(type, address, cc, dev, amount) { const s = this.state.storage.sql; try { s.exec('INSERT INTO log(ts,type,address,cc,dev,amount) VALUES(?,?,?,?,?,?)', Date.now(), type, address || '', cc || '', dev || '', amount || 0); s.exec('DELETE FROM log WHERE rowid NOT IN (SELECT rowid FROM log ORDER BY ts DESC LIMIT 200)'); } catch (e) {} }
  // One-time sign-up bonus: credit the configured welcome amount to a new account the first time it's seen. Idempotent (welcome flag) + respects the global daily budget. Returns the granted USD amount (0 if not granted).
  grantWelcome(acct, cfg) {
    if (!acct || !(cfg.welcomeC > 0)) return 0;
    const sql = this.state.storage.sql, now = Date.now(), day = new Date().toISOString().slice(0, 10);
    const r = this.rows('SELECT welcome, banned FROM accounts WHERE address=?', acct)[0];
    if (r && (r.welcome || r.banned)) return 0; // already granted, or banned
    const dispensed = (this.rows('SELECT dispensed FROM daily WHERE day=?', day)[0] || { dispensed: 0 }).dispensed;
    if (dispensed + cfg.welcomeC > cfg.capC) return 0; // global daily budget exhausted — skip (rare)
    if (!r) sql.exec('INSERT INTO accounts(address,day,created,welcome,balance,earned) VALUES(?,?,?,1,?,?)', acct, day, now, cfg.welcomeC, cfg.welcomeC);
    else sql.exec('UPDATE accounts SET balance=balance+?, earned=earned+?, welcome=1 WHERE address=?', cfg.welcomeC, cfg.welcomeC, acct);
    sql.exec('INSERT INTO daily(day,dispensed) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET dispensed=dispensed+?', day, cfg.welcomeC, cfg.welcomeC);
    this.log('welcome', acct, '', '', cfg.welcomeC);
    return cfg.welcomeC / 100;
  }
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname, sql = this.state.storage.sql;
    const cfg = JSON.parse(request.headers.get('x-cfg') || '{}');
    const ip = request.headers.get('x-ip') || '';
    const cc = request.headers.get('x-cc') || '', dev = request.headers.get('x-dev') || '', vid = request.headers.get('x-vid') || '', did = request.headers.get('x-did') || '';
    const day = new Date().toISOString().slice(0, 10), now = Date.now();
    let body = {}; if (request.method === 'POST') { try { body = await request.json(); } catch (e) {} }
    const addr = String(body.address || url.searchParams.get('address') || '').toLowerCase();
    const validAddr = /^0x[0-9a-f]{40}$/.test(addr); // the BEP20 payout wallet — only required at withdrawal now
    const validAcct = validAddr || /^u:[0-9a-z]{8,40}$/.test(addr); // admin endpoints address an account by its key ('u:<uid>') OR a legacy 0x wallet
    const acct = String(request.headers.get('x-acct') || ''); // logged-in account identity ('u:<uid>'), resolved server-side from the session; this is the faucet account key (replaces the wallet)
    const meta = { amount: cfg.amountC / 100, perDay: cfg.perDayC / 100, minWd: cfg.minWdC / 100, minClaimsToWd: cfg.minClaimsToWd || 0, welcomeAmt: (cfg.welcomeC || 0) / 100, promoUsd: (cfg.promoC == null ? 1 : cfg.promoC / 100), promoEnabled: cfg.promoEnabled !== false, pauseMsg: cfg.pauseMsg || '', prize1: cfg.prize1, prize2: cfg.prize2, prize3: cfg.prize3 };

    if (path === '/account') {
      const welcomeBonus = acct ? this.grantWelcome(acct, cfg) : 0; // one-time sign-up bonus on first account read
      const r = acct ? this.rows('SELECT * FROM accounts WHERE address=?', acct)[0] : null;
      const mrow = acct ? this.rows('SELECT message,ts FROM msgs WHERE address=?', acct)[0] : null;
      const inbox = { adminMsg: mrow ? mrow.message : '', adminMsgTs: mrow ? mrow.ts : 0, banned: !!(r && r.banned) };
      if (!r) return this.j({ balance: 0, earned: 0, dayAmt: 0, cooldownLeft: 0, canWithdraw: false, payoutAddr: '', welcomeBonus, ...inbox, ...meta });
      const dayAmt = r.day === day ? r.day_amt : 0;
      return this.j({ balance: r.balance / 100, earned: r.earned / 100, dayAmt: dayAmt / 100, cooldownLeft: Math.max(0, cfg.cooldown - (now - r.last_claim)), canWithdraw: r.balance >= cfg.minWdC, payoutAddr: r.payout_addr || '', welcomeBonus, ...inbox, ...meta });
    }
    if (path === '/claim') {
      if (!acct) return this.j({ error: 'login_required' }, 401); // the faucet is account-based now — must be signed in (no wallet needed to claim)
      const dispensed = (this.rows('SELECT dispensed FROM daily WHERE day=?', day)[0] || { dispensed: 0 }).dispensed;
      if (dispensed + cfg.amountC > cfg.capC) return this.j({ error: 'pool_empty' }, 429); // global daily budget reached → faucet closed until tomorrow
      let r = this.rows('SELECT * FROM accounts WHERE address=?', acct)[0];
      if (r && r.banned) return this.j({ error: 'banned' }, 403); // admin-banned account — no more claims
      if (!r) {
        const ik = ip + '|' + day, irow = this.rows('SELECT n FROM ipday WHERE k=?', ik)[0];
        if (irow && irow.n >= cfg.ipCap) return this.j({ error: 'ip_limit' }, 429); // soft anti-abuse: cap brand-new accounts per IP per day
        sql.exec('INSERT INTO accounts(address,day,created,ip,cc,dev,did) VALUES(?,?,?,?,?,?,?)', acct, day, now, ip, cc, dev, did || null);
        sql.exec('INSERT INTO ipday(k,n) VALUES(?,1) ON CONFLICT(k) DO UPDATE SET n=n+1', ik);
        r = this.rows('SELECT * FROM accounts WHERE address=?', acct)[0];
      }
      if (did && r.did !== did) { try { sql.exec('UPDATE accounts SET did=? WHERE address=?', did, acct); } catch (e) {} } // keep the freshest device-cookie binding
      if (now - r.last_claim < cfg.cooldown) return this.j({ error: 'cooldown', left: cfg.cooldown - (now - r.last_claim) }, 429);
      const dayAmt = r.day === day ? r.day_amt : 0;
      if (dayAmt + cfg.amountC > cfg.perDayC) return this.j({ error: 'daily_cap' }, 429);
      sql.exec('UPDATE accounts SET balance=balance+?,earned=earned+?,day=?,day_amt=?,last_claim=?,claims=COALESCE(claims,0)+1 WHERE address=?', cfg.amountC, cfg.amountC, day, dayAmt + cfg.amountC, now, acct);
      sql.exec('INSERT INTO daily(day,dispensed) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET dispensed=dispensed+?', day, cfg.amountC, cfg.amountC);
      const n = this.rows('SELECT balance,day_amt FROM accounts WHERE address=?', acct)[0];
      this.log('claim', acct, cc, dev, cfg.amountC);
      return this.j({ ok: true, credited: cfg.amountC / 100, balance: n.balance / 100, dayAmt: n.day_amt / 100, nextClaim: now + cfg.cooldown, cooldown: cfg.cooldown, canWithdraw: n.balance >= cfg.minWdC });
    }
    if (path === '/withdraw') {
      if (!acct) return this.j({ error: 'login_required' }, 401);
      if (!validAddr) return this.j({ error: 'bad_address' }, 400); // the BEP20 payout wallet is entered HERE, at withdrawal time
      const r = this.rows('SELECT * FROM accounts WHERE address=?', acct)[0];
      if (r && r.banned) return this.j({ error: 'banned' }, 403); // banned accounts can't cash out either
      if (!r || r.balance < cfg.minWdC) return this.j({ error: 'min_not_met', minWd: cfg.minWdC / 100 }, 400);
      if ((r.claims || 0) < (cfg.minClaimsToWd || 0)) return this.j({ error: 'need_claims', need: cfg.minClaimsToWd, have: r.claims || 0 }, 400);
      const amt = r.balance, id = day + '-' + acct.slice(-8) + '-' + now;
      sql.exec("INSERT INTO withdrawals(id,address,acct,amount,status,ts) VALUES(?,?,?,?,'pending',?)", id, addr, acct, amt, now); // address = payout wallet, acct = the account it belongs to
      sql.exec('UPDATE accounts SET balance=0, payout_addr=? WHERE address=?', addr, acct); // move credit to the pending payout queue; remember the wallet
      this.log('withdraw', acct, cc, dev, amt);
      return this.j({ ok: true, amount: amt / 100, id, status: 'pending' });
    }
    if (path === '/admin') {
      const pending = this.rows("SELECT id,address,amount,ts FROM withdrawals WHERE status='pending' ORDER BY ts ASC").map(w => ({ ...w, amountUsd: w.amount / 100 }));
      const st = this.rows('SELECT COUNT(*) c, COALESCE(SUM(earned),0) e FROM accounts')[0];
      const disp = (this.rows('SELECT dispensed FROM daily WHERE day=?', day)[0] || { dispensed: 0 }).dispensed;
      const paid = (this.rows("SELECT COALESCE(SUM(amount),0) s FROM withdrawals WHERE status='paid'")[0] || { s: 0 }).s;
      const paidHistory = this.rows("SELECT address,amount,paid_ts,txid FROM withdrawals WHERE status='paid' ORDER BY paid_ts DESC LIMIT 50").map(w => ({ address: w.address, amountUsd: w.amount / 100, paidTs: w.paid_ts || 0, txid: w.txid || '' }));
      const claimsToday = cfg.amountC ? Math.round(disp / cfg.amountC) : 0; // dispensed ÷ per-claim
      const activeToday = (this.rows('SELECT COUNT(*) n FROM accounts WHERE day=?', day)[0] || { n: 0 }).n; // wallets that claimed today
      const newToday = (this.rows('SELECT COUNT(*) n FROM accounts WHERE created>=?', new Date(day).getTime())[0] || { n: 0 }).n; // accounts created today (UTC)
      return this.j({ pending, paidHistory, accounts: st.c, totalEarnedUsd: st.e / 100, dispensedTodayUsd: disp / 100, dailyCapUsd: cfg.capC / 100, totalPaidUsd: paid / 100, claimsToday, activeToday, newToday });
    }
    if (path === '/admin/paid') {
      sql.exec("UPDATE withdrawals SET status='paid',paid_ts=?,txid=? WHERE id=?", now, String(body.txid || ''), String(body.id || ''));
      return this.j({ ok: true });
    }
    if (path === '/wdhistory') { // a user's own withdrawal history (pending + paid, with tx hash) — keyed by their account
      if (!acct) return this.j({ withdrawals: [] });
      const list = this.rows('SELECT amount,status,ts,paid_ts,txid,address FROM withdrawals WHERE acct=? ORDER BY ts DESC LIMIT 50', acct).map(w => ({ amountUsd: w.amount / 100, status: w.status, ts: w.ts, paidTs: w.paid_ts || 0, txid: w.txid || '', address: w.address || '' }));
      return this.j({ withdrawals: list });
    }
    if (path === '/accounts') { // mini-dashboard: who signed up (address + where-from + multi-account flag) — newest first
      // IP-sharing only counts REAL shared IPs — accounts with an unknown/empty IP must NOT be grouped together (that would falsely flag everyone whose IP we never captured)
      const ipCount = {}; this.rows("SELECT ip, COUNT(*) n FROM accounts WHERE ip IS NOT NULL AND ip != '' GROUP BY ip").forEach(r => { ipCount[r.ip] = r.n; });
      const didCount = {}; this.rows("SELECT did, COUNT(*) n FROM accounts WHERE did IS NOT NULL AND did != '' GROUP BY did").forEach(r => { didCount[r.did] = r.n; });
      const list = this.rows('SELECT address,balance,earned,claims,cc,dev,ip,created,last_claim,banned,did FROM accounts ORDER BY created DESC LIMIT 500')
        .map(a => ({ address: a.address, balanceUsd: a.balance / 100, earnedUsd: a.earned / 100, claims: a.claims || 0, cc: a.cc || '', dev: a.dev || '', ip: a.ip || '', created: a.created, lastClaim: a.last_claim, sameIp: (a.ip ? (ipCount[a.ip] || 1) : 1), sameDid: (a.did ? (didCount[a.did] || 1) : 1), banned: !!a.banned }));
      const totals = this.rows('SELECT COUNT(*) c, COALESCE(SUM(balance),0) b, COALESCE(SUM(earned),0) e FROM accounts')[0];
      const bannedCount = (this.rows('SELECT COUNT(*) n FROM accounts WHERE banned=1')[0] || { n: 0 }).n;
      const ipDistinct = (this.rows("SELECT COUNT(*) n FROM (SELECT ip FROM accounts WHERE ip IS NOT NULL AND ip != '' GROUP BY ip)")[0] || { n: 0 }).n;
      const sharedIpWallets = (this.rows("SELECT COALESCE(SUM(n),0) s FROM (SELECT COUNT(*) n FROM accounts WHERE ip IS NOT NULL AND ip != '' GROUP BY ip HAVING n>1)")[0] || { s: 0 }).s;
      return this.j({ accounts: list, count: totals.c, totalBalanceUsd: totals.b / 100, totalEarnedUsd: totals.e / 100, bannedCount, ipDistinct, sharedIpWallets });
    }
    if (path === '/me') { // page calls this on load: returns the signed-in account's progress (balance survives a cleared browser because it's tied to the account, not the device)
      if (!acct) return this.j({ account: null, ...meta }); // not signed in
      const welcomeBonus = this.grantWelcome(acct, cfg); // grant the one-time sign-up bonus the first time a signed-in account is seen
      const r = this.rows('SELECT * FROM accounts WHERE address=?', acct)[0];
      const dayAmt = (r && r.day === day) ? r.day_amt : 0;
      const mrow = this.rows('SELECT message,ts FROM msgs WHERE address=?', acct)[0];
      return this.j({ account: acct, locked: true, welcomeBonus, payoutAddr: r ? (r.payout_addr || '') : '', balance: r ? r.balance / 100 : 0, earned: r ? r.earned / 100 : 0, dayAmt: dayAmt / 100, cooldownLeft: r ? Math.max(0, cfg.cooldown - (now - r.last_claim)) : 0, canWithdraw: !!(r && r.balance >= cfg.minWdC), adminMsg: mrow ? mrow.message : '', adminMsgTs: mrow ? mrow.ts : 0, banned: !!(r && r.banned), ...meta });
    }
    if (path === '/unlock') { // admin: free the device(s) bound to an address so the user can switch
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      sql.exec('DELETE FROM vidlock WHERE address=?', addr); this.log('unlock', addr, '', '', 0);
      return this.j({ ok: true });
    }
    if (path === '/remove') { // admin: wipe an account (clears it from the active list — used for test cleanup)
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      sql.exec('DELETE FROM accounts WHERE address=?', addr);
      sql.exec('DELETE FROM vidlock WHERE address=?', addr);
      sql.exec('DELETE FROM lb WHERE address=?', addr);
      this.log('remove', addr, '', '', 0);
      return this.j({ ok: true });
    }
    if (path === '/note') { // admin: private note on an address (only visible in the dashboard)
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      const note = String(body.note || '').slice(0, 1000);
      if (note) sql.exec('INSERT INTO notes(address,note,ts) VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET note=excluded.note,ts=excluded.ts', addr, note, now);
      else sql.exec('DELETE FROM notes WHERE address=?', addr);
      return this.j({ ok: true });
    }
    if (path === '/ban') { // admin: ban a wallet from the faucet — future claims rejected (account + balance kept for review)
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      sql.exec('UPDATE accounts SET banned=1 WHERE address=?', addr); this.log('ban', addr, '', '', 0);
      return this.j({ ok: true });
    }
    if (path === '/unban') { // admin: lift a ban
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      sql.exec('UPDATE accounts SET banned=0 WHERE address=?', addr); this.log('unban', addr, '', '', 0);
      return this.j({ ok: true });
    }
    if (path === '/adjust') { // admin: add/subtract USD on a user's balance (tournament/claim corrections); amount in USD, clamps at 0, logged for audit
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      if (!this.rows('SELECT 1 FROM accounts WHERE address=?', addr)[0]) return this.j({ error: 'no_account' }, 404);
      const deltaC = Math.round((+body.deltaUsd || 0) * 100);
      if (!deltaC) return this.j({ error: 'zero_amount' }, 400);
      sql.exec('UPDATE accounts SET balance=MAX(0, balance+?) WHERE address=?', deltaC, addr); this.log('adjust', addr, '', '', deltaC);
      const bal = this.rows('SELECT balance FROM accounts WHERE address=?', addr)[0];
      return this.j({ ok: true, balanceUsd: (bal ? bal.balance : 0) / 100, deltaUsd: deltaC / 100 });
    }
    if (path === '/lbban') { // admin: bar a wallet from the leaderboard competition (or reinstate with {unban:1}) — separate from the faucet ban
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      if (body.unban) { sql.exec('DELETE FROM lbban WHERE address=?', addr); this.log('lb_unban', addr, '', '', 0); }
      else { sql.exec('INSERT INTO lbban(address,ts) VALUES(?,?) ON CONFLICT(address) DO NOTHING', addr, now); sql.exec('DELETE FROM lb WHERE address=?', addr); this.log('lb_ban', addr, '', '', 0); } // also wipe their existing leaderboard entries
      return this.j({ ok: true });
    }
    if (path === '/message') { // admin: write (or clear) a message the user sees as a banner on /rewards
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      const m = String(body.message || '').slice(0, 600);
      if (m.trim()) sql.exec('INSERT INTO msgs(address,message,ts,seen) VALUES(?,?,?,0) ON CONFLICT(address) DO UPDATE SET message=excluded.message,ts=excluded.ts,seen=0', addr, m, now);
      else sql.exec('DELETE FROM msgs WHERE address=?', addr);
      return this.j({ ok: true });
    }
    if (path === '/msgseen') { // public: the page marks the admin message read once shown (so the admin sees a "read" tick)
      if (acct) sql.exec('UPDATE msgs SET seen=1 WHERE address=?', acct);
      return this.j({ ok: true });
    }
    if (path === '/detail') { // admin: everything about one address, for the click-through popup
      if (!validAcct) return this.j({ error: 'bad_address' }, 400);
      const a = this.rows('SELECT * FROM accounts WHERE address=?', addr)[0];
      const noteRow = this.rows('SELECT note FROM notes WHERE address=?', addr)[0];
      const lock = this.rows('SELECT vid FROM vidlock WHERE address=?', addr)[0];
      const wds = this.rows('SELECT amount,status,ts,paid_ts,txid FROM withdrawals WHERE address=? ORDER BY ts DESC LIMIT 20', addr).map(w => ({ amountUsd: w.amount / 100, status: w.status, ts: w.ts, paidTs: w.paid_ts || 0, txid: w.txid || '' }));
      const lbrow = this.rows('SELECT roe,pnl,symbol,side,week FROM lb WHERE address=? ORDER BY week DESC LIMIT 1', addr)[0];
      const lbBanned = !!this.rows('SELECT 1 FROM lbban WHERE address=?', addr)[0];
      const mrow = this.rows('SELECT message,ts,seen FROM msgs WHERE address=?', addr)[0];
      const sameIp = !a ? 0 : (a.ip ? (this.rows('SELECT COUNT(*) n FROM accounts WHERE ip=?', a.ip)[0] || { n: 1 }).n : 1); // unknown IP is never "shared"
      // --- fraud signals (computed from what we already store) ---
      const ipWallets = (a && a.ip) ? this.rows('SELECT address,balance,claims,banned,created FROM accounts WHERE ip=? AND address!=? ORDER BY created DESC LIMIT 20', a.ip, addr).map(x => ({ address: x.address, balanceUsd: x.balance / 100, claims: x.claims || 0, banned: !!x.banned })) : [];
      const didWallets = (a && a.did) ? this.rows('SELECT address,balance,claims,banned FROM accounts WHERE did=? AND address!=? ORDER BY created DESC LIMIT 20', a.did, addr).map(x => ({ address: x.address, balanceUsd: x.balance / 100, claims: x.claims || 0, banned: !!x.banned })) : [];
      const sameDid = didWallets.length + (a && a.did ? 1 : 0);
      const claims = a ? (a.claims || 0) : 0;
      const ageMs = (a && a.created) ? now - a.created : 0;
      const ageH = ageMs / 3600000;
      const claimsPerHour = (ageH > 0.05) ? claims / ageH : claims; // very young accounts: treat each claim as 1/hr-ish
      const flags = [];
      if (a && a.banned) flags.push('Banned from the faucet');
      if (sameIp > 1) flags.push(sameIp + ' wallets share this IP' + (ipWallets.some(w => w.banned) ? ' (one already banned)' : ''));
      if (sameDid > 1) flags.push(sameDid + ' wallets on this DEVICE (cookie) — strongest multi-account signal' + (didWallets.some(w => w.banned) ? ' (one already banned)' : ''));
      if (ageMs && ageH < 1 && claims >= 5) flags.push('New account (' + Math.round(ageMs / 60000) + 'm old) with ' + claims + ' claims');
      if (claimsPerHour > 9) flags.push('High claim rate (' + claimsPerHour.toFixed(1) + '/hr)');
      if (!lock && claims > 0) flags.push('No device lock on file (was it unlocked?)');
      const riskLevel = (a && a.banned) || sameIp > 2 || (ageMs && ageH < 1 && claims >= 5) ? 'high' : (sameIp > 1 || claimsPerHour > 9) ? 'med' : 'low';
      const fraud = { riskLevel, flags, sameIp, ipWallets, sameDid, didWallets, ageMs, claimsPerHour: +claimsPerHour.toFixed(2) };
      const payoutAddr = a ? (a.payout_addr || (this.rows('SELECT address FROM withdrawals WHERE acct=? AND address IS NOT NULL ORDER BY ts DESC LIMIT 1', addr)[0] || {}).address || '') : ''; // the BEP20 wallet linked to this account (set at withdrawal)
      return this.j({ address: addr, exists: !!a, payoutAddr, balanceUsd: a ? a.balance / 100 : 0, earnedUsd: a ? a.earned / 100 : 0, claims, cc: a ? (a.cc || '') : '', dev: a ? (a.dev || '') : '', ip: a ? (a.ip || '') : '', created: a ? a.created : 0, lastClaim: a ? a.last_claim : 0, locked: !!lock, banned: !!(a && a.banned), sameIp, note: noteRow ? noteRow.note : '', msg: mrow ? mrow.message : '', msgTs: mrow ? mrow.ts : 0, msgSeen: mrow ? !!mrow.seen : false, withdrawals: wds, lb: lbrow || null, lbBanned, fraud });
    }
    if (path === '/paywinners') { // credit weekly leaderboard prizes to the top accounts — idempotent per (week,acct)
      const week = Math.floor(+body.week || 0);
      const winners = Array.isArray(body.winners) ? body.winners : [];
      if (!week || !winners.length) return this.j({ ok: true, paid: 0 });
      const out = [];
      for (const w of winners) {
        const acct = String(w.acct || ''), cents = Math.round(+w.cents || 0), rank = Math.floor(+w.rank || 0);
        if (!acct || cents <= 0) continue;
        if (this.rows('SELECT week FROM lbpayouts WHERE week=? AND acct=?', week, acct).length) continue; // already paid this week
        const arow = this.rows('SELECT address, banned FROM accounts WHERE address=?', acct)[0];
        if (arow && arow.banned) continue; // never pay a banned account
        if (!arow) sql.exec('INSERT INTO accounts(address,day,created,balance,earned) VALUES(?,?,?,?,?)', acct, day, now, cents, cents);
        else sql.exec('UPDATE accounts SET balance=balance+?, earned=earned+? WHERE address=?', cents, cents, acct);
        sql.exec('INSERT INTO lbpayouts(week,acct,rank,amount,ts) VALUES(?,?,?,?,?)', week, acct, rank, cents, now);
        this.log('lbprize', acct, '', '', cents);
        out.push({ acct, rank, amount: cents });
      }
      return this.j({ ok: true, paid: out.length, payouts: out });
    }
    // ---- Social promo: $1 per X post + $1 per TikTok post about the site (1/day each, manual review, must stay live 24h) ----
    if (path === '/promo/submit') {
      if (!acct) return this.j({ error: 'login_required' }, 401);
      if (cfg.promoEnabled === false) return this.j({ error: 'paused' }, 503);
      const arow = this.rows('SELECT banned FROM accounts WHERE address=?', acct)[0];
      if (arow && arow.banned) return this.j({ error: 'banned' }, 403);
      const platform = String(body.platform || '').toLowerCase();
      if (platform !== 'x' && platform !== 'tiktok') return this.j({ error: 'bad_platform' }, 400);
      let u = String(body.url || '').trim().slice(0, 300);
      if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      let host = ''; try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch (e) { return this.j({ error: 'bad_url' }, 400); }
      const okHost = platform === 'x' ? (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com') : (host === 'tiktok.com' || /\.tiktok\.com$/.test(host));
      if (!okHost) return this.j({ error: 'bad_url' }, 400);
      const norm = u.replace(/[?#].*$/, '').replace(/\/+$/, '');
      if (this.rows('SELECT id FROM promos WHERE lower(url)=lower(?)', norm).length) return this.j({ error: 'url_taken' }, 409); // each post link pays once, ever - across ALL accounts
      const dayStart = new Date(day + 'T00:00:00Z').getTime();
      if (this.rows("SELECT id FROM promos WHERE acct=? AND platform=? AND ts>=? AND status!='rejected'", acct, platform, dayStart).length) return this.j({ error: 'daily_limit' }, 429);
      const id = 'pr' + now.toString(36) + Math.floor(Math.random() * 1679616).toString(36);
      sql.exec('INSERT INTO promos(id,acct,platform,url,ts,status,ip,cc) VALUES(?,?,?,?,?,?,?,?)', id, acct, platform, norm, now, 'pending', ip, cc);
      this.log('promo', acct, cc, dev, 0);
      return this.j({ ok: true, id, status: 'pending' });
    }
    if (path === '/promo/mine') {
      if (!acct) return this.j({ error: 'login_required' }, 401);
      const rows = this.rows('SELECT id,platform,url,ts,status,note,amount,decided_ts FROM promos WHERE acct=? ORDER BY ts DESC LIMIT 12', acct);
      return this.j({ promos: rows.map(r => ({ ...r, amount: (r.amount || 0) / 100 })) });
    }
    if (path === '/promo/list') { // admin: review queue + recent decisions
      const pending = this.rows("SELECT id,acct AS address,platform,url,ts,ip,cc FROM promos WHERE status='pending' ORDER BY ts ASC LIMIT 100");
      const decided = this.rows("SELECT id,acct AS address,platform,url,ts,status,note,amount,decided_ts FROM promos WHERE status!='pending' ORDER BY decided_ts DESC LIMIT 30");
      return this.j({ pending, decided: decided.map(r => ({ ...r, amount: (r.amount || 0) / 100 })), promoUsd: (cfg.promoC == null ? 1 : cfg.promoC / 100), minAgeMs: 86400000 });
    }
    if (path === '/promo/review') { // admin: approve (credits the balance) or reject (with a note the user sees)
      const id = String(body.id || ''), action = String(body.action || '');
      const p = this.rows('SELECT * FROM promos WHERE id=?', id)[0];
      if (!p) return this.j({ error: 'not_found' }, 404);
      if (p.status !== 'pending') return this.j({ error: 'already_decided' }, 409);
      if (action === 'reject') { sql.exec("UPDATE promos SET status='rejected', note=?, decided_ts=? WHERE id=?", String(body.note || '').slice(0, 200), now, id); return this.j({ ok: true, status: 'rejected' }); }
      if (action !== 'approve') return this.j({ error: 'bad_action' }, 400);
      if (!body.force && now - p.ts < 86400000) return this.j({ error: 'too_early', waitMs: 86400000 - (now - p.ts) }, 400); // 24h-live gate — admin can bypass with force
      const amt = (cfg.promoC == null ? 100 : cfg.promoC);
      const acctRow = this.rows('SELECT address,banned FROM accounts WHERE address=?', p.acct)[0];
      if (acctRow && acctRow.banned) return this.j({ error: 'banned' }, 403);
      if (!acctRow) sql.exec('INSERT INTO accounts(address,day,created,balance,earned) VALUES(?,?,?,?,?)', p.acct, day, now, amt, amt);
      else sql.exec('UPDATE accounts SET balance=balance+?, earned=earned+? WHERE address=?', amt, amt, p.acct);
      sql.exec('INSERT INTO daily(day,dispensed) VALUES(?,?) ON CONFLICT(day) DO UPDATE SET dispensed=dispensed+?', day, amt, amt); // counts in the Dispensed-today tile (visibility, not a gate - approval is the gate)
      sql.exec("UPDATE promos SET status='approved', amount=?, note=?, decided_ts=? WHERE id=?", amt, String(body.note || '').slice(0, 200), now, id);
      this.log('promo_paid', p.acct, p.cc || '', '', amt);
      return this.j({ ok: true, status: 'approved', amount: amt / 100 });
    }
    if (path === '/support') {
      if (request.method === 'POST') {
        const email = String(body.email || '').slice(0, 120), message = String(body.message || '').slice(0, 1000);
        if (!message.trim()) return this.j({ error: 'empty' }, 400);
        sql.exec('INSERT INTO support(ts,email,address,message) VALUES(?,?,?,?)', now, email, addr || '', message);
        sql.exec('DELETE FROM support WHERE rowid NOT IN (SELECT rowid FROM support ORDER BY ts DESC LIMIT 200)');
        return this.j({ ok: true });
      }
      return this.j({
        open: this.rows('SELECT rowid AS id,ts,email,address,message FROM support WHERE closed=0 ORDER BY ts DESC LIMIT 100'),
        closed: this.rows('SELECT rowid AS id,ts,email,address,message FROM support WHERE closed=1 ORDER BY ts DESC LIMIT 100'),
        replies: this.rows('SELECT ts,email,subject FROM sreply ORDER BY ts DESC LIMIT 100'),
      });
    }
    if (path === '/support/close') { // admin: mark a ticket closed (or reopen with {reopen:1}) by rowid
      const id = parseInt(body.id, 10), val = body.reopen ? 0 : 1;
      if (id) sql.exec('UPDATE support SET closed=? WHERE rowid=?', val, id);
      return this.j({ ok: true });
    }
    if (path === '/support/new') { // admin-initiated ticket (address='admin' marks "you started this"); the email is sent from the Worker
      const email = String(body.email || '').slice(0, 120), message = String(body.message || '').slice(0, 1000);
      if (!email.trim()) return this.j({ error: 'no_email' }, 400);
      sql.exec('INSERT INTO support(ts,email,address,message,closed) VALUES(?,?,?,?,0)', now, email, 'admin', message);
      sql.exec('DELETE FROM support WHERE rowid NOT IN (SELECT rowid FROM support ORDER BY ts DESC LIMIT 200)');
      return this.j({ ok: true });
    }
    if (path === '/reply') { // admin: record an email reply we sent (the email itself is sent in the Worker)
      const to = String(body.to || '').slice(0, 120), subject = String(body.subject || '').slice(0, 200), msg = String(body.message || '').slice(0, 4000);
      sql.exec('INSERT INTO sreply(ts,email,subject,body) VALUES(?,?,?,?)', now, to, subject, msg);
      sql.exec('DELETE FROM sreply WHERE rowid NOT IN (SELECT rowid FROM sreply ORDER BY ts DESC LIMIT 300)');
      return this.j({ ok: true });
    }
    if (path === '/lb') { // weekly paper-trade leaderboard — Monday 00:00 UTC → Sunday 23:59 UTC
      const WK = 604800000, MON = 4 * 86400000; // anchor weeks to Monday 00:00 UTC (epoch 1970-01-01 was Thursday, +4d = Monday)
      const weekStart = Math.floor((now - MON) / WK) * WK + MON, weekEnd = weekStart + WK, week = weekStart; // use the Monday-00:00-UTC ms timestamp as the week key — won't collide with the old Thursday-indexed rows
      if (request.method === 'POST') {
        const key = acct || (validAddr ? addr : ''); // leaderboard is now keyed by the signed-in account (members-only); legacy wallet entries still resolve
        if (!key) return this.j({ error: 'login_required' }, 401);
        if (this.rows('SELECT 1 FROM lbban WHERE address=?', key)[0]) return this.j({ ok: true, banned: true }); // barred from the leaderboard — silently drop the submission
        let roe = +body.roe, pnl = +body.pnl; if (!isFinite(roe)) return this.j({ error: 'bad' }, 400);
        roe = Math.max(-100, Math.min(roe, 1000000)); pnl = isFinite(pnl) ? pnl : 0; // clamp absurd values
        const sym = String(body.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), side = body.side === 'short' ? 'short' : 'long';
        const name = String(body.name || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
        sql.exec('INSERT INTO lb(week,address,roe,pnl,symbol,side,ts,name) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(week,address) DO UPDATE SET roe=excluded.roe,pnl=excluded.pnl,symbol=excluded.symbol,side=excluded.side,ts=excluded.ts,name=excluded.name WHERE excluded.roe>lb.roe', week, key, roe, pnl, sym, side, now, name);
        return this.j({ ok: true });
      }
      const mask = a => !a ? '' : (a.slice(0, 2) === 'u:' ? 'Trader' : a.slice(0, 6) + '…' + a.slice(-4)); // account entries show their username (name) or 'Trader'; legacy wallet entries are masked
      const top = this.rows('SELECT address,roe,pnl,symbol,side,name FROM lb WHERE week=? AND address NOT IN (SELECT address FROM lbban) ORDER BY roe DESC LIMIT 10', week).map((r, i) => ({ rank: i + 1, who: r.name || mask(r.address), roe: r.roe, pnl: r.pnl, symbol: r.symbol, side: r.side }));
      return this.j({ week, weekStart, weekEnd, top });
    }
    if (path === '/lbtop') { // admin: this week's leaderboard with REAL addresses + ban state — powers the Rewards-tab eject control
      const WK = 604800000, MON = 4 * 86400000;
      const week = Math.floor((now - MON) / WK) * WK + MON;
      const banned = {}; this.rows('SELECT address FROM lbban').forEach(r => { banned[r.address] = 1; });
      const top = this.rows('SELECT address,roe,pnl,symbol,side,name FROM lb WHERE week=? ORDER BY roe DESC LIMIT 30', week).map((r, i) => ({ rank: i + 1, address: r.address, name: r.name || '', roe: r.roe, pnl: r.pnl, symbol: r.symbol, side: r.side, banned: !!banned[r.address] }));
      return this.j({ week, top });
    }
    if (path === '/lbbans') { return this.j({ banned: this.rows('SELECT address FROM lbban').map(r => r.address) }); } // ban list → worker applies it to the UserStore-derived board
    if (path === '/visit') { this.log('visit', acct || '', cc, dev, 0); return this.j({ ok: true }); } // someone opened the rewards page
    if (path === '/log') {
      const list = this.rows('SELECT ts,type,address,cc,dev,amount FROM log ORDER BY ts DESC LIMIT 60').map(e => ({ ts: e.ts, type: e.type, address: e.address || '', cc: e.cc || '', dev: e.dev || '', amountUsd: (e.amount || 0) / 100 }));
      return this.j({ log: list });
    }
    return this.j({ error: 'not_found' }, 404);
  }
}

// Optional accounts (passwordless email sign-in). Single instance idFromName('main').
// Anonymous use stays the default; this only backs the optional "Sign in" flow (email capture for MVP).
export class UserStore {
  constructor(state, env) {
    this.state = state; this.env = env;
    const s = state.storage.sql;
    s.exec('CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE, created INTEGER, last_login INTEGER, ip TEXT, cc TEXT, logins INTEGER DEFAULT 0)');
    s.exec('CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT, created INTEGER, expires INTEGER, ua TEXT)');
    s.exec('CREATE TABLE IF NOT EXISTS otp(email TEXT PRIMARY KEY, code TEXT, expires INTEGER, attempts INTEGER DEFAULT 0, sent INTEGER, sends INTEGER DEFAULT 0, day TEXT)'); // one active code per email; rate-limited
    s.exec('CREATE TABLE IF NOT EXISTS otpip(k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)'); // per-IP-per-day OTP send cap, so one source can't email-bomb many addresses
    for (const col of ['dev TEXT', 'br TEXT', 'last_seen INTEGER', 'pv INTEGER DEFAULT 0', 'username TEXT', "status TEXT DEFAULT 'active'", 'susp_until INTEGER DEFAULT 0', 'muted INTEGER DEFAULT 0', 'restrictions TEXT', 'note TEXT', 'asn INTEGER', 'org TEXT', 'digest INTEGER DEFAULT 1', 'tg_chat TEXT']) { try { s.exec('ALTER TABLE users ADD COLUMN ' + col); } catch (e) {} } // device/browser, activity rollups, moderation, digest opt-in, linked Telegram chat
    for (const col of ['ip TEXT', 'cc TEXT', 'asn INTEGER', 'org TEXT']) { try { s.exec('ALTER TABLE sessions ADD COLUMN ' + col); } catch (e) {} } // per-login location + ASN for the session/VPN view
    s.exec('CREATE TABLE IF NOT EXISTS uevents(user_id TEXT, ts INTEGER, type TEXT, label TEXT, path TEXT, cc TEXT, dev TEXT)'); // per-user activity trail (ring-buffered)
    s.exec('CREATE TABLE IF NOT EXISTS uclicks(user_id TEXT, ts INTEGER, x INTEGER, y INTEGER, path TEXT)'); // per-user click heatmap (normalized x/y %, ring-buffered ~300)
    s.exec('CREATE TABLE IF NOT EXISTS utrades(user_id TEXT PRIMARY KEY, json TEXT, n INTEGER, wins INTEGER, losses INTEGER, opens INTEGER, pnl REAL, updated INTEGER)'); // synced paper-trade journal + summary
    s.exec('CREATE TABLE IF NOT EXISTS udwell(user_id TEXT, path TEXT, secs INTEGER DEFAULT 0, hits INTEGER DEFAULT 0, last INTEGER, PRIMARY KEY(user_id, path))'); // accumulated time-on-page per path
    s.exec('CREATE TABLE IF NOT EXISTS alerts(id TEXT PRIMARY KEY, uid TEXT, email TEXT, sym TEXT, dir TEXT, target REAL, note TEXT, active INTEGER DEFAULT 1, created INTEGER, fired_ts INTEGER DEFAULT 0)'); // price alerts (account-based)
    try { s.exec("ALTER TABLE alerts ADD COLUMN channel TEXT DEFAULT 'email'"); } catch (e) {} // delivery channel: 'email' or 'telegram'
    try { s.exec('CREATE INDEX IF NOT EXISTS al_active ON alerts(active)'); } catch (e) {}
    try { s.exec('CREATE INDEX IF NOT EXISTS al_uid ON alerts(uid)'); } catch (e) {}
    s.exec('CREATE TABLE IF NOT EXISTS psubs(endpoint TEXT PRIMARY KEY, uid TEXT, p256dh TEXT, auth TEXT, created INTEGER)'); // web-push subscriptions (one row per browser/device, keyed by its endpoint)
    try { s.exec('CREATE INDEX IF NOT EXISTS ps_uid ON psubs(uid)'); } catch (e) {}
    try { s.exec('CREATE INDEX IF NOT EXISTS uev_user ON uevents(user_id, ts)'); } catch (e) {}
    try { s.exec('CREATE INDEX IF NOT EXISTS ucl_user ON uclicks(user_id, ts)'); } catch (e) {}
    try { s.exec('CREATE UNIQUE INDEX IF NOT EXISTS uname_uniq ON users(username) WHERE username IS NOT NULL'); } catch (e) {} // enforce unique usernames at the DB level too
    s.exec('CREATE TABLE IF NOT EXISTS aiuse(k TEXT PRIMARY KEY, n INTEGER NOT NULL DEFAULT 0)'); // atomic per-user daily "Ask AI" counter (k = uid|day) — KV was racy and over-spent the paid LLM quota
    s.exec('CREATE TABLE IF NOT EXISTS botkeys(k TEXT PRIMARY KEY, uid TEXT UNIQUE, created INTEGER, calls INTEGER DEFAULT 0, mn TEXT, mint INTEGER DEFAULT 0)'); // bot-API keys (one per account) + per-minute rate window
    s.exec('CREATE TABLE IF NOT EXISTS botpos(id TEXT PRIMARY KEY, uid TEXT, json TEXT, status TEXT, ts INTEGER)'); // server-side paper positions opened via the bot API
    try { s.exec('CREATE INDEX IF NOT EXISTS bp_uid ON botpos(uid, ts)'); } catch (e) {}
  }
  j(o, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json' } }); }
  rows(q, ...b) { return this.state.storage.sql.exec(q, ...b).toArray(); }
  rid() { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map(x => x.toString(16).padStart(2, '0')).join(''); }
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname, sql = this.state.storage.sql, now = Date.now();
    const day = new Date().toISOString().slice(0, 10);
    let b = {}; if (request.method === 'POST') { try { b = await request.json(); } catch (e) {} }

    if (path === '/otp') { // create/rotate a 6-digit code, rate-limited; returns the code for the Worker to email
      const email = String(b.email || '').toLowerCase(); if (!email) return this.j({ error: 'bad_email' });
      const ip = String(b.ip || '').slice(0, 64), ipk = ip + '|' + day;
      if (ip) { const ipr = this.rows('SELECT n FROM otpip WHERE k=?', ipk)[0]; if (ipr && (ipr.n || 0) >= 20) return this.j({ error: 'too_many' }); } // max 20 OTP emails from one IP per day (anti email-bombing)
      const ex = this.rows('SELECT * FROM otp WHERE email=?', email)[0];
      if (ex) {
        if (ex.day === day && (ex.sends || 0) >= 8) return this.j({ error: 'too_many' });          // max 8 codes / email / day
        if (now - (ex.sent || 0) < 60000) return this.j({ error: 'cooldown', wait: Math.ceil((60000 - (now - ex.sent)) / 1000) }); // 60s resend gap
      }
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      const sends = ((ex && ex.day === day) ? (ex.sends || 0) : 0) + 1;
      sql.exec('INSERT INTO otp(email,code,expires,attempts,sent,sends,day) VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET code=excluded.code,expires=excluded.expires,attempts=0,sent=excluded.sent,sends=excluded.sends,day=excluded.day', email, code, now + 600000, 0, now, sends, day);
      if (ip) sql.exec('INSERT INTO otpip(k,n) VALUES(?,1) ON CONFLICT(k) DO UPDATE SET n=n+1', ipk);
      return this.j({ ok: true, code });
    }
    if (path === '/verify') {
      const email = String(b.email || '').toLowerCase(), code = String(b.code || '');
      const o = this.rows('SELECT * FROM otp WHERE email=?', email)[0];
      if (!o) return this.j({ error: 'no_code' });
      if (now > o.expires) { sql.exec('DELETE FROM otp WHERE email=?', email); return this.j({ error: 'expired' }); }
      if ((o.attempts || 0) >= 5) { sql.exec('DELETE FROM otp WHERE email=?', email); return this.j({ error: 'too_many_attempts' }); }
      if (o.code !== code) { sql.exec('UPDATE otp SET attempts=attempts+1 WHERE email=?', email); return this.j({ error: 'bad_code', left: 5 - ((o.attempts || 0) + 1) }); }
      let u = this.rows('SELECT * FROM users WHERE email=?', email)[0]; let isNew = false;
      if (u && u.status === 'banned') { sql.exec('DELETE FROM otp WHERE email=?', email); return this.j({ error: 'banned' }); }
      if (u && u.status === 'suspended') {
        if (u.susp_until && now > u.susp_until) sql.exec("UPDATE users SET status='active',susp_until=0 WHERE id=?", u.id); // suspension expired → reactivate
        else { sql.exec('DELETE FROM otp WHERE email=?', email); return this.j({ error: 'suspended', until: u.susp_until || 0 }); }
      }
      sql.exec('DELETE FROM otp WHERE email=?', email);
      const dev = String(b.dev || ''), br = String(b.br || ''), org = String(b.org || ''), asn = +b.asn || 0;
      if (!u) { const id = this.rid(); sql.exec('INSERT INTO users(id,email,created,last_login,ip,cc,dev,br,last_seen,logins,org,asn,status) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)', id, email, now, now, String(b.ip || ''), String(b.cc || ''), dev, br, now, org, asn, 'active'); u = this.rows('SELECT * FROM users WHERE id=?', id)[0]; isNew = true; }
      else sql.exec('UPDATE users SET last_login=?,logins=logins+1,last_seen=?,dev=?,br=?,org=?,asn=? WHERE id=?', now, now, dev, br, org, asn, u.id);
      const token = this.rid() + this.rid();
      sql.exec('INSERT INTO sessions(token,user_id,created,expires,ua,ip,cc,asn,org) VALUES(?,?,?,?,?,?,?,?,?)', token, u.id, now, now + 2592000000, String(b.ua || '').slice(0, 200), String(b.ip || ''), String(b.cc || ''), asn, org);
      if (Math.random() < 0.02) sql.exec('DELETE FROM sessions WHERE expires<?', now); // occasional cleanup of expired sessions
      return this.j({ ok: true, token, isNew, user: { email: u.email, id: u.id, username: u.username || '', created: u.created } });
    }
    if (path === '/ailimit') { // atomic AI-quota gate: RESERVE a slot before the Anthropic call (single-threaded DO → parallel requests can't over-spend). POST {uid, limit, day, probe?, refund?}
      const uid = String(b.uid || ''); if (!uid) return this.j({ ok: false, error: 'no_uid' });
      const k = uid + '|' + String(b.day || day);
      const row = this.rows('SELECT n FROM aiuse WHERE k=?', k)[0];
      const used = row ? (row.n || 0) : 0;
      if (b.probe) return this.j({ ok: true, used });
      if (b.refund) { if (used > 0) sql.exec('UPDATE aiuse SET n=n-1 WHERE k=?', k); return this.j({ ok: true, used: Math.max(0, used - 1) }); }
      const limit = Math.max(0, +b.limit || 0);
      if (used >= limit) return this.j({ ok: false, used, limit });
      sql.exec('INSERT INTO aiuse(k,n) VALUES(?,1) ON CONFLICT(k) DO UPDATE SET n=n+1', k);
      if (Math.random() < 0.02) { try { sql.exec("DELETE FROM aiuse WHERE k NOT LIKE '%|' || ?", String(b.day || day)); } catch (e) {} } // occasional cleanup of past days
      return this.j({ ok: true, used: used + 1, limit });
    }
    if (path === '/botkey') { // create / fetch / rotate the account's bot-API key
      const uid = String(b.uid || ''); if (!uid) return this.j({ error: 'no_uid' });
      let row = this.rows('SELECT k FROM botkeys WHERE uid=?', uid)[0];
      if (b.rotate && row) { sql.exec('DELETE FROM botkeys WHERE uid=?', uid); row = null; }
      if (!row) { const k = 'mpb_' + this.rid(); sql.exec('INSERT INTO botkeys(k,uid,created) VALUES(?,?,?)', k, uid, now); return this.j({ key: k, created: now }); }
      return this.j({ key: row.k });
    }
    if (path === '/botauth') { // resolve key → uid + 120 req/min rate limit (atomic, single-threaded DO)
      const k = String(b.key || ''); const row = this.rows('SELECT * FROM botkeys WHERE k=?', k)[0];
      if (!row) return this.j({ error: 'bad_key' });
      const mn = new Date().toISOString().slice(0, 16);
      const cnt = (row.mn === mn) ? (row.mint || 0) + 1 : 1;
      if (cnt > 120) return this.j({ error: 'rate_limit' });
      sql.exec('UPDATE botkeys SET mn=?, mint=?, calls=calls+1 WHERE k=?', mn, cnt, k);
      return this.j({ uid: row.uid });
    }
    if (path === '/botopen') {
      const uid = String(b.uid || ''), pos = b.pos || {};
      const openN = this.rows("SELECT COUNT(*) AS n FROM botpos WHERE uid=? AND status='open'", uid)[0];
      if (openN && openN.n >= 50) return this.j({ error: 'too_many_open', max: 50 });
      sql.exec('INSERT INTO botpos(id,uid,json,status,ts) VALUES(?,?,?,?,?)', pos.id, uid, JSON.stringify(pos), 'open', now);
      return this.j({ ok: true, position: pos });
    }
    if (path === '/botpositions' || path === '/botclose' || path === '/botcloseall') {
      const uid = String(b.uid || ''), PR = b.prices || {};
      const liqSweep = (p) => { const live = PR[p.symbol]; if (!(live > 0) || p.status !== 'open') return p;
        const long = p.side === 'long', dir = long ? 1 : -1;
        const settle = (px, st) => { let pnl = p.qty * (px - p.entry_price) * dir; if (pnl < -p.margin_usd) pnl = -p.margin_usd; p.status = st; p.exit_price = px; p.pnl_usd = Math.round(pnl * 100) / 100; p.closed_ts = Date.now(); };
        if (long ? live <= p.liq_price : live >= p.liq_price) { p.status = 'liquidated'; p.exit_price = p.liq_price; p.pnl_usd = -p.margin_usd; p.closed_ts = Date.now(); return p; }
        if (p.sl != null && (long ? live <= p.sl : live >= p.sl)) { settle(p.sl, 'closed_sl'); return p; }
        if (p.tp != null && (long ? live >= p.tp : live <= p.tp)) { settle(p.tp, 'closed_tp'); return p; }
        return p; };
      const mark = (p) => { const live = PR[p.symbol]; if (p.status === 'open' && live > 0) { const dir = p.side === 'long' ? 1 : -1; let pnl = p.qty * (live - p.entry_price) * dir; if (pnl < -p.margin_usd) pnl = -p.margin_usd; p.mark_price = live; p.unrealized_pnl_usd = Math.round(pnl * 100) / 100; } return p; };
      if (path === '/botcloseall') {
        const rows = this.rows("SELECT * FROM botpos WHERE uid=? AND status='open'", uid);
        const out = [];
        for (const row of rows) { let p = {}; try { p = JSON.parse(row.json); } catch (e) {}
          p = liqSweep(p);
          if (p.status === 'open') { const live = PR[p.symbol]; if (live > 0) { const dir = p.side === 'long' ? 1 : -1; let pnl = p.qty * (live - p.entry_price) * dir; if (pnl < -p.margin_usd) pnl = -p.margin_usd; p.status = 'closed'; p.exit_price = live; p.pnl_usd = Math.round(pnl * 100) / 100; p.closed_ts = Date.now(); } }
          sql.exec('UPDATE botpos SET json=?, status=? WHERE id=?', JSON.stringify(p), p.status, p.id); out.push(p); }
        return this.j({ ok: true, closed: out.filter(p => p.status !== 'open').length, positions: out });
      }
      if (path === '/botclose') {
        const row = this.rows('SELECT * FROM botpos WHERE id=? AND uid=?', String(b.id || ''), uid)[0];
        if (!row) return this.j({ error: 'not_found' });
        let p = {}; try { p = JSON.parse(row.json); } catch (e) {}
        p = liqSweep(p);
        if (p.status !== 'open') { sql.exec('UPDATE botpos SET json=?, status=? WHERE id=?', JSON.stringify(p), p.status, p.id); return this.j({ error: 'already_closed', position: p }); }
        const live = PR[p.symbol]; if (!(live > 0)) return this.j({ error: 'no_price' });
        const pct = Math.min(100, Math.max(1, +b.pct || 100)) / 100, dir = p.side === 'long' ? 1 : -1;
        if (pct >= 1) {
          let pnl = p.qty * (live - p.entry_price) * dir; if (pnl < -p.margin_usd) pnl = -p.margin_usd;
          p.status = 'closed'; p.exit_price = live; p.pnl_usd = Math.round(pnl * 100) / 100; p.closed_ts = Date.now();
          sql.exec('UPDATE botpos SET json=?, status=? WHERE id=?', JSON.stringify(p), 'closed', p.id);
          return this.j({ ok: true, position: p });
        }
        const part = JSON.parse(JSON.stringify(p));
        part.id = p.id + 'p' + Date.now().toString(36);
        part.qty = p.qty * pct; part.margin_usd = Math.round(p.margin_usd * pct * 100) / 100; part.partial_pct = Math.round(pct * 100);
        let ppnl = part.qty * (live - p.entry_price) * dir; if (ppnl < -part.margin_usd) ppnl = -part.margin_usd;
        part.status = 'closed'; part.exit_price = live; part.pnl_usd = Math.round(ppnl * 100) / 100; part.closed_ts = Date.now();
        p.qty = p.qty * (1 - pct); p.margin_usd = Math.round(p.margin_usd * (1 - pct) * 100) / 100;
        sql.exec('UPDATE botpos SET json=? WHERE id=?', JSON.stringify(p), p.id);
        sql.exec('INSERT INTO botpos(id,uid,json,status,ts) VALUES(?,?,?,?,?)', part.id, uid, JSON.stringify(part), 'closed', now);
        return this.j({ ok: true, closed: part, remaining: p });
      }
      const rows = this.rows('SELECT * FROM botpos WHERE uid=? ORDER BY ts DESC LIMIT 100', uid);
      const out = rows.map(r => { let p = {}; try { p = JSON.parse(r.json); } catch (e) {} const before = p.status; p = liqSweep(p); if (p.status !== before) sql.exec('UPDATE botpos SET json=?, status=? WHERE id=?', JSON.stringify(p), p.status, p.id); return mark(p); });
      return this.j({ positions: out });
    }
    if (path === '/track') { // worker forwards a signed-in user's pageview/event here (best-effort)
      const uid = String(b.uid || ''); if (!uid) return this.j({ ok: false });
      if (!this.rows('SELECT id FROM users WHERE id=?', uid)[0]) return this.j({ ok: false });
      const type = String(b.type || '').slice(0, 24), label = String(b.label || '').slice(0, 64), pth = String(b.path || '').slice(0, 60), cc = String(b.cc || '').slice(0, 4), dev = String(b.dev || '').slice(0, 12);
      sql.exec('INSERT INTO uevents(user_id,ts,type,label,path,cc,dev) VALUES(?,?,?,?,?,?,?)', uid, now, type, label, pth, cc, dev);
      sql.exec('UPDATE users SET last_seen=?, pv=pv+? WHERE id=?', now, type === 'pageview' ? 1 : 0, uid);
      sql.exec('DELETE FROM uevents WHERE user_id=? AND ts < (SELECT MIN(ts) FROM (SELECT ts FROM uevents WHERE user_id=? ORDER BY ts DESC LIMIT 120))', uid, uid); // keep newest ~120/user
      return this.j({ ok: true });
    }
    if (path === '/session') {
      const token = url.searchParams.get('token') || '';
      const s = this.rows('SELECT * FROM sessions WHERE token=?', token)[0];
      if (!s || now > s.expires) return this.j({ user: null });
      const u = this.rows('SELECT id,email,username,created,status,muted,restrictions FROM users WHERE id=?', s.user_id)[0];
      if (!u) return this.j({ user: null });
      if (u.status === 'banned') return this.j({ user: null, banned: true });
      return this.j({ user: { id: u.id, email: u.email, username: u.username || '', created: u.created, status: u.status || 'active', muted: !!u.muted, restrictions: u.restrictions || '' } });
    }
    if (path === '/profiles') { // internal: batch account-id → {username,email} for the admin reward views
      const ids = (Array.isArray(b && b.ids) ? b.ids : []).map(x => String(x)).filter(Boolean).slice(0, 600);
      const out = {};
      if (ids.length) { const ph = ids.map(() => '?').join(','); try { this.rows('SELECT id,email,username,tg_chat FROM users WHERE id IN (' + ph + ')', ...ids).forEach(u => { out[u.id] = { username: u.username || '', email: u.email || '', tg: !!u.tg_chat }; }); } catch (e) {} }
      return this.j({ profiles: out });
    }
    // ---- weekly digest opt-in ----
    if (path === '/digest/recipients') { return this.j({ users: this.rows("SELECT id,email FROM users WHERE COALESCE(digest,1)=1 AND COALESCE(status,'active')!='banned' AND email IS NOT NULL LIMIT 5000") }); } // internal: cron recipient list
    if (path === '/digest/optout') { const uid = String((b && b.uid) || url.searchParams.get('u') || ''); if (uid) sql.exec('UPDATE users SET digest=0 WHERE id=?', uid); return this.j({ ok: true }); }
    if (path === '/digest/set') { const tok = String((b && b.token) || ''); const ss = tok ? this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', tok, now)[0] : null; if (!ss) return this.j({ error: 'not_signed_in' }, 401); sql.exec('UPDATE users SET digest=? WHERE id=?', b.on ? 1 : 0, ss.user_id); return this.j({ ok: true }); }
    // ---- price alerts (account-based) ----
    if (path === '/alerts/active') { return this.j({ alerts: this.rows("SELECT a.id,a.uid,a.email,a.sym,a.dir,a.target,a.note,COALESCE(a.channel,'email') channel,u.tg_chat FROM alerts a LEFT JOIN users u ON u.id=a.uid WHERE a.active=1 LIMIT 5000") }); } // internal: cron reads every active alert (+ delivery channel & linked Telegram chat)
    if (path === '/tglink/set') { const uid = String((b && b.uid) || ''), chat = String((b && b.chat) || ''); if (uid && chat) sql.exec('UPDATE users SET tg_chat=? WHERE id=?', chat, uid); return this.j({ ok: true }); } // bot links a Telegram chat to an account
    if (path === '/alerts/tginfo') { const aTok = String((b && b.token) || url.searchParams.get('token') || ''); const aS = aTok ? this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', aTok, now)[0] : null; if (!aS) return this.j({ error: 'not_signed_in' }, 401); const u = this.rows('SELECT id,tg_chat FROM users WHERE id=?', aS.user_id)[0]; return this.j({ uid: u ? u.id : '', linked: !!(u && u.tg_chat) }); }
    if (path === '/alerts/fire') { const ids = Array.isArray(b.ids) ? b.ids : []; for (const id of ids) { try { sql.exec('UPDATE alerts SET active=0, fired_ts=? WHERE id=?', now, String(id)); } catch (e) {} } return this.j({ ok: true }); } // internal: cron marks fired
    if (path === '/alerts/list' || path === '/alerts/create' || path === '/alerts/delete' || path === '/alerts/tgunlink') {
      const aTok = String((b && b.token) || url.searchParams.get('token') || '');
      const aS = aTok ? this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', aTok, now)[0] : null;
      if (path === '/alerts/list') { if (!aS) return this.j({ alerts: [], tgLinked: false }); const tu = this.rows('SELECT tg_chat FROM users WHERE id=?', aS.user_id)[0]; return this.j({ tgLinked: !!(tu && tu.tg_chat), alerts: this.rows("SELECT id,sym,dir,target,note,active,created,fired_ts,COALESCE(channel,'email') channel FROM alerts WHERE uid=? ORDER BY active DESC, created DESC LIMIT 100", aS.user_id) }); }
      if (!aS) return this.j({ error: 'not_signed_in' }, 401);
      if (path === '/alerts/tgunlink') { sql.exec('UPDATE users SET tg_chat=NULL WHERE id=?', aS.user_id); return this.j({ ok: true }); }
      if (path === '/alerts/delete') { sql.exec('DELETE FROM alerts WHERE id=? AND uid=?', String(b.id || ''), aS.user_id); return this.j({ ok: true }); }
      // create
      const u = this.rows('SELECT id,email,tg_chat FROM users WHERE id=?', aS.user_id)[0]; if (!u) return this.j({ error: 'not_signed_in' }, 401);
      const sym = String(b.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12), dir = b.dir === 'down' ? 'down' : 'up', target = +b.target;
      const channel = b.channel === 'telegram' ? 'telegram' : 'email';
      if (!sym || !isFinite(target) || target <= 0) return this.j({ error: 'bad' }, 400);
      if (channel === 'telegram' && !u.tg_chat) return this.j({ error: 'tg_not_linked' }, 400); // can't deliver to Telegram until they connect the bot
      if (this.rows('SELECT COUNT(*) n FROM alerts WHERE uid=? AND active=1', u.id)[0].n >= 25) return this.j({ error: 'too_many' }, 400); // cap active alerts/account
      const id = this.rid();
      sql.exec('INSERT INTO alerts(id,uid,email,sym,dir,target,note,channel,active,created) VALUES(?,?,?,?,?,?,?,?,1,?)', id, u.id, u.email, sym, dir, target, String(b.note || '').slice(0, 80), channel, now);
      return this.j({ ok: true, id });
    }
    // ---- web push subscriptions ----
    if (path === '/push/save') {
      const aS = b.token ? this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', String(b.token), now)[0] : null;
      if (!aS) return this.j({ error: 'not_signed_in' }, 401);
      const ps = (b.sub) || {}, ep = String(ps.endpoint || ''), keys = ps.keys || {};
      if (!ep || !keys.p256dh || !keys.auth) return this.j({ error: 'bad' }, 400);
      sql.exec('INSERT INTO psubs(endpoint,uid,p256dh,auth,created) VALUES(?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET uid=excluded.uid,p256dh=excluded.p256dh,auth=excluded.auth', ep, aS.user_id, String(keys.p256dh), String(keys.auth), now);
      return this.j({ ok: true });
    }
    if (path === '/push/del') { sql.exec('DELETE FROM psubs WHERE endpoint=?', String(b.endpoint || '')); return this.j({ ok: true }); }
    if (path === '/push/has') { const aS = b.token ? this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', String(b.token), now)[0] : null; if (!aS) return this.j({ has: false }); return this.j({ has: this.rows('SELECT COUNT(*) n FROM psubs WHERE uid=?', aS.user_id)[0].n > 0 }); }
    if (path === '/push/byuid') { const uids = Array.isArray(b.uids) ? b.uids.map(String) : []; if (!uids.length) return this.j({ subs: [] }); const ph = uids.map(() => '?').join(','); return this.j({ subs: this.rows('SELECT endpoint,uid,p256dh,auth FROM psubs WHERE uid IN (' + ph + ')', ...uids) }); }
    if (path === '/username') { // user changes their OWN username (session-authenticated); enforces uniqueness
      const token = String(b.token || ''), uname = String(b.username || '').trim();
      const s = this.rows('SELECT user_id FROM sessions WHERE token=? AND expires>?', token, now)[0];
      if (!s) return this.j({ error: 'not_signed_in' });
      const cur = this.rows('SELECT username FROM users WHERE id=?', s.user_id)[0];
      if (cur && cur.username) return this.j({ error: 'already_set', username: cur.username }); // usernames are permanent once chosen (admin can still override via /control)
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(uname)) return this.j({ error: 'bad_username' });
      if (this.rows('SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id!=?', uname, s.user_id)[0]) return this.j({ error: 'taken' });
      sql.exec('UPDATE users SET username=? WHERE id=?', uname, s.user_id);
      return this.j({ ok: true, username: uname });
    }
    if (path === '/control') { // admin moderation actions
      const email = String(b.email || '').toLowerCase(), id0 = String(b.id || '');
      const u = email ? this.rows('SELECT * FROM users WHERE email=?', email)[0] : (id0 ? this.rows('SELECT * FROM users WHERE id=?', id0)[0] : null);
      if (!u) return this.j({ error: 'no_user' });
      const act = String(b.action || '');
      if (act === 'ban') { sql.exec("UPDATE users SET status='banned' WHERE id=?", u.id); sql.exec('DELETE FROM sessions WHERE user_id=?', u.id); }
      else if (act === 'unban' || act === 'activate') sql.exec("UPDATE users SET status='active',susp_until=0 WHERE id=?", u.id);
      else if (act === 'suspend') { const days = +b.days || 0; const until = days > 0 ? now + days * 86400000 : 0; sql.exec("UPDATE users SET status='suspended',susp_until=? WHERE id=?", until, u.id); sql.exec('DELETE FROM sessions WHERE user_id=?', u.id); }
      else if (act === 'mute') sql.exec('UPDATE users SET muted=1 WHERE id=?', u.id);
      else if (act === 'unmute') sql.exec('UPDATE users SET muted=0 WHERE id=?', u.id);
      else if (act === 'restrict') { const r = Array.isArray(b.restrictions) ? b.restrictions.filter(x => /^[a-z_]+$/.test(x)).slice(0, 10).join(',') : ''; sql.exec('UPDATE users SET restrictions=? WHERE id=?', r, u.id); }
      else if (act === 'note') sql.exec('UPDATE users SET note=? WHERE id=?', String(b.note || '').slice(0, 500), u.id);
      else if (act === 'username') { const un = String(b.username || '').trim(); if (un && !/^[a-zA-Z0-9_]{3,20}$/.test(un)) return this.j({ error: 'bad_username' }); if (un && this.rows('SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id!=?', un, u.id)[0]) return this.j({ error: 'taken' }); sql.exec('UPDATE users SET username=? WHERE id=?', un || null, u.id); }
      else if (act === 'logout_all') sql.exec('DELETE FROM sessions WHERE user_id=?', u.id);
      else if (act === 'revoke') sql.exec('DELETE FROM sessions WHERE user_id=? AND created=?', u.id, +b.created || 0);
      else if (act === 'delete') { for (const tb of ['users WHERE id', 'sessions WHERE user_id', 'uevents WHERE user_id', 'uclicks WHERE user_id', 'utrades WHERE user_id', 'udwell WHERE user_id']) sql.exec('DELETE FROM ' + tb + '=?', u.id); }
      else return this.j({ error: 'bad_action' });
      return this.j({ ok: true });
    }
    if (path === '/click') { // record a normalized click for the per-user heatmap (best-effort)
      const uid = String(b.uid || ''); if (!uid) return this.j({ ok: false });
      if (!this.rows('SELECT id FROM users WHERE id=?', uid)[0]) return this.j({ ok: false });
      const x = Math.max(0, Math.min(100, Math.round(+b.x || 0))), y = Math.max(0, Math.min(100, Math.round(+b.y || 0))), pth = String(b.path || '/').slice(0, 60);
      sql.exec('INSERT INTO uclicks(user_id,ts,x,y,path) VALUES(?,?,?,?,?)', uid, now, x, y, pth);
      sql.exec('DELETE FROM uclicks WHERE user_id=? AND ts < (SELECT MIN(ts) FROM (SELECT ts FROM uclicks WHERE user_id=? ORDER BY ts DESC LIMIT 300))', uid, uid);
      return this.j({ ok: true });
    }
    if (path === '/trades') { // signed-in user's paper-trade journal sync — MERGE with the stored set (union by trade id) so a stale device/browser can't wipe trades synced from another. A blind full-replace caused leaderboard entries to flicker on/off as two devices took turns overwriting each other.
      const uid = String(b.uid || ''); if (!uid) return this.j({ ok: false });
      if (!this.rows('SELECT id FROM users WHERE id=?', uid)[0]) return this.j({ ok: false });
      const incoming = Array.isArray(b.journal) ? b.journal : [];
      let stored = []; try { const r = this.rows('SELECT json FROM utrades WHERE user_id=?', uid)[0]; if (r && r.json) stored = JSON.parse(r.json) || []; } catch (e) {}
      const byId = new Map();
      const put = (e) => { if (!e || typeof e !== 'object') return; const id = String(e.id || ('_anon' + byId.size)); const prev = byId.get(id); if (!prev) { byId.set(id, e); return; } const prevClosed = prev.status === 'win' || prev.status === 'loss', curClosed = e.status === 'win' || e.status === 'loss'; if (curClosed || !prevClosed) byId.set(id, e); /* a CLOSED result wins over open; never let a stale 'open' overwrite a stored close */ };
      stored.forEach(put); incoming.forEach(put);                  // incoming applied last → wins same-state ties; stored-only trades are kept (anti-clobber)
      let arr = Array.from(byId.values());
      arr.sort((a, c) => ((+a.closeTs || +a.ts || 0) - (+c.closeTs || +c.ts || 0)));
      // Trim NEVER touches OPEN positions. The old oldest-first trim sorted opens by their open-ts,
      // so a burst of new trades silently guillotined week-old OPEN positions out of the blob
      // (2026-07-03: 5 open AIGENSYN shorts vanished this way after a 23-trade burst). Now: opens are
      // always kept; only CLOSED trades compete for the 100-row / 60KB budget, oldest dropped first.
      const isOpen = (e) => e && e.status !== 'win' && e.status !== 'loss';
      const opensArr = arr.filter(isOpen);
      let closed = arr.filter((e) => !isOpen(e));
      const CAP = 100;
      if (opensArr.length + closed.length > CAP) closed = closed.slice(-Math.max(0, CAP - opensArr.length));
      arr = opensArr.concat(closed).sort((a, c) => ((+a.closeTs || +a.ts || 0) - (+c.closeTs || +c.ts || 0)));
      let json = JSON.stringify(arr);
      while (json.length > 60000 && closed.length > 0) { closed = closed.slice(5); arr = opensArr.concat(closed).sort((a, c) => ((+a.closeTs || +a.ts || 0) - (+c.closeTs || +c.ts || 0))); json = JSON.stringify(arr); }
      let wins = 0, losses = 0, opens = 0, pnl = 0;
      arr.forEach(function (e) { const st = e && e.status; if (st === 'win') wins++; else if (st === 'loss') losses++; else opens++; const p = +(e && e.pnl); if ((st === 'win' || st === 'loss') && isFinite(p)) pnl += p; });
      sql.exec('INSERT INTO utrades(user_id,json,n,wins,losses,opens,pnl,updated) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET json=excluded.json,n=excluded.n,wins=excluded.wins,losses=excluded.losses,opens=excluded.opens,pnl=excluded.pnl,updated=excluded.updated', uid, json, arr.length, wins, losses, opens, pnl, now);
      return this.j({ ok: true });
    }
    if (path === '/gettrades') { // signed-in user's stored journal → a new device pulls it and merges into its local journal (cross-device sync)
      const uid = String(url.searchParams.get('uid') || ''); if (!uid) return this.j({ journal: [] });
      let journal = []; try { const r = this.rows('SELECT json FROM utrades WHERE user_id=?', uid)[0]; if (r && r.json) journal = JSON.parse(r.json) || []; } catch (e) {}
      return this.j({ journal: Array.isArray(journal) ? journal : [] });
    }
    if (path === '/dwell') { // time-on-page accumulator (beacon on hide/unload)
      const uid = String(b.uid || ''); if (!uid) return this.j({ ok: false });
      if (!this.rows('SELECT id FROM users WHERE id=?', uid)[0]) return this.j({ ok: false });
      const pth = String(b.path || '/').slice(0, 60), secs = Math.max(0, Math.min(86400, Math.round(+b.secs || 0)));
      if (secs <= 0) return this.j({ ok: true });
      sql.exec('INSERT INTO udwell(user_id,path,secs,hits,last) VALUES(?,?,?,1,?) ON CONFLICT(user_id,path) DO UPDATE SET secs=secs+?,hits=hits+1,last=?', uid, pth, secs, now, secs, now);
      sql.exec('UPDATE users SET last_seen=? WHERE id=?', now, uid);
      return this.j({ ok: true });
    }
    if (path === '/clicks') {
      const email = String(url.searchParams.get('email') || '').toLowerCase(), id0 = String(url.searchParams.get('id') || '');
      const u = email ? this.rows('SELECT id FROM users WHERE email=?', email)[0] : (id0 ? this.rows('SELECT id FROM users WHERE id=?', id0)[0] : null);
      if (!u) return this.j({ clicks: [], paths: [] });
      const clicks = this.rows('SELECT x,y,path FROM uclicks WHERE user_id=? ORDER BY ts DESC LIMIT 300', u.id);
      const pc = {}; clicks.forEach(c => { const p = c.path || '/'; pc[p] = (pc[p] || 0) + 1; });
      const paths = Object.keys(pc).map(p => ({ path: p, n: pc[p] })).sort((a, b) => b.n - a.n).slice(0, 12);
      return this.j({ clicks, paths });
    }
    if (path === '/logout') { sql.exec('DELETE FROM sessions WHERE token=?', String(b.token || '')); return this.j({ ok: true }); }
    if (path === '/admin') {
      const q = (url.searchParams.get('q') || '').toLowerCase().trim().slice(0, 80);
      const limit = Math.min(200, Math.max(1, +url.searchParams.get('limit') || 50));
      const offset = Math.max(0, +url.searchParams.get('offset') || 0);
      const dayMs = new Date(day).getTime();
      const total = (this.rows('SELECT COUNT(*) n FROM users')[0] || { n: 0 }).n;
      const newToday = (this.rows('SELECT COUNT(*) n FROM users WHERE created>=?', dayMs)[0] || { n: 0 }).n;
      const activeToday = (this.rows('SELECT COUNT(*) n FROM users WHERE last_seen>=?', dayMs)[0] || { n: 0 }).n;
      const cols = 'id,email,username,status,muted,created,last_login,last_seen,logins,pv,cc,dev,org,(SELECT n FROM utrades t WHERE t.user_id=users.id) AS trades';
      let users, matched;
      if (q) {
        users = this.rows('SELECT ' + cols + " FROM users WHERE LOWER(email) LIKE ? OR LOWER(username) LIKE ? ORDER BY created DESC LIMIT ? OFFSET ?", '%' + q + '%', '%' + q + '%', limit, offset);
        matched = (this.rows("SELECT COUNT(*) n FROM users WHERE LOWER(email) LIKE ? OR LOWER(username) LIKE ?", '%' + q + '%', '%' + q + '%')[0] || { n: 0 }).n;
      } else {
        users = this.rows('SELECT ' + cols + ' FROM users ORDER BY created DESC LIMIT ? OFFSET ?', limit, offset);
        matched = total;
      }
      users = users.map(u => ({ ...u, vpn: isVpnOrg(u.org) }));
      const banned = (this.rows("SELECT COUNT(*) n FROM users WHERE status='banned'")[0] || { n: 0 }).n;
      return this.j({ count: total, newToday, activeToday, matched, banned, limit, offset, users });
    }
    if (path === '/user') {
      const email = String(url.searchParams.get('email') || '').toLowerCase();
      const id0 = String(url.searchParams.get('id') || '');
      const uname = String(url.searchParams.get('username') || '').toLowerCase();
      const u = email ? this.rows('SELECT * FROM users WHERE email=?', email)[0] : (id0 ? this.rows('SELECT * FROM users WHERE id=?', id0)[0] : (uname ? this.rows('SELECT * FROM users WHERE LOWER(username)=?', uname)[0] : null));
      if (!u) return this.j({ exists: false });
      const sessions = this.rows('SELECT created,expires,ua,ip,cc,asn,org FROM sessions WHERE user_id=? ORDER BY created DESC LIMIT 25', u.id).map(s => ({ created: s.created, active: s.expires > now, ua: s.ua || '', cc: s.cc || '', ip: s.ip || '', asn: s.asn || 0, org: s.org || '', vpn: isVpnOrg(s.org) }));
      const events = this.rows('SELECT ts,type,label,path,cc,dev FROM uevents WHERE user_id=? ORDER BY ts DESC LIMIT 80', u.id);
      const evTotal = (this.rows('SELECT COUNT(*) n FROM uevents WHERE user_id=?', u.id)[0] || { n: 0 }).n;
      const clickTotal = (this.rows('SELECT COUNT(*) n FROM uclicks WHERE user_id=?', u.id)[0] || { n: 0 }).n;
      const tr = this.rows('SELECT json,n,wins,losses,opens,pnl FROM utrades WHERE user_id=?', u.id)[0];
      let trades = []; if (tr && tr.json) { try { trades = JSON.parse(tr.json); } catch (e) {} }
      const tradeSummary = tr ? { n: tr.n || 0, wins: tr.wins || 0, losses: tr.losses || 0, opens: tr.opens || 0, pnl: tr.pnl || 0 } : { n: 0, wins: 0, losses: 0, opens: 0, pnl: 0 };
      const dwell = this.rows('SELECT path,secs,hits,last FROM udwell WHERE user_id=? ORDER BY secs DESC LIMIT 40', u.id);
      const dwellTotal = (this.rows('SELECT COALESCE(SUM(secs),0) s FROM udwell WHERE user_id=?', u.id)[0] || { s: 0 }).s;
      return this.j({ exists: true, user: { id: u.id, email: u.email, username: u.username || '', status: u.status || 'active', susp_until: u.susp_until || 0, muted: !!u.muted, restrictions: u.restrictions || '', note: u.note || '', created: u.created, last_login: u.last_login, last_seen: u.last_seen || 0, logins: u.logins || 0, pv: u.pv || 0, cc: u.cc || '', dev: u.dev || '', br: u.br || '', ip: u.ip || '', org: u.org || '', asn: u.asn || 0, vpn: isVpnOrg(u.org) }, activeSessions: sessions.filter(s => s.active).length, sessions, events, evTotal, clickTotal, trades, tradeSummary, dwell, dwellTotal });
    }
    if (path === '/opentrades') { // admin Ops board: every signed-in user's OPEN paper positions, flattened + labeled with whose they are
      const rows = this.rows("SELECT u.id uid, u.email, u.username, u.cc, t.json, t.updated FROM utrades t JOIN users u ON u.id=t.user_id WHERE t.opens>0 ORDER BY t.updated DESC LIMIT 400");
      const positions = [];
      for (const r of rows) {
        let arr = []; try { arr = JSON.parse(r.json); } catch (e) {}
        if (!Array.isArray(arr)) continue;
        for (const e of arr) {
          if (!e || (e.status && e.status !== 'open')) continue;
          positions.push({ uid: r.uid, email: r.email, username: r.username || '', cc: r.cc || '', synced: r.updated, sym: e.sym, side: e.side, lev: e.lev, entry: e.entry, margin: e.margin, qty: e.qty, liq: e.liq, mmr: e.mmr, tp: e.tp, stop: e.stop, ts: e.ts });
          if (positions.length >= 600) break;
        }
        if (positions.length >= 600) break;
      }
      return this.j({ positions, traders: rows.length });
    }
    if (path === '/leaderboard') { // authoritative weekly Trade League — best CLOSED-trade ROE per signed-in user in [ws,we), straight from the synced journal
      const ws = +url.searchParams.get('ws') || 0, we = +url.searchParams.get('we') || (now + 1);
      const limit = Math.min(50, Math.max(1, +url.searchParams.get('limit') || 30));
      const rows = this.rows("SELECT u.id uid, u.username, t.json FROM utrades t JOIN users u ON u.id=t.user_id WHERE t.n>0 AND (u.status IS NULL OR u.status='active') ORDER BY t.updated DESC LIMIT 1000");
      const best = [];
      for (const r of rows) {
        let arr = []; try { arr = JSON.parse(r.json); } catch (e) {}
        if (!Array.isArray(arr)) continue;
        let top = null;
        for (const e of arr) {
          if (!e || (e.status !== 'win' && e.status !== 'loss')) continue;
          const ct = +e.closeTs; if (!isFinite(ct) || ct < ws || ct >= we) continue; // only trades CLOSED this week count
          const margin = +e.margin, pnl = +e.pnl; if (!(margin > 0) || !isFinite(pnl)) continue;
          let roe = pnl / margin * 100; if (!isFinite(roe)) continue;
          roe = Math.max(-100, Math.min(roe, 1000000)); // clamp absurd margins/pnl like the legacy path
          if (!top || roe > top.roe) top = { roe, pnl, symbol: String(e.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), side: e.side === 'short' ? 'short' : 'long' };
        }
        if (top) best.push({ uid: 'u:' + r.uid, name: String(r.username || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20), roe: top.roe, pnl: top.pnl, symbol: top.symbol, side: top.side });
      }
      best.sort((a, b) => b.roe - a.roe);
      return this.j({ top: best.slice(0, limit) });
    }
    if (path === '/lbhist') { // past N weeks of winners, reconstructed from the synced journals (each closed trade's closeTs buckets it into its week)
      const WK = 604800000, MON = 4 * 86400000;
      const curWeek = Math.floor((now - MON) / WK) * WK + MON;
      const nWeeks = Math.min(12, Math.max(1, +url.searchParams.get('weeks') || 8));
      const perWeek = []; for (let i = 0; i < nWeeks; i++) perWeek.push(new Map());
      const rows = this.rows("SELECT u.id uid, u.username, t.json FROM utrades t JOIN users u ON u.id=t.user_id WHERE t.n>0 AND (u.status IS NULL OR u.status='active') ORDER BY t.updated DESC LIMIT 1000");
      for (const r of rows) {
        let arr = []; try { arr = JSON.parse(r.json); } catch (e) {} if (!Array.isArray(arr)) continue;
        const name = String(r.username || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
        for (const e of arr) {
          if (!e || (e.status !== 'win' && e.status !== 'loss')) continue;
          const ct = +e.closeTs; if (!isFinite(ct)) continue;
          const weekOf = Math.floor((ct - MON) / WK) * WK + MON, idx = Math.round((curWeek - weekOf) / WK);
          if (idx < 0 || idx >= nWeeks) continue;
          const margin = +e.margin, pnl = +e.pnl; if (!(margin > 0) || !isFinite(pnl)) continue;
          let roe = pnl / margin * 100; if (!isFinite(roe)) continue; roe = Math.max(-100, Math.min(roe, 1000000));
          const m = perWeek[idx], prev = m.get(r.uid);
          if (!prev || roe > prev.roe) m.set(r.uid, { uid: 'u:' + r.uid, name, roe, pnl, symbol: String(e.sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10), side: e.side === 'short' ? 'short' : 'long' });
        }
      }
      const weeks = [];
      for (let i = 0; i < nWeeks; i++) { const ws = curWeek - i * WK; const top = Array.from(perWeek[i].values()).sort((a, b) => b.roe - a.roe).slice(0, 10); weeks.push({ weekStart: ws, weekEnd: ws + WK, current: i === 0, entries: perWeek[i].size, top }); }
      return this.j({ weeks });
    }
    return this.j({ error: 'not_found' }, 404);
  }
}
