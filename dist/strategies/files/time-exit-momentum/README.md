# Time Exit Momentum

Buy a 20-bar high and simply leave after ten bars.

## The rule

- Go long when close is above the 20-bar high.
- Leave after 10 bars at most.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/time-exit-momentum/

## Files

- `time-exit-momentum.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `time-exit-momentum.py`: Python 3, no dependencies. `python time-exit-momentum.py candles.csv`, columns time,open,high,low,close,volume.
- `time-exit-momentum-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python time-exit-momentum-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
