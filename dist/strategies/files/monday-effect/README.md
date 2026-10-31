# Sunday Close To Monday

Hold one day from the Sunday close. A test of a well-known crypto folk rule.

## The rule

- Go long when the UTC weekday is above -1 and the UTC weekday is below 1.
- Leave after 1 bar at most.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/monday-effect/

## Files

- `monday-effect.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `monday-effect.py`: Python 3, no dependencies. `python monday-effect.py candles.csv`, columns time,open,high,low,close,volume.
- `monday-effect-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python monday-effect-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
