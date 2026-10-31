# Hourly Edge Fade

Short a 60-bar high at market: 3 ATR stop, 2R target. The most stable row of our October study.

## The rule

- Go short when high is above the 60-bar high.
- Stop: 3 ATR(14) from entry.
- Target: 2 times the risk.
- Leave after 48 bars at most.

Declared timeframe: 1h.

## Results

https://marginpad.io/strategies/edge-fade-short/

## Files

- `edge-fade-short.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `edge-fade-short.py`: Python 3, no dependencies. `python edge-fade-short.py candles.csv`, columns time,open,high,low,close,volume.
- `edge-fade-short-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python edge-fade-short-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
