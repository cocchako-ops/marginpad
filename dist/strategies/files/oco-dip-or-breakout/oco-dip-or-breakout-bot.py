#!/usr/bin/env python3
"""Dip or Breakout - Takes whichever comes first: an RSI dip or a 20-day high.

From the MarginPad strategy library: https://marginpad.io/strategies/oco-dip-or-breakout/
Research, not advice. A backtest is evidence, never a promise. Licence: MIT.

Paper money only. MARGINPAD_KEY=your_key python oco-dip-or-breakout-bot.py BTC
"""
import csv, json, math, sys

NAN = float("nan")
_memo = {}


def memo(fn):
    def wrap(*a):
        k = (fn.__name__,) + tuple(id(x) if isinstance(x, (list, dict)) else x for x in a)
        if k not in _memo:
            _memo[k] = fn(*a)
            KEEP.append(_memo[k])
        return _memo[k]
    return wrap


KEEP = []


@memo
def num(x):
    return [x] * LEN[0]


LEN = [0]


@memo
def sma(s, p):
    o, t, c = [NAN] * len(s), 0.0, 0
    for i, v in enumerate(s):
        if v != v:
            t, c = 0.0, 0
            continue
        t += v
        c += 1
        if c > p:
            t -= s[i - p]
            c -= 1
        if c == p:
            o[i] = t / p
    return o


def seeded(s, p, k):
    o, prev, t, c = [NAN] * len(s), NAN, 0.0, 0
    for i, v in enumerate(s):
        if v != v:
            continue
        if prev != prev:
            t += v
            c += 1
            if c == p:
                prev = t / p
                o[i] = prev
            continue
        prev = v * k + prev * (1 - k)
        o[i] = prev
    return o


@memo
def ema(s, p):
    return seeded(s, p, 2 / (p + 1))


@memo
def rma(s, p):
    return seeded(s, p, 1 / p)


@memo
def wma(s, p):
    o, d = [NAN] * len(s), p * (p + 1) / 2
    for i in range(p - 1, len(s)):
        w = [s[i - j] for j in range(p)]
        if any(v != v for v in w):
            continue
        o[i] = sum(v * (p - j) for j, v in enumerate(w)) / d
    return o


@memo
def hma(s, p):
    a, b = wma(s, p // 2), wma(s, p)
    return wma([2 * x - y for x, y in zip(a, b)], int(math.sqrt(p)))


@memo
def std(s, p):
    m, o = sma(s, p), [NAN] * len(s)
    for i in range(p - 1, len(s)):
        if m[i] == m[i]:
            o[i] = math.sqrt(sum((s[i - j] - m[i]) ** 2 for j in range(p)) / p)
    return o


@memo
def rsi(s, p):
    n, up, dn = len(s), [NAN] * len(s), [NAN] * len(s)
    for i in range(1, n):
        c = s[i] - s[i - 1]
        if c == c:
            up[i], dn[i] = max(c, 0.0), max(-c, 0.0)
    u, d, o = rma(up, p), rma(dn, p), [NAN] * n
    for i in range(n):
        if u[i] == u[i]:
            o[i] = 100.0 if d[i] == 0 else 0.0 if u[i] == 0 else 100 - 100 / (1 + u[i] / d[i])
    return o


@memo
def true_range(b):
    h, l, c = b["h"], b["l"], b["c"]
    o = [NAN] * len(c)
    for i in range(1, len(c)):
        o[i] = max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1]))
    return o


@memo
def atr(b, p):
    return rma(true_range(b), p)


@memo
def roc(s, p):
    o = [NAN] * len(s)
    for i in range(p, len(s)):
        o[i] = 100 * (s[i] / s[i - p] - 1)
    return o


def window(s, p, skip, f):
    o = [NAN] * len(s)
    for i in range(p - 1 + skip, len(s)):
        o[i] = f(s[i - skip - p + 1:i - skip + 1])
    return o


@memo
def highest(s, p):
    return window(s, p, 1, max)


@memo
def lowest(s, p):
    return window(s, p, 1, min)


@memo
def stoch(b, p):
    hh, ll, o = window(b["h"], p, 0, max), window(b["l"], p, 0, min), [NAN] * len(b["c"])
    for i, c in enumerate(b["c"]):
        r = hh[i] - ll[i]
        if r == r:
            o[i] = 50.0 if r == 0 else 100 * (c - ll[i]) / r
    return o


def typical(b):
    return [(h + l + c) / 3 for h, l, c in zip(b["h"], b["l"], b["c"])]


