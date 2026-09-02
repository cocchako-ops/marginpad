// Storage factory. Driver chosen by config (DB_DRIVER). Every driver returns the SAME interface:
//   migrate(dir), insert(ev)->bool, aggregateNew()->n, histogram(symbol,minutes)->[],
//   live(symbol,limit,minNotional)->[], prune(days)->n, stats()->{}, close()
import { Worker } from 'node:worker_threads';
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

// Async reads through the reader worker thread (./reader.js). The API's whole-day aggregates took 2-10s
// each on the droplet and ran on the main thread, where the exchange sockets live; a burst of them was a
// 30-50s stall that dropped every venue. Reads now wait in the worker; the main thread only writes.
const READ_TIMEOUT_MS = 25000; // nginx gives up at 30s — fail the request before it does, and never queue forever
const READS = ['histogram', 'live', 'feed', 'pulse', 'liqBySymbol', 'oi24h', 'stats', 'getClusters', 'exportDay', 'latestOi'];
function asyncReads(path) {
  let worker = null, seq = 0; const pending = new Map();
  const stats = { restarts: 0, inflight: 0, timeouts: 0, errors: 0, maxMs: 0 };
  function spawn() {
    worker = new Worker(new URL('./reader.js', import.meta.url), { workerData: { path } });
    worker.on('message', (m) => {
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id); clearTimeout(p.t); stats.inflight = pending.size;
      if (m.ms > stats.maxMs) stats.maxMs = m.ms;
      if (m.ms >= SLOW_MS) log.warn('slow read (worker)', { fn: p.fn, ms: m.ms });
      if (m.ok) p.res(m.v); else { stats.errors++; p.rej(new Error(m.err)); }
    });
    worker.on('error', (e) => { log.error('reader worker error', { e: String(e) }); });
    worker.on('exit', (code) => {
      log.warn('reader worker exited — respawning', { code });
      for (const [id, p] of pending) { clearTimeout(p.t); p.rej(new Error('reader restarted')); pending.delete(id); }
      stats.restarts++; setTimeout(spawn, 500);
    });
  }
  spawn();
  const out = { readerStats: () => ({ ...stats, inflight: pending.size }) }; // not 'stats' — that name is the DB stats read below
  for (const fn of READS) {
    out[fn] = (...args) => new Promise((res, rej) => {
      const id = ++seq;
      const t = setTimeout(() => { pending.delete(id); stats.timeouts++; rej(new Error('read timeout: ' + fn)); }, READ_TIMEOUT_MS);
      pending.set(id, { res, rej, t, fn });
      try { worker.postMessage({ id, fn, args }); } catch (e) { clearTimeout(t); pending.delete(id); rej(e); }
    });
  }
  return out;
}

export function createStorage() {
  if (config.db.driver === 'sqlite') {
    const st = timed(createSqliteStorage(config.db.sqlitePath));
    st.async = asyncReads(config.db.sqlitePath);
    return st;
  }
  // For production you'll add ./pg.js (node-postgres) exposing the same interface, then set
  // DB_DRIVER=postgres + DATABASE_URL. See README "Switching to Postgres".
  throw new Error(`Unsupported DB_DRIVER '${config.db.driver}'. Use 'sqlite' (default) or implement the pg driver.`);
}
