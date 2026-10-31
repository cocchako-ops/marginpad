# Trailing Stop Trend

A 20/50 trend entry; a 3 ATR trail decides the exit.

## The rule

- Go long when EMA(20) crosses above EMA(50).
- Stop: 3 ATR(14) from entry.
- The stop trails 3 ATR(14) behind the last close.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/trailing-stop-trend/

## Files

- `trailing-stop-trend.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `trailing-stop-trend.py`: Python 3, no dependencies. `python trailing-stop-trend.py candles.csv`, columns time,open,high,low,close,volume.
- `trailing-stop-trend-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python trailing-stop-trend-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
