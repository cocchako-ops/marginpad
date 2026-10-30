// exportGz must produce the bytes the old main-thread export produced, or the archive's verification refuses the day.
// Builds a throwaway database, runs both paths over awkward values, compares. `node tools/export-check.js`
import { gunzipSync } from 'node:zlib';
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSqliteStorage, EXPORTS } from '../src/storage/sqlite.js';

const dir = mkdtempSync(join(tmpdir(), 'mp-exp-'));
const path = join(dir, 'x.db');
const st = createSqliteStorage(path);
st.migrate(new URL('../migrations', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const db = new DatabaseSync(path);
const d0 = Date.UTC(2026, 9, 29), d1 = d0 + 86400000;
db.exec('BEGIN');
const ins = db.prepare('INSERT OR IGNORE INTO liquidations (ts,exchange,symbol,side,price,qty,notional) VALUES (?,?,?,?,?,?,?)');
const N = 60000;
for (let i = 0; i < N; i++) ins.run(d0 + i * 1000, i % 7 ? 'bybit' : 'hy,per"liquid', 'BTC', i % 2 ? 'long' : 'short', 70000 + i / 3, 0.1 + i / 1e5, i % 11 ? 7000.5 + i : null);
db.exec('COMMIT');

// the old path, verbatim
const oldCsv = (ds) => {
  const spec = EXPORTS[ds], rows = st.exportDs(ds, d0, d1), cols = spec.cols.split(',');
  let csv = spec.cols + '\n'; const chunks = [];
  const cell = (v) => { if (v == null) return ''; const s = String(v); return /[,\n\r"]/.test(s) ? s.replace(/[,\n\r"]/g, ' ') : s; };
  for (const r of rows) {
    let line = '';
    for (let i = 0; i < cols.length; i++) line += (i ? ',' : '') + cell(r[cols[i]]);
    csv += line + '\n';
    if (csv.length > 1 << 20) { chunks.push(csv); csv = ''; }
  }
  chunks.push(csv);
  return { n: rows.length, buf: Buffer.concat(chunks.map((c) => Buffer.from(c))) };
};
let bad = 0;
for (const ds of Object.keys(EXPORTS)) {
  const a = oldCsv(ds), b = st.exportGz(ds, d0, d1), un = gunzipSync(b.gz);
  const same = a.n === b.rows && a.buf.equals(un);
  console.log(same ? 'ok  ' : 'FAIL', ds, 'rows', b.rows, 'csv', un.length, 'gz', b.gz.length);
  if (!same) bad++;
}
db.close();
try { rmSync(dir, { recursive: true, force: true }); } catch (e) {}
console.log(bad ? 'FAILED ' + bad : 'all identical');
process.exit(bad ? 1 : 0);
