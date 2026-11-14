// Run the shipped Hyperliquid harvest for N minutes from THIS machine (its own 1,200 weight/min) and print what it found:
// liquidation events, dollars, and how the checks split between engine-hash and ordinary candidates and their hit rates.
// Run from collector/: node tools/probe-hl-harvest.mjs [minutes]
import { HyperliquidLiqCollector } from '../src/collectors/hyperliquid.js';
const MIN = +(process.argv[2] || 5);
const ev = [];
const c = new HyperliquidLiqCollector({ symbols: ['BTC', 'ETH', 'SOL'], onEvent: e => ev.push(e) });
await c.init(); c.start();
setTimeout(() => {
  const s = c.stat, usd = ev.reduce((a, e) => a + e.notional, 0);
  console.log('minutes', MIN, 'events', ev.length, 'usd', Math.round(usd), 'coins', new Set(ev.map(e => e.symbol)).size);
  console.log('checks', s.checks, 'engine checks', s.engineChecks, 'engine hits', s.engineHits, 'ordinary checks', s.checks - s.engineChecks, 'ordinary hits', s.ordinaryHits, 'queue left', c.candidates.length);
  console.log('hit rate engine', (s.engineHits / Math.max(1, s.engineChecks) * 100).toFixed(0) + '%', 'ordinary', (s.ordinaryHits / Math.max(1, s.checks - s.engineChecks) * 100).toFixed(0) + '%');
  c.shutdown(); process.exit(0);
}, MIN * 60000);
