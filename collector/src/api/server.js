// Read-only HTTP API. The MarginPad site reaches this through a Cloudflare Worker proxy at
// /api/v1/liquidations/* (same-origin, cached, with graceful fallback). Versioned from day one.
import express from 'express';
import { config } from '../../config.js';
import { log } from '../logger.js';

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

// ---- freemium SEAM (no paywall yet — just the clean hook) ----
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

export function createApiServer({ storage, getStatus, bus }) {
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
  app.get('/api/v1/liquidations/recent', (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    const g = gate(req, { window: req.query.window }); if (!g.ok) return res.status(g.status).json({ error: g.reason });
    const minutes = resolveWindow(req.query);
    try {
      const buckets = storage.histogram(symbol, minutes);
      res.set('Cache-Control', `public, max-age=${config.api.aggCacheSeconds}`);
      res.json({ symbol, minutes, updatedAt: Date.now(), buckets });
    } catch (e) { log.error('recent failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Recent raw events for the live ticker + chart bubbles.
  app.get('/api/v1/liquidations/live', (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
    const min = parseFloat(req.query.min) || 0;
    try {
      res.set('Cache-Control', 'public, max-age=3');
      res.json({ symbol, events: storage.live(symbol, limit, min) });
    } catch (e) { log.error('live failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Market-wide recent liquidations (all symbols) — powers the global floating feed on the site.
  app.get('/api/v1/feed', (req, res) => {
    const min = parseFloat(req.query.min) || 0;
    const since = parseInt(req.query.since, 10) || 0; // ms timestamp — backfill mode ("everything since UTC midnight")
    const cap = since > 0 ? 3000 : 200;               // a history pull may span the whole day; the live poll stays small
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, cap);
    try { res.set('Cache-Control', since > 0 ? 'public, max-age=30' : 'public, max-age=2'); res.json({ events: storage.feed(min, limit, since) }); }
    catch (e) { log.error('feed failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Server-Sent Events: push new liquidations to connected browsers for a live feel.
  app.get('/api/v1/liquidations/stream', (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).end();
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'Access-Control-Allow-Origin': config.api.corsOrigin });
    res.flushHeaders?.();
    res.write(`event: hello\ndata: ${JSON.stringify({ symbol })}\n\n`);
    const onLiq = (e) => { if (e.symbol === symbol) res.write(`data: ${JSON.stringify(e)}\n\n`); };
    bus.on('liq', onLiq);
    const ka = setInterval(() => res.write(': keepalive\n\n'), 20000);
    req.on('close', () => { clearInterval(ka); bus.off('liq', onLiq); });
  });

  // Phase 2: estimated liquidation clusters (a MODEL — UI must label it as such).
  app.get('/api/v1/clusters', (req, res) => {
    const symbol = String(req.query.symbol || 'BTC').toUpperCase();
    if (!validSymbol(symbol)) return res.status(400).json({ error: 'bad_symbol' });
    try {
      res.set('Cache-Control', 'public, max-age=20');
      res.json({ symbol, model: true, updatedAt: Date.now(), clusters: storage.getClusters ? storage.getClusters(symbol) : [] });
    } catch (e) { log.error('clusters failed', { e: String(e) }); res.status(500).json({ error: 'server' }); }
  });

  // Perp tickers from venues that 403-ban Cloudflare's shared edge IPs (Binance, Bitget) — fetched here from the VPS
  // (a normal residential/datacenter IP that ISN'T banned) so the site's screener can aggregate them too. Normalized to
  // the screener's shape; cached in-memory ~30s so the upstreams aren't hammered (the Worker also edge-caches this).
  let _perpCache = { ts: 0, data: null };
  // screener enrichment: per-symbol 24h liquidations (OUR unique dataset) + OI Δ24h from hourly snapshots
  app.get('/api/v1/screener-extra', (req, res) => {
    try {
      const liq = {};
      storage.liqBySymbol(Date.now() - 86400000).forEach((r) => { liq[r.s] = { liq: Math.round(r.liq), long: Math.round(r.lng), n: r.n }; });
      res.set('Cache-Control', 'public, max-age=120');
      res.json({ updatedAt: Date.now(), oi: storage.oi24h(), liq });
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

  // Health — per-exchange socket state, last event, events/min. Check it from your phone.
  app.get('/api/v1/status', (req, res) => { res.set('Cache-Control', 'no-store'); res.json(getStatus()); });
  app.get('/api/v1/health', (req, res) => res.json({ ok: true }));

  const server = app.listen(config.api.port, () => log.info('api listening', { port: config.api.port }));
  return server;
}
