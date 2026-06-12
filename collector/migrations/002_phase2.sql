-- 002 Phase 2: Open Interest time series + estimated liquidation clusters.
-- OI snapshots per symbol/exchange (summed across exchanges by the model).
CREATE TABLE IF NOT EXISTS oi (
  symbol   TEXT    NOT NULL,
  exchange TEXT    NOT NULL,
  ts       INTEGER NOT NULL,
  oi_base  REAL    NOT NULL,   -- open interest in base asset units
  price    REAL    NOT NULL,   -- mark/last price at snapshot time
  PRIMARY KEY (symbol, exchange, ts)
);
CREATE INDEX IF NOT EXISTS idx_oi_symbol_ts ON oi(symbol, ts);

-- Modelled clusters: estimated notional likely to liquidate at each price bucket/side.
-- This is a MODEL (from OI changes + assumed leverage distribution), not order-book data.
CREATE TABLE IF NOT EXISTS clusters (
  symbol       TEXT    NOT NULL,
  price_bucket REAL    NOT NULL,
  side         TEXT    NOT NULL,   -- 'long_liquidated' | 'short_liquidated'
  est_notional REAL    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (symbol, price_bucket, side)
);
CREATE INDEX IF NOT EXISTS idx_clusters_symbol ON clusters(symbol);
