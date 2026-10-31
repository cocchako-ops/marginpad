# Price Above SMA 200

The simplest trend filter there is: above the 200-day average or in cash.

## The rule

- Go long when close crosses above SMA(200).
- Exit the long when close crosses below SMA(200).

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/price-above-sma-200/

## Files

- `price-above-sma-200.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `price-above-sma-200.py`: Python 3, no dependencies. `python price-above-sma-200.py candles.csv`, columns time,open,high,low,close,volume.
- `price-above-sma-200-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python price-above-sma-200-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
