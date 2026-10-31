# Supertrend 10/3

Long while Supertrend is green.

## The rule

- Go long when Supertrend(10,3) direction is above 0.
- Exit the long when Supertrend(10,3) direction is below 0.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/supertrend/

## Files

- `supertrend.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `supertrend.py`: Python 3, no dependencies. `python supertrend.py candles.csv`, columns time,open,high,low,close,volume.
- `supertrend-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python supertrend-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
