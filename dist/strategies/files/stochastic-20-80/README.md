# Stochastic 20/80

Buy the stochastic under 20, sell over 80.

## The rule

- Go long when Stochastic(14) is below 20.
- Exit the long when Stochastic(14) is above 80.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/stochastic-20-80/

## Files

- `stochastic-20-80.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `stochastic-20-80.py`: Python 3, no dependencies. `python stochastic-20-80.py candles.csv`, columns time,open,high,low,close,volume.
- `stochastic-20-80-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python stochastic-20-80-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
