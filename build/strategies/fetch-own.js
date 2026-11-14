/* Open interest history for the MarginPad-data rules, into build/data/sim/oi/<SYM>-60.json ([{t, oi}], hourly, oldest first).
   Until 2026-11-15 the file held the newest 12,000 hours of ten coins (500 days), so Open Interest Washout was judged on
   1.3 years while every price rule beside it had six. Bybit keeps hourly open interest back to 2020-21 for its linear
   perps, so this pages back with endTime until an empty page, for every crypto market the library tests.
   The figure is Bybit's own open contracts, read beside Binance prices: a change in open interest is the market's
   leverage being added or cleared, and one large venue measures that direction; it is not a total.

   node build/strategies/fetch-own.js [--only BTC,ETH] */
const fs = require('fs'), path = require('path');
const { MARKETS } = require('./markets');
const DIR = path.join(__dirname, '..', 'data', 'sim', 'oi');
fs.mkdirSync(DIR, { recursive: true });
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const ONLY = (arg('--only') || '').split(',').filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function page(sym, end) {
  for (let i = 0; i < 5; i++) {
    try {
      const u = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${sym}USDT&intervalTime=1h&limit=200` + (end ? `&endTime=${end}` : '');
      const j = await (await fetch(u, { signal: AbortSignal.timeout(20000) })).json();
      if (j.retCode === 0) return (j.result && j.result.list) || [];
      if (j.retCode === 10001) return null; // no such symbol on Bybit
    } catch (e) {}
    await sleep(1500 * (i + 1));
  }
  return null;
}

(async () => {
  for (const m of MARKETS.filter((x) => x.cls === 'crypto' && (!ONLY.length || ONLY.includes(x.sym)))) {
    const map = new Map(); let end = 0, pages = 0;
    for (;;) {
      const l = await page(m.sym, end);
      if (!l || !l.length) break;
      for (const x of l) map.set(+x.timestamp, +x.openInterest);
      const oldest = Math.min(...l.map((x) => +x.timestamp));
      if (end && oldest >= end) break;
      end = oldest - 1; pages++;
      await sleep(80);
    }
    if (map.size < 500) { console.log(m.sym, 'skipped', map.size); continue; }
    const out = [...map.entries()].sort((a, b) => a[0] - b[0]).map(([t, oi]) => ({ t, oi }));
    const f = path.join(DIR, `${m.sym}-60.json`);
    fs.writeFileSync(f + '.tmp', JSON.stringify(out)); fs.renameSync(f + '.tmp', f);
    console.log(m.sym, out.length, new Date(out[0].t).toISOString().slice(0, 10), '->', new Date(out[out.length - 1].t).toISOString().slice(0, 10), pages + ' pages');
  }
})();