@memo
def cci(b, p):
    tp, o = typical(b), [NAN] * len(b["c"])
    m = sma(tp, p)
    for i in range(p - 1, len(tp)):
        d = sum(abs(tp[i - j] - m[i]) for j in range(p)) / p
        o[i] = 0.0 if d == 0 else (tp[i] - m[i]) / (0.015 * d)
    return o


@memo
def mfi(b, p):
    tp, n = typical(b), len(b["c"])
    pos, neg, o = [0.0] * n, [0.0] * n, [NAN] * n
    for i in range(1, n):
        f = tp[i] * b["v"][i]
        if tp[i] > tp[i - 1]:
            pos[i] = f
        elif tp[i] < tp[i - 1]:
            neg[i] = f
    for i in range(p, n):
        u, d = sum(pos[i - p + 1:i + 1]), sum(neg[i - p + 1:i + 1])
        o[i] = 100.0 if d == 0 else 100 - 100 / (1 + u / d)
    return o


@memo
def obv(b):
    o, c, v = [0.0] * len(b["c"]), b["c"], b["v"]
    for i in range(1, len(c)):
        o[i] = o[i - 1] + (v[i] if c[i] > c[i - 1] else -v[i] if c[i] < c[i - 1] else 0)
    return o


@memo
def dmi(b, p):
    h, l, n = b["h"], b["l"], len(b["c"])
    pl, mi = [NAN] * n, [NAN] * n
    for i in range(1, n):
        u, d = h[i] - h[i - 1], l[i - 1] - l[i]
        pl[i] = u if u > d and u > 0 else 0.0
        mi[i] = d if d > u and d > 0 else 0.0
    tr, sp, sm = atr(b, p), rma(pl, p), rma(mi, p)
    dp, dm, dx = [NAN] * n, [NAN] * n, [NAN] * n
    for i in range(n):
        if tr[i] != tr[i] or tr[i] == 0:
            continue
        dp[i], dm[i] = 100 * sp[i] / tr[i], 100 * sm[i] / tr[i]
        t = dp[i] + dm[i]
        dx[i] = 0.0 if t == 0 else 100 * abs(dp[i] - dm[i]) / t
    return dp, dm, rma(dx, p)


@memo
def supertrend_dir(b, p, m):
    h, l, c, a = b["h"], b["l"], b["c"], atr(b, p)
    o, up, lo, d = [NAN] * len(c), NAN, NAN, 1
    for i in range(len(c)):
        if a[i] != a[i]:
            continue
        mid = (h[i] + l[i]) / 2
        u, w = mid + m * a[i], mid - m * a[i]
        if up == up:
            u = u if u < up or c[i - 1] > up else up
            w = w if w > lo or c[i - 1] < lo else lo
            if d == -1 and c[i] > up:
                d = 1
            elif d == 1 and c[i] < lo:
                d = -1
        up, lo, o[i] = u, w, d
    return o


@memo
def macd(b, f, s):
    return [x - y for x, y in zip(ema(b["c"], f), ema(b["c"], s))]


@memo
def prev(s, p):
    return [NAN] * p + list(s[:-p])


@memo
def op(k, a, b):
    if k == "add":
        return [x + y for x, y in zip(a, b)]
    if k == "sub":
        return [x - y for x, y in zip(a, b)]
    if k == "mul":
        return [x * y for x, y in zip(a, b)]
    return [x / y if y else NAN for x, y in zip(a, b)]


@memo
def weekday(b):
    return [float((math.floor(t / 86400000) + 4) % 7) for t in b["t"]]


def gt(a, b, i):
    return a[i] > b[i]


def lt(a, b, i):
    return a[i] < b[i]


def xup(a, b, i):
    return i > 0 and a[i] > b[i] and a[i - 1] <= b[i - 1]


def xdn(a, b, i):
    return i > 0 and a[i] < b[i] and a[i - 1] >= b[i - 1]


