# Z-Score Reversion 50

Buy 2.5 deviations under the 50-day mean, sell once back within half a deviation, 20 bars at most.

## The rule

- Go long when (close - SMA(50)) / standard deviation(50) is below -2.5.
- Exit the long when (close - SMA(50)) / standard deviation(50) is above -0.5.
- Leave after 20 bars at most.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/zscore-reversion/

## Files

- `zscore-reversion.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `zscore-reversion.py`: Python 3, no dependencies. `python zscore-reversion.py candles.csv`, columns time,open,high,low,close,volume.
- `zscore-reversion-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python zscore-reversion-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
