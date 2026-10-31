# RSI-2 With Trend Filter

The same dip, bought only above the 200 SMA.

## The rule

- Go long when RSI(2) is below 10 and close is above SMA(200).
- Exit the long when RSI(2) is above 60.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/rsi-2-trend-filter/

## Files

- `rsi-2-trend-filter.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `rsi-2-trend-filter.py`: Python 3, no dependencies. `python rsi-2-trend-filter.py candles.csv`, columns time,open,high,low,close,volume.
- `rsi-2-trend-filter-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python rsi-2-trend-filter-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
