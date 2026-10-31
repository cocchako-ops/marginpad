# Squeeze Breakout

Bollinger bands inside Keltner, then the first close above the band.

## The rule

- Go long when close is above SMA(20) + 2 x standard deviation(20) and SMA(20) + 2 x standard deviation(20) 1 bar ago is below EMA(20) + 1.5 x ATR(20) 1 bar ago.
- Exit the long when close is below EMA(20).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/squeeze-breakout/

## Files

- `squeeze-breakout.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `squeeze-breakout.py`: Python 3, no dependencies. `python squeeze-breakout.py candles.csv`, columns time,open,high,low,close,volume.
- `squeeze-breakout-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python squeeze-breakout-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
