# Bollinger Breakout

Buy a close above the upper band, exit at the mid-line.

## The rule

- Go long when close is above SMA(20) + 2 x standard deviation(20).
- Exit the long when close is below SMA(20).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/bollinger-breakout/

## Files

- `bollinger-breakout.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `bollinger-breakout.py`: Python 3, no dependencies. `python bollinger-breakout.py candles.csv`, columns time,open,high,low,close,volume.
- `bollinger-breakout-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python bollinger-breakout-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
