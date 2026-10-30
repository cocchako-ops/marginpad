// Read-only HTTP API. The MarginPad site reaches this through a Cloudflare Worker proxy at
// /api/v1/liquidations/* (same-origin, cached, with graceful fallback). Versioned from day one.
import express from 'express';
import { config } from '../../config.js';
import { log } from '../logger.js';
import { getWhales, getWhaleOne } from '../whales.js';
import { getCatalysts, catalystStatus, ingestRows } from '../catalyst/index.js';
import { EXPORTS } from '../storage/sqlite.js';

// ---- tiny in-memory rate limiter (per IP per minute) ----
const hits = new Map();
function rateLimit(req, res, next) {
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  const now = Date.now();
  let h = hits.get(ip);
  if (!h || h.reset < now) { h = { count: 0, reset: now + config.api.rateLimit.windowMs }; hits.set(ip, h); }
  h.count++;
  if (h.count > config.api.rateLimit.max) return res.status(429).json({ error: 'rate_limited' });
  next();
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (v.reset < now) hits.delete(k); }, 60000).unref?.();

// ---- freemium SEAM (no paywall yet - just the clean hook) ----
// Later, gate (a) symbols beyond BTC/ETH, (b) windows > 24h, (c) realtime vs 5-min-delayed behind an API key.
function gate(req, { window } = {}) {
  const key = req.headers['x-api-key'];
  // TODO(freemium): if (!key && PREMIUM_SYMBOLS.has(symbol)) return { ok:false, status:402, reason:'upgrade' };
  // TODO(freemium): if (!key && window === '7d') return { ok:false, status:402, reason:'upgrade' };
  return { ok: true, tier: key ? 'keyed' : 'free' };
}

function resolveWindow(q) {
  if (q.minutes) return Math.min(Math.max(1, parseInt(q.minutes, 10) || 1440), config.maxWindowMinutes);
  const w = config.windows[q.window] || config.windows['24h'];
  return w;
}
function validSymbol(s) { return typeof s === 'string' && /^[A-Z0-9]{2,20}$/.test(s.toUpperCase()); } // any captured ticker