def backtest(rule, b, fee=0.00055, slip=0.0002):
    """Next-bar-open fills, slippage against the trade, a gapped stop fills at the open, stop before target in one bar."""
    o, h, l, c, n = b["o"], b["h"], b["l"], b["c"], len(b["c"])
    a = atr(b, 14)
    eq, d, ent, base, stop, tp, ent_i, pending, trades = 1.0, 0, 0.0, 1.0, NAN, NAN, -1, 0, []

    def open_pos(dd, px, i):
        nonlocal d, ent, base, ent_i, stop, tp
        d, ent, base, ent_i = dd, px * (1 + dd * slip), eq * (1 - fee), i
        stop, tp = NAN, NAN
        if rule["stop"]:
            kind, v = rule["stop"]
            stop = ent - d * v * a[i - 1] if kind == "atr" else ent * (1 - d * v / 100)
        if rule["target"]:
            kind, v = rule["target"]
            tp = ent + d * v * abs(ent - stop) if kind == "r" else ent + d * v * a[i - 1] if kind == "atr" else ent * (1 + d * v / 100)

    def close_pos(px, i, why, no_slip=False):
        nonlocal eq, d
        fill = px if no_slip else px * (1 - d * slip)
        val = max(0.0, base * (1 + d * (fill / ent - 1))) * (1 - fee)
        trades.append(dict(entry_i=ent_i, exit_i=i, side=d, entry=ent, exit=fill, why=why, ret=val / eq0[0] - 1))
        eq, d = val, 0

    eq0 = [1.0]
    for i in range(1, n):
        if pending:
            act, pending = pending, 0
            if act == 2 and d:
                close_pos(o[i], i, "signal")
            elif act != 2:
                if d and d != act:
                    close_pos(o[i], i, "reverse")
                if not d and a[i - 1] == a[i - 1]:
                    eq0[0] = eq
                    open_pos(act, o[i], i)
        if d:
            if rule["trail"]:
                w = c[i - 1] - d * rule["trail"] * a[i - 1]
                if i - 1 >= ent_i and w == w and (stop != stop or (w > stop if d > 0 else w < stop)):
                    stop = w
            hit_s = stop == stop and (l[i] <= stop if d > 0 else h[i] >= stop)
            hit_t = tp == tp and (h[i] >= tp if d > 0 else l[i] <= tp)
            if hit_s:
                close_pos(min(o[i], stop) if d > 0 else max(o[i], stop), i, "stop")
            elif hit_t:
                close_pos(max(o[i], tp) if d > 0 else min(o[i], tp), i, "target", True)
        if i == n - 1:
            break
        if d and rule["max_bars"] and i - ent_i + 1 >= rule["max_bars"]:
            pending = 2
            continue
        if d > 0 and rule["exit_long"] and rule["exit_long"](b, i):
            pending = 2
        if d < 0 and rule["exit_short"] and rule["exit_short"](b, i):
            pending = 2
        if d >= 0 and rule["entry_short"] and rule["entry_short"](b, i) and not (d > 0 and not rule["reverse"]):
            pending = -1
        if d <= 0 and rule["entry_long"] and rule["entry_long"](b, i) and not (d < 0 and not rule["reverse"]):
            pending = 1
    return trades


def load(path):
    b = dict(t=[], o=[], h=[], l=[], c=[], v=[])
    with open(path) as f:
        for r in csv.DictReader(f):
            for k, name in (("t", "time"), ("o", "open"), ("h", "high"), ("l", "low"), ("c", "close"), ("v", "volume")):
                b[k].append(float(r[name]))
    LEN[0] = len(b["c"])
    return b


def main(rule):
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    tr = backtest(rule, load(sys.argv[1]))
    eq = 1.0
    for t in tr:
        eq *= 1 + t["ret"]
    wins = sum(1 for t in tr if t["ret"] > 0)
    print(json.dumps(dict(strategy=rule["name"], trades=len(tr), win_rate=round(100 * wins / max(1, len(tr)), 1), return_pct=round((eq - 1) * 100, 2))))

# ---------- the bot: paper money only, on the MarginPad Bot API ----------
import argparse, os, time, urllib.error, urllib.parse, urllib.request

API = "https://marginpad.io/api"


def http(path, body=None, key=None):
    headers = {"content-type": "application/json", "user-agent": "marginpad-strategy-bot"}
    if key:
        headers["x-api-key"] = key
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, headers=headers, method="POST" if body is not None else "GET")
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return dict(error=e.code, detail=e.read().decode()[:300])


def closed_candles(symbol, minutes):
    """Candles with the forming bar removed: a rule only ever reads a closed bar."""
    j = http("/v1/klines?symbol=%s&interval=%d" % (urllib.parse.quote(symbol), minutes))
    rows = j.get("data", j) if isinstance(j, dict) else j
    if not isinstance(rows, list) or len(rows) < 60:
        raise SystemExit("no candles: %s" % str(j)[:200])
    now = time.time()
    rows = [x for x in rows if x["time"] + minutes * 60 <= now]
    _memo.clear()
    KEEP.clear()
    LEN[0] = len(rows)
    return dict(t=[x["time"] * 1000.0 for x in rows], o=[float(x["open"]) for x in rows], h=[float(x["high"]) for x in rows],
                l=[float(x["low"]) for x in rows], c=[float(x["close"]) for x in rows], v=[float(x.get("vol") or 0) for x in rows])


