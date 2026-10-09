// Remove liquidation rows that should never have been written, from BOTH tables.
//
// WHY THIS EXISTS (2026-10-09). A bad adapter row is not undone by fixing the adapter: it sits in
// `liquidations` until retention prunes it (14 days) and - the part that is easy to miss - it has ALREADY
// been folded into `agg_5m`, which is kept 90 days and is what every window longer than a day is computed
// from. Deleting the raw row alone leaves the figure wrong on the page that reads the aggregate.
//
// The case it was written for: Bitfinex re-reported the same ~2284-BTC BTC long after a restart, twice,
// $195,445,833 and $192,619,114, against a largest-real-event-anywhere of $11.85M. Together they inflated
// the published 24h total by 15.9% and the 7-day total by 34%, and the newer one was being served as "the
// biggest liquidation today".
//
// Usage, on the droplet, from the collector directory:
//   node tools/drop-liq.js --min-usd 50000000                  # dry run: lists what it WOULD remove
//   node tools/drop-liq.js --min-usd 50000000 --go              # does it
//   node tools/drop-liq.js --exchange bitfinex --min-usd 2e7 --go
//   node tools/drop-liq.js --id 123456 --go                     # one exact row
//
// It refuses to run without a filter, prints every row before touching anything, and does the raw delete
// and the aggregate correction in ONE transaction - a half-applied correction is worse than the bug.
// Safe to run while the collector is up: SQLite is in WAL mode and this is a handful of rows.

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { config, bucketSizeFor } from '../config.js';

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? (argv[i + 1] ?? '') : d; };
const has = (n) => argv.includes('--' + n);

const GO = has('go');
const minUsd = flag('min-usd', '') === '' ? null : Number(flag('min-usd'));
const exchange = flag('exchange', '') || null;
const symbol = (flag('symbol', '') || '').toUpperCase() || null;
const id = flag('id', '') === '' ? null : Number(flag('id'));

if (minUsd == null && !exchange && !symbol && id == null) {
  console.error('refusing to run with no filter. Pass --min-usd / --exchange / --symbol / --id. Add --go to apply.');
  process.exit(2);
}
if (minUsd != null && !(minUsd > 0)) { console.error('--min-usd must be a positive number'); process.exit(2); }

const dbPath = path.resolve(process.env.SQLITE_PATH || config.db.sqlitePath);
const db = new DatabaseSync(dbPath);

const where = [], args = [];
if (id != null) { where.push('id=?'); args.push(id); }
if (minUsd != null) { where.push('notional>=?'); args.push(minUsd); }
if (exchange) { where.push('exchange=?'); args.push(exchange); }
if (symbol) { where.push('symbol=?'); args.push(symbol); }

const rows = db.prepare(`SELECT id,ts,exchange,symbol,side,price,qty,notional FROM liquidations WHERE ${where.join(' AND ')} ORDER BY notional DESC`).all(...args);

console.log('db        ', dbPath);
console.log('filter    ', where.join(' AND '), JSON.stringify(args));
console.log('matched   ', rows.length, 'row(s)');
if (!rows.length) { db.close(); process.exit(0); }

let sum = 0;
for (const r of rows) {
  sum += Number(r.notional) || 0;
  const bs = bucketSizeFor(r.symbol, r.price);
  const pb = Math.floor(r.price / bs) * bs;
  const win = Math.floor(Number(r.ts) / 300000) * 300000;
  console.log(
    '  id=' + r.id,
    new Date(Number(r.ts)).toISOString(),
    String(r.exchange).padEnd(13),
    String(r.symbol).padEnd(8),
    r.side,
    'qty=' + r.qty,
    'px=' + r.price,
    '$' + (Number(r.notional) / 1e6).toFixed(2) + 'M',
    '-> agg_5m(' + r.symbol + ', win=' + new Date(win).toISOString() + ', bucket=' + pb + ', ' + r.side + ')'
  );
}
console.log('total     $' + (sum / 1e6).toFixed(2) + 'M');

if (!GO) { console.log('\nDRY RUN. Nothing was changed. Re-run with --go to apply.'); db.close(); process.exit(0); }

// ONE transaction: the raw delete and the aggregate correction either both land or neither does.
db.exec('BEGIN');
let delN = 0, aggN = 0, aggMissing = 0;
try {
  const delRow = db.prepare('DELETE FROM liquidations WHERE id=?');
  const getAgg = db.prepare('SELECT notional, cnt FROM agg_5m WHERE symbol=? AND win_start=? AND price_bucket=? AND side=?');
  const setAgg = db.prepare('UPDATE agg_5m SET notional=?, cnt=? WHERE symbol=? AND win_start=? AND price_bucket=? AND side=?');
  const dropAgg = db.prepare('DELETE FROM agg_5m WHERE symbol=? AND win_start=? AND price_bucket=? AND side=?');
  for (const r of rows) {
    delN += Number(delRow.run(r.id).changes) || 0;
    const bs = bucketSizeFor(r.symbol, r.price);
    const pb = Math.floor(r.price / bs) * bs;
    const win = Math.floor(Number(r.ts) / 300000) * 300000;
    const a = getAgg.get(r.symbol, win, pb, r.side);
    if (!a) { aggMissing++; continue; }   // not aggregated yet (cursor behind) - nothing to correct
    const nn = Math.max(0, (Number(a.notional) || 0) - (Number(r.notional) || 0));
    const nc = Math.max(0, (Number(a.cnt) || 0) - 1);
    if (nc === 0 && nn === 0) dropAgg.run(r.symbol, win, pb, r.side);
    else setAgg.run(nn, nc, r.symbol, win, pb, r.side);
    aggN++;
  }
  db.exec('COMMIT');
} catch (e) {
  db.exec('ROLLBACK');
  console.error('rolled back:', String((e && e.message) || e));
  db.close();
  process.exit(1);
}
console.log('\nremoved ' + delN + ' raw row(s), corrected ' + aggN + ' aggregate bucket(s)'
  + (aggMissing ? ', ' + aggMissing + ' had no aggregate row yet' : ''));
console.log('The API caches for up to 60s (pulse 30s, histogram 45s) - re-read after a minute.');
db.close();
