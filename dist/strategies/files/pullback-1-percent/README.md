# Trend Pullback 1%

In an uptrend, buy a 1% dip under the 20 EMA.

## The rule

- Go long when EMA(20) is above EMA(50) and close is below 0.99 x EMA(20).
- Exit the long when EMA(20) is below EMA(50).
- Stop: 3 ATR(14) from entry.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/pullback-1-percent/

## Files

- `pullback-1-percent.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `pullback-1-percent.py`: Python 3, no dependencies. `python pullback-1-percent.py candles.csv`, columns time,open,high,low,close,volume.
- `pullback-1-percent-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python pullback-1-percent-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
