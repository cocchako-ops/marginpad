# Dip Above SMA 200

A five-period RSI under 30, above the 200 SMA.

## The rule

- Go long when close is above SMA(200) and RSI(5) is below 30.
- Exit the long when close is above SMA(5).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/pullback-sma-200/

## Files

- `pullback-sma-200.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `pullback-sma-200.py`: Python 3, no dependencies. `python pullback-sma-200.py candles.csv`, columns time,open,high,low,close,volume.
- `pullback-sma-200-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python pullback-sma-200-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
