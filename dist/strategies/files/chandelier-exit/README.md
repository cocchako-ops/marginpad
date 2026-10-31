# Chandelier Exit

Above the 200 SMA, held until a 4 ATR trail is hit.

## The rule

- Go long when close crosses above SMA(200).
- Stop: 4 ATR(14) from entry.
- The stop trails 4 ATR(14) behind the last close.

Declared timeframe: 1d.

## Results

https://marginpad.io/strategies/chandelier-exit/

## Files

- `chandelier-exit.pine`: Pine Script v6 for TradingView. Results there use TradingView's own fills and will differ a little.
- `chandelier-exit.py`: Python 3, no dependencies. `python chandelier-exit.py candles.csv`, columns time,open,high,low,close,volume.
- `chandelier-exit-bot.py`: runs the rule on the MarginPad Bot API with paper money. Set MARGINPAD_KEY, then `python chandelier-exit-bot.py BTC`. Add `--check` to price a trade and place nothing.

Research, not advice. A backtest is evidence, never a promise. MIT licence.
