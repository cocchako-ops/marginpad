// hl.db: the wallet engine's own database, so its writes and its size are nothing to the liquidation collector.
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS hl_wallet (
  addr TEXT PRIMARY KEY, first_seen INTEGER, last_fill INTEGER, last_snap INTEGER,
  label TEXT, kind TEXT, av REAL, pnl_all REAL, pnl_m REAL, pnl_w REAL, pnl_d REAL,
  roi_m REAL, vlm_m REAL, vlm_all REAL, dexes TEXT
);
CREATE TABLE IF NOT EXISTS hl_pos (
  addr TEXT, coin TEXT, szi REAL, ntl REAL, entry REAL, lev REAL, cross INTEGER, liq REAL,
  margin REAL, upnl REAL, funding REAL, ts INTEGER, since INTEGER, PRIMARY KEY (addr, coin)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS hl_pos_coin ON hl_pos (coin, ntl);
CREATE TABLE IF NOT EXISTS hl_delta (
  ts INTEGER, addr TEXT, coin TEXT, kind TEXT, szi_from REAL, szi_to REAL, ntl_delta REAL, px REAL
);
CREATE INDEX IF NOT EXISTS hl_delta_ts ON hl_delta (ts);
CREATE INDEX IF NOT EXISTS hl_delta_coin ON hl_delta (coin, ts);
CREATE TABLE IF NOT EXISTS hl_cohort (
  win INTEGER, fam TEXT, cohort TEXT, coin TEXT, long_ntl REAL, short_ntl REAL, long_n INTEGER, short_n INTEGER,
  prof_n INTEGER, loss_n INTEGER, upnl REAL, PRIMARY KEY (win, fam, cohort, coin)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS hl_cohort_key ON hl_cohort (fam, cohort, coin, win);
`;

export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000; PRAGMA wal_autocheckpoint = 2000;');
  db.exec(SCHEMA);
  const q = {
    wallet: db.prepare(`INSERT INTO hl_wallet (addr,first_seen,last_fill,last_snap,label,kind,av,pnl_all,pnl_m,pnl_w,pnl_d,roi_m,vlm_m,vlm_all,dexes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(addr) DO UPDATE SET last_fill=excluded.last_fill,last_snap=excluded.last_snap,label=excluded.label,kind=excluded.kind,av=excluded.av,
      pnl_all=excluded.pnl_all,pnl_m=excluded.pnl_m,pnl_w=excluded.pnl_w,pnl_d=excluded.pnl_d,roi_m=excluded.roi_m,vlm_m=excluded.vlm_m,vlm_all=excluded.vlm_all,dexes=excluded.dexes`),
    posOf: db.prepare('SELECT coin,szi,ntl,since FROM hl_pos WHERE addr=?'),
    posPut: db.prepare('INSERT OR REPLACE INTO hl_pos (addr,coin,szi,ntl,entry,lev,cross,liq,margin,upnl,funding,ts,since) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)'),
    posDel: db.prepare('DELETE FROM hl_pos WHERE addr=? AND coin=?'),
    delta: db.prepare('INSERT INTO hl_delta (ts,addr,coin,kind,szi_from,szi_to,ntl_delta,px) VALUES (?,?,?,?,?,?,?,?)'),
    cohort: db.prepare('INSERT OR REPLACE INTO hl_cohort (win,fam,cohort,coin,long_ntl,short_ntl,long_n,short_n,prof_n,loss_n,upnl) VALUES (?,?,?,?,?,?,?,?,?,?,?)'),
  };
  const tx = (fn) => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  return { db, q, tx };
}
