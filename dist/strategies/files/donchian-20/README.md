# Donchian Breakout 20

Buy a new 20-bar high, sell a new 10-bar low.

## The rule

- Go long when close is above the 20-bar high.
- Exit the long when close is below the 10-bar low.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/donchian-20/

## Files

- `donchian-20.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `donchian-20.py`: Python 3, no dependencies. `python donchian-20.py candles.csv`, columns time,open,high,low,close,volume.
- `donchian-20-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python donchian-20-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
