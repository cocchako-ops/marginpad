# EMA 20/50 Cross

A slower cross that sits out more of the chop.

## The rule

- Go long when EMA(20) crosses above EMA(50).
- Exit the long when EMA(20) crosses below EMA(50).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/ema-20-50-cross/

## Files

- `ema-20-50-cross.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `ema-20-50-cross.py`: Python 3, no dependencies. `python ema-20-50-cross.py candles.csv`, columns time,open,high,low,close,volume.
- `ema-20-50-cross-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python ema-20-50-cross-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
