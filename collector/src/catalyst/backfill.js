// CATALYST BACKFILL (2026-10-29): the engine went live on 10-29 and the "what moved it" chart indicator reads a
// month back, so the month before it existed is reconstructed from the sources that publish their own history
// with exact timestamps: Bybit and OKX announcement pages, the Telegram previews (`?before=` pages backwards),
// and the macro calendar from the curated FOMC / CPI dates. Media RSS feeds hold only their newest ~20 items and
// SEC's full-text search dates a filing to the DAY, so neither is backfilled - a row whose time is only known to
// the day would be attributed to the wrong candle. Rows go in through the SAME classify/score path as a live row,
// with ts_seen = ts_src and meta.bf = 1 so nothing downstream can mistake them for something we saw arrive.
// Re-runnable: the table is INSERT OR IGNORE on the id, so a second run only fills what the first missed.
//   node src/catalyst/backfill.js [--days 35] [--tg-only | --no-tg] [--dry]      (run from collector/)
'use strict';
import { readFileSync, existsSync } from 'node:fs';
import * as S from './sources.js';
import * as SX from './sources-x.js';
import { ingestRows, setSymbolsFrom } from './index.js';

const FOMC_D = '2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16 2026-10-28 2026-12-09';
const CPI_D = '2026-01-13 2026-02-11 2026-03-11 2026-04-10 2026-05-12 2026-06-10 2026-07-14 2026-08-12 2026-09-11 2026-10-14 2026-11-10 2026-12-10 2027-01-13';
function usDst(y, m, d) {
  const sun2mar = (() => { const x = new Date(Date.UTC(y, 2, 1)); return 1 + ((7 - x.getUTCDay()) % 7) + 7; })();
  const sun1nov = (() => { const x = new Date(Date.UTC(y, 10, 1)); return 1 + ((7 - x.getUTCDay()) % 7); })();
  const t = Date.UTC(y, m - 1, d); return t >= Date.UTC(y, 2, sun2mar) && t < Date.UTC(y, 10, sun1nov);
}
export function macroRows(since, until) {
  const out = [];
  for (const [list, hET, mET, type, title, desc] of [[FOMC_D, 14, 0, 'fomc', 'FOMC rate decision', 'Fed announces interest rates, 2:00 PM ET.'], [CPI_D, 8, 30, 'cpi', 'US CPI inflation report', 'Bureau of Labor Statistics CPI release, 8:30 AM ET.']]) {
    for (const day of list.split(' ')) {
      const [y, m, d] = day.split('-').map(Number); const ts = Date.UTC(y, m - 1, d, hET + (usDst(y, m, d) ? 4 : 5), mET);
      if (ts < since || ts > until) continue;
      out.push({ nid: 'cal:' + type + ':' + ts, ts, title, url: 'https://marginpad.io/calendar/', snippet: desc, meta: { type, impact: 3 } });
    }
  }
  return out;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function backfill({ days = 35, tg = true, exch = true, macro = true, dry = false, log = console.log } = {}) {
  const now = Date.now(), since = now - days * 86400000, stats = {};
  const take = async (name, tier, rows) => {
    const fresh = rows.filter(r => r && r.ts >= since && r.ts <= now);
    const n = dry ? fresh.length : ingestRows(fresh, name, tier, { backfill: true });
    stats[name] = (stats[name] || 0) + n; return n;
  };
  if (exch) {
    for (const type of ['new_crypto', 'delistings', 'latest_bybit_news']) {
      for (let page = 1; page <= 40; page++) {
        let rows = []; try { rows = await S.bybitAnnPage(type, page, 50); } catch (e) { log('bybit ' + type + ' p' + page + ' ' + e.message); break; }
        if (!rows.length) break;
        await take('bybit-ann', 'primary', rows);
        if (rows[rows.length - 1].ts < since) break;
        await sleep(350);
      }
    }
    for (const annType of ['announcements-new-listings', 'announcements-delistings', 'latest-events', 'announcements-trading-updates']) {
      for (let page = 1; page <= 40; page++) {
        let r; try { r = await S.okxAnnPage(annType, page); } catch (e) { log('okx ' + annType + ' p' + page + ' ' + e.message); break; }
        if (!r.rows.length) break;
        await take('okx-ann', 'primary', r.rows);
        if (r.rows[r.rows.length - 1].ts < since || page >= r.pages) break;
        await sleep(350);
      }
    }
  }
  if (exch) {
    for (const [cat] of SX.BINANCE_CATS) {
      for (let page = 1; page <= 30; page++) {
        let r; try { r = await SX.binanceAnnPage(cat, page, 50); } catch (e) { log('binance ' + cat + ' p' + page + ' ' + e.message); break; }
        if (!r.rows.length) break;
        await take('binance-ann', 'primary', r.rows);
        if (r.rows[r.rows.length - 1].ts < since) break;
        await sleep(400);
      }
    }
  }
  if (macro) await take('calendar', 'primary', macroRows(since, now));
  if (tg) {
    for (const [ch, tier] of S.TG) {
      let before = 0, pages = 0;
      while (pages < 120) {
        let rows = []; try { rows = await S.tg(ch, before); } catch (e) { log('tg ' + ch + ' before=' + before + ' ' + e.message); break; }
        if (!rows.length) break;
        pages++;
        await take('tg:' + ch, tier, rows);
        const oldest = rows.reduce((a, r) => (r.ts < a.ts ? r : a), rows[0]);
        if (oldest.ts < since || !oldest.num) break;
        before = oldest.num;
        await sleep(700);
      }
      log('tg ' + ch + ': ' + pages + ' pages');
    }
  }
  return stats;
}

// CLI: open the storage the way index.js does and run once. Never imported by the live process.
const isMain = process.argv[1] && /backfill\.js$/.test(process.argv[1]);
if (isMain) {
  (async () => {
    const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
    const has = k => process.argv.includes(k);
    // the same factory and the same migrations dir as the live process (WAL + busy_timeout 5 s, so this second
    // writer waits for the live inserts instead of failing on SQLITE_BUSY - the 10-09 drop-liq lesson)
    const { fileURLToPath } = await import('node:url'); const { dirname, join } = await import('node:path');
    const { createStorage } = await import('../storage/index.js');
    const storage = createStorage();
    storage.migrate(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'migrations'));
    const { startCatalystStore } = await import('./index.js');
    startCatalystStore(storage);
    try { const l = await S.bybitSymbols(); setSymbolsFrom(l); } catch (e) { console.log('symbols: ' + e.message); }
    const st = await backfill({ days: +arg('--days', 35), tg: !has('--no-tg') && !has('--exch-only'), exch: !has('--tg-only'), macro: !has('--tg-only'), dry: has('--dry') });
    console.log(JSON.stringify(st));
    try { console.log('table now', JSON.stringify(storage.catalystCount(Date.now() - 40 * 86400000))); } catch (e) {}
    process.exit(0);
  })().catch(e => { console.error(e); process.exit(1); });
}
