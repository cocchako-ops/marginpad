-- 003 screener extra: hourly open-interest snapshots (for OI Δ24h on the screener)
-- + an index for fast per-symbol 24h liquidation aggregates.
CREATE TABLE IF NOT EXISTS oi_snap (
  ts      INTEGER NOT NULL,   -- snapshot time, ms epoch (one ts shared by all rows of a snapshot)
  symbol  TEXT    NOT NULL,   -- normalized base, e.g. 'BTC'
  oi_usd  REAL    NOT NULL    -- open interest value in USD (Bybit linear openInterestValue)
);
CREATE INDEX IF NOT EXISTS idx_oi_snap_sym ON oi_snap(symbol, ts);
CREATE INDEX IF NOT EXISTS idx_oi_snap_ts  ON oi_snap(ts);
CREATE INDEX IF NOT EXISTS idx_liq_sym_ts  ON liquidations(symbol, ts);
