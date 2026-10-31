# Keltner Breakout

Buy a close above the Keltner channel, exit at its mid-line.

## The rule

- Go long when close is above EMA(20) + 2 x ATR(20).
- Exit the long when close is below EMA(20).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/keltner-breakout/

## Files

- `keltner-breakout.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `keltner-breakout.py`: Python 3, no dependencies. `python keltner-breakout.py candles.csv`, columns time,open,high,low,close,volume.
- `keltner-breakout-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python keltner-breakout-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
