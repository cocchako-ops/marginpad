// Entry point. Wires collectors -> dedup/insert -> aggregate, and serves the read API.
// Designed for pm2/systemd: crash-safe, graceful SIGTERM, no shared state with the website.
import './env.js'; // MUST be first - populates process.env from collector/.env before config is read
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config.js';
import { log } from './logger.js';
import { createStorage, slowStorageCalls } from './storage/index.js';
import { createApiServer } from './api/server.js';
import { BinanceCollector } from './collectors/binance.js';
import { BybitCollector } from './collectors/bybit.js';
import { OkxCollector } from './collectors/okx.js';
import { BitmexCollector } from './collectors/bitmex.js';
// Deribit UNWIRED 2026-08-16 - their new matching engine dropped the `liquidation` flag from public
// trades, and no liquidations channel/method exists any more (see the header of collectors/deribit.js
// for the measurements). The file is kept so it can be re-wired the day Deribit publishes them again.
import { BitfinexCollector } from './collectors/bitfinex.js';
import { BinanceCoinCollector } from './collectors/binancecoin.js';
import { GateLiqCollector, HtxLiqCollector, DydxLiqCollector } from './collectors/restpoll.js'; // REST-polled public liq feeds (2026-07-25)
import { HyperliquidLiqCollector } from './collectors/hyperliquid.js'; // counterparty-harvest detection (no public liq stream exists)
import { BookCollector } from './collectors/book.js';   // order book state (2026-09-21) - memory only, phase 00
import { TapeCollector } from './collectors/tape.js';   // trade tape - memory only, phase 00
import { startPhase2 } from './phase2.js';
import { startWhales } from './whales.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const startedAt = Date.now();

const storage = createStorage();
storage.migrate(migrationsDir);

const bus = new EventEmitter();
bus.setMaxListeners(0);

// per-exchange event timestamps -> events/min for /status
const recent = new Map();
function track(ex) { let a = recent.get(ex); if (!a) { a = []; recent.set(ex, a); } a.push(Date.now()); if (a.length > 4000) a.splice(0, a.length - 2000); }

let inserted = 0, deduped = 0;
function onEvent(e) {
  track(e.exchange);
  if (storage.insert(e)) { inserted++; bus.emit('liq', e); } else deduped++;
}

const collectors = [
  new BinanceCollector({ symbols: config.symbols, onEvent }),
  new BybitCollector({ symbols: config.symbols, onEvent }),
  new OkxCollector({ symbols: config.symbols, onEvent }),
  new BitmexCollector({ symbols: config.symbols, onEvent }),
  new BitfinexCollector({ symbols: config.symbols, onEvent }),
  new BinanceCoinCollector({ symbols: config.symbols, onEvent }),
  new GateLiqCollector({ symbols: config.symbols, onEvent }),
  new HtxLiqCollector({ symbols: config.symbols, onEvent }),
  new DydxLiqCollector({ symbols: config.symbols, onEvent }),
  new HyperliquidLiqCollector({ symbols: config.symbols, onEvent }),
];

// ORDER BOOK AND TRADE TAPE - PHASE 00: they live entirely in memory and touch neither storage nor the
// bus. The point of this first cut is to prove they cost the existing feed nothing; `MP_BOOK=0` plus a pm2
// restart removes them without a deploy. They are also built as SEPARATE collectors on separate sockets,
// so a book problem can never take a liquidation subscription with it.
const bookCols = config.book.enabled
  ? config.book.bookVenues.map((v) => new BookCollector(v, { symbols: config.book.symbols }))
  : [];
const tapeCols = config.book.enabled
  ? config.book.tapeVenues.map((v) => new TapeCollector(v, { symbols: config.book.symbols }))
  : [];

// Event-loop stall detector: a 1s heartbeat measures how late it fires. Exposed on /status so a
// "silent socket" can be told apart from a process that could not read its sockets at the time.
const loopLag = { maxMs: 0, max5mMs: 0, stalls: 0, lastStallAt: 0 };
let _lagT = Date.now(), _lag5mReset = Date.now();
setInterval(() => {
  const now = Date.now(); const lag = now - _lagT - 1000; _lagT = now;
  if (lag > loopLag.maxMs) loopLag.maxMs = lag;
  if (now - _lag5mReset > 300000) { loopLag.max5mMs = 0; _lag5mReset = now; }
  if (lag > loopLag.max5mMs) loopLag.max5mMs = lag;
  if (lag > 2000) { loopLag.stalls++; loopLag.lastStallAt = now; log.warn('event loop stalled', { lagMs: lag }); }
}, 1000);

