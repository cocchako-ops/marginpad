# Breakout With ATR Trail

A 20-bar high, then a 3 ATR trailing stop rides the move.

## The rule

- Go long when close is above the 20-bar high.
- Stop: 3 ATR(14) from entry.
- The stop trails 3 ATR(14) behind the last close.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/breakout-atr-trail/

## Files

- `breakout-atr-trail.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `breakout-atr-trail.py`: Python 3, no dependencies. `python breakout-atr-trail.py candles.csv`, columns time,open,high,low,close,volume.
- `breakout-atr-trail-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python breakout-atr-trail-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
