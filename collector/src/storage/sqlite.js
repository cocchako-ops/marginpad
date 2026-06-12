// SQLite storage driver (the "start simple" backend). Uses Node's built-in node:sqlite (Node >=22).
// Everything DB-specific lives behind this module so swapping to Postgres is a one-file change.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bucketSizeFor } from '../../config.js';
import { log } from '../logger.js';

export function createSqliteStorage(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  let insertStmt, aggUpsert, getMeta, setMeta;
  function prepareAll() {
    insertStmt = db.prepare(`INSERT OR IGNORE INTO liquidations (ts,exchange,symbol,side,price,qty,notional) VALUES (?,?,?,?,?,?,?)`);
    aggUpsert = db.prepare(`INSERT INTO agg_5m (symbol,win_start,price_bucket,side,notional,cnt) VALUES (?,?,?,?,?,1)
      ON CONFLICT(symbol,win_start,price_bucket,side) DO UPDATE SET notional=notional+excluded.notional, cnt=cnt+1`);
    getMeta = db.prepare('SELECT v FROM meta WHERE k=?');
    setMeta = db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
  }
  function ensure() { if (!insertStmt) prepareAll(); } // prepares lazily once tables exist

  function migrate(dir) {
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const f of files) {
      let applied = false;
      try { applied = !!db.prepare('SELECT 1 FROM _migrations WHERE name=?').get(f); } catch { /* _migrations not created yet */ }
      if (applied) continue;
      db.exec(readFileSync(join(dir, f), 'utf8'));
      try { db.prepare('INSERT OR IGNORE INTO _migrations (name,applied_at) VALUES (?,?)').run(f, Date.now()); } catch {}
      log.info('migration applied', { file: f });
    }
    prepareAll();
  }

  function insert(ev) {
    ensure();
    const r = insertStmt.run(ev.ts, ev.exchange, ev.symbol, ev.side, ev.price, ev.qty, ev.notional);
    return Number(r.changes) > 0; // false if deduped
  }

  function cursor() { const r = getMeta.get('agg_cursor'); return r ? Number(r.v) : 0; }

  // Fold new raw rows into the 5-minute / price-bucket aggregates. Idempotent via cursor.
  function aggregateNew() {
    ensure();
    const from = cursor();
    const rows = db.prepare('SELECT id,ts,symbol,side,price,notional FROM liquidations WHERE id>? ORDER BY id ASC LIMIT 5000').all(from);
    if (!rows.length) return 0;
    db.exec('BEGIN');
    try {
      let last = from;
      for (const r of rows) {
        const bs = bucketSizeFor(r.symbol, r.price);
        const pb = Math.floor(r.price / bs) * bs;
        const win = Math.floor(r.ts / 300000) * 300000;
        aggUpsert.run(r.symbol, win, pb, r.side, r.notional);
        last = r.id;
      }
      setMeta.run('agg_cursor', String(last));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return rows.length;
  }

  // Histogram source for the chart: [{price, long, short, count}] over `minutes`.
  function histogram(symbol, minutes) {
    const since = Math.floor((Date.now() - minutes * 60000) / 300000) * 300000;
    const rows = db.prepare(
      `SELECT price_bucket AS p, side, SUM(notional) AS n, SUM(cnt) AS c FROM agg_5m WHERE symbol=? AND win_start>=? GROUP BY price_bucket, side`
    ).all(symbol, since);
    const map = new Map();
    for (const r of rows) {
      let e = map.get(r.p); if (!e) { e = { price: r.p, long: 0, short: 0, count: 0 }; map.set(r.p, e); }
      if (r.side === 'long_liquidated') e.long += r.n; else e.short += r.n;
      e.count += Number(r.c);
    }
    return [...map.values()].sort((a, b) => a.price - b.price);
  }

  // Recent raw events for the live ticker + chart bubbles.
  function live(symbol, limit = 200, minNotional = 0) {
    return db.prepare(
      `SELECT ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE symbol=? AND notional>=? ORDER BY ts DESC LIMIT ?`
    ).all(symbol, minNotional, Math.min(Number(limit) || 200, 1000));
  }

  function prune(days) {
    const cut = Date.now() - days * 86400000;
    const r = db.prepare('DELETE FROM liquidations WHERE ts<?').run(cut);
    return Number(r.changes); // aggregates kept indefinitely
  }

  function stats() {
    const total = db.prepare('SELECT COUNT(*) AS c FROM liquidations').get().c;
    const e24 = db.prepare('SELECT COUNT(*) AS c FROM liquidations WHERE ts>?').get(Date.now() - 86400000).c;
    const bySym = db.prepare('SELECT symbol, COUNT(*) AS c FROM liquidations WHERE ts>? GROUP BY symbol ORDER BY c DESC').all(Date.now() - 3600000);
    return { totalEvents: Number(total), events24h: Number(e24), lastHourBySymbol: bySym };
  }

  return { migrate, insert, aggregateNew, histogram, live, prune, stats, close: () => db.close() };
}
