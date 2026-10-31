# EMA 21 Pullback

In an uptrend, buy the dip to the 21 EMA: 1.5 ATR stop, 3R target.

## The rule

- Go long when EMA(21) is above EMA(50) and low is below EMA(21) and close is above EMA(21).
- Stop: 1.5 ATR(14) from entry.
- Target: 3 times the risk.
- Leave after 48 bars at most.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/pullback-ema-21/

## Files

- `pullback-ema-21.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `pullback-ema-21.py`: Python 3, no dependencies. `python pullback-ema-21.py candles.csv`, columns time,open,high,low,close,volume.
- `pullback-ema-21-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python pullback-ema-21-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
