# MACD Cross

Long from the MACD crossing its signal line until it crosses back.

## The rule

- Go long when MACD crosses above the MACD signal line.
- Exit the long when MACD crosses below the MACD signal line.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/macd-cross/

## Files

- `macd-cross.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `macd-cross.py`: Python 3, no dependencies. `python macd-cross.py candles.csv`, columns time,open,high,low,close,volume.
- `macd-cross-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python macd-cross-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
