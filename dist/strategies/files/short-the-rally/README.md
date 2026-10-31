# Short The Rally

In a downtrend, short the bounce to the 21 EMA: 1.5 ATR stop, 3R target.

## The rule

- Go short when EMA(21) is below EMA(50) and high is above EMA(21) and close is below EMA(21).
- Stop: 1.5 ATR(14) from entry.
- Target: 3 times the risk.
- Leave after 48 bars at most.

Declared timeframe: 4h.

## Results

https://marginpad.io/strategies/short-the-rally/

## Files

- `short-the-rally.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `short-the-rally.py`: Python 3, no dependencies. `python short-the-rally.py candles.csv`, columns time,open,high,low,close,volume.
- `short-the-rally-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python short-the-rally-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
