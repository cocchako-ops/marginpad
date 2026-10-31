# EMA Ribbon 8/21/50

Long only while three averages are stacked in order.

## The rule

- Go long when EMA(8) is above EMA(21) and EMA(21) is above EMA(50).
- Exit the long when EMA(8) is below EMA(21).

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/ema-ribbon/

## Files

- `ema-ribbon.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `ema-ribbon.py`: Python 3, no dependencies. `python ema-ribbon.py candles.csv`, columns time,open,high,low,close,volume.
- `ema-ribbon-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python ema-ribbon-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
