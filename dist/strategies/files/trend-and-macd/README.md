# Trend + MACD

MACD entries, allowed only above the 200 SMA.

## The rule

- Go long when MACD crosses above the MACD signal line and close is above SMA(200).
- Exit the long when MACD crosses below the MACD signal line or close is below SMA(200).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/trend-and-macd/

## Files

- `trend-and-macd.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `trend-and-macd.py`: Python 3, no dependencies. `python trend-and-macd.py candles.csv`, columns time,open,high,low,close,volume.
- `trend-and-macd-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python trend-and-macd-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
