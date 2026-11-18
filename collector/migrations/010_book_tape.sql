-- 010 (2026-11-18): THE BOOK AND THE TAPE ARE KEPT. Owner: "rekao sam ti jos odavno da cuvamo istoriju svih stvari".
-- Until today both lived in memory only (the tape's completed minutes, 45 of them; the book as live state), and a
-- 2026-10-28 decision called them "state, not history" and archived neither - against the owner's order to keep
-- everything. One row per minute per venue per symbol, written by the recorder in index.js, kept histRetentionDays
-- here and exported day by day to the market archive (R2 v1/tape1m, v1/book1m) by the worker before they age out.
CREATE TABLE IF NOT EXISTS tape_min (
  ts       INTEGER NOT NULL,   -- the minute's start (ms)
  venue    TEXT NOT NULL,
  sym      TEXT NOT NULL,
  buy_usd  REAL,               -- taker BUY dollars in the minute (aggressor side, see tape.js)
  sell_usd REAL,               -- taker SELL dollars
  n        INTEGER,            -- prints
  big_buy  REAL,               -- taker buys of $50k or more, summed
  big_sell REAL,               -- taker sells of $50k or more, summed
  max_usd  REAL,               -- the biggest single print of the minute (NULL when none reached $50k)
  PRIMARY KEY (ts, venue, sym)
);
CREATE INDEX IF NOT EXISTS idx_tm_ts ON tape_min (ts);

CREATE TABLE IF NOT EXISTS book_min (
  ts        INTEGER NOT NULL,  -- when the book was read (minute boundary, ms)
  venue     TEXT NOT NULL,
  sym       TEXT NOT NULL,
  mid       REAL,
  spread_bp REAL,
  bid_1 REAL, ask_1 REAL,      -- dollars resting within 1 basis point of mid, each side
  bid_2 REAL, ask_2 REAL,
  bid_5 REAL, ask_5 REAL,
  bid_10 REAL, ask_10 REAL,
  bid_25 REAL, ask_25 REAL,
  levels    INTEGER,           -- how many price levels the venue's book carried
  PRIMARY KEY (ts, venue, sym)
);
CREATE INDEX IF NOT EXISTS idx_bm_ts ON book_min (ts);
