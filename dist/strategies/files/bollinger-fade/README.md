# Bollinger Fade Long & Short

Fades both bands back to the mid-line.

## The rule

- Go long when close is below SMA(20) - 2 x standard deviation(20).
- Exit the long when close is above SMA(20).
- Go short when close is above SMA(20) + 2 x standard deviation(20).
- Exit the short when close is below SMA(20).

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/bollinger-fade/

## Files

- `bollinger-fade.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `bollinger-fade.py`: Python 3, no dependencies. `python bollinger-fade.py candles.csv`, columns time,open,high,low,close,volume.
- `bollinger-fade-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python bollinger-fade-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
