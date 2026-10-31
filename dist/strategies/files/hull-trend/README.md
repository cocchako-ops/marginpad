# Hull Trend

Long while the Hull moving average is rising.

## The rule

- Go long when HMA(21) crosses above HMA(21) 1 bar ago.
- Exit the long when HMA(21) crosses below HMA(21) 1 bar ago.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/hull-trend/

## Files

- `hull-trend.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `hull-trend.py`: Python 3, no dependencies. `python hull-trend.py candles.csv`, columns time,open,high,low,close,volume.
- `hull-trend-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python hull-trend-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
