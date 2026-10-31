# Donchian Long & Short

Goes with whichever side breaks a 20-bar range.

## The rule

- Go long when close is above the 20-bar high.
- Go short when close is below the 20-bar low.
- An opposite signal reverses the position.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/donchian-long-short/

## Files

- `donchian-long-short.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `donchian-long-short.py`: Python 3, no dependencies. `python donchian-long-short.py candles.csv`, columns time,open,high,low,close,volume.
- `donchian-long-short-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python donchian-long-short-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
