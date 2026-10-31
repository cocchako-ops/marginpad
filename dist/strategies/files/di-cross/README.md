# DI Cross

Long while +DI leads -DI.

## The rule

- Go long when +DI(14) crosses above -DI(14).
- Exit the long when +DI(14) crosses below -DI(14).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/di-cross/

## Files

- `di-cross.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `di-cross.py`: Python 3, no dependencies. `python di-cross.py candles.csv`, columns time,open,high,low,close,volume.
- `di-cross-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python di-cross-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
