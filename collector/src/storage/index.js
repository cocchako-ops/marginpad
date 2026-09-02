// Storage factory. Driver chosen by config (DB_DRIVER). Every driver returns the SAME interface:
//   migrate(dir), insert(ev)->bool, aggregateNew()->n, histogram(symbol,minutes)->[],
//   live(symbol,limit,minNotional)->[], prune(days)->n, stats()->{}, close()
import { config } from '../../config.js';
import { createSqliteStorage } from './sqlite.js';
import { log } from '../logger.js';

// Every storage call is synchronous on the main thread, next to the exchange sockets. A call that takes
// seconds is a socket stall; name the culprit so a stall can be attributed instead of guessed.
const SLOW_MS = 800;
const slow = { calls: {} };
export function slowStorageCalls() { return slow.calls; }
function timed(storage) {
  const out = {};
  for (const k of Object.keys(storage)) {
    const fn = storage[k];
    out[k] = typeof fn !== 'function' ? fn : function (...args) {
      const t0 = Date.now();
      try { return fn.apply(storage, args); }
      finally {
        const ms = Date.now() - t0;
        if (ms >= SLOW_MS) { const c = slow.calls[k] = slow.calls[k] || { n: 0, maxMs: 0, lastMs: 0, lastAt: 0 }; c.n++; c.lastMs = ms; c.lastAt = t0; if (ms > c.maxMs) c.maxMs = ms; log.warn('slow storage call', { fn: k, ms, arg: String(args[0] ?? '').slice(0, 24) }); }
      }
    };
  }
  return out;
}

export function createStorage() {
  if (config.db.driver === 'sqlite') return timed(createSqliteStorage(config.db.sqlitePath));
  // For production you'll add ./pg.js (node-postgres) exposing the same interface, then set
  // DB_DRIVER=postgres + DATABASE_URL. See README "Switching to Postgres".
  throw new Error(`Unsupported DB_DRIVER '${config.db.driver}'. Use 'sqlite' (default) or implement the pg driver.`);
}
