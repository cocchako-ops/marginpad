// Re-price every Bitget liquidation written while the adapter read `amount` as the BASE quantity (2026-11-14).
//
// WHY THIS EXISTS. Bitget's UTA liquidation channel publishes `amount` in the QUOTE coin, exactly as its doc says. The adapter
// shipped the same morning on a mismeasured sample and multiplied it by the price again, so a $362 ETH liquidation was stored as
// $654,764 (x price) and /rekt/'s top hits were all Bitget at $10-40M. Measured on the day's feed: 240 of 253 Bitget rows have
// amount/price landing on the lot step (quote), 5 the other way. The raw row is fixed in place (qty = amount / price, notional =
// amount) and the SAME difference is taken out of the agg_5m bucket it was folded into, in ONE transaction - every window longer
// than a day is computed from the aggregate, so fixing the raw rows alone would leave the 24h/7d figures wrong.
//
// A fixed row still satisfies notional = price * qty, so nothing in the row can say it was fixed: the run is recorded in its own
// table (fixlog) and a second run refuses. Only rows at or before --before (ms, default now) are touched - run it with the collector
// STOPPED and the fixed adapter not yet started, so every Bitget row in the table is a broken one.
//
// Usage, on the droplet, from the collector directory:
//   pm2 stop marginpad-collector
//   node tools/fix-bitget-quote.js          # dry run
//   node tools/fix-bitget-quote.js --go     # applies once
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { config, bucketSizeFor } from '../config.js';

const argv = process.argv.slice(2);
const GO = argv.includes('--go');
const bi = argv.indexOf('--before'); const BEFORE = bi >= 0 ? Number(argv[bi + 1]) : Date.now();
const db = new DatabaseSync(path.resolve(process.env.SQLITE_PATH || config.db.sqlitePath));
db.exec('PRAGMA busy_timeout = 10000');
db.exec('CREATE TABLE IF NOT EXISTS fixlog (k TEXT PRIMARY KEY, ts INTEGER, note TEXT)');
const done = db.prepare("SELECT ts, note FROM fixlog WHERE k='bitget-quote'").get();
if (done) { console.log('already applied at', new Date(Number(done.ts)).toISOString(), done.note || ''); db.close(); process.exit(0); }

const rows = db.prepare("SELECT id,ts,symbol,side,price,qty,notional FROM liquidations WHERE exchange='bitget' AND ts<=? AND price>0").all(BEFORE);
let before = 0, after = 0; for (const r of rows) { before += Number(r.notional); after += Number(r.qty); }
console.log('bitget rows to fix', rows.length, 'up to', new Date(BEFORE).toISOString());
console.log('notional before $' + (before / 1e6).toFixed(2) + 'M  after $' + (after / 1e6).toFixed(2) + 'M');
rows.slice().sort((a, b) => b.notional - a.notional).slice(0, 10).forEach(r => console.log('  ', new Date(Number(r.ts)).toISOString().slice(0, 19), r.symbol, r.side, 'px', r.price, 'amount', r.qty, '$' + Math.round(r.notional), '->', '$' + Math.round(r.qty)));
if (!GO) { console.log('\nDRY RUN. Nothing changed. --go applies.'); db.close(); process.exit(0); }

db.exec('BEGIN');
let rawN = 0, aggN = 0, aggMiss = 0;
try {
  const setRow = db.prepare('UPDATE liquidations SET qty=?, notional=? WHERE id=?');
  const getAgg = db.prepare('SELECT notional FROM agg_5m WHERE symbol=? AND win_start=? AND price_bucket=? AND side=?');
  const setAgg = db.prepare('UPDATE agg_5m SET notional=? WHERE symbol=? AND win_start=? AND price_bucket=? AND side=?');
  for (const r of rows) {
    const amount = Number(r.qty), oldN = Number(r.notional);
    rawN += Number(setRow.run(amount / Number(r.price), amount, r.id).changes) || 0;
    const bs = bucketSizeFor(r.symbol, r.price), pb = Math.floor(r.price / bs) * bs, win = Math.floor(Number(r.ts) / 300000) * 300000;
    const a = getAgg.get(r.symbol, win, pb, r.side);
    if (!a) { aggMiss++; continue; }
    setAgg.run(Math.max(0, Number(a.notional) - oldN + amount), r.symbol, win, pb, r.side); aggN++;
  }
  db.prepare("INSERT INTO fixlog (k, ts, note) VALUES ('bitget-quote', ?, ?)").run(Date.now(), rawN + ' rows up to ' + new Date(BEFORE).toISOString());
  db.exec('COMMIT');
} catch (e) { db.exec('ROLLBACK'); console.error('rolled back:', String((e && e.message) || e)); db.close(); process.exit(1); }
console.log('\nfixed ' + rawN + ' raw row(s), corrected ' + aggN + ' aggregate bucket(s)' + (aggMiss ? ', ' + aggMiss + ' had no aggregate row yet' : ''));
db.close();
