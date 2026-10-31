# Dip or Breakout

Takes whichever comes first: an RSI dip or a 20-day high.

## The rule

- Go long when RSI(14) crosses below 35 or close is above the 20-bar high.
- Stop: 8% from entry.
- Target: 12% from entry.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/oco-dip-or-breakout/

## Files

- `oco-dip-or-breakout.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `oco-dip-or-breakout.py`: Python 3, no dependencies. `python oco-dip-or-breakout.py candles.csv`, columns time,open,high,low,close,volume.
- `oco-dip-or-breakout-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python oco-dip-or-breakout-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