export function createApiServer({ storage, getStatus, bus, bookCols = [], tapeCols = [], bookMap = null }) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', config.api.corsOrigin);
    res.set('Access-Control-Allow-Headers', 'x-api-key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(rateLimit);

  // Histogram source for the chart (aggregated; cache-friendly).
  // Every read below goes through storage.async - the reader worker thread - so a slow query costs the
  // request latency, never the exchange sockets on the main thread.
  app.get('/api/v1/liquidations/recent', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    const g = gate(req, { window: req.query.window }); if (!g.ok) return res.status(g.status).json({ error: g.reason });
    const minutes = resolveWindow(req.query);
    try {
      const buckets = await storage.async.histogram(symbol, minutes);
      res.set('Cache-Control', `public, max-age=${config.api.aggCacheSeconds}`);
      res.json({ symbol, minutes, updatedAt: Date.now(), buckets });
    } catch (e) { log.error('recent failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // TIME series of liquidations per 5-min window (when, not where): [{t,long,short,longN,shortN}] over `minutes`.
  // Feeds the Ask AI liquidation-flow edge detector (long-cascade / sweep-of-low). Grouped on an indexed column,
  // so it is cheap even over the full agg_5m retention; its own clamp (up to 90d) rather than the chart windows.
  // symbol=ALL is the whole market (2026-10-19) - the only complete source for a 24h hour histogram.
  app.get('/api/v1/liqseries', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    const g = gate(req, {}); if (!g.ok) return res.status(g.status).json({ error: g.reason });
    const minutes = Math.min(Math.max(5, parseInt(req.query.minutes, 10) || 1440), 129600); // up to 90d (agg retention)
    try {
      const buckets = await storage.async.series(symbol, minutes);
      res.set('Cache-Control', `public, max-age=${config.api.aggCacheSeconds}`);
      res.json({ symbol, minutes, bucketMs: 300000, updatedAt: Date.now(), buckets });
    } catch (e) { log.error('liqseries failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Recent raw events for the live ticker + chart bubbles.
  app.get('/api/v1/liquidations/live', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const min = parseFloat(req.query.min) || 0;
    const since = Math.max(0, parseInt(req.query.since, 10) || 0);
    try {
      const events = await storage.async.live(symbol, limit, min, since);
      res.set('Cache-Control', 'public, max-age=3');
      // `complete` = the window asked for is fully contained in this answer (it did not hit the cap), so a caller
      // can state "every one today" instead of implying it.
      res.json({ symbol, events, since: since || undefined, complete: since > 0 ? events.length < limit : undefined });
    } catch (e) { log.error('live failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Market-wide recent liquidations (all symbols) - powers the global floating feed on the site.
  app.get('/api/v1/feed', async (req, res) => {
    const min = parseFloat(req.query.min) || 0;
    const since = parseInt(req.query.since, 10) || 0; // ms timestamp - backfill mode ("everything since UTC midnight")
    const cap = since > 0 ? 3000 : 200;               // a history pull may span the whole day; the live poll stays small
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, cap);
    try { const events = await storage.async.feed(min, limit, since); res.set('Cache-Control', since > 0 ? 'public, max-age=30' : 'public, max-age=2'); res.json({ events }); }
    catch (e) { log.error('feed failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Full-day raw dump for the R2 archive (worker cron, 1 call/day). Gated by EXPORT_KEY (droplet .env -
  // NOT in the repo, repo is public). Gzip CSV so a ~65k-row day ships as ~1MB. Completed UTC days only:
  // the archive must be immutable - a partial "today" would get overwritten logic on the worker side instead.
  // ONE EXPORT FOR EVERY DATASET (2026-10-28): `ds` picks a row of EXPORTS (storage/sqlite.js) - liquidations
  // (the default, byte-identical to the old export), agg5m, oi, funding_oi, whale_fills, whale_pos. A day older
  // than that dataset's retention answers 410 `pruned` so the archive can write it down as gone instead of
  // asking every ten minutes for ever; `x-rows`, `x-ds` and `x-cols` let the caller verify what it received.
  // `GET /api/v1/export?list=1` publishes the table itself (no key) so the worker and the e2e read ONE definition.
  const RET_DAYS = { raw: () => config.retentionDays, agg: () => config.aggRetentionDays || 90, hist: () => config.histRetentionDays || 14 };
  app.get('/api/v1/export', async (req, res) => {
    if (req.query.list) {
      const out = {}; for (const [k, v] of Object.entries(EXPORTS)) out[k] = { cols: v.cols, tsCol: v.tsCol, retentionDays: RET_DAYS[v.ret] ? RET_DAYS[v.ret]() : null };
      res.set('Cache-Control', 'public, max-age=300'); return res.json({ datasets: out });
    }
    const key = req.headers['x-export-key'] || '';
    if (!process.env.EXPORT_KEY || key !== process.env.EXPORT_KEY) return res.status(403).json({ error: 'forbidden' });
    const ds = String(req.query.ds || 'liquidations');
    const spec = EXPORTS[ds];
    if (!spec) return res.status(400).json({ error: 'bad_dataset', datasets: Object.keys(EXPORTS) });
    const day = String(req.query.day || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ error: 'bad_day' });
    const d0 = Date.parse(day + 'T00:00:00Z');
    if (!isFinite(d0) || d0 + 86400000 > Date.now()) return res.status(400).json({ error: 'day_not_complete' });
    const retDays = RET_DAYS[spec.ret] ? RET_DAYS[spec.ret]() : 0;
    // the prune deletes rows older than NOW - retention, so a day whose START is past that line is already partial
    if (retDays > 0 && d0 < Date.now() - retDays * 86400000) return res.status(410).json({ error: 'pruned', ds, day, retentionDays: retDays });
    try {
      const { rows, gz } = await storage.async.exportGz(ds, d0, d0 + 86400000);
      res.set({ 'Content-Type': 'application/gzip', 'Cache-Control': 'no-store', 'x-rows': String(rows), 'x-ds': ds, 'x-cols': spec.cols, 'x-retention-days': String(retDays) });
      res.send(Buffer.from(gz));
    } catch (e) { log.error('export failed', { ds, e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // aggregated liquidation market pulse (heatmap page bottom section): 1h/4h/12h/24h totals + per-coin + per-exchange
  app.get('/api/v1/pulse', async (req, res) => {
    try {
      const now = Date.now(), out = {};
      for (const [k, h] of [['h1', 1], ['h4', 4], ['h12', 12], ['h24', 24]]) out[k] = await storage.async.pulse(now - h * 3600000);
      res.set('Cache-Control', 'public, max-age=45');
      res.json(out);
    } catch (e) { log.error('pulse failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Server-Sent Events: push new liquidations to connected browsers for a live feel.
  app.get('/api/v1/liquidations/stream', (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    const allSyms = symbol === 'ALL'; // firehose mode (Rekt live push) - every symbol, optional min notional
    if (!allSyms && !validSymbol(symbol)) return res.status(400).end();
    const min = Math.max(0, parseFloat(req.query.min) || 0);
    // X-Accel-Buffering: nginx fronts this - without it proxy buffering holds SSE events back
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': config.api.corsOrigin, 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    res.write(`event: hello\ndata: ${JSON.stringify({ symbol })}\n\n`);
    const onLiq = (e) => { if ((allSyms || e.symbol === symbol) && e.notional >= min) res.write(`data: ${JSON.stringify(e)}\n\n`); };
    bus.on('liq', onLiq);
    const ka = setInterval(() => res.write('event: ping\ndata: 1\n\n'), 20000); // named event (not a comment) so clients can track stream liveness
    req.on('close', () => { clearInterval(ka); bus.off('liq', onLiq); });
  });

  // Phase 2: estimated liquidation clusters (a MODEL - UI must label it as such).
  app.get('/api/v1/clusters', async (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    try {
      const clusters = await storage.async.getClusters(symbol);
      res.set('Cache-Control', 'public, max-age=20');
      res.json({ symbol, model: true, updatedAt: Date.now(), clusters });
    } catch (e) { log.error('clusters failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Perp tickers from venues that 403-ban Cloudflare's shared edge IPs (Binance, Bitget) - fetched here from the VPS
  // (a normal residential/datacenter IP that ISN'T banned) so the site's screener can aggregate them too. Normalized to
  // the screener's shape; cached in-memory ~30s so the upstreams aren't hammered (the Worker also edge-caches this).
  let _perpCache = { ts: 0, data: null };
  // screener enrichment: per-symbol 24h liquidations (OUR unique dataset) + OI Δ24h from hourly snapshots
  app.get('/api/v1/screener-extra', async (req, res) => {
    try {
      const liq = {};
      (await storage.async.liqBySymbol(Date.now() - 86400000)).forEach((r) => { liq[r.s] = { liq: Math.round(r.liq), long: Math.round(r.lng), n: r.n }; });
      const oi = await storage.async.oi24h();
      res.set('Cache-Control', 'public, max-age=120');
      res.json({ updatedAt: Date.now(), oi, liq });
    } catch (e) { log.error('screener-extra failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });
  app.get('/api/v1/perp-tickers', async (req, res) => {
    const now = Date.now();
    if (_perpCache.data && now - _perpCache.ts < 30000) {
      res.set('Cache-Control', 'public, max-age=30');
      return res.json(_perpCache.data);
    }
    const out = { updatedAt: now, binance: [], bitget: [] };
    try { // Binance USDT-M futures: 24h tickers (quoteVolume = USD vol) + funding (premiumIndex)
      const [tk, pm] = await Promise.all([
        fetch('https://fapi.binance.com/fapi/v1/ticker/24hr').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('https://fapi.binance.com/fapi/v1/premiumIndex').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      const fmap = {};
      if (Array.isArray(pm)) for (const p of pm) fmap[p.symbol] = +p.lastFundingRate;
      if (Array.isArray(tk)) for (const t of tk) {
        if (!/^[A-Z0-9]+USDT$/.test(t.symbol)) continue;
        const f = fmap[t.symbol];
        out.binance.push({ s: t.symbol.replace(/USDT$/, ''), p: +t.lastPrice, vol: +t.quoteVolume, chg: +t.priceChangePercent, f: (f != null && isFinite(f)) ? f * 100 : null, oi: 0, hi: +t.highPrice, lo: +t.lowPrice });
      }
    } catch (e) { log.error('binance perp failed', { e: String(e) }); }
    try { // Bitget USDT-perp (usdtVolume = USD vol; holdingAmount = OI in base)
      const j = await fetch('https://api.bitget.com/api/v2/mix/market/tickers?productType=usdt-futures').then(r => r.ok ? r.json() : null).catch(() => null);
      const list = j && Array.isArray(j.data) ? j.data : [];
      for (const t of list) {
        if (!/^[A-Z0-9]+USDT$/.test(t.symbol || '')) continue;
        const px = +t.lastPr;
        out.bitget.push({ s: t.symbol.replace(/USDT$/, ''), p: px, vol: +t.usdtVolume, chg: (t.change24h != null ? +t.change24h * 100 : null), f: (t.fundingRate != null ? +t.fundingRate * 100 : null), oi: (+t.holdingAmount) * px, hi: +t.high24h, lo: +t.low24h });
      }
    } catch (e) { log.error('bitget perp failed', { e: String(e) }); }
    _perpCache = { ts: now, data: out };
    res.set('Cache-Control', 'public, max-age=30');
    res.json(out);
  });

  // ---- Binance REST proxy (2026-07-24) - Cloudflare Workers can't reach Binance (403 on CF egress IPs),
  // this droplet can. STRICT whitelist of read-only market-data paths + 5s in-memory cache so the worker's
  // edge cache + this cache together keep us far under Binance's 1200 weight/min. No account/trade paths, ever.
  const BNC_ALLOW = /^\/(api\/v3\/(time|ticker\/24hr|ticker\/price|klines|depth|exchangeInfo)|fapi\/v1\/(ticker\/price|ticker\/24hr|premiumIndex|openInterest|klines|fundingRate)|futures\/data\/(openInterestHist|globalLongShortAccountRatio|topLongShortPositionRatio))$/;
  const bncCache = new Map(); // key -> {t, status, body}
  setInterval(() => { const c = Date.now() - 30000; for (const [k, v] of bncCache) if (v.t < c) bncCache.delete(k); }, 30000).unref?.();
  app.get('/api/v1/bnc', async (req, res) => {
    const p = String(req.query.path || '');
    if (!BNC_ALLOW.test(p)) return res.status(400).json({ error: 'path_not_allowed' });
    const qs = Object.entries(req.query).filter(([k]) => k !== 'path').map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&');
    const host = p.startsWith('/fapi') || p.startsWith('/futures') ? 'https://fapi.binance.com' : 'https://api.binance.com';
    const url = host + p + (qs ? '?' + qs : '');
    const hitB = bncCache.get(url);
    if (hitB && Date.now() - hitB.t < 5000) { res.set('Cache-Control', 'public, max-age=5'); res.set('x-bnc-cache', 'hit'); return res.status(hitB.status).type('application/json').send(hitB.body); }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
      const body = await r.text();
      if (r.status === 200) bncCache.set(url, { t: Date.now(), status: r.status, body });
      res.set('Cache-Control', 'public, max-age=5');
      return res.status(r.status).type('application/json').send(body);
    } catch (e) { return res.status(502).json({ error: 'binance_unreachable', detail: String(e).slice(0, 120) }); }
  });

  // OKX proxy (2026-08-22): the rubik stats endpoints reject Cloudflare-Worker IPs (market-data
  // endpoints do not), so the worker reaches them through this box. Strict allowlist, same
  // short-cache pattern as /api/v1/bnc.
  const OKX_ALLOW = /^\/api\/v5\/rubik\/stat\/contracts\/(long-short-account-ratio|open-interest-volume)$/;
  const okxCache = new Map();
  setInterval(() => { const c = Date.now() - 60000; for (const [k, v] of okxCache) if (v.t < c) okxCache.delete(k); }, 60000).unref?.();
  app.get('/api/v1/okx', async (req, res) => {
    const p2 = String(req.query.path || '');
    if (!OKX_ALLOW.test(p2)) return res.status(400).json({ error: 'path_not_allowed' });
    const qs = Object.entries(req.query).filter(([k]) => k !== 'path').map(([k, v]) => k + '=' + encodeURIComponent(String(v))).join('&');
    const url = 'https://www.okx.com' + p2 + (qs ? '?' + qs : '');
    const hitO = okxCache.get(url);
    if (hitO && Date.now() - hitO.t < 30000) { res.set('Cache-Control', 'public, max-age=30'); res.set('x-okx-cache', 'hit'); return res.status(hitO.status).type('application/json').send(hitO.body); }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
      const body = await r.text();
      if (r.status === 200) okxCache.set(url, { t: Date.now(), status: r.status, body });
      res.set('Cache-Control', 'public, max-age=30');
      return res.status(r.status).type('application/json').send(body);
    } catch (e) { return res.status(502).json({ error: 'okx_unreachable', detail: String(e).slice(0, 120) }); }
  });

  // LATAM quotes proxy (2026-09-07): CriptoYa (ARS/BRL per-exchange quotes) answers Cloudflare Workers with
  // error 1106 and awesomeapi (USD/BRL comercial) rate-limits the shared CF egress - this box reaches both.
  // Strict whitelist of read-only paths, 60 s cache for quotes, 300 s for the dollar; the worker adds its own edge
  // cache + KV last-good on top, so the upstreams see a handful of requests per minute at most.
  const CY_ALLOW = /^\/(dolar|usdt\/ars\/1|usdt\/brl\/1|btc\/brl\/1|usdc\/ars\/1)$/;
  const latamCache = new Map();
  setInterval(() => { const c = Date.now() - 600000; for (const [k, v] of latamCache) if (v.t < c) latamCache.delete(k); }, 120000).unref?.();
  app.get('/api/v1/latam', async (req, res) => {
    const src = String(req.query.src || 'cy'), p3 = String(req.query.path || '');
    let url, ttl;
    if (src === 'usdbrl') { url = 'https://economia.awesomeapi.com.br/last/USD-BRL'; ttl = 300000; }
    else { if (!CY_ALLOW.test(p3)) return res.status(400).json({ error: 'path_not_allowed' }); url = 'https://criptoya.com/api' + p3; ttl = 60000; }
    const hitL = latamCache.get(url);
    if (hitL && Date.now() - hitL.t < ttl) { res.set('Cache-Control', 'public, max-age=' + Math.round(ttl / 1000)); res.set('x-latam-cache', 'hit'); return res.status(hitL.status).type('application/json').send(hitL.body); }
    try {
      let r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { accept: 'application/json', 'user-agent': 'MarginPad/1.0 (+https://marginpad.io)' } });
      let body = await r.text(), status = r.status;
      if (src === 'usdbrl' && status !== 200) { // awesomeapi quota (429 even from here) -> Banco Central PTAX (official, daily, no key): normalised to the same shape
        try {
          const dd = (d) => { const x = new Date(d); return String(x.getUTCMonth() + 1).padStart(2, '0') + '-' + String(x.getUTCDate()).padStart(2, '0') + '-' + x.getUTCFullYear(); };
          const bu = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)?@dataInicial='" + dd(Date.now() - 10 * 86400000) + "'&@dataFinalCotacao='" + dd(Date.now()) + "'&$top=100&$format=json";
          const br = await fetch(bu, { signal: AbortSignal.timeout(9000), headers: { accept: 'application/json' } });
          const bj = await br.json(); const rows = (bj && bj.value || []).filter(x => +x.cotacaoCompra > 0).sort((a, b) => String(b.dataHoraCotacao).localeCompare(String(a.dataHoraCotacao)));
          if (rows.length) { const q = rows[0]; body = JSON.stringify({ USDBRL: { code: 'USD', codein: 'BRL', name: 'Dólar PTAX (Banco Central)', bid: String(q.cotacaoCompra), ask: String(q.cotacaoVenda), timestamp: String(Math.round(new Date(String(q.dataHoraCotacao).replace(' ', 'T') + 'Z').getTime() / 1000)), src: 'ptax' } }); status = 200; }
        } catch (e) {}
      }
      if (status === 200) latamCache.set(url, { t: Date.now(), status, body });
      else if (hitL) { res.set('x-latam-cache', 'stale'); return res.status(200).type('application/json').send(hitL.body); } // upstream hiccup: serve the last good body rather than the error
      res.set('Cache-Control', 'public, max-age=' + Math.round(ttl / 1000));
      return res.status(status).type('application/json').send(body);
    } catch (e) { if (hitL) { res.set('x-latam-cache', 'stale'); return res.status(200).type('application/json').send(hitL.body); } return res.status(502).json({ error: 'latam_unreachable', detail: String(e).slice(0, 120) }); }
  });

  // GeckoTerminal read-only proxy (2026-09-10). GT 429s Cloudflare's SHARED egress hard: measured on production,
  // a contract lookup for a coin minted minutes earlier answered 503 busy on three tries in a row while the same
  // address resolved instantly from here. Same reason /api/v1/latam exists for CriptoYa. Whitelisted to the two
  // read paths the worker needs, cached 45 s in memory, no keys involved.
  // tokens + pools + the pool's CANDLES. The candles were left out on the first pass and it cost every meme its
  // chart: GT 429s the worker, the worker asked here, and here refused the path - /api/spot/memechart returned
  // zero bars for BONK as well as for a coin minted minutes ago (measured 2026-09-10).
  // Pool ids run to 70 chars (a Uniswap v4 pool ID is 0x + 64 hex) and GT network ids carry _ and - (polygon_pos, sui-network) - 2026-10-22, the same regex the worker uses.
  const GT_ALLOW = /^\/networks\/[a-z0-9_-]+\/(tokens\/[A-Za-z0-9]{20,70}(\?include=top_pools)?|pools\/[A-Za-z0-9]{20,70}(\/ohlcv\/(minute|hour|day)\?aggregate=\d{1,3}&limit=\d{1,4})?)$/;
  const gtCache = new Map();
  setInterval(() => { const c = Date.now() - 300000; for (const [k, v] of gtCache) if (v.t < c) gtCache.delete(k); }, 120000).unref?.();
  // COINGECKO THROUGH THE DROPLET (2026-09-30). CoinGecko answers the Cloudflare Worker egress with a 403 and
  // an HTML body - a WAF block, not a rejected key (the demo key is set and sent). The screener lost every coin
  // icon to it. Same escape hatch as /api/v1/latam for CriptoYa and /api/v1/dex for GeckoTerminal: the VPS is
  // not on a blocked range. Tight allowlist, its own cache, and a stale copy served when upstream is unhappy.
  // + ONCHAIN candles (2026-10-22): GeckoTerminal's own OHLCV behind the CoinGecko demo key - the worker forwards its key in x-cg-demo-api-key because this box holds none;
  // the Demo Spot chart falls back to it when GT rate-limits both the Worker egress and this droplet. Only the OHLCV path, nothing else from /onchain.
  const CG_ALLOW = /^\/(coins\/markets\?[A-Za-z0-9_=&,%.-]{0,240}|global|search\/trending|onchain\/networks\/[a-z0-9_-]+\/pools\/[A-Za-z0-9]{20,70}\/ohlcv\/(minute|hour|day)\?aggregate=\d{1,3}&limit=\d{1,4})$/;
  const cgCache = new Map();
  setInterval(() => { const c9 = Date.now() - 3600000; for (const [k, v] of cgCache) if (v.t < c9) cgCache.delete(k); }, 300000).unref?.();
  app.get('/api/v1/cg', async (req, res) => {
    const p9 = String(req.query.path || '');
    if (!CG_ALLOW.test(p9)) return res.status(400).json({ error: 'path_not_allowed' });
    const url = 'https://api.coingecko.com/api/v3' + p9, ttl = p9.indexOf('/onchain/') === 0 ? 60000 : 300000; // candles go stale in a minute; markets/global keep the five
    const hit = cgCache.get(url);
    if (hit && Date.now() - hit.t < ttl) { res.set('Cache-Control', 'public, max-age=120'); res.set('x-cg-cache', 'hit'); return res.status(hit.status).type('application/json').send(hit.body); }
    try {
      const h9 = { accept: 'application/json', 'user-agent': 'MarginPad/1.0 (+https://marginpad.io)' };
      const fwdKey = String(req.get('x-cg-demo-api-key') || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80); // the worker's key, forwarded - never logged, never cached by key
      if (fwdKey) h9['x-cg-demo-api-key'] = fwdKey; else if (process.env.COINGECKO_API_KEY) h9['x-cg-demo-api-key'] = process.env.COINGECKO_API_KEY;
      const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: h9 });
      const body = await r.text();
      if (r.status === 200) cgCache.set(url, { t: Date.now(), status: r.status, body });
      else if (hit) { res.set('x-cg-cache', 'stale'); return res.status(200).type('application/json').send(hit.body); }
      res.set('Cache-Control', 'public, max-age=120');
      return res.status(r.status).type('application/json').send(body);
    } catch (e) { if (hit) { res.set('x-cg-cache', 'stale'); return res.status(200).type('application/json').send(hit.body); } return res.status(502).json({ error: 'cg_unreachable' }); }
  });
  app.get('/api/v1/dex', async (req, res) => {
    const p4 = String(req.query.path || '');
    if (!GT_ALLOW.test(p4)) return res.status(400).json({ error: 'path_not_allowed' });
    const url = 'https://api.geckoterminal.com/api/v2' + p4, ttl = 45000;
    const hit = gtCache.get(url);
    if (hit && Date.now() - hit.t < ttl) { res.set('Cache-Control', 'public, max-age=45'); res.set('x-dex-cache', 'hit'); return res.status(hit.status).type('application/json').send(hit.body); }
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { accept: 'application/json', 'user-agent': 'MarginPad/1.0 (+https://marginpad.io)' } });
      const body = await r.text();
      if (r.status === 200) gtCache.set(url, { t: Date.now(), status: r.status, body });
      else if (hit) { res.set('x-dex-cache', 'stale'); return res.status(200).type('application/json').send(hit.body); }
      res.set('Cache-Control', 'public, max-age=45');
      return res.status(r.status).type('application/json').send(body);
    } catch (e) { if (hit) { res.set('x-dex-cache', 'stale'); return res.status(200).type('application/json').send(hit.body); } return res.status(502).json({ error: 'dex_unreachable', detail: String(e).slice(0, 120) }); }
  });

  // Hyperliquid whale tracker (phase D): biggest open positions + recent changes, from src/whales.js
  app.get('/api/v1/whales', (req, res) => {
    try { res.set('Cache-Control', 'public, max-age=60'); res.json(getWhales()); }
    catch (e) { res.status(500).json({ error: 'server' }); }
  });

  // ONE WALLET'S OWN TRADES (2026-10-28). The ring above is the whole market's last couple of hours, so
  // filtering it by address answers "nothing" for a wallet that traded this morning - a retention gap,
  // not a polling one. This is per-wallet history, asked for only by the profile route.
  app.get('/api/v1/whale', (req, res) => {
    const a = String(req.query.a || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return res.status(400).json({ error: 'bad_address' });
    try { res.set('Cache-Control', 'public, max-age=30'); res.json(getWhaleOne(a)); }
    catch (e) { res.status(500).json({ error: 'server' }); }
  });

  // ORDER BOOK (2026-09-21). Live only - nothing is stored yet, by design. A book that cannot be proven
  // correct is not served at all: the collector returns null for it and this answers 404 rather than
  // handing back a plausible wrong number, which is the entire discipline of the module behind it.
  app.get('/api/v1/book', (req, res) => {
    const sym = String(req.query.symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const want = String(req.query.venue || '').toLowerCase();
    // Opt-in raw levels, for an order-book LADDER (price / size / running total) rather than a curve.
    // Capped, so nobody can ask this droplet to serialise a thousand levels across five venues per poll.
    const topN = Math.min(60, Math.max(0, +req.query.levels || 0));
    const out = {};
    for (const c of bookCols) {
      if (want && c.venue !== want) continue;
      const s = c.read(sym, topN);
      if (s) out[c.venue] = s;
    }
    res.set('Cache-Control', 'public, max-age=2');
    if (!Object.keys(out).length) return res.status(404).json({ error: 'no_valid_book', symbol: sym });
    // Depth summed across venues. A trader does not care which exchange holds the bid - what matters is
    // how much is standing in total within reach of the price.
    const agg = { bidUsd: {}, askUsd: {} };
    for (const v of Object.values(out)) {
      for (const [k, val] of Object.entries(v.depthUsd)) {
        const side = k.startsWith('bid') ? 'bidUsd' : 'askUsd';
        const bp = k.split('_')[1];
        agg[side][bp] = (agg[side][bp] || 0) + val;
      }
    }
    // WHAT WE TRACK, BESIDE WHAT ANSWERED. Without this the page could only count what came back and
    // printed "4 of 4" while a venue was resyncing - which reads as "we only ever had four" rather than
    // "one is briefly away". Named, a reader can see it is Binance and that it is coming back.
    const tracked = bookCols.filter((c) => !want || c.venue === want).map((c) => c.venue);
    const missing = tracked.filter((v) => !out[v]);
    res.json({
      symbol: sym, ts: Date.now(), venues: out, consolidatedDepthUsd: agg,
      tracked,
      missing: missing.map((v) => {
        const c = bookCols.filter((x) => x.venue === v)[0];
        const st = c && c.bookState ? c.bookState(sym) : null;
        return { venue: v, state: st || 'resyncing' };
      }),
    });
  });

  // HOW MUCH REALLY LIQUIDATED IN THESE WINDOWS. The liquidation MODEL lives in the worker's KV and the
  // liquidation RECORD lives here, so neither side can calibrate one against the other alone. This is the
  // bridge: a list of price-and-time windows in, the measured dollars out, one request instead of four
  // hundred. It exists so the map can say what a band of a given weight has HISTORICALLY liquidated -
  // a measurement with an n behind it - rather than printing the model's own units as if they were money.
  app.post('/api/v1/liqsum', express.json({ limit: '256kb' }), async (req, res) => {
    const sym = String((req.body && req.body.symbol) || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const wins = Array.isArray(req.body && req.body.wins) ? req.body.wins.slice(0, 500) : [];
    if (!wins.length) return res.status(400).json({ error: 'no_windows' });
    try {
      const out = await storage.async.liqSum(sym, wins);
      res.set('Cache-Control', 'no-store');
      res.json({ symbol: sym, n: out.length, sums: out });
    } catch (e) { log.error('liqsum failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // THE BOOK OVER TIME. Price bucketed against the shared mid every few seconds, plus the walls standing
  // now and the ones that have just gone - each marked eaten or pulled by what the tape did at its price.
  app.get('/api/v1/bookmap', (req, res) => {
    if (!bookMap) return res.status(404).json({ error: 'not_enabled' });
    const sym = String(req.query.symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const mins = Math.min(20, Math.max(1, +req.query.mins || 20));
    const out = bookMap.read(sym, { mins, back: Math.min(20, Math.max(0, +req.query.back || 0)), band: String(req.query.band || '') === 'wide' ? 'wide' : 'near', venue: String(req.query.venue || '').toLowerCase().replace(/[^a-z]/g, '') });
    // WALLS ONLY. The film is a few hundred kilobytes and a caller that wants the walls - the chart
    // assistant's brief, an alert, a bot - should not have to download it, decode it and throw it away.
    // Measured: the assistant's 1.5s budget could not finish the full read, so it was told there were no
    // walls on a coin that had four.
    if (String(req.query.only || '') === 'walls' && out) {
      delete out.cols;
      out.only = 'walls';
    }
    if (!out) { res.set('Cache-Control', 'public, max-age=3'); return res.json({ symbol: sym, ts: Date.now(), building: true, cols: [], wallsStanding: [], wallsFinished: [], note: 'the film starts empty after a restart and fills within a few seconds' }); }
    res.set('Cache-Control', 'public, max-age=3');
    res.json(out);
  });

  // TRADE TAPE. The book says what is standing; this says what was executed, and `side` is always the
  // AGGRESSOR - the side that crossed the spread - never merely "a buyer existed".
  app.get('/api/v1/tape', (req, res) => {
    const sym = String(req.query.symbol || 'BTC').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const want = String(req.query.venue || '').toLowerCase();
    const n = Math.min(500, Math.max(1, +req.query.limit || 100));
    const trades = [], delta = {};
    let bigOldest = null, bigFloorUsd = 0;
    for (const c of tapeCols) {
      if (want && c.venue !== want) continue;
      const rows = c.read(sym, n);
      if (rows) trades.push(...rows);
      const d = c.delta(sym);
      if (d) delta[c.venue] = d;
    }
    res.set('Cache-Control', 'public, max-age=2');
    if (!trades.length) return res.status(404).json({ error: 'no_trades', symbol: sym });
    trades.sort((a, b) => a.ts - b.ts);
    const tot = Object.values(delta).reduce((s, d) => ({
      buyUsd: s.buyUsd + d.buyUsd, sellUsd: s.sellUsd + d.sellUsd, trades: s.trades + d.trades,
    }), { buyUsd: 0, sellUsd: 0, trades: 0 });
    res.json({
      symbol: sym, ts: Date.now(),
      note: 'side is the AGGRESSOR - the taker that crossed the spread.',
      trades: trades.slice(Math.max(0, trades.length - n)),
      deltaByVenue: delta,
      // The COMPLETED minutes, so a page can draw the shape of the flow. deltaThisMinute alone is
      // meaningless three seconds into a minute, which is most of the time somebody looks at it.
      minutes: (function () {
        const by = new Map();
        for (const c of tapeCols) {
          if (want && c.venue !== want) continue;
          for (const m of (c.minutes ? c.minutes(sym, 30) : [])) {
            const k = m.minute;
            let a = by.get(k);
            if (!a) { a = { minute: k, trades: 0, buyUsd: 0, sellUsd: 0, deltaUsd: 0, partial: !!m.partial }; by.set(k, a); }
            a.trades += m.trades; a.buyUsd += m.buyUsd; a.sellUsd += m.sellUsd; a.deltaUsd += m.deltaUsd;
            if (m.partial) a.partial = true;
          }
        }
        return [...by.values()].sort((x, y) => x.minute - y.minute);
      })(),
      deltaThisMinute: { ...tot, deltaUsd: Math.round(tot.buyUsd - tot.sellUsd) },
      get bigWatchedSinceMs() { return bigOldest; },
      get bigRingFloorUsd() { return bigFloorUsd; },
      // THE LARGE PRINTS, KEPT FAR LONGER THAN THE LIVE RING. `trades` above is every print, so on BTC it
      // spans about half a minute - which means a reader filtering for $250k orders is shown an empty list
      // almost always, not because none happened but because the window is sized for every $9 trade. These
      // are the same rows, retained on their own, so a size filter answers with the last real ones.
      // `bigmin` lets the caller say what it is actually filtering for. Without it a $250k filter is
      // served 300 rows that start at $50k, of which two dozen qualify - never empty, but reaching back
      // only a couple of minutes. Asked for its own floor, the same ring answers with 300 rows that ALL
      // qualify, so the deepest filter reaches back furthest instead of shallowest.
      big: (function () {
        const floor = Math.max(0, +req.query.bigmin || 0);
        // WHICH RING ANSWERS DEPENDS ON WHAT WAS ASKED FOR. The $50k ring is count-capped and spans about
        // twelve minutes, which is right for a $50k filter and useless for a $1M one - measured, it held
        // exactly two prints that big. Above half a million the long ring answers instead and reaches
        // back hours, so the biggest filters show a real recent history rather than an empty box.
        // THREE RINGS, AND ALL THREE ARE USED. The first cut only ever reached for two, so a $250k filter was
        // answered by the $50k ring: 7 rows reaching back three minutes, measured, when the mid ring holds
        // 1,500 rows over three hours and exists for exactly this question.
        const tier = floor >= 500000 ? 'huge' : floor >= 150000 ? 'mid' : 'big';
        let rows = [];
        for (const c of tapeCols) {
          if (want && c.venue !== want) continue;
          if (tier === 'huge' && c.hugePrints) rows.push(...c.hugePrints(sym, 400));
          else if (tier === 'mid' && c.midPrints) rows.push(...c.midPrints(sym, 400));
          else if (c.big) rows.push(...c.big(sym, 400));
        }
        bigOldest = rows.length ? Math.min.apply(null, rows.map((r) => r.ts)) : null;
        // WHAT THE RING THAT ANSWERED ACTUALLY HOLDS. This line once read `tier` while the selector above was
        // called `deep` - a name left behind by an earlier draft - so every /api/v1/tape call threw
        // ReferenceError, express 500'd, the error was uncaught, and pm2 restarted the process. 85 restarts,
        // with the tape, the order book, the film and the liquidation feed all dark behind it. It is derived
        // from the ring that was actually read now, so the two can never drift apart again.
        bigFloorUsd = tier === 'huge' ? 1000000 : tier === 'mid' ? 250000 : 50000;
        if (floor > 0) rows = rows.filter((r) => (+r.usd || 0) >= floor);
        rows.sort((a, b) => a.ts - b.ts);
        return rows.slice(Math.max(0, rows.length - 300));
      })(),
    });
  });

  // Health - per-exchange socket state, last event, events/min. Check it from your phone.
  app.get('/api/v1/status', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const st = getStatus();
    try { st.db = await storage.async.stats(); } catch (e) { st.db = { error: String(e && e.message || e) }; }
    st.reader = storage.async.readerStats ? storage.async.readerStats() : null;
    res.json(st);
  });
  app.get('/api/v1/health', (req, res) => res.json({ ok: true }));

  // CATALYST ENGINE (2026-10-29, phase 1): dated events from exchange announcements, filings, media and the
  // official channels, classified by rules and scored. Read off the 48-hour memory ring, never the database.
  //   ?sym=BTC&since=<ms>&min=<score>&kind=listing&limit=100   ·   /status = per-source health and lateness
  app.get('/api/v1/catalysts', async (req, res) => {
    try {
      const q = { sym: String(req.query.sym || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 12), since: +req.query.since || 0, min: +req.query.min || 0, kind: String(req.query.kind || '').replace(/[^a-z]/g, '').slice(0, 16), limit: Math.min(5000, Math.max(1, +req.query.limit || 100)) };
      // THE RING ANSWERS 48 HOURS; A MONTH COMES OFF THE TABLE, ON THE READER THREAD (2026-10-29, the "what moved
      // it" indicator). The two answers share one shape so a caller never needs to know which one it got.
      if (q.since > 0 && q.since < Date.now() - 46 * 3600000) {
        const until = +req.query.until || Date.now();
        const rows = await storage.async.catalystRange(q.since, until, q.sym, q.min, q.kind, q.limit);
        res.set('Cache-Control', 'public, max-age=120');
        return res.json({ ts: Date.now(), n: rows.length, hist: true, items: rows, upcoming: [] });
      }
      res.set('Cache-Control', 'public, max-age=20');
      res.json(getCatalysts(q));
    } catch (e) { res.status(500).json({ error: 'server', why: String(e && e.message || e).slice(0, 80) }); }
  });
  // INGEST FROM OUTSIDE (2026-10-29): a source this box cannot read itself - Truth Social answers a home IP and 403s every
  // datacentre (the droplet, the Worker) - is polled wherever it can be read (tools/truth-poller.js) and handed in here over
  // the export key. Same ingest, same dedupe, same classification as every other source; at most 50 items a call.
  app.post('/api/v1/catalysts/ingest', express.json({ limit: '256kb' }), (req, res) => {
    const key = req.headers['x-export-key'] || '';
    if (!process.env.EXPORT_KEY || key !== process.env.EXPORT_KEY) return res.status(403).json({ error: 'forbidden' });
    const b = req.body || {}; const source = String(b.source || '').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 40); const tier = ['primary', 'official', 'mediaA', 'mediaB', 'social'].includes(b.tier) ? b.tier : 'social';
    if (!/^(truth|x|tg|rss|ext):/.test(source)) return res.status(400).json({ error: 'bad_source' });
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, 50).map(it => ({ title: String(it.title || '').slice(0, 300), url: String(it.url || '').slice(0, 500), ts: +it.ts || Date.now(), nid: String(it.nid || '').slice(0, 80), meta: it.meta && typeof it.meta === 'object' ? it.meta : {} })).filter(it => it.title && it.ts > 0);
    let added = 0; try { added = ingestRows(items, source, tier) || 0; } catch (e) { return res.status(500).json({ error: String(e && e.message || e).slice(0, 80) }); }
    res.set('Cache-Control', 'no-store'); res.json({ ok: true, received: items.length, added });
  });
  app.get('/api/v1/catalysts/status', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(catalystStatus()); });
  // the coins the catalysts name in a window, ranked by mentions (the /catalysts/ page)
  app.get('/api/v1/catalysts/top', async (req, res) => {
    try {
      const h = Math.max(1, Math.min(720, +req.query.h || 24)), min = Math.max(0, +req.query.min || 0);
      const rows = await storage.async.catalystTop(Date.now() - h * 3600000, min);
      res.set('Cache-Control', 'public, max-age=60');
      res.json({ ts: Date.now(), hours: h, min, n: rows.length, items: rows.slice(0, Math.min(300, Math.max(1, +req.query.limit || 100))) });
    } catch (e) { res.status(500).json({ error: 'server', why: String(e && e.message || e).slice(0, 80) }); }
  });
  // the whale tracker's trade groups for one coin (14-day table) - a flow cause for the chart's "what moved it"
  // the OI series (2-min buckets, all venues) and the hourly funding+OI pair for one symbol - the catalyst engine's readings
  app.get('/api/v1/oiseries', async (req, res) => {
    try { const sym = String(req.query.symbol || req.query.sym || 'BTC').replace(/[^A-Za-z0-9]/g, '').slice(0, 12); const rows = await storage.async.oiSeries(sym, +req.query.since || Date.now() - 86400000, +req.query.until || 0); res.set('Cache-Control', 'public, max-age=60'); res.json({ ts: Date.now(), sym: sym.toUpperCase(), n: rows.length, items: rows }); } catch (e) { res.status(500).json({ error: 'server', why: String(e && e.message || e).slice(0, 80) }); }
  });
  app.get('/api/v1/fundseries', async (req, res) => {
    try { const sym = String(req.query.symbol || req.query.sym || 'BTC').replace(/[^A-Za-z0-9]/g, '').slice(0, 12); const rows = await storage.async.fundSeries(sym, +req.query.since || Date.now() - 14 * 86400000, +req.query.until || 0); res.set('Cache-Control', 'public, max-age=300'); res.json({ ts: Date.now(), sym: sym.toUpperCase(), n: rows.length, items: rows }); } catch (e) { res.status(500).json({ error: 'server', why: String(e && e.message || e).slice(0, 80) }); }
  });
  app.get('/api/v1/whalefills', async (req, res) => {
    try {
      const sym = String(req.query.sym || 'BTC').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
      const rows = await storage.async.whaleFillsRange(sym, +req.query.since || Date.now() - 86400000, +req.query.until || 0, +req.query.min || 250000, +req.query.limit || 500);
      res.set('Cache-Control', 'public, max-age=60');
      res.json({ ts: Date.now(), sym: sym.toUpperCase(), n: rows.length, items: rows });
    } catch (e) { res.status(500).json({ error: 'server', why: String(e && e.message || e).slice(0, 80) }); }
  });

  const server = app.listen(config.api.port, () => log.info('api listening', { port: config.api.port }));
  return server;
}
