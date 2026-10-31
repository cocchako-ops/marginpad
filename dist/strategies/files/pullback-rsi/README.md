# RSI Pullback

In an uptrend, buy RSI under 40 and sell over 60.

## The rule

- Go long when close is above SMA(200) and RSI(14) is below 40.
- Exit the long when RSI(14) is above 60.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/pullback-rsi/

## Files

- `pullback-rsi.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `pullback-rsi.py`: Python 3, no dependencies. `python pullback-rsi.py candles.csv`, columns time,open,high,low,close,volume.
- `pullback-rsi-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python pullback-rsi-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
