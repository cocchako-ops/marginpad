# SMA 20/50 Cross

The classic moving-average cross on simple averages.

## The rule

- Go long when SMA(20) crosses above SMA(50).
- Exit the long when SMA(20) crosses below SMA(50).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/sma-20-50-cross/

## Files

- `sma-20-50-cross.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `sma-20-50-cross.py`: Python 3, no dependencies. `python sma-20-50-cross.py candles.csv`, columns time,open,high,low,close,volume.
- `sma-20-50-cross-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python sma-20-50-cross-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
