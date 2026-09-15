"""MarginPad Bot API client - one file, no dependencies (Python 3.8+).

    from marginpad import MarginPad
    mp = MarginPad("mpb_...")                      # key from https://marginpad.io/trading-api/
    print(mp.price("BTC"))                         # keyless market data
    pos = mp.open("BTC", "long", margin_usd=100, leverage=10, sl=58000, tp=66000,
                  client_order_id="sig-2026-09-11-1403")   # idempotent: a retry returns the same position
    mp.sltp(pos["id"], trail_pct=1.5)              # trailing stop, ratcheted server-side
    print(mp.account())

Every method returns the `data` part of the v2 envelope as a dict/list and raises MarginPadError on
{"ok": false}. Rate limits: the client sleeps and retries ONCE on 429 when auto_retry=True (default).
WebSocket stream (`stream()`) needs the optional `websockets` package: pip install websockets.
Docs: https://marginpad.io/trading-api/  ·  Spec: https://marginpad.io/api/openapi.json
"""
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.parse
import urllib.request

__version__ = "2.6.0"
__all__ = ["MarginPad", "MarginPadError", "verify_webhook"]


class MarginPadError(Exception):
    """Raised for every {"ok": false} answer. .code is stable, .message is prose, .status is the HTTP status."""

    def __init__(self, code, message="", status=0, extra=None):
        super().__init__("%s: %s" % (code, message or code))
        self.code = code
        self.message = message
        self.status = status
        self.extra = extra or {}


def verify_webhook(secret, raw_body, signature_header):
    """True when X-MP-Signature matches HMAC-SHA256(secret, raw body). Compare BEFORE parsing the body."""
    if isinstance(raw_body, str):
        raw_body = raw_body.encode("utf-8")
    want = "sha256=" + hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(want, str(signature_header or ""))


