# EMA 9/21 Cross

Long while the 9 EMA is above the 21 EMA.

## The rule

- Go long when EMA(9) crosses above EMA(21).
- Exit the long when EMA(9) crosses below EMA(21).

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/ema-9-21-cross/

## Files

- `ema-9-21-cross.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `ema-9-21-cross.py`: Python 3, no dependencies. `python ema-9-21-cross.py candles.csv`, columns time,open,high,low,close,volume.
- `ema-9-21-cross-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python ema-9-21-cross-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
