# Golden Cross

Long while the 50 SMA is above the 200 SMA.

## The rule

- Go long when SMA(50) crosses above SMA(200).
- Exit the long when SMA(50) crosses below SMA(200).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/golden-cross/

## Files

- `golden-cross.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `golden-cross.py`: Python 3, no dependencies. `python golden-cross.py candles.csv`, columns time,open,high,low,close,volume.
- `golden-cross-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python golden-cross-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
