// One live cycle of each REST poller (Gate, HTX, dYdX) with a counting onEvent: how many markets it walked, how long the
// cycle took, how many liquidations it emitted and over how many coins, and whether any page was truncated.
// Run from collector/: node tools/probe-restpoll.mjs [gate|htx|dydx]
import { GateLiqCollector, HtxLiqCollector, DydxLiqCollector } from '../src/collectors/restpoll.js';
const only = process.argv[2];
const SYMS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'LINK', 'AVAX', 'LTC'];
for (const [name, C] of [['gate', GateLiqCollector], ['htx', HtxLiqCollector], ['dydx', DydxLiqCollector]]) {
  if (only && only !== name) continue;
  const ev = []; const c = new C({ symbols: SYMS, onEvent: e => ev.push(e) });
  const t0 = Date.now(); await c.poll(); const ms = Date.now() - t0;
  const coins = new Set(ev.map(e => e.symbol)); const outside = [...coins].filter(s => !SYMS.includes(s));
  const usd = ev.reduce((s, e) => s + e.notional, 0); const bad = ev.filter(e => !(e.notional > 0) || !(e.ts > 0) || !/^[A-Z0-9]+$/.test(e.symbol));
  console.log(name.padEnd(5), 'markets', c.markets, 'cycle', ms + 'ms', 'events', ev.length, 'coins', coins.size, 'outside the old 10', outside.length, '$' + Math.round(usd), 'truncated', c.truncated, 'bad rows', bad.length, 'sample', JSON.stringify(ev[0] || null));
}
