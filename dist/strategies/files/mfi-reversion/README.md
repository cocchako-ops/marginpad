# Money Flow Reversion

Buy the Money Flow Index under 20, sell over 80.

## The rule

- Go long when MFI(14) is below 20.
- Exit the long when MFI(14) is above 80.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/mfi-reversion/

## Files

- `mfi-reversion.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `mfi-reversion.py`: Python 3, no dependencies. `python mfi-reversion.py candles.csv`, columns time,open,high,low,close,volume.
- `mfi-reversion-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python mfi-reversion-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
