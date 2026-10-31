# Momentum 90

Absolute momentum: long while the last three months are positive.

## The rule

- Go long when 90-bar rate of change crosses above 0.
- Exit the long when 90-bar rate of change crosses below 0.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/momentum-90/

## Files

- `momentum-90.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `momentum-90.py`: Python 3, no dependencies. `python momentum-90.py candles.csv`, columns time,open,high,low,close,volume.
- `momentum-90-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python momentum-90-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