def levels(rule, side, px, a):
    d, out = (1 if side == "long" else -1), {}
    stop = NAN
    if rule["stop"]:
        kind, v = rule["stop"]
        stop = px - d * v * a if kind == "atr" else px * (1 - d * v / 100)
        out["sl"] = round(stop, 8)
    if rule["target"]:
        kind, v = rule["target"]
        out["tp"] = round(px + d * v * abs(px - stop) if kind == "r" else px + d * v * a if kind == "atr" else px * (1 + d * v / 100), 8)
    if rule["trail"]:
        out["trail_pct"] = round(max(0.05, min(50.0, 100 * rule["trail"] * a / px)), 3)
    return out


def step(rule, a):
    b = closed_candles(a.symbol, a.minutes)
    i = len(b["c"]) - 1
    r = http("/bot/v1/positions", key=a.key)
    rows = r if isinstance(r, list) else r.get("positions", r.get("data", []))
    if isinstance(r, dict) and r.get("error"):
        print("positions refused:", r)
        return
    mine = [p for p in rows if p.get("symbol") == a.symbol and p.get("status", "open") == "open"]
    pos = mine[0] if mine else None
    want = None
    if pos:
        long_pos = pos.get("side") == "long"
        held = (time.time() * 1000 - float(pos.get("opened_ts") or time.time() * 1000)) / (a.minutes * 60000)
        out = rule["exit_long"] if long_pos else rule["exit_short"]
        opp = rule["entry_short"] if long_pos else rule["entry_long"]
        rev = bool(rule["reverse"] and opp and opp(b, i))
        if rev or (out and out(b, i)) or (rule["max_bars"] and held >= rule["max_bars"]):
            print("close", a.symbol, http("/bot/v1/close", dict(id=pos.get("id")), key=a.key))
            pos = None
            if rev:
                want = "short" if long_pos else "long"
    if not pos and not want:
        if rule["entry_long"] and rule["entry_long"](b, i):
            want = "long"
        elif rule["entry_short"] and rule["entry_short"](b, i):
            want = "short"
    if want:
        body = dict(symbol=a.symbol, side=want, margin_usd=a.margin, leverage=1, client_order_id="%s-%d" % (a.symbol, b["t"][i]))
        body.update(levels(rule, want, b["c"][i], atr(b, 14)[i]))
        if a.check:
            body["dry_run"] = True
        print("open", want, a.symbol, http("/bot/v1/open", body, key=a.key))
    else:
        print(time.strftime("%H:%M:%S"), a.symbol, "no signal on the last closed bar", "(in a position)" if pos else "")


def main_bot(rule, minutes):
    p = argparse.ArgumentParser(description=rule["name"] + ": paper trading on the MarginPad Bot API. No real money.")
    p.add_argument("symbol", nargs="?", default="BTC")
    p.add_argument("--margin", type=float, default=100, help="paper margin per trade in USD")
    p.add_argument("--minutes", type=int, default=minutes, help="candle length; the rule was tested on %d" % minutes)
    p.add_argument("--once", action="store_true", help="read one closed bar and stop")
    p.add_argument("--check", action="store_true", help="price the trade with dry_run and place nothing")
    a = p.parse_args()
    a.key = os.environ.get("MARGINPAD_KEY")
    if not a.key:
        sys.exit("Set MARGINPAD_KEY. Get a key at https://marginpad.io/trading-api/")
    a.symbol = a.symbol.upper()
    while True:
        step(rule, a)
        if a.once:
            return
        wait = a.minutes * 60 - time.time() % (a.minutes * 60) + 5
        time.sleep(wait)


RULE = dict(
    name="Dip or Breakout",
    entry_long=lambda b, i: (xdn(rsi(b["c"], 14), num(35), i) or gt(b["c"], highest(b["h"], 20), i)),
    exit_long=None,
    entry_short=None,
    exit_short=None,
    reverse=False,
    stop=("pct", 8),
    target=("pct", 12),
    trail=None,
    max_bars=None,
)

if __name__ == "__main__":
    main_bot(RULE, 1440)
