# Bracket RSI

An RSI dip with a fixed +4% target and -2% stop.

## The rule

- Go long when RSI(14) is below 30.
- Stop: 2% from entry.
- Target: 4% from entry.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/bracket-rsi/

## Files

- `bracket-rsi.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `bracket-rsi.py`: Python 3, no dependencies. `python bracket-rsi.py candles.csv`, columns time,open,high,low,close,volume.
- `bracket-rsi-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python bracket-rsi-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
