# Price Above SMA 50

Long while price closes above the 50-day average.

## The rule

- Go long when close crosses above SMA(50).
- Exit the long when close crosses below SMA(50).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/price-above-sma-50/

## Files

- `price-above-sma-50.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `price-above-sma-50.py`: Python 3, no dependencies. `python price-above-sma-50.py candles.csv`, columns time,open,high,low,close,volume.
- `price-above-sma-50-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python price-above-sma-50-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
