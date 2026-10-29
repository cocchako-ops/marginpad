// SQLite storage driver (the "start simple" backend). Uses Node's built-in node:sqlite (Node >=22).
// Everything DB-specific lives behind this module so swapping to Postgres is a one-file change.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { bucketSizeFor } from '../../config.js';
import { log } from '../logger.js';

// THE DATASETS THE MARKET ARCHIVE CAN PULL (2026-10-28). One UTC day per call, through /api/v1/export?ds=&day=.
// `cols` IS the CSV header (the worker refuses a body whose first line differs), `sql` takes (dayStartMs,
// dayEndMs), `ret` names the config retention class that decides when a day is pruned here - the export
// answers 410 for a day older than that, so the archive can record "gone before it was archived" instead
// of asking for ever. `tsCol` is the column the worker uses for hour coverage and the inside-the-day check.
export const EXPORTS = {
  liquidations: { cols: 'ts,exchange,symbol,side,price,qty,notional', sql: 'SELECT ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE ts>=? AND ts<? ORDER BY ts', ret: 'raw', tsCol: 'ts' },
  agg5m:        { cols: 'symbol,win_start,price_bucket,side,notional,cnt', sql: 'SELECT symbol,win_start,price_bucket,side,notional,cnt FROM agg_5m WHERE win_start>=? AND win_start<? ORDER BY win_start,symbol,price_bucket,side', ret: 'agg', tsCol: 'win_start' },
  oi:           { cols: 'ts,symbol,exchange,oi_base,price', sql: 'SELECT ts,symbol,exchange,oi_base,price FROM oi WHERE ts>=? AND ts<? ORDER BY ts,symbol,exchange', ret: 'raw', tsCol: 'ts' },
  funding_oi:   { cols: 'ts,symbol,oi_usd,funding', sql: 'SELECT ts,symbol,oi_usd,funding FROM oi_snap WHERE ts>=? AND ts<? ORDER BY ts,symbol', ret: 'hist', tsCol: 'ts' },
  whale_fills:  { cols: 'ts,ts_end,user,sym,act,long,usd,sz,px,n,lev,pnl,liq,pos_usd', sql: 'SELECT ts,ts_end,user,sym,act,long,usd,sz,px,n,lev,pnl,liq,pos_usd FROM whale_fill WHERE ts>=? AND ts<? ORDER BY ts,user,sym', ret: 'hist', tsCol: 'ts' },
  whale_pos:    { cols: 'ts,user,sym,long,val,sz,lev,liq,mark,ent,pnl,x,eq', sql: 'SELECT ts,user,sym,long,val,sz,lev,liq,mark,ent,pnl,x,eq FROM whale_pos WHERE ts>=? AND ts<? ORDER BY ts,val DESC', ret: 'hist', tsCol: 'ts' },
  catalysts:    { cols: 'id,ts_src,ts_seen,source,tier,kind,expect,syms,market,score,conf,title,url', sql: 'SELECT id,ts_src,ts_seen,source,tier,kind,expect,syms,market,score,conf,title,url FROM catalyst WHERE ts_seen>=? AND ts_seen<? ORDER BY ts_seen', ret: 'hist', tsCol: 'ts_seen' },
};

