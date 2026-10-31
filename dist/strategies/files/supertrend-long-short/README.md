# Supertrend Long & Short

Always in the market, on the side Supertrend shows.

## The rule

- Go long when Supertrend(10,3) direction crosses above 0.
- Go short when Supertrend(10,3) direction crosses below 0.
- An opposite signal reverses the position.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/supertrend-long-short/

## Files

- `supertrend-long-short.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `supertrend-long-short.py`: Python 3, no dependencies. `python supertrend-long-short.py candles.csv`, columns time,open,high,low,close,volume.
- `supertrend-long-short-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python supertrend-long-short-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
