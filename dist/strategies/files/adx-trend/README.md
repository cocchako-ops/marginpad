# ADX Trend Filter

An EMA trend, taken only when ADX says a trend exists.

## The rule

- Go long when EMA(20) is above EMA(50) and ADX(14) is above 25.
- Exit the long when EMA(20) is below EMA(50).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/adx-trend/

## Files

- `adx-trend.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `adx-trend.py`: Python 3, no dependencies. `python adx-trend.py candles.csv`, columns time,open,high,low,close,volume.
- `adx-trend-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python adx-trend-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
