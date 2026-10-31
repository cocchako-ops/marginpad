# EMA 9/21 Long & Short

Always in the market, on the side of the 9/21 EMA cross.

## The rule

- Go long when EMA(9) crosses above EMA(21).
- Go short when EMA(9) crosses below EMA(21).
- An opposite signal reverses the position.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/ema-9-21-long-short/

## Files

- `ema-9-21-long-short.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `ema-9-21-long-short.py`: Python 3, no dependencies. `python ema-9-21-long-short.py candles.csv`, columns time,open,high,low,close,volume.
- `ema-9-21-long-short-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python ema-9-21-long-short-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
