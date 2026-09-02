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

  let insertStmt, aggUpsert, getMeta, setMeta, oiStmt, clAdd;
  function prepareAll() {
    insertStmt = db.prepare(`INSERT OR IGNORE INTO liquidations (ts,exchange,symbol,side,price,qty,notional) VALUES (?,?,?,?,?,?,?)`);
    aggUpsert = db.prepare(`INSERT INTO agg_5m (symbol,win_start,price_bucket,side,notional,cnt) VALUES (?,?,?,?,?,1)
      ON CONFLICT(symbol,win_start,price_bucket,side) DO UPDATE SET notional=notional+excluded.notional, cnt=cnt+1`);
    getMeta = db.prepare('SELECT v FROM meta WHERE k=?');
    setMeta = db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v');
    try { // Phase 2 tables (present after migration 002)
      oiStmt = db.prepare('INSERT OR REPLACE INTO oi (symbol,exchange,ts,oi_base,price) VALUES (?,?,?,?,?)');
      clAdd = db.prepare('INSERT INTO clusters (symbol,price_bucket,side,est_notional,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(symbol,price_bucket,side) DO UPDATE SET est_notional=est_notional+excluded.est_notional, updated_at=excluded.updated_at');
    } catch (e) {}
  }
  function ensure() { if (!insertStmt) prepareAll(); } // prepares lazily once tables exist

  // Every query here runs synchronously on the main thread — the same thread that reads the exchange
  // sockets. The market-wide aggregates are the expensive ones (whole-day scans), and the same answer is
  // asked for by every colo of the edge cache within seconds. Memoize them for a short TTL so a burst
  // costs one scan, not one per request. Keys carry the window so different windows never collide.
  const memo = new Map();
  function cached(key, ttlMs, fn) {
    const now = Date.now(), h = memo.get(key);
    if (h && now - h.t < ttlMs) return h.v;
    const v = fn(); memo.set(key, { t: now, v });
    if (memo.size > 64) for (const [k, e] of memo) if (now - e.t > 600000) memo.delete(k);
    return v;
  }
  const hoursKey = (sinceTs) => String(Math.round((Date.now() - sinceTs) / 3600000)) + 'h';

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

  // Market-wide recent liquidations (all symbols) for the global floating feed.
  function feed(minNotional = 0, limit = 30, since = 0) {
    ensure();
    const cap = since > 0 ? 3000 : 200; // backfill mode (since=ms) may return the whole day; live poll stays small
    if (since > 0) return db.prepare(`SELECT ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE notional>=? AND ts>=? ORDER BY ts DESC LIMIT ?`)
      .all(minNotional, since, Math.min(Number(limit) || 30, cap));
    return db.prepare(`SELECT ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE notional>=? ORDER BY ts DESC LIMIT ?`)
      .all(minNotional, Math.min(Number(limit) || 30, cap));
  }

  function prune(days) {
    const cut = Date.now() - days * 86400000;
    const r = db.prepare('DELETE FROM liquidations WHERE ts<?').run(cut);
    return Number(r.changes); // aggregates kept indefinitely
  }

  function stats() {
    return cached('stats', 120000, () => { // /status is polled by the worker's health + ops alerts; the full-table count alone is ~2s cold
      const total = db.prepare('SELECT COUNT(*) AS c FROM liquidations').get().c;
      const e24 = db.prepare('SELECT COUNT(*) AS c FROM liquidations WHERE ts>?').get(Date.now() - 86400000).c;
      const bySym = db.prepare('SELECT symbol, COUNT(*) AS c FROM liquidations WHERE ts>? GROUP BY symbol ORDER BY c DESC').all(Date.now() - 3600000);
      return { totalEvents: Number(total), events24h: Number(e24), lastHourBySymbol: bySym };
    });
  }

  // ---- Phase 2: open interest + estimated clusters ----
  function insertOi(symbol, exchange, ts, oiBase, price) { ensure(); oiStmt.run(symbol, exchange, ts, oiBase, price); }
  function latestOi(symbol) { ensure(); return db.prepare('SELECT exchange, oi_base AS oi, price, MAX(ts) AS ts FROM oi WHERE symbol=? GROUP BY exchange').all(symbol); }
  function addCluster(symbol, bucket, side, add, ts) { ensure(); clAdd.run(symbol, bucket, side, add, ts); }
  function decayClusters(symbol, factor, ts, minKeep) {
    ensure();
    db.prepare('UPDATE clusters SET est_notional=est_notional*?, updated_at=? WHERE symbol=?').run(factor, ts, symbol);
    db.prepare('DELETE FROM clusters WHERE symbol=? AND est_notional<?').run(symbol, minKeep || 1);
  }
  function consumeClusters(symbol, lo, hi) { ensure(); return Number(db.prepare('DELETE FROM clusters WHERE symbol=? AND price_bucket>=? AND price_bucket<=?').run(symbol, lo, hi).changes); }
  function getClusters(symbol) { ensure(); return db.prepare('SELECT price_bucket AS price, side, est_notional FROM clusters WHERE symbol=? AND est_notional>0 ORDER BY price_bucket').all(symbol); }
  function pruneOi(days) { ensure(); return Number(db.prepare('DELETE FROM oi WHERE ts<?').run(Date.now() - days * 86400000).changes); }

  // ---- screener extra: hourly OI snapshots + per-symbol 24h liquidation aggregates ----
  function saveOiSnap(rows) { ensure();
    const st = db.prepare('INSERT INTO oi_snap(ts,symbol,oi_usd,funding) VALUES (?,?,?,?)');
    db.exec('BEGIN');
    try { for (const r of rows) st.run(r.ts, r.symbol, r.oi, (r.f != null && isFinite(r.f)) ? r.f : null); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; } // node:sqlite has no .transaction() helper (that's better-sqlite3)
    db.prepare('DELETE FROM oi_snap WHERE ts<?').run(Date.now() - 50 * 3600000); // keep ~2 days
  }
  function oi24h() { ensure(); return cached('oi24h', 60000, () => oi24hRaw()); }
  function oi24hRaw() {
    const last = db.prepare('SELECT MAX(ts) t FROM oi_snap').get();
    if (!last || !last.t) return {};
    const nowRows = db.prepare('SELECT symbol,oi_usd,funding FROM oi_snap WHERE ts=?').all(last.t);
    const cut = last.t - 24 * 3600000, out = {};
    const prevStmt = db.prepare('SELECT oi_usd,funding FROM oi_snap WHERE symbol=? AND ts<=? ORDER BY ts DESC LIMIT 1');
    for (const r of nowRows) {
      const p = prevStmt.get(r.symbol, cut);
      out[r.symbol] = { now: Math.round(r.oi_usd), chg: (p && p.oi_usd > 0) ? +(((r.oi_usd / p.oi_usd) - 1) * 100).toFixed(2) : null,
        f: (r.funding != null) ? +(+r.funding).toFixed(4) : null,
        fchg: (p && p.funding != null && r.funding != null) ? +((+r.funding) - (+p.funding)).toFixed(4) : null };
    }
    return out;
  }
  function pulse(sinceTs) { ensure(); return cached('pulse:' + hoursKey(sinceTs), 30000, () => pulseRaw(sinceTs)); } // aggregated market pulse (heatmap page): per-coin + per-exchange long/short split + totals + biggest order, orders >= $1k
  function pulseRaw(sinceTs) {
    const bySym = db.prepare("SELECT symbol s, SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END) l, SUM(CASE WHEN side<>'long_liquidated' THEN notional ELSE 0 END) sh, (SELECT price FROM liquidations q WHERE q.symbol=liquidations.symbol ORDER BY q.ts DESC LIMIT 1) px FROM liquidations WHERE ts>=? AND notional>=1000 GROUP BY symbol ORDER BY (l+sh) DESC LIMIT 300").all(sinceTs);
    const byEx = db.prepare("SELECT exchange e, SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END) l, SUM(CASE WHEN side<>'long_liquidated' THEN notional ELSE 0 END) sh FROM liquidations WHERE ts>=? AND notional>=1000 GROUP BY exchange ORDER BY (l+sh) DESC").all(sinceTs);
    const tot = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(notional),0) v, COALESCE(SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END),0) l FROM liquidations WHERE ts>=? AND notional>=1000").get(sinceTs);
    const big = db.prepare("SELECT exchange,symbol,side,notional FROM liquidations WHERE ts>=? AND notional>=1000 ORDER BY notional DESC LIMIT 1").get(sinceTs);
    return { bySym, byEx, tot, big: big || null };
  }
  function liqBySymbol(since) { ensure();
    return cached('liqBySym:' + hoursKey(since), 60000, () => db.prepare("SELECT symbol s, SUM(notional) liq, SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END) lng, COUNT(*) n FROM liquidations WHERE ts>=? GROUP BY symbol ORDER BY liq DESC LIMIT 300").all(since));
  }

  // Full raw dump of one UTC day — feeds the R2 archive (worker cron pulls this once/day).
  // Raw rows are pruned after retentionDays; the archive is how history outlives that AND the droplet.
  function exportDay(d0, d1) { ensure();
    return db.prepare('SELECT ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE ts>=? AND ts<? ORDER BY ts').all(d0, d1);
  }

  return { migrate, insert, aggregateNew, histogram, live, feed, prune, stats,
    insertOi, latestOi, addCluster, decayClusters, consumeClusters, getClusters, pruneOi,
    saveOiSnap, oi24h, liqBySymbol, pulse, exportDay,
    close: () => db.close() };
}
