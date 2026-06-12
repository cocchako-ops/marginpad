# MarginPad Liquidation Collector

A small, standalone service that maintains websocket connections to crypto-futures exchanges,
normalizes **real liquidation events**, stores them, and serves a read-only HTTP API. It is
**completely separate from the website** — the site reads it over HTTP through a Cloudflare Worker
proxy. If this service dies, the site keeps working; the heatmap just falls back to theoretical lines.

This is **Phase 1** (real liquidation feed). Phase 2 (estimated clusters from Open Interest) builds on top.

## Architecture

```
exchange websockets ──► collectors/{binance,bybit,okx}.js   (one adapter per exchange — all quirks isolated here)
                              │  normalized event { ts, exchange, symbol, side, price, qty, notional }
                              ▼
                        storage (SQLite now → Postgres later)
                          ├─ liquidations (raw, 30-day retention)
                          └─ agg_5m (notional per symbol / 5-min / price-bucket / side — kept forever)
                              ▼
                        read API  /api/v1/liquidations/{recent,live,stream}  +  /api/v1/status
                              ▲
                        Cloudflare Worker proxy (cache + graceful fallback) ──► website
```

Module map: `collectors/` (per-exchange), `base.js` (reconnect/heartbeat), `storage/` (DB drivers),
`aggregator` (in `index.js`), `api/server.js`, `config.js` (all tuning).

## Quick start (local)

```bash
cd collector
npm install
npm run migrate     # creates the SQLite DB + tables
npm start           # connects to all 3 exchanges + serves the API on :8787
```

Check it: `curl http://localhost:8787/api/v1/status`

Requires **Node >= 22** (uses built-in `node:sqlite` + global `WebSocket`; no native modules).

## Deploy (budget VPS, ~$5–10/mo)

```bash
# on the VPS
git clone <repo> && cd <repo>/collector
npm ci
cp .env.example .env          # edit if needed
npm run migrate
npm i -g pm2
pm2 start ecosystem.config.js
pm2 save && pm2 startup       # survive reboots
```

**Update flow (no data gaps):** `git pull && npm i && npm run migrate && pm2 restart marginpad-collector`.
The reconnect logic refills the few-second gap. Never edit code on the live process.

Point the website at it by setting `COLLECTOR_URL` in the site's `wrangler.toml` (or `wrangler secret put COLLECTOR_URL`) to this service's public URL, e.g. `https://collector.yourdomain.com`, then redeploy the Worker. Put the service behind a reverse proxy (Caddy/nginx) for TLS.

## Environment (.env)

| var | default | notes |
|---|---|---|
| `PORT` | 8787 | API port |
| `CORS_ORIGIN` | `*` | tighten to your domain in prod (the Worker proxy is server-side, so CORS is mostly for direct/API users) |
| `DB_DRIVER` | sqlite | `sqlite` (start) or `postgres` (after you add the pg driver) |
| `SQLITE_PATH` | ./data/liquidations.db | |
| `DATABASE_URL` | — | Postgres DSN when you switch |

## API (`/api/v1`)

- `GET /liquidations/recent?symbol=BTC&window=1h|4h|24h|7d` → histogram buckets `[{price,long,short,count}]` (cached ~45s).
- `GET /liquidations/live?symbol=BTC&limit=200&min=50000` → recent raw events (ticker + chart bubbles).
- `GET /liquidations/stream?symbol=BTC` → SSE push of new events (optional; the site uses polling via the Worker).
- `GET /status` → per-exchange socket state, last event time, events/min, DB counts. **Check from your phone.**

Symbols are validated against `config.symbols`. There is a clean **freemium seam** in `api/server.js`
(`gate()`) to later gate symbols / long windows / realtime behind an API key — no paywall is built yet.

## Adding a symbol

Edit `config.js` → `symbols` (and optionally `bucketSize`). Restart. That's it — no code change.

## Adding an exchange

1. Create `src/collectors/<name>.js` extending `BaseCollector`; implement `url()`, `subscribeFrames()`,
   `pingFrame()`, and `parse()` returning normalized events. Document the side convention + any unit quirks
   (like OKX contracts → base via `ctVal`).
2. Register it in `src/index.js`.
3. **Verify the message schema against the exchange's official docs first** — do not trust memory; exchanges change streams.

## Switching to Postgres (production)

1. `npm i pg`, add `src/storage/pg.js` exposing the **same interface** as `sqlite.js`
   (`migrate, insert, aggregateNew, histogram, live, prune, stats, close`).
2. Add Postgres-flavored files under `migrations/` (SERIAL/UPSERT syntax) — keep them **numbered**; never hand-edit the prod DB.
3. Set `DB_DRIVER=postgres` + `DATABASE_URL`. Wire the driver in `src/storage/index.js`.

## Backups

`./backup.sh` snapshots the DB (SQLite `.backup`, or `pg_dump` for Postgres) and prunes to 14 local copies.
Add a daily cron and an **off-site copy to Cloudflare R2** (see the commented `rclone` line) — aggregates
can't be regenerated once raw data is pruned.

## Monitoring

Point **UptimeRobot** (free) at `/api/v1/status` and alert (email/Telegram) when it's unreachable or stale.
A silently-dead collector is the worst failure — the site looks alive while data rots. 15 minutes to set up.

## Phase 2 (later)

`config.js` already holds the knobs: `leverageDistribution`, `clusterBucketPct`, `clusterHalfLifeDays`, `mmr`.
Phase 2 adds an OI poller + cluster model + a third chart layer ("Estimated clusters"), labelled as a model.
