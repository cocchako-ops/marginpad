# Friday To Monday

Hold over the weekend only. Nothing but the calendar decides.

## The rule

- Go long when the UTC weekday is above 4 and the UTC weekday is below 6.
- Leave after 3 bars at most.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/weekend-hold/

## Files

- `weekend-hold.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `weekend-hold.py`: Python 3, no dependencies. `python weekend-hold.py candles.csv`, columns time,open,high,low,close,volume.
- `weekend-hold-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python weekend-hold-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
