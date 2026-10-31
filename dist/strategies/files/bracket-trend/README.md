# Bracket Trend

A trend entry with a fixed +6% target and -3% stop.

## The rule

- Go long when EMA(20) is above EMA(50).
- Stop: 3% from entry.
- Target: 6% from entry.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/bracket-trend/

## Files

- `bracket-trend.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `bracket-trend.py`: Python 3, no dependencies. `python bracket-trend.py candles.csv`, columns time,open,high,low,close,volume.
- `bracket-trend-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python bracket-trend-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
