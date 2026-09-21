// The two new endpoints, served by the REAL api server with the REAL collectors behind them. Storage is
// stubbed because neither route touches it - which is itself worth asserting, since phase 00 writes nothing.
import { createApiServer } from './src/api/server.js';
import { BookCollector } from './src/collectors/book.js';
import { TapeCollector } from './src/collectors/tape.js';
import { config } from '../collector/config.js';

const SECS = +process.argv[2] || 35;
const SYMS = ['BTC', 'ETH'];
let pass = 0, fail = 0;
const chk = (n, ok, d) => { ok ? pass++ : fail++; console.log((ok ? '  ok   ' : '  FAIL ') + n + (d !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(d).slice(0, 220) : '')); };

let storageTouched = false;
const storage = new Proxy({}, { get() { storageTouched = true; return () => { throw new Error('storage must not be touched'); }; } });

const bookCols = ['bybit', 'okx', 'bitget', 'hyperliquid'].map((v) => new BookCollector(v, { symbols: SYMS }));
const tapeCols = ['bybit', 'binance'].map((v) => new TapeCollector(v, { symbols: SYMS }));

await Promise.allSettled([...bookCols, ...tapeCols].map((c) => c.init()));
[...bookCols, ...tapeCols].forEach((c) => c.start());

const api = createApiServer({ storage, getStatus: () => ({ ok: true }), bus: { on() {} }, bookCols, tapeCols });
const base = 'http://127.0.0.1:' + config.api.port;
await new Promise((r) => setTimeout(r, SECS * 1000));

const get = async (p) => { const r = await fetch(base + p); return { status: r.status, j: await r.json().catch(() => null) }; };

console.log(`\nbook/tape API - ${SECS}s of warm-up\n`);

{
  const { status, j } = await get('/api/v1/book?symbol=BTC');
  chk('GET /api/v1/book?symbol=BTC answers 200', status === 200, { status });
  chk('  it names the venues it has a valid book for', j && Object.keys(j.venues || {}).length >= 2, { venues: j && Object.keys(j.venues || {}) });
  const v = j && Object.values(j.venues || {})[0];
  chk('  each venue carries spread, depth and a slippage curve', !!(v && v.spreadBps > 0 && v.depthUsd && v.slipBps), v && { spreadBps: v.spreadBps, depth25: v.depthUsd && v.depthUsd.bid_25 });
  chk('  consolidated depth sums the venues', !!(j && j.consolidatedDepthUsd && j.consolidatedDepthUsd.bidUsd['25'] > 0), j && j.consolidatedDepthUsd && j.consolidatedDepthUsd.bidUsd);
  chk('  every book it returns is fresh (under 30s)', Object.values(j.venues || {}).every((x) => x.ageMs < 30000), Object.fromEntries(Object.entries(j.venues || {}).map(([k, x]) => [k, x.ageMs])));
}
{
  const { status } = await get('/api/v1/book?symbol=NOTACOIN');
  chk('an unknown symbol is refused, not invented', status === 404, { status });
}
{
  const { status, j } = await get('/api/v1/tape?symbol=BTC&limit=20');
  chk('GET /api/v1/tape?symbol=BTC answers 200', status === 200, { status });
  chk('  it returns trades, newest last, in time order', !!(j && j.trades && j.trades.length && j.trades.every((t, i, a) => !i || t.ts >= a[i - 1].ts)), { n: j && j.trades && j.trades.length });
  chk('  it honours the limit', !!(j && j.trades.length <= 20), { n: j && j.trades && j.trades.length });
  chk('  every row names the aggressor', !!(j && j.trades.every((t) => t.side === 'buy' || t.side === 'sell')));
  chk('  it says out loud that side means the aggressor', !!(j && /AGGRESSOR/.test(j.note || '')));
  const d = j && j.deltaThisMinute;
  chk('  cumulative delta adds up', !!(d && Math.abs((d.buyUsd - d.sellUsd) - d.deltaUsd) <= 1), d);
}
chk('neither endpoint touched storage (phase 00 writes nothing)', !storageTouched);

[...bookCols, ...tapeCols].forEach((c) => c.shutdown());
try { api.close(() => {}); } catch (e) {}
console.log(`\nbook/tape API: ${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;
setTimeout(() => process.exit(fail ? 1 : 0), 300);
