# MarginPad SDK

Free crypto-futures **paper trading for bots** and free market data. One key, no KYC, no deposit.
Test a strategy or an AI agent against live prices with real fee schedules, funding, liquidations, limit and stop orders, trailing stops, webhooks and a WebSocket stream, then take the same code to a real exchange.

- Guide: https://marginpad.io/trading-api/
- Reference (OpenAPI, try it live): https://marginpad.io/api-docs/
- Status: https://marginpad.io/status/ - Changelog: https://marginpad.io/api/changelog.xml
- MCP server for Claude, ChatGPT and Cursor: https://marginpad.io/trading-api/#mcp

## Install

```bash
pip install marginpad            # Python 3.8+, no dependencies (pip install "marginpad[stream]" for the WebSocket)
npm install marginpad            # Node 18+, zero dependencies
```

## Python

```python
from marginpad import MarginPad

mp = MarginPad("mpb_...")                                   # key from https://marginpad.io/trading-api/
print(mp.price("BTC"))                                      # keyless market data
pos = mp.open("BTC", "long", margin_usd=100, leverage=10, sl=58000, tp=66000,
              client_order_id="sig-2026-09-12-1403")        # idempotent: a retry returns the same position
mp.sltp(pos["id"], trail_pct=1.5)                           # trailing stop, ratcheted server-side
print(mp.account())
```

## JavaScript

```js
const { MarginPad } = require('marginpad');
const mp = new MarginPad('mpb_...');
const { position } = await mp.open({ symbol: 'BTC', side: 'long', margin_usd: 100, leverage: 10, client_order_id: 'sig-1' });
mp.stream(ev => console.log(ev.type, ev.data));             // positions pushed on change, prices each tick
```

## The simulation is yours to set
<!-- sdk-sim: generated, do not hand-edit -->

Eighteen fields and eight presets, so the paper venue can be the one you will actually trade. The defaults are deliberately frictionless, and nothing you have already built moves until you change them.

```python
mp.sim()                                   # your profile, every field with its range, the presets
mp.sim(preset="realistic")                 # the honest middle, in one call
mp.sim(preset="bybit")                     # Bybit's published taker fee and maintenance margin
mp.sim(preset="brutal")                    # refusals, partial fills, a second of latency
mp.sim(start_balance_usd=2500, margin_enforced=True, slippage_bps=8, latency_ms=250)
mp.sim(reset=True)                         # back to the defaults
```

```js
await mp.sim({ preset: 'realistic' });
await mp.sim({ start_balance_usd: 2500, margin_enforced: true, reject_rate_pct: 2 });
```

The **book** (`start_balance_usd`, `margin_enforced`, `leverage_max`, `max_notional_usd`), the **fill** (`slippage`, `slippage_bps`, `impact_bps_per_100k`, `exit_slippage`, `latency_ms`, `partial_fills`, `min_fill_pct`, `reject_rate_pct`), the **cost** (`taker_bps`, `funding`, `funding_mult`) and the **liquidation** (`margin_venue`, `margin_tiers`, `mmr_pct`).

Out-of-range values are refused, never clamped, and a position keeps the simulation it was filled under for life. `margin_enforced` turns the balance into a real budget: size past it and the open comes back 402, which is the failure a live bot has to handle and a frictionless simulator never shows you. `reject_rate_pct` is the one a retry loop is worth writing for.

Every field with its range: https://marginpad.io/trading-api/#sim

## Examples

- `examples/agent_loop.py`: a signal loop that opens, manages and closes positions once a minute without polling storms.
- `examples/webhook_server.js`: receive `position.closed` / `order.filled` events with signature verification.
- `examples/mcp.md`: let Claude Desktop or Cursor trade on your paper account through the MCP server.

## Limits
<!-- sdk-limits: generated from API_PLANS, do not hand-edit -->

| Plan | Requests/min | Keys | Open positions | Books | Webhooks |
|---|---|---|---|---|---|
| Free $0 | 120 | 3 | 50 | 1 | - |
| Pro $39 | 600 | 10 | 200 | 5 | 3 |
| Max $99 | 2000 | 30 | 500 | 20 | 15 |
| Business $199 | 5000 | 100 | 1000 | 50 | 50 |

An API plan is its own product: a MarginPad Premium subscription buys nothing here, and an API plan buys nothing on the site. The whole engine, the simulation, several books per key, the replay, the WebSocket stream and every market-data endpoint are free - only webhooks and the AI read are gated. Trade history is 30 days on Free and 90 on a paid plan.

Measured in production: the busiest bot peaks at 66 requests a minute against the Free ceiling of 120, and no key has ever been rate-limited on any plan. Choose on keys and history, not on throughput.

Every response carries `X-RateLimit-Limit / Remaining / Reset`; on 429 both clients wait `Retry-After` and retry once. Out-of-range input is refused with a named error (`leverage_max` carries the market's cap), never silently clamped.

## Honesty note

This is a simulator. Fees, funding and liquidation maths mirror real exchanges and every fill condition above is yours to set - but there is no order book behind `impact_bps_per_100k`, so market impact is modelled rather than measured on depth, and a stop, target or liquidation fills at its own level without paying the crossing cost. A bot that passes here still needs a small live test. Educational use, not financial advice.

MIT licensed.
