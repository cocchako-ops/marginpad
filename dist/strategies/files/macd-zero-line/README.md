# MACD Zero Line

Long while MACD is above zero, a slower read of the same idea.

## The rule

- Go long when MACD crosses above 0.
- Exit the long when MACD crosses below 0.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/macd-zero-line/

## Files

- `macd-zero-line.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `macd-zero-line.py`: Python 3, no dependencies. `python macd-zero-line.py candles.csv`, columns time,open,high,low,close,volume.
- `macd-zero-line-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python macd-zero-line-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
