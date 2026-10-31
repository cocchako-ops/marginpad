# RSI Fade Short

Short RSI over 75, cover under 50.

## The rule

- Go short when RSI(14) is above 75.
- Exit the short when RSI(14) is below 50.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/rsi-fade-short/

## Files

- `rsi-fade-short.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `rsi-fade-short.py`: Python 3, no dependencies. `python rsi-fade-short.py candles.csv`, columns time,open,high,low,close,volume.
- `rsi-fade-short-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python rsi-fade-short-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
