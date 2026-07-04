-- 004: funding rate rides along the hourly OI snapshot (same Bybit tickers call) → "Fund Δ24h" on the screener
ALTER TABLE oi_snap ADD COLUMN funding REAL;
