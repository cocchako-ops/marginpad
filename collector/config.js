// Single source of truth. Adding a symbol or tuning a bucket is a CONFIG change, not a code change.
export const config = {
  // Tracked symbols (normalized base names). Matches MarginPad's coin list.
  // The site's listed coins (always tracked + always have nice bucket sizes). The collector ALSO captures
  // every other liquidation market-wide (OKX all-swaps, Binance all-market, Bybit top-N) so the live feed
  // is rich and the staleness watchdog is reliable.
  symbols: ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC'],
  bybitTopN: 150,            // subscribe to the 150 most-active Bybit linear perps (Bybit has no all-market topic)

  // Binance futures WebSocket is geo-blocked in some regions (socket opens, 0 data). Set BINANCE_PROXY to an
  // HTTP(S) CONNECT proxy in an allowed region (e.g. http://user:pass@host:port) to route ONLY Binance through
  // it. Empty = connect directly (stays at 0 data where geo-blocked). NOT for SOCKS proxies.
  binanceProxy: process.env.BINANCE_PROXY || '',

  // OKX edge-blocks some datacenter/region IPs (handshake refused — socket never opens). The collector already
  // rotates OKX's two public endpoints to dodge single-edge blocks. If the whole IP is blocked, set OKX_PROXY to
  // an HTTP(S) CONNECT proxy in an allowed region to route ONLY OKX through it. Empty = connect directly.
  okxProxy: process.env.OKX_PROXY || '',

  // Histogram price-bucket size in USD per symbol (where liquidations cluster by price level).
  // Tune later; defaults aim for ~a few hundred buckets across a typical range.
  bucketSize: { BTC: 50, ETH: 5, SOL: 0.5, XRP: 0.002, DOGE: 0.0005, BNB: 2, ADA: 0.005, LINK: 0.1, AVAX: 0.2, LTC: 0.5 },
  defaultBucketDivisor: 800, // fallback bucket size = price / 800 (rounded) for symbols without an explicit size

  tickerMinNotional: 50000,  // live ticker only shows events above this USD notional (UI-adjustable)
  retentionDays: 30,         // raw events kept 30 days; aggregates kept indefinitely
  aggIntervalMs: 60_000,     // roll new raw rows into 5-min aggregates every 60s
  pruneIntervalMs: 6 * 3600_000,
  oiPollMs: 120_000,         // Phase 2: poll Open Interest per symbol every 2 min (staggered)

  // Selectable chart windows -> minutes
  windows: { '1h': 60, '4h': 240, '24h': 1440, '7d': 10080, '30d': 43200 },
  maxWindowMinutes: 43200, // allow up to 30 days (raw kept 30d, aggregates kept indefinitely)

  db: {
    driver: process.env.DB_DRIVER || 'sqlite',
    sqlitePath: process.env.SQLITE_PATH || './data/liquidations.db',
    databaseUrl: process.env.DATABASE_URL || '',
  },
  api: {
    port: Number(process.env.PORT || 8787),
    corsOrigin: process.env.CORS_ORIGIN || '*',
    aggCacheSeconds: 45,
    rateLimit: { windowMs: 60_000, max: 600 }, // per IP per minute — through the CF worker chain many users share one egress IP, and edge TTLs bound the miss rate anyway (raised 120->600 for the public liq API, 2026-07-24)
  },

  // ---- Phase 2 (estimated clusters) — defined now, not used yet ----
  leverageDistribution: [
    { lev: 5, w: 0.10 }, { lev: 10, w: 0.25 }, { lev: 25, w: 0.30 }, { lev: 50, w: 0.20 }, { lev: 100, w: 0.15 },
  ],
  mmr: 0.005,
  clusterBucketPct: 0.001,   // 0.1% of price
  clusterHalfLifeDays: 7,
};

export function bucketSizeFor(symbol, price) {
  const fixed = config.bucketSize[symbol];
  if (fixed) return fixed;
  // derive a "nice" bucket from price magnitude
  const raw = price / config.defaultBucketDivisor;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  return Math.max(mag, raw - (raw % mag)) || mag;
}
