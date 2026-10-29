-- 009 (2026-10-29): CATALYST ENGINE, PHASE 1 - every dated event the collector sees, with its own two clocks.
-- One row per catalyst object. `ts_src` is the SOURCE's own time (when the exchange published, when the filing
-- hit EDGAR, when the article's pubDate says); `ts_seen` is when THIS process first saw it. The difference is
-- the engine's main metric (how late we are), and only `ts_seen` may ever be used in a backtest (look-ahead).
-- Nothing here is a model: kind/expect/syms come from rules over the title (rules.js), score from a documented
-- v0 formula (index.js) whose weights the F0 event study replaces. Pruned at 30 days; exported day by day to the
-- market archive (R2 v1/catalysts) by the worker's archiveMarket cron before it ages out.
CREATE TABLE IF NOT EXISTS catalyst (
  id        TEXT PRIMARY KEY,   -- sha1 of the normalised url (or source + native id)
  ts_src    INTEGER NOT NULL,   -- source time, ms
  ts_seen   INTEGER NOT NULL,   -- first seen here, ms
  source    TEXT NOT NULL,      -- bybit-ann | okx-ann | hl-meta | sec | fedreg | cftc | rss:<name> | tg:<channel> | reddit:<sub> | calendar
  tier      TEXT NOT NULL,      -- primary | official | mediaA | mediaB | social
  kind      TEXT NOT NULL,      -- listing | delisting | hack | regulation | etf | macro | unlock | protocol | whale | politics | adoption | news
  expect    INTEGER NOT NULL,   -- +1 / -1 / 0 : the direction the RULE expects, never a model's feeling
  syms      TEXT NOT NULL,      -- csv of symbols the rules found ('' = market-wide / none)
  market    TEXT,               -- perp | spot | premarket | tradfi | '' (exchange announcements only)
  score     INTEGER NOT NULL,   -- 0-100, v0 formula
  conf      INTEGER NOT NULL,   -- confirmations: distinct sources in the same cluster within 6 h (1 = itself)
  cluster   TEXT,               -- normalised title key for the confirmation count
  title     TEXT NOT NULL,
  url       TEXT,
  snippet   TEXT,               -- at most 170 chars, never the article body
  meta      TEXT                -- JSON: native id, form type, chain, amount... whatever the source carried
);
CREATE INDEX IF NOT EXISTS idx_cat_src ON catalyst (ts_src);
CREATE INDEX IF NOT EXISTS idx_cat_seen ON catalyst (ts_seen);
CREATE INDEX IF NOT EXISTS idx_cat_cluster ON catalyst (cluster, ts_src);
