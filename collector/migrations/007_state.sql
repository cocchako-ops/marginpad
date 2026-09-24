-- 007 (2026-09-25): WHAT LIVES IN MEMORY SURVIVES A RESTART.
-- The trade tape's three rings (>=$50k / >=$250k over 3h / >=$1M over 26h), the completed-minute flow and
-- the last twenty minutes of the order-book film lived only in RAM, so every restart - and 24.09 had
-- thirty-one of them, all deploys - threw a day of large prints away and the biggest filters came back
-- empty for hours. Measured: ~45KB of tape per coin and ~345KB of film per coin, 2-3MB in all. One row
-- per collector, rewritten every two minutes and on graceful shutdown, read once at boot.
CREATE TABLE IF NOT EXISTS state (
  k     TEXT PRIMARY KEY,
  v     TEXT NOT NULL,
  ts    INTEGER NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0
);