function getStatus() {
  const now = Date.now();
  const exchanges = collectors.map((c) => {
    const a = recent.get(c.name) || [];
    return { ...c.status(), eventsPerMin: a.filter((t) => t > now - 60000).length };
  });
  return {
    ok: exchanges.some((e) => e.connected),
    startedAt, uptimeSec: Math.floor((now - startedAt) / 1000),
    symbols: config.symbols, inserted, deduped,
    loopLag, slowCalls: slowStorageCalls(),
    exchanges, // db: filled by the /status handler from the reader thread (never a main-thread scan)
    // Everything needed to tell a healthy book from a quietly wrong one, without opening a shell: how many
    // updates were applied, how many sequence gaps were seen, how many resyncs followed, and the state of
    // every symbol's book. venueSkewMs is the venue's clock minus ours - if that number starts drifting,
    // the host's NTP is the problem and every latency figure downstream is about to become fiction.
    book: config.book.enabled ? {
      enabled: true, symbols: config.book.symbols,
      books: bookCols.map((c) => c.status()),
      tape: tapeCols.map((c) => c.status()),
    } : { enabled: false },
  };
}

function aggregateTick() { try { const n = storage.aggregateNew(); if (n) log.info('aggregated', { rows: n }); } catch (e) { log.error('aggregate failed', { e: String(e) }); } }
function pruneTick() { try { const n = storage.prune(config.retentionDays); const oi = storage.pruneOi ? storage.pruneOi(config.retentionDays) : 0; const agg = storage.pruneAgg ? storage.pruneAgg(config.aggRetentionDays || 90) : 0; if (n || oi || agg) log.info('pruned', { raw: n, oi, agg }); } catch (e) { log.error('prune failed', { e: String(e) }); } }

async function main() {
  log.info('starting collector', { symbols: config.symbols.length, exchanges: collectors.map((c) => c.name) });
  await Promise.allSettled(collectors.map((c) => c.init()));
  collectors.forEach((c) => c.start());
  const okx = collectors.find((c) => c.name === 'okx');
  // Started AFTER the liquidation feed is already up, and each one guarded on its own: a book venue that
  // throws on init must not stop the tape, and neither must ever stop the feed that is already working.
  if (config.book.enabled) {
    log.info('starting book + tape', { symbols: config.book.symbols, books: config.book.bookVenues, tape: config.book.tapeVenues });
    await Promise.allSettled([...bookCols, ...tapeCols].map((c) => c.init()));
    for (const c of [...bookCols, ...tapeCols]) { try { c.start(); } catch (e) { log.error('book/tape start failed', { name: c.name, e: String(e) }); } }
  } else log.info('book + tape disabled (MP_BOOK=0)');
startWhales(); // Hyperliquid whale tracker (positions + alerts for /hyperliquid-whales/)
  const p2 = startPhase2(storage, okx ? okx.ctVal : {});  // Phase 2 OI poller + cluster model
  const aggTimer = setInterval(aggregateTick, config.aggIntervalMs);
  const pruneTimer = setInterval(pruneTick, config.pruneIntervalMs);
  // hourly OI snapshot (one Bybit linear tickers call covers every USDT perp) → powers the screener's OI Δ24h
  async function oiSnapTick() {
    try {
      const r = await fetch('https://api.bybit.com/v5/market/tickers?category=linear');
      if (!r.ok) return;
      const j = await r.json();
      const list = (j && j.result && j.result.list) || [];
      const ts = Date.now(), rows = [];
      for (const t of list) {
        if (!/USDT$/.test(t.symbol || '')) continue;
        const v = parseFloat(t.openInterestValue);
        if (v > 0) rows.push({ ts, symbol: String(t.symbol).replace(/USDT$/, ''), oi: v, f: parseFloat(t.fundingRate) * 100 }); // funding stored as % (e.g. 0.01)
      }
      if (rows.length) { storage.saveOiSnap(rows); log.info('oi snapshot', { n: rows.length }); }
    } catch (e) { log.error('oi snapshot failed', { e: String(e) }); }
  }
  oiSnapTick();
  const oiSnapTimer = setInterval(oiSnapTick, 3600000);
  const api = createApiServer({ storage, getStatus, bus, bookCols, tapeCols });

  function shutdown(sig) {
    log.info('shutting down', { sig });
    clearInterval(aggTimer); clearInterval(pruneTimer); clearInterval(oiSnapTimer);
    try { p2 && p2.stop(); } catch (e) {}
    collectors.forEach((c) => c.shutdown());
    [...bookCols, ...tapeCols].forEach((c) => { try { c.shutdown(); } catch (e) {} });
    try { aggregateTick(); } catch {}
    try { api.close(() => {}); } catch {}
    try { storage.close(); } catch {}
    setTimeout(() => process.exit(0), 300);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (e) => log.error('uncaughtException', { e: String((e && e.stack) || e) }));
  process.on('unhandledRejection', (e) => log.error('unhandledRejection', { e: String(e) }));
}
main();
