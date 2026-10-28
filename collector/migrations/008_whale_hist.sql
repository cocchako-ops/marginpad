-- 008 (2026-10-28): THE WHALE TRACKER WRITES WHAT IT PUBLISHES.
-- Hyperliquid positions over $1M and the grouped trades over $250K lived only in memory (whales.js), so a
-- restart emptied them and nothing older than the 120-row ring (about 2.4 hours of the whole market) could
-- ever be looked at again. These two tables are the durable copy: one row per PUBLISHED trade group, and one
-- row per published position per HOURLY snapshot. Kept `histRetentionDays` (14) and exported day by day to
-- the market archive (R2 v1/whale_fills, v1/whale_pos) by the worker's archiveMarket cron before they age out.
CREATE TABLE IF NOT EXISTS whale_fill (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,   -- when the trade STARTED (the clock the row prints)
  ts_end  INTEGER NOT NULL,   -- when the last fill of the group landed
  user    TEXT NOT NULL,      -- wallet address, lowercase
  sym     TEXT NOT NULL,
  act     TEXT,               -- open | close | flip
  long    INTEGER,            -- 1 = the resulting / affected side is long
  usd     REAL,               -- size in USD, sum of the fills
  sz      REAL,               -- coins
  px      REAL,               -- size-weighted average fill price
  n       INTEGER,            -- fills in the group
  lev     REAL,               -- leverage read off the position (NULL = unknown, never guessed)
  pnl     REAL,               -- realised, meaningful on a close
  liq     INTEGER,            -- how many of the fills the exchange took (liquidation), NULL = none
  pos_usd REAL                -- position left after the group, NULL = unknown
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_dedup ON whale_fill (user, sym, ts, ts_end);
CREATE INDEX IF NOT EXISTS idx_wf_ts ON whale_fill (ts);

CREATE TABLE IF NOT EXISTS whale_pos (
  ts    INTEGER NOT NULL,     -- snapshot time, one per hour
  user  TEXT NOT NULL,
  sym   TEXT NOT NULL,
  long  INTEGER,
  val   REAL,                 -- position value USD
  sz    REAL,                 -- coins
  lev   REAL,
  liq   REAL,                 -- the exchange's own liquidation price
  mark  REAL,
  ent   REAL,                 -- the exchange's own entry price
  pnl   REAL,                 -- unrealised
  x     INTEGER,              -- 1 = cross margin
  eq    REAL,                 -- account value of the wallet behind it
  PRIMARY KEY (ts, user, sym)
);
CREATE INDEX IF NOT EXISTS idx_wp_ts ON whale_pos (ts);
