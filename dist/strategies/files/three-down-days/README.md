# Three Down Closes

Buy after three lower closes in a row, hold five bars.

## The rule

- Go long when close is below close 1 bar ago and close 1 bar ago is below close 2 bars ago and close 2 bars ago is below close 3 bars ago.
- Leave after 5 bars at most.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/three-down-days/

## Files

- `three-down-days.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `three-down-days.py`: Python 3, no dependencies. `python three-down-days.py candles.csv`, columns time,open,high,low,close,volume.
- `three-down-days-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python three-down-days-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
