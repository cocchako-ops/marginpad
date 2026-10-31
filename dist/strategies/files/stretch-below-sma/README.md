# Stretch Below SMA 20

Buy 2% below the 20 SMA, sell back at it.

## The rule

- Go long when close is below 0.98 x SMA(20).
- Exit the long when close is above SMA(20).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/stretch-below-sma/

## Files

- `stretch-below-sma.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `stretch-below-sma.py`: Python 3, no dependencies. `python stretch-below-sma.py candles.csv`, columns time,open,high,low,close,volume.
- `stretch-below-sma-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python stretch-below-sma-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
