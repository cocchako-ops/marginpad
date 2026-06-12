// Entry point. Wires collectors -> dedup/insert -> aggregate, and serves the read API.
// Designed for pm2/systemd: crash-safe, graceful SIGTERM, no shared state with the website.
import './env.js'; // MUST be first — populates process.env from collector/.env before config is read
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { config } from '../config.js';
import { log } from './logger.js';
import { createStorage } from './storage/index.js';
import { createApiServer } from './api/server.js';
import { BinanceCollector } from './collectors/binance.js';
import { BybitCollector } from './collectors/bybit.js';
import { OkxCollector } from './collectors/okx.js';
import { BitmexCollector } from './collectors/bitmex.js';
import { DeribitCollector } from './collectors/deribit.js';
import { startPhase2 } from './phase2.js';

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
  new DeribitCollector({ symbols: config.symbols, onEvent }),
];

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
    exchanges, db: storage.stats(),
  };
}

function aggregateTick() { try { const n = storage.aggregateNew(); if (n) log.info('aggregated', { rows: n }); } catch (e) { log.error('aggregate failed', { e: String(e) }); } }
function pruneTick() { try { const n = storage.prune(config.retentionDays); if (storage.pruneOi) storage.pruneOi(config.retentionDays); if (n) log.info('pruned old raw', { rows: n }); } catch (e) { log.error('prune failed', { e: String(e) }); } }

async function main() {
  log.info('starting collector', { symbols: config.symbols.length, exchanges: collectors.map((c) => c.name) });
  await Promise.allSettled(collectors.map((c) => c.init()));
  collectors.forEach((c) => c.start());
  const okx = collectors.find((c) => c.name === 'okx');
  const p2 = startPhase2(storage, okx ? okx.ctVal : {});  // Phase 2 OI poller + cluster model
  const aggTimer = setInterval(aggregateTick, config.aggIntervalMs);
  const pruneTimer = setInterval(pruneTick, config.pruneIntervalMs);
  const api = createApiServer({ storage, getStatus, bus });

  function shutdown(sig) {
    log.info('shutting down', { sig });
    clearInterval(aggTimer); clearInterval(pruneTimer);
    try { p2 && p2.stop(); } catch (e) {}
    collectors.forEach((c) => c.shutdown());
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
