# RSI Reversion 30/70

Buy RSI under 30, sell over 70.

## The rule

- Go long when RSI(14) is below 30.
- Exit the long when RSI(14) is above 70.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/rsi-30-70/

## Files

- `rsi-30-70.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `rsi-30-70.py`: Python 3, no dependencies. `python rsi-30-70.py candles.csv`, columns time,open,high,low,close,volume.
- `rsi-30-70-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python rsi-30-70-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
