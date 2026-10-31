# Volume Climax Reversal

Buy a heavy down bar on three times the volume, hold five bars.

## The rule

- Go long when close is below open and volume is above 3 x SMA(20) and RSI(14) is below 35.
- Leave after 5 bars at most.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/volume-climax/

## Files

- `volume-climax.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `volume-climax.py`: Python 3, no dependencies. `python volume-climax.py candles.csv`, columns time,open,high,low,close,volume.
- `volume-climax-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python volume-climax-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
