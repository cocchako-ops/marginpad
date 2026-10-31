# Volume Breakout

A 20-bar high on twice the normal volume.

## The rule

- Go long when close is above the 20-bar high and volume is above 2 x SMA(20).
- Exit the long when close is below EMA(20).

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/volume-breakout/

## Files

- `volume-breakout.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `volume-breakout.py`: Python 3, no dependencies. `python volume-breakout.py candles.csv`, columns time,open,high,low,close,volume.
- `volume-breakout-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python volume-breakout-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
