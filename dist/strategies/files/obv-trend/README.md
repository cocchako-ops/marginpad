# OBV Trend

Long while On-Balance Volume is above its own average.

## The rule

- Go long when OBV crosses above EMA(20).
- Exit the long when OBV crosses below EMA(20).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/obv-trend/

## Files

- `obv-trend.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `obv-trend.py`: Python 3, no dependencies. `python obv-trend.py candles.csv`, columns time,open,high,low,close,volume.
- `obv-trend-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python obv-trend-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