class MarginPad(object):
    def __init__(self, api_key=None, base="https://marginpad.io", timeout=15, auto_retry=True, user_agent=None):
        self.api_key = api_key
        self.base = base.rstrip("/")
        self.timeout = timeout
        self.auto_retry = auto_retry
        self.user_agent = user_agent or ("marginpad-python/" + __version__)
        self.last_headers = {}
        self._etag = None

    # ── transport ────────────────────────────────────────────────────────────────────────────────────────
    def _call(self, method, path, params=None, body=None, keyed=True, headers=None, _retried=False):
        url = self.base + path
        if params:
            q = {k: v for k, v in params.items() if v is not None}
            if q:
                url += ("&" if "?" in url else "?") + urllib.parse.urlencode(q)
        h = {"accept": "application/json", "user-agent": self.user_agent}
        if keyed and self.api_key:
            h["x-api-key"] = self.api_key
        if headers:
            h.update(headers)
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            h["content-type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                self.last_headers = dict(r.headers)
                if r.status == 304:
                    return None
                raw = r.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            self.last_headers = dict(e.headers)
            if e.code == 304:
                return None
            if e.code == 429 and self.auto_retry and not _retried:
                wait = e.headers.get("retry-after")
                time.sleep(min(60, max(1, int(wait) if wait and wait.isdigit() else 5)))
                return self._call(method, path, params, body, keyed, headers, _retried=True)
            raw = e.read().decode("utf-8", "replace")
            try:
                j = json.loads(raw)
            except ValueError:
                raise MarginPadError("http_%d" % e.code, raw[:200], e.code)
            err = j.get("error") if isinstance(j, dict) else None
            if isinstance(err, dict):
                raise MarginPadError(err.get("code", "error"), err.get("message", ""), e.code, err)
            raise MarginPadError(str(err or "http_%d" % e.code), j.get("hint", "") if isinstance(j, dict) else "", e.code, j)
        j = json.loads(raw)
        if isinstance(j, dict) and j.get("ok") is False:
            err = j.get("error") or {}
            raise MarginPadError(err.get("code", "error"), err.get("message", ""), 200, err)
        return j.get("data", j) if isinstance(j, dict) else j

    def _get(self, path, keyed=True, **params):
        return self._call("GET", path, params=params, keyed=keyed)

    def _post(self, path, **body):
        return self._call("POST", path, body={k: v for k, v in body.items() if v is not None})

    # ── market data (keyless; send the key anyway and it counts against your per-key budget) ────────────
    def price(self, symbol):
        return self._get("/api/v1/price", symbol=symbol)

    def prices(self):
        return self._get("/api/v1/prices")

    def klines(self, symbol, interval=60, end_ms=None):
        return self._get("/api/v1/klines", symbol=symbol, interval=interval, end=end_ms)

    def markets(self, asset_class=None):
        return self._get("/api/bot/v2/markets", **{"class": asset_class})

    def screener(self):
        return self._get("/api/v1/screener")

    def funding(self):
        return self._get("/api/v1/funding")

    def open_interest(self):
        return self._get("/api/v1/open-interest")

    def liquidations(self):
        return self._get("/api/v1/liquidations")

    def fear_greed(self):
        return self._get("/api/v1/fear-greed")

    def calendar(self, year=None):
        return self._get("/api/v1/calendar", year=year)

    def server_time(self):
        return self._get("/api/bot/v2/time", keyed=False, client_ts=int(time.time() * 1000))

    # ── paper trading ───────────────────────────────────────────────────────────────────────────────────
    def open(self, symbol, side, margin_usd, leverage, sl=None, tp=None, trail_pct=None, client_order_id=None, dry_run=False,
             slippage=None, margin_tiers=None, mmr_pct=None, fee_venue=None):
        """Market open at the live price. dry_run=True prices the trade and writes nothing.

        slippage / margin_tiers / mmr_pct override this account's realism setting for THIS fill only (see realism()).
        fee_venue charges this one position at a named venue's taker schedule (see fees())."""
        return self._post("/api/bot/v2/open", symbol=symbol, side=side, margin_usd=margin_usd, leverage=leverage, sl=sl, tp=tp, trail_pct=trail_pct, client_order_id=client_order_id, dry_run=True if dry_run else None,
                          slippage=slippage, margin_tiers=margin_tiers, mmr_pct=mmr_pct, fee_venue=fee_venue)

    def limit_order(self, symbol, side, limit_price, margin_usd, leverage, sl=None, tp=None, trail_pct=None, client_order_id=None, dry_run=False):
        """Pullback entry: a long below the market, a short above it. Fills AT the level from 1m candles."""
        return self._post("/api/bot/v2/open", type="limit", symbol=symbol, side=side, limit_price=limit_price, margin_usd=margin_usd, leverage=leverage, sl=sl, tp=tp, trail_pct=trail_pct, client_order_id=client_order_id, dry_run=True if dry_run else None)

    def stop_order(self, symbol, side, stop_price, margin_usd, leverage, sl=None, tp=None, trail_pct=None, client_order_id=None, dry_run=False):
        """Breakout entry: a long above the market, a short below it."""
        return self._post("/api/bot/v2/open", type="stop", symbol=symbol, side=side, limit_price=stop_price, margin_usd=margin_usd, leverage=leverage, sl=sl, tp=tp, trail_pct=trail_pct, client_order_id=client_order_id, dry_run=True if dry_run else None)

    def orders(self):
        return self._get("/api/bot/v2/orders")

    def modify_order(self, order_id, limit_price=None, sl=None, tp=None, margin_usd=None, leverage=None, trail_pct=None):
        return self._call("POST", "/api/bot/v2/modify_order", body={"order_id": order_id, **{k: v for k, v in dict(limit_price=limit_price, sl=sl, tp=tp, margin_usd=margin_usd, leverage=leverage, trail_pct=trail_pct).items() if v is not None}})

    def cancel_order(self, order_id):
        return self._post("/api/bot/v2/cancel_order", order_id=order_id)

    def close(self, position_id, symbol=None, pct=None, client_order_id=None):
        """Pass symbol (every position carries it): one price fetch, one round trip."""
        return self._post("/api/bot/v2/close", id=position_id, symbol=symbol, pct=pct, client_order_id=client_order_id)

    def close_all(self):
        return self._call("POST", "/api/bot/v2/close_all", body={})

    def sltp(self, position_id, sl="keep", tp="keep", trail_pct="keep"):
        """Move SL / TP / trailing stop. None clears a level; omit to keep it."""
        body = {"id": position_id}
        if sl != "keep":
            body["sl"] = sl
        if tp != "keep":
            body["tp"] = tp
        if trail_pct != "keep":
            body["trail_pct"] = trail_pct
        return self._call("POST", "/api/bot/v2/sltp", body=body)

    def positions(self, status=None, since_ms=None, use_etag=True):
        """Returns None when nothing changed since the last call (304) and use_etag is on."""
        h = {"if-none-match": self._etag} if (use_etag and self._etag) else None
        d = self._call("GET", "/api/bot/v2/positions", params={"status": status, "since": since_ms}, headers=h)
        et = self.last_headers.get("etag") or self.last_headers.get("ETag")
        if et:
            self._etag = et
        return d

    def trades(self, limit=100, before_ms=None):
        return self._get("/api/bot/v2/trades", limit=limit, before=before_ms)

    def account(self):
        return self._get("/api/bot/v2/account")

    def balance(self):
        return self._get("/api/bot/v2/balance")

    def usage(self):
        return self._get("/api/bot/v2/usage")

    def report(self, days=30):
        return self._get("/api/bot/v2/report", days=days)

    # 2.5 books, reset, equity · 2.6 replay
    def accounts(self):
        return self._get("/api/bot/v2/accounts")

    def reset(self):
        """Restart this key's book at $10,000 (closed trades archived, orders cancelled). Refused while positions are open."""
        return self._post("/api/bot/v2/reset", confirm=True)

    def equity(self, days=30, step_min=None):
        return self._get("/api/bot/v2/equity", days=days, step_min=step_min)

    def replay_start(self, symbol, day, speed=60):
        """Run this key through one past UTC day (YYYY-MM-DD) on MarginPad's 1-minute candles. speed = market seconds per real second (1-600)."""
        return self._post("/api/bot/v2/replay", symbol=symbol, day=day, speed=speed)

    def replay(self, interval=None, bars=None):
        """Replay status: cursor, price, progress and the candles up to the cursor."""
        return self._get("/api/bot/v2/replay", interval=interval, bars=bars)

    def replay_stop(self):
        return self._post("/api/bot/v2/replay", act="stop")

    def ai(self, symbol, interval=60, question=None, lang=None):
        """Premium: the chart panel's AI read. Educational, not advice."""
        return self._post("/api/bot/v2/ai", symbol=symbol, interval=str(interval), question=question, lang=lang)

    # ── webhooks (Premium) ──────────────────────────────────────────────────────────────────────────────
    # -- fee schedule and fill realism (2.9) ------------------------------------------------------------
    def fees(self, venue=None):
        """Read the fee schedules, or set which venue's taker fee your fills are charged at.
        fees() -> the table plus your default.  fees("binance") -> sets it.  fees("") -> back to our rate."""
        if venue is None:
            return self._get("/api/bot/v2/fees")
        return self._post("/api/bot/v2/fees", venue=venue)

    def realism(self, slippage=None, margin_tiers=None, margin_venue=None):
        """Read or set fill realism. Both switches are OFF by default: a market order fills at the live
        price and maintenance margin is a flat 0.5%, which is easier than a real venue and increasingly so as
        a position grows. Reading also returns the whole size-tier ladder and every venue's margin rate, so
        you never have to work out where a liquidation price came from.

            c.realism()                                   # what am I on, and what are the tiers
            c.realism(slippage=True, margin_tiers=True)    # test against something closer to a real book
            c.realism(margin_venue="binance")              # liquidate where Binance would
        """
        if slippage is None and margin_tiers is None and margin_venue is None:
            return self._get("/api/bot/v2/realism")
        body = {}
        if slippage is not None:
            body["slippage"] = bool(slippage)
        if margin_tiers is not None:
            body["margin_tiers"] = bool(margin_tiers)
        if margin_venue is not None:
            body["margin_venue"] = margin_venue
        return self._post("/api/bot/v2/realism", **body)

    def webhooks(self):
        return self._get("/api/bot/v2/webhooks")

    def add_webhook(self, url, events=None):
        return self._post("/api/bot/v2/webhooks", act="add", url=url, events=events)

    def delete_webhook(self, webhook_id):
        return self._post("/api/bot/v2/webhooks", act="delete", id=webhook_id)

    def test_webhook(self, webhook_id):
        return self._post("/api/bot/v2/webhooks", act="test", id=webhook_id)

    # ── WebSocket stream (optional dependency: websockets) ──────────────────────────────────────────────
    def stream(self, on_event, channels=("positions", "prices"), reconnect=True):
        """Blocks; calls on_event(dict) for every message. pip install websockets."""
        import asyncio
        try:
            import websockets
        except ImportError:
            raise RuntimeError("pip install websockets  (needed only for stream())")
        url = self.base.replace("https://", "wss://").replace("http://", "ws://") + "/api/bot/v2/stream?api_key=" + urllib.parse.quote(self.api_key or "")

        async def run():
            while True:
                try:
                    async with websockets.connect(url, ping_interval=25) as ws:
                        await ws.send(json.dumps({"op": "subscribe", "channels": list(channels)}))
                        async for raw in ws:
                            try:
                                on_event(json.loads(raw))
                            except Exception:
                                pass
                except Exception:
                    if not reconnect:
                        raise
                    await asyncio.sleep(3)
                if not reconnect:
                    return

        asyncio.get_event_loop().run_until_complete(run())
