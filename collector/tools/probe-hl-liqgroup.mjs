// One Hyperliquid liquidation is one print (2026-11-13). Drives the shipped `liqEventsOf` - the pure half of the
// Hyperliquid liquidation collector - over a fixture shaped like the real 00:31:47 UTC event (52 fills, one
// millisecond, one liquidatedUser) and, with --real <wallet>, over that wallet's real fills from the exchange.
//   node tools/probe-hl-liqgroup.mjs            (from collector/; exit 1 on a red check)
//   node tools/probe-hl-liqgroup.mjs --real 0x01e273fc08012db1b75e8ca93f8139bfac2ee977
import { liqEventsOf } from '../src/collectors/hyperliquid.js';

let fail = 0;
const ok = (name, cond, detail) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (detail ? '  ' + detail : '')); if (!cond) fail++; };

const WHALE = '0x01e273fc08012db1b75e8ca93f8139bfac2ee977', MAKER = '0xaaaa000000000000000000000000000000000001';
const T = 1794529907938; // 2026-11-13T00:31:47.938Z
const liq = { liquidatedUser: WHALE, markPx: '71115.0', method: 'market' };
// the liquidated long is force-SOLD: its own fills are side 'A'
const own = [];
for (let i = 0; i < 52; i++) own.push({ coin: 'BTC', side: 'A', px: String(71092 + (i % 12)), sz: String(i === 0 ? 13.76 : 0.6), time: T, tid: 1000 + i, hash: '0xh', liquidation: liq });
// the counterparty's copy of three of those fills: opposite side, the SAME tid (one trade, one id on both sides - measured)
const maker = own.slice(0, 3).map((f) => ({ ...f, side: 'B', oid: 777 }));
// a second, separate liquidation five minutes later, and a spot fill that must never count
const later = [{ coin: 'BTC', side: 'A', px: '70840', sz: '2', time: T + 300000, tid: 9000, liquidation: liq }];
const spot = [{ coin: '@107', side: 'A', px: '1', sz: '5', time: T, tid: 9100, liquidation: liq }];

const seen = new Set();
const ev = liqEventsOf(own.concat(spot), WHALE, seen);
ok('52 fills of one liquidation are ONE event', ev.length === 1, 'events=' + ev.length);
const e = ev[0] || {};
const sz = own.reduce((a, f) => a + +f.sz, 0), ntl = own.reduce((a, f) => a + +f.px * +f.sz, 0);
ok('its size is the sum of the fills', Math.abs((e.qty || 0) - sz) < 1e-6, 'qty=' + e.qty + ' want ' + sz.toFixed(4));
ok('its price is the notional-weighted mean', Math.abs((e.price || 0) - ntl / sz) < 0.01, 'px=' + e.price + ' want ' + (ntl / sz).toFixed(3));
ok('its notional is the sum', Math.abs((e.notional || 0) - ntl) < 0.01, 'usd=' + Math.round(e.notional || 0));
ok('a liquidated long is booked as long_liquidated', e.side === 'long_liquidated', e.side);
ok('the event carries the exchange timestamp', e.ts === T, String(e.ts));
ok('a spot fill never counts', !ev.some((x) => x.symbol !== 'BTC'), ev.map((x) => x.symbol).join(','));
// the fixture holds many fills of 0.6 BTC at the same price in the same millisecond, as the real event did (two of 0.09 at 71,102):
// they are different trades with different tids and every one counts - the old price+size key booked one of each pair
ok('two fills of one size at one price in one millisecond are both counted', (e.fills || 0) === 52, 'fills=' + e.fills);
const ev2 = liqEventsOf(maker, MAKER, seen);
ok("the counterparty's copy of the same fills adds nothing", ev2.length === 0, 'events=' + ev2.length);
const ev3 = liqEventsOf(own, WHALE, seen);
ok('a second harvest of the same user adds nothing', ev3.length === 0, 'events=' + ev3.length);
const ev4 = liqEventsOf(later, WHALE, seen);
ok('a later slice is its own event', ev4.length === 1 && ev4[0].qty === 2, JSON.stringify(ev4[0] || null));
// the counterparty FIRST: its copy is read as the maker's own fill, booked on the right side, and the whale's later copy is a no-op
const seenB = new Set();
const evB = liqEventsOf(maker, MAKER, seenB);
ok('seen from the maker first, the three fills are one event on the liquidated side', evB.length === 1 && evB[0].side === 'long_liquidated' && evB[0].fills === 3, JSON.stringify(evB[0] || null));
const evB2 = liqEventsOf(own, WHALE, seenB);
ok('and the whale\'s own copy then adds only the fills the maker did not carry', evB2.length === 1 && evB2[0].fills === 49, JSON.stringify(evB2[0] && { fills: evB2[0].fills, qty: evB2[0].qty }));

const ri = process.argv.indexOf('--real');
if (ri > 0 && process.argv[ri + 1]) {
  const user = process.argv[ri + 1];
  const r = await fetch('https://api.hyperliquid.xyz/info', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'userFillsByTime', user, startTime: Date.now() - 36 * 3600000 }) });
  const fills = await r.json();
  const evs = liqEventsOf(fills, user, new Set());
  console.log('\nreal:', fills.length, 'fills ->', evs.length, 'liquidation events');
  for (const x of evs) console.log(' ', new Date(x.ts).toISOString(), x.symbol, x.side, 'px', x.price, 'qty', x.qty, 'usd', Math.round(x.notional), 'fills', x.fills);
}
console.log('\n' + (fail ? 'FAIL ' + fail : 'all green'));
process.exit(fail ? 1 : 0);
