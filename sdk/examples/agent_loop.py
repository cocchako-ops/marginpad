"""A minimal trading agent on MarginPad paper trading: one decision a minute, no polling storm.

    pip install marginpad
    MP_KEY=mpb_... python agent_loop.py

The strategy is deliberately simple (RSI-14 on 1h candles): replace decide() with your own model or an LLM call.
"""
import os
import time

from marginpad import MarginPad, MarginPadError

mp = MarginPad(os.environ["MP_KEY"])
SYMBOL, MARGIN, LEV = "BTC", 100, 10


def rsi(closes, n=14):
    gains = losses = 0.0
    for a, b in zip(closes[-n - 1:-1], closes[-n:]):
        d = b - a
        gains += max(d, 0)
        losses += max(-d, 0)
    if losses == 0:
        return 100.0
    rs = (gains / n) / (losses / n)
    return 100 - 100 / (1 + rs)


def decide(closes):
    r = rsi(closes)
    if r < 30:
        return "long"
    if r > 70:
        return "short"
    return None


while True:
    try:
        candles = mp.klines(SYMBOL, "60")                       # keyless
        closes = [c["close"] for c in candles[-40:]]
        open_pos = [p for p in mp.positions()["positions"] if p["symbol"] == SYMBOL and p["status"] == "open"]
        want = decide(closes)
        if want and not open_pos:
            px = closes[-1]
            sl = px * (0.98 if want == "long" else 1.02)
            tp = px * (1.04 if want == "long" else 0.96)
            pos = mp.open(SYMBOL, want, margin_usd=MARGIN, leverage=LEV, sl=sl, tp=tp,
                          client_order_id=f"rsi-{int(time.time() // 60)}")   # idempotent per minute
            print("opened", pos["id"], want, "at", pos["entry_price"])
        elif open_pos and want and open_pos[0]["side"] != want:
            mp.close(open_pos[0]["id"], symbol=SYMBOL)
            print("closed on flip", open_pos[0]["id"])
    except MarginPadError as e:
        print("api:", e.code, e)                                # rate_limit, leverage_max, market_closed: every refusal is named
    except Exception as e:  # network
        print("net:", e)
    time.sleep(60)
