# Breakout With 3R Target

A 20-bar high with a 2 ATR stop and a target three times the risk.

## The rule

- Go long when close is above the 20-bar high.
- Stop: 2 ATR(14) from entry.
- Target: 3 times the risk.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/breakout-3r/

## Files

- `breakout-3r.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `breakout-3r.py`: Python 3, no dependencies. `python breakout-3r.py candles.csv`, columns time,open,high,low,close,volume.
- `breakout-3r-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python breakout-3r-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
