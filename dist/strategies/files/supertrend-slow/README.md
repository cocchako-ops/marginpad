# Supertrend 20/5

A wide Supertrend that aims to hold the big moves.

## The rule

- Go long when Supertrend(20,5) direction is above 0.
- Exit the long when Supertrend(20,5) direction is below 0.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/supertrend-slow/

## Files

- `supertrend-slow.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `supertrend-slow.py`: Python 3, no dependencies. `python supertrend-slow.py candles.csv`, columns time,open,high,low,close,volume.
- `supertrend-slow-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python supertrend-slow-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
