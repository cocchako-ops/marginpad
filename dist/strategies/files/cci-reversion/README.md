# CCI Reversion

Buy CCI crossing back above -100, sell over +100.

## The rule

- Go long when CCI(20) crosses above -100.
- Exit the long when CCI(20) is above 100.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/cci-reversion/

## Files

- `cci-reversion.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `cci-reversion.py`: Python 3, no dependencies. `python cci-reversion.py candles.csv`, columns time,open,high,low,close,volume.
- `cci-reversion-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python cci-reversion-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
