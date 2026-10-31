# Donchian 55 (Turtle)

The Turtle system: a 55-day high in, a 20-day low out.

## The rule

- Go long when close is above the 55-bar high.
- Exit the long when close is below the 20-bar low.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/donchian-55-turtle/

## Files

- `donchian-55-turtle.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `donchian-55-turtle.py`: Python 3, no dependencies. `python donchian-55-turtle.py candles.csv`, columns time,open,high,low,close,volume.
- `donchian-55-turtle-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python donchian-55-turtle-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