export function createSqliteStorage(path, opts = {}) {
  mkdirSync(dirname(path), { recursive: true });
  // readOnly: a second connection for the reader worker thread. WAL lets it read while the main thread
  // writes; it never migrates and never sets the journal mode (the writer owns the file).
  const db = opts.readOnly ? new DatabaseSync(path, { readOnly: true }) : new DatabaseSync(path);
  if (!opts.readOnly) db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
  // THE WRITE-AHEAD LOG HAS TO BE CHECKPOINTED, AND NOBODY WAS DOING IT. SQLite checkpoints on its own
  // only when no reader is holding a snapshot - and this database has a reader WORKER THREAD serving the
  // public API, so there is almost always one open. MEASURED 2026-09-24: the WAL had grown to 1.15 GB
  // against a 606 MB database on a disk that was 78% full, and every cold read had to walk it - the
  // liquidation pulse that feeds the bottom of the heatmap page took 19.6 SECONDS, and 30 with the book
  // film also on the core, at which point it answered 503.
  //
  // TRUNCATE rather than PASSIVE: a passive checkpoint gives up the moment a reader is in the way, which
  // is the situation that created this. It blocks writers for the moment it takes, which is why it runs
  // on a timer from the writer itself rather than from a request, and why it is hourly rather than often.
  if (!opts.readOnly) {
    const ckpt = () => {
      const t0 = Date.now();
      try { db.exec('PRAGMA wal_checkpoint(TRUNCATE);'); log.info('wal checkpoint', { ms: Date.now() - t0 }); }
      catch (e) { log.warn('wal checkpoint failed', { e: String(e && e.message || e) }); }
      // AND THE PLANNER NEEDS STATISTICS, WHICH NOTHING HAS EVER GIVEN IT. MEASURED 2026-09-24: the
      // liquidation pulse - four aggregations over a day of rows - took 24 SECONDS cold, and the query
      // plan said "SCAN liquidations USING INDEX idx_liq_dedup": a full walk of 1.19 million rows, while
      // a covering index on (ts, symbol, exchange, side, notional, price) sat right there unused. With no
      // sqlite_stat1 the planner is guessing. One ANALYZE turned that SCAN into a SEARCH and the same
      // aggregation into 664ms.
      //
      // analysis_limit is the whole reason this can live on a timer: a bare ANALYZE on this table takes
      // 28 SECONDS and would stall every exchange socket on this single-core box for all of it. Bounded,
      // PRAGMA optimize samples a few hundred rows per index and only touches what has actually drifted.
      const t1 = Date.now();
      try { db.exec('PRAGMA analysis_limit=400; PRAGMA optimize;'); log.info('planner stats refreshed', { ms: Date.now() - t1 }); }
      catch (e) { log.warn('optimize failed', { e: String(e && e.message || e) }); }
    };
    setTimeout(ckpt, 60000).unref?.();              // once shortly after start, so a restart clears a backlog
    setInterval(ckpt, 60 * 60000).unref?.();
  }

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

  // Every query here runs synchronously on the main thread - the same thread that reads the exchange
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

  // TIME series for the liquidation-flow edge: [{t, long, short, longN, shortN}] per 5-min window over `minutes`.
  // histogram() groups by price_bucket (where); this groups by win_start (when) - the shape the long-cascade /
  // sweep-of-low detector needs, which no endpoint exposed before (2026-10-15).
  // symbol 'ALL' (or empty) is the WHOLE MARKET, added 2026-10-19 so /rekt/ can draw a true 24h hour histogram
  // instead of one built from whatever sample the browser happened to hold. There is no index on win_start alone,
  // but SQLite skip-scans idx_agg_symbol_win (ANY(symbol) AND win_start>?) - MEASURED on the droplet over
  // 3,613,743 agg_5m rows: 140-201 ms market-wide against 2 ms for one symbol. That runs on the READER thread
  // and behind the worker's edge cache, so it never touches the main loop; a covering index on win_start would
  // make it index-only and is the next step IF it ever shows up in loopLag, not before.
  function series(symbol, minutes) {
    const since = Math.floor((Date.now() - minutes * 60000) / 300000) * 300000;
    const all = !symbol || symbol === 'ALL';
    const cols = 'win_start AS t, side, SUM(notional) AS n, SUM(cnt) AS c';
    const rows = all
      ? db.prepare(`SELECT ${cols} FROM agg_5m WHERE win_start>=? GROUP BY win_start, side`).all(since)
      : db.prepare(`SELECT ${cols} FROM agg_5m WHERE symbol=? AND win_start>=? GROUP BY win_start, side`).all(symbol, since);
    const map = new Map();
    for (const r of rows) {
      let e = map.get(r.t); if (!e) { e = { t: Number(r.t), long: 0, short: 0, longN: 0, shortN: 0 }; map.set(r.t, e); }
      if (r.side === 'long_liquidated') { e.long += r.n; e.longN += Number(r.c); } else { e.short += r.n; e.shortN += Number(r.c); }
    }
    return [...map.values()].sort((a, b) => a.t - b.t);
  }

  // Recent raw events for the live ticker + chart bubbles.
  // `since` (ms) bounds it to one day, so /rekt/'s filtered tape can ask for TODAY and know whether it got the
  // whole of it: fewer rows than the limit means the day is complete. idx_liq_symbol_ts covers (symbol, ts).
  function live(symbol, limit = 200, minNotional = 0, since = 0) {
    const cap = Math.min(Number(limit) || 200, 1000);
    const cols = 'ts,exchange,symbol,side,price,qty,notional';
    if (since > 0) return db.prepare(
      `SELECT ${cols} FROM liquidations WHERE symbol=? AND notional>=? AND ts>=? ORDER BY ts DESC LIMIT ?`
    ).all(symbol, minNotional, since, cap);
    return db.prepare(
      `SELECT ${cols} FROM liquidations WHERE symbol=? AND notional>=? ORDER BY ts DESC LIMIT ?`
    ).all(symbol, minNotional, cap);
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
    return Number(r.changes);
  }
  // 5-min aggregates were kept forever (196MB by 2026-09-02, growing ~7MB/day, no reader ever asks past the 30d window).
  function pruneAgg(days) {
    ensure();
    return Number(db.prepare('DELETE FROM agg_5m WHERE win_start<?').run(Date.now() - days * 86400000).changes);
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
  function latestOi(symbol) { ensure();
    // Latest row per exchange. The old GROUP BY + MAX(ts) walked every row of the symbol (30 days × 3 venues
    // × every 2 min ≈ 65k) on each 12s poll - 2s cold. The poll only needs the last hour; (symbol, ts) makes
    // that a short range scan, and the newest row per exchange is picked here.
    const rows = db.prepare('SELECT exchange, oi_base AS oi, price, ts FROM oi WHERE symbol=? AND ts>=? ORDER BY ts DESC').all(symbol, Date.now() - 3600000);
    const seen = new Map();
    for (const r of rows) if (!seen.has(r.exchange)) seen.set(r.exchange, r);
    return [...seen.values()];
  }
  function addCluster(symbol, bucket, side, add, ts) { ensure(); clAdd.run(symbol, bucket, side, add, ts); }
  function decayClusters(symbol, factor, ts, minKeep) {
    ensure();
    db.prepare('UPDATE clusters SET est_notional=est_notional*?, updated_at=? WHERE symbol=?').run(factor, ts, symbol);
    db.prepare('DELETE FROM clusters WHERE symbol=? AND est_notional<?').run(symbol, minKeep || 1);
  }
  function consumeClusters(symbol, lo, hi) { ensure(); return Number(db.prepare('DELETE FROM clusters WHERE symbol=? AND price_bucket>=? AND price_bucket<=?').run(symbol, lo, hi).changes); }
  function getClusters(symbol) { ensure(); return db.prepare('SELECT price_bucket AS price, side, est_notional FROM clusters WHERE symbol=? AND est_notional>0 ORDER BY price_bucket').all(symbol); }
  // WHAT LIVES IN MEMORY SURVIVES A RESTART (2026-09-25). The tape rings and the film are rebuilt from their
  // own dump here: one JSON row per collector, rewritten every two minutes and on graceful shutdown, read
  // once at boot. `bytes` is stored so the size of what we keep is a query, not a guess. A row older than
  // `maxAgeMs` is refused on read - a blob from three days ago is not "recent big prints".
  function saveState(k, obj) {
    ensure();
    const v = JSON.stringify(obj);
    db.prepare('INSERT INTO state(k,v,ts,bytes) VALUES(?,?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v, ts=excluded.ts, bytes=excluded.bytes')
      .run(k, v, Date.now(), v.length);
    return v.length;
  }
  function loadState(k, maxAgeMs) {
    ensure();
    const r = db.prepare('SELECT v, ts FROM state WHERE k=?').get(k);
    if (!r) return null;
    if (maxAgeMs > 0 && Date.now() - Number(r.ts) > maxAgeMs) return null;
    try { return { ts: Number(r.ts), obj: JSON.parse(r.v) }; } catch { return null; }
  }
  function pruneOi(days) { ensure(); return Number(db.prepare('DELETE FROM oi WHERE ts<?').run(Date.now() - days * 86400000).changes); }

  // ---- screener extra: hourly OI snapshots + per-symbol 24h liquidation aggregates ----
  // `keepDays` was a hardcoded 50 HOURS until 2026-10-28: the one place this collector holds a FUNDING RATE
  // history (every Bybit USDT perp, hourly) was thrown away two days after it was written, and nothing archived
  // it. The screener's 24h delta only needs two days; the market archive (worker archiveMarket, R2
  // v1/funding_oi/<day>) needs the day to still be here when it is pulled, so it is config.histRetentionDays now.
  function saveOiSnap(rows, keepDays) { ensure();
    const st = db.prepare('INSERT INTO oi_snap(ts,symbol,oi_usd,funding) VALUES (?,?,?,?)');
    db.exec('BEGIN');
    try { for (const r of rows) st.run(r.ts, r.symbol, r.oi, (r.f != null && isFinite(r.f)) ? r.f : null); db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; } // node:sqlite has no .transaction() helper (that's better-sqlite3)
    db.prepare('DELETE FROM oi_snap WHERE ts<?').run(Date.now() - (Number(keepDays) > 0 ? Number(keepDays) * 86400000 : 50 * 3600000));
  }
  // ---- whale tracker history (migration 008): what whales.js publishes, written down ----
  function insertWhaleFills(rows) { ensure();
    const st = db.prepare('INSERT OR IGNORE INTO whale_fill(ts,ts_end,user,sym,act,long,usd,sz,px,n,lev,pnl,liq,pos_usd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    let n = 0; db.exec('BEGIN');
    try { for (const r of rows) { const x = st.run(+r.ts || 0, +r.tsEnd || +r.ts || 0, String(r.user || '').toLowerCase(), String(r.sym || ''), r.act || null, r.long ? 1 : 0, +r.usd || 0, +r.sz || 0, +r.px || 0, +r.n || 0, r.lev > 0 ? +r.lev : null, +r.pnl || 0, r.liq > 0 ? +r.liq : null, r.posUsd > 0 ? +r.posUsd : null); n += Number(x.changes); } db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    return n;
  }
  function insertWhalePos(ts, rows, wallets) { ensure();
    const st = db.prepare('INSERT OR IGNORE INTO whale_pos(ts,user,sym,long,val,sz,lev,liq,mark,ent,pnl,x,eq) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
    let n = 0; db.exec('BEGIN');
    try { for (const p of rows) { const w = (wallets && wallets[p.user]) || null; const x = st.run(+ts, String(p.user || '').toLowerCase(), String(p.sym || ''), p.long ? 1 : 0, +p.val || 0, p.sz > 0 ? +p.sz : null, p.lev > 0 ? +p.lev : null, p.liq > 0 ? +p.liq : null, p.mark > 0 ? +p.mark : null, p.ent > 0 ? +p.ent : null, +p.pnl || 0, p.x ? 1 : 0, w && w.eq > 0 ? +w.eq : null); n += Number(x.changes); } db.exec('COMMIT'); }
    catch (e) { db.exec('ROLLBACK'); throw e; }
    return n;
  }
  // ---- catalyst engine (migration 009): one row per dated event, two clocks (source / seen) ----
  function insertCatalyst(r) { ensure();
    return Number(db.prepare('INSERT OR IGNORE INTO catalyst(id,ts_src,ts_seen,source,tier,kind,expect,syms,market,score,conf,cluster,title,url,snippet,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(String(r.id), +r.ts_src, +r.ts_seen, String(r.source), String(r.tier), String(r.kind), +r.expect || 0, String(r.syms || ''), r.market || '', +r.score || 0, +r.conf || 1, r.cluster || '', String(r.title || '').slice(0, 300), r.url || '', r.snippet || '', r.meta || null).changes);
  }
  function pruneCatalyst(days) { ensure(); return Number(db.prepare('DELETE FROM catalyst WHERE ts_seen<?').run(Date.now() - days * 86400000).changes); }
  function pruneWhale(days) { ensure(); const cut = Date.now() - days * 86400000; return Number(db.prepare('DELETE FROM whale_fill WHERE ts<?').run(cut).changes) + Number(db.prepare('DELETE FROM whale_pos WHERE ts<?').run(cut).changes); }
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
  // MEASURED DOLLARS IN A LIST OF PRICE-AND-TIME WINDOWS. One prepared statement reused, because the
  // caller asks about a few hundred at once and a fresh prepare per window is most of the cost. Narrow
  // on both axes, so with the ts covering index each one is a short range seek rather than a scan.
  function liqSum(symbol, wins) {
    ensure();
    const q = db.prepare('SELECT COALESCE(SUM(notional),0) v, COUNT(*) n FROM liquidations WHERE symbol=? AND ts>=? AND ts<=? AND price>=? AND price<=?');
    return wins.map((w) => {
      const t0 = +w[0], t1 = +w[1], p0 = +w[2], p1 = +w[3];
      if (!(t1 > t0) || !(p1 > p0)) return { v: 0, n: 0 };
      const r = q.get(String(symbol), t0, t1, p0, p1);
      return { v: Math.round(r.v || 0), n: r.n || 0 };
    });
  }
  function pulse(sinceTs) { ensure(); return cached('pulse:' + hoursKey(sinceTs), 30000, () => pulseRaw(sinceTs)); } // aggregated market pulse (heatmap page): per-coin + per-exchange long/short split + totals + biggest order, orders >= $1k
  function pulseRaw(sinceTs) {
    // px = price of the newest row in the window: SQLite takes bare columns from the row that produced a
    // lone MAX(). The previous correlated subquery did one (symbol, ts) seek per output symbol - 300 cold
    // seeks on a box whose page cache cannot hold the table. Every column here is in idx_liq_ts_cov, so
    // the whole window is one contiguous index-only scan.
    const bySym = db.prepare("SELECT symbol s, SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END) l, SUM(CASE WHEN side<>'long_liquidated' THEN notional ELSE 0 END) sh, MAX(ts) mt, price px FROM liquidations WHERE ts>=? AND notional>=1000 GROUP BY symbol ORDER BY (l+sh) DESC LIMIT 300").all(sinceTs).map((r) => ({ s: r.s, l: r.l, sh: r.sh, px: r.px }));
    const byEx = db.prepare("SELECT exchange e, SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END) l, SUM(CASE WHEN side<>'long_liquidated' THEN notional ELSE 0 END) sh FROM liquidations WHERE ts>=? AND notional>=1000 GROUP BY exchange ORDER BY (l+sh) DESC").all(sinceTs);
    const tot = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(notional),0) v, COALESCE(SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END),0) l FROM liquidations WHERE ts>=? AND notional>=1000").get(sinceTs);
    const big = db.prepare("SELECT exchange,symbol,side,notional FROM liquidations WHERE ts>=? AND notional>=1000 ORDER BY notional DESC LIMIT 1").get(sinceTs);
    return { bySym, byEx, tot, big: big || null };
  }
  function liqBySymbol(since) { ensure();
    return cached('liqBySym:' + hoursKey(since), 60000, () => db.prepare("SELECT symbol s, SUM(notional) liq, SUM(CASE WHEN side='long_liquidated' THEN notional ELSE 0 END) lng, COUNT(*) n FROM liquidations WHERE ts>=? GROUP BY symbol ORDER BY liq DESC LIMIT 300").all(since));
  }

  // Full raw dump of one UTC day - feeds the R2 archive (worker cron pulls this once/day).
  // Raw rows are pruned after retentionDays; the archive is how history outlives that AND the droplet.
  function exportDay(d0, d1) { ensure();
    return db.prepare('SELECT ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE ts>=? AND ts<? ORDER BY ts').all(d0, d1);
  }
  // ONE DAY OF ONE DATASET, for the market archive (2026-10-28). `EXPORTS` (below, exported) is the single
  // table of what can be archived: the column list is the CSV header the worker verifies against, and the
  // retention class says which config figure decides when a day is gone. Add a dataset here and in
  // MARKET_DS in the worker - nowhere else.
  function exportDs(ds, d0, d1) { ensure();
    const spec = EXPORTS[ds]; if (!spec) throw new Error('unknown dataset: ' + ds);
    return db.prepare(spec.sql).all(d0, d1);
  }
  // CATALYSTS BEYOND THE 48-HOUR RING (2026-10-29, the "what moved it" indicator reads a month back). Read on
  // the reader thread like every other API read; newest first, bounded, the `syms` csv matched as a whole token
  // so BTC never matches BTCB. The main thread never runs this - it only inserts.
  function catalystRange(since, until, sym, min, kind, limit) { ensure();
    const w = ['ts_src>=?', 'ts_src<?'], a = [+since || 0, +until || Date.now() + 1];
    if (+min > 0) { w.push('score>=?'); a.push(+min); }
    if (kind) { w.push('kind=?'); a.push(String(kind)); }
    if (sym) { w.push("(','||syms||',') LIKE ?"); a.push('%,' + String(sym).toUpperCase() + ',%'); }
    a.push(Math.min(5000, Math.max(1, +limit || 1000)));
    return db.prepare('SELECT id,ts_src,ts_seen,source,tier,kind,expect,syms,market,score,conf,cluster,title,url,snippet,meta FROM catalyst WHERE ' + w.join(' AND ') + ' ORDER BY ts_src DESC LIMIT ?').all(...a);
  }
  function catalystCount(since) { ensure(); return db.prepare('SELECT COUNT(*) n, MIN(ts_src) t0, MAX(ts_src) t1 FROM catalyst WHERE ts_src>=?').get(+since || 0); }
  // the symbols a window of catalysts names, with how often and how strongly - the /catalysts/ page's "most talked about"
  function catalystTop(since, min) { ensure();
    const rows = db.prepare('SELECT syms,kind,score,source,ts_src FROM catalyst WHERE ts_src>=? AND score>=? AND syms<>\'\'').all(+since || 0, +min || 0);
    const by = {};
    for (const r of rows) for (const s of String(r.syms).split(',')) { if (!s) continue; const o = by[s] = by[s] || { sym: s, n: 0, max: 0, kinds: {}, sources: {}, last: 0 }; o.n++; if (r.score > o.max) o.max = r.score; o.kinds[r.kind] = (o.kinds[r.kind] || 0) + 1; const src = String(r.source).split(':')[0]; o.sources[src] = (o.sources[src] || 0) + 1; if (r.ts_src > o.last) o.last = r.ts_src; }
    return Object.values(by).sort((a, b) => b.n - a.n || b.max - a.max);
  }
  // whale trade groups of one coin in a window (the tracker's own 14-day table) - a flow cause for the chart
  function whaleFillsRange(sym, since, until, minUsd, limit) { ensure();
    return db.prepare('SELECT ts,ts_end,user,sym,act,long,usd,sz,px,n,lev,pnl,liq,pos_usd FROM whale_fill WHERE sym=? AND ts>=? AND ts<? AND usd>=? ORDER BY ts DESC LIMIT ?').all(String(sym || '').toUpperCase(), +since || 0, +until || Date.now() + 1, +minUsd || 0, Math.min(2000, Math.max(1, +limit || 500)));
  }

  return { migrate, insert, aggregateNew, histogram, series, live, feed, prune, stats,
    insertOi, latestOi, addCluster, decayClusters, consumeClusters, getClusters, pruneOi, pruneAgg,
    saveOiSnap, oi24h, liqBySymbol, pulse, liqSum, exportDay, exportDs,
    insertWhaleFills, insertWhalePos, pruneWhale,
    insertCatalyst, pruneCatalyst, catalystRange, catalystCount, catalystTop, whaleFillsRange,
    saveState, loadState,
    close: () => db.close() };
}
