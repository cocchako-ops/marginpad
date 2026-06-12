-- 001 init. SQLite syntax (the starter DB). Postgres variants live alongside as needed (see README).
-- Raw liquidation events. Retention: 30 days (pruned). Indexed for (symbol, ts) range reads.
CREATE TABLE IF NOT EXISTS liquidations (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,          -- event time, ms epoch
  exchange  TEXT    NOT NULL,          -- 'binance' | 'bybit' | 'okx'
  symbol    TEXT    NOT NULL,          -- normalized base, e.g. 'BTC'
  side      TEXT    NOT NULL,          -- 'long_liquidated' | 'short_liquidated'
  price     REAL    NOT NULL,
  qty       REAL    NOT NULL,          -- base asset quantity
  notional  REAL    NOT NULL           -- price * qty, USD
);
CREATE INDEX IF NOT EXISTS idx_liq_symbol_ts ON liquidations(symbol, ts);
-- Dedup guard: identical event from a reconnect replay is ignored (INSERT OR IGNORE).
CREATE UNIQUE INDEX IF NOT EXISTS idx_liq_dedup ON liquidations(exchange, symbol, ts, price, qty);

-- Pre-aggregated histogram source: notional per symbol / 5-min window / price bucket / side.
-- The frontend reads THIS, never the raw table.
CREATE TABLE IF NOT EXISTS agg_5m (
  symbol       TEXT    NOT NULL,
  win_start    INTEGER NOT NULL,       -- ms, floored to 5 minutes
  price_bucket REAL    NOT NULL,       -- floored to per-symbol bucket size
  side         TEXT    NOT NULL,
  notional     REAL    NOT NULL,
  cnt          INTEGER NOT NULL,
  PRIMARY KEY (symbol, win_start, price_bucket, side)
);
CREATE INDEX IF NOT EXISTS idx_agg_symbol_win ON agg_5m(symbol, win_start);

-- Bookkeeping: last raw id folded into aggregates, and applied-migration tracking.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL);
