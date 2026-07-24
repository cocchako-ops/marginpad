-- bare-ts index: the /pulse aggregates scan WHERE ts>= across all symbols (idx_liq_symbol_ts leads with symbol, useless here)
CREATE INDEX IF NOT EXISTS idx_liq_ts ON liquidations(ts);
