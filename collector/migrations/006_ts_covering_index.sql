-- 2026-09-02: the 24h/1h market aggregates (/pulse, /screener-extra, /status) scan the ts index and then
-- fetch every matching row from the table. With ~2M rows the table no longer fits the droplet's RAM, so
-- each scan became tens of thousands of random page reads (6.6s for one /pulse window) — and every query
-- runs synchronously on the main thread, which is also where the exchange sockets live. This covering index
-- lets those scans read contiguous index pages only. idx_liq_symbol_ts (001) and idx_liq_sym_ts (005)
-- were the same (symbol, ts) index twice; the ts-only index is a prefix of the new one.
CREATE INDEX IF NOT EXISTS idx_liq_ts_cov ON liquidations(ts, symbol, exchange, side, notional, price);
DROP INDEX IF EXISTS idx_liq_sym_ts;
DROP INDEX IF EXISTS idx_liq_ts;
