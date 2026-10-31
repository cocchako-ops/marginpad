# ATR Stop Long & Short

Trend flips with a 2 ATR stop on every position.

## The rule

- Go long when EMA(20) crosses above EMA(50).
- Go short when EMA(20) crosses below EMA(50).
- An opposite signal reverses the position.
- Stop: 2 ATR(14) from entry.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/atr-stop-reversal/

## Files

- `atr-stop-reversal.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `atr-stop-reversal.py`: Python 3, no dependencies. `python atr-stop-reversal.py candles.csv`, columns time,open,high,low,close,volume.
- `atr-stop-reversal-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python atr-stop-reversal-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
