# Range High Fade

Short a 60-bar high with RSI stretched: 3 ATR stop, 2R target, 48 bars at most.

## The rule

- Go short when high is above the 60-bar high and RSI(14) is above 70.
- Stop: 3 ATR(14) from entry.
- Target: 2 times the risk.
- Leave after 48 bars at most.

Declared timeframe: 1h.

## Results

https://marginpad.io/strategies/range-rsi-fade/

## Files

- `range-rsi-fade.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `range-rsi-fade.py`: Python 3, no dependencies. `python range-rsi-fade.py candles.csv`, columns time,open,high,low,close,volume.
- `range-rsi-fade-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python range-rsi-fade-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
