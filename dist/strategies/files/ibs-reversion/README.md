# Close Near The Low

Buy a close in the bottom fifth of the bar, in an uptrend.

## The rule

- Go long when close - low / high - low is below 0.2 and close is above SMA(200).
- Exit the long when close - low / high - low is above 0.8.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/ibs-reversion/

## Files

- `ibs-reversion.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `ibs-reversion.py`: Python 3, no dependencies. `python ibs-reversion.py candles.csv`, columns time,open,high,low,close,volume.
- `ibs-reversion-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python ibs-reversion-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
