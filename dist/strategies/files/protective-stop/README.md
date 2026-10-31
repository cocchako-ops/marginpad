# Protective Stop

A 20/50 cross with a 5% hard stop behind it.

## The rule

- Go long when EMA(20) crosses above EMA(50).
- Exit the long when EMA(20) crosses below EMA(50).
- Stop: 5% from entry.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/protective-stop/

## Files

- `protective-stop.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `protective-stop.py`: Python 3, no dependencies. `python protective-stop.py candles.csv`, columns time,open,high,low,close,volume.
- `protective-stop-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python protective-stop-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
